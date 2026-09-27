// Score → lanes. A lane is one sound source playing one part: a BBC SO plugin instance
// (one tuning, a set of articulations on keyswitches) or a folder of user samples.
//
// - Quarter tones: notes a quarter tone up go to a second instance tuned +50 cents (docs/decisions/0013).
// - Players: 1 → the solo patch, more → the section patch at a lower gain (docs/decisions/0015).
// - Dynamics: the part's continuous level drives CC1 and the velocity.
// - Missing sounds: samples/<instrument>/ (docs/decisions/0012).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { bbcsoMap, chooseArticulation, type PitchedMap } from "../libraries/bbcso/map.ts";
import { levelAt, type NormalPart, type NormalScore, type Note } from "../score/normalize.ts";
import { Rational } from "../score/rational.ts";
import { secondsAt } from "../score/timeline.ts";

const inventory = JSON.parse(
  readFileSync(join(import.meta.dirname, "../libraries/bbcso/inventory.json"), "utf8"),
) as Record<string, Record<string, { range: [number, number] } | null>>;

export interface TimedEvent {
  seconds: number;
  bytes: number[];
}

export interface BbcsoLane {
  kind: "bbcso";
  partId: string;
  /** BBC SO instrument, e.g. "Violins 1". */
  instrument: string;
  /** Articulations in keyswitch order (keyswitch = index). */
  articulations: string[];
  /** Global tune in semitones: 0 or 0.5. */
  tune: number;
  events: TimedEvent[];
  gain: number;
}

export interface SampleLane {
  kind: "samples";
  partId: string;
  files: string[];
  hits: { seconds: number; gain: number; seed: number }[];
  gain: number;
}

export type Lane = BbcsoLane | SampleLane;

export interface Plan {
  lanes: Lane[];
  /** Seconds covered, from the range start. */
  duration: number;
  warnings: string[];
}

export interface Range {
  /** Quarter-note time where playback starts. */
  from: Rational;
  /** Quarter-note time where playback stops (notes still ring out). */
  to: Rational;
}

export const samplesRoot = join(import.meta.dirname, "../../samples");

function sampleFiles(instrument: string, technique: string): string[] {
  const dirs = [join(samplesRoot, instrument, technique), join(samplesRoot, instrument)];
  for (const dir of dirs) {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    const files = readdirSync(dir)
      .filter((f) => /\.(wav|aiff?|flac)$/i.test(f))
      .sort()
      .map((f) => join(dir, f));
    if (files.length) return files;
  }
  return [];
}

/** CC1 value for a dynamic level (0 = niente … 8 = fff). */
const ccFor = (level: number) => Math.round(Math.max(0, Math.min(1, level / 8)) * 127);
/** Note-on velocity for a dynamic level. */
const velocityFor = (level: number, accent: boolean) =>
  Math.max(1, Math.min(127, Math.round(16 + (Math.max(0, level) / 8) * 104 + (accent ? 14 : 0))));
/** Linear gain for a sample hit at a dynamic level (mf = 1, 6 dB per level). */
const sampleGainFor = (level: number) => (level <= 0 ? 0 : 10 ** (((level - 5) * 6) / 20));

export function plan(score: NormalScore, range?: Range): Plan {
  const from = range?.from ?? Rational.zero;
  const to = range?.to ?? score.end;
  const t0 = secondsAt(score.tempo, from.value);
  const sec = (q: Rational) => secondsAt(score.tempo, q.value) - t0;
  const warnings: string[] = [];
  const lanes: Lane[] = [];
  const duration = sec(to);

  for (const part of score.parts) {
    const notes = part.notes.filter((n) => n.end.gt(from) && n.at.lt(to));
    const techniqueKey = (n: Note) => n.technique.join("+") || "ord";
    const map = bbcsoMap[part.instrument.id];

    // User samples replace the library for this instrument (or a technique of it).
    const withSamples = notes.filter(
      (n) => sampleFiles(part.instrument.id, techniqueKey(n)).length > 0,
    );
    if (withSamples.length) {
      const byFiles = new Map<string, SampleLane>();
      for (const n of withSamples) {
        const files = sampleFiles(part.instrument.id, techniqueKey(n));
        const key = files.join("|");
        if (!byFiles.has(key))
          byFiles.set(key, { kind: "samples", partId: part.id, files, hits: [], gain: 1 });
        if (n.at.lt(from)) continue;
        byFiles.get(key)!.hits.push({
          seconds: sec(n.at),
          gain: sampleGainFor(levelAt(part.dynamics, n.at)),
          seed: n.index,
        });
      }
      lanes.push(...byFiles.values());
    }
    const rest = notes.filter((n) => !withSamples.includes(n));
    if (rest.length === 0) continue;
    if (!map) {
      warnings.push(
        `${part.name}: no sound for ${part.instrument.name} (put samples in samples/${part.instrument.id}/)`,
      );
      continue;
    }

    if (map.kind === "unpitched") {
      const events: TimedEvent[] = [];
      for (const n of rest) {
        const t = techniqueKey(n);
        const key = map.keys[t] ?? map.keys.ord!;
        if (map.keys[t] === undefined)
          warnings.push(`${part.name}: ${t} is not available, played as ord`);
        if (n.at.lt(from)) continue;
        const on = sec(n.at);
        const off = sec(n.end);
        const level = levelAt(part.dynamics, n.at);
        events.push({ seconds: on, bytes: [0xb0, 1, ccFor(level)] });
        events.push({
          seconds: on,
          bytes: [
            0x90,
            key,
            velocityFor(
              level,
              n.articulations.includes("accent") || n.articulations.includes("marcato"),
            ),
          ],
        });
        events.push({ seconds: Math.max(on + 0.05, off), bytes: [0x80, key, 0] });
      }
      lanes.push({
        kind: "bbcso",
        partId: part.id,
        instrument: "Untuned Percussion",
        articulations: [map.articulation],
        tune: 0,
        events,
        gain: 1,
      });
      continue;
    }

    pitchedLanes(part, map, rest, from, sec, warnings, lanes);
  }

  return { lanes, duration, warnings: [...new Set(warnings)] };
}

function pitchedLanes(
  part: NormalPart,
  map: PitchedMap,
  notes: Note[],
  from: Rational,
  sec: (q: Rational) => number,
  warnings: string[],
  lanes: Lane[],
): void {
  // Solo or section, and gain for the players it stands for.
  const players = part.players;
  const useSection = map.section && (players > 1 || !map.solo);
  const instrument = useSection ? map.section!.name : map.solo!;
  const size = useSection ? map.section!.size : 1;
  let gain = Math.sqrt(Math.min(players, size) / size);
  if (!useSection && players > 1) {
    gain = Math.sqrt(players);
    warnings.push(`${part.name}: ${players} players approximated by the solo patch`);
  }
  const available = new Set(Object.keys(inventory[instrument] ?? {}));

  // Split notes by tuning: whole semitones on the plain instance, quarter tones on the +50 cent one.
  const byTune = new Map<number, { note: Note; key: number }[]>();
  for (const n of notes) {
    for (const p of n.pitches) {
      const tune = p.midi % 1 === 0 ? 0 : 0.5;
      const key = Math.floor(p.midi);
      if (!byTune.has(tune)) byTune.set(tune, []);
      byTune.get(tune)!.push({ note: n, key });
      const r =
        inventory[instrument]?.["Long"]?.range ??
        Object.values(inventory[instrument] ?? {}).find(Boolean)?.range;
      if (r && (key < r[0] || key > r[1]))
        warnings.push(`${part.name}: pitch ${p.midi} is outside ${instrument}'s sampled range`);
    }
  }

  for (const [tune, items] of byTune) {
    const articulations: string[] = [];
    const events: TimedEvent[] = [];
    let current = "";
    // Dynamics as CC1 every 50 ms through the lane's span, plus at each onset.
    const start = items.reduce((m, i) => (i.note.at.lt(m) ? i.note.at : m), items[0]!.note.at);
    const end = items.reduce((m, i) => (i.note.end.gt(m) ? i.note.end : m), items[0]!.note.end);
    const s0 = Math.max(0, sec(start));
    const s1 = sec(end);
    const quarterAt = (s: number) => {
      // Invert the tempo map by bisection between start and end.
      let lo = start.value;
      let hi = end.value;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (sec(Rational.of(Math.round(mid * 10080) / 10080)) < s) lo = mid;
        else hi = mid;
      }
      return Math.round(lo * 10080) / 10080;
    };
    let lastCc = -1;
    for (let s = s0; s <= s1 + 0.05; s += 0.05) {
      const cc = ccFor(levelAt(part.dynamics, Rational.of(quarterAt(s))));
      if (cc !== lastCc) events.push({ seconds: s, bytes: [0xb0, 1, cc] });
      lastCc = cc;
    }
    events.push({ seconds: 0, bytes: [0xb0, 11, 110] });

    const sorted = [...items].sort((a, b) => a.note.at.cmp(b.note.at));
    for (const { note, key } of sorted) {
      if (note.at.lt(from)) continue; // started before the range: skip rather than cut in mid-note
      const on = sec(note.at);
      const off = sec(note.end);
      const choice = chooseArticulation(map, note, off - on, available);
      if (choice.approximate) warnings.push(`${part.name}: ${choice.approximate}`);
      let ks = articulations.indexOf(choice.articulation);
      if (ks < 0) {
        ks = articulations.length;
        articulations.push(choice.articulation);
      }
      if (choice.articulation !== current) {
        events.push({ seconds: Math.max(0, on - 0.03), bytes: [0x90, ks, 100] });
        events.push({ seconds: Math.max(0, on - 0.02), bytes: [0x80, ks, 0] });
        current = choice.articulation;
      }
      const level = levelAt(part.dynamics, note.at);
      const accent =
        note.articulations.includes("accent") || note.articulations.includes("marcato");
      // Legato transitions need a small overlap; other notes release just before the next onset.
      const release = note.slur ? off + 0.03 : Math.max(on + 0.03, off - 0.01);
      events.push({ seconds: on, bytes: [0x90, key, velocityFor(level, accent)] });
      events.push({ seconds: release, bytes: [0x80, key, 0] });
    }
    if (articulations.length > 20)
      warnings.push(`${part.name}: more than 20 articulations in one lane`);
    lanes.push({ kind: "bbcso", partId: part.id, instrument, articulations, tune, events, gain });
  }
}

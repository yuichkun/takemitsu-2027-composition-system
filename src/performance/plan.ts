// Score → lanes. A lane is one sound source playing one part: a BBC SO plugin instance
// (one tuning, a set of articulations on keyswitches) or a folder of user samples.
// Lanes cover the whole piece in seconds; src/performance/chunks.ts cuts them into chunks.
//
// - Quarter tones: notes a quarter tone up go to a second instance tuned +50 cents (docs/decisions/0013).
// - Players: 1 → the solo patch, more → the section patch at a lower gain (docs/decisions/0015).
// - Dynamics: the part's continuous level drives CC1 and the velocity.
// - Missing sounds: samples/<instrument>/ (docs/decisions/0012).
// - Articulations: every lane of one BBC SO instrument loads the same set (all the articulations
//   the piece uses on it, in the library's order), so lanes share plugin instances and a note
//   elsewhere in the piece changes nothing unless it brings a new articulation.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { bbcsoMap, chooseArticulation, type PitchedMap } from "../libraries/bbcso/map.ts";
import type { Dynamic, NormalPart, NormalScore, Note } from "../score/normalize.ts";
import { quartersAt, secondsAt } from "../score/timeline.ts";

const inventory = JSON.parse(
  readFileSync(join(import.meta.dirname, "../libraries/bbcso/inventory.json"), "utf8"),
) as Record<string, Record<string, { range: [number, number] } | null>>;

export interface LaneNote {
  /** Onset and release in seconds from the start of the piece. */
  on: number;
  off: number;
  key: number;
  velocity: number;
  /** Articulation name (a BBC SO patch articulation). */
  articulation: string;
  /** Legato into the next note: the two must be played by the same instance, in one go. */
  slur: boolean;
  /** Index of the measure holding the onset. */
  measure: number;
  /** CC1 at the onset (unpitched percussion, which has no curve). */
  cc?: number;
  /**
   * A glissando: the instance's tuning over the note, as [seconds, semitones above the key]
   * points joined by straight lines (the note is played alone on a glide lane).
   */
  glide?: [number, number][];
}

export interface BbcsoLane {
  kind: "bbcso";
  /** Unique within the plan: part and tuning. */
  id: string;
  partId: string;
  /** BBC SO instrument, e.g. "Violins 1". */
  instrument: string;
  /** Articulations in keyswitch order (keyswitch = index), shared by all lanes of the instrument. */
  articulations: string[];
  /** Global tune in semitones: 0 or 0.5. */
  tune: number;
  notes: LaneNote[];
  /** CC1 at a time in seconds, from the part's dynamic curve; undefined: CC1 only at onsets. */
  cc?: (seconds: number) => number;
  gain: number;
}

export interface SampleHit {
  seconds: number;
  gain: number;
  seed: number;
  measure: number;
}

export interface SampleLane {
  kind: "samples";
  id: string;
  partId: string;
  files: string[];
  hits: SampleHit[];
  gain: number;
}

export type Lane = BbcsoLane | SampleLane;

export interface Plan {
  lanes: Lane[];
  /** Start and end of each measure in seconds. */
  measures: { start: number; end: number }[];
  /** Seconds to the end of the last measure. */
  duration: number;
  warnings: string[];
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

/** The dynamic level at a time in quarters (as normalize.levelAt, on plain numbers). */
function levelOf(dynamics: Dynamic[]): (quarters: number) => number {
  const at = dynamics.map((d) => d.at.value);
  return (q) => {
    if (dynamics.length === 0) return 5;
    let lo = 0;
    let hi = at.length - 1;
    if (q < at[0]!) return dynamics[0]!.level;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (at[mid]! <= q) lo = mid;
      else hi = mid - 1;
    }
    const d = dynamics[lo]!;
    const next = dynamics[lo + 1];
    if (d.to === "linear" && next) {
      const span = at[lo + 1]! - at[lo]!;
      return d.level + (next.level - d.level) * (span > 0 ? (q - at[lo]!) / span : 1);
    }
    return d.level;
  };
}

const techniqueKey = (n: Note) => n.technique.join("+") || "ord";
const accented = (n: Note) =>
  n.articulations.includes("accent") || n.articulations.includes("marcato");

interface Draft {
  lane: Omit<BbcsoLane, "articulations">;
}

export function plan(score: NormalScore): Plan {
  const warnings: string[] = [];
  const lanes: Lane[] = [];
  const drafts: Draft[] = [];
  const sec = (q: number) => secondsAt(score.tempo, q);
  const measureStarts = score.measures.map((m) => m.start.value);
  const measureOf = (q: number) => {
    let lo = 0;
    let hi = measureStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (measureStarts[mid]! <= q + 1e-9) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const measures = score.measures.map((m) => ({
    start: sec(m.start.value),
    end: sec(m.start.add(m.length).value),
  }));
  const duration = measures.at(-1)?.end ?? 0;

  for (const written of score.parts) {
    // Notes play at their own times (a feathered group is written evenly: normalize.ts).
    const part = {
      ...written,
      notes: written.notes.map((n) => (n.play ? { ...n, ...n.play } : n)),
    };
    const map = bbcsoMap[part.instrument.id];
    const level = levelOf(part.dynamics);

    // User samples replace the library for this instrument (or a technique of it).
    const withSamples = part.notes.filter(
      (n) => sampleFiles(part.instrument.id, techniqueKey(n)).length > 0,
    );
    if (withSamples.length) {
      const byFiles = new Map<string, SampleLane>();
      for (const n of withSamples) {
        const files = sampleFiles(part.instrument.id, techniqueKey(n));
        const key = files.join("|");
        if (!byFiles.has(key))
          byFiles.set(key, {
            kind: "samples",
            id: `${part.id}#samples${byFiles.size}`,
            partId: part.id,
            files,
            hits: [],
            gain: 1,
          });
        byFiles.get(key)!.hits.push({
          seconds: sec(n.at.value),
          gain: sampleGainFor(level(n.at.value)),
          seed: n.index,
          measure: measureOf(n.at.value),
        });
      }
      lanes.push(...byFiles.values());
    }
    const rest = part.notes.filter((n) => !withSamples.includes(n));
    if (rest.length === 0) continue;
    if (!map) {
      warnings.push(
        `${part.name}: no sound for ${part.instrument.name} (put samples in samples/${part.instrument.id}/)`,
      );
      continue;
    }

    if (map.kind === "unpitched") {
      const notes: LaneNote[] = [];
      for (const n of rest) {
        const t = techniqueKey(n);
        const found = map.keys[t] ?? map.keys.ord!;
        if (map.keys[t] === undefined)
          warnings.push(`${part.name}: ${t} is not available, played as ord`);
        const [articulation, key] = typeof found === "number" ? [map.articulation, found] : found;
        const on = sec(n.at.value);
        const lv = level(n.at.value);
        notes.push({
          on,
          off: Math.max(on + 0.05, sec(n.end.value)),
          key,
          velocity: velocityFor(lv, accented(n)),
          articulation,
          slur: false,
          measure: measureOf(n.at.value),
          cc: ccFor(lv),
        });
      }
      drafts.push({
        lane: {
          kind: "bbcso",
          id: part.id,
          partId: part.id,
          instrument: "Untuned Percussion",
          tune: 0,
          notes,
          // CC1 follows the part's curve too, so a roll swells as written (a hit takes its
          // velocity).
          cc: (seconds: number) => ccFor(level(quartersAt(score.tempo, seconds))),
          gain: 1,
        },
      });
      continue;
    }

    pitchedLanes(part, map, rest, score, sec, measureOf, level, warnings, drafts);
  }

  // One articulation set per BBC SO instrument, in the library's order.
  const used = new Map<string, Set<string>>();
  for (const { lane } of drafts) {
    const set = used.get(lane.instrument) ?? new Set<string>();
    for (const n of lane.notes) set.add(n.articulation);
    used.set(lane.instrument, set);
  }
  const order = (instrument: string) => {
    const known = Object.keys(inventory[instrument] ?? {});
    const set = used.get(instrument)!;
    return [...set].sort((a, b) => known.indexOf(a) - known.indexOf(b) || a.localeCompare(b));
  };
  for (const { lane } of drafts) {
    const articulations = order(lane.instrument);
    if (articulations.length > 20)
      warnings.push(`${lane.instrument}: more than 20 articulations in one instance`);
    lanes.push({ ...lane, articulations });
  }

  return { lanes, measures, duration, warnings: [...new Set(warnings)] };
}

/**
 * The keys a pitched part's BBC SO patch has samples for (the solo or the section patch, as the
 * part is played), or none if it is not played by BBC SO. The preview marks notes outside it.
 */
export function sampledRange(part: NormalPart): [number, number] | undefined {
  const map = bbcsoMap[part.instrument.id];
  if (!map || map.kind !== "pitched") return undefined;
  const instrument = map.section && (part.players > 1 || !map.solo) ? map.section.name : map.solo!;
  const keys =
    inventory[instrument]?.["Long"]?.range ??
    Object.values(inventory[instrument] ?? {}).find(Boolean)?.range;
  const offset = map.keyOffset ?? 0;
  return keys && [keys[0] - offset, keys[1] - offset];
}

function pitchedLanes(
  part: NormalPart,
  map: PitchedMap,
  notes: Note[],
  score: NormalScore,
  sec: (q: number) => number,
  measureOf: (q: number) => number,
  level: (q: number) => number,
  warnings: string[],
  drafts: Draft[],
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
  const range =
    inventory[instrument]?.["Long"]?.range ??
    Object.values(inventory[instrument] ?? {}).find(Boolean)?.range;

  // Glissandi: a run of notes each sliding into the next (same staff and voice) is played as one
  // held key on a glide lane, whose tuning follows the pitches (BBC SO ignores pitch bend; its
  // Global Tune moves a sounding note: docs/research/bbcso.md §4).
  const glides: { busy: number; notes: LaneNote[] }[] = [];
  const inGlide = new Set<Note>();
  const byVoice = new Map<number, Note[]>();
  for (const n of notes) {
    const k = n.staff * 4 + n.voice;
    byVoice.set(k, [...(byVoice.get(k) ?? []), n]);
  }
  for (const list of byVoice.values()) {
    list.sort((a, b) => a.at.cmp(b.at));
    for (let i = 0; i < list.length; i++) {
      if (!list[i]!.gliss || !list[i + 1] || inGlide.has(list[i]!)) continue;
      const chain = [list[i]!];
      for (let j = i; list[j]!.gliss && list[j + 1]; j++) chain.push(list[j + 1]!);
      for (const n of chain) inGlide.add(n);
      if (chain.some((n) => n.pitches.length > 1))
        warnings.push(`${part.name}: a glissando slides the lowest note of a chord only`);
      const first = chain[0]!;
      const last = chain.at(-1)!;
      const pitchOf = (n: Note) => n.pitches[0]!.midi;
      const key = Math.floor(pitchOf(first)) + (map.keyOffset ?? 0);
      const path: [number, number][] = [];
      const base = key - (map.keyOffset ?? 0);
      chain.forEach((n, c) => {
        path.push([sec(n.at.value), pitchOf(n) - base]);
        const next = chain[c + 1];
        if (next) path.push([sec(n.at.add(n.glissAfter).value), pitchOf(n) - base]);
      });
      path.push([sec(last.end.value), pitchOf(last) - base]);
      if (path.some(([, s]) => Math.abs(s) > 36))
        warnings.push(`${part.name}: a glissando wider than 36 semitones from its first note`);
      const on = sec(first.at.value);
      const off = sec(last.end.value);
      const choice = chooseArticulation(map, first, off - on, available);
      const keys = inventory[instrument]?.[choice.articulation]?.range ?? range;
      if (keys && (key < keys[0] || key > keys[1]))
        warnings.push(
          `${part.name}: pitch ${pitchOf(first)} is outside ${instrument}'s sampled range`,
        );
      let lane = glides.find((g) => g.busy <= on);
      if (!lane) glides.push((lane = { busy: 0, notes: [] }));
      lane.busy = off + 0.5;
      lane.notes.push({
        on,
        off: Math.max(on + 0.03, off - 0.01),
        key,
        velocity: velocityFor(level(first.at.value), accented(first)),
        articulation: choice.articulation,
        slur: false,
        measure: measureOf(first.at.value),
        glide: path.map(([t, s]) => [t, Math.max(-36, Math.min(36, s))]),
      });
    }
  }

  // Split notes by tuning: whole semitones on the plain instance, quarter tones on the +50 cent one.
  const byTune = new Map<number, LaneNote[]>();
  for (const n of notes) {
    if (inGlide.has(n)) continue;
    const on = sec(n.at.value);
    const off = sec(n.end.value);
    const choice = chooseArticulation(map, n, off - on, available);
    if (choice.approximate) warnings.push(`${part.name}: ${choice.approximate}`);
    const velocity = velocityFor(level(n.at.value), accented(n));
    // Legato transitions need a small overlap; other notes release just before the next onset.
    const release = n.slur ? off + 0.03 : Math.max(on + 0.03, off - 0.01);
    // The keys the chosen articulation has samples for (harmonics reach higher than long notes).
    const keys = inventory[instrument]?.[choice.articulation]?.range ?? range;
    for (const p of n.pitches) {
      const tune = p.midi % 1 === 0 ? 0 : 0.5;
      const key = Math.floor(p.midi) + (map.keyOffset ?? 0);
      if (keys && (key < keys[0] || key > keys[1]))
        warnings.push(`${part.name}: pitch ${p.midi} is outside ${instrument}'s sampled range`);
      if (!byTune.has(tune)) byTune.set(tune, []);
      byTune.get(tune)!.push({
        on,
        off: release,
        key,
        velocity,
        articulation: choice.articulation,
        slur: n.slur,
        measure: measureOf(n.at.value),
      });
    }
  }

  // CC1 follows the part's curve (in quarters, so it moves with the tempo).
  const cc = (seconds: number) => ccFor(level(quartersAt(score.tempo, seconds)));
  glides.forEach((g, i) => {
    drafts.push({
      lane: {
        kind: "bbcso",
        id: `${part.id}#glide${i}`,
        partId: part.id,
        instrument,
        tune: 0,
        notes: g.notes,
        cc,
        gain,
      },
    });
  });
  for (const [tune, laneNotes] of byTune) {
    laneNotes.sort((a, b) => a.on - b.on || a.key - b.key);
    drafts.push({
      lane: {
        kind: "bbcso",
        id: tune ? `${part.id}#+50` : part.id,
        partId: part.id,
        instrument,
        tune,
        notes: laneNotes,
        cc,
        gain,
      },
    });
  }
}

// Reads a score JSON into exact, validated form shared by the notation and performance projections.

import { instrument, playersOf, type Instrument } from "../instruments/catalog.ts";
import { techniqueOf } from "../instruments/techniques.ts";
import { parsePitch, type Spelled } from "./pitch.ts";
import { max, min, Rational } from "./rational.ts";
import { measures, tempoMap, type Measure, type TempoSegment } from "./timeline.ts";
import type { Articulation, DynamicPoint, NoteEvent, Part, Score, TextEvent } from "./types.ts";

export interface Note {
  at: Rational;
  dur: Rational;
  end: Rational;
  /** Empty for unpitched percussion. */
  pitches: Spelled[];
  voice: number;
  staff: number;
  /** The score gave the staff (a grand-staff instrument's notes without one go by register). */
  staffGiven: boolean;
  /** Technique components, e.g. ["tremolo", "sul-pont"]; empty for ord. */
  technique: string[];
  articulations: Articulation[];
  slur: boolean;
  /**
   * A feathered group (Part.feathers): `at`/`dur` are then where the note is written, evenly in
   * the span; `play` is when it sounds. `group` tells the groups apart; `first` begins the beam.
   */
  feather?: { kind: "accel" | "rit"; group: number; first: boolean };
  play?: { at: Rational; dur: Rational; end: Rational };
  /** Slides into the next note of the same voice over its whole length. */
  gliss: boolean;
  /** Quarters to hold before the slide starts. */
  glissAfter: Rational;
  glissPitches?: Spelled[];
  trill?: 1 | 2;
  /**
   * Notation only: an artificial harmonic written out (src/notation/musicxml.ts): `pitches` are
   * then the stopped note and, above it, the touched one.
   */
  touching?: boolean;
  /** Index in the part's events, for messages. */
  index: number;
}

export interface Dynamic {
  at: Rational;
  level: number;
  to: "linear" | "step";
  /** Notation only: state the level again on entering after a rest. */
  restate?: boolean;
}

export interface NormalPart {
  id: string;
  instrument: Instrument;
  name: string;
  abbreviation: string;
  players: number;
  /** Who plays it (Part.player), when one player plays several parts. */
  player?: string;
  notes: Note[];
  texts: { at: Rational; text: string; placement: "above" | "below" }[];
  dynamics: Dynamic[];
}

export interface NormalScore {
  title: string;
  parts: NormalPart[];
  measures: Measure[];
  tempo: TempoSegment[];
  /** `change`: a gradual change starts here (accel. or rit., to the next mark). */
  tempoMarks: { at: Rational; bpm: number; beat: Rational; text?: string; change?: string }[];
  rehearsal: { measure: number; label: string }[];
  /** Where fermatas are written (Score.fermatas). */
  fermatas: Rational[];
  /** How far an accidental reaches (Score.accidentals). */
  accidentals: "note" | "bar";
  /** Whether a pair of winds or brass may share a staff (Score.pairs). */
  pairs: boolean;
  end: Rational;
  warnings: string[];
}

function splitTechnique(t: string | undefined): string[] {
  if (!t || t === "ord") return [];
  return t
    .split("+")
    .filter((x) => x && x !== "ord")
    .sort();
}

function normalizePart(part: Part, warnings: string[]): NormalPart {
  const inst = instrument(part.instrument);
  const players = playersOf(part);
  const where = (i: number) => `part "${part.id}", event ${i}`;
  const notes: Note[] = [];
  const texts: NormalPart["texts"] = [];
  /** Events giving a fixed-pitch instrument a quarter tone. */
  const quarterTones: number[] = [];
  const dynamics: Dynamic[] = (part.dynamics ?? []).map((d: DynamicPoint) => ({
    at: Rational.of(d.at),
    level: d.level,
    to: d.to ?? "step",
  }));

  part.events.forEach((event, index) => {
    if (event.type === "text") {
      const t = event as TextEvent;
      texts.push({ at: Rational.of(t.at), text: t.text, placement: t.placement ?? "above" });
      return;
    }
    const e = event as NoteEvent;
    const at = Rational.of(e.at);
    const dur = Rational.of(e.dur);
    if (dur.lte(Rational.zero)) throw new Error(`${where(index)}: duration must be positive`);
    const raw = e.pitch === undefined ? [] : Array.isArray(e.pitch) ? e.pitch : [e.pitch];
    const pitches = raw.map((p) => parsePitch(p)).sort((a, b) => a.midi - b.midi);
    const glissPitches = e.glissPitches?.map(parsePitch);
    if (glissPitches) {
      if (!e.gliss || pitches.length !== 1 || glissPitches.length < 2)
        throw new Error(
          `${where(index)}: glissPitches needs a single-note gliss and two endpoints`,
        );
      if (glissPitches[0]!.midi !== pitches[0]!.midi)
        throw new Error(`${where(index)}: glissPitches must start on the written pitch`);
      if (
        glissPitches.some((p) => inst.range && (p.midi < inst.range[0] || p.midi > inst.range[1]))
      )
        throw new Error(`${where(index)}: a swept pitch is outside the instrument's range`);
      if (
        inst.fixedPitch &&
        glissPitches.some((p) => !Number.isInteger(p.midi - (part.tuning ?? 0)))
      )
        throw new Error(`${where(index)}: a swept pitch is outside the instrument's tuning`);
    }
    if (inst.unpitched && pitches.length)
      warnings.push(`${where(index)}: ${inst.name} is unpitched; pitch ignored`);
    if (!inst.unpitched && pitches.length === 0)
      throw new Error(`${where(index)}: ${inst.name} needs a pitch`);
    const technique = splitTechnique(e.technique);
    for (const t of technique) {
      if (!techniqueOf(t)) {
        warnings.push(
          `${where(index)}: technique "${t}" is not in src/instruments/techniques.ts; written as "${t}"`,
        );
      }
    }
    if (inst.range) {
      for (const p of pitches) {
        if (p.midi < inst.range[0] || p.midi > inst.range[1])
          warnings.push(`${where(index)}: ${inst.name} pitch ${p.midi} is outside its range`);
      }
    }
    if (inst.fixedPitch && pitches.some((p) => !Number.isInteger(p.midi - (part.tuning ?? 0))))
      quarterTones.push(index);
    const staff = e.staff ?? 1;
    if (staff < 1 || staff > inst.clefs.length)
      throw new Error(`${where(index)}: ${inst.name} has ${inst.clefs.length} staff/staves`);
    if (e.dynamic !== undefined) dynamics.push({ at, level: e.dynamic, to: "step" });
    notes.push({
      at,
      dur,
      end: at.add(dur),
      pitches: inst.unpitched ? [] : pitches,
      voice: e.voice ?? 1,
      staff,
      staffGiven: e.staff !== undefined,
      technique,
      articulations: e.articulations ?? [],
      slur: e.slur ?? false,
      gliss: e.gliss ?? false,
      glissAfter: min(Rational.of(e.glissAfter ?? 0), dur),
      ...(glissPitches ? { glissPitches } : {}),
      trill: e.trill,
      index,
    });
  });

  if (quarterTones.length)
    warnings.push(
      part.tuning
        ? `${where(quarterTones[0]!)}: ${part.name ?? inst.name} is tuned ${part.tuning} semitones and plays only pitches that far off the semitones (docs/antara/sound.md); ${quarterTones.length} event(s) do not`
        : `${where(quarterTones[0]!)}: ${inst.name} plays no quarter tones (docs/antara/sound.md); ${quarterTones.length} event(s) have one`,
    );
  notes.sort((a, b) => a.at.cmp(b.at) || a.voice - b.voice);
  (part.feathers ?? []).forEach((f, group) => {
    const start = Rational.of(f.at);
    const span = Rational.of(f.dur);
    const end = start.add(span);
    const inside = notes.filter(
      (n) =>
        n.voice === (f.voice ?? 1) && n.staff === (f.staff ?? 1) && n.at.gte(start) && n.at.lt(end),
    );
    if (inside.length < 2) {
      warnings.push(
        `part "${part.id}": a feathered beam at ${start.value} holds fewer than 2 notes`,
      );
      return;
    }
    const each = span.div(new Rational(inside.length));
    inside.forEach((n, i) => {
      n.play = { at: n.at, dur: n.dur, end: n.end };
      n.at = start.add(each.mul(new Rational(i)));
      n.dur = each;
      n.end = n.at.add(each);
      n.feather = { kind: f.kind, group, first: i === 0 };
    });
  });
  dynamics.sort((a, b) => a.at.cmp(b.at));
  // A later point at the same time replaces an earlier one.
  const merged: Dynamic[] = [];
  for (const d of dynamics) {
    if (merged.length && merged.at(-1)!.at.eq(d.at))
      merged[merged.length - 1] = { ...d, to: d.to === "linear" ? "linear" : merged.at(-1)!.to };
    else merged.push(d);
  }

  const name =
    part.name ??
    (inst.sectionSize && players < inst.sectionSize ? `${inst.name} (${players})` : inst.name);
  return {
    id: part.id,
    instrument: inst,
    name,
    abbreviation: part.abbreviation ?? inst.abbreviation,
    players,
    ...(part.player ? { player: part.player } : {}),
    notes,
    texts,
    dynamics: merged,
  };
}

export function normalize(score: Score): NormalScore {
  const warnings: string[] = [];
  const ids = new Set<string>();
  for (const p of score.parts) {
    if (ids.has(p.id)) throw new Error(`Duplicate part id "${p.id}"`);
    ids.add(p.id);
  }
  const parts = score.parts.map((p) => normalizePart(p, warnings));

  // Divisi: parts of one section sounding at the same time must fit in the section. Parts that
  // take turns (the tutti part, then the divided parts) share the same players.
  const bySection = new Map<string, { at: number; delta: number }[]>();
  for (const p of parts) {
    if (!p.instrument.sectionSize) continue;
    const changes = bySection.get(p.instrument.id) ?? [];
    // The part's sounding spans, merged so chords and voices count the players once.
    const spans = p.notes
      .map((n) => [n.at.value, n.end.value] as const)
      .sort((a, b) => a[0] - b[0]);
    let open: [number, number] | undefined;
    for (const [a, b] of spans) {
      if (open && a <= open[1]) open[1] = Math.max(open[1], b);
      else {
        if (open)
          changes.push({ at: open[0], delta: p.players }, { at: open[1], delta: -p.players });
        open = [a, b];
      }
    }
    if (open) changes.push({ at: open[0], delta: p.players }, { at: open[1], delta: -p.players });
    bySection.set(p.instrument.id, changes);
  }
  for (const [id, changes] of bySection) {
    const size = instrument(id).sectionSize!;
    // Ends before starts at the same moment: one part handing over to another.
    changes.sort((a, b) => a.at - b.at || a.delta - b.delta);
    let now = 0;
    let worst = { players: 0, at: 0 };
    for (const c of changes) {
      now += c.delta;
      if (now > worst.players) worst = { players: now, at: c.at };
    }
    if (worst.players > size) {
      const at = Rational.of(worst.at);
      const m =
        measures(score, at.add(new Rational(1)))
          .filter((x) => x.start.lte(at))
          .at(-1)?.number ?? 1;
      warnings.push(
        `${instrument(id).name}: ${worst.players} players at once (measure ${m}), the section has ${size}`,
      );
    }
  }

  // One player's parts (a flute and a piccolo) cannot sound at once. Percussionists play two
  // instruments at once often enough that theirs are not checked.
  const byPlayer = new Map<string, NormalPart[]>();
  for (const p of parts)
    if (p.player && p.instrument.family !== "percussion")
      byPlayer.set(p.player, [...(byPlayer.get(p.player) ?? []), p]);
  for (const [player, own] of byPlayer) {
    const spans = own
      .flatMap((p) => p.notes.map((n) => ({ p, at: n.at.value, end: n.end.value })))
      .sort((a, b) => a.at - b.at);
    let last: (typeof spans)[number] | undefined;
    for (const s of spans) {
      if (last && last.p !== s.p && s.at < last.end) {
        warnings.push(
          `player "${player}": parts "${last.p.id}" and "${s.p.id}" sound at once (quarter ${s.at.toFixed(2)})`,
        );
        break;
      }
      if (!last || s.end > last.end) last = s;
    }
  }

  let end = Rational.zero;
  for (const p of parts) {
    for (const n of p.notes) end = max(end, n.end);
    for (const t of p.texts) end = max(end, t.at);
    for (const d of p.dynamics) end = max(end, d.at);
  }
  return {
    title: score.title ?? "Untitled",
    parts,
    measures: measures(score, end),
    tempo: tempoMap(score),
    tempoMarks: (score.tempo ?? [])
      .map((t) => ({ ...t, at: Rational.of(t.at), beat: Rational.of(t.beat ?? 1) }))
      .sort((a, b) => a.at.value - b.at.value)
      .map((t, i, all) => {
        const next = all[i + 1];
        const qpm = (x: typeof t) => x.bpm * x.beat.value;
        const change =
          t.to === "linear" && next && qpm(next) !== qpm(t)
            ? qpm(next) > qpm(t)
              ? "accel."
              : "rit."
            : undefined;
        return { at: t.at, bpm: t.bpm, beat: t.beat, text: t.text, change };
      }),
    rehearsal: score.rehearsal ?? [],
    fermatas: (score.fermatas ?? []).map((f) => Rational.of(f.at)),
    accidentals: score.accidentals ?? "bar",
    pairs: score.pairs ?? true,
    end,
    warnings,
  };
}

/** Dynamic level at time t: holds after a "step" point, interpolates after a "linear" one. Default mf (5). */
export function levelAt(dynamics: Dynamic[], t: Rational): number {
  if (dynamics.length === 0) return 5;
  let i = -1;
  for (let k = 0; k < dynamics.length; k++) if (dynamics[k]!.at.lte(t)) i = k;
  if (i < 0) return dynamics[0]!.level;
  const d = dynamics[i]!;
  const next = dynamics[i + 1];
  if (d.to === "linear" && next) {
    const span = next.at.sub(d.at).value;
    const f = span > 0 ? t.sub(d.at).value / span : 1;
    return d.level + (next.level - d.level) * f;
  }
  return d.level;
}

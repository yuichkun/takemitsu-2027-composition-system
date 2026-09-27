// Edits of the kinds a composer makes, applied to a score in memory: for measuring how fast the
// preview follows a save (tools/bench.ts), and for trying it by hand (tools/stress-edit.ts).

import { normalize } from "../src/score/normalize.ts";
import type { DynamicPoint, NoteEvent, Part, Score, Time } from "../src/score/types.ts";

/** Where an edit goes: a measure of the score, and the 4 measures from it. */
export interface Spot {
  /** Measure number, as printed. */
  number: number;
  /** Start of the measure in quarters, and the length of the 4 measures from it. */
  start: number;
  span: number;
  /** The measure's own length (to insert one like it). */
  length: { n: number; d: number };
}

const q = (t: Time) => (Array.isArray(t) ? t[0] / t[1] : t);
const notesOf = (p: Part) => p.events.filter((e): e is NoteEvent => "dur" in e);
const busiest = (s: Score) =>
  [...s.parts].sort((a, b) => notesOf(b).length - notesOf(a).length)[0]!;

/** The spot at measure `number`, or at the middle measure of the score. */
export function spotOf(score: Score, number?: number): Spot {
  const measures = normalize(score).measures;
  const index =
    number === undefined
      ? Math.floor(measures.length / 2)
      : measures.findIndex((m) => m.number === number);
  const m = measures[index];
  if (!m) throw new Error(`The score has no measure ${number}`);
  return {
    number: m.number,
    start: m.start.value,
    span: measures.slice(index, index + 4).reduce((n, x) => n + x.length.value, 0),
    length: { n: m.length.n, d: m.length.d },
  };
}

export const edits = {
  /** The first note of the busiest part at the spot: `by` semitones up (unpitched: an accent). */
  note(s: Score, at: Spot, by = 1): void {
    const note = notesOf(busiest(s)).find((n) => q(n.at) >= at.start)!;
    const p = note.pitch;
    if (p && typeof p === "object" && "midi" in p) p.midi += by;
    else note.articulations = [by === 1 ? "accent" : "tenuto"];
  },

  /** The busiest part's dynamics over 4 measures: a hairpin from level `by` to level 8 − `by`. */
  dynamics(s: Score, at: Spot, by = 1): void {
    const part = busiest(s);
    const end = at.start + at.span;
    const dyn = (part.dynamics ?? []).filter((d) => q(d.at) < at.start || q(d.at) > end);
    dyn.push({ at: at.start, level: by, to: "linear" }, { at: end, level: 8 - by } as DynamicPoint);
    part.dynamics = dyn.sort((a, b) => q(a.at) - q(b.at));
  },

  /** Every note of every part in the 4 measures: `by` semitones up (unpitched: an accent). */
  tutti(s: Score, at: Spot, by = 1): void {
    for (const part of s.parts)
      for (const n of notesOf(part)) {
        if (q(n.at) < at.start || q(n.at) >= at.start + at.span) continue;
        const p = n.pitch;
        if (Array.isArray(p))
          n.pitch = p.map((x) =>
            typeof x === "object" && "midi" in x ? { midi: x.midi + by } : x,
          );
        else if (p && typeof p === "object" && "midi" in p) p.midi += by;
        else n.articulations = ["accent"];
      }
  },

  /** An empty measure like the spot's, inserted before it. */
  insert(s: Score, at: Spot): void {
    // Exact fractions: a float here would move every later note by a rounding error.
    const len = at.length;
    const shift = (t: Time): Time => {
      if (q(t) < at.start) return t;
      const [n, d] = Array.isArray(t) ? t : [t, 1];
      return [n * len.d + len.n * d, d * len.d];
    };
    for (const part of s.parts) {
      for (const e of part.events) e.at = shift(e.at);
      for (const d of part.dynamics ?? []) d.at = shift(d.at);
    }
    for (const t of s.tempo ?? []) t.at = shift(t.at);
    for (const m of s.meter) if (m.measure > at.number) m.measure++;
    for (const r of s.rehearsal ?? []) if (r.measure > at.number) r.measure++;
    if (s.measures) s.measures++;
  },

  /** The tempo from the spot on: × (1 + 0.1 × `by`). */
  tempo(s: Score, at: Spot, by = 1): void {
    const tempo = s.tempo ?? [];
    const before = [...tempo].filter((t) => q(t.at) <= at.start).at(-1);
    if (before && q(before.at) < at.start) tempo.push({ at: at.start, bpm: before.bpm });
    for (const t of tempo) if (q(t.at) >= at.start) t.bpm = Math.round(t.bpm * (1 + 0.1 * by));
    s.tempo = tempo.sort((a, b) => q(a.at) - q(b.at));
  },
};

export type EditKind = keyof typeof edits;

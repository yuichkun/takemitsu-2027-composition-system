// UI showcase: short notes scattered over a field painted register by register, bar by bar.
// Shows: heatmap, pitch-set, weights, number, seed.
// The music is only there to show the controls; nothing here is a proposal for the piece.

import { instrument } from "../../../src/instruments/catalog.ts";
import type { NoteEvent, Part, Score } from "../../../src/score/types.ts";
import {
  heatmap,
  number,
  pick,
  pitchSet,
  random,
  seed,
  weights,
  type Values,
} from "../../../src/sketch/knobs.ts";

/** One row per octave, highest first: C7–B7 down to C2–B2. */
const octaves = [7, 6, 5, 4, 3, 2];
const bars = 16;

const players = [
  { id: "hp", instrument: "harp", name: "Harp" },
  { id: "mar", instrument: "marimba", name: "Marimba" },
  { id: "vib", instrument: "vibraphone", name: "Vibraphone" },
  { id: "vn", instrument: "violins-1", name: "Vn pizz", technique: "pizz" },
  { id: "va", instrument: "violas", name: "Va pizz", technique: "pizz" },
  { id: "vc", instrument: "cellos", name: "Vc pizz", technique: "pizz" },
];

export const knobs = {
  field: heatmap({
    group: "Field",
    label: "Where and when",
    help: "How busy each octave is in each bar: dark is busy, light is silent",
    rows: octaves.map((o) => `C${o}`),
    columns: bars,
    value: (row, t) => 1 - Math.abs(row - (1 - t)) * 2.2,
  }),
  busiest: number({
    group: "Field",
    label: "Busiest",
    help: "How likely a note is on each 16th in a fully dark cell",
    value: 0.5,
    min: 0.05,
    max: 1,
    step: 0.05,
  }),
  pcs: pitchSet({
    group: "Pitch",
    label: "Pitch classes",
    help: "Every note is one of these pitch classes (0 = C)",
    value: [0, 2, 3, 7],
    divisions: 12,
  }),
  who: weights({
    group: "Colour",
    label: "Instruments",
    help: "How often each instrument takes a note (among those that can play it)",
    value: [0.7, 0.5, 0.5, 0.6, 0.4, 0.4],
    labels: players.map((p) => p.name),
  }),
  seed: seed({ group: "Chance", label: "Seed", help: "Which of the possible fields", value: 1 }),
};

export function score(v: Values<typeof knobs>): Score {
  const rand = random(v.seed);
  const pcs = [...new Set(v.pcs.map((p) => ((p % 12) + 12) % 12))];
  const events: NoteEvent[][] = players.map(() => []);
  const free = players.map(() => 0);
  for (let s = 0; s < bars * 16; s++) {
    const bar = Math.floor(s / 16);
    octaves.forEach((octave, row) => {
      if (pcs.length === 0 || rand() >= v.field[row]![bar]! * v.busiest) return;
      const midi = (octave + 1) * 12 + pcs[Math.floor(rand() * pcs.length)]!;
      const who = pick(
        players.map((p, i) => {
          const [lo, hi] = instrument(p.instrument).range ?? [0, 127];
          return midi >= lo && midi <= hi && free[i]! <= s ? v.who[i]! : 0;
        }),
        rand(),
      );
      if (who < 0) return;
      events[who]!.push({
        at: s / 4,
        dur: 0.25,
        pitch: { midi },
        staff: players[who]!.instrument === "harp" && midi < 60 ? 2 : undefined,
        technique: players[who]!.technique,
        articulations: ["staccato"],
      });
      free[who] = s + 1;
    });
  }
  const parts: Part[] = players.map((p, i) => ({
    id: p.id,
    instrument: p.instrument,
    events: events[i]!,
    dynamics: [{ at: 0, level: 4 }],
  }));
  return {
    title: "Showcase: field",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: 84 }],
    measures: bars,
    parts,
  };
}

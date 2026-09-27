// UI showcase: a one-bar pattern for four drums, repeated through three sections.
// Shows: steps, proportions, range, weights, number, toggle, seed.
// The music is only there to show the controls; nothing here is a proposal for the piece.

import type { NoteEvent, Part, Score } from "../../../src/score/types.ts";
import {
  number,
  proportions,
  random,
  range,
  seed,
  steps,
  toggle,
  weights,
  type Values,
} from "../../../src/sketch/knobs.ts";

const drums = [
  { id: "wb", instrument: "woodblock-high", name: "Woodblock" },
  { id: "sd", instrument: "snare-drum", name: "Snare" },
  { id: "td", instrument: "tenor-drum", name: "Tenor drum" },
  { id: "bd", instrument: "bass-drum", name: "Bass drum" },
];

export const knobs = {
  pattern: steps({
    group: "Pattern",
    label: "Pattern",
    help: "The bar every section starts from: one row per drum, one step per 16th",
    rows: drums.map((d) => d.name),
    value: ["x..x..x...x..x..", "....x.......x...", "..x.....x.x.....", "x.......x......."],
  }),
  tempo: number({
    group: "Pattern",
    label: "Tempo",
    help: "Speed of the 16ths",
    value: 112,
    min: 60,
    max: 200,
    step: 2,
    unit: "bpm",
  }),
  form: proportions({
    group: "Form",
    label: "Sections",
    help: "Bars of each section. A: the pattern as it is. B: each drum's row turns one step further every bar. C: notes drop out, as set below",
    value: [4, 4, 4],
    labels: ["A", "B", "C"],
    unit: "bars",
  }),
  rotate: toggle({
    group: "Form",
    label: "Turn in B",
    help: "On: in B, each row turns (the woodblock by one step a bar, the snare by two, …), so the drums drift apart",
    value: true,
  }),
  dropout: weights({
    group: "Form",
    label: "Drop-out in C",
    help: "In C, how likely each drum is to leave out a note",
    value: [0.2, 0.5, 0.5, 0.1],
    labels: drums.map((d) => d.name),
  }),
  loudness: range({
    group: "Dynamics",
    label: "From – to",
    help: "The dynamic at the start and at the end (1 = ppp … 8 = fff); it grows bar by bar",
    value: [3, 7],
    min: 1,
    max: 8,
    step: 0.5,
  }),
  seed: seed({
    group: "Dynamics",
    label: "Seed",
    help: "Which notes drop out in C",
    value: 1,
  }),
};

export function score(v: Values<typeof knobs>): Score {
  const rand = random(v.seed);
  const [a, b, c] = v.form as [number, number, number];
  const bars = a + b + c;
  const events: NoteEvent[][] = drums.map(() => []);
  for (let bar = 0; bar < bars; bar++) {
    const inB = bar >= a && bar < a + b;
    const inC = bar >= a + b;
    drums.forEach((_, d) => {
      const row = v.pattern[d]!;
      const turn = inB && v.rotate ? ((bar - a + 1) * (d + 1)) % 16 : 0;
      for (let s = 0; s < 16; s++) {
        if (!row[(s - turn + 16) % 16]) continue;
        if (inC && rand() < v.dropout[d]!) continue;
        events[d]!.push({
          at: bar * 4 + s / 4,
          dur: 0.25,
          articulations: s % 4 === 0 ? ["accent"] : undefined,
        });
      }
    });
  }
  const [from, to] = v.loudness;
  const parts: Part[] = drums.map((d, i) => ({
    id: d.id,
    instrument: d.instrument,
    events: events[i]!,
    dynamics: [
      { at: 0, level: from, to: "linear" },
      { at: bars * 4, level: to },
    ],
  }));
  return {
    title: "Showcase: grid",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: Math.max(1, bars),
    rehearsal: [
      { measure: 1, label: "A" },
      { measure: a + 1, label: "B" },
      { measure: a + b + 1, label: "C" },
    ].filter(
      (r, i, all) => r.measure <= bars && all.findIndex((x) => x.measure === r.measure) === i,
    ),
    parts,
  };
}

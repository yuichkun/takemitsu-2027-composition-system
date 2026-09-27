// Test: tempo that gradually speeds up and slows down, in several places. Can it be written
// (accel. / rit. and the new tempo) and played?
// The music is only there to test; nothing here is a proposal for the piece.

import type { NoteEvent, Part, Score } from "../../../src/score/types.ts";
import { choice, envelope, number, range, type Values } from "../../../src/sketch/knobs.ts";

export const knobs = {
  shape: envelope({
    group: "Tempo",
    label: "Tempo shape",
    help: "The tempo over the passage: each point is a tempo at a bar, and between points it changes gradually",
    value: [
      [0, 0],
      [0.125, 0],
      [0.33, 0.7],
      [0.45, 0.7],
      [0.58, 0.15],
      [0.83, 1],
      [1, 1],
    ],
    ends: ["slowest", "fastest"],
  }),
  span: range({
    group: "Tempo",
    label: "Slowest – fastest",
    help: "What the bottom and the top of the tempo shape mean",
    value: [60, 144],
    min: 30,
    max: 240,
    step: 2,
    unit: "bpm",
  }),
  bars: number({
    group: "Tempo",
    label: "Length",
    help: "How many bars",
    value: 24,
    min: 4,
    max: 96,
    step: 1,
    unit: "bars",
  }),
  pulse: choice({
    group: "Sound",
    label: "Pulse",
    help: "What keeps time, so the changes can be heard: 8ths or 16ths on the marimba",
    value: "8ths",
    options: ["8ths", "16ths"],
  }),
};

export function score(v: Values<typeof knobs>): Score {
  const [lo, hi] = v.span;
  const total = v.bars * 4;
  // A tempo mark at each point of the shape, on a beat; gradual towards the next when it differs.
  const points = [...v.shape]
    .sort((a, b) => a[0] - b[0])
    .map(([t, y]) => ({ at: Math.round(t * total), bpm: Math.round(lo + y * (hi - lo)) }))
    .filter((p, i, all) => i === 0 || p.at > all[i - 1]!.at);
  const tempo: Score["tempo"] = points
    .filter((p, i) => i === 0 || p.bpm !== points[i - 1]!.bpm || points[i + 1]?.bpm !== p.bpm)
    .map((p, i, all) => ({
      at: p.at,
      bpm: p.bpm,
      to: all[i + 1] && all[i + 1]!.bpm !== p.bpm ? ("linear" as const) : ("step" as const),
    }))
    .filter((p) => p.at < total);

  const step = v.pulse === "8ths" ? 0.5 : 0.25;
  const marimba: NoteEvent[] = [];
  for (let t = 0; t < total - 1e-9; t += step)
    marimba.push({
      at: t,
      dur: step,
      pitch: Math.round(t / step) % 2 ? "A4" : "E4",
      articulations: ["staccato"],
    });
  const pizz: NoteEvent[] = [];
  for (let t = 0; t < total; t += 1)
    pizz.push({ at: t, dur: 1, pitch: t % 4 === 0 ? "D3" : "A3", technique: "pizz" });
  const block: NoteEvent[] = [];
  for (let t = 0; t < total; t += 4) block.push({ at: t, dur: 1, articulations: ["accent"] });

  const parts: Part[] = [
    { id: "wb", instrument: "woodblock-high", events: block, dynamics: [{ at: 0, level: 5 }] },
    { id: "mar", instrument: "marimba", events: marimba, dynamics: [{ at: 0, level: 4 }] },
    { id: "vc", instrument: "cellos", events: pizz, dynamics: [{ at: 0, level: 5 }] },
  ];
  return {
    title: "Test: accelerando",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo,
    measures: v.bars,
    parts,
  };
}

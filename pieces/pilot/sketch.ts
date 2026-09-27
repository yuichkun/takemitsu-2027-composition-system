// Pilot: a piece of about two minutes for eight players, made of sketches (docs/architecture.md,
// "Pieces"). Everything grows from one motif. The four sections are centred on its own notes, so
// its intervals are also the key scheme, and each section does something else to it:
//
//   Exposition   the clarinet states it and spins it out; the viola answers it upside down
//   Development  its head passed around the ensemble, closer and faster (stretto, diminution)
//   Climax       running figures of its notes over itself in long notes (a cantus), to a tutti
//   Return       after a breath held by one note, backwards on the flute; the clarinet dissolves it

import {
  choice,
  envelope,
  motif,
  number,
  proportions,
  type Values,
} from "../../src/sketch/knobs.ts";
import { Motif } from "../../src/sketch/motif.ts";
import { endOf, formCurve, type Context, type Placed } from "../../src/sketch/nest.ts";
import type { Score } from "../../src/score/types.ts";
import { ensemble } from "./ensemble.ts";

const sections = ["Exposition", "Development", "Climax", "Return"];

export const knobs = {
  motif: motif({
    group: "Material",
    label: "Motif",
    help: "The seed of the whole piece. Every line, chord and figure is made from it, and the sections are centred on its notes",
    value: "D4:0.5 Eb4:0.5 Ab4:1.5 G4:1.5",
    range: ["G3", "G5"],
    length: 8,
  }),
  centres: choice({
    group: "Material",
    label: "Centres",
    help: "from the motif: each section centred on the motif's next note (its intervals become the key scheme) · one: every section where the motif is written",
    value: "from the motif",
    options: ["from the motif", "one"],
  }),
  sections: proportions({
    group: "Form",
    label: "Sections",
    help: "Bars in each section (the total stays)",
    value: [8, 8, 9, 7],
    labels: sections,
    unit: "bars",
  }),
  overlap: number({
    group: "Form",
    label: "Overlap",
    help: "Beats the development begins before the exposition ends: it grows out of it",
    value: 4,
    min: 0,
    max: 12,
    step: 1,
    unit: "beats",
  }),
  elision: number({
    group: "Form",
    label: "Elision",
    help: "Beats the climax begins before the development ends. Players busy in both then clash (the map says who)",
    value: 0,
    min: 0,
    max: 8,
    step: 1,
    unit: "beats",
  }),
  breath: number({
    group: "Form",
    label: "Breath",
    help: "Beats of silence after the climax, one note held across it (the pivot)",
    value: 2,
    min: 0,
    max: 4,
    step: 1,
    unit: "beats",
  }),
  tempo: number({
    group: "Time",
    label: "Tempo",
    help: "Quarter notes per minute at the start",
    value: 60,
    min: 40,
    max: 96,
    step: 2,
    unit: "bpm",
  }),
  push: number({
    group: "Time",
    label: "Push",
    help: "The development speeds up to this; the climax keeps it",
    value: 72,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
  settle: number({
    group: "Time",
    label: "Settle",
    help: "Tempo of the return; its last bars slow down further",
    value: 54,
    min: 36,
    max: 96,
    step: 2,
    unit: "bpm",
  }),
  intensity: envelope({
    group: "Flow",
    label: "Intensity",
    help: "How loud and how busy, over the sections (each drawn the same width, whatever its length). Blocks follow it where they say so",
    value: [
      [0, 0.18],
      [0.2, 0.32],
      [0.25, 0.3],
      [0.5, 0.62],
      [0.72, 1],
      [0.75, 0.08],
      [0.9, 0.12],
      [1, 0],
    ],
    ends: ["ppp", "ff"],
    guides: sections,
  }),
  height: envelope({
    group: "Flow",
    label: "Height",
    help: "How high the lines and figures sit, over the sections. Blocks follow it where they say so",
    value: [
      [0, 0.4],
      [0.25, 0.45],
      [0.5, 0.7],
      [0.72, 0.95],
      [0.75, 0.75],
      [1, 0.6],
    ],
    ends: ["low", "high"],
    guides: sections,
  }),
};

export function score(v: Values<typeof knobs>, ctx: Context): Score {
  const m = Motif.of(v.motif);
  const bars = v.sections;
  const q = bars.map((b) => b * 4);
  const expoEnd = q[0]!;
  const devEnd = expoEnd + q[1]!;
  const climaxEnd = devEnd + q[2]!;
  const returnStart = climaxEnd + v.breath;
  const total = returnStart + q[3]!;
  const centres = v.centres === "one" ? [0, 0, 0, 0] : [0, 1, 2, 3].map((i) => m.path[i % m.size]!);
  const bounds = [0, expoEnd, devEnd, climaxEnd, total];
  const piece = ctx.with({
    ensemble,
    material: { motif: m },
    flows: { intensity: formCurve(v.intensity, bounds), height: formCurve(v.height, bounds) },
    length: total,
  });

  const placed: Placed[] = [];
  const expo = piece.child("exposition", { at: 0, length: expoEnd, centre: centres[0] });
  placed.push(expo);
  const devAt = Math.max(0, expoEnd - v.overlap);
  const dev = piece.child("development", {
    at: devAt,
    length: devEnd - devAt,
    centre: centres[1],
    prev: expo.fragment.end,
    params: { overlap: expoEnd - devAt },
  });
  placed.push(dev);
  const climaxAt = Math.max(devAt, devEnd - v.elision);
  const climax = piece.child("climax", {
    at: climaxAt,
    length: climaxEnd - climaxAt,
    centre: centres[2],
    prev: endOf([expo, dev]),
  });
  placed.push(climax);
  // One note across the breath: from where the climax lets go to where the return begins.
  const release = climax.fragment.marks.find((k) => k.label === "release");
  const pivotAt = release ? climax.at + release.at : climaxEnd;
  if (returnStart - pivotAt > 0)
    placed.push(
      piece.child("pivot", {
        at: pivotAt,
        length: returnStart - pivotAt,
        centre: centres[3],
        prev: climax.fragment.end,
      }),
    );
  placed.push(
    piece.child("return", {
      at: returnStart,
      length: total - returnStart,
      centre: centres[3],
      prev: endOf(placed),
    }),
  );

  // Four-four throughout, but for the breath: a bar of its own.
  const climaxBars = bars[0]! + bars[1]! + bars[2]!;
  const meter: Score["meter"] = [{ measure: 1, beats: 4, beatType: 4 }];
  if (v.breath > 0)
    meter.push(
      { measure: climaxBars + 1, beats: v.breath, beatType: 4 },
      { measure: climaxBars + 2, beats: 4, beatType: 4 },
    );
  const returnBar = climaxBars + (v.breath > 0 ? 2 : 1);
  const rehearsal = [
    { measure: 1, label: "A" },
    { measure: bars[0]! + 1, label: "B" },
    { measure: bars[0]! + bars[1]! + 1, label: "C" },
    { measure: returnBar, label: "D" },
  ].filter((r, i, all) => i === 0 || r.measure > all[i - 1]!.measure);
  const lastBar = Math.max(returnStart, total - 8);
  const tempo: NonNullable<Score["tempo"]> = [
    { at: 0, bpm: v.tempo },
    { at: expoEnd, bpm: v.tempo, to: "linear" },
    { at: devEnd, bpm: v.push },
    { at: returnStart, bpm: v.settle },
    { at: lastBar, bpm: v.settle, to: "linear" },
    { at: Math.max(lastBar, total - 4), bpm: Math.round(v.settle * 0.8) },
  ];
  return piece.score(piece.merge(placed), {
    title: "Pilot",
    length: total,
    meter,
    tempo: tempo.filter(
      (t, i) =>
        i === 0 || (t.at as number) > (tempo[i - 1]!.at as number) || t.bpm !== tempo[i - 1]!.bpm,
    ),
    rehearsal,
    measures: climaxBars + (v.breath > 0 ? 1 : 0) + bars[3]!,
  });
}

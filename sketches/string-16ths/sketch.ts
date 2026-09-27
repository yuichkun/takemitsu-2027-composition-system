// Sketch: strings only, fast 16ths with a bow change on every note, short and biting.
// The four sections hand the figure to each other with a little overlap, pile up like the
// stretto of a fugue, and run up together to the end. Card: README.md.
//
// The knobs are the decisions this idea is made of: how it sounds (speed, bow stroke), what
// pitches it uses (one scale feeds the figures and the run; a lift per stage builds tension),
// how it is paced (how long each stage lasts, how much the hand-offs overlap), and how it grows
// (dynamics). Every value is a stand-in chosen by Claude until 余湖さん changes it.

import type { Articulation, NoteEvent, Part, Score } from "../../src/score/types.ts";
import { choice, number, numbersOf, text, type Values } from "../../src/sketch/knobs.ts";

const marks = ["pp", "p", "mp", "mf", "f", "ff", "fff"];
const levelOf = (mark: string) => marks.indexOf(mark) + 2; // pp = 2 … fff = 8

export const knobs = {
  tempo: number({
    group: "Sound",
    label: "Tempo",
    help: "Speed of the 16ths",
    value: 144,
    min: 80,
    max: 200,
    step: 2,
    unit: "bpm",
  }),
  articulation: choice({
    group: "Sound",
    label: "Stroke",
    help: "staccato: dots, played on the string (BBC SO Short Staccato). spiccato: dots with spicc., bouncing off the string (Short Spiccato)",
    value: "staccato",
    options: ["staccato", "spiccato"],
  }),
  scale: text({
    group: "Pitch",
    label: "Scale",
    help: "The pitch set everything is drawn from, in semitones within an octave: the two figures step through it and the final run climbs it",
    value: "0 1 3 4 6 7 9 10",
  }),
  transpose: number({
    group: "Pitch",
    label: "Transpose",
    help: "Moves the whole passage. At 0 the sections stand on D3 (Vc), A3 (Va), D4 (Vn II), A4 (Vn I)",
    value: 0,
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  rise: number({
    group: "Pitch",
    label: "Lift per stage",
    help: "How far the three-voice stage (B) sits above the hand-off (A), and the tutti (C) above B",
    value: 3,
    min: 0,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  barsA: number({
    group: "Form",
    label: "Hand-off",
    help: "Bars of stage A: one section at a time, each entering a bar after the last",
    value: 8,
    min: 0,
    max: 32,
    step: 1,
    unit: "bars",
  }),
  overlap: number({
    group: "Form",
    label: "Overlap",
    help: "In the hand-off, how long each section keeps playing after the next one enters",
    value: 8,
    min: 0,
    max: 16,
    step: 1,
    unit: "16ths",
  }),
  barsB: number({
    group: "Form",
    label: "Three voices",
    help: "Bars of stage B: entries every half bar, so three sections play at once",
    value: 6,
    min: 0,
    max: 32,
    step: 1,
    unit: "bars",
  }),
  barsC: number({
    group: "Form",
    label: "All four",
    help: "Bars of stage C: the four sections enter an eighth apart and keep going, like a stretto",
    value: 4,
    min: 0,
    max: 32,
    step: 1,
    unit: "bars",
  }),
  from: choice({
    group: "Dynamics",
    label: "Start",
    help: "Dynamic at the first note; it grows in one line to the last note",
    value: "p",
    options: marks,
  }),
  to: choice({
    group: "Dynamics",
    label: "Peak",
    help: "Dynamic at the top of the run",
    value: "fff",
    options: marks,
  }),
};

const bar = 16; // sixteenths in a 4/4 bar
const bases = { vc: 50, va: 57, vn2: 62, vn1: 69 }; // D3, A3, D4, A4

export function score(v: Values<typeof knobs>): Score {
  const scale = numbersOf("Scale", v.scale);
  const degree = (k: number) =>
    scale[((k % scale.length) + scale.length) % scale.length]! + 12 * Math.floor(k / scale.length);
  // The figures, one bar each, as semitones above the section's base.
  // wedge: the base on every other note, the scale climbing between (a string crossing).
  // hammer: repeated notes with the scale's next steps as neighbours.
  const [d1, d2, d3] = [degree(1), degree(2), degree(3)];
  const figures = {
    wedge: Array.from({ length: 16 }, (_, i) => (i % 2 ? degree((i + 1) / 2) : 0)),
    hammer: [0, 0, d1, 0, 0, 0, d1, 0, d2, d2, d1, 0, d3, d2, d1, 0],
  };

  const sections = [
    { id: "vc", instrument: "cellos", base: bases.vc + v.transpose },
    { id: "va", instrument: "violas", base: bases.va + v.transpose },
    { id: "vn2", instrument: "violins-2", base: bases.vn2 + v.transpose },
    { id: "vn1", instrument: "violins-1", base: bases.vn1 + v.transpose },
  ];

  // When each section plays: A hands the figure round, B keeps three going, C has all four.
  const [a, b, c] = [v.barsA, v.barsB, v.barsC].map((n) => Math.round(n) * bar) as [
    number,
    number,
    number,
  ];
  const runAt = a + b + c;
  interface Entry {
    voice: number;
    at: number;
    length: number;
    figure: keyof typeof figures;
    lift: number;
  }
  const entries: Entry[] = [];
  for (let i = 0; i * bar < a; i++)
    entries.push({
      voice: i % 4,
      at: i * bar,
      length: bar + v.overlap,
      figure: i < 4 ? "wedge" : "hammer",
      lift: 0,
    });
  for (let j = 0; j * 8 < b; j++)
    entries.push({
      voice: j % 4,
      at: a + j * 8,
      length: 24,
      figure: j % 2 ? "hammer" : "wedge",
      lift: v.rise,
    });
  if (c > 0)
    for (let s = 0; s < 4; s++)
      entries.push({
        voice: s,
        at: a + b + 2 * s,
        length: c - 2 * s,
        figure: "wedge",
        lift: 2 * v.rise,
      });

  const technique = v.articulation === "spiccato" ? "spiccato" : undefined;
  const end = runAt / 4 + 4; // quarters: the bar after the run
  const dynamics = [
    { at: 0, level: levelOf(v.from), to: "linear" as const },
    { at: end, level: levelOf(v.to) },
  ];

  const part = (s: number): Part => {
    const section = sections[s]!;
    const mine = entries.filter((e) => e.voice === s).sort((x, y) => x.at - y.at);
    const events: NoteEvent[] = [];
    const note = (at: number, midi: number, articulations: Articulation[]): void => {
      events.push({ at: at / 4, dur: 0.25, pitch: { midi }, articulations, technique });
    };
    mine.forEach((e, k) => {
      // A later entry of the same section cuts the one before it.
      const stop = Math.min(e.at + e.length, mine[k + 1]?.at ?? Infinity, runAt);
      const figure = figures[e.figure];
      for (let t = e.at; t < stop; t++)
        note(
          t,
          section.base + e.lift + figure[(t - e.at) % figure.length]!,
          t === e.at ? ["staccato", "accent"] : ["staccato"],
        );
    });
    // The run: every section climbs the scale from its base, a bar of 16ths.
    for (let t = 0; t < bar; t++)
      note(
        runAt + t,
        section.base + degree(t),
        t % 4 === 0 ? ["staccato", "accent"] : ["staccato"],
      );
    // The top, short and accented.
    events.push({
      at: end,
      dur: 0.5,
      pitch: { midi: section.base + degree(bar) },
      articulations: ["staccato", "accent"],
    });
    return { id: section.id, instrument: section.instrument, dynamics, events };
  };

  const rehearsal = [
    { measure: 1, label: "A" },
    { measure: a / bar + 1, label: "B" },
    { measure: (a + b) / bar + 1, label: "C" },
    { measure: runAt / bar + 1, label: "D" },
  ].filter((r, i, all) => all.findIndex((x) => x.measure === r.measure) === i);

  return {
    title: `Strings in 16ths (${v.articulation})`,
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: runAt / bar + 2,
    rehearsal,
    parts: [3, 2, 1, 0].map(part), // score order: vn1, vn2, va, vc
  };
}

// antara palette, B: the complexity crosses the orchestra.
//
// Uses the A sketch "a between handed over where the lines meet" (../../a/time-handed-at-meetings):
// its handing rule is copied here unchanged and run along a chain of three lines instead of one
// pair. The near line (pizzicato basses, family 2) starts with the whole giving set; the middle
// line (tenor trombones, family 3) and the far line (violins I, family 2 again) start as pulses.
// Each line adds its time betweens from its own set, in order and round again; all three start
// together. Two neighbours in the chain meet where both have an onset on the same tick (always a
// beat, since neighbours count in different families). At every meeting after the start, while
// the nearer of the two holds more than one between, it hands the between it was about to take to
// the farther one, which plays it at once. The near and far lines never meet each other (they are
// not neighbours), so nothing passes between them directly: whatever reaches the far line has
// passed through the middle line, which takes on one side and gives on the other. When the middle
// line meets both neighbours at once, it gives first and then takes, so what it takes is what it
// plays there (as the A says of a taking line).
//
// A between keeps its number of atoms all the way: in the middle line it lasts 4/3 as long, and on
// the far side, counted in family 2 again, it has its first length back.
//
// Pitch reads the same count: a line's pitch moves by one quarter tone for every atom that leaves
// or enters its set. At a hand-over of x atoms the giving line sinks x quarter tones and the taking
// line rises x quarter tones. The chain runs upwards (basses, trombones, violins, 13.5 semitones
// apart), so the lines never cross, and the sum of the three pitches never changes. Pitch moves
// only at hand-overs, and every hand-over moves two lines.
//
// Once every line but the far one holds one between, nothing more can cross. The passage ends at
// the first meeting of the middle and far lines at least After beats after the last hand-over:
// those two sound one last note (a beat) together; every other note stops there. Every note lasts
// until its line's next onset. Levels stay at p; a note on a meeting of its line is mp.
// Card: README.md.

import type { DynamicPoint, NoteEvent, Part } from "../../../../../src/score/types.ts";
import { betweenSet, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, type Family } from "../../../between.ts";
import { scoreOf, TICKS, time } from "../../common.ts";

export const knobs = {
  nearSet: betweenSet({
    group: "Sets",
    label: "Near (basses)",
    help: "The time betweens the near line starts with, in atoms of family 2 (16ths), read smallest first and round again. At each of its meetings with the middle line it hands the one it was about to take",
    value: "1 2 3 5 6 7",
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  middleSet: betweenSet({
    group: "Sets",
    label: "Middle (trombones)",
    help: "The time betweens the middle line starts with, in atoms of family 3 (triplet 8ths). It takes from the near line and hands on to the far line",
    value: "4",
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  farSet: betweenSet({
    group: "Sets",
    label: "Far (violins I)",
    help: "The time betweens the far line starts with, in atoms of family 2 (16ths). A between handed over enters where it is reading, and is played at once",
    value: "3",
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  bottom: pitch({
    group: "Pitch",
    label: "Basses start on",
    help: "The basses' first pitch (the usual grid). The trombones start 13.5 semitones higher, the violins 27 higher. From there each hand-over lowers the giving line and raises the taking line by the count handed, in quarter tones",
    value: "E3",
    min: "Eb2",
    max: "F3",
    step: 1,
  }),
  after: number({
    group: "Form",
    label: "After",
    help: "Once only the far line holds more than one between, the passage ends at the first meeting of the middle and far lines at least this many beats after the last hand-over",
    value: 8,
    min: 1,
    max: 32,
    step: 1,
    unit: "beats",
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 66,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

/** Semitones from one line's first pitch up to the next line's: odd in quarter tones. */
const APART = 13.5;
const BAR = 4 * TICKS;
/** How long the passage may run before it gives up (the lines meet too rarely for these sets). */
const LONGEST = 480 * TICKS;

interface Line {
  atom: number;
  /** The set in the order it is read; the pointer walks it and wraps. */
  set: number[];
  pointer: number;
  /** The tick of the line's next onset. */
  next: number;
  /** The line's pitch now: it moves only at hand-overs. */
  midi: number;
  range: [number, number];
  name: string;
  onsets: { at: number; midi: number; meeting: boolean }[];
}

const lineOf = (
  family: Family,
  set: number[],
  midi: number,
  range: [number, number],
  name: string,
): Line => ({
  atom: atomOf(family),
  set: [...set],
  pointer: 0,
  next: 0,
  midi,
  range,
  name,
  onsets: [],
});

export function score(v: Values<typeof knobs>) {
  const near = lineOf(2, v.nearSet, v.bottom, [28, 67], "basses");
  const middle = lineOf(3, v.middleSet, v.bottom + APART, [40, 72], "trombones");
  const far = lineOf(2, v.farSet, v.bottom + 2 * APART, [55, 103], "violins I");
  const chain = [near, middle, far];
  const after = v.after * TICKS;
  let handed = 0;
  let end = -1;

  // All three lines in time order. Links are neighbours in the chain; the far link goes first, so
  // a middle line meeting both sides gives before it takes.
  while (end < 0) {
    const t = Math.min(...chain.map((l) => l.next));
    if (t > LONGEST)
      throw new Error(
        `The passage would run past ${LONGEST / TICKS} beats (the lines meet too rarely); try other sets`,
      );
    const meets = [0, 1].map((i) => chain[i]!.next === t && chain[i + 1]!.next === t);
    const crossed = chain.slice(0, -1).every((l) => l.set.length === 1);
    if (crossed && meets[1] && t - handed >= after) end = t;

    if (end < 0 && t > 0)
      for (const i of [1, 0]) {
        const giver = chain[i]!;
        const taker = chain[i + 1]!;
        if (!meets[i] || giver.set.length === 1) continue;
        // The between the giving line was about to take goes to the taking line, which takes it now.
        const k = giver.pointer % giver.set.length;
        const [x] = giver.set.splice(k, 1);
        giver.pointer = k % giver.set.length;
        const j = taker.pointer % taker.set.length;
        taker.set.splice(j, 0, x!);
        taker.pointer = j;
        // The same count in quarter tones: the giver sinks, the taker rises.
        giver.midi -= x! / 2;
        taker.midi += x! / 2;
        for (const l of [giver, taker])
          if (l.midi < l.range[0] || l.midi > l.range[1])
            throw new Error(
              `The ${l.name} would reach MIDI ${l.midi}, outside ${l.range[0]}–${l.range[1]}; try another starting pitch or other sets`,
            );
        handed = t;
      }

    chain.forEach((line, i) => {
      if (line.next !== t) return;
      const meeting = (i > 0 && meets[i - 1]!) || (i < chain.length - 1 && meets[i]!);
      line.onsets.push({ at: t, midi: line.midi, meeting });
      if (end >= 0) return;
      const between = line.set[line.pointer % line.set.length]!;
      line.pointer = (line.pointer + 1) % line.set.length;
      line.next = t + between * line.atom;
    });
  }

  const stop = end + TICKS;
  const partOf = (
    line: Line,
    head: Omit<Part, "events" | "dynamics">,
    technique?: string,
  ): Part => {
    // Each note lasts to the line's next onset; a note on the final meeting, a beat; any other
    // note still sounding at the end stops there.
    const events: NoteEvent[] = line.onsets.map((o, i) => ({
      at: time(o.at),
      dur: time((line.onsets[i + 1]?.at ?? (o.at === end ? stop : end)) - o.at),
      pitch: { midi: o.midi },
      ...(technique ? { technique } : {}),
    }));
    // p throughout; a note on a meeting of its line is mp.
    const dynamics: DynamicPoint[] = [];
    for (const o of line.onsets) {
      const level = o.meeting ? 4 : 3;
      if (dynamics.at(-1)?.level !== level) dynamics.push({ at: time(o.at), level });
    }
    return { ...head, dynamics, events };
  };

  const parts = [
    partOf(middle, {
      id: "tbn",
      instrument: "trombone",
      name: "Tenor Trombones",
      abbreviation: "Tbn.",
      players: 2,
    }),
    partOf(far, { id: "vn1", instrument: "violins-1", name: "Violins I", abbreviation: "Vn. I" }),
    partOf(
      near,
      { id: "cb", instrument: "basses", name: "Contrabasses", abbreviation: "Cb." },
      "pizz",
    ),
  ];
  return scoreOf(
    "antara · palette B · the complexity crosses the orchestra",
    Math.ceil(stop / BAR),
    v.tempo,
    parts,
  );
}

// antara palette, B: the complexity crosses the orchestra.
//
// Uses the A sketch "a between handed over where the lines meet" (../../a/time-handed-at-meetings):
// its handing rule is copied here and run twice at once, unchanged; only the ending (below) is this
// B's own. Each pair is two lines on one pitch each: a giving line counting in family 2 and a
// taking line counting in family 3 (13.5 semitones lower, on the other grid). Both lines of a pair start together and add their time betweens from their own sets,
// in order and round again. Where the two lines of a pair have an onset on the same tick (a
// meeting, always on a beat), the giving line hands the between it was about to take to the taking
// line, which plays it at once, 4/3 as long; the giving set shrinks to one between (a pulse), the
// taking set grows from one. A pair's meetings are its own: the other pair's lines never count.
//
// The two pairs hold the same numbers. The upper pair (violins I giving, tenor trombones taking)
// reads the giving set smallest first, as the A does; the lower pair (oboes and clarinets giving,
// pizzicato basses taking) reads it largest first, so the two pairs meet at other times. The upper
// pair starts Enters beats after the lower one: with all four lines starting together, the two
// pairs would hand over at the same moment twice (beats 12 and 38).
//
// Once both giving lines are pulses, the passage ends at the first bar line at least After beats
// after the later of the two last hand-overs where all four lines have an onset together. There
// the four lines hold their own pitches for one bar, and stop. Every other note lasts until its
// line's next onset. Levels stay at p; a note on its own pair's meeting is mp.
// Card: README.md.

import type { DynamicPoint, NoteEvent, Part } from "../../../../../src/score/types.ts";
import { betweenSet, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf } from "../../../between.ts";
import { scoreOf, TICKS, time } from "../../common.ts";

export const knobs = {
  giveSet: betweenSet({
    group: "Both pairs",
    label: "Giving set",
    help: "The time betweens both giving lines start with, in atoms of family 2 (16ths). The upper pair reads them smallest first, the lower pair largest first, round again. At each of its meetings a giving line hands the one it was about to take to its taking line",
    value: "1 2 3 5 6 7",
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  takeSet: betweenSet({
    group: "Both pairs",
    label: "Taking set",
    help: "The time betweens both taking lines start with, in atoms of family 3 (triplet 8ths). A between handed over enters where the taking line is reading, and is played at once",
    value: "4",
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  upper: pitch({
    group: "Upper pair (violins I → trombones)",
    label: "Pitch",
    help: "The pitch of the giving line (violins I, the usual grid). The trombones sound 13.5 semitones lower, on the other grid. The range is what both instruments allow",
    value: "G5",
    min: "G3",
    max: "C#6",
    step: 1,
  }),
  enters: number({
    group: "Upper pair (violins I → trombones)",
    label: "Enters",
    help: "Beats after the lower pair's start at which the upper pair starts (on a beat, where both families' grids meet). It moves the upper pair's meetings against the lower pair's",
    value: 6,
    min: 0,
    max: 16,
    step: 1,
    unit: "beats",
  }),
  lower: pitch({
    group: "Lower pair (oboes + clarinets → basses)",
    label: "Pitch",
    help: "The pitch of the giving line (oboes and clarinets together, the usual grid). The pizzicato basses sound 13.5 semitones lower, on the other grid. The range is what the three instruments allow, and the basses' samples",
    value: "Bb3",
    min: "Bb3",
    max: "G4",
    step: 1,
  }),
  after: number({
    group: "Form",
    label: "After",
    help: "Once both giving lines are pulses, the passage ends at the first bar line at least this many beats after the later last hand-over where all four lines sound together",
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

/** Semitones from a giving line's pitch down to its taking line's: odd in quarter tones. */
const APART = 13.5;
const BAR = 4 * TICKS;
/** How long the passage may run before it gives up (the four lines never meet on a bar line). */
const LONGEST = 480 * TICKS;

interface Line {
  atom: number;
  /** The set in the order it is read; the pointer walks it and wraps. */
  set: number[];
  pointer: number;
  /** The tick of the line's next onset. */
  next: number;
  onsets: { at: number; meeting: boolean }[];
}

interface Pair {
  giver: Line;
  taker: Line;
  start: number;
  /** Ticks of the hand-overs. */
  handed: number[];
}

const lineOf = (family: 2 | 3, set: number[], start: number): Line => ({
  atom: atomOf(family),
  set: [...set],
  pointer: 0,
  next: start,
  onsets: [],
});

const pairOf = (give: number[], take: number[], start: number): Pair => ({
  giver: lineOf(2, give, start),
  taker: lineOf(3, take, start),
  start,
  handed: [],
});

export function score(v: Values<typeof knobs>) {
  const smallestFirst = [...v.giveSet].sort((a, b) => a - b);
  const lower = pairOf([...smallestFirst].reverse(), v.takeSet, 0);
  const upper = pairOf(smallestFirst, v.takeSet, v.enters * TICKS);
  const pairs = [lower, upper];
  const lines = pairs.flatMap((p) => [p.giver, p.taker]);
  const after = v.after * TICKS;
  let end = -1;

  // All four lines in time order; each pair meets only where its own two lines have an onset.
  while (end < 0) {
    const t = Math.min(...lines.map((l) => l.next));
    if (t > LONGEST)
      throw new Error(
        `The passage would run past ${LONGEST / TICKS} beats (the four lines never sound together on a bar line); try other sets or another entry`,
      );
    const pulses = pairs.every((p) => p.giver.set.length === 1);
    const lastHand = Math.max(...pairs.map((p) => p.handed.at(-1) ?? p.start));
    const together = lines.every((l) => l.next === t);
    if (pulses && together && t % BAR === 0 && t - lastHand >= after) end = t;

    for (const p of pairs) {
      const meeting = p.giver.next === t && p.taker.next === t;
      if (end < 0 && meeting && t > p.start && p.giver.set.length > 1) {
        // The between the giving line was about to take goes to the taking line, which takes it now.
        const k = p.giver.pointer % p.giver.set.length;
        const [x] = p.giver.set.splice(k, 1);
        p.giver.pointer = k % p.giver.set.length;
        const j = p.taker.pointer % p.taker.set.length;
        p.taker.set.splice(j, 0, x!);
        p.taker.pointer = j;
        p.handed.push(t);
      }
      for (const line of [p.giver, p.taker]) {
        if (line.next !== t) continue;
        line.onsets.push({ at: t, meeting });
        if (end >= 0) continue;
        const between = line.set[line.pointer % line.set.length]!;
        line.pointer = (line.pointer + 1) % line.set.length;
        line.next = t + between * line.atom;
      }
    }
  }

  const stop = end + BAR;
  const partOf = (
    line: Line,
    midi: number,
    head: Omit<Part, "events" | "dynamics">,
    technique?: string,
  ): Part => {
    // Each note lasts to the line's next onset; the last one, where all four sound together, a bar.
    const events: NoteEvent[] = line.onsets.map((o, i) => ({
      at: time(o.at),
      dur: time((line.onsets[i + 1]?.at ?? stop) - o.at),
      pitch: { midi },
      ...(technique ? { technique } : {}),
    }));
    // p throughout; a note on its own pair's meeting is mp.
    const dynamics: DynamicPoint[] = [];
    for (const o of line.onsets) {
      const level = o.meeting ? 4 : 3;
      if (dynamics.at(-1)?.level !== level) dynamics.push({ at: time(o.at), level });
    }
    return { ...head, dynamics, events };
  };

  const parts = [
    partOf(lower.giver, v.lower, {
      id: "ob",
      instrument: "oboe",
      name: "Oboes",
      abbreviation: "Ob.",
      players: 2,
    }),
    partOf(lower.giver, v.lower, {
      id: "cl",
      instrument: "clarinet",
      name: "Clarinets",
      abbreviation: "Cl.",
      players: 2,
    }),
    partOf(upper.taker, v.upper - APART, {
      id: "tbn",
      instrument: "trombone",
      name: "Tenor Trombones",
      abbreviation: "Tbn.",
      players: 2,
    }),
    partOf(upper.giver, v.upper, {
      id: "vn1",
      instrument: "violins-1",
      name: "Violins I",
      abbreviation: "Vn. I",
    }),
    partOf(
      lower.taker,
      v.lower - APART,
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

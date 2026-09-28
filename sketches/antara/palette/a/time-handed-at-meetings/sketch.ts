// antara palette, A (time): a between handed over where the lines meet.
//
// Two lines, each on one pitch and one family for the whole sketch, start together and add their
// time betweens from their own sets, in order and round again. The giving line counts in one
// family, the taking line in another. The lines meet where both have an onset on the same tick
// (the time between the two lines is 0 there). With two different families that can only be
// where the two grids coincide, a beat; which beats is left to the sums, nothing is scheduled.
//
// At every meeting after the start, while the giving line holds more than one between, it hands
// the between it was about to take to the taking line: the between leaves the giving set (the
// giving line goes on with the one that followed it) and enters the taking set at the place the
// taking line was about to read, so it is played there at once. The number of atoms stays; the
// family it is counted in changes, so the same between now lasts another length. Nothing else in
// either set changes order. The giving set shrinks to one between (a pulse: its rule can no longer
// be heard), the taking set grows from one. The story of the sets is written by the relation of
// the lines.
//
// When the giving line holds one between, nothing is handed any more; the sketch ends at the first
// meeting at least After beats after the last hand-over, where both lines sound one last note
// together. Every note lasts until its line's next onset. The giving line on the marimba (the
// usual grid), the taking line on the pizzicato cellos 13.5 semitones lower (the other grid, so a
// meeting is never one pitch). Levels stay at p; the notes on a meeting are mp, the only moment
// anything changes.
// Card: README.md.

import type { DynamicPoint, NoteEvent, Part } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { scoreOf, TICKS, time } from "../../common.ts";

export const knobs = {
  giveSet: betweenSet({
    group: "Giving line (marimba)",
    label: "Set",
    help: "The time betweens the giving line starts with, in atoms of its family, read smallest first and round again. At each meeting it hands the one it was about to take to the taking line",
    value: "1 2 3 5 6 7",
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  giveFamily: choice({
    group: "Giving line (marimba)",
    label: "Family",
    help: "The atom the giving line counts in, for the whole sketch",
    value: FAMILY_OPTIONS[0]!,
    options: FAMILY_OPTIONS,
  }),
  pitch: pitch({
    group: "Giving line (marimba)",
    label: "Pitch",
    help: "The giving line's one pitch (the marimba holds the usual grid). The taking line sounds 13.5 semitones lower, on the other grid. The range is all the two instruments allow together",
    value: "D5",
    min: "D3",
    max: "C7",
    step: 1,
  }),
  takeSet: betweenSet({
    group: "Taking line (cellos)",
    label: "Set",
    help: "The time betweens the taking line starts with, in atoms of its family. A between handed over enters where the taking line is reading, and is played at once",
    value: "4",
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  takeFamily: choice({
    group: "Taking line (cellos)",
    label: "Family",
    help: "The atom the taking line counts in, for the whole sketch",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  after: number({
    group: "Form",
    label: "After",
    help: "Once the giving line holds one between, the sketch ends at the first meeting at least this many beats after the last hand-over",
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

/** Semitones from the giving line's pitch down to the taking line's: odd in quarter tones. */
const APART = 13.5;
/** How long the sketch may run before it gives up (the lines meet too rarely for these values). */
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

const lineOf = (family: string, set: number[]): Line => ({
  atom: atomOf(familyOf(family)),
  set: [...set],
  pointer: 0,
  next: 0,
  onsets: [],
});

export function score(v: Values<typeof knobs>) {
  const giver = lineOf(v.giveFamily, v.giveSet);
  const taker = lineOf(v.takeFamily, v.takeSet);
  const after = v.after * TICKS;
  let handed = 0;
  let end = -1;

  // Both lines in time order; a meeting is a tick where both have an onset.
  while (end < 0) {
    const t = Math.min(giver.next, taker.next);
    if (t > LONGEST)
      throw new Error(
        `The sketch would run past ${LONGEST / TICKS} beats (the lines meet too rarely); try other sets or families`,
      );
    const meeting = giver.next === taker.next;
    if (meeting && t > 0) {
      if (giver.set.length === 1 && t - handed >= after) end = t;
      else if (giver.set.length > 1) {
        // The between the giving line was about to take goes to the taking line, which takes it now.
        const k = giver.pointer % giver.set.length;
        const [x] = giver.set.splice(k, 1);
        giver.pointer = k % giver.set.length;
        const j = taker.pointer % taker.set.length;
        taker.set.splice(j, 0, x!);
        taker.pointer = j;
        handed = t;
      }
    }
    for (const line of [giver, taker]) {
      if (line.next !== t) continue;
      line.onsets.push({ at: t, meeting });
      if (end >= 0) continue;
      const between = line.set[line.pointer % line.set.length]!;
      line.pointer = (line.pointer + 1) % line.set.length;
      line.next = t + between * line.atom;
    }
  }

  const stop = end + TICKS;
  const bar = 4 * TICKS;
  const partOf = (
    line: Line,
    midi: number,
    head: Omit<Part, "events" | "dynamics">,
    technique?: string,
  ): Part => {
    // Each note lasts to the line's next onset; the last one, on the final meeting, one beat.
    const events: NoteEvent[] = line.onsets.map((o, i) => ({
      at: time(o.at),
      dur: time((line.onsets[i + 1]?.at ?? stop) - o.at),
      pitch: { midi },
      ...(technique ? { technique } : {}),
    }));
    // p throughout; a note on a meeting is mp.
    const dynamics: DynamicPoint[] = [];
    for (const o of line.onsets) {
      const level = o.meeting ? 4 : 3;
      if (dynamics.at(-1)?.level !== level) dynamics.push({ at: time(o.at), level });
    }
    return { ...head, dynamics, events };
  };
  const parts = [
    partOf(giver, v.pitch, {
      id: "mar",
      instrument: "marimba",
      name: "Marimba",
      abbreviation: "Mar.",
    }),
    partOf(
      taker,
      v.pitch - APART,
      { id: "vc", instrument: "cellos", name: "Violoncellos", abbreviation: "Vc." },
      "pizz",
    ),
  ];
  return scoreOf(
    "antara · palette A · a between handed over where the lines meet",
    Math.ceil(stop / bar),
    v.tempo,
    parts,
  );
}

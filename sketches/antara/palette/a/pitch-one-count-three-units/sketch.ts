// antara palette, A (pitch): one count, three units.
//
// A between is a count: how many quarter tones (the atom) it holds. It becomes a size in semitones,
// a pitch to stand on, only once the count is read in a unit. Here one stream of counts is read in
// three units at once. The set of counts is read by one rule (the order written, starting one place
// later each pass), and the counts it draws are the same for all three lines. Three solo cellos
// start together on one standpoint; each adds every count, times its own unit, to its last pitch
// (no octave folding): unit 1 reads a count in quarter tones, unit 2 in semitones, unit 3 in three
// quarter tones. So the three draw the same shape in three sizes, 1 : 2 : 3, always moving
// together, in the same direction.
//
// This is the time axis's shape put on the pitch axis. A time between is a count of atoms, and the
// same count is another length in another family (2, 3, 5). Here the pitch axis has one atom, and
// the units are its three smallest multiples.
//
// Each line stands at the standpoint plus the partial sum of the counts (the counts drawn so far)
// times its unit. So the vertical between of two lines is the partial sum times the difference of
// their units, and it is 0 wherever the partial sum is 0. With a set summing to 0 the three meet
// in unison on the standpoint at the end of every pass. Nothing arranges the meeting; the sum does.
// Two grids: the unit-2 line adds whole semitones only, so it never leaves the standpoint's grid.
// That is a result of its unit being even, not a choice. The unit-1 and unit-3 lines change grid
// together, at every odd count.
//
// Time is a set holding one between: all three strike together at every onset, and each note lasts
// to the next. Ordinary arco, a constant p, no accents, no slurs; the unisons are not marked. The
// last unison is held and fades.
//
// The counts are written as text, not on a between-set ruler: the ruler keeps its betweens sorted by
// size, and here the order written is the rule.
// Card: README.md.

import {
  choice,
  number,
  numbersOf,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

export const knobs = {
  counts: text({
    group: "Pitch",
    label: "Counts",
    help: "The set of betweens as counts of quarter tones (whole numbers, − for down), in the order written. The rule reads them in this order, starting one place later each pass; all three lines take the same counts. With a sum of 0, the three meet in unison on the standpoint at the end of every pass",
    value: "3 -1 6 -9 12 -11",
  }),
  units: text({
    group: "Pitch",
    label: "Units",
    help: "The three units the counts are read in, in quarter tones (whole numbers, 1 or more): one for each cello, top to bottom of the score",
    value: "1 2 3",
  }),
  anchor: pitch({
    group: "Pitch",
    label: "Standpoint",
    help: "Where all three start, together. Nothing is folded into range: a line that leaves the cello (36–84) stops the sketch with an error",
    value: "C4",
    min: "C3",
    max: "C5",
    step: 0.5,
  }),
  passes: number({
    group: "Pitch",
    label: "Passes",
    help: "How many times the rule reads the whole set. The three meet at the start and at the end of every pass",
    value: 6,
    min: 1,
    max: 12,
    step: 1,
  }),
  between: number({
    group: "Time",
    label: "Time between",
    help: "The one time between of the time set, in atoms of the family: every onset is this far after the last, and all three lines strike together",
    value: 4,
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time between counts in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 60,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

const CELLO: [number, number] = [36, 84];

/** Three solo cellos, in score order: one colour, so that only the sizes are heard. */
const PLAYERS: Player[] = [1, 2, 3].map((j) => ({
  id: `vc${j}`,
  instrument: "cellos",
  name: `Violoncello solo ${j}`,
  abbreviation: `Vc. ${j}`,
  players: 1,
  range: CELLO,
  grids: [0, 1],
}));

/** Beats the last unison is held, fading. */
const HOLD = 4;

export function score(v: Values<typeof knobs>) {
  const counts = numbersOf("Counts", v.counts.replaceAll("−", "-"));
  if (counts.some((c) => !Number.isInteger(c)))
    throw new Error("Counts: a count is a whole number of quarter tones (3, -1, 12)");
  const units = numbersOf("Units", v.units);
  if (units.length !== PLAYERS.length || units.some((u) => !Number.isInteger(u) || u < 1))
    throw new Error("Units: write three whole numbers of quarter tones, 1 or more (1 2 3)");

  // One stream of counts, drawn once; every line reads the same counts in its own unit.
  const next = stream(counts, "shift each time", 1);
  const drawn = Array.from({ length: v.passes * counts.length }, () => next());
  const lines = units.map((u) => {
    const out = [v.anchor];
    for (const c of drawn) out.push(out.at(-1)! + (c * u) / 2);
    return out;
  });
  lines.forEach((xs, k) => {
    const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
    if (lo < CELLO[0] || hi > CELLO[1])
      throw new Error(
        `Standpoint: the line in unit ${units[k]} (${PLAYERS[k]!.name}) walks from ${lo} to ${hi}, outside the cello's ${CELLO[0]}–${CELLO[1]}; move the Standpoint, or take smaller Counts, Units or fewer Passes`,
      );
  });

  const step = v.between * atomOf(familyOf(v.family));
  const last = drawn.length * step;
  const end = last + HOLD * TICKS;
  const bar = 4 * TICKS;
  // A constant p; the last note (the last unison) fades to nothing while it is held.
  const dynamics = curve([
    { at: 0, level: 3 },
    { at: last, level: 3, ramp: true },
    { at: end, level: 0 },
  ]);
  const parts = lines.map((xs, k) =>
    part(
      PLAYERS[k]!,
      xs.map((m, i) => note(i * step, i < drawn.length ? step : end - last, m)),
      dynamics,
    ),
  );
  return scoreOf(
    "antara · palette A · one count, three units",
    Math.ceil(end / bar),
    v.tempo,
    parts,
  );
}

// antara palette, A (time): the betweens sound without their terms.
//
// A line of onsets is its origin plus the time betweens a rule draws from a set, added one after
// another; each place the addition reaches is a term. Here the terms and the betweens are given to
// two instruments. The bass drum strikes the terms: one short stroke at each. The timpani sounds
// the betweens themselves: one roll on one drum from a term to the next, silent (niente) at both
// terms and loudest at the one point equally far from both (the midpoint), rising and falling in
// straight lines. The shape follows from that alone: zero at both ends, symmetric. No roll has an
// attack, every roll peaks at the same level, and the rolls differ only in width.
//
// The same line is heard three ways, one after another: terms only (the drum alone), terms and
// betweens, then betweens only. The drum stops, and the terms after it are struck by no one: they
// are left as the silent points where one roll ends and the next begins. The last term, where the
// line ends, is struck by no one; the last roll reaches silence there. A round is the set read
// through once; the drum strikes every term that bounds a between of its rounds, the timpani rolls
// every between from its first round to the end.
//
// A between of an odd number of atoms has its midpoint half an atom off the family's grid: the roll
// is loudest where no player of that family can strike (the card counts how many of these
// midpoints also miss the other families' grids).
//
// The set is read in a fixed circular order, written in the knob. Read smallest first, every round
// would widen step by step, the same slowing-down shape each time. The order given alternates the
// three shorter betweens with the three longer ones, so each between turns against its neighbours;
// among such orders it is the one circular order (up to direction) in which no round, as played,
// grows longer or shorter overall (the means of its two halves differ by less than 2 atoms).
//
// The timpani carries the betweens because playback follows a dynamic curve only on pitched parts
// (BBC SO Long Rolls follow CC1); an unpitched part gets its level only at each onset.
// Card: README.md.

import type { DynamicPoint, NoteEvent, Part } from "../../../../../src/score/types.ts";
import {
  choice,
  number,
  numbersOf,
  pitch,
  range,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { note, scoreOf, TICKS, time } from "../../common.ts";

const RULES = ["shift each time", "in order"];

export const knobs = {
  set: text({
    group: "Time",
    label: "Set",
    help: "The time betweens, in atoms of the family, in the circular order the rule reads them (whole numbers, 1 or more). A round is the set read through once",
    value: "4 10 7 8 5 11",
  }),
  rule: choice({
    group: "Time",
    label: "Rule",
    help: "shift each time: the set in the order written, each round starting one later. in order: every round from the first",
    value: RULES[0]!,
    options: RULES,
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the betweens count in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  rounds: number({
    group: "Form",
    label: "Rounds",
    help: "How many times the rule reads the set through",
    value: 4,
    min: 1,
    max: 8,
    step: 1,
  }),
  drum: range({
    group: "Form",
    label: "Drum rounds",
    help: "The rounds whose terms the bass drum strikes (both ends of every between in them)",
    value: [1, 3],
    min: 1,
    max: 8,
    step: 1,
  }),
  roll: number({
    group: "Form",
    label: "Roll from round",
    help: "The timpani rolls every between from this round to the end",
    value: 2,
    min: 1,
    max: 8,
    step: 1,
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
  peak: number({
    group: "Sound",
    label: "Peak",
    help: "The level every roll reaches at its midpoint (4 = mp); it is 0 at both terms",
    value: 4,
    min: 1,
    max: 8,
    step: 0.5,
  }),
  timpani: pitch({
    group: "Sound",
    label: "Timpani",
    help: "The one pitch the timpani rolls on (sounding)",
    value: 49,
    min: 38,
    max: 60,
    step: 0.5,
  }),
};

/** A time in half ticks (a midpoint may fall half a tick off), exactly, in quarters. */
function halfTime(halves: number): [number, number] {
  const whole = 2 * TICKS;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(Math.abs(halves), whole) || 1;
  return [halves / g, whole / g];
}

export function score(v: Values<typeof knobs>) {
  const atom = atomOf(familyOf(v.family));
  const set = numbersOf("Set", v.set);
  if (set.some((n) => !Number.isInteger(n) || n < 1))
    throw new Error("Set: time betweens are whole numbers of atoms, 1 or more");
  const size = set.length;
  const draw = drawer(set, v.rule, size, "ascending");
  const betweens: number[] = [];
  for (let r = 0; r < v.rounds; r++) betweens.push(...draw());
  // The terms, in atoms: the origin, then each between added in turn.
  const terms = [0];
  for (const b of betweens) terms.push(terms.at(-1)! + b);
  const roundOf = (between: number) => Math.floor(between / size) + 1;

  // Terms: a stroke on each term that bounds a between of the drum rounds.
  const [from, to] = v.drum;
  const strokes: NoteEvent[] = [];
  terms.forEach((t, k) => {
    if (k >= (from - 1) * size && k <= Math.min(to, v.rounds) * size)
      strokes.push({ at: time(t * atom), dur: time(atom) });
  });

  // Betweens: a roll from each term to the next, 0 at both terms and the peak at the midpoint.
  const rolls: NoteEvent[] = [];
  const points = new Map<number, { level: number; ramp: boolean }>();
  betweens.forEach((b, i) => {
    if (roundOf(i) < v.roll) return;
    const start = terms[i]! * atom;
    const end = terms[i + 1]! * atom;
    rolls.push(note(start, end - start, v.timpani, { technique: "roll" }));
    points.set(2 * start, { level: 0, ramp: true });
    points.set(start + end, { level: v.peak, ramp: true });
    // The end holds unless the next roll starts there (then it is that roll's start).
    if (!points.has(2 * end)) points.set(2 * end, { level: 0, ramp: false });
  });
  const dynamics: DynamicPoint[] = [...points.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([halves, p]) => ({
      at: halfTime(halves),
      level: p.level,
      ...(p.ramp ? { to: "linear" as const } : {}),
    }));

  const parts: Part[] = [];
  if (rolls.length)
    parts.push({
      id: "timp",
      instrument: "timpani",
      name: "Timpani",
      abbreviation: "Timp.",
      dynamics,
      events: rolls,
    });
  if (strokes.length)
    parts.push({
      id: "bd",
      instrument: "bass-drum",
      name: "Bass Drum",
      abbreviation: "B. D.",
      dynamics: [{ at: 0, level: 3 }],
      events: strokes,
    });

  // The score runs to the bar that holds the last term, so that the term nobody strikes is inside it.
  const bar = 4 * TICKS;
  const last = terms.at(-1)! * atom;
  return scoreOf(
    "antara · palette A · the betweens without their terms",
    Math.floor(last / bar) + 1,
    v.tempo,
    parts,
  );
}

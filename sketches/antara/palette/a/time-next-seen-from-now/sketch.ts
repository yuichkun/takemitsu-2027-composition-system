// antara palette, A (time): the next, seen from now.
//
// One line of onsets, made by the principle: the origin plus the time betweens a rule draws from a
// set. A marimba strikes every onset on one pitch. Each onset is taken in turn as the standpoint,
// and the between that has just ended is added forward from it once more: the point where the next
// onset would come if that between came again. A woodblock strikes that point, and only that. So
// every onset is heard twice over: once where it is, and once as what the onset before it pointed
// to.
//
// The actual next onset is early, late, or on time against the point. The woodblock and the next
// marimba strike are apart by exactly the difference of the two betweens on either side of the
// standpoint (the one before minus the one after): 0 only where a between comes twice in a row,
// and there the two strikes are one. A between that equals the sum of the few betweens after it
// points past the next onset to a later one, and meets it at 0 (confirmed only later). Several
// points on one tick are one strike. The point seen from the last onset has no onset to answer it:
// the woodblock sounds alone, and the sketch ends there (at the next bar line).
//
// The rule reads the set as written, starting one later each time round, once for every start.
// Inside a pass, neighbours are neighbours in the written order (its end and its start count as
// neighbours); at every join between passes, two betweens meet that are not, and the woodblock
// marks their difference too. The set is written as text, since its order decides which betweens
// meet (a between-set knob would sort it). One family, one pitch, p throughout, no accents: only
// the time between the two strikes changes. Card: README.md.

import type { NoteEvent, Part } from "../../../../../src/score/types.ts";
import { choice, number, numbersOf, text, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { note, part, scoreOf, TICKS, time, type Player } from "../../common.ts";

const RULES = ["shift each time", "in order"];

export const knobs = {
  set: text({
    group: "Line",
    label: "Set",
    help: "The time betweens of the line, in atoms, in the order the rule reads them (whole numbers, 1 or more). A between written twice is there twice. The order matters: which betweens stand next to each other decides where the next, seen from now, is early, late or on time",
    value: "2 1 8 4 5 2",
    hint: "2 1 8 4 5 2",
  }),
  rule: choice({
    group: "Line",
    label: "Rule",
    help: "shift each time: the set as written, starting one later each time round. in order: the set as written, again and again",
    value: RULES[0]!,
    options: RULES,
  }),
  passes: number({
    group: "Line",
    label: "Passes",
    help: "How many times the rule reads the whole set. As many as the set has betweens: shift each time starts once from every place",
    value: 6,
    min: 1,
    max: 12,
    step: 1,
  }),
  family: choice({
    group: "Line",
    label: "Family",
    help: "The atom the betweens count in",
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

// The middle of the marimba's range (45 to 96), on the usual grid (it holds only that one).
const PITCH = 70;
const MARIMBA: Player = {
  id: "mar",
  instrument: "marimba",
  name: "Marimba",
  abbreviation: "Mar.",
  range: [45, 96],
  grids: [0],
};

/** The line's betweens, in atoms: `passes` whole readings of the set by the rule. */
function betweensOf(set: number[], rule: string, passes: number): number[] {
  const draw = drawer(set, rule, set.length, "ascending");
  return Array.from({ length: passes }, () => draw()).flat();
}

/** The onsets (atoms from 0) and, from each onset after the first, the next seen from it. */
function linesOf(betweens: number[]): { onsets: number[]; next: number[] } {
  const onsets = [0];
  for (const b of betweens) onsets.push(onsets.at(-1)! + b);
  // From onset n, the between that has just ended (onset n minus onset n − 1), added once more.
  const next = onsets.slice(1).map((t, i) => t + (t - onsets[i]!));
  return { onsets, next };
}

export function score(v: Values<typeof knobs>) {
  const set = numbersOf("Set", v.set.replaceAll("−", "-"));
  if (set.some((b) => !Number.isInteger(b) || b < 1))
    throw new Error("Set: time betweens are whole numbers of atoms, 1 or more (e.g. 2 1 8 4 5 2)");
  const atom = atomOf(familyOf(v.family));
  const { onsets, next } = linesOf(betweensOf(set, v.rule, v.passes));
  // Several points on one tick are one strike.
  const points = [...new Set(next)].sort((a, b) => a - b);

  const bar = 4 * TICKS;
  const last = Math.max(onsets.at(-1)!, points.at(-1)!) + 1;
  const end = Math.ceil((last * atom) / bar) * bar;

  const staff = PITCH >= 60 ? 1 : 2;
  const line = onsets.map((t) => note(t * atom, atom, PITCH, { staff }));
  const strikes: NoteEvent[] = points.map((t) => ({ at: time(t * atom), dur: time(atom) }));
  const woodblock: Part = {
    id: "wbm",
    instrument: "woodblock-medium",
    name: "Woodblock (medium)",
    abbreviation: "W. B. m.",
    dynamics: [{ at: [0, 1], level: 3 }],
    events: strikes,
  };
  return scoreOf("antara · palette A · the next, seen from now", end / bar, v.tempo, [
    part(MARIMBA, line, [{ at: [0, 1], level: 3 }]),
    woodblock,
  ]);
}

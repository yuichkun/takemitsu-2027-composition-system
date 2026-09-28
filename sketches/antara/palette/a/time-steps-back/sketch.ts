// antara palette, A (time): a step back in time.
//
// A line of onsets is its origin plus the time betweens a rule draws from a set. On the pitch axis a
// between has a direction (up or down); on the time axis it has been read as forward only. Here the
// time set holds negative betweens too, and the line is walked exactly as a pitch line is: each
// term is the one before it plus the next between drawn. A negative between puts the next term
// before the one the walk stands on.
//
// The walk is computed whole first (it does not run in time), then heard in time order. The one
// who walks adds the terms in one order; the one who listens can only stand in time and hears them
// in another. The order of the terms is a name given from where one stands. Where the walk comes
// back to a point it has stood on, the time between to that earlier term is 0.
//
// One line, one family. Each term is one stroke, one atom long, on a woodblock that names the step
// that reached it: high if the step went forward, low if it went back, medium for the origin
// (reached by no step; a between of 0 would reach a term the same way). Two terms on one point: a
// high and a low stroke together if their steps differ, one stroke if they agree. The origin is
// placed on the first beat with room before it for the earliest term. All at p, no accents, so only
// the order and the betweens are heard.
//
// Negative time betweens widen the principle's reading of addition (forward from the first onset):
// a reading for 余湖さん to confirm, not a settled rule.
// Card: README.md.

import type { NoteEvent, Part } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, familyOf, FAMILY_OPTIONS, ORDERS } from "../../../between.ts";
import { scoreOf, TICKS, time } from "../../common.ts";

const RULES = ["combinations", "shift each time", "in order"];

export const knobs = {
  set: betweenSet({
    group: "Time",
    label: "Set",
    help: "The time betweens, in atoms of the family, with a direction. A negative one steps back: the next term goes before the one the walk stands on",
    value: "-3 -1 2 4 5",
    min: -6,
    max: 6,
    step: 1,
    unit: "atoms",
  }),
  rule: choice({
    group: "Time",
    label: "Rule",
    help: "combinations: every group of Group size betweens, in dictionary order · shift each time: the whole set, starting one later each time round · in order: the whole set, again and again",
    value: RULES[0]!,
    options: RULES,
  }),
  k: number({
    group: "Time",
    label: "Group size",
    help: "With combinations: how many betweens each group holds",
    value: 2,
    min: 1,
    max: 6,
    step: 1,
  }),
  order: choice({
    group: "Time",
    label: "Order in group",
    help: "With combinations: the betweens inside each group, smallest first (ascending) or largest first (descending). The order of the groups stays",
    value: ORDERS[0],
    options: [...ORDERS],
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the betweens count in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  cycles: number({
    group: "Form",
    label: "Cycles",
    help: "How many times the rule goes round all its groups (combinations: every group once; shift each time: every starting place once; in order: the set once)",
    value: 6,
    min: 1,
    max: 24,
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
};

/** The step that reached a term: forward, back, or none (the origin, or a between of 0). */
type Step = "forward" | "back" | "none";

interface Block {
  step: Step;
  id: string;
  instrument: string;
  name: string;
  abbreviation: string;
}

// Score order, top down.
const BLOCKS: Block[] = [
  {
    step: "forward",
    id: "wbh",
    instrument: "woodblock-high",
    name: "Woodblock (high)",
    abbreviation: "W. B. h.",
  },
  {
    step: "none",
    id: "wbm",
    instrument: "woodblock-medium",
    name: "Woodblock (medium)",
    abbreviation: "W. B. m.",
  },
  {
    step: "back",
    id: "wbl",
    instrument: "woodblock-low",
    name: "Woodblock (low)",
    abbreviation: "W. B. l.",
  },
];

/** How many groups the rule draws before it starts again. */
function roundOf(set: number[], rule: string, k: number, order: string): number {
  const draw = drawer(set, rule, k, order);
  const first = draw().join(" ");
  let n = 1;
  while (draw().join(" ") !== first) n++;
  return n;
}

export function score(v: Values<typeof knobs>) {
  const set = [...v.set];
  if (set.some((n) => !Number.isInteger(n)))
    throw new Error("Set: time betweens are whole numbers of atoms (negative ones step back)");
  const atom = atomOf(familyOf(v.family));

  // The walk, whole, in the order the terms are added: positions in atoms from the origin.
  const draw = drawer(set, v.rule, v.k, v.order);
  const groups = roundOf(set, v.rule, v.k, v.order) * v.cycles;
  const terms: { at: number; step: Step }[] = [{ at: 0, step: "none" }];
  let here = 0;
  for (let g = 0; g < groups; g++)
    for (const b of draw()) {
      here += b;
      terms.push({ at: here, step: b > 0 ? "forward" : b < 0 ? "back" : "none" });
    }

  // Heard in time order. The origin stands on the first beat with room for the earliest term.
  // (A loop, not Math.min(...): large sets and groups make more terms than a call can spread.)
  let earliest = 0;
  let latest = 0;
  for (const t of terms) {
    if (t.at < earliest) earliest = t.at;
    if (t.at > latest) latest = t.at;
  }
  const origin = Math.ceil((-earliest * atom) / TICKS) * TICKS;
  const last = origin + latest * atom;
  const bar = 4 * TICKS;
  const end = Math.ceil((last + atom) / bar) * bar;

  const parts: Part[] = BLOCKS.flatMap((b) => {
    // Two terms reached the same way on one point sound as one stroke.
    const ticks = [
      ...new Set(terms.filter((t) => t.step === b.step).map((t) => origin + t.at * atom)),
    ].sort((x, y) => x - y);
    if (ticks.length === 0) return [];
    const events: NoteEvent[] = ticks.map((t, j) => ({
      at: time(t),
      dur: time(Math.min(atom, (ticks[j + 1] ?? end) - t)),
    }));
    return [
      {
        id: b.id,
        instrument: b.instrument,
        name: b.name,
        abbreviation: b.abbreviation,
        dynamics: [{ at: 0, level: 3 }],
        events,
      },
    ];
  });
  return scoreOf("antara · palette A · a step back in time", end / bar, v.tempo, parts);
}

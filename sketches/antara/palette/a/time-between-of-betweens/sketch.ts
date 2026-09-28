// antara palette, A (time): the between of the betweens.
//
// A line of onsets is its first onset plus the time betweens drawn from a set. Here the betweens
// themselves are made the same way, one level up: the first between (the standpoint) plus
// differences drawn from a set of differences. Each between is the one before it plus the next
// difference drawn; a difference of 0 gives the same between again. A pulse (a stretch where the
// set holds one between) is not written: it appears only where the between of the betweens is 0,
// and the next difference ends it. A pulse exactly a beat long may appear or not; the beat is not
// written either.
//
// The rule: every distinct group of differences (a few at a time), in dictionary order, each group
// in order of size (smallest first, or largest first), once through, then the sketch stops. A
// between must stay within bounds: a difference that would take it out is subtracted instead
// (reflected), the same kind of rule as moving a pitch line back into its range by octaves, added
// from outside the mechanism.
//
// One harp, one pitch, plucked; each note rings for its between, until the same string is struck
// again. p throughout, nothing marked, so only the betweens are heard. One family throughout.
//
// Taking the betweens from a set of differences applies the principle's form (a standpoint plus
// what is drawn from a set) one level up. Whether that is a reading of the principle is a
// question for 余湖さん, not a settled rule.
// Card: README.md.

import type { NoteEvent } from "../../../../../src/score/types.ts";
import {
  betweenSet,
  choice,
  number,
  pitch,
  range,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS, ORDERS } from "../../../between.ts";
import { note, part, scoreOf, TICKS, type Player } from "../../common.ts";

export const knobs = {
  differences: betweenSet({
    group: "Betweens",
    label: "Differences",
    help: "The set of differences: how much a between differs from the one before it, in atoms (0: the same between again, where a pulse appears). A difference written twice is there twice",
    value: "-3 -1 0 0 1 3",
    min: -8,
    max: 8,
    step: 1,
    unit: "atoms",
  }),
  start: number({
    group: "Betweens",
    label: "Start",
    help: "The first between, in atoms: the standpoint the differences are added to",
    value: 8,
    min: 1,
    max: 30,
    step: 1,
    unit: "atoms",
  }),
  bounds: range({
    group: "Betweens",
    label: "Bounds",
    help: "The shortest and the longest between, in atoms. A difference that would take a between out of them is subtracted instead (reflected)",
    value: [1, 15],
    min: 1,
    max: 30,
    step: 1,
    unit: "atoms",
  }),
  size: number({
    group: "Rule",
    label: "Group size",
    help: "How many differences each group takes. Every distinct group is taken once, in dictionary order, then the sketch stops",
    value: 3,
    min: 1,
    max: 6,
    step: 1,
  }),
  order: choice({
    group: "Rule",
    label: "Order in a group",
    help: "The order of the differences inside each group: ascending (smallest first) or descending. The groups keep their dictionary order",
    value: ORDERS[0],
    options: [...ORDERS],
  }),
  family: choice({
    group: "Sound",
    label: "Family",
    help: "The atom the betweens count in",
    value: FAMILY_OPTIONS[2]!,
    options: FAMILY_OPTIONS,
  }),
  pitch: pitch({
    group: "Sound",
    label: "Pitch",
    help: "The one pitch the harp plucks (the usual grid: a harp holds only that one)",
    value: "A3",
    min: "C2",
    max: "C6",
    step: 1,
  }),
  tempo: number({
    group: "Sound",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 66,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

const HARP: Player = { id: "hp", instrument: "harp", range: [23, 104], grids: [0] };

/** Every distinct group of `size` differences, in dictionary order, each group sorted (once). */
function groupsOf(set: number[], size: number, order: string): number[][] {
  const k = Math.max(1, Math.min(size, set.length));
  const sorted = [...set].sort((a, b) => a - b);
  const seen = new Set<string>();
  const out: number[][] = [];
  const pick = (from: number, acc: number[]) => {
    if (acc.length === k) {
      const key = acc.join(",");
      if (!seen.has(key)) {
        seen.add(key);
        out.push(order === "descending" ? [...acc].reverse() : acc);
      }
      return;
    }
    for (let i = from; i < sorted.length; i++) pick(i + 1, [...acc, sorted[i]!]);
  };
  pick(0, []);
  return out;
}

/**
 * The betweens: the start, then each one the one before plus the next difference; a difference
 * that would leave the bounds is subtracted instead (and if that leaves them too, the between
 * stops at the bound).
 */
function betweensOf(v: Values<typeof knobs>): number[] {
  const lo = Math.min(...v.bounds);
  const hi = Math.max(...v.bounds);
  const inside = (b: number) => b >= lo && b <= hi;
  const out = [Math.min(hi, Math.max(lo, v.start))];
  for (const d of groupsOf(v.differences, v.size, v.order).flat()) {
    const b = out.at(-1)!;
    const next = inside(b + d) ? b + d : inside(b - d) ? b - d : Math.min(hi, Math.max(lo, b + d));
    out.push(next);
  }
  return out;
}

export function score(v: Values<typeof knobs>) {
  const atom = atomOf(familyOf(v.family));
  // Staff 1 from middle C up, staff 2 below.
  const staff = v.pitch >= 60 ? 1 : 2;
  const events: NoteEvent[] = [];
  let t = 0;
  for (const b of betweensOf(v)) {
    // Plucked; it rings for its between, until the same string is struck again.
    events.push(note(t, b * atom, v.pitch, { staff }));
    t += b * atom;
  }
  const bar = 4 * TICKS;
  return scoreOf("antara · palette A · the between of the betweens", Math.ceil(t / bar), v.tempo, [
    part(HARP, events, [{ at: 0, level: 3 }]),
  ]);
}

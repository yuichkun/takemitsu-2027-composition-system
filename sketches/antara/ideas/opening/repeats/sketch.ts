// antara, the opening — candidate "repeats": the harps come where a between repeats. Card:
// README.md; the scene and what the candidates share: ../README.md, ../common.ts.
//
// The celesta's betweens are drawn from a set that shrinks as time passes (../common.ts,
// shrinking). A between is a whole number of atoms, so once the set is small the atom can no longer
// tell its betweens apart: two in a row come out the same, and the strokes repeat. Where a between
// repeats (short enough to be heard as one between, twice), harp 1 plays too: the relation, heard
// again, is given a second name. Where it repeats once more (three equal betweens in a row), harp 2
// too, on the same string: the first interval. The ground gives way: each time harp 2 plays, one
// of its six voices leaves, from the top, until only the rolls are left.

import type { Score } from "../../../../../src/score/types.ts";
import { number, type Values } from "../../../../../src/sketch/knobs.ts";
import {
  BAND_SIZE,
  familyOf,
  ground,
  scoreOf,
  secondsOf,
  shrinking,
  shrinkKnobs,
  soundKnobs,
  strokeParts,
  strokesOf,
  TICKS,
} from "../common.ts";

export { seams } from "../common.ts";

export const knobs = {
  // One between twice: where the rule draws it twice in a row, it repeats at any size (heard once
  // it is short enough); three in a row come only when the atom merges it with a neighbour.
  ...shrinkKnobs("29 37 37 48"),
  heard: number({
    group: "Harps",
    label: "Heard",
    help: "A repeat counts only when the between is shorter than this: strokes further apart are heard as separate events (about 1.8 s: Fraisse 1948, Repp 2006), so a longer between, repeated, is not heard as the same between again",
    value: 1.75,
    min: 0.5,
    max: 8,
    step: 0.25,
    unit: "s",
  }),
  ...soundKnobs("gives way"),
};

type V = Values<typeof knobs>;

export function score(v: V): Score {
  const family = familyOf(v.family);
  const seconds = secondsOf(family, v.tempo);
  const gaps = shrinking(v);
  const times = strokesOf(v.intro * TICKS, gaps, family);
  // Stroke k comes after the between gaps[k - 1].
  const one: number[] = [];
  const two: number[] = [];
  for (let k = 2; k < times.length; k++) {
    const g = gaps[k - 1]!;
    if (g !== gaps[k - 2] || g * seconds >= v.heard) continue;
    one.push(k);
    if (k >= 3 && gaps[k - 3] === g) two.push(k);
  }
  const end = times.at(-1)! + 2 * TICKS;
  const leaves = two.slice(0, BAND_SIZE).map((k) => times[k]!);
  const parts = [...strokeParts(v, times, one, two, end), ...ground(v, end, leaves)];
  return scoreOf("antara · opening, where a between repeats", v, parts, end, [
    times[one[0]!],
    times[two[0]!],
  ]);
}

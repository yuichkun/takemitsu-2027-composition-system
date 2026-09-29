// antara, the opening — candidate "counts": the harps come where the strokes, once close enough to
// be heard together, are counted into groups. Card: README.md; the scene and what the candidates
// share: ../README.md, ../common.ts.
//
// The celesta's betweens are drawn from a set that shrinks as time passes (../common.ts,
// shrinking). From the first between short enough to be heard as a between (Heard), the strokes are
// counted into groups whose lengths (in strokes) a rule draws from a set. Where a group begins,
// harp 1 plays too: a head. The heads are counted the same way into groups of heads (a second
// set): where one begins, harp 2 too, on the same string (the first interval). The heads of harp 2
// are counted once more by the same set: where such a group begins, the tam-tam is struck softly,
// and the ground takes the slowest level. A metre comes out of counting, levels deep; no bar puts
// it there.

import type { Score } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, type Values } from "../../../../../src/sketch/knobs.ts";
import {
  familyOf,
  ground,
  partOf,
  RULES,
  scoreOf,
  secondsOf,
  shrinking,
  shrinkKnobs,
  soundKnobs,
  stream,
  strokeParts,
  strokesOf,
  TICKS,
  time,
} from "../common.ts";

export { seams } from "../common.ts";

export const knobs = {
  ...shrinkKnobs(),
  heard: number({
    group: "Harps",
    label: "Heard",
    help: "Counting begins at the first between shorter than this: strokes further apart are heard as separate events (about 1.8 s: Fraisse 1948, Repp 2006), so they cannot be counted into a group",
    value: 1.75,
    min: 0.5,
    max: 8,
    step: 0.25,
    unit: "s",
  }),
  groups: betweenSet({
    group: "Harps",
    label: "Groups",
    help: "How many strokes a group lasts. The first head (harp 1) comes after the first group is counted",
    value: "3 4 5 7",
    min: 1,
    max: 16,
    step: 1,
    unit: "strokes",
  }),
  heads: betweenSet({
    group: "Harps",
    label: "Groups of heads",
    help: "How many heads a group of heads lasts (harp 2 where one begins). The same set counts the heads of harp 2 for the tam-tam",
    value: "2 3 4",
    min: 1,
    max: 8,
    step: 1,
    unit: "heads",
  }),
  countRule: choice({
    group: "Harps",
    label: "Rule",
    help: "How the lengths are drawn from both sets",
    value: RULES[0]!,
    options: RULES,
  }),
  tamtam: choice({
    group: "Ground",
    label: "Slowest level",
    help: "Where a group of harp 2's heads begins: the tam-tam struck softly (the ground's roll is then the bass drum's alone), or nothing",
    value: "tam-tam",
    options: ["tam-tam", "nothing"],
  }),
  ...soundKnobs("stays"),
};

type V = Values<typeof knobs>;

/** Every `n`-th of `items` by lengths the rule draws: the first after the first length. */
function counted<T>(items: T[], lengths: number[], rule: string): T[] {
  const next = stream(lengths, rule);
  const out: T[] = [];
  for (let k = next(); k < items.length; k += next()) out.push(items[k]!);
  return out;
}

export function score(v: V): Score {
  const family = familyOf(v.family);
  const seconds = secondsOf(family, v.tempo);
  const gaps = shrinking(v);
  const times = strokesOf(v.intro * TICKS, gaps, family);
  // Stroke k comes after the between gaps[k - 1].
  const from = gaps.findIndex((g) => g * seconds < v.heard) + 1;
  const strokes = from > 0 ? times.map((_, k) => k).slice(from) : [];
  const one = counted(strokes, v.groups, v.countRule);
  const two = counted(one, v.heads, v.countRule);
  const three = counted(two, v.heads, v.countRule);
  const end = times.at(-1)! + 2 * TICKS;
  const strike = v.tamtam === "tam-tam";
  const parts = [
    ...strokeParts(v, times, one, two, end),
    ...ground(v, end, [], strike ? ["bd"] : ["bd", "tam"]),
  ];
  if (strike && three.length)
    parts.push(
      partOf(
        "tam",
        three.map((k) => ({
          at: time(times[k]!),
          dur: time(Math.min(4 * TICKS, end - times[k]!)),
        })),
        [{ at: 0, level: 1.5 }],
      ),
    );
  return scoreOf("antara · opening, where the strokes are counted", v, parts, end, [
    times[one[0]!],
    times[two[0]!],
  ]);
}

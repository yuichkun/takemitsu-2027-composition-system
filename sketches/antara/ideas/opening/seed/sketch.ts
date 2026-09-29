// antara, the opening — candidate "seed": the repeated notes are there from the first time round,
// as one short between among long ones, and spread. Card: README.md; the scene and what the
// candidates share: ../README.md, ../common.ts.
//
// The celesta's betweens: a set read by a rule, the whole set each time round, shrinking as time
// passes like the other candidates' (by half every Halving seconds; whole atoms, at least one). Its
// smallest between, one atom (the seed), is there from the first time round: two strokes close
// together among long silences. After each time round, the set's largest between is replaced, where
// it stands, by the seed; the longest go first, and the seeds gather into runs of repeated notes
// that grow out from the first one until every between is the seed. Where a between repeats (short
// enough to be heard as one between, twice), harp 1 plays too; where it repeats once more, harp 2
// too, on the same string (the first interval). The ground gives way: its six voices stand for the
// six long betweens, and each time one of those is replaced, one voice leaves, from the top.

import type { Score } from "../../../../../src/score/types.ts";
import { choice, number, text, type Values } from "../../../../../src/sketch/knobs.ts";
import {
  BAND_SIZE,
  familyOf,
  ground,
  scoreOf,
  secondsOf,
  soundKnobs,
  strokeParts,
  strokesOf,
  TICKS,
} from "../common.ts";
import { atomOf } from "../../../between.ts";

export { seams } from "../common.ts";

export const knobs = {
  set: text({
    group: "Time",
    label: "Set",
    help: "The betweens (in atoms) in the order the rule reads them. The smallest is the seed: after each time round the largest between becomes the seed, where it stands. Written as it is, the longest stand next to the seed, so the runs grow out from it, one side and then the other",
    value: "21 29 36 1 44 33 25",
  }),
  rule: choice({
    group: "Time",
    label: "Rule",
    help: "shift each time: the set as written, starting one later each time round · in order: as written every time",
    value: "shift each time",
    options: ["shift each time", "in order"],
  }),
  halving: number({
    group: "Time",
    label: "Halving",
    help: "Seconds for the whole set to shrink to half its size (the seed stays one atom)",
    value: 40,
    min: 6,
    max: 60,
    step: 1,
    unit: "s",
  }),
  tail: number({
    group: "Time",
    label: "Tail",
    help: "Beats of the seed alone after every between has become it",
    value: 4,
    min: 0,
    max: 16,
    step: 1,
    unit: "beats",
  }),
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

/** The betweens, time round after time round, and the stroke at which each replacement is heard. */
function seeding(v: V): { gaps: number[]; replaced: number[] } {
  const set = v.set
    .replaceAll("−", "-")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (set.length < 2 || set.some((x) => !Number.isInteger(x) || x < 1))
    throw new Error("Set: two or more betweens, whole numbers of atoms, 1 or more");
  const family = familyOf(v.family);
  const seconds = secondsOf(family, v.tempo);
  const seed = Math.min(...set);
  const gaps: number[] = [];
  const replaced: number[] = [];
  let t = 0;
  for (let round = 0; round <= set.length; round++) {
    const s = v.rule === "in order" ? 0 : round % set.length;
    for (const b of [...set.slice(s), ...set.slice(0, s)]) {
      const g = b === seed ? seed : Math.max(seed, Math.round(b * 2 ** (-t / v.halving)));
      gaps.push(g);
      t += g * seconds;
    }
    if (set.every((x) => x === seed)) break;
    set[set.indexOf(Math.max(...set))] = seed;
    // Heard from the next time round, which starts at this one's last stroke.
    replaced.push(gaps.length);
  }
  const tail = Math.round((v.tail * TICKS) / (seed * atomOf(family)));
  for (let k = 0; k < tail; k++) gaps.push(seed);
  return { gaps, replaced };
}

export function score(v: V): Score {
  const family = familyOf(v.family);
  const seconds = secondsOf(family, v.tempo);
  const { gaps, replaced } = seeding(v);
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
  const leaves = replaced.slice(0, BAND_SIZE).map((k) => times[Math.min(k, times.length - 1)]!);
  const parts = [...strokeParts(v, times, one, two, end), ...ground(v, end, leaves)];
  return scoreOf("antara · opening, from a seed", v, parts, end, [times[one[0]!], times[two[0]!]]);
}

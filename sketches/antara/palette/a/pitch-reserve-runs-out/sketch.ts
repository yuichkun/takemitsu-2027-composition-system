// antara palette, A (pitch): the line ends where the set's reserve runs out.
//
// A set says which betweens it holds and how many of each. Here the "how many" is a reserve that
// is spent: each draw spends one. The rule takes every kind that still has some left once (a
// round), so a kind with a small reserve is spent early and drops out, and the kinds leave one at a
// time, the smallest reserve first. The line thins as it goes: all the kinds, then one fewer, and
// so on down to the one kind with the largest reserve, alone. When that is spent the line ends:
// not a fade and not a closing note, but the point where nothing is left to take. Where each kind
// leaves, and so how long the line is and what its last pitch is, is decided by the counts before
// a note sounds. The last pitch is the standpoint plus the sum of count x between, whatever the
// order of the draws.
//
// A round's sum is the sum of the kinds still in the reserve, so the line drifts by it round after
// round; when a kind leaves, the drift changes by that kind. The default set turns the drift at
// every leaving (down, up, down, up, down), so each leaving is heard as a turn of the line.
//
// Order within a round: back and forth (the default) goes through the kinds in the reverse order
// of the round before, and a kind that would come twice in a row moves to the end of the round; so
// while three or more kinds are left, no pair of steps of one round comes back in the same order in
// the next (two kinds can only alternate or repeat one; here they alternate). The round after a
// reversed one is the first round's order without the spent kinds, and (with counts all
// different) each round ends on the kind that is spent next. (Shift each round starts each round
// one kind later: then the next round keeps all but one of the pairs, and a figure one step
// shorter than the round is played twice in a row.)
//
// The line is not folded into range (a fold would change the betweens). Time is a pulse (a time
// set holding one between); every note lasts to the next onset, and the last one the same. A solo
// viola, arco, non vib., p throughout: only which betweens are drawn, and which are left, change.
// Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import type { TextEvent } from "../../../../../src/score/types.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, TICKS, time, type Player } from "../../common.ts";

const ORDERS = ["back and forth", "shift each round"];

const times = (between: number, count: number) => Array.from({ length: count }, () => between);

export const knobs = {
  set: betweenSet({
    group: "Pitch",
    label: "Set",
    help: "The reserve: each between (semitones, .5 for a quarter tone, − for down) as many times as the set holds it. Each round takes every kind that still has some left once; each draw spends one; a spent kind drops out, and the line ends when the last kind is spent",
    value: [
      ...times(-1.5, 10),
      ...times(4, 8),
      ...times(-3, 6),
      ...times(2.5, 4),
      ...times(-5.5, 2),
    ],
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
    anchor: "start",
  }),
  order: choice({
    group: "Pitch",
    label: "Order",
    help: "The order within a round. The first round takes the kinds most first (equal counts, narrowest first). Back and forth: each later round goes through the kinds in the reverse order of the round before, and a kind that would come twice in a row moves to the end. Shift each round: each round starts one kind later than the round before, in the first round's order",
    value: ORDERS[0]!,
    options: ORDERS,
  }),
  start: pitch({
    group: "Pitch",
    label: "Standpoint",
    help: "The first note. Nothing is folded into range: a line that leaves the viola (48–91) stops the sketch with an error",
    value: 72.5,
    min: "C3",
    max: "C6",
    step: 0.5,
  }),
  pulse: number({
    group: "Time",
    label: "Pulse",
    help: "The one time between, in atoms of the family: every note lasts this long, the last one too",
    value: 3,
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the pulse counts in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 44,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

const VIOLA: Player = {
  id: "va",
  instrument: "violas",
  name: "Viola (solo)",
  abbreviation: "Va.",
  players: 1,
  range: [48, 91],
  grids: [0, 1],
};

interface Kind {
  between: number;
  count: number;
}

/**
 * The kinds of a set: each between once, with how many times the set holds it. The most first
 * (they are spent last); equal counts, the narrowest first, then the lower.
 */
function kindsOf(set: number[]): Kind[] {
  const counts = new Map<number, number>();
  for (const b of set) counts.set(b, (counts.get(b) ?? 0) + 1);
  return [...counts.entries()]
    .map(([between, count]) => ({ between, count }))
    .sort(
      (x, y) =>
        y.count - x.count || Math.abs(x.between) - Math.abs(y.between) || x.between - y.between,
    );
}

/**
 * Spends the reserve: for each draw, the kind taken (its place in `kinds`). Each round takes every
 * kind that still has some left, once. The first round takes them in the kinds' order. After
 * that, back and forth: the reverse of the round before (without the spent kinds), with a kind that
 * would come twice in a row moved to the end; shift: the kinds' order, cyclically, from the first
 * kind still left after the one that started the round before.
 */
function spend(kinds: Kind[], backAndForth: boolean): number[] {
  const n = kinds.length;
  const left = kinds.map((k) => k.count);
  const out: number[] = [];
  let round: number[] = [];
  let started = -1;
  while (left.some((c) => c > 0)) {
    const present = kinds.flatMap((_, i) => (left[i]! > 0 ? [i] : []));
    if (backAndForth && round.length > 0) {
      round = round.filter((i) => left[i]! > 0).reverse();
      if (round.length > 1 && round[0] === out.at(-1)) round.push(round.shift()!);
    } else {
      const after = (i: number) => (((i - started - 1) % n) + n) % n;
      round = [...present].sort((a, b) => after(a) - after(b));
    }
    started = round[0]!;
    for (const k of round) {
      left[k]!--;
      out.push(k);
    }
  }
  return out;
}

export function score(v: Values<typeof knobs>) {
  const kinds = kindsOf(v.set);
  const draws = spend(kinds, v.order === ORDERS[0]);
  const line = [v.start];
  for (const d of draws) line.push(line.at(-1)! + kinds[d]!.between);
  const [lo, hi] = [Math.min(...line), Math.max(...line)];
  if (lo < VIOLA.range[0] || hi > VIOLA.range[1])
    throw new Error(
      `Standpoint: the line walks from ${lo} to ${hi}, outside the viola's ${VIOLA.range[0]}–${VIOLA.range[1]}; move the Standpoint or change the Set`,
    );

  const step = v.pulse * atomOf(familyOf(v.family));
  // Every note lasts one pulse, the last one too: nothing marks the end but that nothing follows.
  const events = line.map((m, i) => note(i * step, step, m));
  const end = line.length * step;
  // p throughout: no fade at the end, no accent anywhere.
  const out = part(VIOLA, events, curve([{ at: 0, level: 3 }]));
  const mark: TextEvent = { type: "text", at: time(0), text: "non vib." };
  out.events.unshift(mark);
  const bar = 4 * TICKS;
  return scoreOf(
    "antara · palette A · the line ends where the reserve runs out",
    Math.ceil(end / bar),
    v.tempo,
    [out],
  );
}

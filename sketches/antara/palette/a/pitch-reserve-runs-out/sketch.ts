// antara palette, A (pitch): the line ends where the set's reserve runs out.
//
// A set says which betweens it holds and how many of each. Here the "how many" is a reserve that
// is spent: the rule always takes a between of the kind with the most left, and each draw spends
// one. So the shape of the line is decided by the counts before a note sounds. At first only the
// kind with the most can be taken: the set behaves as if it held one between, and the rule is not
// heard. Each time the reserve at the top is spent down to the next kind's count, that kind joins
// the draw. When every count is 1, one last round spends them all to 0 together, and the line ends
// there: not a fade and not a closing note, but the point where nothing is left to take. The last
// pitch is the standpoint plus the sum of count x between, whatever the order of the draws.
//
// Ties: the kinds with the most left are taken one each (a round), in the order they joined the
// draw (the most at the start first). Each round starts one kind later than the round before, so
// no round is the round before moved by its sum. (The other choice, "after the last drawn", starts
// each round after the kind drawn last: then the same round comes again and again, moved by its
// sum.)
//
// The line is not folded into range (a fold would change the betweens). Time is a pulse (a time
// set holding one between); every note lasts to the next onset. A solo viola, arco, non vib., p
// throughout: only which betweens are drawn, and where they run out, change.
// Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import type { TextEvent } from "../../../../../src/score/types.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, TICKS, time, type Player } from "../../common.ts";

const TIES = ["shift each round", "after the last drawn"];

const times = (between: number, count: number) => Array.from({ length: count }, () => between);

export const knobs = {
  set: betweenSet({
    group: "Pitch",
    label: "Set",
    help: "The reserve: each between (semitones, .5 for a quarter tone, − for down) as many times as the set holds it. The rule always takes the kind with the most left; each draw spends one; the line ends when all are spent",
    value: [...times(-1.5, 11), ...times(2.5, 8), ...times(-3, 7), ...times(4, 3), -5.5],
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
    anchor: "start",
  }),
  ties: choice({
    group: "Pitch",
    label: "Ties",
    help: "When several kinds have the most left, they are taken one each (a round) in the order they joined the draw (most at the start first; equal counts, narrowest first). Shift each round: each round starts one kind later than the round before. After the last drawn: each round starts after the kind drawn last, so the same round comes again, moved by its sum",
    value: TIES[0]!,
    options: TIES,
  }),
  start: pitch({
    group: "Pitch",
    label: "Standpoint",
    help: "The first note. Nothing is folded into range: a line that leaves the viola (48–91) stops the sketch with an error",
    value: 76.5,
    min: "C3",
    max: "C6",
    step: 0.5,
  }),
  pulse: number({
    group: "Time",
    label: "Pulse",
    help: "The one time between, in atoms of the family: every note lasts this long, and the last note three times this",
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

/** Time betweens the last note is held (it has no next onset to last to). */
const LAST = 3;

interface Kind {
  between: number;
  count: number;
}

/**
 * The kinds of a set: each between once, with how many times the set holds it. In the order they
 * join the draw: the most first; equal counts, the narrowest first, then the lower.
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
 * Spends the reserve: for each draw, the kind taken (its place in `kinds`).
 * A round takes each kind that has the most left once, cyclically in the kinds' order, from the
 * first of them after `from`: the kind that started the round before (shift) or the kind drawn
 * last.
 */
function spend(kinds: Kind[], shift: boolean): number[] {
  const n = kinds.length;
  const left = kinds.map((k) => k.count);
  const out: number[] = [];
  let started = -1;
  let last = -1;
  let queue: number[] = [];
  while (left.some((c) => c > 0)) {
    if (queue.length === 0) {
      const most = Math.max(...left);
      const tied = left.flatMap((c, i) => (c === most ? [i] : []));
      const from = shift ? started : last;
      const after = (i: number) => (((i - from - 1) % n) + n) % n;
      queue = [...tied].sort((a, b) => after(a) - after(b));
      started = queue[0]!;
    }
    const k = queue.shift()!;
    left[k]!--;
    last = k;
    out.push(k);
  }
  return out;
}

export function score(v: Values<typeof knobs>) {
  const kinds = kindsOf(v.set);
  const draws = spend(kinds, v.ties === TIES[0]);
  const line = [v.start];
  for (const d of draws) line.push(line.at(-1)! + kinds[d]!.between);
  const [lo, hi] = [Math.min(...line), Math.max(...line)];
  if (lo < VIOLA.range[0] || hi > VIOLA.range[1])
    throw new Error(
      `Standpoint: the line walks from ${lo} to ${hi}, outside the viola's ${VIOLA.range[0]}–${VIOLA.range[1]}; move the Standpoint or change the Set`,
    );

  const step = v.pulse * atomOf(familyOf(v.family));
  const events = line.map((m, i) => note(i * step, (i < draws.length ? 1 : LAST) * step, m));
  const end = (draws.length + LAST) * step;
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

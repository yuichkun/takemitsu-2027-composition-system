// antara, the vertical and the horizontal line, A (time): the time between opens from 0.
//
// Ten winds and brass strike a chord again and again. One strike is one group: the players come in
// one after another, the betweens between them (in atoms) drawn from a time set by a rule. The set
// starts as all 0 (everyone at once: a chord) and opens one atom at a time, one member after
// another, until it reaches the set it opens to. A between of 0 is the vertical line itself, so the
// chord cracks here and there, rolls, and spreads into a line passed from player to player. Who
// comes first turns round by one player at every strike, so the line's order keeps changing.
//
// This is the one sketch that uses 0 as a time between (not decided in the principles yet: tried
// here). Card: README.md.

import { betweenSet, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf } from "../../../between.ts";
import {
  A_CHORD,
  assign,
  note,
  part,
  scoreOf,
  stack,
  stream,
  TICKS,
  type Player,
} from "../common.ts";

export const knobs = {
  chord: betweenSet({
    group: "Chord",
    label: "Chord",
    help: "The betweens the chord is stacked from, bottom up, again and again (semitones, .5 for a quarter tone)",
    value: A_CHORD,
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  anchor: pitch({
    group: "Chord",
    label: "Anchor",
    help: "The bottom of the stack",
    value: "C3",
    min: "C2",
    max: "C5",
    step: 0.5,
  }),
  opens: betweenSet({
    group: "Time",
    label: "Opens to",
    help: "The time set at the end, in 16ths. It starts with as many 0s, and one member grows by one atom at each stage",
    value: "2 3 3 4",
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  perStage: number({
    group: "Time",
    label: "Strikes per stage",
    help: "How many strikes each state of the set is heard for",
    value: 1,
    min: 1,
    max: 4,
    step: 1,
  }),
  rests: betweenSet({
    group: "Time",
    label: "Rests",
    help: "Silence after each strike, in 16ths, taken in turn",
    value: "6 8",
    min: 1,
    max: 32,
    step: 1,
    unit: "atoms",
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 76,
    min: 40,
    max: 140,
    step: 2,
    unit: "bpm",
  }),
};

// Low to high: the order the strike turns round.
const PLAYERS: Player[] = [
  { id: "tba", instrument: "tuba", range: [29, 53], grids: [0, 1] },
  { id: "bsn", instrument: "bassoon", range: [36, 62], grids: [0, 1] },
  { id: "bcl", instrument: "bass-clarinet", range: [38, 65], grids: [0, 1] },
  { id: "tbn", instrument: "trombone", range: [43, 67], grids: [0, 1] },
  {
    id: "hn2",
    instrument: "horn",
    name: "Horn 2",
    abbreviation: "Hn. 2",
    range: [45, 69],
    grids: [0, 1],
  },
  {
    id: "hn1",
    instrument: "horn",
    name: "Horn 1",
    abbreviation: "Hn. 1",
    range: [50, 74],
    grids: [0, 1],
  },
  { id: "cl", instrument: "clarinet", range: [55, 84], grids: [0, 1] },
  { id: "tpt", instrument: "trumpet", range: [58, 80], grids: [0, 1] },
  { id: "ob", instrument: "oboe", range: [62, 86], grids: [0, 1] },
  { id: "fl", instrument: "flute", range: [67, 91], grids: [0, 1] },
];
// Score order: winds, then brass.
const SCORE_ORDER = ["fl", "ob", "cl", "bcl", "bsn", "hn1", "hn2", "tpt", "tbn", "tba"];

/** The states of the time set: all 0, then one member one atom wider at a time, round and round. */
function states(target: number[]): number[][] {
  const now = target.map(() => 0);
  const out = [[...now]];
  let i = 0;
  while (now.some((x, k) => x < target[k]!)) {
    while (now[i]! >= target[i]!) i = (i + 1) % now.length;
    now[i]!++;
    out.push([...now]);
    i = (i + 1) % now.length;
  }
  return out;
}

export function score(v: Values<typeof knobs>) {
  const atom = atomOf(2);
  const tones = assign(stack(v.anchor, v.chord, PLAYERS.length), PLAYERS);
  const events = PLAYERS.map(() => [] as ReturnType<typeof note>[]);
  const rest = stream(v.rests, "shift each time", 1);
  const plan = states([...v.opens].sort((a, b) => a - b));
  // The last state is heard a little longer, so the line can be heard as a line.
  const strikes = [
    ...plan.flatMap((s) => Array.from({ length: v.perStage }, () => s)),
    plan.at(-1)!,
  ];
  let t = 0;
  strikes.forEach((set, j) => {
    const next = stream(
      [...set].sort((a, b) => a - b),
      "combinations",
      2,
    );
    const order = PLAYERS.map((_, k) => (k + j) % PLAYERS.length);
    order.forEach((i, k) => {
      if (k > 0) t += next() * atom;
      const midi = tones[i];
      if (midi === undefined) return;
      const accent = k === 0 ? ["accent" as const] : [];
      events[i]!.push(note(t, atom, midi, { articulations: ["staccato", ...accent] }));
    });
    t += atom + rest() * atom;
  });
  const bars = Math.ceil(t / (4 * TICKS));
  const parts = SCORE_ORDER.map((id) => {
    const i = PLAYERS.findIndex((p) => p.id === id);
    return part(PLAYERS[i]!, events[i]!, [{ at: 0, level: 4.5 }]);
  });
  return scoreOf("antara · A · the time between opens from 0", bars, v.tempo, parts);
}

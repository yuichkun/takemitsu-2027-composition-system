// antara, the vertical and the horizontal line, A (time): one by one, they leave.
//
// Ten brass strike a chord again and again. Each time round, one more player leaves the chord and
// sounds after it instead: the first to leave one lag later than the chord, the next one lag later
// again, and so on, the lags drawn from a set in turn. So the chord thins while the line behind it
// grows, until nobody is left in the chord and the ten sound one after another. Who leaves first is
// a rule: from the outside in (the top, the bottom, the next from the top...), from the top down, or
// from the bottom up.
//
// The chord is the Chord set's betweens stacked on the anchor, handed to the brass low to high.
// Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
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
  lags: betweenSet({
    group: "Time",
    label: "Lags",
    help: "How far behind the one before it each leaving player sounds, in 16ths, taken in turn",
    value: "2 3 5",
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  rests: betweenSet({
    group: "Time",
    label: "Rests",
    help: "Silence after the last player of each round before the chord comes again, in 16ths, taken in turn",
    value: "6 8",
    min: 1,
    max: 32,
    step: 1,
    unit: "atoms",
  }),
  first: choice({
    group: "Time",
    label: "Who leaves first",
    help: "from the outside: the top, the bottom, the next from the top, the next from the bottom… · from the top · from the bottom",
    value: "from the outside",
    options: ["from the outside", "from the top", "from the bottom"],
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 66,
    min: 40,
    max: 140,
    step: 2,
    unit: "bpm",
  }),
};

// Top down, in score order.
const PLAYERS: Player[] = [1, 2, 3, 4]
  .map((n): Player => ({
    id: `hn${n}`,
    instrument: "horn",
    name: `Horn ${n}`,
    abbreviation: `Hn. ${n}`,
    range: n <= 2 ? [53, 74] : [45, 67],
    grids: [0, 1],
  }))
  .concat(
    [1, 2, 3].map((n): Player => ({
      id: `tpt${n}`,
      instrument: "trumpet",
      name: `Trumpet ${n}`,
      abbreviation: `Tpt. ${n}`,
      range: [58, 81],
      grids: [0, 1],
    })),
    [1, 2, 3].map((n): Player => ({
      id: `tbn${n}`,
      instrument: "trombone",
      name: `Trombone ${n}`,
      abbreviation: `Tbn. ${n}`,
      range: n === 3 ? [40, 58] : [45, 67],
      grids: [0, 1],
    })),
  );

export function score(v: Values<typeof knobs>) {
  const atom = atomOf(2);
  const tones = assign(stack(v.anchor, v.chord, PLAYERS.length), PLAYERS);
  const playing = PLAYERS.map((_, i) => i).filter((i) => tones[i] !== undefined);
  // The order of leaving, from the chord's pitches.
  const low = [...playing].sort((a, b) => tones[a]! - tones[b]!);
  const leaving =
    v.first === "from the top"
      ? [...low].reverse()
      : v.first === "from the bottom"
        ? low
        : low.map((_, k) => (k % 2 === 0 ? low[low.length - 1 - k / 2]! : low[(k - 1) / 2]!));
  const lag = stream(v.lags, "shift each time", 1);
  const rest = stream(v.rests, "shift each time", 1);
  const gaps: number[] = []; // each leaver's lag, fixed when it leaves
  const events = PLAYERS.map(() => [] as ReturnType<typeof note>[]);
  let t = 0;
  // Round r: r players have left. The last round has everyone in the line; then one more to hear it.
  const rounds = leaving.length + 1;
  for (let r = 0; r < rounds; r++) {
    const gone = leaving.slice(0, Math.min(r, leaving.length - 1));
    if (r > 0 && r <= leaving.length - 1) gaps.push(lag() * atom);
    const stay = playing.filter((i) => !gone.includes(i));
    for (const i of stay)
      events[i]!.push(note(t, 2 * atom, tones[i]!, { articulations: ["accent"] }));
    let at = t;
    gone.forEach((i, k) => {
      at += gaps[k]!;
      events[i]!.push(note(at, 2 * atom, tones[i]!));
    });
    t = at + 2 * atom + rest() * atom;
  }
  const bars = Math.ceil(t / (4 * TICKS));
  const parts = PLAYERS.map((p, i) => part(p, events[i]!, [{ at: 0, level: 4 }]));
  return scoreOf("antara · A · one by one, they leave", bars, v.tempo, parts);
}

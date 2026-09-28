// antara palette, A (pitch): two standpoints on one line of betweens.
//
// A line is a standpoint plus the betweens a rule draws from a set. Here one line of drawn groups is
// played by two violas at once, on exactly the same onsets; the only difference between them is
// where each one stands. Each group is a head and one onset per between of the group.
//
// The home voice goes back to the standpoint (the anchor) at every head, then adds the group's
// betweens in turn: its standpoint never moves. The walker never goes back: at every head it sounds
// its previous pitch again (a step of 0), then adds the same betweens: its standpoint moves by each
// group's sum. Inside a group the two voices move by the same betweens, so the vertical between
// them holds; at each head the home voice jumps back while the walker stays, so the vertical
// changes. The vertical is the walker's standpoint itself: the sum of every group before.
//
// The rule is combinations: every group of k betweens of the set, in dictionary order of the sorted
// set, each group ascending. The line plays one round of them, then the same groups in reverse
// order, then a closing head. When the set sums to 0 every between is used equally often in a
// round, so the walker comes back and the two meet on one pitch at the middle and at the end. When
// it does not, the walker does not come back; nothing corrects it.
//
// The time between onsets is taken in turn from a set of time betweens, smallest first, laid over
// the groups without knowing where they begin. Both voices at one level, no accents: the heads are
// heard only through the pitch relation.
// Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

export const knobs = {
  set: betweenSet({
    group: "Pitch",
    label: "Set",
    help: "The betweens both violas add (semitones, .5 for a quarter tone, − for down). The card shows their sum: with 0 the walker comes back; otherwise it does not",
    value: "-5.5 -1 2.5 4",
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
    anchor: "anchor",
  }),
  size: number({
    group: "Pitch",
    label: "Group size",
    help: "How many betweens a group takes (combinations of the set, in dictionary order). A group is a head and one onset per between",
    value: 2,
    min: 1,
    max: 6,
    step: 1,
  }),
  anchor: pitch({
    group: "Pitch",
    label: "Anchor",
    help: "The standpoint: where both start, where the home viola goes back at every head, and where a walker on a set summing to 0 ends",
    value: 63,
    min: "C3",
    max: "C6",
    step: 0.5,
  }),
  rhythm: betweenSet({
    group: "Time",
    label: "Rhythm",
    help: "The time between one onset and the next, in atoms of the family, taken in turn smallest first (a set is always kept smallest first), across the groups",
    value: "3 4 4 5",
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the rhythm counts in",
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

const VIOLA: [number, number] = [48, 91];
const viola = (id: string, n: number): Player => ({
  id,
  instrument: "violas",
  name: `Viola solo ${n}`,
  abbreviation: `Va. ${n}`,
  players: 1,
  range: VIOLA,
  grids: [0, 1],
});
const HOME = viola("va1", 1);
const WALKER = viola("va2", 2);

interface Onset {
  at: number;
  home: number;
  walker: number;
}

export function score(v: Values<typeof knobs>) {
  const atom = atomOf(familyOf(v.family));
  const gap = stream(v.rhythm, "in order", 1);
  const bar = 4 * TICKS;

  // One round of the combinations, then the same groups in reverse order.
  const draw = drawer(v.set, "combinations", v.size, "ascending");
  const key = (g: number[]) => g.join(",");
  const round: number[][] = [];
  for (let g = draw(); round.length === 0 || key(g) !== key(round[0]!); g = draw()) round.push(g);
  const groups = [...round, ...[...round].reverse()];

  const onsets: Onset[] = [];
  let t = 0;
  let walker = v.anchor;
  for (const group of groups) {
    // The head: the home voice back at the anchor, the walker where it is.
    let home = v.anchor;
    onsets.push({ at: t, home, walker });
    for (const b of group) {
      t += gap() * atom;
      home += b;
      walker += b;
      onsets.push({ at: t, home, walker });
    }
    t += gap() * atom;
  }
  // The closing head.
  onsets.push({ at: t, home: v.anchor, walker });
  const end = Math.ceil((t + bar) / bar) * bar;

  for (const o of onsets)
    for (const m of [o.home, o.walker])
      if (m < VIOLA[0] || m > VIOLA[1])
        throw new Error(
          `Anchor: a viola reaches ${m}, outside the viola (${VIOLA[0]}–${VIOLA[1]}); move the Anchor or change the Set`,
        );

  // mp throughout; the closing head holds and fades.
  const dynamics = curve([
    { at: 0, level: 4 },
    { at: t, level: 4, ramp: true },
    { at: end, level: 0 },
  ]);
  const line = (p: Player, pick: (o: Onset) => number) =>
    part(
      p,
      onsets.map((o, i) => note(o.at, (onsets[i + 1]?.at ?? end) - o.at, pick(o))),
      dynamics,
    );
  return scoreOf("antara · palette A · two standpoints", end / bar, v.tempo, [
    line(HOME, (o) => o.home),
    line(WALKER, (o) => o.walker),
  ]);
}

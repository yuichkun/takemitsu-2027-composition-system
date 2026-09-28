// antara palette, A (time): from the head, or from the note before.
//
// A line of onsets is a standpoint plus the time betweens a rule draws from a set. In time there
// are two places to add from. Two woodblocks share one set, one rule and one head (the first onset
// of each drawn group); the only difference between them is where they stand while adding.
//
// The walker (high block) adds each between to the note before, as the principle does: its onsets
// are the head plus the running sums of the group, so the betweens it sounds are the group's
// betweens themselves. The stander (low block) stays on the head and adds every between to the
// head: its onsets are the head plus each between, placed as a position. The same numbers are
// strides for one player and positions for the other.
//
// So the stander sounds the differences of the group (b1, b2 - b1, b3 - b2, ...), finishes at the
// head plus its largest between, and is silent until the next head: a rest as long as the rest of
// the group, which nobody chose. The next head is where the walker's sum lands; both strike it.
// The two always meet on the head and on the first step (both add b1 to the head), and meet again
// inside a group only where a position equals a running sum (for a group of three, b3 = b1 + b2).
//
// By default the rule is combinations: every distinct group of three betweens, in dictionary order,
// each group ascending, round and round for a number of cycles. After the last group the walker's
// sum is a final head, struck by both. Every stroke is one atom long, at p, without accents: the
// two blocks differ only in when. Card: README.md.

import type { NoteEvent, Part } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, familyOf, FAMILY_OPTIONS, RULES } from "../../../between.ts";
import { scoreOf, TICKS, time } from "../../common.ts";

export const knobs = {
  set: betweenSet({
    group: "Time",
    label: "Set",
    help: "The time betweens both players add, in atoms of the family. The high block adds them to the note before (strides); the low block adds them to the head (positions)",
    value: "1 2 3 4 5",
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  size: number({
    group: "Time",
    label: "Group size",
    help: "How many betweens a group holds, with the rule combinations (the other rules take the whole set as one group)",
    value: 3,
    min: 1,
    max: 8,
    step: 1,
  }),
  rule: choice({
    group: "Time",
    label: "Rule",
    help: "How the groups are drawn from the set. Combinations: every distinct group, in dictionary order, each ascending; shift each time: the whole set, starting one later each group; in order: the whole set every time",
    value: "combinations",
    options: [...RULES],
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the betweens count in",
    value: FAMILY_OPTIONS[0]!,
    options: FAMILY_OPTIONS,
  }),
  cycles: number({
    group: "Form",
    label: "Cycles",
    help: "How many times the rule goes round all its groups. After the last group, both strike the final head",
    value: 2,
    min: 1,
    max: 6,
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

/** The most groups the sketch will write. */
const MOST_GROUPS = 400;

export function score(v: Values<typeof knobs>) {
  const set = [...v.set];
  if (set.length === 0 || set.some((n) => !Number.isInteger(n) || n < 1))
    throw new Error("Set: time betweens are whole numbers of atoms, 1 or more");
  const atom = atomOf(familyOf(v.family));

  // One cycle: the rule's groups until the first comes round again.
  const draw = drawer(set, v.rule, v.size, "ascending");
  const first = draw();
  const cycle = [first];
  for (let g = draw(); g.join(" ") !== first.join(" "); g = draw()) {
    cycle.push(g);
    if (cycle.length * v.cycles > MOST_GROUPS)
      throw new Error(`Set: more than ${MOST_GROUPS} groups; take a smaller set or group size`);
  }

  // Onsets in ticks. A tick given twice to one player sounds once.
  const walker = new Set<number>();
  const stander = new Set<number>();
  let head = 0;
  for (let c = 0; c < v.cycles; c++) {
    for (const group of cycle) {
      walker.add(head);
      stander.add(head);
      let sum = 0;
      for (const b of group) {
        // The stander stays on the head: each between is a position from it.
        stander.add(head + b * atom);
        // The walker adds each between to the note before.
        sum += b;
        walker.add(head + sum * atom);
      }
      // The walker's sum is the next head.
      head += sum * atom;
    }
  }
  // After the last group the walker's sum is the final head; the stander strikes it too.
  stander.add(head);

  const bar = 4 * TICKS;
  const end = Math.ceil((head + atom) / bar) * bar;
  const partOf = (
    id: string,
    instrument: string,
    name: string,
    abbreviation: string,
    ticks: Set<number>,
  ): Part => {
    const at = [...ticks].sort((a, b) => a - b);
    const events: NoteEvent[] = at.map((t, j) => ({
      at: time(t),
      dur: time(Math.min(atom, (at[j + 1] ?? end) - t)),
    }));
    return { id, instrument, name, abbreviation, dynamics: [{ at: 0, level: 3 }], events };
  };
  return scoreOf(
    "antara · palette A · from the head, or from the note before",
    end / bar,
    v.tempo,
    [
      partOf("wbh", "woodblock-high", "Woodblock (high)", "W. B. h.", walker),
      partOf("wbl", "woodblock-low", "Woodblock (low)", "W. B. l.", stander),
    ],
  );
}

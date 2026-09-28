// antara palette, A (time): a rest is the wait to change family.
//
// One line of onsets, in groups. A rule draws each group from a set of time betweens (every
// combination of k betweens, in dictionary order); the group starts on its head and adds its
// betweens one after another, each counted in atoms of the family the group stands in
// (2: 16ths, 3: triplet 8ths, 5: quintuplet 16ths). Every onset of the group is sounded: the head
// and one onset after each between.
//
// The line changes family at every group, in a fixed order round and round. The principle lets a
// line change family only where the families' grids meet, on a beat. So when a group ends off the
// beat, the line has to wait for the next beat before the next group may start in its new family.
// That wait is the rest. Nobody chooses it: it is what is left of the group's sum up to the next
// whole beat, (atoms in a beat - sum mod atoms in a beat) mod atoms in a beat, atoms of the family
// the group was in (4 atoms in a beat in the family of 2, 3 in the family of 3, 5 in the family
// of 5). The same group has a different wait in each family. When the sum fills whole beats the
// wait is 0: the group's last onset falls on the beat, and the next group's head falls on it too
// (a time between of 0: two woodblocks at once, the old family's and the new one's).
//
// Every head is on a beat, and every beat where the family changes is a head. It probes a question
// docs/antara/sound.md leaves open, in its barest form: whether the places where a line changes
// family stand out too much as beats. The causality is the reverse of palette
// a/time-change-where-it-lands (there, landing on a beat makes the family change, and nothing
// waits; here, changing the family makes the line wait).
//
// Three woodblocks, one per family (the smallest atom on the highest block: 5 high, 2 medium,
// 3 low), so that the family can be heard even where nothing waits. Each stroke lasts one atom of
// its family; all at p, no accents. After the last group and its wait the line stops; the score
// ends at the next bar line.
// Card: README.md.

import type { NoteEvent, Part } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, familiesOf, type Family } from "../../../between.ts";
import { scoreOf, TICKS, time } from "../../common.ts";

const ORDERS = ["2 3 5", "2 5 3", "3 2 5", "3 5 2", "5 2 3", "5 3 2"];

export const knobs = {
  set: betweenSet({
    group: "Time",
    label: "Set",
    help: "The time betweens the groups are drawn from, in atoms of the family each group stands in",
    value: "1 2 3 4 5",
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  size: number({
    group: "Time",
    label: "Group size",
    help: "How many betweens a group holds. The rule takes every combination of this many, in dictionary order, round and round; a group sounds its head and one onset after each between",
    value: 2,
    min: 1,
    max: 6,
    step: 1,
  }),
  order: choice({
    group: "Time",
    label: "Family order",
    help: "The families the line goes through, one group each, round and round (2: 16ths, 3: triplet 8ths, 5: quintuplet 16ths). The line may change only on a beat, so after a group it waits for the next beat",
    value: ORDERS[0]!,
    options: ORDERS,
  }),
  groups: number({
    group: "Form",
    label: "Groups",
    help: "How many groups. The line stops after the last one and its wait; the score ends at the next bar line",
    value: 30,
    min: 1,
    max: 60,
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

interface Block {
  id: string;
  instrument: string;
  name: string;
  abbreviation: string;
}

// The smallest atom on the highest block.
const BLOCKS: Record<Family, Block> = {
  5: {
    id: "wbh",
    instrument: "woodblock-high",
    name: "Woodblock (high)",
    abbreviation: "W. B. h.",
  },
  2: {
    id: "wbm",
    instrument: "woodblock-medium",
    name: "Woodblock (medium)",
    abbreviation: "W. B. m.",
  },
  3: { id: "wbl", instrument: "woodblock-low", name: "Woodblock (low)", abbreviation: "W. B. l." },
};

export function score(v: Values<typeof knobs>) {
  const set = [...v.set];
  if (set.length === 0 || set.some((n) => !Number.isInteger(n) || n < 1))
    throw new Error("Set: time betweens are whole numbers of atoms, 1 or more");
  const order = familiesOf("Family order", v.order);
  const draw = drawer(set, "combinations", v.size, "ascending");

  const events: Record<Family, NoteEvent[]> = { 2: [], 3: [], 5: [] };
  let head = 0;
  let last = 0;
  for (let g = 0; g < v.groups; g++) {
    const family = order[g % order.length]!;
    const atom = atomOf(family);
    const stroke = (at: number) => {
      events[family].push({ at: time(at), dur: time(atom) });
      last = Math.max(last, at + atom);
    };
    let at = head;
    stroke(at);
    for (const between of draw()) {
      at += between * atom;
      stroke(at);
    }
    // The family may change only where the grids meet: the next group waits for the next beat.
    const wait = (TICKS - (at % TICKS)) % TICKS;
    head = at + wait;
  }

  const bar = 4 * TICKS;
  const end = Math.ceil(Math.max(head, last) / bar) * bar;
  // Score order, top down: high, medium, low.
  const parts: Part[] = ([5, 2, 3] as Family[])
    .filter((f) => events[f].length > 0)
    .map((f) => ({ ...BLOCKS[f], dynamics: [{ at: 0, level: 3 }], events: events[f] }));
  return scoreOf(
    "antara · palette A · a rest is the wait to change family",
    end / bar,
    v.tempo,
    parts,
  );
}

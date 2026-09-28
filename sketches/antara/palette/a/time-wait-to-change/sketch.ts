// antara palette, A (time): a rest is the wait to change family.
//
// One line, in groups. A rule draws each group from a set of time betweens (every combination of
// k betweens); the group starts on its head and adds its betweens one after another, each counted
// in atoms of the family the group stands in (2: 16ths, 3: triplet 8ths, 5: quintuplet 16ths).
// Every between is sounded: a note starts at each onset and lasts its between, so the group sounds
// without a gap from its head to its end (the head plus the group's sum).
//
// The line changes family at every group, in a fixed order round and round. The principle lets a
// line change family only where the families' grids meet, on a beat. So when a group ends off the
// beat, the line has to wait for the next beat before the next group may start in its new family.
// That wait is the rest, and the only silence the line has. Nobody chooses it: it is what is left
// of the group's sum up to the next whole beat, (atoms in a beat - sum mod atoms in a beat) mod
// atoms in a beat, atoms of the family the group was in (4 atoms in a beat in the family of 2, 3
// in the family of 3, 5 in the family of 5). The same group has a different wait in each family.
// When the sum fills whole beats the wait is 0: the next group's head starts as the group ends,
// with no rest, and only the colour tells that the family changed.
//
// The groups are taken from the list of combinations (dictionary order) with a stride: the
// smallest stride above 1 that has no common factor with the number of groups, so that every group
// comes once in a round, and that is not the number of groups minus 1 (strides 1 and n - 1 walk the
// list forwards or backwards, and the sums would grow or shrink through each round).
//
// Every head is on a beat, and every beat where the family changes is a head. It probes a question
// docs/antara/sound.md leaves open, in its barest form: whether the places where a line changes
// family stand out too much as beats. The causality is the reverse of palette
// a/time-change-where-it-lands (there, landing on a beat makes the family change, and nothing
// waits; here, changing the family makes the line wait).
//
// Three woodwinds on one pitch, one per family (flute = 5, oboe = 2, clarinet = 3: the smallest
// atom at the top of the score), so that the family can be heard even where nothing waits. The
// pitch is the middle of the range the three share. Every note tongued, all at p, no accents.
// After the last group and its wait the line stops; the score ends at the next bar line.
// Card: README.md.

import type { NoteEvent, Part } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, familiesOf, type Family } from "../../../between.ts";
import { note, scoreOf, TICKS } from "../../common.ts";

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
    help: "How many betweens a group holds. The rule takes every combination of this many, once each round, with a stride through the dictionary order; a group sounds one note per between, each lasting its between",
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

interface Voice {
  id: string;
  instrument: string;
  name: string;
  abbreviation: string;
}

// The smallest atom at the top of the score.
const VOICES: Record<Family, Voice> = {
  5: { id: "fl", instrument: "flute", name: "Flute", abbreviation: "Fl." },
  2: { id: "ob", instrument: "oboe", name: "Oboe", abbreviation: "Ob." },
  3: { id: "cl", instrument: "clarinet", name: "Clarinet", abbreviation: "Cl." },
};

// The one pitch: the middle of the range the three share (flute 59–98, oboe 58–93, clarinet
// 50–94 in src/instruments/catalog.ts, so 59–93).
const PITCH = (59 + 93) / 2;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Every group the rule draws, once each, in dictionary order. */
function groupsOf(set: number[], size: number): number[][] {
  const draw = drawer(set, "combinations", size, "ascending");
  const first = draw();
  const out = [first];
  for (let g = draw(); g.join(" ") !== first.join(" "); g = draw()) out.push(g);
  return out;
}

/** The smallest stride above 1 that meets every group once a round and is not n - 1 (else 1). */
function strideOf(n: number): number {
  for (let s = 2; s < n - 1; s++) if (gcd(s, n) === 1) return s;
  return 1;
}

export function score(v: Values<typeof knobs>) {
  const set = [...v.set];
  if (set.length === 0 || set.some((n) => !Number.isInteger(n) || n < 1))
    throw new Error("Set: time betweens are whole numbers of atoms, 1 or more");
  const order = familiesOf("Family order", v.order);
  const list = groupsOf(set, v.size);
  const stride = strideOf(list.length);

  const events: Record<Family, NoteEvent[]> = { 2: [], 3: [], 5: [] };
  let head = 0;
  for (let g = 0; g < v.groups; g++) {
    const family = order[g % order.length]!;
    const atom = atomOf(family);
    let at = head;
    for (const between of list[(g * stride) % list.length]!) {
      events[family].push(note(at, between * atom, PITCH));
      at += between * atom;
    }
    // The group ends where its last note stops. The family may change only where the grids
    // meet: the next group waits for the next beat, and the wait is silent.
    const wait = (TICKS - (at % TICKS)) % TICKS;
    head = at + wait;
  }

  const bar = 4 * TICKS;
  const end = Math.ceil(head / bar) * bar;
  // Score order, top down: flute, oboe, clarinet.
  const parts: Part[] = ([5, 2, 3] as Family[])
    .filter((f) => events[f].length > 0)
    .map((f) => ({ ...VOICES[f], dynamics: [{ at: 0, level: 3 }], events: events[f] }));
  return scoreOf(
    "antara · palette A · a rest is the wait to change family",
    end / bar,
    v.tempo,
    parts,
  );
}

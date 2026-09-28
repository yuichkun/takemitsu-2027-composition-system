// antara palette, A (time): the unsounded betweens.
//
// A line of onsets is its origin plus the time betweens a rule draws from a set, added one after
// another. Here a rest is one of those betweens left unsounded. The addition never stops: every
// term keeps its place, and a term whose between is unsounded simply does not sound. A sounded
// term is one note lasting exactly its own between, so it ends where the next term stands, sounded
// or not, and every rest begins at the place of an unsounded term. Where rests come between two
// sounded onsets, the between heard from one onset to the next is a sounded between plus the
// unsounded ones after it: a between the set does not hold, defined where no term sounds.
//
// The set and the rule never change: every combination of two betweens (by default), in dictionary
// order, each group from small to large; one round is every group once, and the round comes again
// with no gap. What changes, and only where the rule starts its round again, is which betweens are
// unsounded: none in the first round, then the largest, then the two largest, and so on, one more
// each round, until only the smallest sounds. The sketch ends where the last sounded note ends; the
// rest of that round is not played out.
//
// One clarinet on one pitch, every note tongued, p throughout, no accents, so that only the
// betweens and the rests are heard. The betweens count triplet eighths (the family of 3).
//
// That a rest is an unsounded between is one proposal for what docs/antara/sound.md leaves open
// (rests, the time that does not sound); the other reading, a between measured from the end of a
// note to the next onset, is not tried here.
// Card: README.md.

import type { NoteEvent, Part } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer } from "../../../between.ts";
import { note, scoreOf, TICKS } from "../../common.ts";

const FIRST = ["largest", "smallest"];

export const knobs = {
  set: betweenSet({
    group: "Time",
    label: "Set",
    help: "The time betweens, in triplet eighths (atoms of the family of 3). Each size is one stage: one more size is left unsounded each round",
    value: "1 2 4 5 7",
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  size: number({
    group: "Time",
    label: "Group size",
    help: "The rule draws every combination of this many betweens, in dictionary order, each group from small to large. One round is every group once",
    value: 2,
    min: 1,
    max: 6,
    step: 1,
  }),
  first: choice({
    group: "Rests",
    label: "Silent first",
    help: "Which sizes stop sounding first, one more each round: the largest (the first rest is the longest single between) or the smallest",
    value: FIRST[0]!,
    options: FIRST,
  }),
  pitch: pitch({
    group: "Sound",
    label: "Pitch",
    help: "The clarinet's one pitch (sounding)",
    value: "E4",
    min: "D3",
    max: "A#6",
    step: 0.5,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute (an atom is a third of a beat)",
    value: 120,
    min: 60,
    max: 160,
    step: 2,
    unit: "bpm",
  }),
};

/** One round of the rule: every group it draws, once each, laid end to end. */
function roundOf(set: number[], size: number): number[] {
  const draw = drawer(set, "combinations", size, "ascending");
  const first = draw();
  const out = [...first];
  // The groups are all different, so the round is over when the first one comes again.
  for (let g = draw(); g.join(" ") !== first.join(" "); g = draw()) out.push(...g);
  return out;
}

export function score(v: Values<typeof knobs>) {
  const atom = atomOf(3);
  const round = roundOf([...v.set], v.size);
  // The sizes in the order they stop sounding; round r leaves the first r of them unsounded.
  const sizes = [...new Set(v.set)].sort((a, b) => (v.first === FIRST[0] ? b - a : a - b));

  const events: NoteEvent[] = [];
  let at = 0;
  let end = 0;
  sizes.forEach((_, r) => {
    const unsounded = new Set(sizes.slice(0, r));
    for (const between of round) {
      if (!unsounded.has(between)) {
        events.push(note(at * atom, between * atom, v.pitch));
        end = at + between;
      }
      at += between;
    }
  });

  const part: Part = {
    id: "cl",
    instrument: "clarinet",
    name: "Clarinet",
    abbreviation: "Cl.",
    dynamics: [{ at: 0, level: 3 }],
    events,
  };
  const bar = 4 * TICKS;
  return scoreOf(
    "antara · palette A · the unsounded betweens",
    Math.max(1, Math.ceil((end * atom) / bar)),
    v.tempo,
    [part],
  );
}

// antara palette, A (time): the rest is the cut below.
//
// A line of onsets is its origin plus the time betweens a rule draws from a set, added one after
// another; each place the addition reaches is a term, and each term owns the between from it to
// the next term. Here every term sounds, and its between is split in two by the set itself. Read
// the set's sizes from small to large: below each size stands the next smaller size, and between
// the two is a cut (their difference). A term sounds for the next smaller size of the set than its
// own between, and is silent for the cut: the rest is the cut below the between's size in the set,
// not the between itself. The smallest size has nothing below it and so no cut: its term sounds
// until the next onset. How long a between sounds is named by its neighbour in the set, not by its
// own size: two betweens close in size can sound very differently.
//
// The line runs in two parts with no break between them (the addition goes straight on). The
// second part's set is the first with one size added, written at the end and read by the same rule
// (its rotation starts afresh). The added size falls into one of the cuts and splits it in two:
// only the size just above it changes how it sounds (it now sounds the added size and rests the
// smaller piece of the cut); every other size sounds as before, and no between changes its length.
//
// The rule reads the set in the order written, each pass starting one place later. Each part reads
// its set once from every starting place (as many passes as the set has betweens), so every size is
// heard equally often. The last term owns no between; it sounds the smallest size.
//
// One oboe on one pitch, p throughout, every note tongued, no accents and no articulation marks:
// the lengths are written as durations only, so that nothing but the betweens and the cuts are
// heard. The betweens count quintuplet 16ths (the family of 5).
//
// Rests (the time that does not sound) are left open by docs/antara/sound.md; a rest as the cut
// below a between's size in the set is one reading of it, for 余湖さん to confirm.
// Card: README.md.

import type { NoteEvent, Part } from "../../../../../src/score/types.ts";
import { choice, number, numbersOf, text, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { note, scoreOf, TICKS } from "../../common.ts";

const RULES = ["shift each time", "in order"];

/**
 * The oboe's one pitch (sounding): the middle of its range (58–93), where it sounds the same at p
 * for a fifth of a second and for two seconds. One pitch has no between, so which grid it stands on
 * does not matter here.
 */
const PITCH = 75;

export const knobs = {
  set: text({
    group: "Time",
    label: "Set",
    help: "The time betweens of the first part, in atoms of the family, in the order the rule reads them (whole numbers, 1 or more). Each between sounds the next smaller size of the set and rests the difference; the smallest sounds to the next onset",
    value: "4 11 1 9 3",
  }),
  added: number({
    group: "Time",
    label: "Added size",
    help: "The size the second part adds to the set (written at the end). It splits the cut it falls in: only the size just above it changes how it sounds",
    value: 8,
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  rule: choice({
    group: "Time",
    label: "Rule",
    help: "shift each time: the set in the order written, each pass starting one place later (each part starts afresh). in order: every pass from the first",
    value: RULES[0]!,
    options: RULES,
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the betweens count in",
    value: FAMILY_OPTIONS[2]!,
    options: FAMILY_OPTIONS,
  }),
  before: number({
    group: "Form",
    label: "Passes before",
    help: "How many times the first part reads its set. As many as the set has betweens: every starting place once",
    value: 5,
    min: 1,
    max: 12,
    step: 1,
  }),
  after: number({
    group: "Form",
    label: "Passes after",
    help: "How many times the second part (the set with the added size) reads its set",
    value: 6,
    min: 1,
    max: 12,
    step: 1,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute (an atom of the family of 5 is a fifth of a beat)",
    value: 63,
    min: 40,
    max: 120,
    step: 1,
    unit: "bpm",
  }),
};

/** How long a between sounds: the next smaller size of the set, or all of it if it is the smallest. */
function soundOf(between: number, sizes: number[]): number {
  const below = sizes.filter((s) => s < between);
  return below.length ? Math.max(...below) : between;
}

export function score(v: Values<typeof knobs>) {
  const atom = atomOf(familyOf(v.family));
  const first = numbersOf("Set", v.set);
  if (first.some((n) => !Number.isInteger(n) || n < 1))
    throw new Error("Set: time betweens are whole numbers of atoms, 1 or more");
  const parts = [
    { set: first, passes: v.before },
    { set: [...first, v.added], passes: v.after },
  ];

  // The terms in atoms, added from 0 straight through both parts; each sounds by its part's set.
  const events: NoteEvent[] = [];
  let at = 0;
  for (const { set, passes } of parts) {
    const sizes = [...new Set(set)].sort((a, b) => a - b);
    const draw = drawer(set, v.rule, set.length, "ascending");
    for (let p = 0; p < passes; p++)
      for (const between of draw()) {
        events.push(note(at * atom, soundOf(between, sizes) * atom, PITCH));
        at += between;
      }
  }
  // The last term owns no between: it sounds the smallest size of the last set.
  const last = Math.min(...parts[1]!.set);
  events.push(note(at * atom, last * atom, PITCH));

  const oboe: Part = {
    id: "ob",
    instrument: "oboe",
    name: "Oboe",
    abbreviation: "Ob.",
    dynamics: [{ at: 0, level: 3 }],
    events,
  };
  const bar = 4 * TICKS;
  return scoreOf(
    "antara · palette A · the rest is the cut below",
    Math.ceil(((at + last) * atom) / bar),
    v.tempo,
    [oboe],
  );
}

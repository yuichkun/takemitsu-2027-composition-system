// antara palette, B: a line handed on by the sizes of its betweens.
//
// Uses "the unsounded betweens" (../../a/time-unsounded-betweens): the addition of time betweens
// never stops, every term keeps its place, and a term whose between is unsounded simply does not
// sound. A sounded term is one note lasting exactly its own between. Its logic is copied here, not
// imported.
//
// Here the unsounded betweens are the way one line changes colour. The line is one addition on two
// axes: its terms stand at the sum of the time betweens from the start, and each term's pitch is
// the one before plus the next pitch between. Two colours share it, the winds (two flutes and two
// clarinets in unison) and the strings (Violins I and Violas in unison). Each size of time between
// has an owner, and a term is sounded only by the colour that owns the size of its own between. So
// each colour's part is the method of the A with the other colour's sizes unsounded, and the two
// parts together are the whole line again, with no gap and no overlap. Where a colour skips the
// other's terms, their time betweens and their pitch betweens are added all the same, unsounded:
// heard alone, each colour walks by betweens neither set holds.
//
// Ownership changes only where the rule starts its round again. In the first round the winds own
// every size; then, round by round, one more size is handed to the strings (by default the largest
// first), until the strings own them all. The line is handed from one colour to the other size by
// size. Both colours stay at p throughout, no accents, every note tongued or bowed on its own.
// The betweens count triplet eighths (the family of 3).
// Card: README.md.

import type { NoteEvent } from "../../../../../src/score/types.ts";
import {
  betweenSet,
  choice,
  number,
  numbersOf,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer } from "../../../between.ts";
import { note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

const FIRST = ["largest", "smallest"];

/** Where all four instruments sound (the flutes' lowest note in playback is C4). */
const SHARED: [number, number] = [60, 91];

export const knobs = {
  set: betweenSet({
    group: "Time",
    label: "Set",
    help: "The time betweens of the one line, in triplet eighths (atoms of the family of 3). Drawn as every combination of two, in dictionary order, each pair from small to large; one round is every pair once. Each size is handed from the winds to the strings at a round's start, so there is one round more than there are sizes",
    value: "1 4 5 8",
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  first: choice({
    group: "Time",
    label: "Handed first",
    help: "Which sizes the strings take first, one more each round: the largest (the strings come in with the longest notes) or the smallest",
    value: FIRST[0]!,
    options: FIRST,
  }),
  steps: text({
    group: "Pitch",
    label: "Pitch betweens",
    help: "The pitch betweens of the line, in the order written (semitones, .5 for a quarter tone, minus for down), drawn by shift each time. One is added at every term, sounded or not",
    value: "3.5 -2.5 1 -1.5",
  }),
  start: pitch({
    group: "Pitch",
    label: "Start",
    help: "The pitch of the first term",
    value: "G4",
    min: "C4",
    max: "C6",
    step: 0.5,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute (an atom is a third of a beat)",
    value: 72,
    min: 48,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

/** One round of the rule: every pair it draws, once each, laid end to end. */
function roundOf(set: number[]): number[] {
  const draw = drawer(set, "combinations", 2, "ascending");
  const first = draw();
  const out = [...first];
  // The pairs are all different, so the round is over when the first one comes again.
  for (let g = draw(); g.join(" ") !== first.join(" "); g = draw()) out.push(...g);
  return out;
}

const player = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  players: number,
): Player => ({ id, instrument, name, abbreviation, players, range: SHARED, grids: [0, 1] });

/** The two colours, each two instruments in unison. */
const WINDS: Player[] = [
  player("fl", "flute", "Flutes 1·2", "Fl. 1·2", 2),
  player("cl", "clarinet", "Clarinets 1·2", "Cl. 1·2", 2),
];
const STRINGS: Player[] = [
  player("vn1", "violins-1", "Violins I", "Vn. I", 16),
  player("va", "violas", "Violas", "Va.", 12),
];

export function score(v: Values<typeof knobs>) {
  const set = [...v.set];
  if (set.some((n) => !Number.isInteger(n) || n < 1))
    throw new Error("Set: time betweens are whole numbers of atoms, 1 or more");
  const sizes = [...new Set(set)].sort((a, b) => (v.first === FIRST[0] ? b - a : a - b));
  if (sizes.length < 2) throw new Error("Set: give at least two sizes, so there is a pair to draw");
  const steps = numbersOf("Pitch betweens", v.steps.replaceAll("−", "-"));
  if (steps.some((b) => !Number.isInteger(b * 2)))
    throw new Error("Pitch betweens: semitones on the quarter-tone grid (3.5, -2.5, 1)");

  const atom = atomOf(3);
  const round = roundOf(set);
  const nextStep = stream(steps, "shift each time", 1);

  // The one line: every term, its place, its own between, its pitch and who owns it. Round r hands
  // the first r sizes to the strings.
  const winds: NoteEvent[] = [];
  const strings: NoteEvent[] = [];
  let at = 0;
  let midi = v.start;
  for (let r = 0; r <= sizes.length; r++) {
    const handed = new Set(sizes.slice(0, r));
    for (const between of round) {
      if (midi < SHARED[0] || midi > SHARED[1])
        throw new Error(
          "Pitch betweens: the line leaves C4–G6, where all four instruments sound; change the betweens or the start",
        );
      (handed.has(between) ? strings : winds).push(note(at * atom, between * atom, midi));
      at += between;
      midi += nextStep();
    }
  }

  // Each instrument of a colour plays the colour's notes (its own copies), at p throughout.
  const play = (players: Player[], notes: NoteEvent[]) =>
    players.map((p) =>
      part(
        p,
        notes.map((e) => ({ ...e })),
        [{ at: 0, level: 3 }],
      ),
    );
  const bar = 4 * TICKS;
  return scoreOf(
    "antara · palette B · a line handed on by size",
    Math.ceil((at * atom) / bar),
    v.tempo,
    [...play(WINDS, winds), ...play(STRINGS, strings)],
  );
}

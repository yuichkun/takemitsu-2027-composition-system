// antara palette, A (time): the line of releases.
//
// A line of onsets is an origin plus the time betweens a rule draws from a set, added one after
// another. Here the ends of the notes (the releases) are a second line, made the same way: its own
// origin, its own set, the same rule, added from the start. Note i sounds from the i-th onset to
// the i-th release. Nothing places a rest, a joint or an overlap: each comes out of the difference
// between the two lines, the release of one note minus the onset of the next. Below zero, a rest of
// that length; zero, the next note starts exactly where this one ends (a joint); above zero, the
// two notes sound together for that long, a dyad whose vertical between is the pitch between from
// the one note to the next.
//
// The onsets count 16ths (the family of 2) and the releases triplet eighths (the family of 3), so
// an end can meet the next start only on a beat, where the two grids meet. Both lines use one rule:
// every pair of two betweens, in dictionary order; each round starts one pair later than the round
// before, and reads the inside of each pair the other way from the round before (small to large,
// then large to small). The two lines read the same pair positions together. (With every pair
// small to large, two rounds in a row share five pairs in a row, and the same ten betweens come
// twice back to back in both lines; see the card.) The two sets are such that a round of each
// takes the same time (15 beats), so the lines never run away from each other. The release line's
// origin is not chosen: it is the smallest whole number of triplet eighths that leaves every note
// at least one triplet eighth long.
//
// Three clarinets take the notes in turn (note i goes to clarinet i mod 3 + 1), all p, ord., no
// accents, no slurs, so that one line is heard overlapping itself and breaking off. The pitches
// walk on from a standpoint, never folded. The pitch betweens stand in a ring in order of size; a
// round reads each once, stepping round the ring by a stride that grows by one each round (1, 2,
// 3, 4 for five sizes), and the next round starts one place on from where the last ended. (Read
// "one later each time round", consecutive rounds share four betweens in a row, and the line
// becomes a shape moved by its sum; see the card.)
//
// That the ends of notes form a line of their own, added from the start like the onsets, is a
// reading beyond docs/antara/sound.md (there a time between is the distance between two onsets,
// and rests are still open); it is for 余湖さん to confirm.
// Card: README.md.

import type { NoteEvent, Part } from "../../../../../src/score/types.ts";
import { betweenSet, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer } from "../../../between.ts";
import { note, scoreOf, TICKS } from "../../common.ts";

export const knobs = {
  onsets: betweenSet({
    group: "Onsets",
    label: "Set",
    help: "The betweens from one onset to the next, in 16ths (atoms of the family of 2)",
    value: "2 5 6 7",
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  releases: betweenSet({
    group: "Releases",
    label: "Set",
    help: "The betweens from one release (the end of a note) to the next, in triplet eighths (atoms of the family of 3). A round must take as long as a round of the onsets, or the two lines run away from each other",
    value: "1 3 4 7",
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  pitch: betweenSet({
    group: "Pitch",
    label: "Betweens",
    help: "The pitch betweens from one note to the next (semitones, .5 for a quarter tone). Where two notes overlap, the dyad is one of these",
    value: "-3.5 -2 -0.5 1.5 4",
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
    anchor: "standpoint",
  }),
  standpoint: pitch({
    group: "Pitch",
    label: "Standpoint",
    help: "The first note (sounding). The line walks on from it and is never folded",
    value: 68,
    min: "D3",
    max: "C6",
    step: 0.5,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 72,
    min: 40,
    max: 140,
    step: 2,
    unit: "bpm",
  }),
};

/** How many rounds of the onset rule the line lasts (the rule comes round after six). */
const ROUNDS = 5;
/** The clarinets that take the notes in turn. */
const PLAYERS = 3;
/** Sounding range of the clarinet (src/instruments/catalog.ts). */
const RANGE: [number, number] = [50, 94];

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** One round of the rule: every pair of two betweens, in dictionary order, each pair small to large. */
function pairsOf(set: number[]): number[][] {
  const draw = drawer(set, "combinations", 2, "ascending");
  const first = draw();
  const out = [first];
  // The pairs are all different, so the round is over when the first one comes again.
  for (let g = draw(); g.join(" ") !== first.join(" "); g = draw()) out.push(g);
  return out;
}

/**
 * `count` betweens of a line: round r reads the round's pairs starting r pairs later, each pair
 * small to large in even rounds and large to small in odd ones.
 */
function betweensOf(pairs: number[][], count: number): number[] {
  const out: number[] = [];
  for (let r = 0; out.length < count; r++)
    for (let k = 0; k < pairs.length; k++) {
      const pair = pairs[(r + k) % pairs.length]!;
      out.push(...(r % 2 === 0 ? pair : [...pair].reverse()));
    }
  return out.slice(0, count);
}

/** A line added from its origin: `origin` plus the betweens, in ticks. */
function lineOf(origin: number, betweens: number[], atom: number): number[] {
  const out = [origin];
  for (const b of betweens) out.push(out.at(-1)! + b * atom);
  return out;
}

/**
 * `count` pitch betweens. The set stands in a ring, in order of size. A round reads every between
 * once, stepping round the ring by a stride; the stride grows by one each round (only strides that
 * reach every place of the ring), and each round starts one place on from where the last ended.
 */
function pitchSteps(set: number[], count: number): number[] {
  const ring = [...set].sort((a, b) => a - b);
  const n = ring.length;
  const strides: number[] = [];
  for (let d = 1; d < Math.max(2, n); d++) if (gcd(d, n) === 1) strides.push(d);
  const out: number[] = [];
  let at = 0;
  for (let r = 0; out.length < count; r++) {
    const d = strides[r % strides.length]!;
    for (let k = 0; k < n; k++) out.push(ring[(at + k * d) % n]!);
    at = (at + (n - 1) * d + 1) % n;
  }
  return out.slice(0, count);
}

export function score(v: Values<typeof knobs>) {
  const onAtom = atomOf(2);
  const offAtom = atomOf(3);
  const onPairs = pairsOf([...v.onsets]);
  const offPairs = pairsOf([...v.releases]);
  const count = ROUNDS * onPairs.flat().length;

  const onsets = lineOf(0, betweensOf(onPairs, count - 1), onAtom);
  // The release line's origin: the fewest triplet eighths that leave every note at least one long.
  const bare = lineOf(0, betweensOf(offPairs, count - 1), offAtom);
  const origin =
    offAtom * Math.max(...bare.map((r, i) => Math.ceil((offAtom - (r - onsets[i]!)) / offAtom)));
  const releases = bare.map((r) => r + origin);

  for (let i = 0; i + PLAYERS < count; i++)
    if (releases[i]! > onsets[i + PLAYERS]!)
      throw new Error(
        `Releases: note ${i + 1} still sounds when its clarinet must start note ${i + 1 + PLAYERS}. ` +
          "Keep a round of the releases as long as a round of the onsets",
      );

  const steps = pitchSteps([...v.pitch], count - 1);
  const pitches = [v.standpoint];
  for (const s of steps) pitches.push(pitches.at(-1)! + s);
  const out = pitches.find((p) => p < RANGE[0] || p > RANGE[1]);
  if (out !== undefined)
    throw new Error(
      `Pitch: the line reaches ${out}, outside the clarinet (${RANGE[0]}–${RANGE[1]}); move the standpoint`,
    );

  const events: NoteEvent[][] = Array.from({ length: PLAYERS }, () => []);
  for (let i = 0; i < count; i++)
    events[i % PLAYERS]!.push(note(onsets[i]!, releases[i]! - onsets[i]!, pitches[i]!));

  const parts: Part[] = events.map((evs, k) => ({
    id: `cl${k + 1}`,
    instrument: "clarinet",
    name: `Clarinet ${k + 1}`,
    abbreviation: `Cl. ${k + 1}`,
    dynamics: [{ at: 0, level: 3 }],
    events: evs,
  }));
  const bar = 4 * TICKS;
  return scoreOf(
    "antara · palette A · the line of releases",
    Math.ceil(releases.at(-1)! / bar),
    v.tempo,
    parts,
  );
}

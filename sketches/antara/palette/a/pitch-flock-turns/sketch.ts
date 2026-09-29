// antara palette, A (pitch): the flock turns.
//
// Twelve divided string voices stand as one chord: the flock, stacked bottom up from a standpoint
// by the betweens of the Chord set, in order, again and again. The chord sounds once as it stands;
// then, at every onset of a pulse (a time set holding a single between), all twelve voices attack a
// new pitch together, each one step from its last. The size of the step is the same for every voice
// at an onset: the rule takes the sizes from the Sizes set in order, each pass through the set
// starting one place later than the last.
//
// Only the direction of a step (up or down) is not the same for all. A voice does not choose it; it
// is a name the voice takes from where it stands. The lowest voice keeps its direction for a run of
// onsets and then turns; the run lengths come from the Runs set, in the order written. Every other
// voice takes, at each onset, the direction its lower neighbour took at the onset before. So a turn
// made at the bottom travels up the flock, one voice per onset: a front. At the front, the voice
// below has already turned and the voice above has not yet, so these two move in opposite
// directions and the between they stand on is the only one that changes (by twice the size); every
// other voice moves in parallel and every other between keeps its size. When the next turn passes
// the same between, it changes it the other way. The edge (the lowest voice) goes through the run
// set twice; then it turns once more and keeps that direction until the last front has reached the
// top. The last chord holds to the second bar line and fades to nothing over the last bar. Dynamics
// are flat pp throughout.
//
// Default values, by structure. Every run length is a multiple of the number of sizes (3), so every
// turn falls on the head of a pass of the size rule and every run holds whole passes: the edge moves
// by the run length in semitones (a pass sums to 3). With the run set of odd length, the second
// round goes through the same lengths in the opposite directions, so the edge ends the two rounds on
// its standpoint. The size rule starts one place later each pass, so a line never takes the same
// three steps in the same order twice in a row (taken plainly in order, it would repeat them through
// a whole run and only move one shape by 3 semitones at a time); its steps come back only after 9
// onsets, the rule's period. The run set sums to 27, a multiple of 9, so over the piece the fronts
// that open a between and the fronts that close it meet the rule at the same places: one front may
// open a between by more or less than the next one closes it, but every between is back to its
// size at the end.
// Two run lengths (6, 9) are shorter than the 11 onsets a front takes to cross the flock, so a new
// front starts before the last one has reached the top; one (12) is longer, so once in a round all
// twelve move the same way. They differ, so the fronts do not come at an even distance.
//
// The runs are read in the order written (a between-set knob would sort them). With runs a b c, the
// edge turns at +a, a−b, a−b+c, c−b, c and 0 from its standpoint, and the widest chord after each
// top grows with the down run that follows it (b, a, c). Of the three envelopes (the edge's tops,
// its bottoms, the widest chord after each top) exactly one always goes one way, whatever the
// order. 6 12 9 is the one order in which neither the tops nor the widest go one way and the
// highest note and the widest chord fall on different fronts; what goes one way is the bottoms,
// whose last is the standpoint in every order. The sizes are the three smallest betweens; the four
// betweens of the chord all differ and two of them carry .5, so the flock stands on both grids.
// Card: README.md.

import type { TextEvent } from "../../../../../src/score/types.ts";
import {
  betweenSet,
  choice,
  number,
  numbersOf,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, divisi, note, part, scoreOf, stack, stream, TICKS } from "../../common.ts";

/** How many times the edge goes through the run set before its last turn. */
const ROUNDS = 2;

export const knobs = {
  chord: betweenSet({
    group: "Flock",
    label: "Chord",
    help: "The betweens the flock stands on at the start, stacked bottom up from the standpoint, in order, again and again (semitones, .5 for a quarter tone)",
    value: "1.5 2 2.5 3.5",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  anchor: pitch({
    group: "Flock",
    label: "Standpoint",
    help: "The lowest voice at the start: the edge, the voice that turns by the rule",
    value: "D3",
    min: "C2",
    max: "C4",
    step: 0.5,
  }),
  voices: number({
    group: "Flock",
    label: "Voices",
    help: "How many voices the flock has: a front takes one onset per voice to reach the top",
    value: 12,
    min: 4,
    max: 16,
    step: 1,
  }),
  sizes: betweenSet({
    group: "Steps",
    label: "Sizes",
    help: "How far every voice steps at an onset, the same for all (semitones), taken in order, each pass through the set starting one place later than the last",
    value: "0.5 1 1.5",
    min: 0.5,
    max: 6,
    step: 0.5,
    unit: "st",
  }),
  runs: text({
    group: "Steps",
    label: "Runs",
    help: "How many onsets the lowest voice keeps its direction before it turns (whole numbers, 1 or more), taken in the order written, again and again: the order decides where the highest note and the widest chord fall",
    value: "6 12 9",
  }),
  pulse: number({
    group: "Time",
    label: "Pulse",
    help: "The time between one onset and the next, in atoms of the family (a time set holding one between)",
    value: 4,
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the pulse counts in",
    value: FAMILY_OPTIONS[0]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Time",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 60,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

/**
 * The lowest voice's direction at each onset (+1 up, −1 down). Onset 0 is the chord as it stands
 * (no step; counted as up). Runs in order, turning after each, for `ROUNDS` rounds of the set; then
 * one more turn, kept for `voices − 1` onsets so the last front reaches the top.
 */
export function edgeOf(runs: number[], voices: number): number[] {
  const next = stream(runs, "in order", 1);
  const out = [1];
  let dir = 1;
  for (let r = 0; r < ROUNDS * runs.length; r++) {
    const len = next();
    for (let i = 0; i < len; i++) out.push(dir);
    dir = -dir;
  }
  for (let i = 0; i < voices - 1; i++) out.push(dir);
  return out;
}

/**
 * The flock's pitches at each onset, bottom up. Voice k takes the direction voice k − 1 took an
 * onset before, so its direction at onset t is the edge's at onset t − k (up before the start).
 * The sizes come in order, each pass starting one place later ("shift each time").
 */
export function flock(
  anchor: number,
  chord: number[],
  voices: number,
  sizes: number[],
  edge: number[],
): number[][] {
  const size = stream(sizes, "shift each time", 1);
  const out = [stack(anchor, chord, voices)];
  for (let t = 1; t < edge.length; t++) {
    const b = size();
    const dirOf = (k: number) => (t - k >= 1 ? edge[t - k]! : 1);
    out.push(out[t - 1]!.map((p, k) => p + dirOf(k) * b));
  }
  return out;
}

/** The run lengths, in the order written. */
export function runsOf(value: string): number[] {
  const runs = numbersOf("Runs", value);
  if (runs.some((n) => !Number.isInteger(n) || n < 1))
    throw new Error("Runs: whole numbers of onsets, 1 or more (e.g. 6 12 9)");
  return runs;
}

export function score(v: Values<typeof knobs>) {
  const bar = 4 * TICKS;
  const step = v.pulse * atomOf(familyOf(v.family));
  const chords = flock(v.anchor, v.chord, v.voices, v.sizes, edgeOf(runsOf(v.runs), v.voices));
  const last = (chords.length - 1) * step;
  // The last chord holds to the second bar line after it; the last bar fades.
  const end = (Math.floor(last / bar) + 2) * bar;

  const lines = Array.from({ length: v.voices }, (_, k) => chords.map((c) => c[k]!));
  const players = divisi(lines.map((xs): [number, number] => [Math.min(...xs), Math.max(...xs)]));
  const dynamics = curve([
    { at: 0, level: 2 },
    { at: end - bar, level: 2, ramp: true },
    { at: end, level: 0 },
  ]);
  const parts = lines.map((xs, k) => {
    // Every onset a new attack, lasting to the next onset; no slurs, no accents.
    const events = xs.map((m, t) => note(t * step, t + 1 < xs.length ? step : end - last, m));
    const out = part(players[k]!, events, dynamics);
    const mark: TextEvent = { type: "text", at: 0, text: "non vib." };
    out.events.unshift(mark);
    return out;
  });
  // Score order: high to low.
  return scoreOf("antara · palette A · the flock turns", end / bar, v.tempo, parts.reverse());
}

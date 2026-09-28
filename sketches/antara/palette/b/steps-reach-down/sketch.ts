// antara palette, B: how deep a step of the melody reaches.
//
// Uses the A sketch "the vertical between and the horizontal between" (../../a/pitch-two-sets):
// neighbouring voices always stand a between of a vertical set apart, a voice moves by a step of
// the step set, and a voice that has to move takes, of the steps that fit, the one it has used
// least (a tie goes to the first one reached from its pointer into the steps). The rule is copied
// here, not imported.
//
// There the two voices moved in turn. Here there are three, and they are a melody and the two
// voices under it. The top voice (the melody) walks by its own rule: the step set in the order
// written, each round starting one place later. The voices below never choose when to move: at
// each of the melody's onsets, the middle voice moves only if its vertical to the melody has left
// the upper pair's vertical set, and then the bass only if its vertical to the middle has left the
// lower pair's set. Both answer at the same instant as the melody. So each voice's rhythm is not
// written; it is what the vertical sets make of the melody. How deep a step reaches (the melody
// alone, the melody and the middle, or all three) is decided by the sets alone.
//
// Only the sizes of the vertical sets change over the sketch. Each set starts with its middle
// member alone and grows stage by stage, both neighbours at once; the upper pair's set opens
// first, then the lower's. With one member a vertical is fixed, so a voice below has to copy every
// step above it: the three voices start as one block moving in parallel. As the sets grow the
// voices below may stay where they are more and more often: the middle and the bass come apart
// from the melody as a pair, then the bass comes apart from the middle, and at the end the bass
// hardly moves while the middle, apart from it, answers the melody. Sets only grow, so a vertical
// in its set stays in it when the stage changes: a voice can only have to move because the voice
// above it has just moved.
//
// With the defaults a round of the melody's steps sums to 0, so every sixth onset the melody is
// back at its start. The rhythm (3 4 4 6 atoms) is chosen against the bar (12 atoms): no part of
// it adds up to 12, so no run of onsets spans exactly a bar, and a round of it (17 atoms) shares no
// factor with 12, so a round starts on a bar line only every 12 rounds. It has four members, so
// six onsets are a round and a half of it: the time from one return of the melody to the next
// keeps changing. The melody's steps come round after 36 onsets and the rhythm's after 16, so from
// step 37 the melody's pitches repeat its first 24 steps, but not their times.
//
// Strings hold the three voices without a break, pp (Violins I the melody, violas the middle,
// cellos the bass): a voice that moves re-bows at its new pitch, a voice that holds is tied over. The winds sound only the voices that have just moved: oboe for the melody,
// clarinet for the middle, bassoon for the bass (two of each, taking turns), p, each until the
// next onset. The number of winds sounding is the depth of the last onset.
// Card: README.md.

import type { Part, TextEvent } from "../../../../../src/score/types.ts";
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
import { curve, note, part, scoreOf, stream, TICKS, time, type Player } from "../../common.ts";

const OPENS = ["upper pair first", "lower pair first"];

export const knobs = {
  steps: betweenSet({
    group: "Pitch",
    label: "Steps",
    help: "The betweens any voice may move by (semitones, minus for down, .5 for a quarter tone). A voice below takes, of the steps that bring its vertical back into its set, the one it has used least",
    value: "-6 -3.5 -2.5 2.5 3.5 6",
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  upper: betweenSet({
    group: "Pitch",
    label: "Upper pair",
    help: "The verticals the melody may stand above the middle voice (semitones). The set starts with its middle member alone and grows by both neighbours at a stage",
    value: "1.5 5 7.5 11 13.5",
    min: 0.5,
    max: 24,
    step: 0.5,
    unit: "st",
  }),
  lower: betweenSet({
    group: "Pitch",
    label: "Lower pair",
    help: "The verticals the middle voice may stand above the bass (semitones). Grows the same way",
    value: "2.5 5 8.5 11 14.5",
    min: 0.5,
    max: 24,
    step: 0.5,
    unit: "st",
  }),
  opens: choice({
    group: "Pitch",
    label: "Opens",
    help: "Which pair's set grows first; the other grows once the first is full. The stages are one more than the growths of both sets",
    value: OPENS[0]!,
    options: OPENS,
  }),
  melody: text({
    group: "Melody",
    label: "Melody's order",
    help: "The melody's steps, in the order written, each round starting one place later (every one of them must be in Steps). A step that would leave the melody's range is taken the other way",
    value: "3.5 -2.5 6 -3.5 2.5 -6",
  }),
  start: pitch({
    group: "Melody",
    label: "Melody start",
    help: "The melody's first pitch. The middle and the bass start below it at the middle members of the two sets",
    value: "D5",
    min: "C4",
    max: "F#6",
    step: 0.5,
  }),
  perStage: number({
    group: "Time",
    label: "Steps a stage",
    help: "How many steps of the melody each stage lasts",
    value: 12,
    min: 1,
    max: 48,
    step: 1,
  }),
  rhythm: betweenSet({
    group: "Time",
    label: "Rhythm",
    help: "The time from one onset of the melody to the next, in atoms of the family, each round starting one place later",
    value: "3 4 4 6",
    min: 1,
    max: 24,
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
    value: 66,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

const NAMES = ["Melody", "Middle", "Bass"];
/** Where each voice may go: melody, middle, bass. */
const RANGES: [number, number][] = [
  [60, 90],
  [48, 84],
  [36, 67],
];

const player = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  players: number,
): Player => ({ id, instrument, name, abbreviation, players, range: [0, 127], grids: [0, 1] });

/**
 * For each voice, the string section that holds it. The bass is the cellos alone: it reaches F4
 * (65), above where the contrabasses of the playback library are sampled (to F#3), so they do not
 * double it here.
 */
const STRINGS: Player[] = [
  player("vn1", "violins-1", "Violins I", "Vn. I", 16),
  player("va", "violas", "Violas", "Va.", 12),
  player("vc", "cellos", "Violoncellos", "Vc.", 10),
];
/** For each voice, the two winds that take turns on its moves. */
const WINDS: Player[][] = [
  [player("ob1", "oboe", "Oboe 1", "Ob. 1", 1), player("ob2", "oboe", "Oboe 2", "Ob. 2", 1)],
  [
    player("cl1", "clarinet", "Clarinet 1", "Cl. 1", 1),
    player("cl2", "clarinet", "Clarinet 2", "Cl. 2", 1),
  ],
  [
    player("bn1", "bassoon", "Bassoon 1", "Bsn. 1", 1),
    player("bn2", "bassoon", "Bassoon 2", "Bsn. 2", 1),
  ],
];

const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** A set's members around its middle one, `r` places to each side (as far as the set goes). */
const around = (set: number[], r: number) => {
  const c = Math.floor((set.length - 1) / 2);
  return set.slice(Math.max(0, c - r), c + r + 1);
};
/** How many growths a set needs to be full. */
const growths = (set: number[]) => {
  const c = Math.floor((set.length - 1) / 2);
  return Math.max(c, set.length - 1 - c);
};

export function score(v: Values<typeof knobs>) {
  const H = v.steps;
  const n = H.length;
  const order = numbersOf("Melody's order", v.melody.replaceAll("−", "-"));
  if (order.some((h) => !H.some((x) => same(x, h))))
    throw new Error("Melody's order: every step of the melody must be one of Steps");
  for (const [label, set] of [
    ["Upper pair", v.upper],
    ["Lower pair", v.lower],
  ] as const)
    if (set.some((d) => d <= 0))
      throw new Error(`${label}: every vertical is above 0, so the voices never meet or cross`);

  // The stages: the radius of each set around its middle member.
  const upperFirst = v.opens === OPENS[0];
  const [first, second] = upperFirst ? [v.upper, v.lower] : [v.lower, v.upper];
  const radii: [number, number][] = [];
  for (let r = 0; r <= growths(first); r++) radii.push([r, 0]);
  for (let r = 1; r <= growths(second); r++) radii.push([growths(first), r]);
  const stages = radii.map(([a, b]) => {
    const [ru, rl] = upperFirst ? [a, b] : [b, a];
    return [around(v.upper, ru), around(v.lower, rl)];
  });

  // The start: the melody, and each voice below at the middle member of its set.
  const now = [v.start];
  now.push(now[0]! - stages[0]![0]![0]!);
  now.push(now[1]! - stages[0]![1]![0]!);
  now.forEach((m, k) => {
    const [lo, hi] = RANGES[k]!;
    if (m < lo || m > hi)
      throw new Error(
        `Melody start: the ${NAMES[k]!.toLowerCase()} would start at ${m}, outside its range ${lo}–${hi}`,
      );
  });

  // How often each voice below has taken each step (by its place in the set), and its pointer into
  // the steps: the middle's starts at the first step, the bass's halfway round.
  const used = [H.map(() => 0), H.map(() => 0)];
  const pointer = [0, Math.floor(n / 2)];
  const fromPointer = (k: number, i: number) => (((i - pointer[k]!) % n) + n) % n;

  /** Voice k (1 middle, 2 bass) answers its upper neighbour if it has to. Whether it moved. */
  const answer = (k: number, sets: number[][]): boolean => {
    const set = sets[k - 1]!;
    const inSet = (d: number) => set.some((x) => same(x, d));
    const above = now[k - 1]!;
    if (inSet(above - now[k]!)) return false;
    const [lo, hi] = RANGES[k]!;
    const fits = H.map((h, i) => ({ h, i })).filter(({ h }) => {
      const p = now[k]! + h;
      return p >= lo && p <= hi && inSet(above - p);
    });
    const j = k - 1;
    let moved = false;
    if (fits.length > 0) {
      const least = Math.min(...fits.map(({ i }) => used[j]![i]!));
      const pick = fits
        .filter(({ i }) => used[j]![i] === least)
        .reduce((a, b) => (fromPointer(j, b.i) < fromPointer(j, a.i) ? b : a));
      used[j]![pick.i]!++;
      now[k] = now[k]! + pick.h;
      moved = true;
    }
    pointer[j] = (pointer[j]! + 1) % n;
    return moved;
  };

  const atom = atomOf(familyOf(v.family));
  const gap = stream(v.rhythm, "shift each time", 1);
  const walk = stream(order, "shift each time", 1);
  // Each voice's pitches from its start, as (tick, midi); the onsets and which voices moved.
  const lines = now.map((m) => [{ at: 0, midi: m }]);
  const onsets: { at: number; moved: boolean[] }[] = [{ at: 0, moved: [true, true, true] }];
  const stageStarts: number[] = [0];
  let t = 0;
  stages.forEach((sets, s) => {
    for (let q = 0; q < v.perStage; q++) {
      t += gap() * atom;
      if (q === 0 && s > 0) stageStarts.push(t);
      let h = walk();
      const [lo, hi] = RANGES[0]!;
      if (now[0]! + h < lo || now[0]! + h > hi) h = -h;
      now[0] = now[0]! + h;
      const moved = [true, false, false];
      moved[1] = answer(1, sets);
      moved[2] = answer(2, sets);
      moved.forEach((m, k) => {
        if (m && k > 0) lines[k]!.push({ at: t, midi: now[k]! });
      });
      lines[0]!.push({ at: t, midi: now[0]! });
      onsets.push({ at: t, moved });
    }
  });
  const bar = 4 * TICKS;
  const end = Math.ceil((t + bar) / bar) * bar;

  const fade = (level: number) =>
    curve([
      { at: 0, level },
      { at: end - bar, level, ramp: true },
      { at: end, level: 0 },
    ]);

  // Strings: each voice held without a break, re-bowed where it moves; pp.
  const strings: Part[] = lines.map((xs, k) =>
    part(
      STRINGS[k]!,
      xs.map((x, i) => note(x.at, (xs[i + 1]?.at ?? end) - x.at, x.midi)),
      fade(2),
    ),
  );

  // Winds: at each onset, the voices that have just moved, until the next onset; p. The two winds
  // of a voice take turns on its moves.
  const winds = WINDS.map((pair) => pair.map(() => [] as ReturnType<typeof note>[]));
  const turns = [0, 0, 0];
  const pitchAt = (k: number, at: number) => lines[k]!.findLast((x) => x.at <= at)!.midi;
  onsets.forEach((o, i) => {
    const until = onsets[i + 1]?.at ?? end;
    o.moved.forEach((m, k) => {
      if (!m) return;
      winds[k]![turns[k]! % 2]!.push(note(o.at, until - o.at, pitchAt(k, o.at)));
      turns[k]!++;
    });
  });
  const windParts: Part[] = WINDS.flatMap((pair, k) =>
    pair.map((p, w) => part(p, winds[k]![w]!, fade(3))),
  );

  // Where each stage begins, above the top staff: the two sets in force.
  const show = (set: number[]) => `{${set.join(" ")}}`;
  windParts[0]!.events.unshift(
    ...stageStarts.map((at, s): TextEvent => ({
      type: "text",
      at: time(at),
      text: `stage ${s + 1}: upper ${show(stages[s]![0]!)} · lower ${show(stages[s]![1]!)}`,
    })),
  );

  return scoreOf("antara · palette B · how deep a step reaches", end / bar, v.tempo, [
    ...windParts,
    ...strings,
  ]);
}

// antara palette, A (time): heard as 0, heard as a between.
//
// One line, pitch and time alike: onsets are the origin plus the time betweens a rule draws from a
// time set, and pitches are a standpoint plus the pitch betweens a rule draws from a pitch set.
// Four groups of strings sound this one line at once. Each group has a standpoint of its own: the
// time betweens it hears as 0, every size up to a threshold (in atoms). A between heard as 0 is a
// time between of 0: the note after it sounds together with the note before it, in one chord (a
// vertical line). A between heard as a between opens a new chord at the line's own onset. So the
// same line is a melody for one group and a row of chords for another; one time between is a
// between from one standpoint and 0 from another.
//
// Nothing else decides the chords. A chord holds the line's notes from its onset up to the group's
// next onset, sounds them all at its onset and holds them until then. The length of a between
// heard as 0 is not lost: it passes on to the next between the group hears, so every group's
// onsets stand on onsets of the line. The solo violin hears nothing as 0 (its threshold is 0): it
// is the line itself. With nested thresholds (0, 1, 2, 3 atoms for a set of 1 to 4 atoms) the
// number of groups that attack at a line onset is the rank of the time between before it, so the
// weight of an onset comes only from the size of that between. Every chord is attacked alike:
// arco, no accents, one level per group until the last onset, then all hold to the end of the bar
// (at least a beat) and fade to niente. The sections play p; the solo violin, one player against
// sections of 10 to 14 in the same band, always on a pitch they already hold or attack with it,
// plays two marks louder (mf) so that each group weighs about the same and the weight of an onset
// stays the number of groups that attack it.
//
// Both sets are drawn by one rule, in rounds: a round is one ordering of the set (each between
// once), never one used before. The rule's only aim is that the line does not repeat itself.
// Starting each round one later than the last (the reading tried first) closes after as many
// rounds as the set has betweens (a 16-between rhythm heard four times, a 25-between melody
// coming back 2.5 higher), and each round's end is heard again at once as the next round's start.
// So, of the orderings not yet used, the next round is the one with, in turn: the fewest runs
// heard again right after themselves where it meets the line (the same between twice, a run of
// two twice, …); the fewest runs already heard anywhere in the line, counted from the longest (a
// round's length) down to two; a first between that has begun the fewest rounds (so that no
// between leads the rounds more often, as a list read in order would make it); the first in
// dictionary order. A pitch between that would leave the band is taken the other way (an addition
// outside the mechanism, only to keep every group in one register). The family is 3 (triplet
// eighths) throughout: one family, so that only the reading of 0 is heard.
//
// A time between of 0 is left open in docs/antara/sound.md; that it is a chord is the reading
// tried here, and that its length passes on to the next between heard is this sketch's reading.
// Card: README.md.

import type { Part } from "../../../../../src/score/types.ts";
import {
  betweenSet,
  number,
  numbersOf,
  pitch,
  pitchRange,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf } from "../../../between.ts";
import { curve, note, part, scoreOf, TICKS, type Player } from "../../common.ts";

export const knobs = {
  time: betweenSet({
    group: "Line",
    label: "Time set",
    help: "The time betweens of the line, in triplet eighths (atoms of the family of 3). Each round is one ordering of the set not used before, chosen so that the line repeats itself as little as it can (see the card). At most six betweens",
    value: "1 2 3 4",
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  pitches: text({
    group: "Line",
    label: "Pitch set",
    help: "The pitch betweens of the line (semitones, .5 for a quarter tone, − for down). The order written does not matter: each round is one ordering of the set, by the same rule as the time set. At most six betweens",
    value: "-4.5 -1.5 1 2.5 3",
    hint: "-4.5 -1.5 1 2.5 3",
  }),
  anchor: pitch({
    group: "Line",
    label: "Standpoint",
    help: "The line's first note",
    value: "E4",
    min: "C3",
    max: "C6",
    step: 0.5,
  }),
  band: pitchRange({
    group: "Line",
    label: "Band",
    help: "Where the line walks, for every group alike. A pitch between that would leave it is taken the other way (an addition outside the mechanism)",
    value: ["A#3", "E5"],
    min: "C3",
    max: "C6",
    step: 0.5,
  }),
  betweens: number({
    group: "Line",
    label: "Betweens",
    help: "How many betweens the line takes (time and pitch, one each); the line has one note more",
    value: 64,
    min: 4,
    max: 160,
    step: 1,
  }),
  zero: betweenSet({
    group: "Standpoints",
    label: "Heard as 0 up to",
    help: "One number per group, in atoms: a group hears every time between this long or shorter as 0 (the note after it joins the chord). The smallest goes to the solo violin, then violins II, violas, cellos",
    value: "0 1 2 3",
    min: 0,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute (an atom is a third of a beat)",
    value: 60,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

/** The four groups, from the smallest standpoint to the largest. */
const GROUPS = [
  { short: "vn1", instrument: "violins-1", name: "Violins I", abbr: "Vn. I", size: 16, solo: true },
  { short: "vn2", instrument: "violins-2", name: "Violins II", abbr: "Vn. II", size: 14 },
  { short: "va", instrument: "violas", name: "Violas", abbr: "Va.", size: 12 },
  { short: "vc", instrument: "cellos", name: "Violoncellos", abbr: "Vc.", size: 10 },
];

interface Chord {
  at: number;
  midis: number[];
}

/** Every ordering of the items (sorted), in dictionary order; equal betweens give one ordering. */
function orderingsOf(items: number[]): number[][] {
  if (items.length <= 1) return [items];
  const out: number[][] = [];
  items.forEach((x, i) => {
    if (i > 0 && items[i - 1] === x) return;
    for (const rest of orderingsOf([...items.slice(0, i), ...items.slice(i + 1)]))
      out.push([x, ...rest]);
  });
  return out;
}

/**
 * The rule, for both lines, one between per call. The line goes in rounds, each one ordering of
 * the set not used before (when every ordering has been used, all may come again). Of the
 * orderings left, the next round is the one with, in turn:
 * 1. the fewest back-to-back repeats where it meets the line: a run heard again right after
 *    itself (the same between twice, a run of two twice, … up to a round);
 * 2. the fewest runs already heard in the line, counted from the longest (a round's length)
 *    down to two;
 * 3. a first between that has begun the fewest rounds so far;
 * 4. the first in dictionary order (smallest first).
 */
function leastRepeating(label: string, set: number[]): () => number {
  if (set.length === 0) throw new Error(`${label}: write at least one between`);
  if (set.length > 6)
    throw new Error(`${label}: at most 6 betweens (the rule weighs every ordering of the set)`);
  const all = orderingsOf([...set].sort((a, b) => a - b));
  const n = set.length;
  const line: number[] = [];
  const heard = new Map<string, number>();
  const heads = new Map<number, number>();
  const run = (seq: number[], end: number, len: number) =>
    seq.slice(end - len + 1, end + 1).join(",");
  const costOf = (candidate: number[]): number[] => {
    // Only the end of the line can meet the candidate (runs and repeats are at most a round long).
    const tail = line.slice(-2 * n);
    const seq = [...tail, ...candidate];
    let backToBack = 0;
    for (let end = tail.length; end < seq.length; end++)
      for (let k = 1; k <= n && end - 2 * k + 1 >= 0; k++)
        if (run(seq, end - k, k) === run(seq, end, k)) backToBack++;
    const repeats: number[] = [];
    for (let len = Math.max(n, 2); len >= 2; len--) {
      let count = 0;
      for (let end = tail.length; end < seq.length; end++)
        if (end - len + 1 >= 0) count += heard.get(run(seq, end, len)) ?? 0;
      repeats.push(count);
    }
    return [backToBack, ...repeats, heads.get(candidate[0]!) ?? 0];
  };
  const fewer = (a: number[], b: number[]) => {
    const i = a.findIndex((x, j) => x !== b[j]);
    return i >= 0 && a[i]! < b[i]!;
  };
  let left = all.map((_, i) => i);
  let queue: number[] = [];
  return () => {
    if (queue.length === 0) {
      if (left.length === 0) left = all.map((_, i) => i);
      let best = left[0]!;
      let cost = costOf(all[best]!);
      for (const i of left.slice(1)) {
        const c = costOf(all[i]!);
        if (fewer(c, cost)) {
          best = i;
          cost = c;
        }
      }
      left = left.filter((i) => i !== best);
      queue = [...all[best]!];
      heads.set(queue[0]!, (heads.get(queue[0]!) ?? 0) + 1);
      const from = line.length;
      line.push(...queue);
      for (let len = 2; len <= Math.max(n, 2); len++)
        for (let end = from; end < line.length; end++)
          if (end - len + 1 >= 0) {
            const key = run(line, end, len);
            heard.set(key, (heard.get(key) ?? 0) + 1);
          }
    }
    return queue.shift()!;
  };
}

export function score(v: Values<typeof knobs>) {
  const atom = atomOf(3);
  const bar = 4 * TICKS;
  const set = numbersOf("Pitch set", v.pitches.replaceAll("−", "-"));
  if (set.some((b) => !Number.isInteger(b * 2)))
    throw new Error("Pitch set: betweens are semitones on the quarter-tone grid (2.5, -1.5, 3)");
  if (v.zero.length !== GROUPS.length)
    throw new Error(
      `Heard as 0 up to: give ${GROUPS.length} numbers, one for each group (solo violin, violins II, violas, cellos)`,
    );
  const [lo, hi] = v.band;
  const out = (p: number) => p < lo || p > hi;
  if (out(v.anchor))
    throw new Error(`Standpoint: ${v.anchor} is outside the Band (${lo}–${hi}); move one of them`);

  // The line: onsets (ticks), pitches, and the time between after each note (atoms).
  const nextTime = leastRepeating("Time set", [...v.time]);
  const nextPitch = leastRepeating("Pitch set", set);
  const onsets = [0];
  const midis = [v.anchor];
  const gaps: number[] = [];
  for (let i = 0; i < v.betweens; i++) {
    const gap = nextTime();
    gaps.push(gap);
    onsets.push(onsets[i]! + gap * atom);
    let b = nextPitch();
    if (out(midis[i]! + b)) {
      b = -b;
      if (out(midis[i]! + b))
        throw new Error(
          `Band: at between ${i + 1} the pitch between ${-b} leaves the band ${lo}–${hi} both ways; widen the Band`,
        );
    }
    midis.push(midis[i]! + b);
  }
  const last = onsets.at(-1)!;
  const end = Math.ceil((last + TICKS) / bar) * bar;

  // One group's reading of the line: a between heard as 0 puts the next note into the chord.
  const chordsOf = (threshold: number): Chord[] => {
    const chords = [{ at: 0, midis: [midis[0]!] }];
    gaps.forEach((gap, i) => {
      if (gap <= threshold) chords.at(-1)!.midis.push(midis[i + 1]!);
      else chords.push({ at: onsets[i + 1]!, midis: [midis[i + 1]!] });
    });
    return chords.map((c) => ({ at: c.at, midis: [...new Set(c.midis)].sort((a, b) => a - b) }));
  };

  // One level per group: p for the sections, mf for the one solo player (about the weight of a
  // section at p, two marks of 6 dB against some ten players), so a group's attack weighs the same
  // whichever group it is.
  const dynamicsOf = (level: number) =>
    curve([
      { at: 0, level },
      { at: last, level, ramp: true },
      { at: end, level: 0 },
    ]);

  const parts: Part[] = GROUPS.flatMap((g, gi) => {
    const chords = chordsOf(v.zero[gi]!);
    const dynamics = dynamicsOf(g.solo ? 5 : 3);
    const size = Math.max(...chords.map((c) => c.midis.length));
    if (size > g.size)
      throw new Error(
        `Heard as 0 up to: the ${g.name.toLowerCase()} would need ${size} parts for their largest chord, more than the ${g.size} players; hear fewer sizes as 0`,
      );
    // Voice k (0 at the bottom) plays the k-th pitch from the bottom of every chord that has one.
    // A section is shared out with the larger shares at the bottom, where the voices play most.
    const voices = Array.from({ length: size }, (_, k) => {
      const events = chords.flatMap((c, j) => {
        const m = c.midis[k];
        if (m === undefined) return [];
        return [note(c.at, (chords[j + 1]?.at ?? end) - c.at, m)];
      });
      const played = events.map((e) => (e.pitch as { midi: number }).midi);
      const players = g.solo ? 1 : Math.floor(g.size / size) + (k < g.size % size ? 1 : 0);
      const j = size - k; // numbered from the top
      const one = size === 1;
      const p: Player = {
        id: one ? g.short : `${g.short}-${j}`,
        instrument: g.instrument,
        name: g.solo && one ? "Violin I (solo)" : one ? g.name : `${g.name} ${j}`,
        abbreviation: g.solo && one ? "Vn. I solo" : one ? g.abbr : `${g.abbr} ${j}`,
        players,
        range: [Math.min(...played), Math.max(...played)],
        grids: [0, 1],
      };
      return part(p, events, dynamics);
    });
    // Score order: high to low within the group.
    return voices.reverse();
  });

  return scoreOf("antara · palette A · heard as 0, heard as a between", end / bar, v.tempo, parts);
}

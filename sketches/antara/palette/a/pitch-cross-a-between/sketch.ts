// antara palette, A (pitch): the chord turns over when its standpoint crosses a between.
//
// A chord is held as a standpoint and a set of signed betweens measured from it: the standpoint is
// one of the chord's tones, with betweens below it (−) and above it (+). The standpoint tone itself
// (between 0) is always in the chord.
//
// The rule takes one between at a time, in a fixed order, and moves the standpoint across it, to
// the tone on the other side. From there the same cut is seen from its other side, so every between
// of the set is read the other way round: what was above is now called below. The new chord is the
// new standpoint with the set read reversed, which is the old chord turned over about the middle of
// the between just crossed. Only the tones that face each other across that middle stay: always the
// old and the new standpoint, and besides them the pairs of betweens that add up to the one crossed
// (x + y = d), or a between that is its half (the tone on the middle). Every other tone gives way to
// its mirror on the other side of the middle.
//
// The betweens are taken in order, one per turn, twice round: with an odd number of betweens every
// between is crossed once from each side, and the chord ends where it began.
//
// Time is a set holding one between: the chord turns over at every onset. Six cellos of the
// section, one player to a voice (ten do not divide into six equal parts; one each keeps every voice
// the same weight and colour), ord.
// At a turn every cello whose pitch is also in the new chord holds it (no new stroke); the others,
// low to high, take the new pitches low to high (so a cello does not always go to the mirror of
// its own tone, and the cellos cross one another). Held tones stay pp; a new tone comes in mp and
// sinks to pp within a beat. The last chord is held twice as long and fades.
// Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, TICKS, type Player } from "../../common.ts";

export const knobs = {
  betweens: betweenSet({
    group: "Chord",
    label: "Betweens from the standpoint",
    help: "The chord's betweens measured from the standpoint (semitones, − below it, .5 for a quarter tone); the standpoint itself is always in the chord. They are crossed in this order, smallest first, twice round; with an odd count the chord ends where it began",
    value: "-5.5 -4 -2 3.5 7.5",
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
    anchor: "standpoint",
  }),
  standpoint: pitch({
    group: "Chord",
    label: "Standpoint",
    help: "Where the chord starts standing. It moves at every turn: to the tone across the between crossed",
    value: "C4",
    min: "C3",
    max: "C5",
    step: 0.5,
  }),
  between: number({
    group: "Time",
    label: "Time between",
    help: "The one time between of the time set, in atoms of the family: the chord turns over this far after the last turn",
    value: 15,
    min: 1,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time between counts in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
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

const CELLOS: [number, number] = [36, 84];

/** The chord: the standpoint, and the standpoint plus each between read in the given direction. */
const chordOf = (s: number, sign: number, set: number[]) =>
  [s, ...set.map((d) => s + sign * d)].sort((a, b) => a - b);

export function score(v: Values<typeof knobs>) {
  // The standpoint (0) is always in; a between written twice is one tone.
  const set = [...new Set(v.betweens.filter((d) => d !== 0))];
  if (set.length === 0)
    throw new Error("Betweens from the standpoint: give at least one besides 0");
  if (set.length > 9)
    throw new Error(
      "Betweens from the standpoint: at most 9 besides 0 (one cello to a tone, ten cellos)",
    );

  const gap = v.between * atomOf(familyOf(v.family));
  const turns = 2 * set.length;

  // Each voice's pitches, as (tick, midi). Voices start low to high on the first chord.
  let s = v.standpoint;
  let sign = 1;
  const voices = chordOf(s, sign, set).map((m) => [{ at: 0, midi: m }]);
  for (let j = 0; j < turns; j++) {
    const t = s + sign * set[j % set.length]!;
    // The standpoint crosses to t: the same cut from the other side, every between read reversed.
    // (Equal to turning the chord over about the middle of s and t.)
    s = t;
    sign = -sign;
    const next = chordOf(s, sign, set);
    const now = voices.map((xs) => xs.at(-1)!.midi);
    const held = new Set(now.filter((m) => next.includes(m)));
    const free = next.filter((m) => !held.has(m));
    const movers = voices
      .map((xs, k) => ({ k, m: now[k]! }))
      .filter(({ m }) => !held.has(m))
      .sort((a, b) => a.m - b.m);
    movers.forEach(({ k }, i) => voices[k]!.push({ at: (j + 1) * gap, midi: free[i]! }));
  }

  const bar = 4 * TICKS;
  const last = turns * gap;
  const end = Math.ceil((last + 2 * gap) / bar) * bar;
  const fadeFrom = Math.min(Math.max(last + TICKS, end - bar), end);

  const ranges = voices.map((xs): [number, number] => [
    Math.min(...xs.map((x) => x.midi)),
    Math.max(...xs.map((x) => x.midi)),
  ]);
  if (ranges.some(([lo, hi]) => lo < CELLOS[0] || hi > CELLOS[1]))
    throw new Error(
      `Standpoint: the chord leaves the cellos (${CELLOS[0]}–${CELLOS[1]}); it reaches ` +
        `${Math.min(...ranges.map((r) => r[0]))}–${Math.max(...ranges.map((r) => r[1]))}`,
    );

  // One cello to a voice, numbered from the top of the first chord.
  const n = voices.length;
  const players: Player[] = ranges.map((range, k) => ({
    id: `vc-${n - k}`,
    instrument: "cellos",
    name: `Violoncello ${n - k}`,
    abbreviation: `Vc. ${n - k}`,
    players: 1,
    range,
    grids: [0, 1],
  }));

  const parts = voices.map((xs, k) => {
    const events = xs.map((x, i) => note(x.at, (xs[i + 1]?.at ?? end) - x.at, x.midi));
    // Held tones pp; a tone that has just come in is mp and sinks to pp within a beat.
    const points: { at: number; level: number; ramp?: boolean }[] = [{ at: 0, level: 2 }];
    for (const [i, x] of xs.entries()) {
      if (i === 0) continue;
      const until = Math.min(xs[i + 1]?.at ?? end, x.at + TICKS);
      points.push({ at: x.at, level: 4, ramp: true }, { at: until, level: 2 });
    }
    points.push({ at: fadeFrom, level: 2, ramp: true }, { at: end, level: 0 });
    return part(players[k]!, events, curve(points));
  });
  // Score order: high to low.
  return scoreOf(
    "antara · palette A · the chord turns over across a between",
    end / bar,
    v.tempo,
    parts.reverse(),
  );
}

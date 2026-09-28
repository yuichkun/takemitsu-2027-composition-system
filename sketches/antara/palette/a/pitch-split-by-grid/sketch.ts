// antara palette, A (pitch): one line, split by its grid.
//
// A rule draws one stream of betweens from a set. Three voices start together on one standpoint and
// walk on (each adds the between it takes to its own last pitch; no octave folding). The full voice
// takes every between. The other two share the stream out by one mark, whether a between has .5 or
// not: the even voice takes only the betweens without .5 (an even number of quarter tones), the odd
// voice only those with .5 (an odd number), and each holds its note through the betweens it does
// not take. So at every onset exactly two voices move, by the same between (the full voice with the
// even or the odd one), and one holds.
//
// The quarter-tone grid is two semitone grids a quarter tone apart: a between with .5 moves a voice
// to the other grid, one without keeps it where it is. The even voice therefore never leaves the
// standpoint's grid. The full voice is the standpoint plus both partial sums (what the even voice
// and what the odd voice have taken so far), so the vertical between the full voice and the odd
// voice is the even voice's distance from the standpoint (a whole number of semitones: the two are
// always on the same grid), and the vertical between the full voice and the even voice is the odd
// voice's distance from the standpoint. The two voices moving in parallel stand as far apart as the
// holding voice stands from the standpoint. Where a partial sum comes back to 0, two voices meet on
// one pitch; nothing arranges it.
//
// One addition outside the mechanism, only to keep the voices in the band: when taking a between
// would put the full voice or the voice moving with it outside the band, both take it the other way
// (the same size, the opposite direction; .5 or not stays the same, and so does who moves).
//
// Time is a set holding one between (a pulse), so no time rule can be heard: the full voice sounds
// a new note at every onset; the even and odd voices sound one only when they move, and hold it
// (not struck again) until they move again. Three divided violas, ord., a constant p, no accents.
// The set is written as text, not on a between-set ruler: the ruler keeps its betweens sorted by
// size, and the order written is the rule's order. Card: README.md.

import {
  choice,
  number,
  numbersOf,
  pitch,
  pitchRange,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

export const knobs = {
  set: text({
    group: "Pitch",
    label: "Set",
    help: "The betweens of the set, in the order written (semitones, − for down, .5 for a quarter tone). The rule takes them in this order, starting one later each time round; a between with .5 goes to the full voice and the odd voice, one without to the full voice and the even voice",
    value: "-0.5 1 5.5 4 -6.5 -6",
  }),
  anchor: pitch({
    group: "Pitch",
    label: "Standpoint",
    help: "Where the three voices start, together. The even voice never leaves this pitch's grid",
    value: "C4",
    min: "C3",
    max: "C6",
    step: 0.5,
  }),
  band: pitchRange({
    group: "Pitch",
    label: "Band",
    help: "Where the voices walk. A between that would take the full voice or the voice moving with it out of the band is taken the other way (an addition outside the mechanism)",
    value: ["C3", "C5"],
    min: "C3",
    max: "G6",
    step: 0.5,
  }),
  steps: number({
    group: "Pitch",
    label: "Steps",
    help: "How many betweens the rule draws: one per onset, after the first",
    value: 80,
    min: 6,
    max: 200,
    step: 1,
  }),
  between: number({
    group: "Time",
    label: "Time between",
    help: "The one time between of the time set, in atoms of the family: every onset is this far after the last",
    value: 2,
    min: 1,
    max: 12,
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
    value: 56,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

/** The violas divided in three (4 + 4 + 4), numbered from the top of the score. */
const PLAYERS: Player[] = [1, 2, 3].map((j) => ({
  id: `va-${j}`,
  instrument: "violas",
  name: `Violas ${j}`,
  abbreviation: `Va. ${j}`,
  players: 4,
  range: [48, 91],
  grids: [0, 1],
}));

/** Whether a between moves a voice to the other grid (an odd number of quarter tones). */
const crosses = (b: number) => Math.round(b * 2) % 2 !== 0;

/** One voice: its pitch after each step (index 0 is the start), and the steps it moves at. */
interface Walk {
  pitches: number[];
  moves: Set<number>;
}

/** The three voices, step by step: full, even, odd. */
function walk(v: Values<typeof knobs>, set: number[]): Walk[] {
  const [lo, hi] = v.band;
  const out = (p: number) => p < lo || p > hi;
  if (out(v.anchor))
    throw new Error(`Standpoint: ${v.anchor} is outside the Band (${lo}–${hi}); move one of them`);
  const next = stream(set, "shift each time", 1);
  const voices: Walk[] = [0, 1, 2].map(() => ({ pitches: [v.anchor], moves: new Set([0]) }));
  const [full, even, odd] = voices as [Walk, Walk, Walk];
  for (let i = 1; i <= v.steps; i++) {
    let b = next();
    const mover = crosses(b) ? odd : even;
    const holder = crosses(b) ? even : odd;
    const [f, m] = [full.pitches.at(-1)!, mover.pitches.at(-1)!];
    if (out(f + b) || out(m + b)) {
      b = -b;
      if (out(f + b) || out(m + b))
        throw new Error(
          `Band: at step ${i} the between ${-b} leaves the band ${lo}–${hi} both ways; widen the Band`,
        );
    }
    full.pitches.push(f + b);
    mover.pitches.push(m + b);
    holder.pitches.push(holder.pitches.at(-1)!);
    full.moves.add(i);
    mover.moves.add(i);
  }
  return voices;
}

export function score(v: Values<typeof knobs>) {
  const set = numbersOf("Set", v.set.replaceAll("−", "-"));
  if (set.some((b) => !Number.isInteger(b * 2)))
    throw new Error("Set: betweens are semitones on the quarter-tone grid (4, 5.5, -1)");
  const voices = walk(v, set);

  const step = v.between * atomOf(familyOf(v.family));
  const last = v.steps * step;
  const bar = 4 * TICKS;
  // The last notes are held to the end of the bar after at least one more beat.
  const end = Math.ceil((last + TICKS) / bar) * bar;
  // A constant p; the held last notes fade to nothing.
  const dynamics = curve([
    { at: 0, level: 3 },
    { at: last, level: 3, ramp: true },
    { at: end, level: 0 },
  ]);

  const parts = voices.map((w, k) => {
    // A new note where the voice moves (every onset for the full voice); held until the next.
    const starts = [...w.moves].sort((a, b) => a - b);
    const events = starts.map((i, j) => {
      const at = i * step;
      const stop = j + 1 < starts.length ? starts[j + 1]! * step : end;
      return note(at, stop - at, w.pitches[i]!);
    });
    return part(PLAYERS[k]!, events, dynamics);
  });

  return scoreOf(
    "antara · palette A · one line, split by its grid",
    Math.ceil(end / bar),
    v.tempo,
    parts,
  );
}

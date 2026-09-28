// antara palette, A (pitch): other orders, the same place.
//
// Four voices start together on one standpoint and walk on: each adds the next between to its own
// last pitch (no octave folding). All four draw from one and the same set of betweens, each by its
// own rule: the set as written, the set reversed, the set by size narrow first, and wide first.
// Every voice starts its reading one place later each time round ("shift each time"), so no voice
// repeats one shape moved up or down. A pass is one reading of the whole set.
//
// Because every pass takes every between of the set once, the betweens of a pass add up to the sum
// of the set, whatever the order. So after each pass all four voices stand on the same pitch: the
// standpoint plus the passes so far times the sum. They meet at every onset that ends a pass and
// nowhere is the meeting arranged; it is the set, not the order, that decides where they arrive.
// Inside a pass the vertical betweens are the differences of the voices' partial sums, different
// for each rule: one set heard through four orders at once. The meeting pitch moves by the sum
// each pass.
//
// Time is a set holding one between: all four strike together at every onset and each note lasts
// to the next. Four divided violins, ord., a constant p, no accents: the meetings are heard only as
// the four voices fusing into one. The last meeting is held and fades.
//
// The set is written as text, not on a between-set ruler: the ruler keeps its betweens sorted by
// size, and the order written is voice 1's rule.
// Card: README.md.

import {
  choice,
  number,
  numbersOf,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

export const knobs = {
  set: text({
    group: "Pitch",
    label: "Set",
    help: "The betweens of the set, in the order written (semitones, − for down, .5 for a quarter tone). Voice 1 reads them as written, voice 2 reversed, voice 3 narrow first, voice 4 wide first; every pass takes each once, so every pass ends on the standpoint plus the sum",
    value: "-4 6 -5.5 0.5 -1 4.5",
  }),
  anchor: pitch({
    group: "Pitch",
    label: "Standpoint",
    help: "Where all four voices start, together. Nothing is folded into range: a voice that leaves the violins stops the sketch with an error",
    value: "C5",
    min: "C4",
    max: "C6",
    step: 0.5,
  }),
  passes: number({
    group: "Pitch",
    label: "Passes",
    help: "How many times each voice reads the whole set. The four meet at the start and at the end of every pass",
    value: 12,
    min: 1,
    max: 24,
    step: 1,
  }),
  between: number({
    group: "Time",
    label: "Time between",
    help: "The one time between of the time set, in atoms of the family: every onset is this far after the last, and all four voices strike together",
    value: 3,
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time between counts in",
    value: FAMILY_OPTIONS[0]!,
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

/** A section divided in two, numbered from the top. */
const halves = (
  instrument: string,
  name: string,
  abbreviation: string,
  id: string,
  size: number,
  range: [number, number],
): Player[] =>
  [1, 2].map((j) => ({
    id: `${id}-${j}`,
    instrument,
    name: `${name} ${j}`,
    abbreviation: `${abbreviation} ${j}`,
    players: Math.floor(size / 2) + (j === 1 ? size % 2 : 0),
    range,
    grids: [0, 1],
  }));

// Voices 1 to 4, in score order.
const PLAYERS: Player[] = [
  ...halves("violins-1", "Violins I", "Vn. I", "vn1", 16, [55, 103]),
  ...halves("violins-2", "Violins II", "Vn. II", "vn2", 14, [55, 100]),
];

/** The four rules' base orders: as written, reversed, narrow first, wide first. */
function readings(set: number[]): number[][] {
  const narrow = [...set].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  return [set, [...set].reverse(), narrow, [...narrow].reverse()];
}

export function score(v: Values<typeof knobs>) {
  const set = numbersOf("Set", v.set.replaceAll("−", "-"));
  if (set.some((b) => !Number.isInteger(b * 2)))
    throw new Error("Set: betweens are semitones on the quarter-tone grid (4, 5.5, -1)");
  const steps = v.passes * set.length;

  // Each voice walks on from the standpoint, one between per onset.
  const voices = readings(set).map((base) => {
    const next = stream(base, "shift each time", 1);
    const out = [v.anchor];
    for (let i = 0; i < steps; i++) out.push(out.at(-1)! + next());
    return out;
  });
  voices.forEach((xs, k) => {
    const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
    const p = PLAYERS[k]!;
    if (lo < p.range[0] || hi > p.range[1])
      throw new Error(
        `Standpoint: voice ${k + 1} (${p.name}) walks from ${lo} to ${hi}, outside ${p.range[0]}–${p.range[1]}; move the Standpoint or take fewer Passes`,
      );
  });

  const step = v.between * atomOf(familyOf(v.family));
  const last = steps * step;
  const end = last + 2 * TICKS;
  const bar = 4 * TICKS;
  // A constant p; the last note (the last meeting) fades to nothing over its two beats.
  const dynamics = curve([
    { at: 0, level: 3 },
    { at: last, level: 3, ramp: true },
    { at: end, level: 0 },
  ]);
  const parts = voices.map((xs, k) =>
    part(
      PLAYERS[k]!,
      xs.map((m, i) => note(i * step, i < steps ? step : end - last, m)),
      dynamics,
    ),
  );
  return scoreOf(
    "antara · palette A · other orders, the same place",
    Math.ceil(end / bar),
    v.tempo,
    parts,
  );
}

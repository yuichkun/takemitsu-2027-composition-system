// antara palette, A (texture): the name of a between.
//
// One line: a standpoint plus the betweens a rule draws from a set of five sizes. Each size is
// bound, from the first note to the last, to one instrument: the between the line has just moved by
// decides who plays the note it lands on. The same size again, the same instrument again, whatever
// the direction, the pitch it lands on or its place in the round. The instruments are names that
// follow the betweens: the line is computed first and is not altered by who plays it. One player at
// a time, never doubled, flat mp, one way of playing for each (the trumpet muted, the cello
// pizzicato, the rest ordinary).
//
// The line: the five sizes, smallest first, take their signs by place (1st, 3rd, 5th up; 2nd and
// 4th down). The rule draws them "shift each time" (each round starts one place later); the 1st and
// 3rd rounds read the drawn group as it is, the 2nd and 4th read it backwards with every sign turned,
// so every two rounds add up to 0 and the line does not drift. Four rounds, twenty steps, each size
// four times. The standpoint has no between before it, so it has no name and is not sounded: the
// first note heard is the first step's.
// Card: README.md.

import type { NoteEvent } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { fold, gridOf, note, part, scoreOf, TICKS, type Player } from "../../common.ts";

export const knobs = {
  betweens: betweenSet({
    group: "Line",
    label: "Betweens",
    help: "Five sizes (semitones, .5 for a quarter tone), one for each instrument, smallest first: muted trumpet, cello pizzicato, flute, marimba, viola. The 1st, 3rd and 5th go up, the 2nd and 4th down (the 2nd and 4th rounds turn every sign)",
    value: "2.5 3.5 4.5 5.5 6.5",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  standpoint: pitch({
    group: "Line",
    label: "Standpoint",
    help: "Where the line starts. It has no between before it, so no instrument names it and it is not sounded; the line folds by octaves into an octave either side of it",
    value: "Bb4",
    min: "C4",
    max: "C5",
    step: 0.5,
  }),
  time: number({
    group: "Time",
    label: "Time between",
    help: "The one time between of the line (a pulse), in atoms of the family: nothing happens in time, so the only change heard is who plays",
    value: 5,
    min: 1,
    max: 24,
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
    value: 54,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

const ROUNDS = 4;

// The names, from the smallest between to the widest.
const NAMES: Player[] = [
  {
    id: "tpt",
    instrument: "trumpet",
    name: "Trumpet",
    abbreviation: "Tpt.",
    range: [54, 84],
    grids: [0, 1],
    technique: "muted",
  },
  {
    id: "vc",
    instrument: "cellos",
    name: "Cello (solo)",
    abbreviation: "Vc.",
    players: 1,
    range: [36, 84],
    grids: [0, 1],
    technique: "pizz",
  },
  {
    id: "fl",
    instrument: "flute",
    name: "Flute",
    abbreviation: "Fl.",
    range: [59, 98],
    grids: [0, 1],
  },
  {
    id: "mar",
    instrument: "marimba",
    name: "Marimba",
    abbreviation: "Mar.",
    range: [45, 96],
    grids: [0],
  },
  {
    id: "va",
    instrument: "violas",
    name: "Viola (solo)",
    abbreviation: "Va.",
    players: 1,
    range: [48, 91],
    grids: [0, 1],
  },
];
const SCORE_ORDER = ["fl", "tpt", "mar", "va", "vc"];

/** The steps of the line: the signed set drawn round by round, every other round backwards and turned. */
function stepsOf(sizes: number[]): number[] {
  const signed = sizes.map((b, i) => (i % 2 === 0 ? b : -b));
  const out: number[] = [];
  for (let r = 0; r < ROUNDS; r++) {
    const s = r % signed.length;
    const drawn = [...signed.slice(s), ...signed.slice(0, s)];
    out.push(...(r % 2 === 0 ? drawn : drawn.reverse().map((b) => -b)));
  }
  return out;
}

export function score(v: Values<typeof knobs>) {
  const sizes = [...v.betweens].sort((a, b) => a - b);
  if (sizes.length !== NAMES.length || new Set(sizes).size !== sizes.length)
    throw new Error(`Betweens: give ${NAMES.length} different sizes, one for each instrument`);
  const steps = stepsOf(sizes);
  const range: [number, number] = [v.standpoint - 12, v.standpoint + 12];
  const pulse = v.time * atomOf(familyOf(v.family));

  const events = NAMES.map(() => [] as NoteEvent[]);
  let midi = v.standpoint;
  steps.forEach((b, k) => {
    midi = fold(midi + b, range);
    const who = sizes.indexOf(Math.abs(b));
    const p = NAMES[who]!;
    if (!p.grids.includes(gridOf(midi)))
      throw new Error(
        `${p.name} names the between ${Math.abs(b)}, but step ${k + 1} lands on ${midi}, ` +
          `a quarter tone off the only grid it holds. Change the standpoint or the betweens`,
      );
    events[who]!.push(note(k * pulse, pulse, midi, p.technique ? { technique: p.technique } : {}));
  });

  const bar = 4 * TICKS;
  const bars = Math.ceil((steps.length * pulse) / bar);
  const dynamics = [{ at: 0, level: 4 }];
  const parts = SCORE_ORDER.map((id) => {
    const i = NAMES.findIndex((p) => p.id === id);
    return part(NAMES[i]!, events[i]!, dynamics);
  });
  return scoreOf("antara · palette A · the name of a between", bars, v.tempo, parts);
}

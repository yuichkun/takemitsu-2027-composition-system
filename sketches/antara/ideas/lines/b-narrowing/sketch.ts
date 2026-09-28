// antara, the vertical and the horizontal line, B (pitch): the betweens narrow by quarter tones.
//
// A solo violin walks upward, each note the last one plus a between drawn from a set of rising
// betweens. At every stage, every between in the set becomes one quarter tone narrower (0 stays 0).
// The climb gets smaller step by step, through quarter-tone steps (with .5 the line crosses to the
// other grid at every step; without, it stays), until every between is 0 and one note is played
// again and again. Its rhythm keeps moving, drawn from a set of time betweens.
// Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { fold, note, part, scoreOf, stream, TICKS, time, type Player } from "../common.ts";

export const knobs = {
  set: betweenSet({
    group: "Pitch",
    label: "Rising set",
    help: "The betweens the line climbs by at first (semitones, .5 for a quarter tone). Each stage, all of them one quarter tone narrower",
    value: "1.5 2.5 3.5",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  start: pitch({
    group: "Pitch",
    label: "Start",
    help: "The first note",
    value: "G3",
    min: "G3",
    max: "G5",
    step: 0.5,
  }),
  notes: number({
    group: "Pitch",
    label: "Notes per stage",
    help: "How many notes each state of the set lasts",
    value: 6,
    min: 2,
    max: 16,
    step: 1,
  }),
  rhythm: betweenSet({
    group: "Time",
    label: "Rhythm",
    help: "The time betweens of the line, in atoms of the family, drawn by combinations two at a time",
    value: "2 3 3 4",
    min: 1,
    max: 16,
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
    value: 72,
    min: 40,
    max: 140,
    step: 2,
    unit: "bpm",
  }),
};

const VIOLIN: Player = {
  id: "vn",
  instrument: "violins-1",
  name: "Violin (solo)",
  abbreviation: "Vn.",
  players: 1,
  range: [55, 93],
  grids: [0, 1],
};

export function score(v: Values<typeof knobs>) {
  const atom = atomOf(familyOf(v.family));
  const rhythm = stream(v.rhythm, "combinations", 2);
  // Stages: the set narrowed by one quarter tone at a time, until all 0; then one stage of 0 alone.
  const stages: number[][] = [];
  for (let s = 0; ; s++) {
    const set = v.set.map((b) => Math.max(0, b - 0.5 * s));
    stages.push(set);
    if (set.every((b) => b === 0)) break;
  }
  stages.push(stages.at(-1)!);
  const events = [];
  let t = 0;
  let midi = v.start;
  for (const set of stages) {
    const step = stream(
      [...set].sort((a, b) => a - b),
      "shift each time",
      1,
    );
    for (let k = 0; k < v.notes; k++) {
      const d = rhythm() * atom;
      events.push(note(t, d, midi));
      t += d;
      midi = fold(midi + step(), VIOLIN.range);
    }
  }
  const bars = Math.ceil(t / (4 * TICKS));
  // A little louder while it climbs, then quieter as it settles on one note.
  const dynamics = [
    { at: 0, level: 4.5, to: "linear" as const },
    { at: time(Math.round(t * 0.5)), level: 5, to: "linear" as const },
    { at: time(t), level: 3 },
  ];
  return scoreOf("antara · B · the betweens narrow", bars, v.tempo, [
    part(VIOLIN, events, dynamics),
  ]);
}

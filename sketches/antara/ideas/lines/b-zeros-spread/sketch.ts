// antara, the vertical and the horizontal line, B (pitch): zeros spread through the set.
//
// A flute and a clarinet take turns, note by note, in one line that climbs by a set of rising
// betweens. The betweens keep their sizes; instead, at every stage one more 0 joins the set. A
// between written twice comes up twice as often, so the rule draws 0 more and more: the climb
// begins to tread on the same note, the treading grows longer, and at the last stage only 0 is
// left: one note, handed back and forth between the two. Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { fold, note, part, scoreOf, stream, TICKS, time, type Player } from "../common.ts";

export const knobs = {
  set: betweenSet({
    group: "Pitch",
    label: "Rising set",
    help: "The betweens the line climbs by (semitones, .5 for a quarter tone). They keep their sizes; 0s join them",
    value: "1.5 2 3.5",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  zeros: number({
    group: "Pitch",
    label: "Zeros",
    help: "How many 0s have joined the set by the last stage before only 0 is left (one more at each stage)",
    value: 6,
    min: 1,
    max: 12,
    step: 1,
  }),
  start: pitch({
    group: "Pitch",
    label: "Start",
    help: "The first note",
    value: "D4",
    min: "C4",
    max: "C6",
    step: 0.5,
  }),
  notes: number({
    group: "Pitch",
    label: "Notes per stage",
    help: "How many notes each state of the set lasts",
    value: 8,
    min: 2,
    max: 16,
    step: 1,
  }),
  rhythm: betweenSet({
    group: "Time",
    label: "Rhythm",
    help: "The time betweens of the line, in atoms of the family, drawn by combinations two at a time",
    value: "2 2 3 5",
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the rhythm counts in",
    value: FAMILY_OPTIONS[0]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 80,
    min: 40,
    max: 140,
    step: 2,
    unit: "bpm",
  }),
};

const PLAYERS: Player[] = [
  { id: "fl", instrument: "flute", range: [62, 88], grids: [0, 1] },
  { id: "cl", instrument: "clarinet", range: [62, 88], grids: [0, 1] },
];

export function score(v: Values<typeof knobs>) {
  const atom = atomOf(familyOf(v.family));
  const rhythm = stream(v.rhythm, "combinations", 2);
  // Stage s has s zeros among the rising betweens; the last stage has only 0.
  const stages: number[][] = [];
  for (let s = 0; s <= v.zeros; s++) stages.push([...Array<number>(s).fill(0), ...v.set]);
  stages.push([0]);
  const events: ReturnType<typeof note>[][] = [[], []];
  let t = 0;
  let n = 0;
  let midi = v.start;
  for (const set of stages) {
    const step = stream(set, "shift each time", 1);
    for (let k = 0; k < v.notes; k++, n++) {
      const d = rhythm() * atom;
      events[n % 2]!.push(note(t, d, midi));
      t += d;
      midi = fold(midi + step(), PLAYERS[0]!.range);
    }
  }
  const bars = Math.ceil(t / (4 * TICKS));
  const dynamics = [
    { at: 0, level: 4.5, to: "linear" as const },
    { at: time(t), level: 3 },
  ];
  return scoreOf(
    "antara · B · zeros spread through the set",
    bars,
    v.tempo,
    PLAYERS.map((p, i) => part(p, events[i]!, dynamics)),
  );
}

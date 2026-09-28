// antara palette, A (texture): the standpoint names the side.
//
// The quarter-tone grid is two semitone grids a quarter tone apart. Which of the two is "this side"
// is not in the pitches: it is a name given from where one stands. A tone whose between to the
// standpoint is a whole number of semitones stands on the standpoint's side; a tone whose between
// ends in .5 stands on the other side.
//
// Ten divided string parts hold one chord (its betweens stacked bottom up, in the order written)
// and never change pitch. The standpoint is the contrabasses, below the chord: they start on one
// pitch and walk by the steps of the Walk, in the order written, one step per hold. Each chord
// tone's colour is the name of its side: sul tasto on the standpoint's side, sul ponticello on the
// other (or the other way round). When the standpoint takes a step with .5, every tone of the chord
// changes side at once, and all ten parts take the other bow position on the same pitch, together,
// at the step. A step without .5 changes nothing: the chord goes on as it was, not even re-bowed.
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
import { curve, divisi, note, part, scoreOf, TICKS, type Player } from "../../common.ts";

const SIDES = ["tasto | pont", "pont | tasto"];
/**
 * The chord's lowest tone. Only the betweens to the standpoint matter, and the Standpoint knob
 * moves those; this only keeps the chord in the divided strings, above where the basses walk.
 */
const CHORD_FROM = 50;
const BASSES: [number, number] = [28, 67];

export const knobs = {
  chord: text({
    group: "Chord",
    label: "Chord",
    help: "The betweens of the chord, bottom up in the order written (semitones, .5 for a quarter tone), stacked from D3. No tone of the chord ever changes pitch",
    value: "2 3.5 5 2.5 3 1 4.5 1.5 4",
  }),
  sides: choice({
    group: "Chord",
    label: "Sides",
    help: "The colours of the two sides: the standpoint's side | the other side",
    value: SIDES[0]!,
    options: SIDES,
  }),
  start: pitch({
    group: "Standpoint",
    label: "Standpoint",
    help: "Where the contrabasses start",
    value: 34,
    min: "E1",
    max: "C3",
    step: 0.5,
  }),
  walk: text({
    group: "Standpoint",
    label: "Walk",
    help: "The standpoint's steps, in the order written (semitones, signed, .5 for a quarter tone). A step with .5 puts every tone of the chord on the other side; a step without .5 changes nothing",
    value: "2 -1.5 0.5 -1 3.5 -3",
  }),
  holds: text({
    group: "Time",
    label: "Holds",
    help: "How long each standpoint lasts, in atoms of the family, in the order written (again from the first if the walk is longer)",
    value: "15 11 18 13 16 12 17",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the holds count in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 46,
    min: 30,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

const numbers = (label: string, value: string) => numbersOf(label, value.replaceAll("−", "-"));
const onQuarterTones = (label: string, xs: number[]) => {
  if (xs.some((x) => !Number.isInteger(x * 2)))
    throw new Error(`${label}: betweens are semitones on the quarter-tone grid (2, 3.5, -1.5)`);
  return xs;
};

/** 0 when a tone stands on the standpoint's side (a whole number of semitones away), 1 when not. */
const sideOf = (tone: number, standpoint: number) =>
  Math.abs(Math.round((tone - standpoint) * 2)) % 2;

export function score(v: Values<typeof knobs>) {
  const chord = onQuarterTones("Chord", numbers("Chord", v.chord));
  if (chord.some((b) => b < 0)) throw new Error("Chord: the betweens go up (0 or more)");
  const walk = onQuarterTones("Walk", numbers("Walk", v.walk));
  const holds = numbers("Holds", v.holds);
  if (holds.some((h) => !Number.isInteger(h) || h < 1))
    throw new Error("Holds: whole numbers of atoms, 1 or more");
  const atom = atomOf(familyOf(v.family));
  const [near, far] = v.sides === SIDES[0] ? ["sul-tasto", "sul-pont"] : ["sul-pont", "sul-tasto"];

  const tones = [CHORD_FROM];
  for (const b of chord) tones.push(tones.at(-1)! + b);

  // The standpoints, each from where it begins.
  const stands: { at: number; midi: number }[] = [];
  let at = 0;
  let here = v.start;
  for (let i = 0; i <= walk.length; i++) {
    if (i > 0) here += walk[i - 1]!;
    if (here < BASSES[0] || here > BASSES[1])
      throw new Error(`Walk: the standpoint leaves the contrabasses (${here})`);
    stands.push({ at, midi: here });
    at += holds[i % holds.length]! * atom;
  }
  const sound = at;
  const last = stands.at(-1)!.at;
  const bar = 4 * TICKS;
  const end = Math.ceil(sound / bar) * bar;

  // Each chord part keeps its pitch; it starts a new note only where its side changes.
  const players = divisi(tones.map((t): [number, number] => [t, t]));
  const chordParts = tones.map((x, k) => {
    const runs: { at: number; side: number }[] = [];
    for (const s of stands) {
      const side = sideOf(x, s.midi);
      if (runs.at(-1)?.side !== side) runs.push({ at: s.at, side });
    }
    const events = runs.map((r, i) =>
      note(r.at, (runs[i + 1]?.at ?? sound) - r.at, x, { technique: r.side === 0 ? near : far }),
    );
    // From nothing to pp, held, and gone over the last hold.
    const dynamics = curve([
      { at: 0, level: 0, ramp: true },
      { at: Math.min(4 * TICKS, last), level: 2 },
      { at: last, level: 2, ramp: true },
      { at: sound, level: 0 },
    ]);
    return part(players[k]!, events, dynamics);
  });

  // The standpoint: a new note at every step, p, gone over the last hold with the chord.
  const midis = stands.map((s) => s.midi);
  const basses: Player = {
    id: "cb",
    instrument: "basses",
    name: "Contrabasses",
    abbreviation: "Cb.",
    players: 8,
    range: [Math.min(...midis), Math.max(...midis)],
    grids: [0, 1],
  };
  const bassEvents = stands.map((s, i) =>
    note(s.at, (stands[i + 1]?.at ?? sound) - s.at, s.midi, { articulations: ["tenuto"] }),
  );
  const bassDynamics = curve([
    { at: 0, level: 3 },
    { at: last, level: 3, ramp: true },
    { at: sound, level: 0 },
  ]);

  // Score order: high to low.
  return scoreOf("antara · palette A · the standpoint names the side", end / bar, v.tempo, [
    ...chordParts.reverse(),
    part(basses, bassEvents, bassDynamics),
  ]);
}

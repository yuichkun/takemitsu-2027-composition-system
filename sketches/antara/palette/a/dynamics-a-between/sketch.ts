// antara palette, A (dynamics): loudness is a between.
//
// The rule of writing (a between, a set, a rule; docs/antara/sound.md) carried to a fourth axis,
// loudness. Pitch and time are frozen: one cello plays one pitch throughout (a pitch set holding
// only 0), one bow stroke per bar (a time set holding one between, 16 sixteenths). The only thing
// that changes is the loudness, and it changes only by betweens.
//
// The loudness scale is the score's: 0 (niente) to 8 (fff), nine points. Its atom is one mark:
// notation rounds a level to the nearest mark, so no smaller step can be written. A between of
// loudness is a number of marks, up (+) or down (−). The line starts on a standpoint and walks on,
// adding the betweens a rule draws from a set, one per bar. A level that leaves the scale is moved
// back into it by the scale's whole width (8), the way a pitch is folded by an octave; so a small
// between that crosses an end is heard as a large jump the other way. Each bar holds its level and
// the next bar starts on the new one (a step at the bar line, never a hairpin), so every between is
// heard as one jump.
//
// Two passes: the first reads the set in the order written, the second in the reverse order,
// walking on from where the first ended. With the default set (sum 0) and standpoint (the middle
// of the scale), each pass comes back to the standpoint, and the second pass is the first turned
// upside down about the standpoint and played backwards.
//
// Framing: the first stroke comes out of niente in one beat; one more bar at the last level fades
// to niente.
// Card: README.md.

import type { NoteEvent } from "../../../../../src/score/types.ts";
import { number, numbersOf, text, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

/** The loudness scale: 0 = niente … 8 = fff. */
const LO = 0;
const HI = 8;

export const knobs = {
  set: text({
    group: "Loudness",
    label: "Set",
    help: "The betweens of loudness, in marks (1 mark: one step of the scale, e.g. p to mp), − for down, in the order written. The first pass reads them as written, the second reversed. A set whose sum is 0 brings each pass back to where it started. Written as text to keep the order",
    value: "-1 -4 2 3",
  }),
  anchor: number({
    group: "Loudness",
    label: "Standpoint",
    help: "The level the walk starts from (0 niente … 8 fff), held in the first bar",
    value: 4,
    min: LO,
    max: HI,
    step: 1,
    unit: "marks",
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute. One bow stroke, one level, per bar",
    value: 54,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

/** One cello, solo. */
const CELLO: Player = {
  id: "vc",
  instrument: "cellos",
  name: "Violoncello (solo)",
  abbreviation: "Vc.",
  players: 1,
  range: [36, 84],
  grids: [0, 1],
};
/** The one pitch: the middle of the cello's range (36–84), a stopped note. */
const PITCH = (CELLO.range[0] + CELLO.range[1]) / 2;

/**
 * Moves a level back into the scale by the scale's whole width, as a pitch is folded by octaves;
 * the ends themselves (0 and 8) stay where they are.
 */
function wrap(level: number): number {
  const span = HI - LO;
  let q = level;
  while (q > HI) q -= span;
  while (q < LO) q += span;
  return q;
}

export function score(v: Values<typeof knobs>) {
  const set = numbersOf("Set", v.set.replaceAll("−", "-"));
  if (set.length === 0) throw new Error("Set: write at least one between (e.g. -1 -4 2 3)");
  if (set.some((b) => !Number.isInteger(b) || Math.abs(b) > HI - LO))
    throw new Error("Set: betweens are whole marks, from -8 to 8 (the atom is one mark)");

  // The walk: the standpoint, then one level per between, the set as written and then reversed.
  const levels = [v.anchor];
  let level = v.anchor;
  for (const reading of [set, [...set].reverse()]) {
    const next = stream(reading, "in order", 1);
    for (let i = 0; i < reading.length; i++) {
      level = wrap(level + next());
      levels.push(level);
    }
  }

  // Time: a set holding one between, 16 atoms of the family of 2 (sixteenths): one stroke a bar.
  const stroke = 16 * atomOf(2);
  const bar = 4 * TICKS;
  if (stroke !== bar) throw new Error("the stroke should last one bar");

  // Each level held for one stroke; one more stroke at the last level fades to niente. A level of
  // 0 is niente: that bar is silent.
  const held = [...levels, levels.at(-1)!];
  const events: NoteEvent[] = [];
  held.forEach((l, k) => {
    if (l > LO) events.push(note(k * stroke, stroke, PITCH));
  });
  const last = levels.length * stroke;
  const points = [
    { at: 0, level: 0, ramp: true },
    { at: TICKS, level: levels[0]! },
    ...levels.slice(1).map((l, k) => ({ at: (k + 1) * stroke, level: l })),
    { at: last, level: levels.at(-1)!, ramp: true },
    { at: last + stroke, level: 0 },
  ];

  const out = scoreOf("antara · palette A · loudness as a between", held.length, v.tempo, [
    part(CELLO, events, curve(points)),
  ]);
  out.rehearsal = [{ measure: 2 + set.length, label: "reversed" }];
  return out;
}

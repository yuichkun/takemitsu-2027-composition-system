// antara palette, A (pitch): a chord cut from both ends.
//
// The chord is not betweens stacked on a standpoint but one wide between, the frame (two held
// voices), cut again and again. The rule takes the betweens of the cut set in turn. At each step the
// widest between of the chord (the widest cut no term stands on yet; the lowest one on a tie) is cut
// by the next between c: a new voice enters c above the between's lower end, or c below its upper
// end, the two ends taking turns as the standpoint the cut is measured from. The widest between b
// becomes c (a between of the set) and b - c (a between the set does not hold, defined here by the
// cuts). Every other voice holds; no voice ever moves. When the next c is as wide as the widest
// between or wider, the chord is full. Measured from both ends, the voices fill the frame from the
// outside in, and the last between left in the middle is decided by every cut made before it.
//
// Then the cuts close in the order they opened: the voices leave in the order they entered, one per
// step, and each departure merges the two betweens on either side of it into their sum, until only
// the frame is left. One time between (a set holding one between) paces every cut and departure, so
// the time side stays still and only the betweens change.
//
// The voices are divided strings (divisi() of common.ts), all ordinary arco and pp, one colour, so
// only where the frame is cut is heard. A voice enters at p and settles to pp over a beat, so it can
// be placed; a leaving voice fades out over a beat. Each staff name says whether the voice is the
// frame or which cut it is.
// Card: README.md.

import type { Part } from "../../../../../src/score/types.ts";
import {
  betweenSet,
  choice,
  number,
  pitch,
  toggle,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, divisi, note, part, scoreOf, stream, TICKS } from "../../common.ts";

const RULE_OPTIONS = ["in order", "shift each time"];
const SIDES = ["below and above in turn", "below only"];

/**
 * Whether the divided strings can take a chord of these voices: divisi() hands them out by register,
 * and every part must keep two players or more (so no section is divided past half its players).
 * Cutting stops there too; with the default values it is never reached.
 */
function stringsTake(chord: number[]): boolean {
  return divisi(chord.map((p): [number, number] => [p, p])).every((p) => (p.players ?? 0) >= 2);
}

// Default values, by structure. The frame is 22.5 semitones wide: with .5 its two ends stand on
// different grids, and the voices fit inside it within the divided strings (the lower end in the
// cellos' register, the upper in the violins'). The cut set holds four betweens of four different
// sizes, two with .5 and two without; their sum is 11. 22.5 is the narrowest frame with .5 that
// takes the set twice round (22) in the middle, so the cuts from the two ends meet one atom apart:
// the remainder there (0.5) is a between the set does not hold, fixed by the width and the sum, not
// a quarter tone put there for its sound. The time between is 6 atoms of family 3 (two beats, two
// seconds at 60): one between only, so no time rule is heard, and each new voice and the new width
// of the remainder have time to settle.
export const knobs = {
  bottom: pitch({
    group: "Frame",
    label: "Bottom",
    help: "The lower end of the frame: the lowest voice, held from the first beat to the last",
    value: "D3",
    min: "C2",
    max: "C4",
    step: 0.5,
  }),
  span: number({
    group: "Frame",
    label: "Span",
    help: "The frame: the one wide between the chord is cut from (the upper end is the bottom plus this). With .5 the two ends stand on different grids",
    value: 22.5,
    min: 6,
    max: 36,
    step: 0.5,
    unit: "st",
  }),
  cuts: betweenSet({
    group: "Cuts",
    label: "Cut set",
    help: "The betweens the frame is cut by (semitones, .5 for a quarter tone), taken narrowest first. Each cut leaves one of them and a remainder",
    value: "1.5 2.5 3 4",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  rule: choice({
    group: "Cuts",
    label: "Rule",
    help: "in order: the set narrowest first, again and again · shift each time: the same, starting one later each time round",
    value: RULE_OPTIONS[0]!,
    options: RULE_OPTIONS,
  }),
  sides: choice({
    group: "Cuts",
    label: "Measured from",
    help: "Which end of the widest between a cut is measured from. In turn: the lower end, then the upper, and so on (the frame fills from both ends toward the middle). Below only: always the lower end, so the first cuts stack the set on the bottom as a chord built on a standpoint would (for comparison)",
    value: SIDES[0]!,
    options: SIDES,
  }),
  close: toggle({
    group: "Cuts",
    label: "Close",
    help: "When the chord is full, the cuts close in the order they opened (the voices leave in the order they entered) until only the frame is left. Off: the full chord holds and fades",
    value: true,
  }),
  between: number({
    group: "Time",
    label: "Time between",
    help: "The time from one cut (or departure) to the next, in atoms of the family: a time set holding one between",
    value: 6,
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
    group: "Time",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 60,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

export interface Cut {
  /** The pitch of the new voice. */
  midi: number;
  /** The between of the set it was cut by. */
  c: number;
  /** Which end of the widest between it was measured from. */
  from: "below" | "above";
  /** The widest between it cut, as its lower and upper pitch. */
  cut: [number, number];
  /** What is left of that between besides c. */
  remainder: number;
}

/**
 * Cuts the frame [lo, hi]. At each step the next c is drawn; the widest between of the chord (the
 * lowest one on a tie) is cut by it, measured from its lower end or its upper end as `fromAbove`
 * says for that step. It stops when c is as wide as the widest between or wider (the chord is
 * full), or when `room` says the chord with the new voice could not be played.
 */
export function cutFrame(
  lo: number,
  hi: number,
  next: () => number,
  fromAbove: (step: number) => boolean,
  room: (chord: number[]) => boolean,
): Cut[] {
  const chord = [lo, hi];
  const out: Cut[] = [];
  for (;;) {
    let at = 0;
    for (let i = 1; i < chord.length - 1; i++)
      if (chord[i + 1]! - chord[i]! > chord[at + 1]! - chord[at]!) at = i;
    const [a, b] = [chord[at]!, chord[at + 1]!];
    const c = next();
    if (c >= b - a) break;
    const above = fromAbove(out.length + 1);
    const midi = above ? b - c : a + c;
    const grown = [...chord.slice(0, at + 1), midi, ...chord.slice(at + 1)];
    if (!room(grown)) break;
    out.push({ midi, c, from: above ? "above" : "below", cut: [a, b], remainder: b - a - c });
    chord.splice(at + 1, 0, midi);
  }
  return out;
}

interface Voice {
  midi: number;
  /** 0 for the two frame voices, else which cut it is (1 for the first). */
  entry: number;
  at: number;
  /** When it starts to fade out (undefined: it holds to the end). */
  leave?: number;
}

export function score(v: Values<typeof knobs>) {
  const bar = 4 * TICKS;
  const step = v.between * atomOf(familyOf(v.family));
  const inTurn = v.sides === SIDES[0];
  const lo = v.bottom;
  const hi = v.bottom + v.span;
  const cuts = cutFrame(
    lo,
    hi,
    stream(v.cuts, v.rule, 1),
    (k) => inTurn && k % 2 === 0,
    stringsTake,
  );

  // One cut per time between, from one time between after the frame; the full chord holds for two
  // time betweens (the step where the rule stops, and one more); then one departure per time
  // between, in the order of entry. A leaving voice fades out over a beat.
  const voices: Voice[] = [
    { midi: lo, entry: 0, at: 0 },
    { midi: hi, entry: 0, at: 0 },
    ...cuts.map((x, i) => ({ midi: x.midi, entry: i + 1, at: (i + 1) * step })),
  ];
  const closing = (cuts.length + 2) * step;
  let gone = closing;
  if (v.close)
    for (const x of voices)
      if (x.entry > 0) {
        x.leave = closing + (x.entry - 1) * step;
        gone = x.leave + TICKS;
      }
  // What is left (the frame, or the full chord) holds alone from the next bar line for a bar and
  // fades out over the bar after.
  const alone = Math.ceil(gone / bar) * bar;
  const fade = alone + bar;
  const end = fade + bar;

  // divisi() takes the voices low to high.
  const byPitch = [...voices].sort((a, b) => a.midi - b.midi);
  const players = divisi(byPitch.map((x): [number, number] => [x.midi, x.midi]));
  const parts: Part[] = byPitch.map((x, i) => {
    const p = players[i]!;
    const stop = x.leave === undefined ? end : x.leave + TICKS;
    const settled = Math.min(x.at + TICKS, x.leave ?? end);
    const points = [
      { at: x.at, level: 3, ramp: true },
      { at: settled, level: 2 },
    ];
    if (x.leave === undefined)
      points.push({ at: fade, level: 2, ramp: true }, { at: end, level: 0 });
    else points.push({ at: x.leave, level: 2, ramp: true }, { at: stop, level: 0 });
    const name = x.entry === 0 ? "frame" : `cut ${x.entry}`;
    return part(
      { ...p, name: `${p.name} (${name})` },
      [note(x.at, stop - x.at, x.midi)],
      curve(points),
    );
  });
  // Score order: high to low.
  return scoreOf(
    "antara · palette A · a chord cut from both ends",
    end / bar,
    v.tempo,
    parts.reverse(),
  );
}

// antara palette, A (pitch): the terms stand where the betweens touch.
//
// A chord is a standpoint with betweens stacked on it: usually the terms come first, and a between
// is what is added to one term to reach the next. Here the order is turned round. Each between of
// the chord sounds first, as a pair: two divided string voices entering together (a time between
// of 0) and already gliding. Both voices of a pair slide the same distance in the same time, so
// the size of the between stays the same all through the slide while neither of its two tones
// stops anywhere. A pair stops only when one of its edges reaches a tone that is already standing,
// or the edge of the other pair (a pitch between of 0): at that instant both its tones stop and
// hold, and become terms. No standpoint is sounded: the first term is where the first two pairs
// touch.
//
// The chord's betweens are written as two arms from that first term: the lower arm going down, the
// upper arm going up, each narrowest nearest the first term. The first pair of each arm starts at
// once, each displaced away from the other by its own size (the only length a pair has), and they
// touch after the approach time. From then on one pair at a time, alternately from the upper arm
// and the lower arm, inner to outer, starts at the instant the previous one touches, displaced
// outward from the chain's current top (or bottom) by its own size, and touches it after the same
// approach time. So the touches fall on a pulse (a time set holding one between) and each touch
// defines one new term. The two tones that touch sound the same pitch, so the inner terms are
// played by two voices and the outer two by one. A pair comes in from niente and reaches pp at its
// touch; after the last touch the chord holds two bars at pp and every voice stops together.
// Card: README.md.

import type { TextEvent } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, divisi, note, part, scoreOf, TICKS, time } from "../../common.ts";

/** Where the string sections reach, low (basses) to high (first violins). */
const STRINGS: [number, number] = [28, 103];

export const knobs = {
  lower: betweenSet({
    group: "Chord",
    label: "Lower arm",
    help: "The betweens of the chord below the first term, narrowest nearest it (semitones, .5 for a quarter tone). Each is a pair of voices that glides up into place",
    value: "1 2.5 4 5.5",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  upper: betweenSet({
    group: "Chord",
    label: "Upper arm",
    help: "The betweens of the chord above the first term, narrowest nearest it (semitones, .5 for a quarter tone). Each is a pair of voices that glides down into place",
    value: "1.5 3 4.5 6",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  contact: pitch({
    group: "Chord",
    label: "First contact",
    help: "Where the first pair of each arm touch: the first term. Nothing stands there, or anywhere, until they touch",
    value: 68.5,
    min: "C3",
    max: "C6",
    step: 0.5,
  }),
  approach: number({
    group: "Time",
    label: "Approach",
    help: "How long each pair glides before it touches, in atoms of the family: also the one time between from one touch to the next",
    value: 12,
    min: 1,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the approach counts in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 50,
    min: 30,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

type V = Values<typeof knobs>;

/** One between of the chord, sounded as two voices that glide together until they touch. */
interface Pair {
  between: number;
  arm: "lower" | "upper";
  /** The low and the high tone where the pair enters, and where it stops. */
  from: [number, number];
  to: [number, number];
  /** In ticks. */
  enters: number;
  touches: number;
}

/** The pairs in the order they enter. */
function pairsOf(v: V, approach: number): Pair[] {
  if (v.lower.length === 0 || v.upper.length === 0)
    throw new Error(
      "Lower arm, Upper arm: each arm needs at least one between (the first term is where the two arms' first pairs touch)",
    );
  // The chain's current bottom and top: where the next pair of each arm will touch.
  let bottom = v.contact;
  let top = v.contact;
  const lower = (b: number, enters: number): Pair => {
    const to: [number, number] = [bottom - b, bottom];
    bottom -= b;
    // Displaced downward by its own size: it glides up by b.
    const from: [number, number] = [to[0] - b, to[1] - b];
    return { between: b, arm: "lower", from, to, enters, touches: enters + approach };
  };
  const upper = (b: number, enters: number): Pair => {
    const to: [number, number] = [top, top + b];
    top += b;
    // Displaced upward by its own size: it glides down by b.
    const from: [number, number] = [to[0] + b, to[1] + b];
    return { between: b, arm: "upper", from, to, enters, touches: enters + approach };
  };
  const out = [lower(v.lower[0]!, 0), upper(v.upper[0]!, 0)];
  // Then one at a time, upper arm and lower arm in turn, each entering as the one before touches.
  let t = approach;
  for (let k = 1; k < Math.max(v.lower.length, v.upper.length); k++) {
    if (k < v.upper.length) {
      out.push(upper(v.upper[k]!, t));
      t += approach;
    }
    if (k < v.lower.length) {
      out.push(lower(v.lower[k]!, t));
      t += approach;
    }
  }
  return out;
}

const show = (b: number) => String(b);

export function score(v: V) {
  const bar = 4 * TICKS;
  const approach = v.approach * atomOf(familyOf(v.family));
  const pairs = pairsOf(v, approach);
  const last = Math.max(...pairs.map((p) => p.touches));
  // The whole chord holds two bars after the last touch, to a bar line.
  const end = Math.ceil((last + 2 * bar) / bar) * bar;

  const voices = pairs
    .flatMap((pair) =>
      ([0, 1] as const).map((tone) => ({ pair, tone, from: pair.from[tone], to: pair.to[tone] })),
    )
    .sort((a, b) => a.to - b.to || a.from - b.from);
  for (const x of voices)
    for (const m of [x.from, x.to])
      if (m < STRINGS[0] || m > STRINGS[1])
        throw new Error(
          `First contact: a voice reaches ${m}, outside the strings (${STRINGS[0]}–${STRINGS[1]}). Move the first contact or narrow the arms`,
        );

  // divisi() takes the voices low to high.
  const players = divisi(
    voices.map((x): [number, number] => [Math.min(x.from, x.to), Math.max(x.from, x.to)]),
  );
  const parts = voices.map((x, i) => {
    const p = players[i]!;
    const { pair } = x;
    const events = [
      // Enters already gliding, and stops where it touches.
      note(pair.enters, pair.touches - pair.enters, x.from, { gliss: true }),
      note(pair.touches, end - pair.touches, x.to),
    ];
    // From niente at the entry (the pitch it starts from is not heard as a term) to pp at the touch.
    const dynamics = curve([
      { at: pair.enters, level: 0, ramp: true },
      { at: pair.touches, level: 2 },
    ]);
    const where = pair.arm === "upper" ? "above" : "below";
    const out = part(
      {
        ...p,
        name: `${p.name} (pair ${show(pair.between)} ${where}, ${x.tone === 1 ? "upper" : "lower"} tone)`,
      },
      events,
      dynamics,
    );
    const mark: TextEvent = { type: "text", at: time(pair.enters), text: "non vib." };
    out.events.unshift(mark);
    return out;
  });
  // Score order: high to low.
  return scoreOf(
    "antara · palette A · the terms stand where the betweens touch",
    end / bar,
    v.tempo,
    parts.reverse(),
  );
}

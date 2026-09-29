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
// upper arm going up, each read in the order written, inner to outer (the order is the rule, and it
// is also the order the pairs enter, so it is the order of the glides' sizes and speeds). The first
// pair of each arm starts at once, each displaced away from the other by its own size (the only
// length a pair has), and they touch after the approach time. From then on one pair at a time,
// alternately from the upper arm and the lower arm, inner to outer, starts at the instant the
// previous one touches, displaced outward from the chain's current top (or bottom) by its own size,
// and touches it after the same approach time. So the touches fall on a pulse (a time set holding
// one between) and each touch defines one new term. The two tones that touch sound the same pitch,
// so the inner terms are played by two voices and the outer two by one. A pair comes in from niente
// and reaches pp once it has glided one quarter tone (the atom of pitch) away from where it came in,
// counted up to a whole atom of time, so the pitch it enters on is never heard at the level of a
// term, and the rest of the glide sounds as loud as each standing term. After the last touch the
// chord holds two bars at pp and every voice stops together.
// Card: README.md.

import type { TextEvent } from "../../../../../src/score/types.ts";
import {
  choice,
  number,
  numbersOf,
  onGrid,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, divisi, note, part, scoreOf, TICKS, time } from "../../common.ts";

/** Where the string sections reach, low (basses) to high (first violins). */
const STRINGS: [number, number] = [28, 103];

export const knobs = {
  lower: text({
    group: "Chord",
    label: "Lower arm",
    help: "The betweens of the chord below the first term, in the order written, inner to outer (semitones, .5 for a quarter tone, 0.5 to 12). Each is a pair of voices that glides up into place; the pairs of this arm enter in this order",
    value: "1 5.5 2.5 4",
  }),
  upper: text({
    group: "Chord",
    label: "Upper arm",
    help: "The betweens of the chord above the first term, in the order written, inner to outer (semitones, .5 for a quarter tone, 0.5 to 12). Each is a pair of voices that glides down into place; the pairs of this arm enter in this order",
    value: "1.5 6 3 4.5",
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

/** One arm, in the order written: quarter-tone steps from 0.5 to 12. */
function armOf(label: string, value: string): number[] {
  const arm = numbersOf(label, value.replaceAll("−", "-"));
  if (!arm.every((b) => onGrid(b, 0.5, 12, 0.5)))
    throw new Error(
      `${label}: each between is 0.5 to 12 semitones, in quarter tones (.5), e.g. 1 5.5 2.5 4`,
    );
  return arm;
}

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

/** The pairs in the order they enter. Each arm is read in the order written, inner to outer. */
function pairsOf(
  arms: { lower: number[]; upper: number[] },
  contact: number,
  approach: number,
): Pair[] {
  // The chain's current bottom and top: where the next pair of each arm will touch.
  let bottom = contact;
  let top = contact;
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
  const out = [lower(arms.lower[0]!, 0), upper(arms.upper[0]!, 0)];
  // Then one at a time, upper arm and lower arm in turn, each entering as the one before touches.
  let t = approach;
  for (let k = 1; k < Math.max(arms.lower.length, arms.upper.length); k++) {
    if (k < arms.upper.length) {
      out.push(upper(arms.upper[k]!, t));
      t += approach;
    }
    if (k < arms.lower.length) {
      out.push(lower(arms.lower[k]!, t));
      t += approach;
    }
  }
  return out;
}

const show = (b: number) => String(b);

export function score(v: V) {
  const bar = 4 * TICKS;
  const atom = atomOf(familyOf(v.family));
  const approach = v.approach * atom;
  const arms = { lower: armOf("Lower arm", v.lower), upper: armOf("Upper arm", v.upper) };
  const pairs = pairsOf(arms, v.contact, approach);
  const last = Math.max(...pairs.map((p) => p.touches));
  // The whole chord holds two bars after the last touch, to a bar line.
  const end = Math.ceil((last + 2 * bar) / bar) * bar;

  // Low to high by where each pair stops (the pairs make one chain, touching only at their ends),
  // then lower tone before upper: the two tones of a pair stay next to each other, so wherever
  // divisi() splits the sections between pairs (with four betweens in each arm it gives each
  // section two whole pairs) a pair is played by two neighbouring divisions of one section.
  const voices = pairs
    .flatMap((pair) =>
      ([0, 1] as const).map((tone) => ({ pair, tone, from: pair.from[tone], to: pair.to[tone] })),
    )
    .sort((a, b) => a.pair.to[0] - b.pair.to[0] || a.tone - b.tone);
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
    // From niente at the entry to pp once the pair has glided one quarter tone (the atom of pitch)
    // away from where it came in, counted up to a whole atom of time (never later than the touch).
    // So the pitch it enters on, which for the near tone is the pitch of the term it will add, is
    // never heard at the level of a term, and the rest of the glide sounds at pp, as loud as each
    // standing term: the between is heard before its terms stand.
    const fade = Math.min(v.approach, Math.ceil((0.5 * v.approach) / pair.between)) * atom;
    const dynamics = curve([
      { at: pair.enters, level: 0, ramp: true },
      { at: pair.enters + fade, level: 2 },
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

// antara palette, A (pitch): the betweens trade places.
//
// A chord of ten divided string voices is its betweens stacked on a standpoint. The betweens never
// change size here; they only trade places with their neighbours. Each trade moves exactly one
// voice (the one between the two, by their difference) while every other voice holds, and the
// lowest and highest voices never move. From the first chord to the last the chord has the same
// betweens; only their order changes, and with it which pitches stand where.
//
// The rule: the chord starts with its betweens in order of size, narrow at the bottom, and turns
// the order round. The widest between still out of place travels down, trading places with each
// neighbour below it in turn: one wave, one voice at a time from the top of the chord down. Then
// the next widest. At the end the chord is wide at the bottom and narrow at the top: the knot of
// narrow betweens has been carried from the bottom of the chord to the top.
// Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, divisi, note, part, scoreOf, stream, TICKS } from "../../common.ts";
import { apply, tones, waves } from "../../trade.ts";

const STARTS = ["narrow at the bottom", "wide at the bottom"];

export const knobs = {
  chord: betweenSet({
    group: "Chord",
    label: "Chord",
    help: "The betweens of the chord (semitones, .5 for a quarter tone). They keep their sizes; only their order changes",
    value: "0.5 1 1.5 2 5.5 6 6.5 7 7.5",
    min: 0,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  start: choice({
    group: "Chord",
    label: "Starts",
    help: "The order the chord starts in; it ends in the other. Narrow at the bottom: the wide betweens travel down, and every voice that moves, moves up",
    value: STARTS[0]!,
    options: STARTS,
  }),
  anchor: pitch({
    group: "Chord",
    label: "Standpoint",
    help: "The lowest voice. It never moves, and neither does the highest",
    value: "C3",
    min: "C2",
    max: "C4",
    step: 0.5,
  }),
  within: betweenSet({
    group: "Time",
    label: "Within a wave",
    help: "The time between one trade and the next inside a wave, in atoms of the family, taken in turn",
    value: "3 4",
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  apart: betweenSet({
    group: "Time",
    label: "Between waves",
    help: "The time before a wave begins, in atoms of the family, taken in turn",
    value: "6 9",
    min: 1,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time betweens count in",
    value: FAMILY_OPTIONS[1]!,
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

export function score(v: Values<typeof knobs>) {
  const atom = atomOf(familyOf(v.family));
  const within = stream(v.within, "shift each time", 1);
  const apart = stream(v.apart, "shift each time", 1);
  const narrowFirst = v.start === STARTS[0];
  let order = [...v.chord].sort((a, b) => (narrowFirst ? a - b : b - a));

  // Each voice's pitches, as (tick, midi), from the chord at 0.
  const voices = tones(v.anchor, order).map((m) => [{ at: 0, midi: m }]);
  let t = 0;
  let lastWave = -1;
  for (const trade of waves(order, narrowFirst)) {
    t += (trade.wave !== lastWave ? apart() : within()) * atom;
    lastWave = trade.wave;
    order = apply(order, trade);
    const now = tones(v.anchor, order);
    for (const pos of trade.pairs) voices[pos + 1]!.push({ at: t, midi: now[pos + 1]! });
  }
  const bar = 4 * TICKS;
  const end = Math.ceil((t + 2 * apart() * atom + 2 * TICKS) / bar) * bar;

  const ranges = voices.map((xs): [number, number] => [
    Math.min(...xs.map((x) => x.midi)),
    Math.max(...xs.map((x) => x.midi)),
  ]);
  const players = divisi(ranges);
  const glow = Math.round(1.5 * TICKS);
  const parts = voices.map((xs, k) => {
    const events = xs.map((x, i) => note(x.at, (xs[i + 1]?.at ?? end) - x.at, x.midi));
    // Held at p; a voice that has just moved is a little louder for a moment.
    const points = [
      { at: 0, level: 0, ramp: true },
      { at: TICKS, level: 3 },
    ];
    for (const [i, x] of xs.entries()) {
      if (i === 0) continue;
      const until = Math.min(xs[i + 1]?.at ?? end, x.at + glow, end - bar);
      points.push(
        { at: x.at, level: 4.5, ramp: true },
        { at: Math.max(until, x.at + 1), level: 3 },
      );
    }
    points.push({ at: end - bar, level: 3, ramp: true }, { at: end, level: 0 });
    return part(players[k]!, events, curve(points));
  });
  // Score order: high to low.
  return scoreOf(
    "antara · palette A · the betweens trade places",
    end / bar,
    v.tempo,
    parts.reverse(),
  );
}

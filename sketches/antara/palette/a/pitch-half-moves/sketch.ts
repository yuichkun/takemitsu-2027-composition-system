// antara palette, A (pitch): half the chord moves.
//
// A chord of eight divided string voices is every sum of a subset of three betweens (a, b, c)
// added to a standpoint: s, s+a, s+b, s+a+b, s+c, s+a+c, s+b+c, s+a+b+c. A voice is named by its
// subset (which betweens it adds), not by its place in the chord. Every between is a cut through
// the chord: it splits the eight voices into the four whose subset holds it and the four whose
// subset does not. Which side a voice is on depends on which between you look from.
//
// Each between has two sizes (the narrowest first size pairs with the narrowest second size, and
// so on). The rule changes one between at a time, in the fixed order a, b, a, c, a, b, a, c (the
// reflected binary order): the eight chords visit every combination of sizes once, and the ninth is
// the first again. When a between changes size, exactly the four voices whose subset holds it move,
// all by the same amount (the difference of its two sizes); the other four hold. The standpoint
// never moves; the top voice (s+a+b+c) moves every time.
//
// One time between only (every change the same distance after the last) and one colour (divided
// strings, plain bowing), so that only the pitch relations are heard. A held voice is not struck
// again; a moved voice starts a new note at its new pitch, a little louder for a moment.
// Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, divisi, note, part, scoreOf, TICKS } from "../../common.ts";

export const knobs = {
  first: betweenSet({
    group: "Chord",
    label: "First sizes",
    help: "The three betweens a, b, c at their first size, narrowest first (semitones, .5 for a quarter tone). The chord starts with all three at this size",
    value: "2.5 5.5 9.5",
    min: 0,
    max: 24,
    step: 0.5,
    unit: "st",
    anchor: "anchor",
  }),
  second: betweenSet({
    group: "Chord",
    label: "Second sizes",
    help: "The other size of each between, paired by rank with the first sizes (narrowest with narrowest). When a between changes, the four voices that add it move by the difference of its two sizes",
    value: "4 7.5 14",
    min: 0,
    max: 24,
    step: 0.5,
    unit: "st",
    anchor: "anchor",
  }),
  anchor: pitch({
    group: "Chord",
    label: "Standpoint",
    help: "The voice that adds no between: the lowest voice, which never moves",
    value: "C3",
    min: "C2",
    max: "C4",
    step: 0.5,
  }),
  between: number({
    group: "Time",
    label: "Time between",
    help: "The one time between: every change of size comes this far after the last, in atoms of the family",
    value: 18,
    min: 1,
    max: 48,
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
    value: 60,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

const NAMES = ["a", "b", "c"];
/** The between that changes at each step: one at a time, every combination once, then home. */
const ORDER = [0, 1, 0, 2, 0, 1, 0, 2];
const PP = 2;
const MP = 4;

/** A voice's name from its subset: "s", "s+a", "s+b+c", … */
const nameOf = (mask: number) => ["s", ...NAMES.filter((_, i) => mask & (1 << i))].join("+");

export function score(v: Values<typeof knobs>) {
  if (v.first.length !== 3 || v.second.length !== 3)
    throw new Error("First sizes / Second sizes: write exactly three betweens each (a, b, c)");
  const step = v.between * atomOf(familyOf(v.family));
  const bar = 4 * TICKS;

  // Which betweens are at their second size; the chord is every subset sum on the standpoint.
  const second = [false, false, false];
  const chord = () => {
    const sizes = second.map((s, i) => (s ? v.second[i]! : v.first[i]!));
    return Array.from(
      { length: 8 },
      (_, mask) => v.anchor + sizes.reduce((sum, b, i) => (mask & (1 << i) ? sum + b : sum), 0),
    );
  };

  // Each voice's notes as (tick, midi), by subset (bit 0: a, bit 1: b, bit 2: c).
  const voices = chord().map((midi) => [{ at: 0, midi }]);
  ORDER.forEach((i, k) => {
    second[i] = !second[i];
    const at = (k + 1) * step;
    chord().forEach((midi, mask) => {
      if (midi !== voices[mask]!.at(-1)!.midi) voices[mask]!.push({ at, midi });
    });
  });
  const last = ORDER.length * step;
  const end = Math.ceil((last + 2 * bar) / bar) * bar;

  // Players: the voices by the middle of the range each one covers, divided low to high.
  const ranges = voices.map((xs): [number, number] => [
    Math.min(...xs.map((x) => x.midi)),
    Math.max(...xs.map((x) => x.midi)),
  ]);
  const middle = (m: number) => ranges[m]![0] + ranges[m]![1];
  const byRegister = voices.map((_, m) => m).sort((p, q) => middle(p) - middle(q) || p - q);
  const players = divisi(byRegister.map((m) => ranges[m]!));

  const parts = byRegister.map((mask, k) => {
    const xs = voices[mask]!;
    const p = players[k]!;
    const events = xs.map((x, i) => note(x.at, (xs[i + 1]?.at ?? end) - x.at, x.midi));
    // Held at pp; a voice that has just moved starts mp and falls back to pp over a beat.
    const points: { at: number; level: number; ramp?: boolean }[] = [{ at: 0, level: PP }];
    for (const [i, x] of xs.entries()) {
      if (i === 0) continue;
      const until = Math.min(x.at + TICKS, x.at + step, end - bar);
      points.push(
        { at: x.at, level: MP, ramp: true },
        { at: Math.max(until, x.at + 1), level: PP },
      );
    }
    points.push({ at: end - bar, level: PP, ramp: true }, { at: end, level: 0 });
    return part({ ...p, name: `${p.name} · ${nameOf(mask)}` }, events, curve(points));
  });
  // Score order: high to low.
  return scoreOf("antara · palette A · half the chord moves", end / bar, v.tempo, parts.reverse());
}

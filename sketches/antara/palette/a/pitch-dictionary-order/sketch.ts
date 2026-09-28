// antara palette, A (pitch): chords in dictionary order.
//
// A chord is a standpoint with a group of betweens stacked on it, bottom up, the time between its
// tones 0. The groups come from one rule: every group of k betweens drawn from the set, each group
// in order of size, the groups in dictionary order (the "combinations" rule of between.ts, the rule
// Quantization drew its melodic fragments with, read here vertically: each group sounds at once).
// Two groups next to each other in dictionary order share their first betweens, in the same order,
// up to the first place where they differ. So from one chord to the next every voice up to that
// place holds its pitch and every voice above it moves. What stays is the shared run of betweens
// (a relation); the pitches above the break come after it. How many voices move, and which, is
// decided by the order of the rule alone: the top voice moves every time, each voice below it less
// often, and the standpoint never.
//
// Five horns, one voice each, the standpoint in the lowest. One time between only, so that no rule
// of time is heard: a new chord every twelve atoms, the last one held for two.
// Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, stack, TICKS, type Player } from "../../common.ts";

export const knobs = {
  set: betweenSet({
    group: "Chord",
    label: "Set",
    help: "The betweens the groups are drawn from (semitones, .5 for a quarter tone). Each group is stacked in order of size, narrow at the bottom",
    value: "1.5 2.5 4 5.5 8 9",
    min: 0,
    max: 12,
    step: 0.5,
    unit: "st",
    anchor: "anchor",
  }),
  size: number({
    group: "Chord",
    label: "Group size",
    help: "How many betweens each group takes; the chord has one voice more, a horn each. Every group of this size is drawn once, in dictionary order",
    value: 4,
    min: 1,
    max: 5,
    step: 1,
  }),
  anchor: pitch({
    group: "Chord",
    label: "Standpoint",
    help: "The lowest voice, in the lowest horn. It never moves",
    value: "C3",
    min: "C2",
    max: "C4",
    step: 0.5,
  }),
  between: number({
    group: "Time",
    label: "Time between",
    help: "The time from one chord to the next, in atoms of the family (the only time between). The last chord is held for two",
    value: 12,
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

/** Every group the rule draws, once each, in its order. */
function everyGroup(set: number[], size: number): number[][] {
  if (set.length === 0) throw new Error("Set: write at least one between");
  const draw = drawer(set, "combinations", size, "ascending");
  const seen = new Set<string>();
  const out: number[][] = [];
  for (;;) {
    const group = draw();
    const key = group.join(" ");
    if (seen.has(key)) return out;
    seen.add(key);
    out.push(group);
  }
}

// Levels: pp held, mp on a new note.
const HELD = 2;
const NEW = 4;

export function score(v: Values<typeof knobs>) {
  const bar = 4 * TICKS;
  const step = v.between * atomOf(familyOf(v.family));
  const chords = everyGroup(v.set, v.size).map((g) => stack(v.anchor, g, g.length + 1));
  const n = chords[0]!.length;

  // Each voice's pitches, as (tick, midi): a voice whose pitch is the same in the next chord holds.
  const voices = chords[0]!.map((m) => [{ at: 0, midi: m }]);
  chords.forEach((c, i) => {
    c.forEach((m, j) => {
      if (voices[j]!.at(-1)!.midi !== m) voices[j]!.push({ at: i * step, midi: m });
    });
  });
  const last = (chords.length - 1) * step;
  const end = Math.ceil((last + 2 * step) / bar) * bar;
  const fade = Math.max(end - bar, last);
  const glow = 2 * TICKS;

  const parts = voices.map((xs, j) => {
    const number = n - j;
    const horn: Player = {
      id: `hn${number}`,
      instrument: "horn",
      name: `Horn ${number}`,
      abbreviation: `Hn. ${number}`,
      range: [34, 77],
      grids: [0, 1],
    };
    const events = xs.map((x, i) => note(x.at, (xs[i + 1]?.at ?? end) - x.at, x.midi));
    // All enter pp together; a voice that has just moved starts mp and falls back to pp.
    const points: { at: number; level: number; ramp?: boolean }[] = [{ at: 0, level: HELD }];
    for (const [i, x] of xs.entries()) {
      if (i === 0) continue;
      const until = Math.min(xs[i + 1]?.at ?? end, x.at + glow, fade);
      points.push(
        { at: x.at, level: NEW, ramp: true },
        { at: Math.max(until, x.at + 1), level: HELD },
      );
    }
    points.push({ at: fade, level: HELD, ramp: true }, { at: end, level: 0 });
    return part(horn, events, curve(points));
  });
  // Score order: Horn 1 (the top voice) first.
  return scoreOf(
    "antara · palette A · chords in dictionary order",
    end / bar,
    v.tempo,
    parts.reverse(),
  );
}

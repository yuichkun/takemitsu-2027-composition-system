// antara palette, A (time): the unsounded origin.
//
// A line of onsets is its standpoint (the origin) plus the time betweens drawn from a set. Here the
// origin is never sounded. Three lines, one per family (5: quintuplet 16ths, 2: 16ths, 3: triplet
// 8ths), share one origin, a beat, where the three families' grids meet. Each line adds the same
// drawn group of betweens from that origin both ways: forward (after it) and backward (before it).
// Nothing stands on the origin itself.
//
// The same number of atoms is a different length in each family (12, 15, 20 ticks), so the three
// lines sit at the same ranks in the same proportions (12 : 15 : 20) and spread apart in proportion
// to their distance from the origin: they gather towards it and leave it, but the one point where
// they would meet is silent. The rule draws one group per origin, so the width of the silent middle
// changes from origin to origin.
//
// Origins come one after another, a fixed number of beats apart. Where two neighbouring origins give
// one line an onset on the same tick, it sounds once. The last origin is approached and not left:
// the sketch ends on it. Three woodblocks, the smallest atom on the highest block; one stroke per
// onset, all at p, no accents, so only the time betweens are heard.
//
// Adding time betweens backwards from the standpoint is a reading of the principle (which adds
// forward from the first onset) for 余湖さん to confirm, not a settled rule.
// Card: README.md.

import type { NoteEvent, Part } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, type Family } from "../../../between.ts";
import { scoreOf, TICKS, time } from "../../common.ts";

const RULES = ["shift each time", "in order"];

export const knobs = {
  set: betweenSet({
    group: "Time",
    label: "Set",
    help: "The time betweens every line adds from the origin, both ways, in atoms of its own family",
    value: "1 2 3",
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  rule: choice({
    group: "Time",
    label: "Rule",
    help: "How each origin draws its group from the set. Shift each time: the set starting one later at every origin, so the silent middle changes width; in order: the same group every time",
    value: RULES[0]!,
    options: RULES,
  }),
  every: number({
    group: "Form",
    label: "Origins every",
    help: "Beats from one unsounded origin to the next (each origin is a beat, where the three grids meet)",
    value: 4,
    min: 1,
    max: 12,
    step: 1,
    unit: "beats",
  }),
  count: number({
    group: "Form",
    label: "Origins",
    help: "How many unsounded origins. The last is only approached: the sketch ends on it",
    value: 12,
    min: 2,
    max: 24,
    step: 1,
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

interface Line {
  family: Family;
  id: string;
  instrument: string;
  name: string;
  abbreviation: string;
}

// Score order, top down: the smallest atom on the highest block.
const LINES: Line[] = [
  {
    family: 5,
    id: "wbh",
    instrument: "woodblock-high",
    name: "Woodblock (high)",
    abbreviation: "W. B. h.",
  },
  {
    family: 2,
    id: "wbm",
    instrument: "woodblock-medium",
    name: "Woodblock (medium)",
    abbreviation: "W. B. m.",
  },
  {
    family: 3,
    id: "wbl",
    instrument: "woodblock-low",
    name: "Woodblock (low)",
    abbreviation: "W. B. l.",
  },
];

export function score(v: Values<typeof knobs>) {
  const set = [...v.set];
  const draw = drawer(set, v.rule, set.length, "ascending");
  const reach = set.reduce((a, b) => a + b, 0);
  const widest = Math.max(...LINES.map((l) => atomOf(l.family)));
  // The first origin: the first beat with room before it for the whole group in the longest atom.
  const first = Math.ceil((reach * widest) / TICKS) * TICKS;
  const origins = Array.from({ length: v.count }, (_, k) => first + k * v.every * TICKS);
  const last = origins.at(-1)!;
  const bar = 4 * TICKS;
  const end = (Math.floor(last / bar) + 1) * bar;

  // Each line's onsets, in ticks; a tick given twice (by neighbouring origins) sounds once.
  const onsets = LINES.map(() => new Set<number>());
  origins.forEach((origin) => {
    let from = 0;
    for (const between of draw()) {
      from += between;
      LINES.forEach((l, i) => {
        const d = from * atomOf(l.family);
        onsets[i]!.add(origin - d);
        if (origin !== last) onsets[i]!.add(origin + d);
      });
    }
  });
  // The origin is never sounded, whoever would reach it.
  const silent = new Set(origins);

  const parts: Part[] = LINES.map((l, i) => {
    const atom = atomOf(l.family);
    const at = [...onsets[i]!]
      .filter((t) => t >= 0 && t < end && !silent.has(t))
      .sort((a, b) => a - b);
    const events: NoteEvent[] = at.map((t, j) => ({
      at: time(t),
      dur: time(Math.min(atom, (at[j + 1] ?? end) - t)),
    }));
    return {
      id: l.id,
      instrument: l.instrument,
      name: l.name,
      abbreviation: l.abbreviation,
      dynamics: [{ at: 0, level: 3 }],
      events,
    };
  });
  return scoreOf("antara · palette A · the unsounded origin", end / bar, v.tempo, parts);
}

// antara palette, A (time): measured from the last heard.
//
// A line of onsets is its standpoint plus the time betweens a rule draws from a set, each added to
// the onset before. Two players each hold their own set and draw from it by the same rule; each
// takes the same number of betweens. The only question here is which onset a between is added to.
//
// Part one, each from its own (the principle as written): both strike together at the start, and
// each player adds its betweens to its own onset before. Two lines run side by side; where their
// sums happen to land on the same tick, both strike.
//
// Part two, from the last heard: the same two streams of betweens, from the start again, but every
// between is added to the last onset anyone struck. Both strike together at a common origin (the
// first bar line at least Gap beats after part one's last strike). Each player waits with its next
// between; the smaller of the two waiting betweens is struck, measured from the last onset. The
// player that did not strike keeps its waiting between unchanged and measures it again from the new
// onset. When the two waiting betweens are equal, both strike (the time between the two players is
// 0) and both draw their next. When one player's stream is used up, the other goes on alone. The
// two lines become one line; which player the next onset belongs to is a name given afterwards by
// which of the two waiting betweens is smaller.
//
// The sets are written in the circular order the rule reads them (a between-set knob would sort
// them). Every strike is one atom long, at p throughout, without accents: the two woodblocks differ
// only in when, and in their height, which says whose between it was.
// Card: README.md.

import type { NoteEvent, Part } from "../../../../../src/score/types.ts";
import { choice, number, numbersOf, text, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { scoreOf, stream, TICKS, time } from "../../common.ts";

const RULES = ["shift each time", "in order"];

export const knobs = {
  high: text({
    group: "Sets",
    label: "High block",
    help: "The high woodblock's time betweens, in atoms of the family, in the circular order the rule reads them (whole numbers, 1 or more)",
    value: "3 6 1 9",
  }),
  low: text({
    group: "Sets",
    label: "Low block",
    help: "The low woodblock's time betweens, in atoms of the family, in the circular order the rule reads them (whole numbers, 1 or more)",
    value: "7 2 9 4",
  }),
  rule: choice({
    group: "Sets",
    label: "Rule",
    help: "For both players. shift each time: the set in the order written, each round starting one later. in order: every round from the first",
    value: RULES[0]!,
    options: RULES,
  }),
  count: number({
    group: "Sets",
    label: "Betweens each",
    help: "How many betweens each player draws. Both parts use the same streams",
    value: 16,
    min: 1,
    max: 48,
    step: 1,
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the betweens count in",
    value: FAMILY_OPTIONS[2]!,
    options: FAMILY_OPTIONS,
  }),
  gap: number({
    group: "Form",
    label: "Gap",
    help: "Part two starts on the first bar line at least this many beats after part one's last strike",
    value: 4,
    min: 1,
    max: 16,
    step: 1,
    unit: "beats",
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 54,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

function setOf(label: string, value: string): number[] {
  const set = numbersOf(label, value);
  if (set.some((n) => !Number.isInteger(n) || n < 1))
    throw new Error(`${label}: time betweens are whole numbers of atoms, 1 or more`);
  return set;
}

export function score(v: Values<typeof knobs>) {
  const atom = atomOf(familyOf(v.family));
  const bar = 4 * TICKS;
  const draw = (set: number[]) => {
    const next = stream(set, v.rule, set.length);
    return Array.from({ length: v.count }, () => next());
  };
  const P = draw(setOf("High block", v.high));
  const Q = draw(setOf("Low block", v.low));

  // Onsets in ticks, per player.
  const high: number[] = [0];
  const low: number[] = [0];

  // Part one: each adds its betweens to its own onset before.
  const walk = (line: number[], onsets: number[]) => {
    let t = 0;
    for (const b of line) onsets.push((t += b * atom));
    return t;
  };
  const partOne = Math.max(walk(P, high), walk(Q, low));

  // Part two: every between is added to the last onset anyone struck.
  const origin = Math.ceil((partOne + v.gap * TICKS) / bar) * bar;
  high.push(origin);
  low.push(origin);
  let last = origin;
  let i = 0;
  let j = 0;
  while (i < P.length || j < Q.length) {
    const p = P[i];
    const q = Q[j];
    if (q === undefined || (p !== undefined && p < q)) {
      last += p! * atom;
      high.push(last);
      i++;
    } else if (p === undefined || q < p) {
      last += q * atom;
      low.push(last);
      j++;
    } else {
      // Equal: both strike, and both draw their next.
      last += p * atom;
      high.push(last);
      low.push(last);
      i++;
      j++;
    }
  }
  const end = Math.ceil((last + atom) / bar) * bar;

  const partOf = (
    id: string,
    instrument: string,
    name: string,
    abbreviation: string,
    at: number[],
  ): Part => {
    const events: NoteEvent[] = at.map((t, k) => ({
      at: time(t),
      dur: time(Math.min(atom, (at[k + 1] ?? end) - t)),
    }));
    return { id, instrument, name, abbreviation, dynamics: [{ at: 0, level: 3 }], events };
  };
  const out = scoreOf("antara · palette A · measured from the last heard", end / bar, v.tempo, [
    partOf("wbh", "woodblock-high", "Woodblock (high)", "W. B. h.", high),
    partOf("wbl", "woodblock-low", "Woodblock (low)", "W. B. l.", low),
  ]);
  out.rehearsal = [
    { measure: 1, label: "each from its own" },
    { measure: origin / bar + 1, label: "from the last heard" },
  ];
  return out;
}

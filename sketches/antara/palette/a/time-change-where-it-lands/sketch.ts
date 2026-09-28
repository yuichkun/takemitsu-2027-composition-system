// antara palette, A (time): the family changes where the line lands.
//
// One line of onsets is its first onset plus the time betweens a rule draws from a set, each counted
// in atoms of the family in force (3: triplet 8ths, 2: 16ths, 5: quintuplet 16ths). The principle
// lets a line change family only where the families' grids meet, on a beat. Here that permission is
// not scheduled (at bar lines, every so many beats): the line changes family when its own addition
// lands on a beat, and only then, to the next family in a fixed order. A between that passes over a
// beat without landing on it changes nothing.
//
// The set is drawn in order, round and round, and the row does not start again when the family
// changes: the rule belongs to the line; the family only sets the size of the atom. So how long the
// line stays in a family is not chosen. It follows from the row and from how many atoms make a beat
// in that family (3 in the family of 3, 4 in the family of 2, 5 in the family of 5). The same between
// of 3 atoms is a whole beat in the family of 3 and not in the others: whether an onset lands on a
// beat depends on the family the line stands in when it counts.
//
// One woodblock, one stroke per onset, one atom long (of the family it begins), all at p, no
// accents, so that any beat heard can only come from the betweens. The line stops at its first
// landing on the last beat of the sketch or after it; the score ends at the first bar line a beat
// or more after that.
//
// It probes a question docs/antara/sound.md leaves open: whether the places where a line changes
// family stand out too much as beats. Here every sounded beat after the first is such a place.
// Card: README.md.

import type { NoteEvent, Part } from "../../../../../src/score/types.ts";
import { betweenSet, number, text, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familiesOf } from "../../../between.ts";
import { scoreOf, stream, TICKS, time } from "../../common.ts";

export const knobs = {
  row: betweenSet({
    group: "Time",
    label: "Row",
    help: "The time betweens, in atoms of the family in force, taken in turn (smallest first), round and round. The row does not start again when the family changes",
    value: "1 3 3",
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  families: text({
    group: "Time",
    label: "Families",
    help: "The order the line goes through the families, one step each time its addition lands on a beat, round and round (3: triplet 8ths, 2: 16ths, 5: quintuplet 16ths). The line starts in the first",
    value: "3 2 5",
  }),
  bars: number({
    group: "Form",
    label: "Bars",
    help: "The line stops at its first landing on the last beat of this bar or later; the score ends at the first bar line a beat or more after that",
    value: 16,
    min: 2,
    max: 32,
    step: 1,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 72,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

export function score(v: Values<typeof knobs>) {
  const row = [...v.row];
  if (row.length === 0 || row.some((n) => !Number.isInteger(n) || n < 1))
    throw new Error("Row: time betweens are whole numbers of atoms, 1 or more");
  const families = familiesOf("Families", v.families);
  if (families.length === 0) throw new Error("Families: write at least one (e.g. 3 2 5)");
  const next = stream(row, "in order", 1);
  // The line stops at its first landing here or later.
  const stop = (v.bars * 4 - 1) * TICKS;

  // Each stroke lasts one atom of the family it begins (on a landing, the new one).
  let k = 0;
  let at = 0;
  const events: NoteEvent[] = [{ at: time(0), dur: time(atomOf(families[0]!)) }];
  for (;;) {
    at += next() * atomOf(families[k]!);
    // Every family's grid meets the others' on the beat, and only there.
    const lands = at % TICKS === 0;
    if (lands) k = (k + 1) % families.length;
    events.push({ at: time(at), dur: time(atomOf(families[k]!)) });
    if (lands && at >= stop) break;
  }

  const bar = 4 * TICKS;
  const end = Math.ceil((at + TICKS) / bar) * bar;
  const part: Part = {
    id: "wbm",
    instrument: "woodblock-medium",
    name: "Woodblock (medium)",
    abbreviation: "W. B. m.",
    dynamics: [{ at: 0, level: 3 }],
    events,
  };
  return scoreOf("antara · palette A · the family changes where it lands", end / bar, v.tempo, [
    part,
  ]);
}

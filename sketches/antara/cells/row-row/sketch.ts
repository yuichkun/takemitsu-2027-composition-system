// antara, one cell of the map: pitch as a row × time as a row, both drawn in order.
// Two cycles of their own lengths: when the lengths differ, the notes and the durations slide past
// each other and meet again only after both have come round (the colour and talea of isorhythm
// fall out of the rule as one case of it).
// Bassoon: one line that is at ease both slurred and tongued across its range, so the pitch groups
// can be slurred and the time groups accented in the same line, and the two ways of grouping are
// heard pulling apart. Card: README.md.

import type { Values } from "../../../../src/sketch/knobs.ts";
import { toggle } from "../../../../src/sketch/knobs.ts";
import {
  familyOf,
  notes,
  pitchLine,
  pitchSetsOf,
  scoreOf,
  timeLine,
  timeSetsOf,
} from "../../between.ts";
import { form, pitchRow, timeRow } from "../../knobs.ts";

export const knobs = {
  ...pitchRow({
    row: "2 5 -7",
    stand: "walk on",
    anchor: "D3",
    range: ["G2", "A4"],
    bounds: ["Bb1", "Eb5"],
  }),
  ...timeRow({ family: "2 (16ths)", row: "2 1 1 2" }),
  slurs: toggle({
    group: "Sound",
    label: "Slur the pitch groups",
    help: "One slur over each time round the pitch row",
    value: true,
  }),
  accents: toggle({
    group: "Sound",
    label: "Accent the rhythm heads",
    help: "An accent where the rhythm row begins again",
    value: true,
  }),
  ...form({ bars: 8, tempo: 72 }),
};

export function score(v: Values<typeof knobs>) {
  const beats = v.bars * 4;
  const onsets = timeLine({
    beats,
    families: [familyOf(v.family)],
    sets: timeSetsOf("Rhythm row", v.rhythm),
    rule: "in order",
    k: 1,
    order: "ascending",
  });
  const tones = pitchLine(onsets, {
    beats,
    sets: pitchSetsOf("Row", v.row),
    rule: "in order",
    k: 1,
    order: "ascending",
    stand: v.stand,
    anchor: v.anchor,
    range: v.range,
  });
  return scoreOf("row × row", beats, v.tempo, [
    {
      id: "bsn",
      instrument: "bassoon",
      dynamics: [{ at: 0, level: 4.5 }],
      events: notes(onsets, { beats, tones, accent: v.accents ? "time" : "none", slurs: v.slurs }),
    },
  ]);
}

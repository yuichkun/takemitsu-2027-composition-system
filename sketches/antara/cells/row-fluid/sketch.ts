// antara, one cell of the map: pitch as a row × time drawn by a moving rule.
// The shape of the notes stays; only their timing stretches and shrinks, so the same phrase is
// said again and again with a different breath.
// Oboe: the singing, speaking voice of the orchestra, so the fixed phrase is heard as a call being
// restated rather than as a pattern repeating. Card: README.md.

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
import { form, pitchRow, timeFluid } from "../../knobs.ts";

export const knobs = {
  ...pitchRow({
    row: "5 -2 -3",
    stand: "walk on",
    anchor: "A4",
    range: ["C4", "C6"],
    bounds: ["Bb3", "A6"],
  }),
  ...timeFluid({
    family: "2 (16ths)",
    set: "1 2 2 3 4",
    rule: "combinations",
    group: 3,
    order: "ascending",
  }),
  slurs: toggle({
    group: "Sound",
    label: "Slur the pitch groups",
    help: "One slur over each time round the pitch row",
    value: true,
  }),
  ...form({ bars: 8, tempo: 72 }),
};

export function score(v: Values<typeof knobs>) {
  const beats = v.bars * 4;
  const onsets = timeLine({
    beats,
    families: [familyOf(v.family)],
    sets: timeSetsOf("Rhythm set", v.rhythm),
    rule: v.timeRule,
    k: v.timeGroup,
    order: v.timeOrder,
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
  return scoreOf("row × moving rule", beats, v.tempo, [
    {
      id: "ob",
      instrument: "oboe",
      dynamics: [{ at: 0, level: 4.5 }],
      events: notes(onsets, { beats, tones, accent: "time", slurs: v.slurs }),
    },
  ]);
}

// antara, one cell of the map: both axes drawn by moving rules.
// The freest line the rule gives: the places of the pitches move and the metre that arises moves
// too, each by its own groups.
// Solo violin: one player who can take any between down to the quarter tone and any grain of time,
// so nothing in the line is there for the instrument's sake. Card: README.md.

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
import { form, pitchFluid, timeFluid } from "../../knobs.ts";

export const knobs = {
  ...pitchFluid({
    set: "-5 -2 2 2 5 5 7 7",
    rule: "combinations",
    group: 4,
    order: "ascending",
    stand: "back to the anchor",
    anchor: "D5",
    range: ["G3", "A6"],
    bounds: ["G3", "C7"],
  }),
  ...timeFluid({
    family: "2 (16ths)",
    set: "1 1 2 2 3",
    rule: "combinations",
    group: 3,
    order: "ascending",
  }),
  slurs: toggle({
    group: "Sound",
    label: "Slur the pitch groups",
    help: "One slur over each pitch group; the rhythm heads are accented",
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
    sets: pitchSetsOf("Set", v.pitches),
    rule: v.pitchRule,
    k: v.pitchGroup,
    order: v.pitchOrder,
    stand: v.stand,
    anchor: v.anchor,
    range: v.range,
  });
  return scoreOf("moving rule × moving rule", beats, v.tempo, [
    {
      id: "vn",
      instrument: "violins-1",
      name: "Violin",
      abbreviation: "Vn.",
      players: 1,
      dynamics: [{ at: 0, level: 4.5 }],
      events: notes(onsets, { beats, tones, accent: "time", slurs: v.slurs }),
    },
  ]);
}

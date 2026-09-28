// antara, one cell of the map: pitch drawn by a moving rule × time as a rhythm row.
// The row is a groove the body can hold on to; over it only the places of the pitches move.
// Cellos pizzicato: a plucked low line reads like a bass under a dance, so the moving places are
// heard as the harmony shifting under the feet while the groove stays. Card: README.md.

import type { Values } from "../../../../src/sketch/knobs.ts";
import {
  familyOf,
  notes,
  pitchLine,
  pitchSetsOf,
  scoreOf,
  timeLine,
  timeSetsOf,
} from "../../between.ts";
import { form, pitchFluid, timeRow } from "../../knobs.ts";

export const knobs = {
  ...pitchFluid({
    set: "-5 -2 2 2 5 5 7 7",
    rule: "combinations",
    group: 3,
    order: "ascending",
    stand: "back to the anchor",
    anchor: "D3",
    range: ["C2", "E4"],
    bounds: ["C2", "C5"],
  }),
  ...timeRow({ family: "2 (16ths)", row: "3 3 2" }),
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
    sets: pitchSetsOf("Set", v.pitches),
    rule: v.pitchRule,
    k: v.pitchGroup,
    order: v.pitchOrder,
    stand: v.stand,
    anchor: v.anchor,
    range: v.range,
  });
  return scoreOf("moving rule × rhythm row", beats, v.tempo, [
    {
      id: "vc",
      instrument: "cellos",
      dynamics: [{ at: 0, level: 5 }],
      events: notes(onsets, { beats, tones, accent: "time", technique: "pizz" }),
    },
  ]);
}

// antara, one cell of the map: pitch holds one between (the same note) × time as a rhythm row.
// Only time moves. The row's heads are where a strong beat is heard; whether they keep landing on
// the beat or drift over it depends on the row's sum.
// Timpani: one drum, one note, and the weight of a single stroke makes the heads felt as beats
// without any other instrument. Card: README.md.

import type { Values } from "../../../../src/sketch/knobs.ts";
import { pitch } from "../../../../src/sketch/knobs.ts";
import { familyOf, notes, scoreOf, timeLine, timeSetsOf } from "../../between.ts";
import { form, timeRow } from "../../knobs.ts";

export const knobs = {
  note: pitch({
    group: "Pitch",
    label: "Drum",
    help: "The one note the drum is tuned to",
    value: "A2",
    min: "D2",
    max: "C4",
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
  return scoreOf("same note × rhythm row", beats, v.tempo, [
    {
      id: "timp",
      instrument: "timpani",
      dynamics: [{ at: 0, level: 5 }],
      events: notes(onsets, { beats, accent: "time" }).map((e) => ({
        ...e,
        pitch: { midi: v.note },
      })),
    },
  ]);
}

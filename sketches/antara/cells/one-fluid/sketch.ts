// antara, one cell of the map: the same sound × time drawn by a moving rule.
// Pitch is taken away so that only the relations of time are heard: groups of betweens drawn in
// turn, their lengths changing, so a metre arises and moves without being written.
// Woodblock for every onset: dry and short, so each between is heard exactly. A soft bass drum on
// the head of each group: the strong beat that arises is given weight by the orchestra, not by a
// sign, so where "one" falls is felt in the body. Card: README.md.

import type { Values } from "../../../../src/sketch/knobs.ts";
import { toggle } from "../../../../src/sketch/knobs.ts";
import { familyOf, notes, scoreOf, timeLine, timeSetsOf } from "../../between.ts";
import { form, timeFluid } from "../../knobs.ts";

export const knobs = {
  ...timeFluid({
    family: "2 (16ths)",
    set: "1 2 2 3 3",
    rule: "combinations",
    group: 3,
    order: "ascending",
  }),
  heads: toggle({
    group: "Sound",
    label: "Bass drum on the heads",
    help: "A soft bass drum joins the first onset of every group",
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
  const parts = [
    {
      id: "wb",
      instrument: "woodblock-medium",
      dynamics: [{ at: 0, level: 5 }],
      events: notes(onsets, { beats }),
    },
  ];
  if (v.heads) {
    const heads = onsets.filter((o) => o.head);
    parts.push({
      id: "bd",
      instrument: "bass-drum",
      dynamics: [{ at: 0, level: 3 }],
      events: notes(heads, { beats }),
    });
  }
  return scoreOf("same sound × moving rule", beats, v.tempo, parts);
}

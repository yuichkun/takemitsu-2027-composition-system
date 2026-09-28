// antara, one cell of the map: pitch drawn by a moving rule × time as a pulse.
// The shape Quantization had: every group of the set in turn, each from the anchor, over a steady
// pulse, so the colour stays and the place moves.
// Clarinet: its colour changes with register (chalumeau, throat, clarion), so where a group sits is
// heard as colour too; its leaps are smooth, which the dip-then-climb groups need. Card: README.md.

import type { Values } from "../../../../src/sketch/knobs.ts";
import { toggle } from "../../../../src/sketch/knobs.ts";
import { familyOf, notes, pitchLine, pitchSetsOf, pulse, scoreOf } from "../../between.ts";
import { form, pitchFluid, timePulse } from "../../knobs.ts";

export const knobs = {
  ...pitchFluid({
    set: "-5 -2 2 2 5 5 7 7",
    rule: "combinations",
    group: 6,
    order: "ascending",
    stand: "back to the anchor",
    anchor: "C4",
    range: ["D3", "G6"],
    bounds: ["D3", "Bb6"],
  }),
  ...timePulse({ family: "2 (16ths)", atoms: 1 }),
  slurs: toggle({
    group: "Sound",
    label: "Slur each group",
    help: "The anchor is tongued and accented, the rest of the group slurred: each group is heard as one gesture",
    value: true,
  }),
  ...form({ bars: 8, tempo: 72 }),
};

export function score(v: Values<typeof knobs>) {
  const beats = v.bars * 4;
  const onsets = pulse(beats, familyOf(v.family), v.pulse);
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
  return scoreOf("moving rule × pulse", beats, v.tempo, [
    {
      id: "cl",
      instrument: "clarinet",
      dynamics: [{ at: 0, level: 4.5 }],
      events: notes(onsets, { beats, tones, accent: "pitch", slurs: v.slurs }),
    },
  ]);
}

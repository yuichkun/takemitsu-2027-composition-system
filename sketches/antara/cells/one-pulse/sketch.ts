// antara, one cell of the map: pitch holds one between × time holds one between (a pulse).
// The place where no rule can be heard: the same note again (0), or one step walked over and over.
// Marimba: two mallets make a repeated note idiomatic and every stroke speaks, so the only life of
// the line is its attack and the one between. Card: README.md.

import type { Values } from "../../../../src/sketch/knobs.ts";
import { familyOf, notes, pitchLine, pulse, scoreOf } from "../../between.ts";
import { form, pitchOne, timePulse } from "../../knobs.ts";

export const knobs = {
  ...pitchOne({
    between: 0,
    stand: "walk on",
    anchor: "A4",
    range: ["C4", "C6"],
    bounds: ["A2", "C7"],
    step: 1,
  }),
  ...timePulse({ family: "2 (16ths)", atoms: 2 }),
  ...form({ bars: 8, tempo: 72 }),
};

export function score(v: Values<typeof knobs>) {
  const beats = v.bars * 4;
  const onsets = pulse(beats, familyOf(v.family), v.pulse);
  const tones = pitchLine(onsets, {
    beats,
    sets: [[v.between]],
    rule: "in order",
    k: 1,
    order: "ascending",
    stand: v.stand,
    anchor: v.anchor,
    range: v.range,
  });
  return scoreOf("one between × pulse", beats, v.tempo, [
    {
      id: "mar",
      instrument: "marimba",
      dynamics: [{ at: 0, level: 5 }],
      events: notes(onsets, { beats, tones }),
    },
  ]);
}

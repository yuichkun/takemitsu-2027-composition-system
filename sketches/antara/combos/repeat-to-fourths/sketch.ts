// antara, a combination on the map: the pitch set moves while time stays a pulse.
// "Changing the set while repeating": from the same note again, betweens come in one after another
// until fourths and fifths are there, with no change in the pulse.
// Violins I spiccato carry the line: every stroke is clear, so a repeated note stays alive and
// the moment a new between comes in is heard at once; violins can take any between, quarter tones
// included. Cellos hold the anchor two octaves down, softly: the standpoint is heard, so how each
// new between sounds against it (whether a sense of key arises) can be judged. Card: README.md.

import type { Values } from "../../../../src/sketch/knobs.ts";
import { toggle } from "../../../../src/sketch/knobs.ts";
import {
  familyOf,
  notes,
  pitchLine,
  pitchSetsOf,
  pulse,
  scoreOf,
  TICKS,
  time,
} from "../../between.ts";
import { form, pitchFluid, timePulse } from "../../knobs.ts";

export const knobs = {
  ...pitchFluid({
    set: "0 | 0 0 0 2 | 0 2 5 | -5 -2 2 5 7",
    rule: "combinations",
    group: 2,
    order: "ascending",
    stand: "back to the anchor",
    anchor: "A4",
    range: ["G3", "E6"],
    bounds: ["G3", "G7"],
  }),
  ...timePulse({ family: "2 (16ths)", atoms: 1 }),
  drone: toggle({
    group: "Sound",
    label: "Anchor in the cellos",
    help: "The cellos hold the anchor two octaves down, pp",
    value: true,
  }),
  ...form({ bars: 16, tempo: 72 }),
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
  const parts = [
    {
      id: "vn1",
      instrument: "violins-1",
      dynamics: [{ at: 0, level: 4.5 }],
      events: notes(onsets, { beats, tones, accent: "pitch", technique: "spiccato" }),
    },
  ];
  if (v.drone) {
    const low = v.anchor - 24 >= 36 ? v.anchor - 24 : v.anchor - 12;
    parts.push({
      id: "vc",
      instrument: "cellos",
      dynamics: [{ at: 0, level: 2 }],
      events: [{ at: 0, dur: time(beats * TICKS), pitch: { midi: low } }],
    });
  }
  return scoreOf("the set moves over a pulse", beats, v.tempo, parts);
}

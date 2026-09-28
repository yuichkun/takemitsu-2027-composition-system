// antara, one cell of the map: pitch as a row drawn in order × time as a pulse.
// The case an ordinary row lives in: the same shape comes round again, as an ostinato (back to the
// anchor) or as a sequence (walking on), so its colour and its place lock together.
// Flute: a plain, even tone over a steady pulse lets the shape itself be heard, and the flute can
// play every quarter-tone between. Card: README.md.

import type { Values } from "../../../../src/sketch/knobs.ts";
import { toggle } from "../../../../src/sketch/knobs.ts";
import { familyOf, notes, pitchLine, pitchSetsOf, pulse, scoreOf } from "../../between.ts";
import { form, pitchRow, timePulse } from "../../knobs.ts";

export const knobs = {
  ...pitchRow({
    row: "2 5 7",
    stand: "back to the anchor",
    anchor: "D5",
    range: ["C5", "C7"],
    bounds: ["B3", "D7"],
  }),
  ...timePulse({ family: "2 (16ths)", atoms: 1 }),
  accent: toggle({
    group: "Sound",
    label: "Accent the row's start",
    help: "Marks where the row begins again, so the lock is heard",
    value: true,
  }),
  ...form({ bars: 8, tempo: 72 }),
};

export function score(v: Values<typeof knobs>) {
  const beats = v.bars * 4;
  const onsets = pulse(beats, familyOf(v.family), v.pulse);
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
  return scoreOf("row × pulse", beats, v.tempo, [
    {
      id: "fl",
      instrument: "flute",
      dynamics: [{ at: 0, level: 4.5 }],
      events: notes(onsets, { beats, tones, accent: v.accent ? "pitch" : "none" }),
    },
  ]);
}

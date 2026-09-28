// antara, a combination on the map: three lines, each on its own family's grid.
// Ratios like 4 : 3 : 5 are not written inside any line; they arise between the lines, and the beat
// is heard where the lines meet.
// Violins II pizzicato (2: 16ths), harp (3: triplet eighths), marimba (5: quintuplet 16ths): all
// three are plucked or struck, so their attacks line up where the grids meet; each has its own
// colour, so the lines stay apart; and each player stays on one grid, so every part is playable.
// Card: README.md.

import type { NoteEvent } from "../../../../src/score/types.ts";
import type { Values } from "../../../../src/sketch/knobs.ts";
import { choice, number, pitch, text, toggle } from "../../../../src/sketch/knobs.ts";
import {
  notes,
  pitchLine,
  pitchSetsOf,
  scoreOf,
  timeLine,
  timeSetsOf,
  type Family,
  type Rule,
} from "../../between.ts";
import { form } from "../../knobs.ts";

const plays = (group: string) =>
  toggle({ group, label: "Plays", help: "Whether this line sounds", value: true });
const rhythm = (group: string, value: string) =>
  text({ group, label: "Rhythm set", help: "Betweens in atoms of this line's family", value });
const offset = (group: string) =>
  number({
    group,
    label: "Offset",
    help: "Atoms of silence before the first onset",
    value: 0,
    min: 0,
    max: 8,
    step: 1,
    unit: "atoms",
  });
const pitches = (group: string) =>
  text({
    group,
    label: "Pitch set",
    help: "Betweens in semitones, each group from the anchor (0: the same note)",
    value: "0",
  });
const anchor = (group: string, value: string, min: string, max: string) =>
  pitch({ group, label: "Anchor", help: "Where the line stands", value, min, max });

export const knobs = {
  pzOn: plays("Pizzicato (2)"),
  pzRhythm: rhythm("Pizzicato (2)", "1"),
  pzOffset: offset("Pizzicato (2)"),
  pzPitches: pitches("Pizzicato (2)"),
  pzAnchor: anchor("Pizzicato (2)", "D5", "G3", "C7"),
  hpOn: plays("Harp (3)"),
  hpRhythm: rhythm("Harp (3)", "1"),
  hpOffset: offset("Harp (3)"),
  hpPitches: pitches("Harp (3)"),
  hpAnchor: anchor("Harp (3)", "G4", "C2", "C7"),
  marOn: plays("Marimba (5)"),
  marRhythm: rhythm("Marimba (5)", "1"),
  marOffset: offset("Marimba (5)"),
  marPitches: pitches("Marimba (5)"),
  marAnchor: anchor("Marimba (5)", "C4", "A2", "C7"),
  timeRule: choice({
    group: "All lines",
    label: "Rule",
    help: "How each line draws from its rhythm set: in order, shifting each time, or by combinations",
    value: "in order",
    options: ["in order", "shift each time", "combinations"],
  }),
  timeGroup: number({
    group: "All lines",
    label: "Group size",
    help: "Betweens per group (combinations)",
    value: 3,
    min: 1,
    max: 8,
    step: 1,
  }),
  ...form({ bars: 4, tempo: 72 }),
};

export function score(v: Values<typeof knobs>) {
  const beats = v.bars * 4;
  const rule = v.timeRule as Rule;
  const line = (
    name: string,
    family: Family,
    set: { rhythm: string; offset: number; pitches: string; anchor: number },
    technique?: string,
  ): NoteEvent[] => {
    const onsets = timeLine({
      beats,
      families: [family],
      sets: timeSetsOf(`${name}: rhythm set`, set.rhythm),
      rule,
      k: v.timeGroup,
      order: "ascending",
      offset: set.offset,
    });
    const tones = pitchLine(onsets, {
      beats,
      sets: pitchSetsOf(`${name}: pitch set`, set.pitches),
      rule: "in order",
      k: 1,
      order: "ascending",
      stand: "back to the anchor",
      anchor: set.anchor,
      range: [set.anchor - 12, set.anchor + 24],
    });
    return notes(onsets, { beats, tones, accent: "time", technique });
  };
  const parts = [];
  if (v.pzOn)
    parts.push({
      id: "vn2",
      instrument: "violins-2",
      dynamics: [{ at: 0, level: 4.5 }],
      events: line(
        "Pizzicato",
        2,
        { rhythm: v.pzRhythm, offset: v.pzOffset, pitches: v.pzPitches, anchor: v.pzAnchor },
        "pizz",
      ),
    });
  if (v.hpOn)
    parts.push({
      id: "hp",
      instrument: "harp",
      dynamics: [{ at: 0, level: 4.5 }],
      events: line("Harp", 3, {
        rhythm: v.hpRhythm,
        offset: v.hpOffset,
        pitches: v.hpPitches,
        anchor: v.hpAnchor,
      }),
    });
  if (v.marOn)
    parts.push({
      id: "mar",
      instrument: "marimba",
      dynamics: [{ at: 0, level: 4.5 }],
      events: line("Marimba", 5, {
        rhythm: v.marRhythm,
        offset: v.marOffset,
        pitches: v.marPitches,
        anchor: v.marAnchor,
      }),
    });
  return scoreOf("three families at once", beats, v.tempo, parts);
}

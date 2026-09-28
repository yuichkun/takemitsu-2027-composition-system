// antara palette, A (pitch): the standpoint steps back.
//
// A line is a standpoint plus the betweens a rule draws from a set. Usually the standpoint is the
// note just before: the line walks. Here the standpoint of each note is the note d places back.
// The set, the rule and the one stream of betweens drawn from it never change; only d does, from
// section to section (by default 1, then 2, then 3).
//
// With d = 1 the line walks as usual. With d = 2 every note is the note two back plus the next
// between of the stream, so the notes fall into two strands sounded in turn, each walking by the
// set's betweens; with d = 3, three strands. One clarinet plays every note, one after another on
// an even pulse: the strands are not handed to different players, so if the line comes apart, it
// comes apart in the ear. Each strand moves by the set's betweens, but the between heard from one
// note to the next lies between two strands: the difference of two walks, a size the set does not
// hold and nobody chose.
//
// A section of depth d starts where the line stands. Its first d notes are standpoints a fixed gap
// apart, sounded bottom up and spread evenly around a centre: the middle between the lowest and
// the highest of the notes the section before ended on, one per strand (its last note, after a
// section of depth 1; the Standpoint, for the first section). So from section to section the depth
// changes and the height does not. (Centring on the last note alone would lift every section after
// one of depth 2 or more, since that note always belongs to the top strand.) When the centre
// leaves the standpoints off the quarter-tone grid, they go down to it. From then on every note is
// the note d back plus the next between. Each strand gets the same number of notes in every
// section. The stream (the set in the order written, starting one later each time round) runs
// through the whole sketch and is never reset. Nothing folds by octaves and nothing reflects at the
// edges: a note outside the clarinet throws.
//
// Time is a pulse (a time set holding one between), every note lasting to the next; the last note
// is held for two beats and fades. One level throughout, no accents, no slurs, and nothing marks
// the sections: a change of depth is heard only through the line.
// Card: README.md.

import {
  choice,
  number,
  numbersOf,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

export const knobs = {
  set: text({
    group: "Pitch",
    label: "Set",
    help: "The betweens (semitones, .5 for a quarter tone, − for down), in the order the rule reads them: the set as written, starting one later each time round. The order matters",
    value: "-4.5 1 3 2.5 -2",
    hint: "-4.5 1 3 2.5 -2",
  }),
  depths: text({
    group: "Pitch",
    label: "Depths",
    help: "How many notes back the standpoint is, section by section: 1 walks from the note just before; 2 and 3 split the line into that many strands",
    value: "1 | 2 | 3",
    hint: "1 | 2 | 3",
  }),
  gap: number({
    group: "Pitch",
    label: "Strand gap",
    help: "How far apart the standpoints of a section's strands start (semitones), spread evenly around where the section before ended. With .5 neighbouring strands start on the two grids",
    value: 8.5,
    min: 0,
    max: 24,
    step: 0.5,
    unit: "st",
  }),
  anchor: pitch({
    group: "Pitch",
    label: "Standpoint",
    help: "The first note. Each later section spreads its strands around the middle of where the strands of the one before ended",
    value: 73,
    min: "D3",
    max: "C6",
    step: 0.5,
  }),
  per: number({
    group: "Form",
    label: "Onsets per strand",
    help: "How many notes each strand plays in a section: a section of depth d has d times as many",
    value: 20,
    min: 2,
    max: 60,
    step: 1,
  }),
  between: number({
    group: "Time",
    label: "Time between",
    help: "The one time between, in atoms of the family: every note starts this long after the one before (a pulse)",
    value: 2,
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time between counts in",
    value: FAMILY_OPTIONS[0]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 66,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

const CLARINET: Player = {
  id: "cl",
  instrument: "clarinet",
  name: "Clarinet",
  abbreviation: "Cl.",
  range: [50, 94],
  grids: [0, 1],
};

/** The set as written, in order: semitones on the quarter-tone grid. */
function setOf(value: string): number[] {
  const set = numbersOf("Set", value.replaceAll("−", "-"));
  if (set.some((b) => !Number.isInteger(b * 2)))
    throw new Error("Set: betweens are semitones on the quarter-tone grid (2, 3.5, -4.5)");
  return set;
}

/** Depths written as "1 | 2 | 3" (or "1 2 3"): whole numbers, 1 or more. */
function depthsOf(value: string): number[] {
  const depths = numbersOf("Depths", value.replaceAll("|", " "));
  if (depths.some((d) => !Number.isInteger(d) || d < 1))
    throw new Error("Depths: whole numbers of notes back, 1 or more (e.g. 1 | 2 | 3)");
  return depths;
}

export function score(v: Values<typeof knobs>) {
  const next = stream(setOf(v.set), "shift each time", 1);

  // The pitches, section by section: d standpoints a gap apart around the centre (down to the
  // quarter-tone grid when they fall off it), then each note the note d back plus the next between
  // of the one stream. The next centre is the middle of the last d notes, where the strands ended.
  const pitches: number[] = [];
  let centre = v.anchor;
  for (const d of depthsOf(v.depths)) {
    const section: number[] = [];
    const lowest = Math.floor((centre - ((d - 1) / 2) * v.gap) * 2) / 2;
    for (let k = 0; k < d; k++) section.push(lowest + k * v.gap);
    for (let n = d; n < d * v.per; n++) section.push(section[n - d]! + next());
    pitches.push(...section);
    const ends = section.slice(-d);
    centre = (Math.min(...ends) + Math.max(...ends)) / 2;
  }
  const [lo, hi] = CLARINET.range;
  pitches.forEach((m, i) => {
    if (m < lo || m > hi)
      throw new Error(
        `Standpoint: note ${i + 1} reaches ${m}, outside the clarinet (${lo}–${hi}); move the Standpoint or the Strand gap, or change the Set`,
      );
  });

  const pulse = v.between * atomOf(familyOf(v.family));
  const bar = 4 * TICKS;
  const last = (pitches.length - 1) * pulse;
  const hold = 2 * TICKS;
  const end = Math.ceil((last + hold) / bar) * bar;
  const events = pitches.map((m, i) => note(i * pulse, i === pitches.length - 1 ? hold : pulse, m));
  // mp throughout; the last note fades to nothing over its two beats.
  const dynamics = curve([
    { at: 0, level: 4 },
    { at: last, level: 4, ramp: true },
    { at: last + hold, level: 0 },
  ]);
  return scoreOf("antara · palette A · the standpoint steps back", end / bar, v.tempo, [
    part(CLARINET, events, dynamics),
  ]);
}

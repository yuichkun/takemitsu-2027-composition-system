// antara palette, A (texture): the fixed order and the fluid order, each with its own colour.
//
// One line: a standpoint plus the betweens a rule draws from one set. The set never changes: a few
// sizes, each once up and once down, so a whole pass through it adds up to 0. Two rules take turns
// drawing from it, stage by stage, fixed, fluid, fixed, fluid, each stage the same number of whole
// passes. The fixed rule reads the set in its written order (sizes smallest first, each up then
// down), round and round; each time a fixed stage comes back it starts one place later. The fluid
// rule takes the between used least so far; of those, the one that takes the line to the pitch
// heard least so far (the between from the standpoint heard least); of those, the widest, up
// before down (the same preference as the written order). Both rules count over the whole line,
// in either stage.
//
// The only colour is the name of the rule now drawing: a note is played by the solo viola when the
// fixed rule drew the between that brought the line to it, by the bass clarinet when the fluid rule
// did. The line is computed first; the colours do not alter it. One pulse, flat mp, ordinary
// playing throughout. The standpoint has no between before it, so no rule names it and it is not
// sounded. Notes leaving an octave either side of the standpoint are moved back by octaves.
// Card: README.md.

import type { NoteEvent } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { fold, note, part, scoreOf, TICKS, type Player } from "../../common.ts";

export const knobs = {
  sizes: betweenSet({
    group: "Line",
    label: "Sizes",
    help: "The sizes of the set (semitones, .5 for a quarter tone). Each is in the set once up and once down; the fixed rule reads them smallest first, each up then down",
    value: "1.5 2.5 5.5",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  standpoint: pitch({
    group: "Line",
    label: "Standpoint",
    help: "Where the line starts (not sounded: no rule drew a between to it). The line is kept within an octave either side of it",
    value: "D+4",
    min: "C4",
    max: "F4",
    step: 0.5,
  }),
  passes: number({
    group: "Line",
    label: "Passes per stage",
    help: "How many whole passes through the set each stage takes before the other rule (and the other colour) takes over",
    value: 2,
    min: 1,
    max: 4,
    step: 1,
  }),
  time: number({
    group: "Time",
    label: "Time between",
    help: "The one time between of the line (a pulse), in atoms of the family: nothing changes in time, so what changes is the rule and its colour",
    value: 3,
    min: 1,
    max: 24,
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
    value: 45,
    min: 40,
    max: 120,
    step: 1,
    unit: "bpm",
  }),
};

type Rule = "fixed" | "fluid";
const STAGES: Rule[] = ["fixed", "fluid", "fixed", "fluid"];

// The names of the rules.
const COLOUR: Record<Rule, Player> = {
  fixed: {
    id: "va",
    instrument: "violas",
    name: "Viola (solo)",
    abbreviation: "Va.",
    players: 1,
    range: [48, 91],
    grids: [0, 1],
  },
  fluid: {
    id: "bcl",
    instrument: "bass-clarinet",
    name: "Bass Clarinet",
    abbreviation: "B. Cl.",
    range: [34, 77],
    grids: [0, 1],
  },
};
const SCORE_ORDER: Rule[] = ["fluid", "fixed"];

interface Step {
  rule: Rule;
  stage: number;
  between: number;
  midi: number;
}

/** The line: each stage's rule draws its whole passes from the one set, walking on. */
function lineOf(sizes: number[], standpoint: number, passes: number): Step[] {
  // The written order: sizes smallest first, each up then down.
  const set = sizes.flatMap((s) => [s, -s]);
  const range: [number, number] = [standpoint - 12, standpoint + 12];
  const used = new Map(set.map((b) => [b, 0]));
  const heard = new Map<number, number>();
  let start = 0;
  let midi = standpoint;
  const out: Step[] = [];
  STAGES.forEach((rule, stage) => {
    for (let k = 0; k < passes * set.length; k++) {
      let between: number;
      if (rule === "fixed") between = set[(start + k) % set.length]!;
      else {
        const least = Math.min(...set.map((b) => used.get(b)!));
        let pool = set.filter((b) => used.get(b) === least);
        const heardAt = (b: number) => heard.get(fold(midi + b, range)) ?? 0;
        const fewest = Math.min(...pool.map(heardAt));
        pool = pool.filter((b) => heardAt(b) === fewest);
        // Widest first; of a size, up before down, as the written order reads it. Down first would
        // add to the side the second test already pushes the fluid rule to (below the fixed
        // stages), and the two colours would then also be two registers.
        pool.sort((a, b) => Math.abs(b) - Math.abs(a) || b - a);
        between = pool[0]!;
      }
      used.set(between, used.get(between)! + 1);
      midi = fold(midi + between, range);
      heard.set(midi, (heard.get(midi) ?? 0) + 1);
      out.push({ rule, stage, between, midi });
    }
    if (rule === "fixed") start = (start + 1) % set.length;
  });
  return out;
}

export function score(v: Values<typeof knobs>) {
  const sizes = [...v.sizes].sort((a, b) => a - b);
  if (new Set(sizes).size !== sizes.length)
    throw new Error("Sizes: give different sizes (each is in the set once up and once down)");
  const steps = lineOf(sizes, v.standpoint, v.passes);
  const pulse = v.time * atomOf(familyOf(v.family));

  const events: Record<Rule, NoteEvent[]> = { fixed: [], fluid: [] };
  steps.forEach((s, k) => events[s.rule].push(note(k * pulse, pulse, s.midi)));

  const bar = 4 * TICKS;
  const bars = Math.ceil((steps.length * pulse + TICKS) / bar);
  const dynamics = [{ at: 0, level: 4 }];
  const parts = SCORE_ORDER.map((r) => part(COLOUR[r], events[r], dynamics));
  return scoreOf("antara · palette A · the fixed order and the fluid order", bars, v.tempo, parts);
}

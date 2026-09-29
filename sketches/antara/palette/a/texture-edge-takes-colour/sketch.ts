// antara palette, A (texture): the edge takes colour.
//
// One line: a standpoint plus the betweens a rule draws from a signed set. A solo cello plays every
// note of it. A note higher than every note heard before it (a new high edge of what has been heard)
// is doubled at the same pitch by the flute; a note lower than every note heard before it (a new low
// edge), by the muted horn. Any other note stands inside what has already been heard, and the cello
// plays it alone. The standpoint is the first note: before it nothing has been heard, so the heard
// range starts as that one point, and the standpoint itself takes no colour. The line is computed
// first and is not altered by who doubles it: colour is only where a note stands against everything
// before it. Flat mp, one way of playing for each (the cello arco, non vib.; the horn con sord.), one
// time between (a pulse), so the only change is who joins the cello.
//
// The line: eight signed betweens, each size up and down once, in a written order that adds up to 0.
// Four passes of eight. Each pass starts one place later in the order than the pass before. Because
// the order adds up to 0, each pass is a closed loop that leaves the standpoint and comes back to it.
// Every other pass walks its loop the other way round (its eight betweens from the last to the first,
// every sign turned): read always forward, each pass would repeat seven betweens of the pass before
// in the same order, and the line would be one shape heard again a little higher or lower. Notes
// leaving an octave either side of the standpoint are folded back by octaves (the edges are counted
// on the folded, heard pitches). A doubling outside its instrument's range is folded into it.
// Card: README.md.

import type { NoteEvent, TextEvent } from "../../../../../src/score/types.ts";
import {
  choice,
  number,
  numbersOf,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { fold, note, part, scoreOf, TICKS, type Player } from "../../common.ts";

const WAYS = ["back every other pass", "always forward"];
const PASSES = 4;

export const knobs = {
  betweens: text({
    group: "Line",
    label: "Betweens",
    help: "The signed betweens in the order they are read (semitones, .5 for a quarter tone, − goes down). Each pass reads all of them, starting one place later than the pass before. Adding up to 0 makes each pass a loop back to the standpoint",
    value: "1.5 -3.5 4.5 -2.5 -1.5 3.5 -4.5 2.5",
  }),
  way: choice({
    group: "Line",
    label: "Way round",
    help: "Back every other pass: the 2nd and 4th passes read their betweens from the last to the first with every sign turned (the loop walked the other way). Always forward: every pass reads forward, and each repeats seven betweens of the one before",
    value: WAYS[0]!,
    options: WAYS,
  }),
  standpoint: pitch({
    group: "Line",
    label: "Standpoint",
    help: "The first note, where the heard range starts. The line is folded by octaves into an octave either side of it",
    value: 68,
    min: "C3",
    max: "E5",
    step: 0.5,
  }),
  time: number({
    group: "Time",
    label: "Time between",
    help: "The one time between of the line (a pulse), in atoms of the family: nothing happens in time, so the only change heard is who joins the cello",
    value: 7,
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time between counts in",
    value: FAMILY_OPTIONS[2]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 60,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

const CELLO: Player = {
  id: "vc",
  instrument: "cellos",
  name: "Violoncello (solo)",
  abbreviation: "Vc.",
  players: 1,
  range: [36, 82],
  grids: [0, 1],
};
/** Joins the cello on a new high edge. */
const HIGH: Player = {
  id: "fl",
  instrument: "flute",
  name: "Flute",
  abbreviation: "Fl.",
  range: [60, 96],
  grids: [0, 1],
};
/** Joins the cello on a new low edge. */
const LOW: Player = {
  id: "hn",
  instrument: "horn",
  name: "Horn",
  abbreviation: "Hn.",
  range: [34, 75],
  grids: [0, 1],
  technique: "muted",
};

type Place = "high" | "low" | "inside" | "standpoint";

/** The steps of the line: the order read pass by pass, each pass starting one place later. */
function stepsOf(order: number[], back: boolean): number[] {
  const out: number[] = [];
  for (let r = 0; r < PASSES; r++) {
    const s = r % order.length;
    const drawn = [...order.slice(s), ...order.slice(0, s)];
    out.push(...(back && r % 2 === 1 ? drawn.reverse().map((b) => -b) : drawn));
  }
  return out;
}

/** Each note of the line, and where it stands against every note heard before it. */
function lineOf(steps: number[], standpoint: number): { midi: number; place: Place }[] {
  const range: [number, number] = [standpoint - 12, standpoint + 12];
  const out: { midi: number; place: Place }[] = [{ midi: standpoint, place: "standpoint" }];
  let here = standpoint;
  let top = standpoint;
  let bottom = standpoint;
  for (const b of steps) {
    here = fold(here + b, range);
    let place: Place = "inside";
    if (here > top) {
      top = here;
      place = "high";
    } else if (here < bottom) {
      bottom = here;
      place = "low";
    }
    out.push({ midi: here, place });
  }
  return out;
}

export function score(v: Values<typeof knobs>) {
  const order = numbersOf("Betweens", v.betweens.replaceAll("−", "-"));
  if (order.some((b) => !Number.isInteger(b * 2)))
    throw new Error("Betweens: semitones on the quarter-tone grid (1.5, -3.5, 4.5)");
  const line = lineOf(stepsOf(order, v.way === WAYS[0]), v.standpoint);
  const pulse = v.time * atomOf(familyOf(v.family));

  const cello: NoteEvent[] = [];
  const high: NoteEvent[] = [];
  const low: NoteEvent[] = [];
  line.forEach((x, k) => {
    const at = k * pulse;
    cello.push(note(at, pulse, x.midi));
    if (x.place === "high") high.push(note(at, pulse, fold(x.midi, HIGH.range)));
    if (x.place === "low")
      low.push(note(at, pulse, fold(x.midi, LOW.range), { technique: LOW.technique! }));
  });
  const nonVib: TextEvent = { type: "text", at: 0, text: "non vib." };

  const bar = 4 * TICKS;
  const bars = Math.ceil((line.length * pulse) / bar);
  const mp = [{ at: 0, level: 4 }];
  return scoreOf("antara · palette A · the edge takes colour", bars, v.tempo, [
    part(HIGH, high, mp),
    part(LOW, low, mp),
    { ...part(CELLO, cello, mp), events: [nonVib, ...cello] },
  ]);
}

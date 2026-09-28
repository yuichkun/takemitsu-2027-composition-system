// antara palette, A (texture): the thickness is the step.
//
// One line, walking on from a standpoint by the betweens of a set, drawn in order (smallest first,
// again and again). The line is played in unison by the first violins, whose sixteen players are
// ranked 1 to 16. The one relation: the step that reaches a note, counted in quarter tones, is the
// number of players on that note. A quarter-tone step is played by player 1 alone, a step of 8
// semitones (16 quarter tones) by all sixteen; a step of 0 would be played by nobody. The players
// are always 1 up to that number, so player 1 plays every note and the outer players come in only
// on the wide steps. No other rule sets the thickness: everyone plays arco, ordinario, at one
// level, and every note lasts the same time (a pulse: a time set holding one between), so how many
// players sound is the only thing that changes. The standpoint, reached by no step, is played by
// player 1 alone.
//
// Players the rule never separates share a staff: the counts the set gives (and 1, for the
// standpoint) cut the ranks into groups (by default 1 | 2-4 | 5-7 | 8-11 | 12-16), and each group
// is one divided part holding that many players. The score is the same as sixteen solo staves; the
// playback then hears a group of several players as the section, not as one soloist stacked.
//
// The default counts are 1 4 7 11 16 (steps 0.5 2 3.5 5.5 8): odd counts as well as even ones, so
// steps with a quarter tone (which move the line to the other grid) come in among the others. The
// groups after player 1 hold 3, 3, 4 and 5 players: three of the four are odd, the most a split of
// fifteen into four can have, so the parity of the count changes at three of the four cuts.
//
// The line keeps inside a band that starts at the standpoint and is twice as wide as the largest
// step: the narrowest band in which, from any point, every step can be taken one way or the other.
// A step that would leave the band is taken the other way at the same size, and the line keeps
// that direction until the other edge. No octave folding: a folded step is heard at another size
// (an 8 up folded is heard as a 4 down), and on it the number of players would no longer be the
// size of the step heard. Where the line turns is left to the band; the thickest notes do not sit
// at its edges, so how high a note is and how thick it is move apart.
// Card: README.md.

import { betweenSet, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { curve, note, part, scoreOf, TICKS, type Player } from "../../common.ts";

/** The first violins: sixteen players, and the highest pitch the line may reach. */
const DESKS = 16;
const TOP = 103;
/** Each note lasts two beats; the last is held to the end of its bar, dying away over the last beat. */
const NOTE = 2 * TICKS;
/** One level for every player whenever they play (mp). */
const LEVEL = 4;

export const knobs = {
  set: betweenSet({
    group: "Line",
    label: "Steps",
    help: "The betweens the line walks by (semitones, .5 for a quarter tone), read smallest first, again and again. A step of b semitones is 2b quarter tones and is played by that many players: 0.5 by one, 8 by all sixteen, 0 by nobody",
    value: "0.5 2 3.5 5.5 8",
    min: 0,
    max: DESKS / 2,
    step: 0.5,
    unit: "st",
    anchor: "anchor",
  }),
  anchor: pitch({
    group: "Line",
    label: "Standpoint",
    help: "The first note, played by player 1 alone, and the lower edge of the band. The band is twice as wide as the largest step; the line turns at its edges",
    value: "G3",
    min: "G3",
    max: "G5",
    step: 0.5,
  }),
  cycles: number({
    group: "Form",
    label: "Cycles",
    help: "How many times the line walks through the whole set",
    value: 4,
    min: 1,
    max: 8,
    step: 1,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute; each note lasts two beats",
    value: 60,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

interface Step {
  midi: number;
  /** How many players play it (players 1 to this). */
  desks: number;
}

/** The band: from the standpoint, twice as wide as the largest step. */
function band(v: Values<typeof knobs>): [number, number] {
  const lo = v.anchor;
  return [lo, lo + 2 * Math.max(0, ...v.set)];
}

/** The line: the standpoint, then each between in turn, turning at the edges of the band. */
function line(v: Values<typeof knobs>): Step[] {
  const [lo, hi] = band(v);
  if (hi > TOP)
    throw new Error(
      `Standpoint: the band (standpoint plus twice the largest step) reaches ${hi}, above the violins' ${TOP}`,
    );
  const out: Step[] = [{ midi: lo, desks: 1 }];
  let at = lo;
  let dir = 1;
  for (let c = 0; c < v.cycles; c++)
    for (const b of v.set) {
      // The band is at least twice any step, so the other way always fits.
      if (at + dir * b > hi || at + dir * b < lo) dir = -dir;
      at += dir * b;
      out.push({ midi: at, desks: Math.round(b * 2) });
    }
  return out;
}

/** The ranks the rule never separates: [first, last], cut at each count the line uses. */
function groups(steps: Step[]): [number, number][] {
  const counts = [...new Set(steps.map((s) => s.desks).filter((n) => n > 0))].sort((a, b) => a - b);
  let from = 1;
  return counts.map((n) => {
    const g: [number, number] = [from, n];
    from = n + 1;
    return g;
  });
}

export function score(v: Values<typeof knobs>) {
  const steps = line(v);
  const bar = 4 * TICKS;
  const last = (steps.length - 1) * NOTE;
  const end = Math.ceil((last + NOTE + TICKS) / bar) * bar;

  const parts = groups(steps).map(([first, lastRank]) => {
    const ranks = first === lastRank ? `${first}` : `${first}-${lastRank}`;
    const group: Player = {
      id: `vn1-${ranks}`,
      instrument: "violins-1",
      name: `Violins I ${ranks}`,
      abbreviation: `Vn. I ${ranks}`,
      players: lastRank - first + 1,
      range: band(v),
      grids: [0, 1],
    };
    // A note of n players reaches every group whose last rank is n or lower.
    const events = steps.flatMap((s, k) => {
      if (s.desks < lastRank) return [];
      const at = k * NOTE;
      return [note(at, (k === steps.length - 1 ? end : at + NOTE) - at, s.midi)];
    });
    // One level whenever it plays; the held last note dies away over the final beat.
    const dynamics = curve([
      { at: 0, level: LEVEL },
      { at: end - TICKS, level: LEVEL, ramp: true },
      { at: end, level: 0 },
    ]);
    return part(group, events, dynamics);
  });
  return scoreOf("antara · palette A · the thickness is the step", end / bar, v.tempo, parts);
}

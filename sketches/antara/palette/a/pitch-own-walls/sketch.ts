// antara palette, A (pitch): each voice turns the line round at its own walls.
//
// One line of pitch betweens is read by eight divided violins at once. The line is a set drawn by
// "shift each time" (the set as written, starting one place later each time round), computed once
// and the same for every voice. What differs between the voices is where each one stands: its own
// standpoint (the pitch it starts on) and its own band, a floor and a ceiling measured from that
// standpoint.
//
// The rule, the only mechanism: each voice reads the line with a sign, + at the start (every
// between as written). When the next between would carry a voice past one of its walls, that voice
// turns its sign and reads that between, and every between after it, the other way round, until it
// meets a wall again (the turn persists; it is not a one-step bounce). A band at least twice the
// widest between wide always holds the turned step. The size of every between is the same for
// everyone; whether it goes up or down is a name each voice gives it, from where it stands (which
// wall it last touched).
//
// So the voices reading with the same sign move by the same betweens and keep their vertical
// betweens: they move in parallel, one rigid chord. Voices with the other sign move against them:
// a second rigid chord. Inside a chord, a vertical between changes only on a step where one of the
// two voices turns, and by twice that between; between the two chords it opens or closes by twice
// the between at every step (the contrary motion). Nobody writes a chord: the chords are the
// result of the line and where the voices and their walls stand.
//
// Two voices whose standpoints are a .5 between apart keep a .5 in their vertical between for good
// (every vertical between changes by twice a between, which is whole), so they are always on
// different grids: the standpoints put quarter tones into the vertical betweens, not only into the
// steps. Stacking the line's sizes happens to put the four standpoints on one grid 7 apart
// (4.5 + 2.5 and 3.5 + 3 + 0.5 are both 7); the card counts what that does.
//
// The provisional values (the card gives the reasons): the standpoints are the line's own sizes
// stacked up in the written order; from the bottom, the voices stand alternately near their floor
// and near their ceiling, each at a different distance from that nearer wall, all closer than the
// first between, so the four near their ceilings turn on the first step and the field splits four
// against four at once; the bands have eight different widths.
//
// Time is a set holding one between (a pulse): every between of the line is one onset for all the
// voices, and each note lasts to the next onset. Violins II divided in eight, one player each (one
// colour: eight equal parts cannot all have two of the fourteen, and a part of one plays the solo
// sound), arco, p throughout, no accents. The last chord is held at least a bar, to a bar line, and
// fades to nothing.
//
// The line, the ceilings and the floors are written as text, not on a between-set ruler: the ruler
// keeps its betweens sorted by size, and here the order written is the rule's (for the line) or the
// voices' (for the walls, lowest voice first).
// Card: README.md.

import {
  betweenSet,
  choice,
  number,
  numbersOf,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

/** Violins II: fourteen players, and the range a divided part may use. */
const SECTION = { size: 14, range: [55, 100] as [number, number] };

export const knobs = {
  line: text({
    group: "Line",
    label: "Line",
    help: "The set of betweens of the one line every voice reads, in the order written (semitones, − for down, .5 for a quarter tone). Drawn by shift each time: the set as written, starting one place later each time round",
    value: "4.5 -2.5 3.5 -3 0.5",
  }),
  rounds: number({
    group: "Line",
    label: "Times round",
    help: "How many times the line goes round its set: one onset for every between",
    value: 18,
    min: 1,
    max: 40,
    step: 1,
  }),
  standpoint: pitch({
    group: "Voices",
    label: "Lowest standpoint",
    help: "Where the lowest voice starts; the other standpoints are measured from it",
    value: "B3",
    min: "G3",
    max: "C6",
    step: 0.5,
  }),
  standpoints: betweenSet({
    group: "Voices",
    label: "Standpoints",
    help: "Each voice's standpoint (the pitch it starts on), a between above the lowest one (0 is the lowest voice). As many standpoints as voices (up to 14, one player each)",
    value: "0 4.5 7 10.5 13.5 14 18.5 21",
    min: 0,
    max: 36,
    step: 0.5,
    unit: "st",
    anchor: "standpoint",
  }),
  ceilings: text({
    group: "Voices",
    label: "Ceilings",
    help: "Each voice's ceiling, a between above its own standpoint, lowest voice first. One for every standpoint",
    value: "6 3.5 9 2.5 12 1.5 15 0.5",
  }),
  floors: text({
    group: "Voices",
    label: "Floors",
    help: "Each voice's floor, a between below its own standpoint (− for down), lowest voice first. Every band (floor to ceiling) must be at least twice the widest between of the line, so a turned step always lands inside",
    value: "-4 -7.5 -3 -10.5 -2 -13.5 -1 -16.5",
  }),
  between: number({
    group: "Time",
    label: "Time between",
    help: "The one time between of the time set, in atoms of the family: every between of the line is one onset, this far after the last",
    value: 2,
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time between counts in",
    value: FAMILY_OPTIONS[1]!,
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

/**
 * Every voice reads the same line from its own standpoint, inside its own walls: a between that
 * would carry a voice past a wall turns that voice's sign, and it reads the line the other way
 * round from that between on, until it meets a wall again.
 */
function walk(line: number[], standpoints: number[], walls: [number, number][]): number[][] {
  return walls.map(([floor, ceiling], k) => {
    let pos = standpoints[k]!;
    let sign = 1;
    const pitches = [pos];
    for (const b of line) {
      let x = pos + sign * b;
      if (x < floor || x > ceiling) {
        sign = -sign;
        x = pos + sign * b;
        if (x < floor || x > ceiling)
          throw new Error(
            `Walls: a turned step leaves the band ${floor}–${ceiling}; make it at least twice the widest between`,
          );
      }
      pos = x;
      pitches.push(pos);
    }
    return pitches;
  });
}

const betweensOf = (label: string, value: string): number[] => {
  const out = numbersOf(label, value.replaceAll("−", "-"));
  if (out.some((b) => !Number.isInteger(b * 2)))
    throw new Error(`${label}: betweens are semitones on the quarter-tone grid (4.5, -2, 1)`);
  return out;
};

export function score(v: Values<typeof knobs>) {
  const set = betweensOf("Line", v.line);
  const ceilings = betweensOf("Ceilings", v.ceilings);
  const floors = betweensOf("Floors", v.floors);
  const n = v.standpoints.length;
  if (ceilings.length !== n || floors.length !== n)
    throw new Error(
      `Voices: ${n} standpoints, ${ceilings.length} ceilings and ${floors.length} floors; give every voice one of each`,
    );
  if (n > SECTION.size) throw new Error(`Voices: at most ${SECTION.size} voices, one player each`);
  const widest = Math.max(...set.map(Math.abs));
  const starts = v.standpoints.map((s) => v.standpoint + s);
  const walls = starts.map((s, k): [number, number] => [s + floors[k]!, s + ceilings[k]!]);
  walls.forEach(([lo, hi], k) => {
    if (ceilings[k]! < 0 || floors[k]! > 0)
      throw new Error(
        `Voices: voice ${k + 1} from the bottom stands outside its own band (ceiling ${ceilings[k]}, floor ${floors[k]}); a ceiling is 0 or more, a floor 0 or less`,
      );
    if (hi - lo < 2 * widest)
      throw new Error(
        `Voices: voice ${k + 1} from the bottom has a band of ${hi - lo}, less than twice the widest between (${widest})`,
      );
    if (lo < SECTION.range[0] || hi > SECTION.range[1])
      throw new Error(
        `Voices: voice ${k + 1} from the bottom has walls ${lo}–${hi}, outside the violins' ${SECTION.range[0]}–${SECTION.range[1]}; move the Lowest standpoint or the walls`,
      );
  });

  // The one line, computed once.
  const next = stream(set, "shift each time", 1);
  const line = Array.from({ length: v.rounds * set.length }, () => next());
  const voices = walk(line, starts, walls);

  const step = v.between * atomOf(familyOf(v.family));
  const bar = 4 * TICKS;
  const last = line.length * step;
  const end = Math.ceil((last + bar) / bar) * bar;
  // p throughout; the last chord fades to nothing.
  const dynamics = curve([
    { at: 0, level: 3 },
    { at: last, level: 3, ramp: true },
    { at: end, level: 0 },
  ]);

  // Voice k (from the bottom) is Violins II (n − k): numbered from the top.
  const parts = voices.map((pitches, k) => {
    const j = n - k;
    const player: Player = {
      id: `vn2-${j}`,
      instrument: "violins-2",
      name: `Violins II ${j}`,
      abbreviation: `Vn. II ${j}`,
      players: 1,
      range: [Math.min(...pitches), Math.max(...pitches)],
      grids: [0, 1],
    };
    const events = pitches.map((m, i) => note(i * step, i < line.length ? step : end - last, m));
    return part(player, events, dynamics);
  });
  // Score order: high to low.
  return scoreOf(
    "antara · palette A · each voice turns at its own walls",
    end / bar,
    v.tempo,
    parts.reverse(),
  );
}

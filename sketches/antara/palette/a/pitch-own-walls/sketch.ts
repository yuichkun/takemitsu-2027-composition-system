// antara palette, A (pitch): each voice turns the line round at its own walls.
//
// One line of pitch betweens is read by eight divided violins at once, all from one standpoint. The
// line is a set drawn by "shift each time" (the set as written, starting one place later each time
// round), computed once and the same for every voice. What differs between the voices is only
// their band: a floor and a ceiling of their own, each a between from the standpoint.
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
// result of the line and where the walls stand. Every voice starts from the same pitch and moves
// by the same sizes, so any two voices are always a whole number of semitones apart (twice a .5
// is whole): on a .5 step the whole field crosses to the other grid together.
//
// Time is a set holding one between (a pulse): every between of the line is one onset for all the
// voices, and each note lasts to the next onset. Violins II divided in eight, one player each (one
// colour: eight equal parts cannot all have two of the fourteen, and a part of one plays the solo
// sound), arco, p throughout, no accents. The last chord is held at least a bar, to a bar line, and
// fades to nothing.
//
// The line is written as text, not on a between-set ruler: the ruler keeps its betweens sorted by
// size, and here the order written is the rule's.
//
// The shift rule reads the four betweens after the first twice in a row at every pass boundary
// (a b c d e | b c d e a). With the set's sum +3 and +3 in the set, once every five passes those
// four sum to 0 (+4.5 −2 +1 −3.5): nobody drifts to a wall, and the field plays the same four
// chords twice. That is where the long rigid chords come from; the card lists it as a fact.
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
    value: "4.5 -2 1 -3.5 3",
  }),
  standpoint: pitch({
    group: "Line",
    label: "Standpoint",
    help: "Where every voice starts, together; the walls are measured from it",
    value: "G4",
    min: "C4",
    max: "C6",
    step: 0.5,
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
  ceilings: betweenSet({
    group: "Walls",
    label: "Ceilings",
    help: "Each voice's ceiling, a between above the standpoint. The lowest ceiling goes with the lowest floor (the lowest voice), the next with the next. As many ceilings as floors: that is the number of voices (up to 14, one player each)",
    value: "5 6.5 8 9.5 11 12.5 14 15.5",
    min: 0.5,
    max: 36,
    step: 0.5,
    unit: "st",
    anchor: "standpoint",
  }),
  floors: betweenSet({
    group: "Walls",
    label: "Floors",
    help: "Each voice's floor, a between below the standpoint, lowest first (the lowest voice). Every band must be at least twice the widest between of the line, so a turned step always lands inside",
    value: "-12 -11 -10 -9 -8 -7 -6 -5",
    min: -24,
    max: -0.5,
    step: 0.5,
    unit: "st",
    anchor: "standpoint",
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
 * Every voice reads the same line from the standpoint, each inside its own walls: a between that
 * would carry a voice past a wall turns that voice's sign, and it reads the line the other way
 * round from that between on, until it meets a wall again.
 */
function walk(line: number[], standpoint: number, walls: [number, number][]): number[][] {
  return walls.map(([floor, ceiling]) => {
    let pos = standpoint;
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

export function score(v: Values<typeof knobs>) {
  const set = numbersOf("Line", v.line.replaceAll("−", "-"));
  if (set.some((b) => !Number.isInteger(b * 2)))
    throw new Error("Line: betweens are semitones on the quarter-tone grid (4.5, -2, 1)");
  if (v.ceilings.length !== v.floors.length)
    throw new Error(
      `Walls: ${v.ceilings.length} ceilings and ${v.floors.length} floors; give every voice one of each`,
    );
  if (v.ceilings.length > SECTION.size)
    throw new Error(`Walls: at most ${SECTION.size} voices, one player each`);
  const widest = Math.max(...set.map(Math.abs));
  const walls = v.floors.map((f, k): [number, number] => [
    v.standpoint + f,
    v.standpoint + v.ceilings[k]!,
  ]);
  walls.forEach(([lo, hi], k) => {
    if (hi - lo < 2 * widest)
      throw new Error(
        `Walls: voice ${k + 1} from the bottom has a band of ${hi - lo}, less than twice the widest between (${widest})`,
      );
    if (lo < SECTION.range[0] || hi > SECTION.range[1])
      throw new Error(
        `Walls: voice ${k + 1} from the bottom has walls ${lo}–${hi}, outside the violins' ${SECTION.range[0]}–${SECTION.range[1]}; move the Standpoint or the walls`,
      );
  });

  // The one line, computed once.
  const next = stream(set, "shift each time", 1);
  const line = Array.from({ length: v.rounds * set.length }, () => next());
  const voices = walk(line, v.standpoint, walls);

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
  const n = voices.length;
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

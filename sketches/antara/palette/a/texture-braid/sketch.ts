// antara palette, A (texture): colours trade places by crossing (a braid).
//
// A chord is its betweens stacked on a standpoint, bottom up in the order written. Its pitches
// never change here, from the first sound to the last. Who plays each pitch (the colour) is a name
// given afterwards: six players stand on the six pitches, three tenor trombones on one side of the
// chord and three divided cello parts on the other.
//
// The one operation is a crossing: the two players standing on two neighbouring pitches slide at
// the same time, each to the other's pitch, straight through, and hold there. Halfway their
// vertical between is 0; after it the sounding pitches are the chord again, and only the two names
// have traded places. The rule is odd-even rounds, every crossing an exchange: the pairs 1-2, 3-4
// and 5-6 (from the bottom), then the pairs 2-3 and 4-5, by turns; inside a round the crossings
// come one after another from the bottom pair up. After six rounds every two players have met
// exactly once and the order of the players is upside down, while the chord is the same.
// Time is fixed: a slide, a hold inside a round and a hold between rounds, in atoms of one family.
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
import { curve, note, part, scoreOf, TICKS, time, type Player } from "../../common.ts";
import { tones } from "../../trade.ts";

const STARTS = ["trombones below", "cellos below"];
/** Betweens in the chord: six players stand on its six pitches. */
const BETWEENS = 5;
/** The chord heard whole before the first crossing and after the last, in atoms. */
const OPEN = 12;
const CLOSE = 12;
/** The opening comes out of nothing over this many atoms. */
const FADE_IN = 6;
/** mp, the same for every player throughout. */
const LEVEL = 4;

const trombone = (n: number): Player => ({
  id: `tbn${n}`,
  instrument: "trombone",
  name: `Trombone ${n}`,
  abbreviation: `Tbn. ${n}`,
  players: 1,
  range: [40, 72],
  grids: [0, 1],
});
const cellos = (n: number): Player => ({
  id: `vc-${n}`,
  instrument: "cellos",
  name: `Violoncellos ${n}`,
  abbreviation: `Vc. ${n}`,
  players: 3,
  range: [36, 84],
  grids: [0, 1],
});
// Each colour's three players, bottom up (numbered from the top, as they stand at the start).
const TROMBONES = [trombone(3), trombone(2), trombone(1)];
const CELLOS = [cellos(3), cellos(2), cellos(1)];

export const knobs = {
  chord: text({
    group: "Chord",
    label: "Chord",
    help: "The five betweens of the chord, bottom up in the order written (semitones, .5 for a quarter tone). Its six pitches never change. The odd rounds slide across the 1st, 3rd and 5th between, the even rounds across the 2nd and 4th. Written as text to keep the order",
    value: "5.5 2 6.5 1.5 4",
  }),
  anchor: pitch({
    group: "Chord",
    label: "Standpoint",
    help: "The lowest pitch of the chord",
    value: "Bb2",
    min: "E2",
    max: "C4",
    step: 0.5,
  }),
  start: choice({
    group: "Chord",
    label: "Start",
    help: "Which colour stands on the lower three pitches at the start. At the end it stands on the upper three",
    value: STARTS[0]!,
    options: STARTS,
  }),
  glide: number({
    group: "Time",
    label: "Glide",
    help: "How long every crossing's slide takes, in atoms. The same for all: a wide crossing moves fast, a narrow one slowly",
    value: 3,
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  within: number({
    group: "Time",
    label: "Hold in a round",
    help: "From the end of one crossing to the start of the next in the same round, in atoms",
    value: 3,
    min: 0,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  apart: number({
    group: "Time",
    label: "Hold between rounds",
    help: "From the last crossing of a round to the first of the next, in atoms: the chord heard whole again",
    value: 9,
    min: 0,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the slides and holds count in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Time",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 52,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

function chordOf(value: string): number[] {
  const b = numbersOf("Chord", value.replaceAll("−", "-"));
  if (b.length !== BETWEENS)
    throw new Error(
      `Chord: write ${BETWEENS} betweens (the six players stand on the chord's six pitches)`,
    );
  if (b.some((x) => x < 0 || !Number.isInteger(x * 2)))
    throw new Error("Chord: the betweens go up, in semitones on the quarter-tone grid (2, 3.5)");
  return b;
}

/**
 * The crossings, round by round, each given by the lower of its two positions (0 is the bottom):
 * the odd pairs and the even pairs by turns, as many rounds as there are pitches, so that every
 * two players meet once and the order ends upside down.
 */
function rounds(count: number): number[][] {
  return Array.from({ length: count }, (_, r) => {
    const out: number[] = [];
    for (let lo = r % 2; lo + 1 < count; lo += 2) out.push(lo);
    return out;
  });
}

export function score(v: Values<typeof knobs>) {
  const atom = atomOf(familyOf(v.family));
  const pitches = tones(v.anchor, chordOf(v.chord));
  const players = v.start === STARTS[0] ? [...TROMBONES, ...CELLOS] : [...CELLOS, ...TROMBONES];

  // The relations first: the chord, held. Then the names: on[p] is the player standing on pitch p.
  // Each player's pitches, as (tick it arrives, midi); a slide ends where the next one starts.
  const on = players.map((_, k) => k);
  const held = players.map((_, k) => [{ at: 0, midi: pitches[k]! }]);
  const glide = v.glide * atom;
  let t = OPEN * atom;
  rounds(pitches.length).forEach((round, r) => {
    if (r > 0) t += v.apart * atom;
    round.forEach((lo, i) => {
      if (i > 0) t += v.within * atom;
      const [a, b] = [on[lo]!, on[lo + 1]!];
      t += glide;
      held[a]!.push({ at: t, midi: pitches[lo + 1]! });
      held[b]!.push({ at: t, midi: pitches[lo]! });
      [on[lo], on[lo + 1]] = [b, a];
    });
  });
  const last = t;
  const bar = 4 * TICKS;
  const end = Math.ceil((last + CLOSE * atom) / bar) * bar;

  const dynamics = curve([
    { at: 0, level: 0, ramp: true },
    { at: FADE_IN * atom, level: LEVEL },
    { at: last, level: LEVEL, ramp: true },
    { at: end, level: 0 },
  ]);
  const parts = players.map((p, k) => {
    const xs = held[k]!;
    // A held pitch lasts until the end of the next slide it takes part in, sliding at the end.
    const events = xs.map((x, i) => {
      const next = xs[i + 1];
      if (!next) return note(x.at, end - x.at, x.midi);
      return note(x.at, next.at - x.at, x.midi, {
        gliss: true,
        glissAfter: time(next.at - glide - x.at),
      });
    });
    return { id: p.id, part: part(p, events, dynamics) };
  });
  // Score order: trombones, then cellos, each from 1.
  const order = ["tbn1", "tbn2", "tbn3", "vc-1", "vc-2", "vc-3"];
  return scoreOf(
    "antara · palette A · colours trade places by crossing",
    end / bar,
    v.tempo,
    order.map((id) => parts.find((x) => x.id === id)!.part),
  );
}

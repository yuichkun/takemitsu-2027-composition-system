// antara palette, B: two chords trade their sets, and the sides they stand on.
//
// Uses "the betweens narrow by quarter tones" (ideas/lines/b-narrowing): at every stage, every
// between of a set becomes one quarter tone narrower. Its rule is copied here (not imported), and
// run both ways: one chord narrows, the other widens.
//
// Two chords of six voices hold the same order of betweens and look at it from opposite sides.
// The low chord stands on its lowest voice and stacks the betweens upward; the high chord stands on
// its highest voice and stacks them downward. A standpoint is the voice that holds while the rest
// of its chord moves. The high chord's set starts narrow (Upper start); the low chord's set is the
// same betweens in the same order, each wider by the Gap.
//
// The chords take turns, one stage each, low first. A stage of the low chord narrows every one of
// its betweens by a quarter tone; a stage of the high chord widens every one of its betweens by a
// quarter tone; the voice k betweens away from the standpoint moves by k quarter tones, and the
// other chord holds untouched. Halfway, the two sets are the same (the high chord is the low chord
// upside down). There each chord takes the other side of itself to stand on: the low chord its
// highest voice, the high chord its lowest, each holding where it is. Nothing sounds at that point,
// and no between changes; what changes is which voice holds. Before it, both standpoints are the
// outer voices and every stage moves the inner voices down (narrowing towards a standpoint below,
// widening away from one above); after it, both standpoints face each other across the space
// between the chords, which then holds still, and every stage moves the outer voices up. At the
// end each chord has the other's first set, and stands on the side the other stood on first: the
// whole texture is the first one upside down.
//
// The low chord is in the strings (divided cellos and violas, the contrabasses doubling its lowest
// voice), the high chord in the winds (piccolo, two flutes, oboe, two clarinets), so which chord has
// moved can be heard. The stages come on the time betweens written, in order; each chord's new
// notes start p and settle to pp; the last state holds, then fades. Nothing builds toward the
// meeting.
// Card: README.md.

import { instrument } from "../../../../../src/instruments/catalog.ts";
import {
  choice,
  number,
  numbersOf,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, TICKS, type Player } from "../../common.ts";
import { tones } from "../../trade.ts";

export const knobs = {
  upper: text({
    group: "Sets",
    label: "Upper start",
    help: "The high chord's first betweens, from its standpoint down, in the order written (five, semitones, .5 for a quarter tone). The low chord stacks the same order upward, each between wider by the Gap",
    value: "1.5 0.5 2.5 1 2",
  }),
  gap: number({
    group: "Sets",
    label: "Gap",
    help: "How much wider each of the low chord's first betweens is than the high chord's. Each chord makes as many stages as the Gap has quarter tones; the sets meet halfway, where both chords change the side they stand on, and have traded places at the end",
    value: 4,
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  low: pitch({
    group: "Standpoints",
    label: "Low standpoint",
    help: "The low chord's lowest voice (cellos, doubled by the contrabasses). It holds until the sets meet; then the low chord stands on its highest voice, and this one moves up",
    value: "G2",
    min: "C2",
    max: "C4",
    step: 0.5,
  }),
  high: pitch({
    group: "Standpoints",
    label: "High standpoint",
    help: "The high chord's highest voice (piccolo). It holds until the sets meet; then the high chord stands on its lowest voice, and this one moves up. Each voice of the high chord must stay in its wind's range: the chord is highest at its start (narrowest) and at its end (widened upward)",
    value: "Ab6",
    min: "C6",
    max: "C8",
    step: 0.5,
  }),
  changes: text({
    group: "Time",
    label: "Change times",
    help: "The time from one stage to the next (the first from the start), in atoms of the family, in the order written, again and again. The stages alternate low, high",
    value: "13 15 9",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the change times count in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 54,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

/** A part of the given number of players, with its instrument's whole range. */
const player = (
  id: string,
  instrumentId: string,
  name: string,
  abbreviation: string,
  players = 1,
): Player => ({
  id,
  instrument: instrumentId,
  name,
  abbreviation,
  players,
  range: instrument(instrumentId).range!,
  grids: [0, 1],
});

/** The high chord, from its first standpoint down: one wind per voice. */
const WINDS: Player[] = [
  player("picc", "piccolo", "Piccolo", "Picc."),
  player("fl1", "flute", "Flute 1", "Fl. 1"),
  player("fl2", "flute", "Flute 2", "Fl. 2"),
  player("ob", "oboe", "Oboe", "Ob."),
  player("cl1", "clarinet", "Clarinet 1", "Cl. 1"),
  player("cl2", "clarinet", "Clarinet 2", "Cl. 2"),
];

/**
 * The low chord, from its first standpoint up: the cellos in four and the violas in two. Fixed, not
 * divided by register: the two highest voices' ranges would also fit the violins, and a whole
 * violin section on each of them would weigh far more than the single winds of the other chord.
 */
const STRINGS: Player[] = [
  player("vc-4", "cellos", "Violoncellos 4", "Vc. 4", 2),
  player("vc-3", "cellos", "Violoncellos 3", "Vc. 3", 2),
  player("vc-2", "cellos", "Violoncellos 2", "Vc. 2", 3),
  player("vc-1", "cellos", "Violoncellos 1", "Vc. 1", 3),
  player("va-2", "violas", "Violas 2", "Va. 2", 6),
  player("va-1", "violas", "Violas 1", "Va. 1", 6),
];

/** Doubles the low chord's lowest voice. */
const BASS: Player = player("cb", "basses", "Contrabasses", "Cb.", 8);

/**
 * The rule of ideas/lines/b-narrowing: after `s` stages every between of the set has moved by `s`
 * quarter tones (`sign` -1 narrows, as there; +1 widens, the same rule reversed).
 */
const staged = (set: number[], s: number, sign: 1 | -1) => set.map((b) => b + sign * 0.5 * s);

/** Moves a chord (a list of pitches) so that its voice `r` stands on `at`. */
const standOn = (chord: number[], r: number, at: number) => chord.map((m) => m - chord[r]! + at);

/** Where each voice is, from the start: (tick, midi), a new entry at each move. */
type Path = { at: number; midi: number }[];

export function score(v: Values<typeof knobs>) {
  const upper = numbersOf("Upper start", v.upper.replaceAll("−", "-"));
  if (upper.length !== WINDS.length - 1)
    throw new Error(
      `Upper start: five betweens (six voices a chord: piccolo, two flutes, oboe, two clarinets); ${upper.length} given`,
    );
  if (upper.some((b) => b < 0 || !Number.isInteger(b * 2)))
    throw new Error("Upper start: betweens are 0 or more, on the quarter-tone grid (1.5, 0.5, 2)");
  const times = numbersOf("Change times", v.changes);
  if (times.some((n) => !Number.isInteger(n) || n < 1))
    throw new Error("Change times: whole numbers of atoms, 1 or more");

  const atom = atomOf(familyOf(v.family));
  const bar = 4 * TICKS;
  const stages = Math.round(v.gap * 2);
  // The sets are the same once the two chords have made `stages` stages together (the low chord,
  // moving first, the odd one when `stages` is odd). There both change the side they stand on.
  const lowMeet = Math.ceil(stages / 2);
  const highMeet = Math.floor(stages / 2);
  const lowStart = upper.map((b) => b + v.gap);
  // The voice furthest from each chord's first standpoint: its standpoint after the meeting.
  const far = lowStart.length;
  /** The low chord after `j` stages, bottom up: on its lowest voice, then (after the meeting) on its highest. */
  const lowAt = (j: number): number[] => {
    const chord = tones(v.low, staged(lowStart, j, -1));
    return j <= lowMeet ? chord : standOn(chord, far, lowAt(lowMeet)[far]!);
  };
  /** The high chord after `k` stages, top down: on its highest voice, then (after the meeting) on its lowest. */
  const highAt = (k: number): number[] => {
    const chord = tones(
      v.high,
      staged(upper, k, 1).map((b) => -b),
    );
    return k <= highMeet ? chord : standOn(chord, far, highAt(highMeet)[far]!);
  };

  const low: Path[] = lowAt(0).map((midi) => [{ at: 0, midi }]);
  const high: Path[] = highAt(0).map((midi) => [{ at: 0, midi }]);
  const move = (paths: Path[], at: number, now: number[]) =>
    now.forEach((midi, r) => {
      if (paths[r]!.at(-1)!.midi !== midi) paths[r]!.push({ at, midi });
    });
  let t = 0;
  let j = 0;
  let k = 0;
  for (let n = 0; n < 2 * stages; n++) {
    t += times[n % times.length]! * atom;
    if (n % 2 === 0) move(low, t, lowAt(++j));
    else move(high, t, highAt(++k));
  }
  // The last state holds two bars, to a bar line, then fades.
  const end = Math.ceil((t + 2 * bar) / bar) * bar;

  const rangeOf = (p: Path): [number, number] => [
    Math.min(...p.map((x) => x.midi)),
    Math.max(...p.map((x) => x.midi)),
  ];
  high.forEach((p, r) => {
    const [lo, hi] = rangeOf(p);
    const [a, b] = WINDS[r]!.range;
    if (lo < a || hi > b)
      throw new Error(
        `High standpoint, Upper start or Gap: the ${WINDS[r]!.name} would reach from ${lo} to ${hi}, outside its range (${a}–${b}). The high chord is at its highest at its start (narrowest, from the High standpoint down) and at its end (widened upward from where it stood at the meeting)`,
      );
  });
  low.forEach((p, r) => {
    const [lo, hi] = rangeOf(p);
    const [a, b] = STRINGS[r]!.range;
    if (lo < a || hi > b)
      throw new Error(
        `Low standpoint, Upper start or Gap: the ${STRINGS[r]!.name} would reach from ${lo} to ${hi}, outside its range (${a}–${b})`,
      );
  });

  // pp from the first beat; a new note starts p and settles to pp over 2 beats; the last bar fades.
  const settle = 2 * TICKS;
  const partOf = (player: Player, p: Path) => {
    const events = p.map((x, i) => note(x.at, (p[i + 1]?.at ?? end) - x.at, x.midi));
    const points: { at: number; level: number; ramp?: boolean }[] = [{ at: 0, level: 2 }];
    for (const [i, x] of p.entries()) {
      if (i === 0) continue;
      const until = Math.min(p[i + 1]?.at ?? end, x.at + settle, end - bar);
      points.push({ at: x.at, level: 3, ramp: true }, { at: Math.max(until, x.at + 1), level: 2 });
    }
    points.push({ at: end - bar, level: 2, ramp: true }, { at: end, level: 0 });
    return part(player, events, curve(points));
  };

  const windParts = high.map((p, r) => partOf({ ...WINDS[r]!, range: rangeOf(p) }, p));
  const stringParts = low.map((p, r) => partOf({ ...STRINGS[r]!, range: rangeOf(p) }, p)).reverse();
  const bass = partOf({ ...BASS, range: rangeOf(low[0]!) }, low[0]!);

  return scoreOf("antara · palette B · two chords trade their sets", end / bar, v.tempo, [
    ...windParts,
    ...stringParts,
    bass,
  ]);
}

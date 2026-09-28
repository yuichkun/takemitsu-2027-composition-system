// antara palette, B: two chords trade their sets.
//
// Uses "the betweens narrow by quarter tones" (ideas/lines/b-narrowing): at every stage, every
// between of a set becomes one quarter tone narrower. Its rule is copied here (not imported), and
// run both ways: one chord narrows, the other widens.
//
// Two chords of six voices hold the same order of betweens and look at it from opposite sides.
// The low chord stands on its lowest voice and stacks the betweens upward; the high chord stands on
// its highest voice and stacks them downward. The two standpoints never move: each is one note from
// the first beat to the last. The high chord's set starts narrow (Upper start); the low chord's set
// is the same betweens in the same order, each wider by the Gap.
//
// The chords take turns, one stage each, low first. A stage of the low chord narrows every one of
// its betweens by a quarter tone; a stage of the high chord widens every one of its betweens by a
// quarter tone. Every voice of the moving chord except its standpoint moves, all of them downward:
// the voice k betweens away from the standpoint by k quarter tones, so the voices of odd rank cross
// to the other grid and those of even rank stay. The other chord holds untouched. After as many
// stages each as the Gap has quarter tones, the two sets have met once (halfway: the high chord is
// then the low chord upside down) and traded places: the low chord ends with the high chord's first
// set, the high chord with the low chord's first. The space between the chords (from the low
// chord's top to the high chord's bottom) is the same size whenever both have made the same number
// of stages, because both of its ends come down by the same amount per stage.
//
// The low chord is in the strings (divided cellos and violas, a contrabass doubling its
// standpoint), the high chord in the winds (piccolo on its standpoint, two flutes, oboe, two
// clarinets), so which chord has moved can be heard. The stages come on the time betweens written,
// in order; each chord's new notes start p and settle to pp; the last state holds, then fades.
// Nothing builds toward the meeting.
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
import { curve, divisi, note, part, scoreOf, TICKS, type Player } from "../../common.ts";
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
    help: "How much wider each of the low chord's first betweens is than the high chord's. Each chord makes as many stages as the Gap has quarter tones; the sets meet halfway and have traded places at the end",
    value: 4,
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  low: pitch({
    group: "Standpoints",
    label: "Low standpoint",
    help: "The low chord's lowest voice (cellos, doubled by a contrabass). It never moves",
    value: "G2",
    min: "C2",
    max: "C4",
    step: 0.5,
  }),
  high: pitch({
    group: "Standpoints",
    label: "High standpoint",
    help: "The high chord's highest voice (piccolo). It never moves. Each voice of the high chord must stay in its wind's range: the chord starts at its highest and narrowest, and widens downward as far as the Gap takes it",
    value: "Bb6",
    min: "C6",
    max: "C8",
    step: 0.5,
  }),
  changes: text({
    group: "Time",
    label: "Change times",
    help: "The time from one stage to the next (the first from the start), in atoms of the family, in the order written, again and again. The stages alternate low, high",
    value: "12 15 9",
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

const wind = (id: string, instrumentId: string, name: string, abbreviation: string): Player => ({
  id,
  instrument: instrumentId,
  name,
  abbreviation,
  players: 1,
  range: instrument(instrumentId).range!,
  grids: [0, 1],
});

/** The high chord, from its standpoint down: one wind per voice. */
const WINDS: Player[] = [
  wind("picc", "piccolo", "Piccolo", "Picc."),
  wind("fl1", "flute", "Flute 1", "Fl. 1"),
  wind("fl2", "flute", "Flute 2", "Fl. 2"),
  wind("ob", "oboe", "Oboe", "Ob."),
  wind("cl1", "clarinet", "Clarinet 1", "Cl. 1"),
  wind("cl2", "clarinet", "Clarinet 2", "Cl. 2"),
];

const BASS: Player = {
  id: "cb",
  instrument: "basses",
  name: "Contrabasses",
  abbreviation: "Cb.",
  players: 8,
  range: [28, 67],
  grids: [0, 1],
};

/**
 * The rule of ideas/lines/b-narrowing: after `s` stages every between of the set has moved by `s`
 * quarter tones (`sign` -1 narrows, as there; +1 widens, the same rule reversed).
 */
const staged = (set: number[], s: number, sign: 1 | -1) => set.map((b) => b + sign * 0.5 * s);

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
  const lowStart = upper.map((b) => b + v.gap);
  const lowAt = (j: number) => tones(v.low, staged(lowStart, j, -1));
  const highAt = (k: number) =>
    tones(
      v.high,
      staged(upper, k, 1).map((b) => -b),
    );

  const low: Path[] = lowAt(0).map((midi) => [{ at: 0, midi }]);
  const high: Path[] = highAt(0).map((midi) => [{ at: 0, midi }]);
  const move = (paths: Path[], at: number, now: number[]) =>
    now.forEach((midi, r) => {
      if (r > 0) paths[r]!.push({ at, midi });
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
        `High standpoint, Upper start or Gap: the ${WINDS[r]!.name} would go from ${hi} to ${lo}, outside its range (${a}–${b}). The high chord starts at its highest and widens downward for as many stages as the Gap has quarter tones`,
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

  const strings = divisi(low.map(rangeOf));
  const windParts = high.map((p, r) => partOf({ ...WINDS[r]!, range: rangeOf(p) }, p));
  const stringParts = low.map((p, r) => partOf(strings[r]!, p)).reverse();
  const bass = partOf(BASS, [{ at: 0, midi: v.low }]);

  return scoreOf("antara · palette B · two chords trade their sets", end / bar, v.tempo, [
    ...windParts,
    ...stringParts,
    bass,
  ]);
}

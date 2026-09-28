// antara palette, B: meetings handed around.
//
// Uses "other orders, the same place" (../../a/pitch-same-sum-meets). Four voices start together
// on one standpoint and walk on, each adding the next between of one and the same set to its own
// last pitch, each by its own rule: the set as written, reversed, narrow first, wide first, every
// voice starting its reading one place later each pass. A pass takes every between of the set once,
// so whatever the order it adds up to the sum of the set: after each pass the four voices stand on
// one pitch (they meet), the standpoint plus the sums so far. Its logic is copied here, not
// imported.
//
// Here there are three such groups of four: four horns, three clarinets and the bass clarinet, and
// the first violins divided in four. Their standpoints are 12.5 semitones apart (with .5: the same
// meeting stands on the other grid in the middle group), and each group enters a third of a pass
// after the one below, so the meetings come round from group to group, evenly spaced, never two at
// once. At each meeting a holding part takes the pitch the four
// have just met on and holds it until the group's next meeting: the cellos for the horns, the
// violas for the clarinets, two flutes in unison for the violins. The three held lines are the walk
// of the meetings.
//
// The set changes twice, at each group's own pass boundary, keeping its shape and changing only its
// sum: +0.5 for six passes (the meetings rise a quarter tone a pass), −1.5 for two (they fall three
// quarter tones a pass), 0 for four (the meetings no longer move). The sums of the whole sketch add
// up to 0: the meetings come back to the standpoints and stay there. At the end each group holds its
// last meeting and fades, one group after another, and the held lines fade last.
// The groups at p, the held lines at pp, flat throughout, no accents.
//
// The sets are written as text, not on a between-set ruler: the ruler keeps its betweens sorted by
// size, and the order written is voice 1's rule.
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

const SET_HELP =
  "The betweens of the set, in the order written (semitones, − for down, .5 for a quarter tone). Voice 1 of each group reads them as written, voice 2 reversed, voice 3 narrow first, voice 4 wide first; every pass takes each once, so every pass moves the meeting by the sum of the set";
const PASSES_HELP =
  "How many passes each group reads this set. The set changes at each group's own pass boundary";

export const knobs = {
  set1: text({
    group: "Section 1",
    label: "Set",
    help: SET_HELP,
    value: "-4 6 -5.5 0.5 -1 4.5",
  }),
  passes1: number({
    group: "Section 1",
    label: "Passes",
    help: PASSES_HELP,
    value: 6,
    min: 1,
    max: 24,
    step: 1,
  }),
  set2: text({
    group: "Section 2",
    label: "Set",
    help: SET_HELP,
    value: "-4.5 3 -5 1.5 -2 5.5",
  }),
  passes2: number({
    group: "Section 2",
    label: "Passes",
    help: PASSES_HELP,
    value: 2,
    min: 1,
    max: 24,
    step: 1,
  }),
  set3: text({
    group: "Section 3",
    label: "Set",
    help: SET_HELP,
    value: "-4 6 -5.5 0.5 -1.5 4.5",
  }),
  passes3: number({
    group: "Section 3",
    label: "Passes",
    help: PASSES_HELP,
    value: 4,
    min: 1,
    max: 24,
    step: 1,
  }),
  anchor: pitch({
    group: "Standpoints",
    label: "Horns",
    help: "The standpoint of the lowest group (the horns): where its four voices start, together. The clarinets and the violins start one and two Apart above. Nothing is folded into range: a voice that leaves its instrument stops the sketch with an error",
    value: "E3",
    min: "C2",
    max: "C5",
    step: 0.5,
  }),
  apart: number({
    group: "Standpoints",
    label: "Apart",
    help: "The between of one group's standpoint and the next one's. With .5, the same meeting stands on the other grid in the middle group",
    value: 12.5,
    min: 0,
    max: 24,
    step: 0.5,
    unit: "st",
  }),
  between: number({
    group: "Time",
    label: "Time between",
    help: "The one time between of the time set, in atoms of the family: every onset of a group is this far after the last, and its four voices strike together",
    value: 3,
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  entries: number({
    group: "Time",
    label: "Entries apart",
    help: "How long after the group below each group enters, in atoms of the family. A third of a pass spaces the three groups' meetings evenly",
    value: 6,
    min: 1,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time betweens count in",
    value: FAMILY_OPTIONS[0]!,
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

const one = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  range: [number, number],
  players?: number,
): Player => ({
  id,
  instrument,
  name,
  abbreviation,
  range,
  grids: [0, 1],
  ...(players !== undefined ? { players } : {}),
});

const HORNS = [1, 2, 3, 4].map((j) => one(`hn${j}`, "horn", `Horn ${j}`, `Hn. ${j}`, [34, 77]));
const CLARINETS = [1, 2, 3].map((j) =>
  one(`cl${j}`, "clarinet", `Clarinet ${j}`, `Cl. ${j}`, [50, 94]),
);
const BASS_CLARINET = one("bcl", "bass-clarinet", "Bass Clarinet", "B. Cl.", [34, 77]);
const VIOLINS = [1, 2, 3, 4].map((j) =>
  one(`vn1-${j}`, "violins-1", `Violins I ${j}`, `Vn. I ${j}`, [55, 103], 4),
);
// The holding parts, low to high: one for each group. The flutes' lowest note in playback is C4.
// The cellos, not the basses, hold the horns' meetings: the basses' samples stop at 54, and the
// meetings of the horns reach 55.
const HOLDERS: Player[] = [
  one("vc", "cellos", "Violoncellos", "Vc.", [36, 84], 10),
  one("va", "violas", "Violas", "Va.", [48, 91], 12),
  one("fl", "flute", "Flutes 1·2", "Fl. 1·2", [60, 98], 2),
];
const GROUPS = ["Horns", "Clarinets", "Violins I"];

/** The four rules' base orders: as written, reversed, narrow first, wide first. */
function readings(set: number[]): number[][] {
  const narrow = [...set].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  return [set, [...set].reverse(), narrow, [...narrow].reverse()];
}

function setOf(label: string, value: string): number[] {
  const set = numbersOf(label, value.replaceAll("−", "-"));
  if (set.some((b) => !Number.isInteger(b * 2)))
    throw new Error(`${label}: betweens are semitones on the quarter-tone grid (4, 5.5, -1)`);
  return set;
}

export function score(v: Values<typeof knobs>) {
  const sections = [
    { set: setOf("Section 1 set", v.set1), passes: v.passes1 },
    { set: setOf("Section 2 set", v.set2), passes: v.passes2 },
    { set: setOf("Section 3 set", v.set3), passes: v.passes3 },
  ];
  // The steps at which a pass ends (and the start): where the four voices of a group meet.
  const meetings = [0];
  for (const { set, passes } of sections)
    for (let p = 0; p < passes; p++) meetings.push(meetings.at(-1)! + set.length);
  const steps = meetings.at(-1)!;

  // A group's four voices, from its standpoint: one pitch per onset. Each section reads its own
  // set, from the start of the reading again.
  const walk = (anchor: number): number[][] => {
    const voices = [0, 1, 2, 3].map(() => [anchor]);
    for (const { set, passes } of sections) {
      readings(set).forEach((base, k) => {
        const next = stream(base, "shift each time", 1);
        const xs = voices[k]!;
        for (let i = 0; i < passes * set.length; i++) xs.push(xs.at(-1)! + next());
      });
    }
    return voices;
  };
  const groups = [0, 1, 2].map((g) => walk(v.anchor + g * v.apart));

  // The clarinets: the bass clarinet takes the voice whose highest pitch is lowest.
  const top = (xs: number[]) => Math.max(...xs);
  const low = groups[1]!.reduce((a, xs, k) => (top(xs) < top(groups[1]![a]!) ? k : a), 0);
  let c = 0;
  const clarinets = groups[1]!.map((_, k) => (k === low ? BASS_CLARINET : CLARINETS[c++]!));
  const players = [HORNS, clarinets, VIOLINS];

  const inRange = (xs: number[], p: Player, what: string) => {
    const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
    if (lo < p.range[0] || hi > p.range[1])
      throw new Error(
        `Standpoints: ${what} (${p.name}) walks from ${lo} to ${hi}, outside ${p.range[0]}–${p.range[1]}; move the standpoints or change the sets`,
      );
  };
  groups.forEach((voices, g) =>
    voices.forEach((xs, k) => inRange(xs, players[g]![k]!, `${GROUPS[g]} voice ${k + 1}`)),
  );

  const atom = atomOf(familyOf(v.family));
  const step = v.between * atom;
  const offset = (g: number) => g * v.entries * atom;
  const lastMeeting = (g: number) => offset(g) + steps * step;
  const end = lastMeeting(2) + 4 * TICKS;
  const bar = 4 * TICKS;

  // Each group: every note to the next onset; the last meeting held two beats, fading.
  const groupParts = groups.flatMap((voices, g) => {
    const last = lastMeeting(g);
    const dynamics = curve([
      { at: 0, level: 3 },
      { at: last, level: 3, ramp: true },
      { at: last + 2 * TICKS, level: 0 },
    ]);
    return voices.map((xs, k) =>
      part(
        players[g]![k]!,
        xs.map((m, i) => note(offset(g) + i * step, i < steps ? step : 2 * TICKS, m)),
        dynamics,
      ),
    );
  });

  // Each holder: at each of its group's meetings it takes the pitch the four meet on, and holds it
  // to the group's next meeting; the last until the end, fading after the violins' last meeting.
  const holderParts = groups.map((voices, g) => {
    const xs = voices[0]!;
    if (meetings.some((i) => voices.some((ys) => ys[i] !== xs[i])))
      throw new Error(`${GROUPS[g]}: the four voices do not meet at a pass end`);
    const pitches = meetings.map((i) => xs[i]!);
    inRange(pitches, HOLDERS[g]!, `the meetings of the ${GROUPS[g]}`);
    const events = meetings.map((i, j) => {
      const at = offset(g) + i * step;
      const stop = j + 1 < meetings.length ? offset(g) + meetings[j + 1]! * step : end;
      return note(at, stop - at, xs[i]!);
    });
    return part(
      HOLDERS[g]!,
      events,
      curve([
        { at: 0, level: 2 },
        { at: lastMeeting(2), level: 2, ramp: true },
        { at: end, level: 0 },
      ]),
    );
  });

  // Score order: flutes, clarinets, bass clarinet, horns, violins, violas, cellos.
  const byId = (id: string) => [...groupParts, ...holderParts].find((p) => p.id === id)!;
  const order = [
    "fl",
    "cl1",
    "cl2",
    "cl3",
    "bcl",
    "hn1",
    "hn2",
    "hn3",
    "hn4",
    "vn1-1",
    "vn1-2",
    "vn1-3",
    "vn1-4",
    "va",
    "vc",
  ];
  return scoreOf(
    "antara · palette B · meetings handed around",
    Math.ceil(end / bar),
    v.tempo,
    order.map(byId),
  );
}

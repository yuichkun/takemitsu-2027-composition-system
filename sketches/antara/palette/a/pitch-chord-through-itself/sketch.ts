// antara palette, A (pitch): a chord passes through itself.
//
// A chord is its betweens stacked on a standpoint, bottom up, in the order written. A chord of
// n + 1 tones has n betweens between neighbours, but every two of its tones stand some between
// apart: n (n + 1) / 2 betweens in all, most of them never written and never sounded as a step.
//
// Two copies of the one chord. The held copy: one woodwind player on each tone, from the start to
// the end. The sliding copy: one divided string part on each tone, all moving together at one
// constant rate, one quarter tone per atom, from above the held chord to below it, so the between
// d from each held tone to its own sliding tone goes from +(span + overshoot) to −(span + overshoot).
// Sliding tone i meets held tone j (their vertical between is 0) only when d = t_j − t_i: once for
// every ordered pair of tones, and for all tones at once at d = 0, where the two copies are one.
// The only rule: at each such moment the held tone is struck on a piano. Nothing else sets time.
// So the times of the strikes are the chord's whole list of betweens (each between twice, once
// from each side), and the rhythm around the moment d = 0 is its own mirror: the same between is
// heard once with the sliding copy above (striking the pair's upper tone) and once below (striking
// its lower tone). Followed on one pitch, every tone strikes the same rhythm: the neighbour
// betweens, bottom up, as twice as many atoms, shifted by where the tone stands in the chord.
//
// Which piano strikes is decided by the grid of the held tone alone: Piano I (usual tuning) holds
// the usual semitones, Piano II (tuned a quarter tone low) the semitones a quarter tone off.
// Both chords pp, the strikes mp, all flat. Every sliding part has the same number of players, so
// each sliding tone weighs the same and the solo winds are not covered.
//
// Two things are set by playback. The copy slides down, not up: a glide in playback may move at
// most 36 semitones from the key it starts on (the first pitch rounded down), and a glide starting
// on a quarter tone would need 36.5 going up (35.5 going down). The strings play flautando rather
// than sul tasto: the cello section's sul tasto samples stop one key below where the highest cello
// part starts. Card: README.md.

import {
  choice,
  number,
  numbersOf,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import {
  curve,
  divisi,
  gridOf,
  inOrder,
  note,
  part,
  scoreOf,
  TICKS,
  type Player,
} from "../../common.ts";

export const knobs = {
  chord: text({
    group: "Chord",
    label: "Chord",
    help: "The betweens of the chord, bottom up in the order written (semitones, .5 for a quarter tone). Every two tones of the chord, neighbours or not, meet once on each side of the centre",
    value: "1.5 2 2.5 3 3.5 5",
  }),
  anchor: pitch({
    group: "Chord",
    label: "Standpoint",
    help: "The lowest tone of the chord. The times of the strikes do not depend on it; it decides the grids of the tones (and so which piano strikes each) and where the instruments play. The range is the standpoints that keep every held tone in its woodwind's range and every slide in its string section's range, for the default chord",
    value: 60.5,
    min: 56.5,
    max: 67.5,
    step: 0.5,
  }),
  family: choice({
    group: "Slide",
    label: "Family",
    help: "The atom the slide counts in: the sliding copy moves one quarter tone per atom",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  overshoot: number({
    group: "Slide",
    label: "Overshoot",
    help: "How far the slide starts before the first meeting and ends after the last one (quarter tones). A slide may be at most 36 semitones long in playback",
    value: 1,
    min: 1,
    max: 8,
    step: 1,
    unit: "quarter tones",
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 40,
    min: 30,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

const wind = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  range: [number, number],
): Player => ({ id, instrument, name, abbreviation, range, grids: [0, 1] });

// Low to high: the held chord's tones take them in this order, one tone each.
const WINDS: Player[] = [
  wind("bsn", "bassoon", "Bassoon", "Bsn.", [34, 75]),
  wind("bcl", "bass-clarinet", "Bass Clarinet", "B. Cl.", [34, 77]),
  wind("cl2", "clarinet", "Clarinet 2", "Cl. 2", [50, 94]),
  wind("cl1", "clarinet", "Clarinet 1", "Cl. 1", [50, 94]),
  wind("ob", "oboe", "Oboe", "Ob.", [58, 93]),
  wind("fl", "flute", "Flute", "Fl.", [59, 98]),
  wind("picc", "piccolo", "Piccolo", "Picc.", [74, 108]),
];
const WIND_ORDER = ["piccolo", "flute", "oboe", "clarinet", "bass-clarinet", "bassoon"];

// By grid: [0] the usual semitones, [1] those a quarter tone off.
const PIANOS: Player[] = [
  {
    id: "pno1",
    instrument: "piano",
    name: "Piano I",
    abbreviation: "Pno. I",
    range: [21, 108],
    grids: [0],
  },
  {
    id: "pno2",
    instrument: "piano",
    name: "Piano II (tuned ¼ tone low)",
    abbreviation: "Pno. II",
    range: [21, 108],
    grids: [1],
  },
];

/** Sounding ranges of the string sections (catalog), for the sliding parts. */
const SECTION_RANGE: Record<string, [number, number]> = {
  cellos: [36, 84],
  violas: [48, 91],
  "violins-2": [55, 100],
  "violins-1": [55, 103],
};
const SECTION_SIZE: Record<string, number> = {
  cellos: 10,
  violas: 12,
  "violins-2": 14,
  "violins-1": 16,
};

/** The glide: longest in playback, in semitones from the key it starts on. */
const LONGEST_GLIDE = 36;
const STROKE = "flautando";

export function score(v: Values<typeof knobs>) {
  const chord = numbersOf("Chord", v.chord.replaceAll("−", "-"));
  if (chord.some((b) => !Number.isInteger(b * 2) || b < 0.5))
    throw new Error("Chord: betweens are 0.5 or more, on the quarter-tone grid (1.5, 2, 5)");
  if (chord.length + 1 > WINDS.length)
    throw new Error(`Chord: at most ${WINDS.length - 1} betweens (one woodwind player per tone)`);

  const tones = [v.anchor];
  for (const b of chord) tones.push(tones.at(-1)! + b);
  const n = tones.length;
  const span = tones.at(-1)! - tones[0]!;
  // The sliding copy's between from the held one: from +reach down to −reach, 0.5 per atom.
  const reach = span + v.overshoot / 2;
  const steps = Math.round(4 * reach);
  // Playback plays a slide as one key (the first pitch, rounded down) retuned along the way.
  const widest = Math.max(...tones.map((t) => Math.floor(t + reach) - (t - reach)));
  if (widest > LONGEST_GLIDE)
    throw new Error(
      `Overshoot: each slide would be ${2 * reach} semitones; playback slides at most ${LONGEST_GLIDE} from the key it starts on`,
    );

  const bar = 4 * TICKS;
  const atom = atomOf(familyOf(v.family));
  const start = bar;
  const slideEnd = start + steps * atom;
  const holdEnd = slideEnd + 2 * TICKS;
  const end = Math.ceil((holdEnd + 4 * TICKS) / bar) * bar;

  // The held chord.
  const winds = inOrder(
    tones.map((t): [number, number] => [t, t]),
    WINDS,
  );
  const windParts = tones.map((t, k) => {
    const p = winds[k]!;
    const own = WINDS.find((w) => w.id === p.id)!.range;
    if (t < own[0] || t > own[1])
      throw new Error(`Standpoint: ${t} is outside the ${p.name}'s range`);
    const dynamics = curve([
      { at: 0, level: 0, ramp: true },
      { at: 2 * TICKS, level: 2 },
      { at: end - 4 * TICKS, level: 2, ramp: true },
      { at: end, level: 0 },
    ]);
    return part(p, [note(0, end, t)], dynamics);
  });
  windParts.sort(
    (a, b) =>
      WIND_ORDER.indexOf(a.instrument) - WIND_ORDER.indexOf(b.instrument) ||
      a.id.localeCompare(b.id),
  );

  // The sliding chord: every part the same number of players (as many as the most divided section
  // allows), so each sliding tone weighs the same.
  const paths = tones.map((t): [number, number] => [t - reach, t + reach]);
  const strings = divisi(paths);
  const count = (s: string) => strings.filter((p) => p.instrument === s).length;
  const even = Math.min(
    ...strings.map((p) => Math.floor(SECTION_SIZE[p.instrument]! / count(p.instrument))),
  );
  const stringParts = tones.map((t, k) => {
    const p = { ...strings[k]!, players: even };
    const [lo, hi] = SECTION_RANGE[p.instrument]!;
    if (t - reach < lo || t + reach > hi)
      throw new Error(
        `Standpoint: the slide of ${t} (${t + reach} to ${t - reach}) leaves the ${p.name}' range`,
      );
    const events = [
      note(start, steps * atom, t + reach, { gliss: true, technique: STROKE }),
      note(slideEnd, holdEnd - slideEnd, t - reach, { technique: STROKE }),
    ];
    const dynamics = curve([
      { at: start, level: 2 },
      { at: slideEnd, level: 2, ramp: true },
      { at: holdEnd, level: 0 },
    ]);
    return part(p, events, dynamics);
  });
  stringParts.reverse();

  // The meetings: sliding tone i is on held tone j when d = t_j − t_i, at this many atoms from the
  // start of the slide. There the piano of t_j's grid strikes t_j.
  const strikes = PIANOS.map(() => new Map<number, number[]>());
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const d = tones[j]! - tones[i]!;
      const at = start + Math.round(2 * (reach - d)) * atom;
      const byTime = strikes[gridOf(tones[j]!)]!;
      byTime.set(at, [...(byTime.get(at) ?? []), tones[j]!]);
    }
  const pianoParts = PIANOS.map((p, g) => {
    const times = [...strikes[g]!.entries()].sort((a, b) => a[0] - b[0]);
    const events = times.map(([at, pitches], k) => {
      const next = times[k + 1]?.[0] ?? Infinity;
      const sorted = [...pitches].sort((a, b) => a - b);
      return note(at, Math.min(next - at, 2 * TICKS), sorted.length === 1 ? sorted[0]! : sorted);
    });
    return part(p, events, curve([{ at: 0, level: 4 }]));
  });

  return scoreOf("antara · palette A · a chord passes through itself", end / bar, v.tempo, [
    ...windParts,
    ...pianoParts,
    ...stringParts,
  ]);
}

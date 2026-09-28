// antara palette, B: the breaths walk up the chord.
//
// Uses "late by one atom" (ideas/lines/a-late-by-one): every player repeats with one between of its
// own (a pulse), and the betweens grow by one atom from the lowest voice up, so what starts together
// comes apart, low to high. There the pulse was struck; here it is breathed.
//
// Sixteen winds hold one chord, one tone each: the Chord's betweens stacked on the standpoint, bottom
// up in the order written, again and again. Each wind stops for a breath and comes in again. The
// re-entries are the onsets of the voice's pulse; the breath is the silence of a few atoms just
// before each re-entry (a rest, not a new attack: the re-entry comes in from nothing). At first
// every voice has the same between, so the whole chord breathes at once: a vertical line of silence.
// Then each voice's between is one atom longer than the one below it. The breaths come apart, low to
// high; in every cycle the gap climbs through the chord more slowly, until the cycles overlap and
// some tone of the chord is always missing. While a voice breathes, the tones above and below it
// stand a wider between apart: the sum of the two betweens, a size the chord does not hold.
//
// Later the divided strings take the same chord and hold it without a break: from then on only the
// winds' colour is missing at the gaps, not the tone. From the End bar each wind's next breath is its
// last; they leave one by one, where their own pulse puts them, and the strings hold until the last
// wind has gone, then fade alone. The density stays about the same throughout: nothing builds up.
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
import {
  curve,
  divisi,
  inOrder,
  note,
  numberFromTop,
  part,
  scoreOf,
  stack,
  TICKS,
  type Player,
} from "../../common.ts";

export const knobs = {
  chord: text({
    group: "Chord",
    label: "Chord",
    help: "The betweens of the chord, bottom up in the order written, again and again until there are 16 tones (semitones, .5 for a quarter tone). While a voice breathes, the two betweens around it are heard as one: their sum",
    value: "2.5 3.5 1.5 4",
  }),
  anchor: pitch({
    group: "Chord",
    label: "Standpoint",
    help: "The lowest tone of the chord. Each tone must stay in the range of the wind that holds it",
    value: "A2",
    min: "A#1",
    max: "G#3",
    step: 0.5,
  }),
  period: number({
    group: "Breath",
    label: "Period",
    help: "The between of the lowest voice's pulse: from one re-entry to the next, in atoms. While the chord breathes together, everyone's",
    value: 40,
    min: 10,
    max: 80,
    step: 1,
    unit: "atoms",
  }),
  step: number({
    group: "Breath",
    label: "Step per rank",
    help: "How much longer each voice's between is than the one below it, once the breaths come apart (a-late-by-one: 1)",
    value: 1,
    min: 0,
    max: 4,
    step: 1,
    unit: "atoms",
  }),
  breath: number({
    group: "Breath",
    label: "Breath",
    help: "The silence before each re-entry, in atoms",
    value: 5,
    min: 1,
    max: 20,
    step: 1,
    unit: "atoms",
  }),
  together: number({
    group: "Breath",
    label: "Together cycles",
    help: "How many times the whole chord breathes at once (everyone on the Period) before the breaths come apart",
    value: 2,
    min: 0,
    max: 6,
    step: 1,
  }),
  family: choice({
    group: "Breath",
    label: "Family",
    help: "The atom the pulses count in",
    value: FAMILY_OPTIONS[2]!,
    options: FAMILY_OPTIONS,
  }),
  strings: number({
    group: "Form",
    label: "Strings from bar",
    help: "Where the divided strings take the chord and hold it without breathing",
    value: 19,
    min: 1,
    max: 40,
    step: 1,
    unit: "bar",
  }),
  end: number({
    group: "Form",
    label: "End from bar",
    help: "From here each wind's next breath is its last. The strings hold until the last wind has gone, then fade",
    value: 24,
    min: 2,
    max: 40,
    step: 1,
    unit: "bar",
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

/** The winds, how many of each. One tone each. */
const WINDS: [string, number][] = [
  ["bassoon", 2],
  ["horn", 4],
  ["trombone", 2],
  ["clarinet", 2],
  ["trumpet", 2],
  ["oboe", 2],
  ["flute", 2],
];
const ID: Record<string, string> = {
  bassoon: "bsn",
  horn: "hn",
  trombone: "tbn",
  clarinet: "cl",
  trumpet: "tpt",
  oboe: "ob",
  flute: "fl",
};
const SCORE_ORDER = ["flute", "oboe", "clarinet", "bassoon", "horn", "trumpet", "trombone"];

const rangeOf = (id: string) => instrument(id).range!;
const middle = (id: string) => (rangeOf(id)[0] + rangeOf(id)[1]) / 2;

/** The winds, low to high by the middle of each one's range: the chord's tones take them in turn. */
const POOL: Player[] = [...WINDS]
  .sort((a, b) => middle(a[0]) - middle(b[0]))
  .flatMap(([id, n]) =>
    Array.from({ length: n }, () => ({
      id: ID[id]!,
      instrument: id,
      name: instrument(id).name,
      abbreviation: instrument(id).abbreviation,
      range: rangeOf(id),
      grids: [0, 1],
    })),
  );

/** A wind voice: its notes (re-entry to the next breath) and where it leaves. */
interface Voice {
  midi: number;
  notes: { at: number; stop: number }[];
}

export function score(v: Values<typeof knobs>) {
  const chord = numbersOf("Chord", v.chord.replaceAll("−", "-"));
  if (chord.length === 0 || chord.some((b) => !Number.isInteger(b * 2) || b < 0.5))
    throw new Error("Chord: betweens are 0.5 or more, on the quarter-tone grid (2.5, 3.5, 1.5)");
  if (v.breath >= v.period) throw new Error("Breath: shorter than the Period");
  if (v.strings >= v.end + 2)
    throw new Error("Strings from bar: before the winds have gone (at most End from bar + 1)");

  const bar = 4 * TICKS;
  const atom = atomOf(familyOf(v.family));
  const period = v.period * atom;
  const breath = v.breath * atom;
  const together = v.together * period;
  const leaveFrom = (v.end - 1) * bar;
  const stringsAt = (v.strings - 1) * bar;

  const tones = stack(v.anchor, chord, POOL.length);
  const winds = numberFromTop(
    inOrder(
      tones.map((t): [number, number] => [t, t]),
      POOL,
    ),
  );
  winds.forEach((p, k) => {
    const [lo, hi] = rangeOf(p.instrument);
    if (tones[k]! < lo || tones[k]! > hi)
      throw new Error(`Standpoint: ${tones[k]} is outside the ${p.name}'s range (${lo}–${hi})`);
  });

  // Rank r = 0 is the lowest voice. Re-entry i: together on the Period for the first cycles, then
  // each voice on its own between, one step longer per rank.
  const voices: Voice[] = tones.map((midi, r) => {
    const between = period + r * v.step * atom;
    const reentry = (i: number) =>
      i <= v.together ? i * period : together + (i - v.together) * between;
    const notes: Voice["notes"] = [];
    for (let i = 0; ; i++) {
      const stop = reentry(i + 1) - breath;
      notes.push({ at: reentry(i), stop });
      // The first breath that begins from the End bar on is the last: no re-entry after it.
      if (stop >= leaveFrom) break;
    }
    return { midi, notes };
  });
  const lastLeave = Math.max(...voices.map((x) => x.notes.at(-1)!.stop));
  // The strings hold until the last wind has gone, and at least until they have come in fully.
  const fadeFrom = Math.max(lastLeave, stringsAt + 2 * bar);
  const end = Math.ceil((fadeFrom + bar) / bar) * bar;

  // Winds: in from nothing to p over 4 beats (or until the first breath, if sooner); every re-entry
  // from nothing to p over 2 atoms.
  const rise = 2 * atom;
  const windParts = voices.map((x, k) => {
    const events = x.notes.map((n) => note(n.at, n.stop - n.at, x.midi));
    const points = [
      { at: 0, level: 0, ramp: true },
      { at: Math.min(4 * TICKS, x.notes[0]!.stop), level: 3 },
    ];
    for (const n of x.notes.slice(1))
      points.push({ at: n.at, level: 0, ramp: true }, { at: n.at + rise, level: 3 });
    return part(winds[k]!, events, curve(points));
  });
  windParts.sort(
    (a, b) =>
      SCORE_ORDER.indexOf(a.instrument) - SCORE_ORDER.indexOf(b.instrument) ||
      a.id.localeCompare(b.id),
  );

  // Strings: the same chord, one tone per divided part, from nothing to pp over 2 bars, held without
  // a break until the last wind has gone, then fading to nothing.
  const strings = divisi(tones.map((t): [number, number] => [t, t]));
  const stringParts = tones
    .map((t, k) =>
      part(
        strings[k]!,
        [note(stringsAt, end - stringsAt, t)],
        curve([
          { at: stringsAt, level: 0, ramp: true },
          { at: stringsAt + 2 * bar, level: 2 },
          { at: fadeFrom, level: 2, ramp: true },
          { at: end, level: 0 },
        ]),
      ),
    )
    .reverse();

  const out = scoreOf("antara · palette B · the breaths walk the chord", end / bar, v.tempo, [
    ...windParts,
    ...stringParts,
  ]);
  out.rehearsal = [
    ...(v.together > 0 ? [{ measure: Math.floor(together / bar) + 1, label: "apart" }] : []),
    { measure: v.strings, label: "strings" },
    { measure: v.end, label: "last breaths" },
  ];
  return out;
}

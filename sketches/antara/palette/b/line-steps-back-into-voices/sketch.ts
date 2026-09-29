// antara palette, B: the standpoint steps back, and the line becomes voices.
//
// Uses two A sketches. "The standpoint steps back" (../../a/pitch-standpoint-steps-back): a line
// is a standpoint plus the betweens a rule draws from a set, and when the standpoint of each note
// is the note d places back, the line falls into d threads. "The names trade at the unison"
// (../../a/texture-names-trade-at-unison): who plays a thread is a name attached to it, and two
// names trade threads only where the two threads stand on the same pitch.
//
// The pitches are the first A's. One set, one rule (the set in the order written, starting one
// later each time round) and one stream of betweens drawn from it for the whole sketch, never read
// again from the start. Only the depth changes, section by section (by default 1, 5, 2, 4, 1). A
// section of depth d starts with d standpoints a fixed gap apart, sounded low to high, spread
// around the middle of the lowest and highest notes the threads of the section before ended on
// (the Standpoint, for the first section), and moved down to the quarter-tone grid when they fall
// off it. After them every note is the note d back plus the next between of the stream.
//
// What this sketch adds is the hold. Every note sounds until its thread's next note, d onsets
// later; at a section's first onset every note of the section before stops. So once its
// standpoints are in, a section of depth d is a chord of d voices in which exactly one voice moves
// at each onset, in turn, by a between of the set. The betweens between the voices (the vertical
// betweens) lie between threads: nobody put them in the set. A section of depth 1 is a line again.
// The kind of event changes with the depth: a line, a chord of five, of two, of four, a line.
//
// The names (the second A). Five colours are names attached to threads; they join in this order:
// violas, oboes, trombones, second violins, clarinets. The first section is the violas'. At a
// section start the standpoints, low to high, each take the colour of the section before whose
// last note is nearest (on a tie, the lower note, then the colour that joins first) among those
// not yet taken; when none is left, the first colour in the joining order not in use joins;
// colours not taken leave. Inside a section,
// when a thread's new note lands on the pitch another thread is sounding (a vertical between of 0,
// where nothing tells the two threads apart), the arriving colour plays that note, and from then
// on each of the two colours plays the other's thread (a unison of three turns the three round;
// none happens with the default values). A crossing without a unison changes nothing. Nothing
// marks a trade: no accent, no change of level.
//
// The default set holds eight betweens. With seven, a thread read every second or fourth onset
// takes the same group of three betweens again and again, so it walks as one shape moved up or
// down (a sequence); with eight, no thread of depth 2 to 5 repeats a group of one to four
// betweens back to back.
//
// Time: one onset per note; the time betweens are a set in atoms of one family, drawn by the same
// rule. All p, ordinary playing; the last notes hold four beats and fade.
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

export const knobs = {
  set: text({
    group: "Pitch",
    label: "Set",
    help: "The betweens (semitones, .5 for a quarter tone, − for down), in the order the rule reads them: the set as written, starting one later each time round. The order matters",
    value: "3 -1.5 3.5 -4.5 -1 4 -6 2.5",
    hint: "3 -1.5 3.5 -4.5 -1 4 -6 2.5",
  }),
  depths: text({
    group: "Pitch",
    label: "Depths",
    help: "How many notes back the standpoint is, section by section (1 to 5: one colour per thread). 1 is a line; d is held as a chord of d voices, one moving at a time",
    value: "1 | 5 | 2 | 4 | 1",
    hint: "1 | 5 | 2 | 4 | 1",
  }),
  per: text({
    group: "Pitch",
    label: "Notes per thread",
    help: "How many notes each thread plays in each section, one number per section (a section of depth d has d times as many onsets)",
    value: "14 | 9 | 12 | 9 | 12",
    hint: "14 | 9 | 12 | 9 | 12",
  }),
  gap: number({
    group: "Pitch",
    label: "Standpoint gap",
    help: "How far apart a section's standpoints start (semitones), spread around where the threads of the section before ended. With .5 neighbouring threads start on the two grids; the narrower, the more often threads meet and trade names",
    value: 2.5,
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  anchor: pitch({
    group: "Pitch",
    label: "Standpoint",
    help: "The first note. Each later section spreads its standpoints around the middle of where the threads of the one before ended",
    value: "E4",
    min: "G3",
    max: "C5",
    step: 0.5,
  }),
  time: betweenSet({
    group: "Time",
    label: "Time set",
    help: "The time betweens from one onset to the next, in atoms of the family, read in turn, starting one later each time round",
    value: "3 4 6",
    min: 1,
    max: 16,
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
    group: "Time",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 80,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

const colour = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  players: number,
  range: [number, number],
): Player => ({ id, instrument, name, abbreviation, players, range, grids: [0, 1] });

/** The five colours, in the order they join. */
const COLOURS: Player[] = [
  colour("va", "violas", "Violas", "Va.", 4, [48, 91]),
  colour("ob", "oboe", "Oboes 1, 2", "Ob. 1, 2", 2, [58, 93]),
  colour("tbn", "trombone", "Trombones 1, 2", "Tbn. 1, 2", 2, [40, 72]),
  colour("vn2", "violins-2", "Violins II", "Vn. II", 4, [55, 100]),
  colour("cl", "clarinet", "Clarinets 1, 2", "Cl. 1, 2", 2, [50, 94]),
];
/** Score order: woodwinds, brass, strings. */
const ORDER = ["ob", "cl", "tbn", "vn2", "va"];

/** The set as written, in order: semitones on the quarter-tone grid, none of them 0. */
function setOf(value: string): number[] {
  const set = numbersOf("Set", value.replaceAll("−", "-"));
  if (set.some((b) => !Number.isInteger(b * 2) || b === 0))
    throw new Error(
      "Set: betweens are semitones on the quarter-tone grid, not 0 (2, 3.5, -4.5): every onset moves one voice",
    );
  return set;
}

/** Whole numbers written as "1 | 5 | 2" (or "1 5 2"), from `min` to `max`. */
function listOf(label: string, value: string, min: number, max: number): number[] {
  const out = numbersOf(label, value.replaceAll("|", " "));
  if (out.some((n) => !Number.isInteger(n) || n < min || n > max))
    throw new Error(`${label}: whole numbers from ${min} to ${max}, one per section`);
  return out;
}

interface Played {
  at: number;
  midi: number;
  /** Where the note stops, when something other than the colour's next note stops it. */
  stop?: number;
}

export function score(v: Values<typeof knobs>) {
  const depths = listOf("Depths", v.depths, 1, COLOURS.length);
  const per = listOf("Notes per thread", v.per, 2, 60);
  if (per.length !== depths.length)
    throw new Error(
      `Notes per thread: write one number per section (${depths.length}, as many as the Depths)`,
    );
  const times = [...v.time];
  if (times.some((n) => !Number.isInteger(n) || n < 1))
    throw new Error("Time set: whole numbers of atoms, 1 or more");

  // Time: one onset per note, the time set read by the same rule.
  const atom = atomOf(familyOf(v.family));
  const nextTime = stream(times, "shift each time", 1);
  const total = depths.reduce((n, d, s) => n + d * per[s]!, 0);
  const at: number[] = [0];
  for (let i = 1; i < total; i++) at.push(at[i - 1]! + nextTime() * atom);

  // The pitches (the first A), and who plays them (the second A). on[j] is the colour on thread j,
  // sounding[j] the pitch thread j holds.
  const next = stream(setOf(v.set), "shift each time", 1);
  const plays: Played[][] = COLOURS.map(() => []);
  let centre = v.anchor;
  let last: { colour: number; midi: number }[] = [];
  let onset = 0;
  depths.forEach((d, s) => {
    const first = onset;
    const lowest = Math.floor((centre - ((d - 1) / 2) * v.gap) * 2) / 2;
    const section: number[] = [];
    for (let k = 0; k < d; k++) section.push(lowest + k * v.gap);
    for (let n = d; n < d * per[s]!; n++) section.push(section[n - d]! + next());

    // Every note of the section before stops here.
    for (const xs of plays) {
      const held = xs.at(-1);
      if (held && held.stop === undefined) held.stop = at[first]!;
    }

    // Names: the standpoints, low to high, take the nearest colour of the section before.
    const on: number[] = [];
    const left = [...last];
    for (let k = 0; k < d; k++) {
      const m = section[k]!;
      if (left.length > 0) {
        left.sort(
          (a, b) =>
            Math.abs(a.midi - m) - Math.abs(b.midi - m) || a.midi - b.midi || a.colour - b.colour,
        );
        on.push(left.shift()!.colour);
      } else {
        on.push(COLOURS.findIndex((_, c) => !on.includes(c)));
      }
    }

    const sounding: (number | undefined)[] = [];
    section.forEach((m, n) => {
      const j = n % d;
      plays[on[j]!]!.push({ at: at[onset]!, midi: m });
      sounding[j] = m;
      // A unison with another sounding thread: the arriving colour has played the note; from here
      // on the two colours play each other's threads.
      for (let k = 0; k < d; k++) {
        if (k !== j && sounding[k] === m) [on[j], on[k]] = [on[k]!, on[j]!];
      }
      onset++;
    });
    last = on.map((c, j) => ({ colour: c, midi: sounding[j]! }));
    const ends = section.slice(-d);
    centre = (Math.min(...ends) + Math.max(...ends)) / 2;
  });

  const bar = 4 * TICKS;
  const final = at[total - 1]!;
  const hold = 4 * TICKS;
  const end = Math.ceil((final + hold) / bar) * bar;
  const level = 3; // p

  const parts = COLOURS.flatMap((p, c) => {
    const xs = plays[c]!;
    if (xs.length === 0) return [];
    const [lo, hi] = p.range;
    const events = xs.map((x, i) => {
      if (x.midi < lo || x.midi > hi)
        throw new Error(
          `${p.name} reach ${x.midi}, outside their range (${lo}–${hi}); move the Standpoint or the Standpoint gap, or change the Set`,
        );
      const stop = x.stop ?? xs[i + 1]?.at ?? final + hold;
      return note(x.at, stop - x.at, x.midi);
    });
    // p throughout; the colours still sounding at the end fade over the last four beats.
    const fades = xs.at(-1)!.stop === undefined;
    const dynamics = curve(
      fades
        ? [
            { at: 0, level },
            { at: final, level, ramp: true },
            { at: final + hold, level: 0 },
          ]
        : [{ at: 0, level }],
    );
    return [part(p, events, dynamics)];
  }).sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

  return scoreOf(
    "antara · palette B · the standpoint steps back into voices",
    end / bar,
    v.tempo,
    parts,
  );
}

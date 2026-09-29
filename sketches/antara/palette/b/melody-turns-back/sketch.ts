// antara palette, B: a melody whose direction turns over.
//
// Uses the A sketch "a step back in time" (../../a/time-steps-back): the time set holds negative
// betweens too, and the line of onsets is walked exactly as a pitch line is, each term the one
// before it plus the next between drawn. A negative between puts the next term before the one the
// walk stands on. Here each term sounds as one short note, and the colour names the direction of
// the step that arrived at it: this is the A's first form (the A as it stands now sounds each step
// over the stretch it covers instead, and names nothing).
//
// Every term also gets a pitch, and the pitch is walked in the order the terms are walked, not in
// the order they are heard. Once a stage has been walked, its terms are sorted by time and played.
// Where the walk only goes forward, the order walked and the order heard are the same, and the
// melody moves by the pitch set's betweens. Where it steps back, a term walked later sounds
// earlier, and the betweens heard from note to note are sums of betweens walked. Where the walk
// stands on the same point twice, two terms sound at once (a time between of 0): their pitch
// between is the sum of the pitch betweens walked from the one visit to the other (up to the
// octaves the fold takes away). Where it only goes back, the heard order is the walked order
// turned round.
//
// Six stages, each with its own time set, walked from its own origin. The sets go from all
// forward, through sets whose sum shrinks to near 0 (the walk hardly moves on and keeps coming back
// to the same points: two and three notes at once), to all back.
//
// The time rule: every pair of the set, in the order the set is read (a pair keeps that order),
// the set read from low to high but starting at another place each cycle, as the A now does. Read
// the same way every cycle (the A's first form), a stage's second cycle repeats its first cycle's
// rhythm, moved on by the cycle's sum: the same shape carried along. Here the starts of a stage's
// cycles are two places apart and lie evenly on both sides of the low-to-high reading (one cycle:
// that reading; two: one place before it, then one after; three: two before, the reading, two
// after). Because they are even on both sides, a set with every sign turned round walks the same
// walk from its end, for three-element sets exactly: the last stage {-5 -4 -2} walks the first
// stage's walk {2 4 5} backwards, its terms stand where the first stage's stand, and the heard
// rhythm is the same, while every term is reached going back. The direction (later each cycle) is
// provisional: the other way the first stage alternates 5 2 5 2 5 atoms.
// A stage is placed so its earliest term comes Gap atoms after the latest term of the stage before.
//
// The colour is the name the walker gives each term: a term reached by a step forward is played
// pizzicato by the strings, one reached by a step back by the woodwinds, and the origin (reached by
// no step) by the harp, always on the Standpoint. So the first stage is strings alone with the harp
// first, the last is woodwinds alone with the harp last; the harp stays first while the stages'
// sums are well above 0 and moves back where the sum nears 0 and turns negative. Four equal quarters of the band, low to high, go to cellos / bassoons, violas /
// clarinets, violins II / oboes and violins I / flutes; each string section is divided in two and
// there are two of each woodwind. When two terms of the same colour and quarter sound together,
// the higher goes to part 1. Two terms at the same time and pitch sound as one note (in both
// colours when their directions differ). Every note is one atom long, at p, with no accents.
//
// The pitch rule: one stream of pitch betweens runs through the whole sketch (only the pitch of
// each origin goes back to the Standpoint). Each reading of the set starts one place later than
// the one before (the rule "shift each time"), and also steps through the set by another stride:
// every 1st, every 2nd, every 3rd, every 4th between in turn (the strides that reach every between
// once). With a stride of 1 only, every reading keeps the set's circular order, so the four
// betweens at the end of one reading open the next: the same four-step figure twice in a row,
// moved. With the strides, no figure of two steps comes back until the 20 readings (5 starts by 4
// strides) have been read. Pitches fold by octaves into the band.
//
// Negative time betweens widen the principle's reading of addition: the A's reading is for 余湖さん
// to confirm, and this sketch falls with it.
// Card: README.md.

import type { NoteEvent, Part } from "../../../../../src/score/types.ts";
import {
  betweenSet,
  number,
  numbersOf,
  pitch,
  pitchRange,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf } from "../../../between.ts";
import { fold, note, part, scoreOf, TICKS, type Player } from "../../common.ts";

const stageSet = (n: number, value: string) =>
  betweenSet({
    group: `Stage ${n}`,
    label: "Time set",
    help: "The time betweens of this stage, in atoms (triplet 8ths), with a direction: a negative one steps back, putting the next term before the one the walk stands on. The rule draws every pair in the order the set is read (low to high, a pair keeps that order); the cycles start the reading two places apart, evenly on both sides of the low-to-high reading. 0 has no direction and is not allowed",
    value,
    min: -6,
    max: 6,
    step: 1,
    unit: "atoms",
  });

const stageCycles = (n: number, value: number) =>
  number({
    group: `Stage ${n}`,
    label: "Cycles",
    help: "How many times the rule draws all its pairs in this stage (0 leaves the stage out)",
    value,
    min: 0,
    max: 4,
    step: 1,
  });

export const knobs = {
  set1: stageSet(1, "2 4 5"),
  cycles1: stageCycles(1, 2),
  set2: stageSet(2, "-1 2 4 5"),
  cycles2: stageCycles(2, 2),
  set3: stageSet(3, "-3 -1 2 4 5"),
  cycles3: stageCycles(3, 2),
  set4: stageSet(4, "-5 -3 -1 2 4 5"),
  cycles4: stageCycles(4, 1),
  set5: stageSet(5, "-5 -4 -2 1 3"),
  cycles5: stageCycles(5, 1),
  set6: stageSet(6, "-5 -4 -2"),
  cycles6: stageCycles(6, 2),
  pitches: text({
    group: "Pitch",
    label: "Set",
    help: "The pitch betweens (semitones, .5 for a quarter tone, − for down), in the order written. One stream runs through the whole sketch, in the order the terms are walked: each reading starts one place later than the one before and steps through the set by the next stride (every 1st, 2nd, 3rd … between, those that reach every between once)",
    value: "-6.5 4.5 -2.5 8 -4",
    hint: "-6.5 4.5 -2.5 8 -4",
  }),
  anchor: pitch({
    group: "Pitch",
    label: "Standpoint",
    help: "The pitch of every stage's origin, played by the harp (which holds only the usual grid). Each stage's pitch walk starts here again; the stream of betweens goes on",
    value: "F#4",
    min: "C3",
    max: "C6",
    step: 1,
  }),
  band: pitchRange({
    group: "Pitch",
    label: "Band",
    help: "Where the pitch walk folds by octaves. Its four equal quarters, low to high, go to cellos / bassoons, violas / clarinets, violins II / oboes, violins I / flutes",
    value: ["C3", "C6"],
    min: "C2",
    max: "C7",
    step: 1,
  }),
  gap: number({
    group: "Form",
    label: "Gap",
    help: "From a stage's latest term to the next stage's earliest, in atoms. Longer than every between of the sets, it is not heard as a between of the line",
    value: 6,
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 72,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

/** The atom: triplet 8ths (the family of 3), as in the A. */
const ATOM = atomOf(3);

type Colour = "strings" | "winds" | "harp";

/** Low to high, one per quarter of the band: two parts each. */
const WINDS = [
  { instrument: "bassoon", name: "Bassoon", abbreviation: "Bsn.", id: "bsn" },
  { instrument: "clarinet", name: "Clarinet", abbreviation: "Cl.", id: "cl" },
  { instrument: "oboe", name: "Oboe", abbreviation: "Ob.", id: "ob" },
  { instrument: "flute", name: "Flute", abbreviation: "Fl.", id: "fl" },
];
const STRINGS = [
  { instrument: "cellos", name: "Violoncellos", abbreviation: "Vc.", id: "vc", size: 10 },
  { instrument: "violas", name: "Violas", abbreviation: "Va.", id: "va", size: 12 },
  { instrument: "violins-2", name: "Violins II", abbreviation: "Vn. II", id: "vn2", size: 14 },
  { instrument: "violins-1", name: "Violins I", abbreviation: "Vn. I", id: "vn1", size: 16 },
];
const HARP: Player = {
  id: "hp",
  instrument: "harp",
  name: "Harp",
  abbreviation: "Hp.",
  range: [23, 104],
  grids: [0],
};

interface Term {
  /** Ticks from the start. */
  at: number;
  midi: number;
  colour: Colour;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * The reading of cycle c (from 0) of `cycles`: the set low to high, starting 2c - (cycles - 1)
 * places on (negative: earlier, round from the end). The starts are two places apart and lie evenly
 * on both sides of the low-to-high reading.
 */
function readingOf(set: number[], c: number, cycles: number): number[] {
  const sorted = [...set].sort((a, b) => a - b);
  const n = sorted.length;
  const start = (((2 * c - (cycles - 1)) % n) + n) % n;
  return [...sorted.slice(start), ...sorted.slice(0, start)];
}

/** Every pair of a reading, in the order read (positions in dictionary order; a pair keeps it). */
function pairsOf(reading: number[]): number[][] {
  if (reading.length === 1) return [reading];
  const out: number[][] = [];
  for (let i = 0; i < reading.length; i++)
    for (let j = i + 1; j < reading.length; j++) out.push([reading[i]!, reading[j]!]);
  return out;
}

/**
 * The pitch betweens, one at a time. Reading r of the set (as written) starts at its (r mod n)-th
 * between, one place later each time, and steps through it by the stride r takes in turn from
 * those that reach every between once (1, 2, 3, 4 for five betweens).
 */
function pitchStream(set: number[]): () => number {
  const n = set.length;
  const strides = n <= 2 ? [1] : [...Array(n).keys()].slice(1).filter((s) => gcd(s, n) === 1);
  let reading = 0;
  let queue: number[] = [];
  return () => {
    if (queue.length === 0) {
      const start = reading % n;
      const s = strides[reading % strides.length]!;
      queue = set.map((_, i) => set[(start + i * s) % n]!);
      reading++;
    }
    return queue.shift()!;
  };
}

function stagesOf(v: Values<typeof knobs>): { n: number; set: number[]; cycles: number }[] {
  const stages = [
    { n: 1, set: v.set1, cycles: v.cycles1 },
    { n: 2, set: v.set2, cycles: v.cycles2 },
    { n: 3, set: v.set3, cycles: v.cycles3 },
    { n: 4, set: v.set4, cycles: v.cycles4 },
    { n: 5, set: v.set5, cycles: v.cycles5 },
    { n: 6, set: v.set6, cycles: v.cycles6 },
  ];
  stages.forEach(({ n, set }) => {
    if (set.some((b) => !Number.isInteger(b) || b === 0))
      throw new Error(
        `Stage ${n}: time betweens are whole numbers of atoms, forward or back, not 0 (0 has no direction)`,
      );
  });
  return stages.filter((s) => s.cycles > 0 && s.set.length > 0);
}

export function score(v: Values<typeof knobs>) {
  const set = numbersOf("Set", v.pitches.replaceAll("−", "-"));
  if (set.length === 0) throw new Error("Set: write at least one pitch between (e.g. -6.5 4.5)");
  if (set.some((b) => !Number.isInteger(b * 2)))
    throw new Error("Set: pitch betweens are semitones on the quarter-tone grid (2, 3.5, -4.5)");
  if (!Number.isInteger(v.anchor))
    throw new Error("Standpoint: the harp holds only the usual grid (no quarter tone)");
  const band: [number, number] = [Math.min(...v.band), Math.max(...v.band)];
  if (band[1] - band[0] < 12) throw new Error("Band: give the walk at least an octave");
  const nextPitch = pitchStream(set);

  // Walk each stage (time and pitch in the order walked), then place it after the one before.
  const terms: Term[] = [];
  const heads: { n: number; at: number }[] = [];
  let start = 0;
  for (const stage of stagesOf(v)) {
    const walked: { pos: number; midi: number; colour: Colour }[] = [
      { pos: 0, midi: v.anchor, colour: "harp" },
    ];
    let pos = 0;
    let midi = v.anchor;
    for (let c = 0; c < stage.cycles; c++)
      for (const pair of pairsOf(readingOf(stage.set, c, stage.cycles)))
        for (const b of pair) {
          pos += b;
          midi = fold(midi + nextPitch(), band);
          walked.push({ pos, midi, colour: b > 0 ? "strings" : "winds" });
        }
    let earliest = 0;
    let latest = 0;
    for (const t of walked) {
      if (t.pos < earliest) earliest = t.pos;
      if (t.pos > latest) latest = t.pos;
    }
    heads.push({ n: stage.n, at: start });
    for (const t of walked)
      terms.push({ at: (start + t.pos - earliest) * ATOM, midi: t.midi, colour: t.colour });
    start += latest - earliest + v.gap;
  }

  // The notes: one per colour and pitch at each onset; within a colour and a quarter of the band,
  // the higher of two goes to part 1.
  const quarter = (m: number) =>
    Math.max(0, Math.min(3, Math.floor(((m - band[0]) * 4) / (band[1] - band[0]))));
  const lanes = new Map<string, NoteEvent[]>();
  const put = (id: string, e: NoteEvent) => {
    if (!lanes.has(id)) lanes.set(id, []);
    lanes.get(id)!.push(e);
  };
  const onsets = [...new Set(terms.map((t) => t.at))].sort((a, b) => a - b);
  for (const at of onsets) {
    const here = terms.filter((t) => t.at === at);
    const notes = [
      ...new Map(here.map((t) => [`${t.colour} ${t.midi}`, t] as const)).values(),
    ].sort((a, b) => b.midi - a.midi);
    for (const t of notes.filter((n) => n.colour === "harp")) put("hp", note(at, ATOM, t.midi));
    for (const colour of ["strings", "winds"] as const) {
      const byQuarter = new Map<number, Term[]>();
      for (const t of notes.filter((n) => n.colour === colour)) {
        const q = quarter(t.midi);
        byQuarter.set(q, [...(byQuarter.get(q) ?? []), t]);
      }
      for (const [q, ts] of byQuarter) {
        const group = colour === "strings" ? STRINGS[q]! : WINDS[q]!;
        if (ts.length > 2)
          throw new Error(
            `${ts.length} ${colour} notes at once in one quarter of the band (${group.name}): only two parts`,
          );
        ts.forEach((t, k) =>
          put(
            `${group.id}${k + 1}`,
            note(at, ATOM, t.midi, colour === "strings" ? { technique: "pizz" } : {}),
          ),
        );
      }
    }
  }

  const bar = 4 * TICKS;
  const last = onsets.at(-1) ?? 0;
  const end = Math.max(bar, Math.ceil((last + ATOM) / bar) * bar);
  const quiet = [{ at: 0, level: 3 }];

  // Score order: woodwinds high to low, harp, strings high to low. A part with nothing to play (a
  // second part whose colour and quarter never has two terms at once) is left out; each half of a
  // section keeps its half of the players.
  const parts: Part[] = [];
  const range = (q: number): [number, number] => [
    band[0] + (q * (band[1] - band[0])) / 4,
    band[0] + ((q + 1) * (band[1] - band[0])) / 4,
  ];
  for (let q = 3; q >= 0; q--) {
    const w = WINDS[q]!;
    for (const k of [1, 2]) {
      const player: Player = {
        id: `${w.id}${k}`,
        instrument: w.instrument,
        name: `${w.name} ${k}`,
        abbreviation: `${w.abbreviation} ${k}`,
        range: range(q),
        grids: [0, 1],
      };
      parts.push(part(player, lanes.get(player.id) ?? [], quiet));
    }
  }
  parts.push(part(HARP, lanes.get("hp") ?? [], quiet));
  for (let q = 3; q >= 0; q--) {
    const s = STRINGS[q]!;
    for (const k of [1, 2]) {
      const player: Player = {
        id: `${s.id}${k}`,
        instrument: s.instrument,
        name: `${s.name} ${k}`,
        abbreviation: `${s.abbreviation} ${k}`,
        players: Math.floor(s.size / 2) + (k === 1 ? s.size % 2 : 0),
        range: range(q),
        grids: [0, 1],
      };
      parts.push(part(player, lanes.get(player.id) ?? [], quiet));
    }
  }

  const out = scoreOf(
    "antara · palette B · the melody turns back",
    end / bar,
    v.tempo,
    parts.filter((p) => p.events.length > 0),
  );
  const marks = heads.map((h) => ({
    measure: Math.floor((h.at * ATOM) / bar) + 1,
    label: `stage ${h.n}`,
  }));
  out.rehearsal = marks.filter((m, i) => marks.findIndex((x) => x.measure === m.measure) === i);
  return out;
}

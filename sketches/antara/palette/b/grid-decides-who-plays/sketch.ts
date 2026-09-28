// antara palette, B: the grid decides who plays.
//
// Uses the A sketch "one line, split by its grid" (../../a/pitch-split-by-grid), whose logic is
// copied here: a rule draws one stream of betweens from a set; three voices start together on one
// standpoint and walk on. The full voice takes every between; the even voice only those without .5
// (an even number of quarter tones), the odd voice only those with .5 (an odd number); the voice
// that does not take a between holds (no new onset). The even voice therefore never leaves the
// standpoint's grid, and the full voice and the odd voice always stand on the same grid (the
// between of the two is the even voice's distance from the standpoint, a whole number of
// semitones).
//
// Here the grids are the reason for the orchestration. Wherever the even or the odd voice moves,
// its new pitch is struck once, and left to ring, by the fixed-pitch instruments of that pitch's
// grid: harp I and the vibraphone on the usual semitones; harp II and the piano, both tuned a
// quarter tone low, on the semitones a quarter tone off. The even voice (cellos) is the one voice
// that one tuning can always play; the odd voice (violas) changes grid at every move, so its
// strikes change tuning at every move; the full voice (bass flute, cor anglais, two clarinets and
// the first violins in unison) needs both grids and gets no strikes. Which instruments strike is
// the name of the grid the new pitch stands on.
//
// The story is the set. It starts with no between with .5 (the odd voice stays on the standpoint,
// so the even voice doubles the full voice), and stage by stage one more between gets .5: the
// narrowest one still without it is widened by a quarter tone, away from 0 (its direction and its
// place in the order stay). Each stage lets the rule go round the set a fixed number of times, so
// the even and the odd voice move exactly as often as the set has betweens without and with .5.
// At the last stage every between has .5: the even voice has stopped, and the odd voice moves in
// parallel with the full voice, as far from it as the even voice stopped from the standpoint.
// Neither the unison at the start nor the parallel at the end is placed; both follow from the
// partial sums. The rule, "shift each time", runs on across the stages.
//
// One addition outside the mechanism, only to keep the voices in the band (as in the A): when a
// between would put the full voice or the voice moving with it outside the band, both take it the
// other way (the same size, the opposite direction; .5 or not stays, and so does who moves).
//
// Time: one time between per pitch between, drawn from a time set by "shift each time". The full
// voice sounds at every onset and holds to the next; the even and odd voices sound only when they
// move and hold until they move again. After the last between all three hold for two bars, dying
// away over the second; the strikes ring on. A constant p, no accents, nothing marks a stage.
// Card: README.md.

import type { NoteEvent, Part, TextEvent } from "../../../../../src/score/types.ts";
import {
  betweenSet,
  choice,
  number,
  numbersOf,
  pitch,
  pitchRange,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import {
  curve,
  gridOf,
  note,
  part,
  scoreOf,
  stream,
  TICKS,
  time,
  type Player,
} from "../../common.ts";

export const knobs = {
  set: text({
    group: "Pitch",
    label: "First set",
    help: "The betweens of the first stage, in the order written (semitones, − for down, .5 for a quarter tone). The rule takes them in this order, starting one later each time round. Each next stage widens by a quarter tone, away from 0, the narrowest between still without .5, until all have it: one stage per between without .5, plus the first",
    value: "1 -2 3 -4 5 -6",
  }),
  passes: number({
    group: "Pitch",
    label: "Rounds per stage",
    help: "How many times the rule goes round the set in each stage. Every between is taken this many times per stage, so the cellos and the violas move exactly as often as the set has betweens without and with .5",
    value: 2,
    min: 1,
    max: 6,
    step: 1,
  }),
  anchor: pitch({
    group: "Pitch",
    label: "Standpoint",
    help: "Where the three voices start, together. The even voice (cellos) never leaves this pitch's grid",
    value: "Eb4",
    min: "G3",
    max: "C5",
    step: 0.5,
  }),
  band: pitchRange({
    group: "Pitch",
    label: "Band",
    help: "Where the voices walk. A between that would take the full voice or the voice moving with it out of the band is taken the other way (an addition outside the mechanism)",
    value: ["G3", "C5"],
    min: "G3",
    max: "C6",
    step: 0.5,
  }),
  rhythm: betweenSet({
    group: "Time",
    label: "Time set",
    help: "The time betweens, in atoms of the family, one for each pitch between, taken in this order, starting one later each time round",
    value: "2 3 5",
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time betweens count in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 66,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

type V = Values<typeof knobs>;

/** Whether a between moves a voice to the other grid (an odd number of quarter tones). */
const crosses = (b: number) => Math.round(b * 2) % 2 !== 0;

/**
 * The set of each stage: the first as written, then, one stage at a time, the narrowest between
 * without .5 widened by a quarter tone away from 0 (the first written of equal ones; 0 goes up),
 * until every between has .5.
 */
function stagesOf(first: number[]): number[][] {
  const out = [first];
  for (;;) {
    const last = out.at(-1)!;
    const plain = last.map((b, i) => ({ b, i })).filter(({ b }) => !crosses(b));
    if (plain.length === 0) return out;
    const { i } = plain.reduce((a, x) => (Math.abs(x.b) < Math.abs(a.b) ? x : a));
    const next = [...last];
    next[i] = last[i]! + (last[i]! < 0 ? -0.5 : 0.5);
    out.push(next);
  }
}

/** One voice: its pitch after each step (index 0 is the start), and the steps it moves at. */
interface Walk {
  pitches: number[];
  moves: Set<number>;
}

/** The pitch stream: stage by stage, round by round, the rule shifting on across the stages. */
function betweens(stages: number[][], passes: number): { b: number; stage: number }[] {
  const out: { b: number; stage: number }[] = [];
  let round = 0;
  stages.forEach((set, stage) => {
    for (let p = 0; p < passes; p++, round++) {
      const s = round % set.length;
      for (const b of [...set.slice(s), ...set.slice(0, s)]) out.push({ b, stage });
    }
  });
  return out;
}

/** The three voices, step by step: full, even, odd. */
function walk(v: V, stream: number[]): Walk[] {
  const [lo, hi] = v.band;
  const out = (p: number) => p < lo || p > hi;
  if (out(v.anchor))
    throw new Error(`Standpoint: ${v.anchor} is outside the Band (${lo}–${hi}); move one of them`);
  const voices: Walk[] = [0, 1, 2].map(() => ({ pitches: [v.anchor], moves: new Set([0]) }));
  const [full, even, odd] = voices as [Walk, Walk, Walk];
  stream.forEach((drawn, k) => {
    const i = k + 1;
    let b = drawn;
    const mover = crosses(b) ? odd : even;
    const holder = crosses(b) ? even : odd;
    const [f, m] = [full.pitches.at(-1)!, mover.pitches.at(-1)!];
    if (out(f + b) || out(m + b)) {
      b = -b;
      if (out(f + b) || out(m + b))
        throw new Error(
          `Band: at step ${i} the between ${-b} leaves the band ${lo}–${hi} both ways; widen the Band`,
        );
    }
    full.pitches.push(f + b);
    mover.pitches.push(m + b);
    holder.pitches.push(holder.pitches.at(-1)!);
    full.moves.add(i);
    mover.moves.add(i);
  });
  return voices;
}

const wind = (id: string, instrument: string, name: string, abbreviation: string): Player => ({
  id,
  instrument,
  name,
  abbreviation,
  range: [55, 72],
  grids: [0, 1],
});

/** The full voice: winds and the first violins, in unison. */
const FULL: Player[] = [
  wind("bfl", "bass-flute", "Bass Flute", "B. Fl."),
  wind("ca", "cor-anglais", "Cor anglais", "C. ingl."),
  { ...wind("cl", "clarinet", "Clarinets 1, 2", "Cl. 1, 2"), players: 2 },
  {
    id: "vn1",
    instrument: "violins-1",
    name: "Violins I",
    abbreviation: "Vn. I",
    players: 16,
    range: [55, 72],
    grids: [0, 1],
  },
];
const EVEN: Player = {
  id: "vc",
  instrument: "cellos",
  name: "Violoncellos",
  abbreviation: "Vc.",
  players: 10,
  range: [55, 72],
  grids: [0, 1],
};
const ODD: Player = {
  id: "va",
  instrument: "violas",
  name: "Violas",
  abbreviation: "Va.",
  players: 12,
  range: [55, 72],
  grids: [0, 1],
};

/** The fixed-pitch instruments of each grid: [0] the usual semitones, [1] a quarter tone off. */
const STRIKERS: Player[][] = [
  [
    {
      id: "vib",
      instrument: "vibraphone",
      name: "Vibraphone",
      abbreviation: "Vib.",
      range: [53, 89],
      grids: [0],
    },
    {
      id: "hp1",
      instrument: "harp",
      name: "Harp I",
      abbreviation: "Hp. I",
      range: [23, 104],
      grids: [0],
    },
  ],
  [
    {
      id: "hp2",
      instrument: "harp",
      name: "Harp II (tuned ¼ tone low)",
      abbreviation: "Hp. II",
      range: [23, 104],
      grids: [1],
    },
    {
      id: "pno",
      instrument: "piano",
      name: "Piano (tuned ¼ tone low)",
      abbreviation: "Pno.",
      range: [21, 108],
      grids: [1],
    },
  ],
];
/** What a striker's staff says at its first strike (each strike's written length is its ring). */
const MARK: Record<string, string> = { vib: "motor off" };

export function score(v: V) {
  const first = numbersOf("First set", v.set.replaceAll("−", "-"));
  if (first.some((b) => !Number.isInteger(b * 2)))
    throw new Error("First set: betweens are semitones on the quarter-tone grid (4, 5.5, -1)");
  const stages = stagesOf(first);
  const drawn = betweens(stages, v.passes);
  const voices = walk(
    v,
    drawn.map((d) => d.b),
  );

  // Onsets: the start, then one time between after each pitch between.
  const atom = atomOf(familyOf(v.family));
  const nextTime = stream(v.rhythm, "shift each time", 1);
  const onsets = [0];
  for (let k = 0; k < drawn.length; k++) onsets.push(onsets.at(-1)! + nextTime() * atom);
  const last = onsets.at(-1)!;
  const bar = 4 * TICKS;
  // After the last between, two bars: held through the first, dying away over the second.
  const hold = Math.ceil((last + bar) / bar) * bar;
  const end = hold + bar;
  const dynamics = curve([
    { at: 0, level: 3 },
    { at: hold, level: 3, ramp: true },
    { at: end, level: 0 },
  ]);

  // A layer's notes: a new note where the voice moves, held until the next (the last to the end).
  const layer = (w: Walk): NoteEvent[] => {
    const starts = [...w.moves].sort((a, b) => a - b);
    return starts.map((i, j) => {
      const at = onsets[i]!;
      const stop = j + 1 < starts.length ? onsets[starts[j + 1]!]! : end;
      return note(at, stop - at, w.pitches[i]!);
    });
  };
  const [full, even, odd] = voices as [Walk, Walk, Walk];

  // Strikes: every onset where the even or the odd voice moves (the start: both enter), the new
  // pitch, on the instruments of its grid.
  const strikes = new Map<string, { at: number; midi: number[] }[]>();
  onsets.forEach((at, i) => {
    const moved = [even, odd].filter((w) => w.moves.has(i)).map((w) => w.pitches[i]!);
    for (const m of new Set(moved))
      for (const p of STRIKERS[gridOf(m)]!) {
        const list = strikes.get(p.id) ?? [];
        strikes.set(p.id, list);
        const same = list.find((s) => s.at === at);
        if (same) same.midi.push(m);
        else list.push({ at, midi: [m] });
      }
  });
  const struck = (p: Player): Part => {
    const list = strikes.get(p.id) ?? [];
    // Each strike rings until the instrument's next strike (the last to the end).
    const events = list.map((s, j) => {
      const stop = list[j + 1]?.at ?? end;
      return note(s.at, stop - s.at, s.midi.length === 1 ? s.midi[0]! : s.midi);
    });
    const out = part(p, events, [{ at: 0, level: 3 }]);
    const text = MARK[p.id];
    if (text) {
      const mark: TextEvent = { type: "text", at: time(list[0]?.at ?? 0), text };
      out.events.unshift(mark);
    }
    return out;
  };

  const fullParts = FULL.map((p) => part(p, layer(full), dynamics));
  const [vib, hp1] = STRIKERS[0]!;
  const [hp2, pno] = STRIKERS[1]!;
  // Score order: winds, percussion, harps, keyboard, strings.
  const parts: Part[] = [
    ...fullParts.slice(0, 3),
    struck(vib!),
    struck(hp1!),
    struck(hp2!),
    struck(pno!),
    fullParts[3]!,
    part(ODD, layer(odd), dynamics),
    part(EVEN, layer(even), dynamics),
  ];

  return scoreOf("antara · palette B · the grid decides who plays", end / bar, v.tempo, parts);
}

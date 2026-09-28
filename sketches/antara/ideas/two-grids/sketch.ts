// antara, an idea for the piece: a chord of glass, its facets turning between the two grids.
//
// With quarter tones, the grid of pitches is two semitone grids a quarter tone apart. A between
// with .5 moves a voice to the other grid; a between without keeps it on the same grid.
//
// Twelve divided string voices hold one chord, stacked from the anchor by the betweens of the Chord
// set. Each voice now and then turns: it slides away from its chord tone by a between of the Turns
// set (by default all with .5, so every turn crosses to the other grid), holds there, and slides
// back. The voices turn at their own times (each counts in its own family and starts at its own
// place in the rules), so the chord's surface keeps changing which of its tones stand on which grid.
// Over the sketch the chord is stacked again a few times (the same betweens, the order shifted by
// one place), and the voices reach the new chord one by one, as they come home.
//
// Where a slide ends, the light is caught: an instrument that holds that grid sounds the pitch once,
// higher up. Harp I, the celesta and the crotales are on the usual grid; harp II and the piano are
// tuned a quarter tone low and hold the other. They take turns, so the reflections change colour.
// Card: README.md.

import type { DynamicPoint, NoteEvent, Part, Pitch, Score } from "../../../../src/score/types.ts";
import {
  betweenSet,
  choice,
  number,
  pitch,
  text,
  type Values,
} from "../../../../src/sketch/knobs.ts";
import { atomOf, drawer, familiesOf, TICKS, time, type Family } from "../../between.ts";

const RULES = ["combinations", "shift each time"];

export const knobs = {
  chord: betweenSet({
    group: "Chord",
    label: "Chord",
    help: "The betweens the chord is stacked from, bottom up, again and again in this order (semitones, .5 for a quarter tone). A between with .5 puts the next voice on the other grid",
    value: "1.5 3 4.5 5",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  chords: number({
    group: "Chord",
    label: "Chords",
    help: "How many times the chord is stacked over the sketch; each new stack starts the set one place later",
    value: 3,
    min: 1,
    max: 8,
    step: 1,
  }),
  anchor: pitch({
    group: "Chord",
    label: "Anchor",
    help: "The lowest voice of the chord; every other voice is the anchor plus the betweens below it",
    value: "G3",
    min: "C3",
    max: "C5",
    step: 0.5,
  }),
  turns: betweenSet({
    group: "Turns",
    label: "Turns",
    help: "How far a voice slides away from its chord tone before it slides back (semitones). With .5 it crosses to the other grid",
    value: "-1.5 -0.5 0.5 1.5",
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  turnRule: choice({
    group: "Turns",
    label: "Rule",
    help: "combinations: the turns one by one in dictionary order · shift each time: the set in order, starting one later each time round",
    value: "shift each time",
    options: RULES,
  }),
  holds: betweenSet({
    group: "Time",
    label: "Holds",
    help: "How long a voice stays on a tone (at home or turned away), in atoms of its family",
    value: "9 13 17 21",
    min: 1,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  slides: betweenSet({
    group: "Time",
    label: "Slides",
    help: "How long a slide takes, in atoms of the voice's family",
    value: "4 6 9",
    min: 1,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  timeRule: choice({
    group: "Time",
    label: "Rule",
    help: "How holds and slides are drawn from their sets. combinations: two at a time, in dictionary order · shift each time: in order, starting one later each time round",
    value: "combinations",
    options: RULES,
  }),
  families: text({
    group: "Time",
    label: "Families",
    help: "The families the voices count in, from the top voice down, again and again (2: 16ths, 3: triplet 8ths, 5: quintuplet 16ths)",
    value: "5 3 2",
  }),
  reflect: choice({
    group: "Reflections",
    label: "Reflect",
    help: "Where a slide ends, an instrument of that grid sounds the pitch once, higher up. every arrival · turning away: only where a voice leaves its chord tone · coming home: only where it returns · off",
    value: "every arrival",
    options: ["every arrival", "turning away", "coming home", "off"],
  }),
  entries: number({
    group: "Form",
    label: "Entries",
    help: "Beats between the voices' entries, from the top voice down (0: the chord starts at once)",
    value: 0.5,
    min: 0,
    max: 4,
    step: 0.25,
    unit: "beats",
  }),
  bars: number({
    group: "Form",
    label: "Bars",
    help: "Length in bars of 4/4",
    value: 14,
    min: 4,
    max: 40,
    step: 1,
    unit: "bars",
  }),
  stroke: choice({
    group: "Sound",
    label: "Strings",
    help: "How the divided strings play. Vn I in harmonics: the first violins in harmonics, the rest sul tasto",
    value: "Vn I in harmonics",
    options: ["Vn I in harmonics", "sul tasto", "flautando", "con sord."],
  }),
  tempo: number({
    group: "Sound",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 52,
    min: 30,
    max: 90,
    step: 2,
    unit: "bpm",
  }),
};

type V = Values<typeof knobs>;

interface Voice {
  id: string;
  instrument: string;
  name: string;
  abbreviation: string;
  players: number;
}

// Top down, in score order. The chord is stacked bottom up: voice i from the top is voice
// VOICES.length - 1 - i from the bottom.
const VOICES: Voice[] = [
  ...[1, 2, 3, 4].map((n) => ({
    id: `vn1-${n}`,
    instrument: "violins-1",
    name: `Violins I ${n}`,
    abbreviation: `Vn. I ${n}`,
    players: 4,
  })),
  ...[1, 2, 3, 4].map((n) => ({
    id: `vn2-${n}`,
    instrument: "violins-2",
    name: `Violins II ${n}`,
    abbreviation: `Vn. II ${n}`,
    players: n <= 2 ? 4 : 3,
  })),
  ...[1, 2].map((n) => ({
    id: `va-${n}`,
    instrument: "violas",
    name: `Violas ${n}`,
    abbreviation: `Va. ${n}`,
    players: 6,
  })),
  ...[1, 2].map((n) => ({
    id: `vc-${n}`,
    instrument: "cellos",
    name: `Cellos ${n}`,
    abbreviation: `Vc. ${n}`,
    players: 5,
  })),
];

interface Mirror {
  id: string;
  instrument: string;
  name: string;
  abbreviation: string;
  /** Sounding range the reflections are placed in. */
  window: [number, number];
  level: number;
  technique?: string;
}

// The instruments that hold each grid: [0] the usual semitones, [1] a quarter tone off.
const MIRRORS: Mirror[][] = [
  [
    {
      id: "hp1",
      instrument: "harp",
      name: "Harp I",
      abbreviation: "Hp. I",
      window: [67, 91],
      level: 2.5,
      technique: "harmonic",
    },
    {
      id: "cel",
      instrument: "celesta",
      name: "Celesta",
      abbreviation: "Cel.",
      window: [72, 100],
      level: 2,
    },
    {
      id: "crot",
      instrument: "crotales",
      name: "Crotales",
      abbreviation: "Crot.",
      window: [84, 108],
      level: 1.5,
    },
  ],
  [
    {
      id: "hp2",
      instrument: "harp",
      name: "Harp II (tuned ¼ tone low)",
      abbreviation: "Hp. II",
      window: [67, 91],
      level: 2.5,
      technique: "harmonic",
    },
    {
      id: "pno",
      instrument: "piano",
      name: "Piano (tuned ¼ tone low)",
      abbreviation: "Pno.",
      window: [72, 100],
      level: 2,
    },
  ],
];
// Score order: percussion, harps, keyboards.
const MIRROR_ORDER = ["crot", "hp1", "hp2", "cel", "pno"];

/** Which grid a pitch is on: 0 for the usual semitones, 1 for those a quarter tone off. */
const gridOf = (m: number) => Math.round(m * 2) % 2;

const fold = (p: number, [lo, hi]: [number, number]) => {
  let q = p;
  while (q > hi) q -= 12;
  while (q < lo) q += 12;
  return q;
};

/** A rule's groups laid end to end, one number at a time. */
function stream(set: number[], rule: string, size: number): () => number {
  const draw = drawer(set, rule, size, "ascending");
  let queue: number[] = [];
  return () => {
    if (queue.length === 0) queue = [...draw()];
    return queue.shift()!;
  };
}

/** Where each section can play; a chord tone above or below moves by octaves back in. */
const RANGES: Record<string, [number, number]> = {
  "violins-1": [55, 100],
  "violins-2": [55, 96],
  violas: [48, 88],
  cellos: [36, 79],
};

/** Each chord, as pitches from the bottom voice up: the set's betweens stacked, the order shifted. */
function chordsOf(v: V): number[][] {
  return Array.from({ length: v.chords }, (_, c) => {
    const s = c % v.chord.length;
    const order = [...v.chord.slice(s), ...v.chord.slice(0, s)];
    const stack = [v.anchor];
    for (let k = 1; k < VOICES.length; k++)
      stack.push(stack[k - 1]! + order[(k - 1) % order.length]!);
    return stack.map((p, k) => fold(p, RANGES[VOICES[VOICES.length - 1 - k]!.instrument]!));
  });
}

interface Note {
  at: number;
  hold: number;
  dur: number;
  midi: number;
  gliss: boolean;
  /** How the note was reached: by turning away from the chord tone, by coming home, or not by a slide. */
  reached?: "away" | "home";
}

function voice(v: V, i: number, family: Family, chords: number[][], end: number): Note[] {
  const atom = atomOf(family);
  const fromBottom = VOICES.length - 1 - i;
  const stretch = end / chords.length;
  const homeAt = (t: number) =>
    chords[Math.min(chords.length - 1, Math.floor(t / stretch))]![fromBottom]!;
  const hold = stream(v.holds, v.timeRule, 2);
  const slide = stream(v.slides, v.timeRule, 2);
  const turn = stream(v.turns, v.turnRule, 1);
  // Each voice starts at its own place in the rules, so voices of one family do not move together.
  for (let k = 0; k < i; k++) {
    hold();
    slide();
    turn();
  }
  const notes: Note[] = [];
  let t = Math.round(i * v.entries * TICKS);
  let away = false;
  let midi = homeAt(t);
  let reached: Note["reached"];
  while (t < end) {
    const h = hold() * atom;
    const s = slide() * atom;
    const arrive = t + h + s;
    notes.push({ at: t, hold: h, dur: h + s, midi, gliss: true, reached });
    // The next tone: turned away from the chord tone in force when the slide ends, or back to it.
    midi = away ? homeAt(arrive) : homeAt(arrive) + turn();
    reached = away ? "home" : "away";
    away = !away;
    t = arrive;
  }
  // The last tone holds to the end; nothing sounds past it.
  const last = notes.at(-1);
  if (last) Object.assign(last, { gliss: false, dur: end - last.at });
  for (const n of notes) n.dur = Math.min(n.dur, end - n.at);
  return notes.filter((n) => n.dur > 0);
}

export function score(v: V): Score {
  const end = v.bars * 4 * TICKS;
  const families = familiesOf("Families", v.families);
  const chords = chordsOf(v);
  const voices = VOICES.map((_, i) => voice(v, i, families[i % families.length]!, chords, end));

  const parts: Part[] = VOICES.map((vc, i) => {
    const notes = voices[i]!;
    const technique =
      v.stroke === "Vn I in harmonics"
        ? vc.instrument === "violins-1"
          ? "harmonic"
          : "sul-tasto"
        : { "sul tasto": "sul-tasto", flautando: "flautando", "con sord.": "con-sord" }[
            v.stroke as "sul tasto" | "flautando" | "con sord."
          ];
    const events: NoteEvent[] = notes.map((n, k) => {
      const e: NoteEvent = { at: time(n.at), dur: time(n.dur), pitch: { midi: n.midi }, technique };
      if (n.gliss && notes[k + 1]?.at === n.at + n.dur) {
        e.gliss = true;
        e.glissAfter = time(n.hold);
      }
      return e;
    });
    // The chord comes out of nothing, grows a little past the middle, and goes back into nothing.
    const entry = notes[0]?.at ?? 0;
    const beat = TICKS;
    const dynamics: DynamicPoint[] = [
      { at: time(entry), level: 0.5, to: "linear" },
      { at: time(entry + 2 * beat), level: 2, to: "linear" },
      { at: time(Math.round(end * 0.6)), level: 3, to: "linear" },
      { at: time(Math.round(end * 0.85)), level: 2, to: "linear" },
      { at: time(end), level: 0.5 },
    ];
    return { ...vc, dynamics, events };
  });

  if (v.reflect !== "off") {
    // Every slide's end, in time order; each grid's instruments take turns catching it.
    const arrivals = voices
      .flat()
      .filter(
        (n) =>
          n.reached !== undefined &&
          (v.reflect === "every arrival" ||
            (v.reflect === "turning away" ? n.reached === "away" : n.reached === "home")),
      )
      .sort((a, b) => a.at - b.at);
    const turnOf = [0, 0];
    const calls = new Map<string, Map<number, number[]>>();
    for (const n of arrivals) {
      const grid = gridOf(n.midi);
      const mirrors = MIRRORS[grid]!;
      const m = mirrors[turnOf[grid]!++ % mirrors.length]!;
      const byTime = calls.get(m.id) ?? new Map<number, number[]>();
      calls.set(m.id, byTime);
      const q = fold(n.midi + 12, m.window);
      byTime.set(n.at, [...new Set([...(byTime.get(n.at) ?? []), q])]);
    }
    const mirrorParts = MIRROR_ORDER.map((id) => {
      const m = MIRRORS.flat().find((x) => x.id === id)!;
      const times = [...(calls.get(id) ?? new Map<number, number[]>())].sort((a, b) => a[0] - b[0]);
      const events: NoteEvent[] = times.map(([at, pitches], k) => {
        const next = times[k + 1]?.[0] ?? end;
        const pitch: Pitch | Pitch[] =
          pitches.length === 1 ? { midi: pitches[0]! } : pitches.map((midi) => ({ midi }));
        const e: NoteEvent = {
          at: time(at),
          dur: time(Math.min(TICKS, next - at, end - at)),
          pitch,
        };
        if (m.technique) e.technique = m.technique;
        return e;
      });
      return {
        id: m.id,
        instrument: m.instrument,
        name: m.name,
        abbreviation: m.abbreviation,
        dynamics: [{ at: 0, level: m.level }],
        events,
      } satisfies Part;
    });
    parts.unshift(...mirrorParts);
  }

  return {
    title: "antara · a chord of glass between two grids",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: v.bars,
    parts,
  };
}

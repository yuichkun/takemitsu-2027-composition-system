// antara, an idea for the piece: the chord of glass between the two grids (../two-grids) on antara's
// orchestra (pieces/antara/ensemble.ts), every string section divided into its desks, with roles for
// the other instruments. A test of the divisions as much as an idea. Card: README.md.
//
// Strings. The thirty desks (Violin I in 8, Violin II in 7, violas in 6, cellos in 5, basses in 4,
// two players each) are thirty voices. As in two-grids, the chord is stacked bottom up from the
// anchor by the betweens of the Chord set, each voice now and then turns away from its chord tone
// and back, and the chord is stacked again a few times. With fewer Tones than desks, desks next to
// each other share a chord tone and turn apart from each other.
//
// The other instruments take roles by where they can stand. With quarter tones the pitches make two
// grids a quarter tone apart. An instrument with fixed pitches stands on one of them (harp 2, every
// string a quarter tone low, is the only one on the other); the rest reach both, and some of those
// can slide between them.
//
// - Light (as in two-grids): where a slide ends, an instrument of that grid sounds the pitch once,
//   higher up. The usual grid: harp 1, celesta, crotales, piano. The other: harp 2. The harps only
//   catch sparse single notes in a middle register, ordinarily plucked, on fixed pedals.
// - Fixed point: from a beat in the middle to the end, the celesta strikes the opening's F♯ on every
//   beat, the same note as soft the whole time, and leaves its share of the light to the piano (the
//   ending goes on with it until the violin has come to its F♯).
// - Breath light: the other grid's light is shared with the flutes, the piccolo and a clarinet.
// - Homes held: while a voice is turned away, a wind or a muted trumpet holds the tone it left until
//   it comes back, so the turn is heard as two tones at once.
// - Slides doubled: the trombones (muted) and the timpani (a soft roll, the pedal gliding) turn with
//   a voice in their range, away and back.
// - Horns on the other grid: the horns hold the chord's tones on the other grid where the 11th
//   partial of their open series lands (a quarter tone off the usual grid).
// - Restack noise: a bowed tam-tam across each span where the chord is stacked again, from the
//   restack until every voice has reached the new chord.
// - Where families meet: the woodblocks sound where voices counting in different families end their
//   slides at the same moment (5 high, 3 medium, 2 low).

import { ensemble } from "../../../../pieces/antara/ensemble.ts";
import type { DynamicPoint, NoteEvent, Part, Pitch, Score } from "../../../../src/score/types.ts";
import type { Seam } from "../../../../src/sketch/nest.ts";
import {
  betweenSet,
  choice,
  number,
  pitch,
  text,
  toggle,
  type Values,
} from "../../../../src/sketch/knobs.ts";
import { atomOf, drawer, familiesOf, TICKS, time, type Family } from "../../between.ts";

const RULES = ["combinations", "shift each time"];
const ROLES = "Other instruments";

export const knobs = {
  chord: betweenSet({
    group: "Chord",
    label: "Chord",
    help: "The betweens the chord is stacked from, bottom up, again and again in this order (semitones, .5 for a quarter tone). A between with .5 puts the next tone on the other grid",
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
    help: "The chord's lowest tone (the basses' fourth desk); every other tone is the anchor plus the betweens below it. A tone above or below a section's range moves by octaves back in",
    value: "G1",
    min: "E1",
    max: "C4",
    step: 0.5,
  }),
  tones: number({
    group: "Chord",
    label: "Tones",
    help: "How many tones the chord has. 30: every desk its own tone. Fewer: desks next to each other share a tone (from the bottom up) and turn apart from each other",
    value: 30,
    min: 6,
    max: 30,
    step: 1,
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
    help: "The families the voices count in, from the top desk down, again and again (2: 16ths, 3: triplet 8ths, 5: quintuplet 16ths)",
    value: "5 3 2",
  }),
  reflect: choice({
    group: "Light",
    label: "Reflect",
    help: "Where a slide ends, an instrument of that grid sounds the pitch once, higher up (the usual grid: harp 1, celesta, crotales, piano; the other: harp 2). every arrival · turning away: only where a voice leaves its chord tone · coming home: only where it returns · off",
    value: "every arrival",
    options: ["every arrival", "turning away", "coming home", "off"],
  }),
  fixed: number({
    group: "Light",
    label: "Fixed point",
    help: "The beat from which the celesta strikes the opening's F♯ (F♯5) on every beat to the end, the same note, as soft, the whole time (the ending goes on with it). From there the piano alone lights the arrivals it shared with the celesta. 0: none",
    value: 28,
    min: 0,
    max: 160,
    step: 1,
    unit: "beats",
  }),
  breath: toggle({
    group: ROLES,
    label: "Breath light",
    help: "The other grid's light is shared: harp 2, the flutes, the piccolo and clarinet 1 take turns (a short tone, the quarter tones fingered)",
    value: false,
  }),
  homes: toggle({
    group: ROLES,
    label: "Homes held",
    help: "While a voice is turned away, a wind or a muted trumpet holds the tone it left, out of nothing and back into it, until the voice comes back: the turn is heard as two tones at once",
    value: false,
  }),
  doubled: toggle({
    group: ROLES,
    label: "Slides doubled",
    help: "The trombones (con sord.) and the timpani (a soft roll, the pedal gliding) each turn with one desk in their range, away and back",
    value: false,
  }),
  horns: toggle({
    group: ROLES,
    label: "Horns on the other grid",
    help: "The horns hold the chord's tones on the other grid, moved by octaves to where the 11th partial of their open series lands (a quarter tone off the usual grid)",
    value: false,
  }),
  restacks: toggle({
    group: ROLES,
    label: "Restack noise",
    help: "A bowed tam-tam across each span where the chord is stacked again: from the restack until every voice has reached the new chord",
    value: false,
  }),
  meetings: toggle({
    group: ROLES,
    label: "Where families meet",
    help: "The woodblocks sound where voices of different families end their slides at the same moment (family 5 the high block, 3 the medium, 2 the low)",
    value: false,
  }),
  entries: number({
    group: "Form",
    label: "Entries",
    help: "Beats between the desks' entries, from the top desk down (0: the chord starts at once)",
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
    min: 6,
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

const player = (id: string) => {
  const p = ensemble.find((x) => x.id === id);
  if (!p) throw new Error(`${id} is not in antara's orchestra`);
  return p;
};

// The desks, top down in score order: each section in as many parts as it has desks.
const DESKS: [string, number][] = [
  ["vn1", 8],
  ["vn2", 7],
  ["va", 6],
  ["vc", 5],
  ["cb", 4],
];
const VOICES = DESKS.flatMap(([key, n]) =>
  Array.from({ length: n }, (_, k) => player(`${key}-${n}-${k + 1}`)),
);
const N = VOICES.length;

/** Where each section can play (the basses as far as their samples reach). */
const RANGES: Record<string, [number, number]> = {
  "violins-1": [55, 100],
  "violins-2": [55, 96],
  violas: [48, 88],
  cellos: [36, 79],
  basses: [28, 54],
};
/** The first violins in harmonics sound where harmonics sound. */
const HARMONICS: [number, number] = [79, 100];

/** Which grid a pitch is on: 0 for the usual semitones, 1 for those a quarter tone off. */
const gridOf = (m: number) => Math.round(m * 2) % 2;

const fold = (p: number, [lo, hi]: [number, number]) => {
  let q = p;
  while (q > hi) q -= 12;
  while (q < lo) q += 12;
  return q;
};
const within = (p: number, [lo, hi]: [number, number]) => p >= lo && p <= hi;

/** A rule's groups laid end to end, one number at a time. */
function stream(set: number[], rule: string, size: number): () => number {
  const draw = drawer(set, rule, size, "ascending");
  let queue: number[] = [];
  return () => {
    if (queue.length === 0) queue = [...draw()];
    return queue.shift()!;
  };
}

/**
 * Each chord, as pitches of the desks from the bottom up: the set's betweens stacked from the
 * anchor (the order shifted by one for each new stack), desks next to each other sharing a tone
 * when there are fewer tones than desks. A tone moves by octaves into its desk's range, kept far
 * enough from the edges that the widest turn stays inside.
 */
function chordsOf(v: V): number[][] {
  const up = Math.max(0, ...v.turns);
  const down = Math.max(0, ...v.turns.map((t) => -t));
  const tones = Math.min(N, v.tones);
  const rangeOf = (instrument: string) =>
    instrument === "violins-1" && v.stroke === "Vn I in harmonics"
      ? HARMONICS
      : RANGES[instrument]!;
  return Array.from({ length: v.chords }, (_, c) => {
    const s = c % v.chord.length;
    const order = [...v.chord.slice(s), ...v.chord.slice(0, s)];
    const stack = [v.anchor];
    for (let k = 1; k < tones; k++) stack.push(stack[k - 1]! + order[(k - 1) % order.length]!);
    return Array.from({ length: N }, (_, k) => {
      const [lo, hi] = rangeOf(VOICES[N - 1 - k]!.instrument);
      const room: [number, number] = hi - up - (lo + down) >= 12 ? [lo + down, hi - up] : [lo, hi];
      return fold(stack[Math.floor((k * tones) / N)]!, room);
    });
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
  const fromBottom = N - 1 - i;
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

/** A part of antara's orchestra, with its events and dynamics. */
function partOf(id: string, events: Part["events"], dynamics: DynamicPoint[]): Part {
  const p = player(id);
  const out: Part = { id: p.id, instrument: p.instrument, name: p.name, dynamics, events };
  if (p.players !== undefined) out.players = p.players;
  if (p.player !== undefined) out.player = p.player;
  if (p.tuning !== undefined) out.tuning = p.tuning;
  return out;
}

/** Out of nothing to `level`, held, and back into nothing, over a note from `at` to `end`. */
function swell(at: number, end: number, level: number, rise: number, fall: number): DynamicPoint[] {
  const a = Math.min(at + rise, (at + end) / 2);
  const b = Math.max(end - fall, a);
  return [
    { at: time(at), level: 0.5, to: "linear" },
    { at: time(a), level, to: "linear" },
    { at: time(b), level, to: "linear" },
    { at: time(end), level: 0.5 },
  ];
}

// Every line of the other instruments stays on one grid of time (docs/antara/sound.md): each takes
// only what voices of one family do, so its onsets are always that family's.

// Light: the instruments that hold each grid (the usual one, the other), where they sound, and
// whose arrivals they catch.
interface Mirror {
  id: string;
  window: [number, number];
  level: number;
  family: Family;
  technique?: string;
  /** Plays one note at a time (a wind); otherwise several arrivals at once make a chord. */
  single?: boolean;
}
const LIGHT: Mirror[][] = [
  [
    { id: "hp1", window: [60, 79], level: 2, family: 3 },
    { id: "cel", window: [72, 100], level: 2, family: 5 },
    { id: "crot", window: [84, 108], level: 1.5, family: 2 },
    { id: "pno", window: [72, 100], level: 2, family: 5 },
  ],
  [{ id: "hp2", window: [59.5, 78.5], level: 2, family: 3 }],
];

/** Atmospheric harp notes: one at a time, at least four beats apart, all on one pedal setting.
 * Keep an arrival's pitch class, but wait until the next whole beat to avoid awkward tuplets.
 * Prefer a setting that keeps more sparse arrivals, then smaller jumps and fewer altered pedals. */
function quietHarp(m: Mirror, times: [number, number[]][], end: number): Part {
  const tuning = m.id === "hp2" ? -0.5 : 0;
  const natural = [0, 2, 4, 5, 7, 9, 11];
  const steps = ["C", "D", "E", "F", "G", "A", "B"] as const;
  let best = -Infinity;
  let chosen: { at: number; midi: number }[] = [];
  let pedals: number[] = [];
  for (let setting = 0; setting < 3 ** 7; setting++) {
    let code = setting;
    const alters = natural.map(() => {
      const a = (code % 3) - 1;
      code = Math.floor(code / 3);
      return a;
    });
    const pcs = new Set(natural.map((p, i) => (p + alters[i]! + 12) % 12));
    const notes: typeof chosen = [];
    let motion = 0;
    for (const [arrival, pitches] of times) {
      const at = Math.ceil(arrival / TICKS) * TICKS;
      if (at >= end) continue;
      const previous = notes.at(-1);
      if (previous && at - previous.at < 4 * TICKS) continue;
      const centre = previous?.midi ?? (m.window[0] + m.window[1]) / 2;
      const available = pitches
        .filter((p) => pcs.has(((Math.round(p - tuning) % 12) + 12) % 12))
        .sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre) || a - b);
      if (!available.length) continue;
      const midi = available[0]!;
      motion += Math.abs(midi - centre);
      notes.push({ at, midi });
    }
    const merit =
      notes.length * 1000 - motion - alters.reduce((sum, a) => sum + Math.abs(a), 0) / 10;
    if (merit > best) {
      best = merit;
      chosen = notes;
      pedals = alters;
    }
  }
  const events: Part["events"] = chosen.map(({ at, midi }) => {
    const pc = ((Math.round(midi - tuning) % 12) + 12) % 12;
    const i = natural.findIndex((p, i) => (p + pedals[i]! + 12) % 12 === pc);
    const alter = pedals[i]! + tuning;
    const octave = (midi - natural[i]! - alter) / 12 - 1;
    return {
      at: time(at),
      dur: time(Math.min(TICKS, end - at)),
      pitch: { step: steps[i]!, alter, octave },
    };
  });
  if (events.length) {
    const name = (i: number) => steps[i]! + ({ [-1]: "b", 0: "", 1: "#" }[pedals[i]!] ?? "");
    const label = [1, 0, 6].map(name).join(" ") + " | " + [2, 3, 4, 5].map(name).join(" ");
    events.unshift({
      type: "text",
      at: 0,
      placement: "above",
      text: `Pedals: ${label}; unchanged; l.v.${tuning ? " (all strings tuned 1/4 tone low)" : ""}`,
    });
  }
  return partOf(m.id, events, [{ at: 0, level: m.level }]);
}
const BREATH: Mirror[] = [
  { id: "fl1", window: [72, 96], level: 2, family: 5, single: true },
  { id: "picc", window: [79, 103], level: 1.5, family: 5, single: true },
  { id: "fl2", window: [72, 96], level: 2, family: 2, single: true },
  { id: "cl1", window: [66, 88], level: 2, family: 2, single: true },
];

// Homes held: who may hold a tone, where (sounding ranges kept inside the samples), and whose.
const HOLDERS: { id: string; range: [number, number]; family: Family; technique?: string }[] = [
  { id: "ob1", range: [60, 88], family: 5 },
  { id: "ob2", range: [60, 88], family: 3 },
  { id: "eh", range: [53, 79], family: 2 },
  { id: "tp1", range: [55, 82], family: 5, technique: "muted" },
  { id: "tp2", range: [55, 82], family: 3, technique: "muted" },
  { id: "tp3", range: [55, 80], family: 2, technique: "muted" },
  { id: "cl2", range: [51, 86], family: 2 },
  { id: "bcl", range: [36, 72], family: 5 },
  { id: "bn1", range: [36, 72], family: 3 },
  { id: "bn2", range: [36, 72], family: 2 },
  { id: "cbn", range: [24, 52], family: 5 },
  { id: "tba", range: [28, 60], family: 3 },
];

// Slides doubled: instruments that can slide, each with one desk in its range.
const SLIDERS: { id: string; range: [number, number]; technique: string; level: number }[] = [
  { id: "timp", range: [38, 60], technique: "roll+soft", level: 2 },
  { id: "btb", range: [30, 64], technique: "muted", level: 2 },
  { id: "tb2", range: [42, 70], technique: "muted", level: 2 },
  { id: "tb1", range: [42, 70], technique: "muted", level: 2 },
];

// Horns: where the 11th partial of the open series lands, on the other grid (F side 64.5–70.5,
// B♭ side 69.5–75.5, one valve combination for each semitone below the open fundamental).
const PARTIAL_11: [number, number] = [64.5, 75.5];

export function score(v: V): Score {
  const end = v.bars * 4 * TICKS;
  const families = familiesOf("Families", v.families);
  const familyOf = (i: number) => families[i % families.length]!;
  const chords = chordsOf(v);
  const stretch = end / chords.length;
  const voices = VOICES.map((_, i) => voice(v, i, familyOf(i), chords, end));
  const parts: Part[] = [];
  // Where the celesta's fixed point begins (on a beat; none when 0).
  const fixedFrom = v.fixed > 0 ? Math.round(v.fixed) * TICKS : Infinity;

  // Strings: every desk its own part.
  VOICES.forEach((desk, i) => {
    const notes = voices[i]!;
    const technique =
      v.stroke === "Vn I in harmonics"
        ? desk.instrument === "violins-1"
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
    const dynamics: DynamicPoint[] = [
      { at: time(entry), level: 0.5, to: "linear" },
      { at: time(entry + 2 * TICKS), level: 2, to: "linear" },
      { at: time(Math.round(end * 0.6)), level: 3, to: "linear" },
      { at: time(Math.round(end * 0.85)), level: 2, to: "linear" },
      { at: time(end), level: 0.5 },
    ];
    parts.push(partOf(desk.id, events, dynamics));
  });

  // Every slide's end, in time order, with the voice it belongs to.
  const arrivals = voices
    .flatMap((notes, i) => notes.filter((n) => n.reached !== undefined).map((n) => ({ n, i })))
    .sort((a, b) => a.n.at - b.n.at || a.i - b.i);

  // Light: each grid's instruments take turns catching the arrivals.
  if (v.reflect !== "off") {
    const grids = LIGHT.map((list, g) => (g === 1 && v.breath ? [...list, ...BREATH] : list));
    const turnOf = new Map<string, number>();
    const calls = new Map<string, Map<number, number[]>>();
    const busy = new Map<string, number>();
    for (const { n, i } of arrivals) {
      if (
        v.reflect !== "every arrival" &&
        (v.reflect === "turning away" ? n.reached !== "away" : n.reached !== "home")
      )
        continue;
      // The instruments of the arrival's grid that take its family's arrivals; none, no light.
      const g = gridOf(n.midi);
      const list = grids[g]!.filter(
        (m) =>
          m.family === familyOf(i) && !(m.id === "cel" && fixedFrom < end && n.at >= fixedFrom),
      );
      const key = `${g} ${familyOf(i)}`;
      // The next in turn; a wind still sounding (or already given this moment) passes it on.
      for (let tries = 0; tries < list.length; tries++) {
        const turn = turnOf.get(key) ?? 0;
        turnOf.set(key, turn + 1);
        const m = list[turn % list.length]!;
        const byTime = calls.get(m.id) ?? new Map<number, number[]>();
        if (m.single && ((busy.get(m.id) ?? -1) > n.at || byTime.has(n.at))) continue;
        calls.set(m.id, byTime);
        const q = fold(n.midi + 12, m.window);
        byTime.set(n.at, [...new Set([...(byTime.get(n.at) ?? []), q])]);
        busy.set(m.id, n.at + TICKS);
        break;
      }
    }
    for (const m of grids.flat()) {
      const times = [...(calls.get(m.id) ?? new Map<number, number[]>())].sort(
        (a, b) => a[0] - b[0],
      );
      if (times.length === 0) continue;
      if (m.id === "hp1" || m.id === "hp2") {
        const harp = quietHarp(m, times, end);
        if (harp.events.length) parts.push(harp);
        continue;
      }
      const stop = m.id === "cel" ? Math.min(end, fixedFrom) : end;
      const events: NoteEvent[] = times.map(([at, pitches], k) => {
        const next = times[k + 1]?.[0] ?? stop;
        const pitch: Pitch | Pitch[] =
          pitches.length === 1 ? { midi: pitches[0]! } : pitches.map((midi) => ({ midi }));
        const e: NoteEvent = {
          at: time(at),
          dur: time(Math.min(TICKS, next - at, stop - at)),
          pitch,
        };
        if (m.technique) e.technique = m.technique;
        return e;
      });
      parts.push(partOf(m.id, events, [{ at: 0, level: m.level }]));
    }
  }

  // The fixed point: from its beat on, the celesta strikes the opening's F♯ on every beat, written as
  // the opening wrote it (a quarter, tenuto), as soft all the way.
  if (fixedFrom < end) {
    const strokes: NoteEvent[] = [];
    for (let at = fixedFrom; at < end; at += TICKS)
      strokes.push({
        at: time(at),
        dur: time(TICKS),
        pitch: { midi: 78 },
        articulations: ["tenuto"],
      });
    const lit = parts.find((p) => p.id === "cel");
    if (lit) {
      lit.events.push(...strokes);
      lit.dynamics = [...(lit.dynamics ?? []), { at: time(fixedFrom), level: 2 }];
    } else parts.push(partOf("cel", strokes, [{ at: time(fixedFrom), level: 2 }]));
  }

  // Excursions: a voice leaves its chord tone (the slide away starts), stays away, and comes back.
  const excursions = voices
    .flatMap((notes, i) =>
      notes.flatMap((n, k) => {
        const away = notes[k + 1];
        const back = notes[k + 2];
        if (away?.reached !== "away" || !n.gliss) return [];
        return [
          {
            i,
            home: n.midi,
            to: away.midi,
            leave: n.at + n.hold,
            arrive: away.at,
            turnBack: away.gliss ? away.at + away.hold : away.at + away.dur,
            back: back?.midi,
            end: back ? back.at : away.at + away.dur,
          },
        ];
      }),
    )
    .sort((a, b) => a.leave - b.leave || a.i - b.i);

  // Homes held: the first free holder whose range has the tone (the nearest to its middle).
  if (v.homes) {
    const free = new Map<string, number>();
    const held = new Map<string, NoteEvent[]>();
    const curves = new Map<string, DynamicPoint[]>();
    for (const x of excursions) {
      const fits = HOLDERS.filter(
        (h) =>
          h.family === familyOf(x.i) && within(x.home, h.range) && (free.get(h.id) ?? 0) <= x.leave,
      ).sort(
        (a, b) =>
          Math.abs(x.home - (a.range[0] + a.range[1]) / 2) -
          Math.abs(x.home - (b.range[0] + b.range[1]) / 2),
      );
      const h = fits[0];
      if (!h) continue;
      const e: NoteEvent = {
        at: time(x.leave),
        dur: time(x.end - x.leave),
        pitch: { midi: x.home },
      };
      if (h.technique) e.technique = h.technique;
      held.set(h.id, [...(held.get(h.id) ?? []), e]);
      curves.set(h.id, [
        ...(curves.get(h.id) ?? []),
        ...swell(x.leave, x.end, 2, x.arrive - x.leave, x.end - x.turnBack),
      ]);
      // A breath between two held tones.
      free.set(h.id, x.end + TICKS / 2);
    }
    for (const h of HOLDERS)
      if (held.has(h.id)) parts.push(partOf(h.id, held.get(h.id)!, curves.get(h.id)!));
  }

  // Slides doubled: each slider takes the desk longest in its range (one desk each), and turns with
  // it on every excursion that stays in its range.
  if (v.doubled) {
    const taken = new Set<number>();
    for (const s of SLIDERS) {
      const inRange = (i: number) =>
        voices[i]!.filter((n) => within(n.midi, s.range)).reduce((a, n) => a + n.dur, 0);
      const pick = VOICES.map((_, i) => i)
        .filter((i) => !taken.has(i))
        .sort((a, b) => inRange(b) - inRange(a) || b - a)[0];
      if (pick === undefined || inRange(pick) === 0) continue;
      taken.add(pick);
      const events: NoteEvent[] = [];
      const dynamics: DynamicPoint[] = [];
      for (const x of excursions.filter((e) => e.i === pick)) {
        if (x.back === undefined || ![x.home, x.to, x.back].every((p) => within(p, s.range)))
          continue;
        // From the home tone as the voice leaves it, away, and back.
        events.push(
          {
            at: time(x.leave),
            dur: time(x.arrive - x.leave),
            pitch: { midi: x.home },
            technique: s.technique,
            gliss: true,
          },
          {
            at: time(x.arrive),
            dur: time(x.end - x.arrive),
            pitch: { midi: x.to },
            technique: s.technique,
            gliss: true,
            glissAfter: time(x.turnBack - x.arrive),
          },
          {
            at: time(x.end),
            dur: time(Math.min(TICKS, end - x.end)),
            pitch: { midi: x.back },
            technique: s.technique,
          },
        );
        dynamics.push(
          ...swell(x.leave, Math.min(x.end + TICKS, end), s.level, x.arrive - x.leave, TICKS),
        );
      }
      const kept = events.filter((e) => (typeof e.dur === "number" ? e.dur : e.dur[0]) > 0);
      if (kept.length) parts.push(partOf(s.id, kept, dynamics));
    }
  }

  // Horns on the other grid: in each chord's stretch, its tones on the other grid (from the bottom
  // of the stack), moved by octaves to where the 11th partial lands; four at most, one a horn.
  if (v.horns) {
    const horns = ["hn1", "hn2", "hn3", "hn4"];
    const lines = horns.map((): { events: Part["events"]; dynamics: DynamicPoint[] } => ({
      events: [],
      dynamics: [],
    }));
    const beatAfter = (t: number) => Math.ceil(t / TICKS) * TICKS;
    chords.forEach((chord, c) => {
      const tones = [
        ...new Set(chord.filter((p) => gridOf(p) === 1).map((p) => fold(p, PARTIAL_11))),
      ]
        .slice(0, horns.length)
        .sort((a, b) => b - a);
      // When each desk (from the bottom) has reached this chord: its entry, or its first arrival
      // after the restack.
      const reached = chord.map((_, k) => {
        const notes = voices[N - 1 - k]!;
        const first =
          c === 0 ? notes[0] : notes.find((n) => n.at >= c * stretch && n.reached !== undefined);
        return first?.at ?? end;
      });
      // To a beat before the next stack.
      const to = c === chords.length - 1 ? end : beatAfter((c + 1) * stretch) - 2 * TICKS;
      tones.forEach((p, h) => {
        // A horn takes its tone on the beat after a desk holding it has reached the chord.
        const at = beatAfter(
          Math.min(
            ...chord.flatMap((q, k) =>
              gridOf(q) === 1 && fold(q, PARTIAL_11) === p ? [reached[k]!] : [],
            ),
          ),
        );
        if (to - at < 2 * TICKS) return;
        const line = lines[h]!;
        const e: NoteEvent = { at: time(at), dur: time(to - at), pitch: { midi: p } };
        line.events.push(e);
        line.dynamics.push(...swell(at, to, 2, 2 * TICKS, 2 * TICKS));
      });
    });
    horns.forEach((id, h) => {
      const line = lines[h]!;
      if (!line.events.length) return;
      line.events.unshift({
        type: "text",
        at: line.events[0]!.at,
        text: "open, 11th partial",
        placement: "above",
      });
      parts.push(partOf(id, line.events, line.dynamics));
    });
  }

  // Restack noise: from each new stack until every voice has reached it (its first arrival after).
  if (v.restacks && chords.length > 1) {
    const events: NoteEvent[] = [];
    const dynamics: DynamicPoint[] = [];
    for (let c = 1; c < chords.length; c++) {
      const restack = c * stretch;
      const reached = voices.map(
        (notes) => notes.find((n) => n.at >= restack && n.reached !== undefined)?.at ?? restack,
      );
      // On the beats around the span.
      const from = Math.floor(restack / TICKS) * TICKS;
      const to = Math.min(end, Math.ceil(Math.max(...reached) / TICKS) * TICKS);
      if (to - from < TICKS) continue;
      events.push({ at: time(from), dur: time(to - from), technique: "bowed" });
      dynamics.push(...swell(from, to, 3, (to - from) / 2, (to - from) / 2));
    }
    if (events.length) parts.push(partOf("tam", events, dynamics));
  }

  // Where families meet: slide ends of voices in different families at the same moment.
  if (v.meetings) {
    const block: Record<Family, string> = { 5: "wbh", 3: "wbm", 2: "wbl" };
    const byTime = new Map<number, Set<Family>>();
    for (const { n, i } of arrivals)
      byTime.set(n.at, new Set([...(byTime.get(n.at) ?? []), familyOf(i)]));
    const hits = new Map<string, NoteEvent[]>();
    for (const [at, fams] of [...byTime].sort((a, b) => a[0] - b[0])) {
      if (fams.size < 2) continue;
      for (const f of fams) {
        const id = block[f];
        hits.set(id, [...(hits.get(id) ?? []), { at: time(at), dur: time(atomOf(2)) }]);
      }
    }
    for (const id of ["wbh", "wbm", "wbl"])
      if (hits.has(id)) parts.push(partOf(id, hits.get(id)!, [{ at: 0, level: 2 }]));
  }

  // Score order: antara's orchestra.
  const rank = (id: string) => ensemble.findIndex((p) => p.id === id);
  parts.sort((a, b) => rank(a.id) - rank(b.id));
  return {
    title: "antara · the chord of glass, the strings in desks",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: v.bars,
    // Every player on a staff of their own (docs/decisions/0025).
    pairs: false,
    parts,
  };
}

/**
 * Where a section made of this sketch may stop or start (src/sketch/join.ts): every part anywhere
 * while it holds a tone (a desk not while it slides), or at a note it only touches.
 */
export function seams(score: Score): Record<string, Seam[]> {
  const q = (t: NoteEvent["at"]) => (typeof t === "number" ? t : t[0] / t[1]);
  const out: Record<string, Seam[]> = {};
  for (const p of score.parts) {
    const notes = p.events.filter((e): e is NoteEvent => e.type !== "text");
    out[p.id] = notes.map((n): Seam => {
      const at = q(n.at);
      const held = n.gliss ? q(n.glissAfter ?? 0) : q(n.dur);
      return held > 0 ? [at, at + held] : at;
    });
  }
  return out;
}

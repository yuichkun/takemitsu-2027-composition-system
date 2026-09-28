// antara palette, B: the weight of a tone is the number of its relations.
//
// Uses the chord of glass (ideas/two-grids), whose voice process is copied here unchanged: twelve
// divided string voices hold one chord, stacked from the anchor by the Chord's betweens, and each
// voice now and then turns: it slides away from its chord tone by a between of the Turns set (by
// default all with .5, so it crosses to the other grid), holds there, and slides back. Each voice
// counts its holds and slides in its own family and starts at its own place in the rules; the chord
// is stacked again a few times and the voices reach the new chord as they come home. The mirrors of
// that idea are left out, and the strings play sul tasto throughout.
//
// Here the chord's tones are terms and the betweens among them are relations. A lens is a set of
// between sizes: it decides which relations count as connections (a standpoint). A voice is a term
// while it holds a tone, from its entry or the end of a slide until its next slide starts; while it
// slides it has no relations. A term's degree is the number of other terms standing a between of
// the lens away from it (the size exactly, no octave reduction). Twenty-two winds are attached for
// the whole sketch, one or two to each string voice, and double only that voice: the j-th doubler
// of a voice sounds its held tone while its degree is j or more. So a slide changes the weight of
// tones that do not move: the voice that leaves takes its connections with it, and the tones it
// was connected to lose them; where it arrives it may make others.
//
// The lens changes at a bar line. The first lens (rest) is the betweens of neighbours in the resting
// chord, the Chord's own set: every resting tone is connected to its neighbours, so the chord at
// rest is heavy and a voice that turns away goes thin. The second lens (turned) is every between
// that one turn makes between the turning voice and a resting neighbour, less the sizes that any two
// tones of the resting chord stand apart: resting tones are never connected, and the weight gathers
// where voices have turned away and around them. Both lenses are read off the chord and the turns
// (neighbours at rest, neighbours after one turn), so the second is as whole a standpoint as the
// first. The same motion, named through two lenses, puts the weight in opposite places.
//
// A doubler comes in from nothing and goes back to nothing over a few atoms of its voice's family,
// on its voice's own time grid (the first atom of the voice at or after the change), so each wind
// line counts in one family like the string it doubles. It never slides: it is gone by the time its
// voice starts to slide, and if its degree falls and rises again while it is fading, it swells back
// on the same note.
// Card: README.md.

import { instrument } from "../../../../../src/instruments/catalog.ts";
import type { DynamicPoint, NoteEvent, Part } from "../../../../../src/score/types.ts";
import {
  betweenSet,
  choice,
  number,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import {
  atomOf,
  familiesOf,
  pitchSetsOf,
  stretches,
  TICKS,
  time,
  type Family,
} from "../../../between.ts";
import {
  curve,
  fold,
  inOrder,
  note,
  numberFromTop,
  part,
  scoreOf,
  stream,
  type Player,
} from "../../common.ts";

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
  lens: text({
    group: "Lens",
    label: "Lens",
    help: "The between sizes that count as a connection (semitones, .5 for a quarter tone; the size exactly, no octave reduction), or a word. rest: the betweens of neighbouring voices in the resting chords · turned: every between that one turn makes between the turning voice and a resting neighbour, and that no two tones of a resting chord stand apart. Sets split by | take turns: the length is split at bar lines into that many stretches",
    value: "rest | turned",
  }),
  doublers: number({
    group: "Winds",
    label: "Doublers per voice",
    help: "How many winds an inner voice gathers: the j-th sounds while the voice has j connections or more. The top and the bottom voice, with neighbours on one side only, get one fewer",
    value: 2,
    min: 1,
    max: 2,
    step: 1,
  }),
  fade: number({
    group: "Winds",
    label: "Entry / exit",
    help: "How long a doubler takes to come in from nothing and to go back to nothing, in atoms of its voice's family",
    value: 3,
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
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
    value: 24,
    min: 4,
    max: 40,
    step: 1,
    unit: "bars",
  }),
  tempo: number({
    group: "Form",
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

// ---- The voices of the chord of glass (copied from ideas/two-grids) ----

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

interface Tone {
  at: number;
  hold: number;
  dur: number;
  midi: number;
  gliss: boolean;
}

function voice(v: V, i: number, family: Family, chords: number[][], end: number): Tone[] {
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
  const tones: Tone[] = [];
  let t = Math.round(i * v.entries * TICKS);
  let away = false;
  let midi = homeAt(t);
  while (t < end) {
    const h = hold() * atom;
    const s = slide() * atom;
    const arrive = t + h + s;
    tones.push({ at: t, hold: h, dur: h + s, midi, gliss: true });
    // The next tone: turned away from the chord tone in force when the slide ends, or back to it.
    midi = away ? homeAt(arrive) : homeAt(arrive) + turn();
    away = !away;
    t = arrive;
  }
  // The last tone holds to the end; nothing sounds past it.
  const last = tones.at(-1);
  if (last) Object.assign(last, { gliss: false, dur: end - last.at });
  for (const n of tones) n.dur = Math.min(n.dur, end - n.at);
  return tones.filter((n) => n.dur > 0);
}

// ---- Terms, relations and the lens ----

/**
 * The lenses, each written as between sizes or as a word:
 * - rest: the betweens of neighbouring voices in the resting chords (with the Chord unfolded, the
 *   Chord's own set)
 * - turned: every between that one turn makes between the turning voice and a resting neighbour
 *   (a neighbour's between grown or shrunk by a between of Turns), leaving out every size that two
 *   tones of a resting chord stand apart. Resting tones are never connected through it.
 */
function lensesOf(value: string, chords: number[][], turns: number[]): number[][] {
  const rest = new Set<number>();
  const apart = new Set<number>();
  const made = new Set<number>();
  for (const c of chords) {
    for (let a = 0; a < c.length; a++)
      for (let b = a + 1; b < c.length; b++) apart.add(Math.abs(c[b]! - c[a]!));
    for (let k = 0; k + 1 < c.length; k++) {
      const between = c[k + 1]! - c[k]!;
      rest.add(Math.abs(between));
      for (const t of turns) made.add(Math.abs(between + t)).add(Math.abs(between - t));
    }
  }
  const words: Record<string, number[]> = {
    rest: [...rest],
    turned: [...made].filter((x) => !apart.has(x)),
  };
  const sections = value
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  if (sections.length === 0) throw new Error("Lens: write at least one set (e.g. rest | turned)");
  return sections.map((s) => {
    const set = words[s.toLowerCase()] ?? pitchSetsOf("Lens", s)[0]!;
    if (set.length === 0) throw new Error(`Lens: "${s}" has no sizes with these values`);
    return [...set].sort((a, b) => a - b);
  });
}

/** A voice standing as a term: holding one tone, from `from` until `to` (its next slide, or the end). */
interface Held {
  from: number;
  to: number;
  midi: number;
}

function heldOf(tones: Tone[]): Held[] {
  return tones.map((n) => ({
    from: n.at,
    to: n.gliss ? n.at + n.hold : n.at + n.dur,
    midi: n.midi,
  }));
}

/**
 * Each voice's degree over time: at every moment where a voice starts to hold, starts to slide, or
 * the lens changes, the number of other held voices standing a between of the lens away. A span
 * [from, to) with the degree of each voice (-1 while it is not a term).
 */
function degreesOf(
  held: Held[][],
  lenses: number[][],
  bounds: number[],
  end: number,
): { from: number; to: number; degree: number[] }[] {
  const cuts = new Set<number>([0, end, ...bounds]);
  for (const hs of held) for (const h of hs) cuts.add(h.from).add(h.to);
  const times = [...cuts].filter((t) => t >= 0 && t <= end).sort((a, b) => a - b);
  const lensAt = (t: number) => {
    let s = 0;
    for (let k = 0; k < bounds.length; k++) if (bounds[k]! <= t) s = k;
    return lenses[s % lenses.length]!.map((x) => Math.round(Math.abs(x) * 2));
  };
  const out: { from: number; to: number; degree: number[] }[] = [];
  for (let k = 0; k + 1 < times.length; k++) {
    const t = times[k]!;
    const lens = lensAt(t);
    const now = held.map((hs) => hs.find((h) => h.from <= t && t < h.to));
    const degree = now.map((h, i) => {
      if (!h) return -1;
      let n = 0;
      now.forEach((u, j) => {
        if (j !== i && u && lens.includes(Math.round(Math.abs(h.midi - u.midi) * 2))) n++;
      });
      return n;
    });
    out.push({ from: t, to: times[k + 1]!, degree });
  }
  return out;
}

// ---- The winds ----

const WINDS: [string, number][] = [
  ["flute", 3],
  ["oboe", 3],
  ["clarinet", 3],
  ["bassoon", 3],
  ["horn", 4],
  ["trumpet", 3],
  ["trombone", 3],
];
const ID: Record<string, string> = {
  flute: "fl",
  oboe: "ob",
  clarinet: "cl",
  bassoon: "bsn",
  horn: "hn",
  trumpet: "tpt",
  trombone: "tbn",
};
const SCORE_ORDER = WINDS.map(([id]) => id);

/**
 * Where each wind can double: its range (src/instruments/catalog.ts), kept within the notes the
 * playback (BBC SO) has samples for.
 */
const REACH: Record<string, [number, number]> = {
  flute: [60, 96],
  oboe: [58, 90],
  clarinet: [50, 88],
  bassoon: [34, 74],
  horn: [34, 77],
  trumpet: [54, 84],
  trombone: [40, 72],
};

/**
 * The winds, low to high by the highest note each one reaches (then by the middle of the reach):
 * the voices take them from the lowest voice up, so each voice gets winds that reach its highest
 * turn, as far as the winds reach.
 */
const POOL: Player[] = [...WINDS]
  .sort(
    ([a], [b]) =>
      REACH[a]![1] - REACH[b]![1] || REACH[a]![0] + REACH[a]![1] - REACH[b]![0] - REACH[b]![1],
  )
  .flatMap(([id, n]) =>
    Array.from({ length: n }, () => ({
      id: ID[id]!,
      instrument: id,
      name: instrument(id).name,
      abbreviation: instrument(id).abbreviation,
      range: REACH[id]!,
      grids: [0, 1],
    })),
  );

/** A piecewise linear level curve, in ticks, read at a time. */
function levelAt(points: { at: number; level: number }[], t: number): number {
  if (t <= points[0]!.at) return points[0]!.level;
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1]!;
    const b = points[k]!;
    if (t <= b.at)
      return b.at === a.at ? b.level : a.level + ((b.level - a.level) * (t - a.at)) / (b.at - a.at);
  }
  return points.at(-1)!.level;
}

/**
 * One doubler's notes and dynamics. `on` says, tick by tick, whether the doubler should sound; the
 * sound follows it at one step per tick, reaching full level after `fade` ticks, and is also held
 * under the time left before the voice's slide, so it is gone when the slide starts. Full level is
 * the string voice's own level.
 */
function doubler(
  on: (t: number) => boolean,
  heldAt: (t: number) => Held | undefined,
  fade: number,
  strings: { at: number; level: number }[],
  end: number,
): { notes: NoteEvent[]; dynamics: DynamicPoint[]; entries: number } {
  // e[t]: the level at tick t, in steps of 1/fade.
  const e: number[] = Array.from({ length: end + 1 }, () => 0);
  for (let t = 0; t < end; t++) {
    const h = heldAt(t);
    let x = h && on(t) ? e[t]! + 1 : e[t]! - 1;
    x = Math.max(0, Math.min(fade, x));
    const h1 = heldAt(t + 1);
    const room = h1 && h && h1 === h ? h.to - (t + 1) : 0;
    e[t + 1] = Math.min(x, room);
  }
  const notes: NoteEvent[] = [];
  const points: { at: number; level: number; ramp?: boolean }[] = [];
  let entries = 0;
  const bends = strings.map((p) => p.at);
  for (let t = 0; t < end; t++) {
    if (e[t] !== 0 || e[t + 1] === 0) continue;
    // A note from t until the level is back to 0.
    let stop = t + 1;
    while (stop < end && e[stop]! > 0) stop++;
    const h = heldAt(t)!;
    notes.push(note(t, stop - t, h.midi));
    entries++;
    points.push({ at: t, level: 0, ramp: true });
    for (let u = t + 1; u < stop; u++) {
      const slope = e[u + 1]! - e[u]!;
      const before = e[u]! - e[u - 1]!;
      if (slope !== before || bends.includes(u))
        points.push({ at: u, level: (levelAt(strings, u) * e[u]!) / fade, ramp: true });
    }
    points.push({ at: stop, level: 0 });
    t = stop - 1;
  }
  return { notes, dynamics: curve(points.length ? points : [{ at: 0, level: 0 }]), entries };
}

export function score(v: V) {
  const bar = 4 * TICKS;
  const end = v.bars * bar;
  const families = familiesOf("Families", v.families);
  const chords = chordsOf(v);
  const lenses = lensesOf(v.lens, chords, v.turns);
  const bounds = stretches(v.bars * 4, lenses.length).map(([from]) => from * TICKS);
  const familyOf = (i: number) => families[i % families.length]!;
  const tones = VOICES.map((_, i) => voice(v, i, familyOf(i), chords, end));
  const held = tones.map(heldOf);
  const spans = degreesOf(held, lenses, bounds, end);

  // The strings: the chord of glass, sul tasto, from nothing to pp, p a little past the middle,
  // back to nothing.
  const levels = VOICES.map((_, i) => {
    const entry = tones[i]![0]?.at ?? 0;
    return [
      { at: entry, level: 0.5 },
      { at: entry + 2 * TICKS, level: 2 },
      { at: Math.round(end * 0.6), level: 3 },
      { at: Math.round(end * 0.85), level: 2 },
      { at: end, level: 0.5 },
    ];
  });
  const stringParts: Part[] = VOICES.map((vc, i) => {
    const ns = tones[i]!;
    const events: NoteEvent[] = ns.map((n, k) => {
      const e: NoteEvent = {
        at: time(n.at),
        dur: time(n.dur),
        pitch: { midi: n.midi },
        technique: "sul-tasto",
      };
      if (n.gliss && ns[k + 1]?.at === n.at + n.dur) {
        e.gliss = true;
        e.glissAfter = time(n.hold);
      }
      return e;
    });
    const dynamics: DynamicPoint[] = levels[i]!.map((p, k, all) => ({
      at: time(p.at),
      level: p.level,
      ...(k < all.length - 1 ? { to: "linear" as const } : {}),
    }));
    return { ...vc, dynamics, events };
  });

  // Each voice's span: every chord tone it has over the restacks, and its turns either side.
  const low = Math.min(0, ...v.turns);
  const high = Math.max(0, ...v.turns);
  const slots: { i: number; j: number; range: [number, number] }[] = [];
  for (let b = 0; b < VOICES.length; b++) {
    const i = VOICES.length - 1 - b;
    const homes = chords.map((c) => c[b]!);
    const range: [number, number] = [Math.min(...homes) + low, Math.max(...homes) + high];
    const outer = b === 0 || b === VOICES.length - 1;
    const count = outer ? v.doublers - 1 : v.doublers;
    for (let j = 1; j <= count; j++) slots.push({ i, j, range });
  }
  const players = numberFromTop(
    inOrder(
      slots.map((s) => s.range),
      POOL,
    ),
  );

  // Each doubler: on while its voice holds and has j connections or more; its entries and exits on
  // the voice's own grid (the first atom of the voice's family at or after the change).
  const windParts = slots.map((s, k) => {
    const atom = atomOf(familyOf(s.i));
    const origin = tones[s.i]![0]?.at ?? 0;
    const snap = (t: number) => origin + Math.ceil((t - origin) / atom) * atom;
    const intervals: [number, number][] = [];
    let open: number | undefined;
    for (const sp of spans) {
      const yes = sp.degree[s.i]! >= s.j;
      if (yes && open === undefined) open = sp.from;
      if (!yes && open !== undefined) {
        intervals.push([open, sp.from]);
        open = undefined;
      }
    }
    if (open !== undefined) intervals.push([open, end]);
    const snapped = intervals
      .map(([a, c]): [number, number] => [snap(a), Math.min(end, snap(c))])
      .filter(([a, c]) => c > a);
    const on = (t: number) => snapped.some(([a, c]) => a <= t && t < c);
    const heldAt = (t: number) => held[s.i]!.find((h) => h.from <= t && t < h.to);
    const d = doubler(on, heldAt, v.fade * atom, levels[s.i]!, end);
    return part(players[k]!, d.notes, d.dynamics);
  });
  windParts.sort(
    (a, b) =>
      SCORE_ORDER.indexOf(a.instrument) - SCORE_ORDER.indexOf(b.instrument) ||
      a.id.localeCompare(b.id, undefined, { numeric: true }),
  );

  const out = scoreOf(
    "antara · palette B · the weight of a tone is its relations",
    v.bars,
    v.tempo,
    [...windParts, ...stringParts],
  );
  out.rehearsal = bounds.map((at, k) => ({
    measure: at / bar + 1,
    label: `lens ${lenses[k % lenses.length]!.join(" ")}`,
  }));
  return out;
}

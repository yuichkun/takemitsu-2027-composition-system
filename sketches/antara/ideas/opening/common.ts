// antara, the opening: what the candidates share. Card: README.md.
//
// The scene (余湖さん, 2026-09-30): a still, low rumble. Out of it one struck note, the celesta, on
// one pitch, far apart at first, the betweens slowly shortening towards repeated notes: a relation
// in time is made. Harp 1 (usual tuning) now and then on the same note: a relation of colour. At
// those moments harp 2 (every string a quarter tone low) too: the first interval.
//
// The candidates differ in why a stroke gets a harp, and when. They share the pitch (the celesta
// and harp 1 on one note; harp 2 plays the same string, so it sounds a quarter tone off: the
// interval is not chosen, it is where harp 2 stands), the ground, and all but one the celesta's
// time (`shrinking`).

import { ensemble } from "../../../../pieces/antara/ensemble.ts";
import type { DynamicPoint, NoteEvent, Part, Score } from "../../../../src/score/types.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../src/sketch/knobs.ts";
import type { Seam } from "../../../../src/sketch/nest.ts";
import { atomOf, drawer, type Family, TICKS, time } from "../../between.ts";

export { TICKS, time, type Family };

const player = (id: string) => {
  const p = ensemble.find((x) => x.id === id);
  if (!p) throw new Error(`${id} is not in antara's orchestra`);
  return p;
};

/** A part of antara's orchestra, with its events and dynamics. */
export function partOf(id: string, events: Part["events"], dynamics: DynamicPoint[]): Part {
  const p = player(id);
  const out: Part = { id: p.id, instrument: p.instrument, name: p.name, dynamics, events };
  if (p.players !== undefined) out.players = p.players;
  if (p.player !== undefined) out.player = p.player;
  if (p.tuning !== undefined) out.tuning = p.tuning;
  return out;
}

//==============================================================================
// Knobs every candidate has

export const FAMILIES = ["2 · 16ths", "3 · triplet 8ths", "5 · quintuplets"];
export const familyOf = (option: string): Family => Number(option.split(" ")[0]) as Family;
export const RULES = ["shift each time", "combinations", "in order"];
export const GROUNDS = ["gives way", "stays", "noise only"];
export const HARP2 = ["the same string", "the string above"];

/** The pitch, the harps, the ground and the tempo. `given`: what the ground does unless moved. */
export function soundKnobs(given: string) {
  return {
    pitch: pitch({
      group: "Pitch",
      label: "Note",
      help: "The celesta's one note, and harp 1's. Where both ring: the celesta rings from about C5 to C7, the harp from about C4 to C6; this is the middle of where they overlap",
      value: "F#5",
      min: "C5",
      max: "C7",
      step: 1,
    }),
    harp2: choice({
      group: "Pitch",
      label: "Harp 2",
      help: "the same string: harp 2 plays the string harp 1 plays; tuned a quarter tone low, it sounds a quarter tone below · the string above: a quarter tone above",
      value: HARP2[0]!,
      options: HARP2,
    }),
    ground: choice({
      group: "Ground",
      label: "Ground",
      help: "The rumble: six low voices a quarter tone apart from the basses' lowest string (basses in four desks, contrabassoon, tuba) and soft rolls (bass drum, tam-tam). gives way: the six voices leave one by one as the relations come (how depends on the candidate) · stays: they hold to the end · noise only: only the rolls",
      value: given,
      options: GROUNDS,
    }),
    floor: pitch({
      group: "Ground",
      label: "Floor",
      help: "The lowest of the six voices (the others a quarter tone apart above it). E1 is the basses' lowest string",
      value: "E1",
      min: "E1",
      max: "C2",
      step: 0.5,
    }),
    intro: number({
      group: "Ground",
      label: "Alone",
      help: "Beats of the ground alone before the first stroke",
      value: 8,
      min: 0,
      max: 24,
      step: 1,
      unit: "beats",
    }),
    family: choice({
      group: "Sound",
      label: "Family",
      help: "The atom the betweens are counted in: 16ths, triplet 8ths or quintuplet 16ths. The repeated notes the celesta arrives at are one atom apart",
      value: FAMILIES[0]!,
      options: FAMILIES,
    }),
    tempo: number({
      group: "Sound",
      label: "Tempo",
      help: "Quarter notes per minute",
      value: 52,
      min: 36,
      max: 72,
      step: 2,
      unit: "bpm",
    }),
  };
}

type Sound = Values<ReturnType<typeof soundKnobs>>;

/**
 * The celesta's time when the set shrinks as time passes (every candidate but the seed). `set`:
 * the set unless moved.
 */
export function shrinkKnobs(set = "29 37 48") {
  return {
    set: betweenSet({
      group: "Time",
      label: "Set",
      help: "The betweens (in atoms) the celesta's strokes are drawn from at the start. The whole set then shrinks as time passes; a between is always a whole number of atoms, so betweens the atom can no longer tell apart become equal, and the strokes repeat",
      value: set,
      min: 1,
      max: 64,
      step: 1,
      unit: "atoms",
    }),
    rule: choice({
      group: "Time",
      label: "Rule",
      help: "How the betweens are drawn from the set. shift each time: the set in order, starting one later each time round · combinations: two at a time, in dictionary order · in order: the same order every time",
      value: RULES[0]!,
      options: RULES,
    }),
    halving: number({
      group: "Time",
      label: "Halving",
      help: "Seconds for the whole set to shrink to half its size. It shrinks the same way every second, so the strokes come closer evenly, slowly at first in number, never in feel",
      value: 17,
      min: 6,
      max: 40,
      step: 1,
      unit: "s",
    }),
    tail: number({
      group: "Time",
      label: "Tail",
      help: "Beats of repeated notes (one atom apart) after the whole set has shrunk to the atom",
      value: 4,
      min: 0,
      max: 16,
      step: 1,
      unit: "beats",
    }),
  };
}

type Shrink = Values<ReturnType<typeof shrinkKnobs>>;

//==============================================================================
// Time

/** The rule's draws from a set, one number at a time, forever. */
export function stream(set: number[], rule: string): () => number {
  const draw = drawer(set, rule, 2, "ascending");
  let queue: number[] = [];
  return () => {
    if (queue.length === 0) queue = [...draw()];
    return queue.shift()!;
  };
}

/** Seconds in one atom of a family at a tempo. */
export const secondsOf = (family: Family, bpm: number) => (atomOf(family) / TICKS) * (60 / bpm);

/**
 * The celesta's betweens (in atoms) when the set shrinks as time passes: each between is drawn by
 * the rule and scaled by how much the set has shrunk by then (by half every `halving` seconds),
 * as a whole number of atoms, at least one. When even the largest rounds to one atom, the strokes
 * are one atom apart; the tail goes on so for `tail` beats.
 */
export function shrinking(v: Shrink & Sound): number[] {
  const family = familyOf(v.family);
  const seconds = secondsOf(family, v.tempo);
  const next = stream(v.set, v.rule);
  const top = Math.max(...v.set);
  const gaps: number[] = [];
  let t = 0;
  for (let guard = 0; guard < 4000; guard++) {
    const scale = 2 ** (-t / v.halving);
    if (top * scale < 1.5) break;
    const g = Math.max(1, Math.round(next() * scale));
    gaps.push(g);
    t += g * seconds;
  }
  const pulse = Math.round((v.tail * TICKS) / atomOf(family));
  for (let k = 0; k < pulse; k++) gaps.push(1);
  return gaps;
}

/** Stroke times (ticks) from the first stroke and the betweens (atoms). */
export function strokesOf(start: number, gaps: number[], family: Family): number[] {
  const atom = atomOf(family);
  const out = [start];
  for (const g of gaps) out.push(out.at(-1)! + g * atom);
  return out;
}

/** How many atoms fit in `s` seconds (a limit given in seconds, as a between). */
export const atomsIn = (s: number, family: Family, bpm: number) =>
  Math.round(s / secondsOf(family, bpm));

//==============================================================================
// The celesta and the harps

/** The longest a struck note is written (it rings on its own after). */
const LONGEST = 2 * TICKS;

/** Struck notes at `times`, each written until the next or LONGEST, on `midi`. */
function struck(times: number[], midi: number, end: number): NoteEvent[] {
  return times.map((at, k) => ({
    at: time(at),
    dur: time(Math.min(LONGEST, (times[k + 1] ?? end) - at)),
    pitch: { midi },
  }));
}

/** The harps' pitches: harp 1 on the note, harp 2 on the same string (a quarter tone off). */
export function harpPitches(v: Sound): [number, number] {
  return [v.pitch, v.pitch + (v.harp2 === HARP2[0] ? -0.5 : 0.5)];
}

/**
 * The celesta on every stroke; harp 1 on the strokes of `one`, harp 2 on those of `two` (indices
 * into `times`). All at one level: nothing is marked but by who plays.
 */
export function strokeParts(
  v: Sound,
  times: number[],
  one: number[],
  two: number[],
  end: number,
): Part[] {
  const [h1, h2] = harpPitches(v);
  const pick = (ks: number[]) => [...new Set(ks)].sort((a, b) => a - b).map((k) => times[k]!);
  const parts = [partOf("cel", struck(times, v.pitch, end), [{ at: 0, level: 3 }])];
  if (one.length) parts.push(partOf("hp1", struck(pick(one), h1, end), [{ at: 0, level: 3 }]));
  if (two.length) parts.push(partOf("hp2", struck(pick(two), h2, end), [{ at: 0, level: 3 }]));
  return parts;
}

//==============================================================================
// The ground

/** The six low voices, bottom up: a quarter tone apart from the floor. */
const BAND: { id: string; technique?: string }[] = [
  { id: "cb-4-4", technique: "sul-tasto" },
  { id: "cb-4-3", technique: "sul-tasto" },
  { id: "cb-4-2", technique: "sul-tasto" },
  { id: "cb-4-1", technique: "sul-tasto" },
  { id: "cbn" },
  { id: "tba" },
];
export const BAND_SIZE = BAND.length;

/** Beats between one voice's slow swells: each voice starts at its own place in the set. */
const SWELLS = [5, 7, 6, 9];

/**
 * The ground from 0 to `end` (ticks). The six voices come in bottom up, a beat apart, out of
 * nothing, and swell slowly between ppp and pp, each on its own time. `leaves[k]` (ticks): when
 * the k-th voice from the top leaves (from then it fades over two beats); a voice with no time
 * holds, and fades over the last two beats. The rolls (`rolls`: the bass drum, the tam-tam) hold
 * at ppp throughout (a roll has one level: it is played so).
 */
export function ground(
  v: Sound,
  end: number,
  leaves: number[] = [],
  rolls: ("bd" | "tam")[] = ["bd", "tam"],
): Part[] {
  const parts: Part[] = [];
  const band = v.ground !== "noise only";
  if (band) {
    BAND.forEach((b, k) => {
      const enter = k * TICKS;
      const fromTop = BAND.length - 1 - k;
      const leave = v.ground === "gives way" ? leaves[fromTop] : undefined;
      // It fades from `fading` to `stop`: from its leaving, or over the last two beats.
      const stop = Math.max(
        enter + 2 * TICKS,
        leave === undefined ? end : Math.min(end, leave + 2 * TICKS),
      );
      const fading = Math.min(
        stop - TICKS / 4,
        Math.max(enter + TICKS, leave === undefined ? stop - 2 * TICKS : leave),
      );
      const next = stream(SWELLS, "shift each time");
      for (let s = 0; s < k; s++) next();
      const dynamics: DynamicPoint[] = [{ at: time(enter), level: 0.5, to: "linear" }];
      let at = enter + 3 * TICKS;
      let up = true;
      while (at < fading) {
        dynamics.push({ at: time(at), level: up ? 1.8 : 1.2, to: "linear" });
        at += next() * TICKS;
        up = !up;
      }
      // Out of the last swell, into nothing.
      dynamics.push({ at: time(fading), level: 1.5, to: "linear" });
      dynamics.push({ at: time(stop), level: 0.5 });
      const e: NoteEvent = {
        at: time(enter),
        dur: time(stop - enter),
        pitch: { midi: v.floor + k * 0.5 },
      };
      if (b.technique) e.technique = b.technique;
      parts.push(partOf(b.id, [e], dynamics));
    });
  }
  if (rolls.includes("bd"))
    parts.push(
      partOf("bd", [{ at: 0, dur: time(end), technique: "roll+soft" }], [{ at: 0, level: 1 }]),
    );
  if (rolls.includes("tam"))
    parts.push(
      partOf(
        "tam",
        [{ at: time(2 * TICKS), dur: time(end - 2 * TICKS), technique: "roll" }],
        [{ at: 0, level: 1 }],
      ),
    );
  return parts;
}

//==============================================================================
// The score

/** The bar (1-based) a tick falls in. */
const barOf = (t: number) => Math.floor(t / (4 * TICKS)) + 1;

/**
 * The score: parts in antara's order, 4/4, one tempo, to the bar after `end`. Letters where harp 1
 * first plays (A) and where harp 2 first plays (B).
 */
export function scoreOf(
  title: string,
  v: Sound,
  parts: Part[],
  end: number,
  births: (number | undefined)[],
): Score {
  const rank = (id: string) => ensemble.findIndex((p) => p.id === id);
  parts.sort((a, b) => rank(a.id) - rank(b.id));
  const letters = births
    .map((t, k) => (t === undefined ? undefined : { measure: barOf(t), label: "AB"[k]! }))
    .filter((r): r is { measure: number; label: string } => r !== undefined);
  return {
    title,
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: Math.ceil(end / (4 * TICKS)),
    rehearsal: letters.filter((r, k) => letters.findIndex((s) => s.measure === r.measure) === k),
    // Every player on a staff of their own (docs/decisions/0025).
    pairs: false,
    parts,
  };
}

/**
 * Where a section made of these sketches may stop or start (src/sketch/join.ts): a held note
 * anywhere while it holds, a stroke at its onset.
 */
export function seams(score: Score): Record<string, Seam[]> {
  const q = (t: NoteEvent["at"]) => (typeof t === "number" ? t : t[0] / t[1]);
  const out: Record<string, Seam[]> = {};
  for (const p of score.parts) {
    const notes = p.events.filter((e): e is NoteEvent => e.type !== "text");
    out[p.id] = notes.map((n): Seam => {
      const at = q(n.at);
      const dur = q(n.dur);
      return dur >= 4 ? [at, at + dur] : at;
    });
  }
  return out;
}

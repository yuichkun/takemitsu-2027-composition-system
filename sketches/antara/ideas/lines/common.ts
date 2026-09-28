// Shared by the sketches of "the vertical line and the horizontal line" (A: time, B: pitch).
//
// A vertical line is a run of notes whose time between is 0 (a chord); a horizontal line is a run
// whose pitch between is 0 (one pitch again and again). The A sketches open the time between from
// 0; the B sketches close the pitch between to 0. Each sketch does it by a different mechanism.
//
// Here: chords stacked from a set and handed to instruments by grid and register, rules as streams,
// and a score in 4/4.

import type { DynamicPoint, NoteEvent, Part, Score } from "../../../../src/score/types.ts";
import { drawer, TICKS, time } from "../../between.ts";

export { TICKS, time };

/** Which grid a pitch is on: 0 for the usual semitones, 1 for those a quarter tone off. */
export const gridOf = (m: number): number => Math.round(m * 2) % 2;

/** Moves a pitch by octaves into a range. */
export const fold = (p: number, [lo, hi]: [number, number]): number => {
  let q = p;
  while (q > hi) q -= 12;
  while (q < lo) q += 12;
  return q;
};

/** A rule's groups laid end to end, one number at a time. */
export function stream(set: number[], rule: string, size: number): () => number {
  const draw = drawer(set, rule, size, "ascending");
  let queue: number[] = [];
  return () => {
    if (queue.length === 0) queue = [...draw()];
    return queue.shift()!;
  };
}

/** The anchor with the set's betweens stacked on it, again and again: `count` pitches, bottom up. */
export function stack(anchor: number, set: number[], count: number): number[] {
  const out = [anchor];
  for (let k = 1; k < count; k++) out.push(out[k - 1]! + set[(k - 1) % set.length]!);
  return out;
}

export interface Player {
  id: string;
  instrument: string;
  name?: string;
  abbreviation?: string;
  players?: number;
  /** Where its notes go (sounding pitch). */
  range: [number, number];
  /**
   * The grids it can sound. Fixed-pitch instruments hold only the usual one; a harp or piano tuned
   * a quarter tone low holds only the other; strings, winds and brass hold both.
   */
  grids: number[];
  technique?: string;
}

const middle = (p: Player) => (p.range[0] + p.range[1]) / 2;
/** The octave of a tone nearest the middle of a player's range, inside the range. */
const placeFor = (t: number, p: Player) => fold(t + 12 * Math.round((middle(p) - t) / 12), p.range);

/**
 * Hands the tones of a chord to players: each player gets a tone of a grid it can sound, moved by
 * octaves into its range. Players tied to one grid choose first (the tone that sits best in their
 * range); the others take what is left, low tones to low players. One pitch per player, in the
 * players' order (undefined where nothing fits).
 */
export function assign(tones: number[], players: Player[]): (number | undefined)[] {
  const left = [...tones];
  const out: (number | undefined)[] = players.map(() => undefined);
  const take = (i: number, t: number) => {
    out[i] = placeFor(t, players[i]!);
    left.splice(left.indexOf(t), 1);
  };
  players.forEach((p, i) => {
    if (p.grids.length !== 1) return;
    const fits = left.filter((t) => gridOf(t) === p.grids[0]);
    if (fits.length === 0) return;
    const best = fits.reduce((a, b) =>
      Math.abs(placeFor(a, p) - middle(p)) <= Math.abs(placeFor(b, p) - middle(p)) ? a : b,
    );
    take(i, best);
  });
  const free = players
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => p.grids.length > 1 && out[i] === undefined)
    .sort((a, b) => middle(a.p) - middle(b.p));
  const rest = [...left].sort((a, b) => a - b);
  free.forEach(({ i }, k) => {
    const t = rest[Math.round((k * (rest.length - 1)) / Math.max(1, free.length - 1))];
    if (t !== undefined && left.includes(t)) take(i, t);
  });
  return out;
}

/** A note event in ticks. */
export function note(
  at: number,
  dur: number,
  midi: number | number[],
  extra: Partial<NoteEvent> = {},
): NoteEvent {
  const pitch = Array.isArray(midi) ? midi.map((m) => ({ midi: m })) : { midi };
  return { at: time(at), dur: time(dur), pitch, ...extra };
}

export function part(p: Player, events: NoteEvent[], dynamics: DynamicPoint[]): Part {
  const out: Part = { id: p.id, instrument: p.instrument, dynamics, events };
  if (p.name) out.name = p.name;
  if (p.abbreviation) out.abbreviation = p.abbreviation;
  if (p.players !== undefined) out.players = p.players;
  return out;
}

/** A score in 4/4 at one tempo. */
export function scoreOf(title: string, bars: number, bpm: number, parts: Part[]): Score {
  return {
    title,
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm }],
    measures: bars,
    parts,
  };
}

/** The chord every A sketch starts from, unless its knobs say otherwise. */
export const A_CHORD = "2.5 3 4.5 6";

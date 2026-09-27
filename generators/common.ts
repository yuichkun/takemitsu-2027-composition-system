// What the generators share (docs/architecture.md, "Pieces"): where instruments sing easily,
// the players a knob picks, voicing and voice leading, and the motif's rhythm spread over a block.

import { classOf, type Motif } from "../src/sketch/motif.ts";
import type { Context, Player } from "../src/sketch/nest.ts";

/** Where each instrument sings easily (sounding MIDI): inside its range, away from its extremes. */
const comfort: Record<string, [number, number]> = {
  piccolo: [79, 100],
  flute: [62, 91],
  "alto-flute": [57, 84],
  oboe: [60, 88],
  "cor-anglais": [55, 79],
  clarinet: [52, 84],
  "bass-clarinet": [38, 72],
  bassoon: [36, 67],
  horn: [41, 72],
  trumpet: [58, 82],
  trombone: [40, 70],
  vibraphone: [53, 89],
  marimba: [45, 93],
  glockenspiel: [79, 105],
  crotales: [84, 105],
  celesta: [60, 96],
  harp: [36, 91],
  "violins-1": [55, 91],
  "violins-2": [55, 88],
  violas: [48, 81],
  cellos: [36, 72],
  basses: [28, 55],
};
/** Where string harmonics sound well (BBC SO samples them from G5, C5 and C4 up). */
const harmonics: Record<string, [number, number]> = {
  "violins-1": [79, 98],
  "violins-2": [79, 96],
  violas: [72, 91],
  cellos: [60, 84],
};

export const windowOf = (p: Player, harmonic = false): [number, number] =>
  (harmonic ? harmonics[p.instrument] : undefined) ?? comfort[p.instrument] ?? [48, 84];

export const isStrings = (p: Player) =>
  ["violins-1", "violins-2", "violas", "cellos", "basses"].includes(p.instrument);

/** A band inside a player's window: `height` 0 its bottom … 1 its top, `width` a share of it. */
export function band(p: Player, height: number, width = 0.55, harmonic = false): [number, number] {
  const [lo, hi] = windowOf(p, harmonic);
  const w = (hi - lo) * width;
  const bottom = lo + (hi - lo - w) * Math.min(1, Math.max(0, height));
  return [bottom, bottom + w];
}

/** Knob labels for the ensemble. */
export const names = (ensemble: readonly Player[]) => ensemble.map((p) => p.name);

/** A weights knob's value from a few names: those given, the rest 0. */
export const weightsFor = (ensemble: readonly Player[], given: Record<string, number>) =>
  ensemble.map((p) => given[p.name] ?? 0);

export interface Chosen {
  player: Player;
  weight: number;
}

/** The players a weights knob picks (weight above 0), with their weights. */
export function chosen(ctx: Context, weights: number[]): Chosen[] {
  return ctx.ensemble
    .map((player, i) => ({ player, weight: weights[i] ?? 0 }))
    .filter((c) => c.weight > 0);
}

const middle = (p: Player) => {
  const [lo, hi] = windowOf(p);
  return (lo + hi) / 2;
};

export const orders = ["score order", "low to high", "high to low", "outside in"] as const;
export type Order = (typeof orders)[number];

/** Players in an order: as in the score, by register, or alternating from the outer ones in. */
export function ordered(list: Chosen[], order: string): Chosen[] {
  const byPitch = [...list].sort((a, b) => middle(a.player) - middle(b.player));
  if (order === "low to high") return byPitch;
  if (order === "high to low") return byPitch.reverse();
  if (order === "outside in") {
    const out: Chosen[] = [];
    for (let lo = 0, hi = byPitch.length - 1; lo <= hi; lo++, hi--) {
      out.push(byPitch[hi]!);
      if (lo !== hi) out.push(byPitch[lo]!);
    }
    return out;
  }
  return list;
}

/** A player's balance from a weight: 1 as marked, 0.5 about a dynamic and a half softer. */
export const balance = (weight: number) => (Math.min(1, weight) - 1) * 3;

/** The pitch of class `pc` nearest to `target`. */
export function nearestOfClass(pc: number, target: number): number {
  const base = target - classOf(target) + pc;
  return [base - 12, base, base + 12].reduce((a, b) =>
    Math.abs(b - target) < Math.abs(a - target) ? b : a,
  );
}

/** The motif's pitch classes at a transposition. */
export const classesAt = (m: Motif, shift: number) => m.transpose(shift).classes;

/** Its classes at a transposition together with those at each step of its own path (the field it spans). */
export function fieldAt(m: Motif, shift: number, steps = m.size): number[] {
  const out = new Set<number>();
  m.path.slice(0, steps).forEach((p) => m.transpose(shift + p).classes.forEach((c) => out.add(c)));
  return [...out];
}

/** Rounded to a grid of beats (0.25: sixteenths). */
export const snap = (x: number, grid = 0.25) => Math.round(x / grid) * grid;

export interface Segment {
  at: number;
  dur: number;
  /** Semitones from the block's centre. */
  shift: number;
}

/**
 * The block cut where the motif's notes start, its rhythm stretched over the whole block, each
 * part a step along the motif's path: the harmony moves as the motif does, slowed to the block.
 */
export function pathSegments(m: Motif, length: number, grid = 1): Segment[] {
  const scale = length / Math.max(0.25, m.length);
  const starts = m.tones.map((t) => Math.min(length, snap(t.at * scale, grid)));
  return m.tones
    .map((_, i) => ({
      at: starts[i]!,
      dur: (i + 1 < starts.length ? starts[i + 1]! : length) - starts[i]!,
      shift: m.path[i]!,
    }))
    .filter((s) => s.dur > 0);
}

/**
 * Voices for a set of pitch classes, one per window (low to high): each keeps its pitch when its
 * class is still there, else moves to the nearest class not yet taken (then to any), so common
 * tones hold and the rest move least. `from` is where each voice was (undefined: none yet), and
 * `height` places a voice with no past in its window (0 bottom … 1 top).
 */
export function voiceLead(
  from: (number | undefined)[],
  classes: number[],
  windows: [number, number][],
  height = 0.5,
): number[] {
  const n = windows.length;
  const out: (number | undefined)[] = Array.from({ length: n }, () => undefined);
  const taken = new Set<number>();
  const used = new Set<number>();
  const inside = (p: number, w: [number, number]) => {
    let q = p;
    while (q < w[0]) q += 12;
    while (q > w[1]) q -= 12;
    return q < w[0] ? q + 12 : q;
  };
  // Where a voice aims: its last pitch, or a place in its window spread from low to high.
  const aim = windows.map((w, i) => {
    const f = from[i];
    if (f !== undefined) return f;
    const share = n > 1 ? i / (n - 1) : height;
    return w[0] + (w[1] - w[0]) * (0.25 + 0.5 * (0.5 * share + 0.5 * height));
  });
  // Common tones first: those held exactly where they were, then those moved by an octave into
  // their window.
  for (const exact of [true, false])
    windows.forEach((w, i) => {
      const f = from[i];
      if (f === undefined || out[i] !== undefined || !classes.includes(classOf(f))) return;
      const p = inside(f, w);
      if ((p === f) !== exact || used.has(p)) return;
      out[i] = p;
      taken.add(classOf(p));
      used.add(p);
    });
  for (let i = 0; i < n; i++) {
    if (out[i] !== undefined) continue;
    const w = windows[i]!;
    const free = classes.filter((c) => !taken.has(c));
    const pool = free.length ? free : classes;
    let best: number | undefined;
    for (const c of pool) {
      for (const cand of [-12, 0, 12].map((o) => nearestOfClass(c, aim[i]!) + o)) {
        const p = inside(cand, w);
        if (used.has(p)) continue;
        if (best === undefined || Math.abs(p - aim[i]!) < Math.abs(best - aim[i]!)) best = p;
      }
    }
    out[i] = best ?? inside(nearestOfClass(pool[0]!, aim[i]!), w);
    taken.add(classOf(out[i]!));
    used.add(out[i]!);
  }
  return out as number[];
}

/** Harp staves: the treble staff above middle C, the bass below. */
export const harpStaff = (p: Player, midi: number) =>
  p.instrument === "harp" || p.instrument === "piano" || p.instrument === "celesta"
    ? midi < 60
      ? 2
      : 1
    : undefined;

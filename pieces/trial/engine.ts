// What the trial piece's sections write with (pieces/trial/README.md).
//
// Time is counted in ticks, 60 to the quarter note (sketches/antara/between.ts): the atoms of the
// three families are whole numbers of ticks (2: a 16th = 15, 3: a triplet eighth = 20, 5: a
// quintuplet 16th = 12). Every time here is in ticks from the start of the piece; `Out` turns them
// into the node's own time when it writes.
//
// A line walks a set of pitch betweens from its standpoint (the anchor) and adds time betweens
// from its onset: note 0 is the anchor, each step adds one pitch between and one time between, and
// a cycle takes every between of the set once, in an order the section chooses. A set whose sum is
// 0 brings the line back to its anchor at the end of every cycle: its home.
//
// At a cut, a line stops just before an arrival (the first cycle end at or after the time it was
// asked to leave) and hands that arrival to the section on the other side, which sounds it as its
// own first note. What crosses is the relation (the pitch and the time the line has reached); what
// the next section changes is the rule.

import type { Articulation, NoteEvent, Time } from "../../src/score/types.ts";
import type { Writer } from "../../src/sketch/nest.ts";

export const TICKS = 60;
export type Family = 2 | 3 | 5;
export const ATOM: Record<Family, number> = { 2: 15, 3: 20, 5: 12 };

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Ticks as an exact time in quarters. */
export function quarters(ticks: number): Time {
  const t = Math.round(ticks);
  if (t % TICKS === 0) return t / TICKS;
  const g = gcd(Math.abs(t), TICKS);
  return [t / g, TICKS / g];
}

/** The grid of a pitch: 0 for the usual semitones, 1 for those a quarter tone off. */
export const gridOf = (m: number): number => Math.round(m * 2) % 2;

/** Seeded random numbers in [0, 1) (mulberry32). */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every order of the indices 0 … k−1. */
export function permutations(k: number): number[][] {
  if (k <= 1) return [[0]];
  const out: number[][] = [];
  for (const rest of permutations(k - 1))
    for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), k - 1, ...rest.slice(i)]);
  return out;
}

const key = (o: number[]) => o.join(",");

/**
 * Orders for lines reading one set: each call gives an order none of `taken` has (the other lines
 * at the same cycle) and that this line did not use in its last `memory` cycles.
 */
export class Orders {
  private readonly all: number[][];
  private readonly rand: () => number;
  private readonly recent = new Map<string, string[]>();
  private readonly memory: number;
  constructor(k: number, seed: number, memory = 6) {
    this.all = permutations(k);
    this.rand = random(seed);
    this.memory = memory;
  }
  next(line: string, taken: number[][] = []): number[] {
    return this.pick(line, this.all, taken);
  }

  /**
   * An order of `set` that keeps a line starting on `from` inside `range` (the instrument's edge
   * decides which orders are possible), or undefined when no order does.
   */
  fit(
    line: string,
    set: number[],
    from: number,
    range: [number, number],
    taken: number[][] = [],
  ): number[] | undefined {
    const inside = this.all.filter((o) => {
      let p = from;
      return o.every((i) => {
        p += set[i]!;
        return p >= range[0] && p <= range[1];
      });
    });
    return inside.length ? this.pick(line, inside, taken) : undefined;
  }

  private pick(line: string, among: number[][], taken: number[][]): number[] {
    const avoid = new Set([...(this.recent.get(line) ?? []), ...taken.map(key)]);
    const free = among.filter((o) => !avoid.has(key(o)));
    const pool = free.length ? free : among;
    const pick = pool[Math.floor(this.rand() * pool.length)]!;
    const list = [...(this.recent.get(line) ?? []), key(pick)].slice(-this.memory);
    this.recent.set(line, list);
    return pick;
  }
}

/**
 * Where each instrument's lines may go (sounding): its range, kept inside what BBC SO has samples
 * for, so the preview sounds every note (src/libraries/bbcso/inventory.json).
 */
export const PLAYABLE: Record<string, [number, number]> = {
  flute: [60, 96],
  piccolo: [74, 106],
  oboe: [58, 90],
  "cor-anglais": [52, 81],
  clarinet: [50, 88],
  "bass-clarinet": [34, 76],
  bassoon: [34, 74],
  contrabassoon: [22, 53],
  horn: [34, 77],
  trumpet: [52, 84],
  trombone: [40, 72],
  "bass-trombone": [28, 67],
  tuba: [26, 63],
  "violins-1": [55, 97],
  "violins-2": [55, 97],
  violas: [48, 90],
  cellos: [36, 82],
  basses: [28, 54],
};

/** Writes in piece ticks into a node that starts at `offset` ticks. */
export class Out {
  readonly w: Writer;
  readonly offset: number;
  constructor(w: Writer, offset: number) {
    this.w = w;
    this.offset = offset;
  }
  private t = (ticks: number) => quarters(ticks - this.offset);
  note(
    player: string,
    at: number,
    dur: number,
    pitch: number | number[] | undefined,
    extra: Partial<NoteEvent> = {},
  ): void {
    if (dur <= 0) return;
    const pitches = pitch === undefined ? undefined : Array.isArray(pitch) ? pitch : [pitch];
    this.w.note(player, {
      at: this.t(at),
      dur: quarters(dur),
      ...(pitches
        ? {
            pitch: pitches.length === 1 ? { midi: pitches[0]! } : pitches.map((m) => ({ midi: m })),
          }
        : {}),
      ...extra,
    });
  }
  dyn(player: string, at: number, level: number, ramp = false): void {
    this.w.dynamic(player, (at - this.offset) / TICKS, level, ramp ? "linear" : undefined);
  }
  text(player: string, at: number, text: string, placement?: "above" | "below"): void {
    this.w.text(player, (at - this.offset) / TICKS, text, placement);
  }
  mark(at: number, label: string): void {
    this.w.mark((at - this.offset) / TICKS, label);
  }
}

/** One cycle of a line: the betweens in the order they are taken, and how the cycle sounds. */
export interface Cycle {
  pitch: number[];
  time: number[];
  family: Family;
  /** Atoms of silence after the home note sounds its between (a breath: an unsounded between). */
  breath?: number;
  /** Ticks of silence before the cycle's first step (waiting, to meet another line). */
  wait?: number;
  /** The whole cycle unsounded: its time passes, nothing is played. */
  silent?: boolean;
  /** The home note that starts the cycle unsounded (the line is there, but does not say it). */
  quietHome?: boolean;
  /** The home note holds through the breath and the wait instead of falling silent. */
  hold?: boolean;
  /** Share of each between a note sounds (1: legato to the next). Default 1. */
  length?: number;
  articulation?: Articulation;
  technique?: string;
}

export interface LineNote {
  at: number;
  pitch: number;
  /** Ticks it sounds. */
  dur: number;
  /** Index in its cycle: 0 the home it starts from, k the arrival. */
  step: number;
  cycle: number;
  sounded: boolean;
  slur: boolean;
  articulation?: Articulation;
  technique?: string;
}

export interface Walk {
  notes: LineNote[];
  /** The arrival it stopped before (not written): the next section's first note. */
  end: { at: number; pitch: number };
  /** The time of every cycle end (arrival) it passed, the last one included. */
  arrivals: number[];
}

interface Raw {
  at: number;
  pitch: number;
  step: number;
  cycle: number;
  /** For a home: the cycle it starts. For the others: their own. */
  spec: Cycle | undefined;
  home: boolean;
  /** For a home: whether the cycle that brought the line there sounded. */
  arrived: boolean;
  gapAfter: number;
}

export interface WalkOptions {
  anchor: number;
  start: number;
  /** Stop before the first arrival at or after this. */
  until: number;
  /** Whether note 0 (the anchor at `start`) is sounded here. */
  first: boolean;
  /** Each cycle, knowing where the line is (or "stop"). */
  cycle: (c: number, at: number, pitch: number, self: Walker) => Cycle | "stop";
}

/**
 * A line walked one cycle at a time (so several can be walked side by side, each looking at the
 * others). A home (the note a cycle starts from) sounds when the cycle before it or the cycle it
 * starts sounds: a phrase always ends on its arrival, and a line comes back in on its home.
 */
export class Walker {
  t: number;
  p: number;
  c = 0;
  done = false;
  /** The cycle being walked: when it started and ends, and whether it sounds. */
  span = { from: 0, to: 0, sounded: false };
  /** The family of the cycle walked last. */
  private family: Family | undefined;
  private readonly raw: Raw[];
  private readonly start: Raw;
  private readonly o: WalkOptions;
  readonly arrivals: number[] = [];

  constructor(o: WalkOptions) {
    this.o = o;
    this.t = o.start;
    this.p = o.anchor;
    this.start = {
      at: o.start,
      pitch: o.anchor,
      step: 0,
      cycle: 0,
      spec: undefined,
      home: true,
      arrived: o.first,
      gapAfter: 0,
    };
    this.raw = [this.start];
    this.span = { from: o.start, to: o.start, sounded: o.first };
  }

  /** Walks one more cycle; false when the line has stopped. */
  step(): boolean {
    if (this.done) return false;
    const spec = this.o.cycle(this.c, this.t, this.p, this);
    if (spec === "stop") {
      this.done = true;
      return false;
    }
    const atom = ATOM[spec.family];
    if (spec.pitch.length !== spec.time.length)
      throw new Error(`walk: a cycle needs as many time betweens as pitch betweens`);
    const home = this.raw[this.raw.length - 1]!;
    home.spec = spec;
    home.home = true;
    // A line takes up another family only where every family's grid meets (a beat), and a line
    // that comes in on a note off its own grid holds that note until the next beat.
    let wait = spec.wait;
    let hold = spec.hold ?? false;
    if (
      wait === undefined &&
      (this.t % atom !== 0 || (this.family !== undefined && this.family !== spec.family))
    ) {
      wait = nextBeat(this.t) - this.t;
      hold = true;
    }
    this.family = spec.family;
    const gap = (spec.breath ?? 0) * atom + (wait ?? 0);
    home.gapAfter = hold ? 0 : gap;
    const from = this.t;
    spec.pitch.forEach((b, j) => {
      this.t += spec.time[j]! * atom + (j === 0 ? gap : 0);
      this.p += b;
      this.raw.push({
        at: this.t,
        pitch: this.p,
        step: j + 1,
        cycle: this.c,
        spec,
        home: false,
        arrived: !spec.silent,
        gapAfter: 0,
      });
    });
    this.span = { from, to: this.t, sounded: !spec.silent };
    this.arrivals.push(this.t);
    this.c++;
    if (this.t >= this.o.until) this.done = true;
    return !this.done;
  }

  result(): Walk {
    const raw = [...this.raw];
    const last = raw.pop()!;
    const notes: LineNote[] = raw.map((r, i) => {
      const next = raw[i + 1]?.at ?? last.at;
      const between = next - r.at - r.gapAfter;
      const spec = r.spec;
      // A home sounds its whole between; the other notes the cycle's share of theirs, in whole
      // atoms (so a detached note ends on its own grid, never between two grids).
      const share = r.home ? 1 : (spec?.length ?? 1);
      const atom = spec ? ATOM[spec.family] : 1;
      const sounding =
        share >= 1 ? between : Math.max(atom, Math.floor((between * share) / atom + 1e-9) * atom);
      const k = spec?.pitch.length ?? 0;
      const sounded = r.home
        ? r === this.start && !this.o.first
          ? false
          : !spec?.quietHome && (r.arrived || !spec?.silent)
        : !spec?.silent;
      return {
        at: r.at,
        pitch: r.pitch,
        dur: Math.max(1, Math.round(sounding)),
        step: r.home ? 0 : r.step,
        cycle: r.home && r !== this.start ? r.cycle + 1 : r.cycle,
        sounded,
        // A phrase is a cycle: slurred from its first step to its arrival.
        slur: !r.home && r.step < k && share >= 1,
        ...(spec?.articulation ? { articulation: spec.articulation } : {}),
        ...(spec?.technique ? { technique: spec.technique } : {}),
      };
    });
    return { notes, end: { at: last.at, pitch: last.pitch }, arrivals: [...this.arrivals] };
  }
}

/** Walks a line on its own. */
export function walk(o: WalkOptions): Walk {
  const w = new Walker(o);
  while (w.step());
  return w.result();
}

/** Walks lines side by side: always the one furthest behind next, so each sees the others' present. */
export function walkTogether(walkers: Walker[]): void {
  for (;;) {
    const open = walkers.filter((w) => !w.done);
    if (!open.length) return;
    const behind = open.reduce((a, b) => (b.t < a.t ? b : a));
    behind.step();
  }
}

/** How many of `walks` have a sounded note at `t`. */
export const soundingIn = (walks: Walk[], t: number): number =>
  walks.filter((w) => w.notes.some((n) => n.sounded && n.at <= t && t < n.at + n.dur)).length;

/** How many of `walkers` (other than `self`) are in a sounding cycle at `t`. */
export const soundingAt = (walkers: Walker[], t: number, self?: Walker): number =>
  walkers.filter((w) => w !== self && w.span.sounded && w.span.from <= t && t < w.span.to).length;

/**
 * Levels for a line, one swell per phrase: `home` on its standpoint, and at the note furthest from
 * it `slope` more for every semitone of distance (up to `top`). The phrase grows to that note and
 * falls back to its arrival. `scale` multiplies the levels (a section's own rise and fall).
 */
export function distanceDynamics(
  out: Out,
  player: string,
  notes: LineNote[],
  anchor: (n: LineNote) => number,
  o: { home: number; slope: number; top: number; scale?: (at: number) => number },
): void {
  const at = (n: LineNote, level: number) => Math.min(o.top, level * (o.scale ? o.scale(n.at) : 1));
  // A phrase: a cycle's steps and the home it arrives at. A home heard on its own stands alone.
  const phrases: LineNote[][] = [];
  let open: LineNote[] | undefined;
  for (const n of notes) {
    if (!n.sounded) {
      open = undefined;
      continue;
    }
    if (n.step === 0) {
      if (open) open.push(n);
      else phrases.push([n]);
      open = undefined;
    } else {
      if (!open) phrases.push((open = []));
      open.push(n);
    }
  }
  for (const phrase of phrases) {
    const head = phrase[0]!;
    const moving = phrase.filter((n) => n.step > 0);
    if (!moving.length) {
      out.dyn(player, head.at, at(head, o.home));
      continue;
    }
    const far = moving.reduce((a, b) =>
      Math.abs(b.pitch - anchor(b)) > Math.abs(a.pitch - anchor(a)) ? b : a,
    );
    const peak = o.home + o.slope * Math.abs(far.pitch - anchor(far));
    const last = phrase[phrase.length - 1]!;
    // From the home level up to the furthest note, then back down to the arrival.
    if (far !== head) out.dyn(player, head.at, at(head, o.home), true);
    out.dyn(player, far.at, at(far, peak), far !== last);
    if (last !== far) out.dyn(player, last.at, at(last, o.home));
  }
}

/** Writes a walked line's sounded notes. */
export function writeNotes(
  out: Out,
  player: string,
  notes: LineNote[],
  extra: Partial<NoteEvent> = {},
): void {
  notes.forEach((n, i) => {
    if (!n.sounded) return;
    const next = notes[i + 1];
    const slur = n.slur && !!next?.sounded;
    out.note(player, n.at, n.dur, n.pitch, {
      ...(slur ? { slur: true } : {}),
      ...(n.articulation ? { articulations: [n.articulation] } : {}),
      ...(n.technique ? { technique: n.technique } : {}),
      ...extra,
    });
  });
}

/** A slide from `from` at `t0` to `to` at `t1`, with `tail` ticks on the last pitch. */
export function glide(
  out: Out,
  player: string,
  t0: number,
  t1: number,
  from: number,
  to: number,
  tail: number,
  extra: Partial<NoteEvent> = {},
): void {
  out.note(player, t0, t1 - t0, from, { gliss: true, ...extra });
  out.note(player, t1, tail, to, extra);
}

/** The pitch a line reaches after each between of an order: its partial sums from 0. */
export const partials = (betweens: number[]): number[] => {
  let s = 0;
  return betweens.map((b) => (s += b));
};

/** The betweens of `set` in `order`. */
export const inOrder = (set: number[], order: number[]): number[] => order.map((i) => set[i]!);

/** The next tick on a family's grid at or after `t` (a family starts only where its grid is). */
export function onGrid(t: number, family: Family): number {
  const a = ATOM[family];
  return Math.ceil(t / a - 1e-9) * a;
}

/** The next beat at or after `t`: where every family's grid meets. */
export const nextBeat = (t: number): number => Math.ceil(t / TICKS - 1e-9) * TICKS;

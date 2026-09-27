// Knobs: the values a sketch lets 余湖さん change from the preview (docs/architecture.md, sketches).
//
// A sketch is a folder in sketches/ with
// - sketch.ts: `export const knobs = { … }` (made with the builders below) and
//   `export function score(values): Score`
// - values.json: the values in use, the ones saved under names, and which knobs have been touched
//   (written by the preview; kept in git)
// - <folder>.json: the score, written by run.ts from sketch.ts and values.json
//
// A knob's `value` is the value Claude put there; until someone changes it in the preview the
// panel marks it provisional. Knobs carry intent: each one is a musical decision about the idea,
// named and grouped as such, not every number the code happens to use.
//
// The controls are reusable: the same kinds serve every sketch (src/preview/knobs/ draws them).

import { parsePitch } from "../score/pitch.ts";

/** What every knob has. Knobs with the same `group`, written one after another, are shown together. */
interface KnobBase {
  label: string;
  /** Why the knob is there: what it changes in the music (shown on hover). */
  help?: string;
  group?: string;
}

/** A number: dragged sideways, stepped with arrows, or typed. */
export interface NumberKnob extends KnobBase {
  kind: "number";
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  follow?: false;
}

/**
 * A number that may also move over time: follow one of the piece's flows (src/sketch/nest.ts),
 * or ramp from one value to another over the node's own length. Read it at a time with
 * `ctx.value(v.name, t)`.
 */
export interface FollowKnob extends KnobBase {
  kind: "number";
  value: Auto;
  min: number;
  max: number;
  step: number;
  unit?: string;
  follow: true;
}

/** A follow knob's value when it moves: `follow` is a flow's name, or "ramp" (over the node). */
export interface Follow {
  follow: string;
  from: number;
  to: number;
}
export type Auto = number | Follow;
export const isFollow = (v: unknown): v is Follow =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as Follow).follow === "string" &&
  isNumber((v as Follow).from) &&
  isNumber((v as Follow).to);

/** One of a few options. */
export interface ChoiceKnob extends KnobBase {
  kind: "choice";
  value: string;
  options: string[];
}

/** Free text the sketch reads itself (see numbersOf / pitchOf below). */
export interface TextKnob extends KnobBase {
  kind: "text";
  value: string;
  hint?: string;
}

/** On or off. */
export interface ToggleKnob extends KnobBase {
  kind: "toggle";
  value: boolean;
}

/** A pitch, as MIDI on the quarter-tone grid, shown by name ("E+4"). */
export interface PitchKnob extends KnobBase {
  kind: "pitch";
  value: number;
  min: number;
  max: number;
  /** 1 (semitones) or 0.5 (quarter tones). */
  step: number;
}

/** A low and a high number. */
export interface RangeKnob extends KnobBase {
  kind: "range";
  value: [number, number];
  min: number;
  max: number;
  step: number;
  unit?: string;
}

/** A low and a high pitch (MIDI). */
export interface PitchRangeKnob extends KnobBase {
  kind: "pitch-range";
  value: [number, number];
  min: number;
  max: number;
  step: number;
}

/** A shape drawn freehand: `value[i]` is the height (0–1) at time i / (length − 1). */
export interface CurveKnob extends KnobBase {
  kind: "curve";
  value: number[];
  /** What 0 and 1 mean, e.g. ["sparse", "dense"]. */
  ends?: [string, string];
}

/** A shape as breakpoints [time 0–1, height 0–1], joined by straight lines. The first is at 0, the last at 1. */
export interface EnvelopeKnob extends KnobBase {
  kind: "envelope";
  value: [number, number][];
  ends?: [string, string];
  /**
   * Names of equal parts of the time axis, drawn as guides: a shape over a piece's sections, each
   * drawn the same width whatever its length (src/sketch/nest.ts, formCurve).
   */
  guides?: string[];
}

/** Pitch classes, in semitones above a reference (0–11.5), on a clock of 12 or 24 steps. */
export interface PitchSetKnob extends KnobBase {
  kind: "pitch-set";
  value: number[];
  divisions: 12 | 24;
}

/** Partials of a harmonic series, by number (1 = the fundamental). */
export interface PartialsKnob extends KnobBase {
  kind: "partials";
  value: number[];
  count: number;
  /** A pitch knob of the same sketch: the panel names each partial from it. */
  fundamental?: string;
}

/** How likely (or how strong) each of a few things is, 0–1 each. */
export interface WeightsKnob extends KnobBase {
  kind: "weights";
  value: number[];
  labels: string[];
}

/** Rows of steps, each on or off. */
export interface StepsKnob extends KnobBase {
  kind: "steps";
  value: boolean[][];
  rows: string[];
  steps: number;
}

/** A whole divided into named parts, in whole units (bars, beats). The total stays as it is. */
export interface ProportionsKnob extends KnobBase {
  kind: "proportions";
  value: number[];
  labels: string[];
  unit?: string;
}

/** A point on a plane, 0–1 on each axis. */
export interface XYKnob extends KnobBase {
  kind: "xy";
  value: [number, number];
  axes: [string, string];
}

/** A seed for random choices: the same seed gives the same result. */
export interface SeedKnob extends KnobBase {
  kind: "seed";
  value: number;
}

/** Marks on a timeline of `length` units (bars, beats): section boundaries, events. */
export interface MarkersKnob extends KnobBase {
  kind: "markers";
  /** Positions, in units from the start (0 < p < length). */
  value: number[];
  length: number;
  unit?: string;
}

/** A pitch-class set (0–11), chosen by its interval vector: set the vector, pick a matching set. */
export interface VectorSetKnob extends KnobBase {
  kind: "vector-set";
  value: number[];
}

/** Nodes of a two-dimensional pitch lattice: [x, y] steps from the centre, x steps of axes[0]
 * semitones and y steps of axes[1] (e.g. fifths across, major thirds up). */
export interface LatticeKnob extends KnobBase {
  kind: "lattice";
  value: [number, number][];
  axes: [number, number];
  /** Columns and rows shown. */
  size: [number, number];
  /** A pitch knob of the same sketch: the centre, used to name the nodes. */
  centre?: string;
}

/** A field painted 0–1: rows (listed top to bottom) against time (columns). */
export interface HeatmapKnob extends KnobBase {
  kind: "heatmap";
  value: number[][];
  rows: string[];
  columns: number;
}

/** A band over time, cut into segments, each one of a few options (techniques, colours). */
export interface LanesKnob extends KnobBase {
  kind: "lanes";
  /** Segments as [start in units, option]; the first starts at 0. */
  value: [number, string][];
  options: string[];
  length: number;
  unit?: string;
}

/** A short melody: notes as [start, length, pitch] (quarters, quarters, MIDI on the quarter-tone grid). */
export interface MotifKnob extends KnobBase {
  kind: "motif";
  value: [number, number, number][];
  /** Lowest and highest pitch shown (MIDI). */
  range: [number, number];
  /** Quarters shown. */
  length: number;
  /** Where starts and lengths snap, in quarters. */
  grid: number;
  /** 1 (semitones) or 0.5 (quarter tones). */
  step: number;
}

export type Knob =
  | NumberKnob
  | FollowKnob
  | MotifKnob
  | ChoiceKnob
  | TextKnob
  | ToggleKnob
  | PitchKnob
  | RangeKnob
  | PitchRangeKnob
  | CurveKnob
  | EnvelopeKnob
  | PitchSetKnob
  | PartialsKnob
  | WeightsKnob
  | StepsKnob
  | ProportionsKnob
  | XYKnob
  | SeedKnob
  | MarkersKnob
  | VectorSetKnob
  | LatticeKnob
  | HeatmapKnob
  | LanesKnob;
export type Knobs = Record<string, Knob>;
export type Values<K extends Knobs> = { [N in keyof K]: K[N]["value"] };
export type Value = Knob["value"];

type Spec<K extends Knob> = Omit<K, "kind">;
const midi = (p: number | string) => (typeof p === "number" ? p : parsePitch(p).midi);

/** With `follow: true`, the value may follow a flow or ramp (FollowKnob). */
export function number(k: Spec<FollowKnob>): FollowKnob;
export function number(k: Spec<NumberKnob>): NumberKnob;
export function number(k: Spec<NumberKnob> | Spec<FollowKnob>): NumberKnob | FollowKnob {
  return { kind: "number", ...k } as NumberKnob | FollowKnob;
}
export const choice = (k: Spec<ChoiceKnob>): ChoiceKnob => ({ kind: "choice", ...k });
export const text = (k: Spec<TextKnob>): TextKnob => ({ kind: "text", ...k });
export const toggle = (k: Spec<ToggleKnob>): ToggleKnob => ({ kind: "toggle", ...k });
/** Pitches may be written by name ("D3", "E+4"). */
export const pitch = (
  k: Omit<Spec<PitchKnob>, "value" | "min" | "max" | "step"> & {
    value: number | string;
    min?: number | string;
    max?: number | string;
    step?: number;
  },
): PitchKnob => ({
  ...k,
  kind: "pitch",
  value: midi(k.value),
  min: midi(k.min ?? "C0"),
  max: midi(k.max ?? "C8"),
  step: k.step ?? 1,
});
export const range = (k: Spec<RangeKnob>): RangeKnob => ({ kind: "range", ...k });
export const pitchRange = (
  k: Omit<Spec<PitchRangeKnob>, "value" | "min" | "max" | "step"> & {
    value: [number | string, number | string];
    min?: number | string;
    max?: number | string;
    step?: number;
  },
): PitchRangeKnob => ({
  ...k,
  kind: "pitch-range",
  value: [midi(k.value[0]), midi(k.value[1])],
  min: midi(k.min ?? "C0"),
  max: midi(k.max ?? "C8"),
  step: k.step ?? 1,
});
/** `value` may be a function of time 0–1, sampled at `points` places (default 48). */
export const curve = (
  k: Omit<Spec<CurveKnob>, "value"> & {
    value: number[] | ((t: number) => number);
    points?: number;
  },
): CurveKnob => {
  const { points = 48, value, ...rest } = k;
  return {
    ...rest,
    kind: "curve",
    value:
      typeof value === "function"
        ? Array.from({ length: points }, (_, i) => clamp01(value(i / (points - 1))))
        : value,
  };
};
export const envelope = (k: Spec<EnvelopeKnob>): EnvelopeKnob => ({ kind: "envelope", ...k });
export const pitchSet = (k: Spec<PitchSetKnob>): PitchSetKnob => ({ kind: "pitch-set", ...k });
export const partials = (k: Spec<PartialsKnob>): PartialsKnob => ({ kind: "partials", ...k });
export const weights = (k: Spec<WeightsKnob>): WeightsKnob => ({ kind: "weights", ...k });
/** Rows may be written as strings: "x...x...", x for on. */
export const steps = (
  k: Omit<Spec<StepsKnob>, "value" | "steps"> & { value: string[] | boolean[][] },
): StepsKnob => {
  const value = k.value.map((r) => (typeof r === "string" ? r.split("").map((c) => c === "x") : r));
  return { ...k, kind: "steps", value, steps: value[0]?.length ?? 16 };
};
export const proportions = (k: Spec<ProportionsKnob>): ProportionsKnob => ({
  kind: "proportions",
  ...k,
});
export const xy = (k: Spec<XYKnob>): XYKnob => ({ kind: "xy", ...k });
export const seed = (k: Spec<SeedKnob>): SeedKnob => ({ kind: "seed", ...k });
export const markers = (k: Spec<MarkersKnob>): MarkersKnob => ({ kind: "markers", ...k });
export const vectorSet = (k: Spec<VectorSetKnob>): VectorSetKnob => ({ kind: "vector-set", ...k });
export const lattice = (k: Spec<LatticeKnob>): LatticeKnob => ({ kind: "lattice", ...k });
/** `value` may be a function of (row from the top 0–1, time 0–1). */
export const heatmap = (
  k: Omit<Spec<HeatmapKnob>, "value"> & {
    value: number[][] | ((row: number, t: number) => number);
  },
): HeatmapKnob => {
  const { value, ...rest } = k;
  const n = k.rows.length;
  return {
    ...rest,
    kind: "heatmap",
    value:
      typeof value === "function"
        ? Array.from({ length: n }, (_, r) =>
            Array.from(
              { length: k.columns },
              (_, c) =>
                Math.round(
                  clamp01(value(n > 1 ? r / (n - 1) : 0, k.columns > 1 ? c / (k.columns - 1) : 0)) *
                    4,
                ) / 4,
            ),
          )
        : value,
  };
};
export const lanes = (k: Spec<LanesKnob>): LanesKnob => ({ kind: "lanes", ...k });
/**
 * `value` may be written as notes one after another, "pitch:length" in quarters, with "r:length"
 * for a rest: "D4:0.5 Eb4:0.5 Ab4:1.5 G4:1.5".
 */
export const motif = (
  k: Omit<Spec<MotifKnob>, "value" | "range" | "length" | "grid" | "step"> & {
    value: string | [number, number, number][];
    range?: [number | string, number | string];
    length?: number;
    grid?: number;
    step?: number;
  },
): MotifKnob => {
  let value: [number, number, number][];
  if (typeof k.value === "string") {
    value = [];
    let t = 0;
    for (const word of k.value.trim().split(/\s+/)) {
      const [p, d] = word.split(":");
      const dur = Number(d ?? "1");
      if (p !== "r") value.push([t, dur, midi(p!)]);
      t += dur;
    }
  } else value = k.value;
  const end = Math.max(0, ...value.map(([at, dur]) => at + dur));
  return {
    ...k,
    kind: "motif",
    value,
    range: [midi(k.range?.[0] ?? "C4"), midi(k.range?.[1] ?? "C6")],
    length: k.length ?? Math.max(4, Math.ceil(end + 2)),
    grid: k.grid ?? 0.25,
    step: k.step ?? 1,
  };
};

//==============================================================================
// Stored values

/** What values.json holds. */
export interface Stored {
  values: Record<string, unknown>;
  presets: Record<string, Record<string, unknown>>;
  /** Knobs changed from the preview at least once (the rest are still Claude's). */
  touched: string[];
}

export const emptyStored = (): Stored => ({ values: {}, presets: {}, touched: [] });

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const numbers = (v: unknown, length?: number): v is number[] =>
  Array.isArray(v) && v.every(isNumber) && (length === undefined || v.length === length);

/** Whether a stored value still fits the knob (the knob may have changed since it was stored). */
export function fits(k: Knob, v: unknown): boolean {
  switch (k.kind) {
    case "number":
      return isNumber(v) || (k.follow === true && isFollow(v));
    case "pitch":
    case "seed":
      return isNumber(v);
    case "motif":
      return (
        Array.isArray(v) &&
        v.length >= 1 &&
        v.every((n) => numbers(n, 3) && (n as number[])[0]! >= 0 && (n as number[])[1]! > 0)
      );
    case "choice":
      return typeof v === "string" && k.options.includes(v);
    case "text":
      return typeof v === "string";
    case "toggle":
      return typeof v === "boolean";
    case "range":
    case "pitch-range":
    case "xy":
      return numbers(v, 2);
    case "curve":
      return numbers(v) && v.length >= 2;
    case "envelope":
      return Array.isArray(v) && v.length >= 2 && v.every((p) => numbers(p, 2));
    case "pitch-set":
    case "partials":
      return numbers(v);
    case "weights":
      return numbers(v, k.labels.length);
    case "proportions":
      return numbers(v, k.labels.length);
    case "markers":
      return numbers(v) && v.every((p) => p > 0 && p < k.length);
    case "vector-set":
      return numbers(v) && v.every((p) => Number.isInteger(p) && p >= 0 && p < 12);
    case "lattice":
      return Array.isArray(v) && v.every((p) => numbers(p, 2));
    case "heatmap":
      return (
        Array.isArray(v) && v.length === k.rows.length && v.every((r) => numbers(r, k.columns))
      );
    case "lanes":
      return (
        Array.isArray(v) &&
        v.length >= 1 &&
        v.every(
          (s) =>
            Array.isArray(s) &&
            s.length === 2 &&
            isNumber(s[0]) &&
            typeof s[1] === "string" &&
            k.options.includes(s[1]),
        ) &&
        (v[0] as [number, string])[0] === 0
      );
    case "steps":
      return (
        Array.isArray(v) &&
        v.length === k.rows.length &&
        v.every(
          (r) => Array.isArray(r) && r.length === k.steps && r.every((c) => typeof c === "boolean"),
        )
      );
  }
}

/** The knobs' own values, overridden by stored ones that still fit the knob. */
export function resolveValues(
  knobs: Knobs,
  stored: Record<string, unknown>,
): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const [name, k] of Object.entries(knobs))
    out[name] = fits(k, stored[name]) ? (stored[name] as Value) : k.value;
  return out;
}

//==============================================================================
// Reading values, for sketches

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** "D3", "E+4", "Bb-3" → MIDI on the quarter-tone grid. */
export function pitchOf(label: string, value: string): number {
  try {
    return parsePitch(value).midi;
  } catch {
    throw new Error(`${label}: cannot read "${value}" as a pitch (e.g. C4, F#3, E+4, Bb-3)`);
  }
}

/** "0 1 0 3", "0, 1.5, -2" → numbers. At least one. */
export function numbersOf(label: string, value: string): number[] {
  const words = value.split(/[\s,、]+/).filter(Boolean);
  const out = words.map(Number);
  if (out.length === 0 || out.some((n) => !Number.isFinite(n)))
    throw new Error(`${label}: cannot read "${value}" as numbers (e.g. 0 1 3 4)`);
  return out;
}

/** A curve's height at time t (0–1), between its samples. */
export function curveAt(curve: number[], t: number): number {
  const x = clamp01(t) * (curve.length - 1);
  const i = Math.min(curve.length - 2, Math.floor(x));
  return curve[i]! + (curve[i + 1]! - curve[i]!) * (x - i);
}

/** An envelope's height at time t (0–1). */
export function envelopeAt(points: [number, number][], t: number): number {
  const p = [...points].sort((a, b) => a[0] - b[0]);
  if (t <= p[0]![0]) return p[0]![1];
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1]!;
    const [x1, y1] = p[i]!;
    if (t <= x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (t - x0)) / (x1 - x0);
  }
  return p.at(-1)![1];
}

/** A random number generator (0 ≤ x < 1) that gives the same numbers for the same seed. */
export function random(seed: number): () => number {
  let a = Math.floor(seed) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An index picked with the given weights (all zero: none, -1). */
export function pick(weightsOf: number[], r: number): number {
  const total = weightsOf.reduce((a, b) => a + b, 0);
  if (total <= 0) return -1;
  let x = r * total;
  for (let i = 0; i < weightsOf.length; i++) if ((x -= weightsOf[i]!) < 0) return i;
  return weightsOf.length - 1;
}

/** The pitch (MIDI, rounded to the quarter-tone grid) of a partial over a fundamental. */
export function partialPitch(fundamental: number, n: number): number {
  return Math.round((fundamental + 12 * Math.log2(n)) * 2) / 2;
}

/** A lattice node's pitch: the centre plus x steps of axes[0] and y steps of axes[1]. */
export function latticePitch(
  centre: number,
  node: [number, number],
  axes: [number, number],
): number {
  return centre + node[0] * axes[0] + node[1] * axes[1];
}

/** Which lane segment is in force at a time (in the lane's units). */
export function laneAt(segments: [number, string][], at: number): string {
  let current = segments[0]![1];
  for (const [start, option] of [...segments].sort((a, b) => a[0] - b[0]))
    if (start <= at) current = option;
  return current;
}

/** Interval-class vector of a pitch-class set (integers 0–11). */
export function intervalVector(set: number[]): number[] {
  const v = [0, 0, 0, 0, 0, 0];
  const pcs = [...new Set(set.map((p) => ((p % 12) + 12) % 12))];
  for (let i = 0; i < pcs.length; i++)
    for (let j = i + 1; j < pcs.length; j++) {
      const d = (pcs[j]! - pcs[i]! + 12) % 12;
      const ic = Math.min(d, 12 - d);
      if (ic) v[ic - 1]!++;
    }
  return v;
}

/** Prime form (transposition and inversion) of a pitch-class set: the most compact, packed to the left. */
export function primeForm(set: number[]): number[] {
  const pcs = [...new Set(set.map((p) => ((p % 12) + 12) % 12))].sort((a, b) => a - b);
  if (pcs.length === 0) return [];
  let best: number[] | undefined;
  const better = (a: number[], b: number[]) => {
    // Smaller span first, then smaller intervals from the left.
    if (a.at(-1)! !== b.at(-1)!) return a.at(-1)! < b.at(-1)!;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!;
    return false;
  };
  for (const form of [pcs, pcs.map((p) => (12 - p) % 12)])
    for (const t of form) {
      const candidate = form.map((p) => (p - t + 12) % 12).sort((a, b) => a - b);
      if (!best || better(candidate, best)) best = candidate;
    }
  return best!;
}

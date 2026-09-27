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
}

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

export type Knob =
  | NumberKnob
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
  | SeedKnob;
export type Knobs = Record<string, Knob>;
export type Values<K extends Knobs> = { [N in keyof K]: K[N]["value"] };
export type Value = Knob["value"];

type Spec<K extends Knob> = Omit<K, "kind">;
const midi = (p: number | string) => (typeof p === "number" ? p : parsePitch(p).midi);

export const number = (k: Spec<NumberKnob>): NumberKnob => ({ kind: "number", ...k });
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
    case "pitch":
    case "seed":
      return isNumber(v);
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

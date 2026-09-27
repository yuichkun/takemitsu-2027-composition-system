// Knobs: the values a sketch lets 余湖さん change from the preview (docs/architecture.md, sketches).
//
// A sketch is a folder in sketches/ with
// - sketch.ts: `export const knobs = { … }` (made with number / choice / text below) and
//   `export function score(values): Score`
// - values.json: the values in use, the ones saved under names, and which knobs have been touched
//   (written by the preview; kept in git)
// - <folder>.json: the score, written by run.ts from sketch.ts and values.json
//
// A knob's `value` is the value Claude put there; until someone changes it in the preview the
// panel marks it 仮 (provisional).

import { parsePitch } from "../score/pitch.ts";

export interface NumberKnob {
  kind: "number";
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

export interface ChoiceKnob {
  kind: "choice";
  label: string;
  value: string;
  options: string[];
}

/** Free text: a pitch ("D3", "E+4"), a list of numbers, … The sketch reads it (see below). */
export interface TextKnob {
  kind: "text";
  label: string;
  value: string;
  hint?: string;
}

export type Knob = NumberKnob | ChoiceKnob | TextKnob;
export type Knobs = Record<string, Knob>;
export type Values<K extends Knobs> = {
  [N in keyof K]: K[N] extends NumberKnob ? number : string;
};

export const number = (k: Omit<NumberKnob, "kind">): NumberKnob => ({ kind: "number", ...k });
export const choice = (k: Omit<ChoiceKnob, "kind">): ChoiceKnob => ({ kind: "choice", ...k });
export const text = (k: Omit<TextKnob, "kind">): TextKnob => ({ kind: "text", ...k });

/** What values.json holds. */
export interface Stored {
  values: Record<string, number | string>;
  presets: Record<string, Record<string, number | string>>;
  /** Knobs changed from the preview at least once (the rest are still Claude's 仮). */
  touched: string[];
}

export const emptyStored = (): Stored => ({ values: {}, presets: {}, touched: [] });

/** The knobs' own values, overridden by stored ones that still fit the knob. */
export function resolveValues(
  knobs: Knobs,
  stored: Record<string, unknown>,
): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const [name, k] of Object.entries(knobs)) {
    const v = stored[name];
    if (k.kind === "number") out[name] = typeof v === "number" && Number.isFinite(v) ? v : k.value;
    else if (k.kind === "choice")
      out[name] = typeof v === "string" && k.options.includes(v) ? v : k.value;
    else out[name] = typeof v === "string" ? v : k.value;
  }
  return out;
}

//==============================================================================
// Reading text knobs, for sketches

/** "D3", "E+4", "Bb-3" → MIDI on the quarter-tone grid. */
export function pitchOf(label: string, value: string): number {
  try {
    return parsePitch(value).midi;
  } catch {
    throw new Error(`${label}: 「${value}」は音高として読めない（例: C4、F#3、E+4、Bb-3）`);
  }
}

/** "0 1 0 3", "0, 1.5, -2" → numbers. At least one. */
export function numbersOf(label: string, value: string): number[] {
  const words = value.split(/[\s,、]+/).filter(Boolean);
  const out = words.map(Number);
  if (out.length === 0 || out.some((n) => !Number.isFinite(n)))
    throw new Error(`${label}: 「${value}」は数の並びとして読めない（例: 0 1 0 3）`);
  return out;
}

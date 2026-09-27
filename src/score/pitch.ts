// Pitch parsing and spelling on the quarter-tone grid (docs/decisions/0013).

import type { Pitch, Step } from "./types.ts";

export interface Spelled {
  step: Step;
  /** Semitones, a multiple of 0.5. */
  alter: number;
  octave: number;
  /** Sounding MIDI number, a multiple of 0.5. */
  midi: number;
}

const steps: Step[] = ["C", "D", "E", "F", "G", "A", "B"];
const naturalSemitone: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const accidentalAlter: Record<string, number> = {
  "": 0,
  "#": 1,
  x: 2,
  "##": 2,
  b: -1,
  bb: -2,
  "+": 0.5,
  "-": -0.5,
  "#+": 1.5,
  "b-": -1.5,
};

export function midiOf(step: Step, alter: number, octave: number): number {
  return (octave + 1) * 12 + naturalSemitone[step] + alter;
}

function checkGrid(midi: number, source: unknown): void {
  if (!Number.isFinite(midi) || Math.abs(midi * 2 - Math.round(midi * 2)) > 1e-9) {
    throw new Error(`Pitch ${JSON.stringify(source)} is not on the quarter-tone grid`);
  }
}

export function parsePitch(p: Pitch): Spelled {
  if (typeof p === "string") {
    const m = p.trim().match(/^([A-Ga-g])(#\+|b-|##|#|x|bb|b|\+|-)?(-?\d+)$/);
    if (!m) throw new Error(`Cannot read pitch "${p}" (examples: C4, F#3, E+4, Bb-3)`);
    const step = m[1]!.toUpperCase() as Step;
    const alter = accidentalAlter[m[2] ?? ""]!;
    const octave = Number(m[3]);
    return { step, alter, octave, midi: midiOf(step, alter, octave) };
  }
  if ("midi" in p) {
    checkGrid(p.midi, p);
    return spell(p.midi);
  }
  const midi = midiOf(p.step, p.alter, p.octave);
  checkGrid(midi, p);
  return { step: p.step, alter: p.alter, octave: p.octave, midi };
}

/**
 * Spells a MIDI number: the natural step closest to the pitch, preferring the sharp side on a tie,
 * except that black keys use the usual C# Eb F# Ab Bb.
 */
export function spell(midi: number): Spelled {
  const rounded = Math.round(midi * 2) / 2;
  const pc = ((rounded % 12) + 12) % 12;
  const blackKeys: Record<number, [Step, number]> = {
    1: ["C", 1],
    3: ["E", -1],
    6: ["F", 1],
    8: ["A", -1],
    10: ["B", -1],
  };
  let step: Step;
  let alter: number;
  if (Number.isInteger(pc) && blackKeys[pc]) {
    [step, alter] = blackKeys[pc]!;
  } else {
    let best: { step: Step; alter: number } | undefined;
    for (const s of steps) {
      for (const shift of [-12, 0, 12]) {
        const a = pc - (naturalSemitone[s] + shift);
        if (Math.abs(a) > 1.5) continue;
        if (
          !best ||
          Math.abs(a) < Math.abs(best.alter) ||
          (Math.abs(a) === Math.abs(best.alter) && a > best.alter)
        ) {
          best = { step: s, alter: a };
        }
      }
    }
    ({ step, alter } = best!);
  }
  const octave = Math.round((rounded - naturalSemitone[step] - alter) / 12) - 1;
  return { step, alter, octave, midi: rounded };
}

/** MusicXML accidental name for an alter value. */
export function accidentalName(alter: number): string {
  const names: Record<string, string> = {
    "-2": "flat-flat",
    "-1.5": "three-quarters-flat",
    "-1": "flat",
    "-0.5": "quarter-flat",
    "0": "natural",
    "0.5": "quarter-sharp",
    "1": "sharp",
    "1.5": "three-quarters-sharp",
    "2": "double-sharp",
  };
  const name = names[String(alter)];
  if (!name) throw new Error(`No accidental for alter ${alter}`);
  return name;
}

export function pitchName(p: Spelled): string {
  const acc =
    Object.entries(accidentalAlter).find(([k, v]) => v === p.alter && k !== "##")?.[0] ?? "";
  return `${p.step}${acc}${p.octave}`;
}

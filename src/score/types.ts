// The score JSON: the only contract between a composition layer and this system
// (docs/decisions/0014-score-json-contract.md).
//
// Units
// - Time is measured in quarter notes from the start of the piece. A number, or an exact
//   fraction as [numerator, denominator] (e.g. [1, 3] for a triplet eighth).
// - Pitch is concert (sounding) pitch, on the quarter-tone grid.
// - Dynamics are continuous levels: 0 = niente, 1 = ppp, 2 = pp, 3 = p, 4 = mp, 5 = mf,
//   6 = f, 7 = ff, 8 = fff. Fractions are allowed; notation rounds them to marks.

export type Time = number | [number, number];

/**
 * A pitch, in one of three forms:
 * - "C4", "F#3", "Bb2", "E+4" (quarter sharp), "B-3" (quarter flat), "C#+5" (three-quarter sharp),
 *   "Eb-4" (three-quarter flat), "Fx4" (double sharp), "Bbb3" (double flat). Octave 4 contains middle C.
 * - { midi: 64.5 }: a MIDI number on the quarter-tone grid; spelled automatically.
 * - { step: "E", alter: 0.5, octave: 4 }: explicit spelling; alter in semitones.
 */
export type Pitch = string | { midi: number } | { step: Step; alter: number; octave: number };
export type Step = "C" | "D" | "E" | "F" | "G" | "A" | "B";

export interface Score {
  title?: string;
  /** Time signatures, each starting at a measure (1-based). The first must be at measure 1. */
  meter: { measure: number; beats: number; beatType: number }[];
  /** Tempo changes. `beat` is the beat unit in quarter notes (default 1). */
  tempo?: { at: Time; bpm: number; beat?: Time; text?: string }[];
  /** Total number of measures. Defaults to just enough to hold every event. */
  measures?: number;
  /** Rehearsal marks. */
  rehearsal?: { measure: number; label: string }[];
  parts: Part[];
}

export interface Part {
  id: string;
  /** Instrument id from the catalog (src/instruments/catalog.ts), e.g. "violins-1", "flute", "snare-drum". */
  instrument: string;
  /** Staff name; defaults to the instrument's name. */
  name?: string;
  abbreviation?: string;
  /**
   * How many players of the section play this part (docs/decisions/0015-divisi-first-class.md).
   * Defaults to the whole section for strings and to 1 otherwise.
   */
  players?: number;
  /** Dynamic curve for the part (see Dynamics). */
  dynamics?: DynamicPoint[];
  events: Event[];
}

export interface DynamicPoint {
  at: Time;
  level: number;
  /** How the curve reaches the next point: "linear" (a hairpin) or "step" (default: hold, then jump). */
  to?: "linear" | "step";
}

export type Event = NoteEvent | TextEvent;

export interface NoteEvent {
  type?: "note";
  at: Time;
  dur: Time;
  /** One pitch, or several for a chord. Omit for unpitched percussion. */
  pitch?: Pitch | Pitch[];
  /** Voice within the staff, 1–4 (default 1). */
  voice?: number;
  /** Staff for multi-staff instruments (piano, harp), 1-based (default 1). */
  staff?: number;
  /** Playing technique from the instrument's vocabulary, e.g. "pizz", "sul-pont", "flutter", "rimshot". Default "ord". */
  technique?: string;
  articulations?: Articulation[];
  /** Slurred into the next note of the same voice. */
  slur?: boolean;
  /** Trill to the upper neighbour at this interval in semitones (1 or 2). */
  trill?: 1 | 2;
  /** Dynamic level at the onset. Adds a point to the part's curve. */
  dynamic?: number;
}

export type Articulation = "staccato" | "staccatissimo" | "tenuto" | "accent" | "marcato";

export interface TextEvent {
  type: "text";
  at: Time;
  text: string;
  placement?: "above" | "below";
}

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
  meter: {
    measure: number;
    beats: number;
    beatType: number;
    /**
     * How the beats group, in units of beatType: [2, 2, 3] for 7/8 as 2+2+3. Notes split and
     * beam by these groups. Default: x/4 and x/2 one by one; 6/8, 9/8, 12/8 in threes; other
     * x/8 and x/16 in twos, with a three at the end when odd.
     */
    groups?: number[];
  }[];
  /**
   * Tempo changes. `beat` is the beat unit in quarter notes (default 1). With `to: "linear"` the
   * tempo moves gradually to the next change (written accel. or rit.); otherwise it holds, then jumps.
   */
  tempo?: { at: Time; bpm: number; beat?: Time; text?: string; to?: "linear" | "step" }[];
  /** Total number of measures. Defaults to just enough to hold every event. */
  measures?: number;
  /** Rehearsal marks. */
  rehearsal?: { measure: number; label: string }[];
  parts: Part[];
  /** For a piece made of sketches: where each of them is (the preview draws it as a map). */
  outline?: Outline;
}

/**
 * The structure of a piece made of sketches (src/sketch/nest.ts), written with its score for the
 * preview's map. Notation and playback ignore it.
 */
export interface Outline {
  /** The piece's length in quarters. */
  length: number;
  nodes: OutlineNode[];
  /** Each flow of the piece, sampled evenly from its start to its end (0–1). */
  flows: Record<string, number[]>;
  /** Problems found while putting the nodes together (two nodes giving one player notes at once). */
  warnings: string[];
}

export interface OutlineNode {
  /** The node's folder, from the piece's folder ("" for the piece itself). */
  node: string;
  /** Start and length, in quarters from the start of the piece. */
  at: number;
  length: number;
  /** 0 for the piece, 1 for its sections, and so on. */
  depth: number;
  /** Forms of the motif it plays (P, I, R, RI). */
  uses: string[];
  /** Players it writes for (part ids). */
  players: string[];
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
  /**
   * Feathered beams: the notes of a voice that start within each span are written evenly under
   * one beam that fans out (accel) or in (rit), and played at their own times.
   */
  feathers?: Feather[];
  events: Event[];
}

export interface Feather {
  at: Time;
  dur: Time;
  kind: "accel" | "rit";
  /** Default 1. */
  voice?: number;
  staff?: number;
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
  /**
   * Slides into the next note of the same voice (a glissando line), taking this note's whole
   * length: tie a held note before it to slide only at the end.
   */
  gliss?: boolean;
  /** With gliss: hold the pitch this long (quarters) before sliding. Default 0. */
  glissAfter?: Time;
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

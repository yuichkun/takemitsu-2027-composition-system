// Test: glissandi in strings, winds and harp. Can they be written and heard?
// Strings, clarinet and trombone slide on BBC SO by sweeping the instrument's tuning under a held
// note (src/performance/plan.ts, glide lanes); the harp uses BBC SO's own glissando samples.
// The music is only there to test; nothing here is a proposal for the piece.

import type { NoteEvent, Part, Score } from "../../../src/score/types.ts";
import { number, pitch, toggle, type Values } from "../../../src/sketch/knobs.ts";

export const knobs = {
  tempo: number({
    group: "Time",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 72,
    min: 40,
    max: 160,
    step: 2,
    unit: "bpm",
  }),
  slide: number({
    group: "Time",
    label: "Slide length",
    help: "How long each slide takes",
    value: 2,
    min: 0.25,
    max: 8,
    step: 0.25,
    unit: "beats",
  }),
  hold: number({
    group: "Time",
    label: "Hold before",
    help: "How long each note is held before it starts to slide",
    value: 1,
    min: 0,
    max: 4,
    step: 0.25,
    unit: "beats",
  }),
  width: number({
    group: "Pitch",
    label: "Width",
    help: "How far the main slides go (up for violins and clarinet, down for cellos)",
    value: 7,
    min: 1,
    max: 24,
    step: 0.5,
    unit: "st",
  }),
  start: pitch({
    group: "Pitch",
    label: "Violins start",
    help: "Where the violins' slide starts",
    value: "A4",
    min: "G3",
    max: "A6",
  }),
  quarter: toggle({
    group: "Pitch",
    label: "Quarter-tone ends",
    help: "On: the violas slide by quarter tones, and every target is a quarter tone sharp",
    value: false,
  }),
};

export function score(v: Values<typeof knobs>): Score {
  const q = v.quarter ? 0.5 : 0;
  const hold = v.hold;
  const slide = v.slide;
  const len = hold + slide; // a sliding note: held, then sliding into the next
  const notes = (list: [number, number, number, boolean?][]): NoteEvent[] =>
    list.map(([at, dur, midi, gliss]) => ({
      at,
      dur,
      pitch: { midi },
      gliss: gliss || undefined,
      glissAfter: gliss && hold ? Math.min(hold, dur) : undefined,
    }));

  const a = v.start;
  // Violins: up by the width, back down, then up over the barline.
  const vn = notes([
    [0, len, a, true],
    [len, len, a + v.width + q, true],
    [2 * len, len, a, true],
    [3 * len, 2, a + 2 * v.width + q],
  ]);
  // Violas: small slides, by quarter tones when asked.
  const step = v.quarter ? 0.5 : 1;
  const va = notes([
    [0, 2, 62, true],
    [2, 2, 62 + step, true],
    [4, 2, 62 + 2 * step, true],
    [6, 2, 62 + step, true],
    [8, 4, 62],
  ]);
  // Cellos: one long slide down, the other way from the violins.
  const vc = notes([
    [0, 2 * len, 55, true],
    [2 * len, 2, 55 - v.width + q],
  ]);
  // Clarinet: a fast rising slide after a held low note.
  const cl = notes([
    [4, hold + 0.5, 55, true],
    [4 + hold + 0.5, 3, 55 + 17 + q],
  ]);
  // Trombone: slide positions, a fifth down and back.
  const tbn = notes([
    [8, len, 58, true],
    [8 + len, len, 51 + q, true],
    [8 + 2 * len, 2, 58],
  ]);
  // Harp: BBC SO's recorded glissandi, one per bar.
  const hp: NoteEvent[] = [0, 4, 8, 12].map((at, i) => ({
    at,
    dur: 2,
    pitch: { midi: [55, 60, 62, 67][i]! },
    technique: "gliss",
  }));

  const end = Math.max(
    ...[vn, va, vc, cl, tbn].map((e) => Math.max(...e.map((n) => Number(n.at) + Number(n.dur)))),
  );
  const parts: Part[] = [
    { id: "cl", instrument: "clarinet", events: cl, dynamics: [{ at: 0, level: 4 }] },
    { id: "tbn", instrument: "trombone", events: tbn, dynamics: [{ at: 0, level: 4 }] },
    { id: "hp", instrument: "harp", events: hp, dynamics: [{ at: 0, level: 5 }] },
    { id: "vn", instrument: "violins-1", events: vn, dynamics: [{ at: 0, level: 4 }] },
    { id: "va", instrument: "violas", events: va, dynamics: [{ at: 0, level: 4 }] },
    { id: "vc", instrument: "cellos", events: vc, dynamics: [{ at: 0, level: 5 }] },
  ];
  return {
    title: "Test: glissando",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: Math.ceil(end / 4),
    parts,
  };
}

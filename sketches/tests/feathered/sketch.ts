// Test: feathered beams. A group of notes written evenly under a beam that fans out (accel.) or
// in (rit.), played speeding up or slowing down. Can it be written and heard?
// The music is only there to test; nothing here is a proposal for the piece.

import type { Feather, NoteEvent, Part, Score } from "../../../src/score/types.ts";
import { choice, number, toggle, type Values } from "../../../src/sketch/knobs.ts";

export const knobs = {
  notes: number({
    group: "Group",
    label: "Notes",
    help: "How many notes in each feathered group",
    value: 8,
    min: 3,
    max: 24,
    step: 1,
  }),
  length: number({
    group: "Group",
    label: "Length",
    help: "How long each group lasts",
    value: 2,
    min: 1,
    max: 8,
    step: 0.5,
    unit: "beats",
  }),
  kind: choice({
    group: "Group",
    label: "Direction",
    help: "accel: the notes speed up (beams fan out); rit: they slow down; both: alternate",
    value: "both",
    options: ["accel", "rit", "both"],
  }),
  curve: number({
    group: "Group",
    label: "Sharpness",
    help: "How strongly they speed up or slow down: 1 is even, 3 is steep",
    value: 2.5,
    min: 1,
    max: 5,
    step: 0.1,
  }),
  rising: toggle({
    group: "Pitch",
    label: "Rising figure",
    help: "On: each group climbs a scale; off: one repeated note",
    value: true,
  }),
  tempo: number({
    group: "Pitch",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 60,
    min: 30,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

export function score(v: Values<typeof knobs>): Score {
  const players = [
    { id: "fl", instrument: "flute", base: 76 },
    { id: "cl", instrument: "clarinet", base: 64 },
    { id: "mar", instrument: "marimba", base: 72 },
    { id: "vn", instrument: "violins-1", base: 81 },
  ];
  const scale = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24];
  const groups = 6;
  const gap = 1; // a beat's rest after each group
  const parts: Part[] = players.map((p, pi) => {
    const events: NoteEvent[] = [];
    const feathers: Feather[] = [];
    for (let g = 0; g < groups; g++) {
      // Players take turns, then all play together in the last two groups.
      if (g < 4 && g % players.length !== pi && g !== pi) continue;
      const start = g * (v.length + gap);
      const kind = v.kind === "both" ? (g % 2 ? "rit" : "accel") : (v.kind as "accel" | "rit");
      // Onsets: accel starts spread out and crowds together; rit the other way round.
      const onset = (i: number) => {
        const x = i / v.notes;
        return start + v.length * (kind === "accel" ? 1 - (1 - x) ** v.curve : x ** v.curve);
      };
      for (let i = 0; i < v.notes; i++) {
        // Times as exact fractions on the score's finest grid (1/10080 of a quarter).
        const grid = (x: number) => Math.round(x * 10080);
        const at = grid(onset(i));
        events.push({
          at: [at, 10080],
          dur: [grid(onset(i + 1)) - at, 10080],
          pitch: { midi: p.base + (v.rising ? scale[i % scale.length]! : 0) },
        });
      }
      feathers.push({ at: start, dur: v.length, kind });
    }
    return {
      id: p.id,
      instrument: p.instrument,
      events,
      feathers,
      dynamics: [{ at: 0, level: 4 }],
    };
  });
  return {
    title: "Test: feathered beams",
    meter: [{ measure: 1, beats: 3, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: Math.ceil((groups * (v.length + gap)) / 3),
    parts,
  };
}

// antara, the vertical and the horizontal line, B (pitch): they stop at the ceiling.
//
// Seven voices climb from their own low notes, each by betweens drawn from one rising set (each
// starting at its own place in the rule) and each in its own rhythm and family. Above them is a
// ceiling: a step that would pass it is cut there, so the last between of every climb is decided by
// the ceiling, not by the set. A voice that reaches it stays: from then on it draws only 0, one
// note in its own rhythm. One by one they arrive, until all seven play the same note, each in its
// own time. By default the ceiling is a quarter tone off the usual grid, so they meet on a pitch no
// usual name holds. Card: README.md.

import { betweenSet, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, type Family } from "../../../between.ts";
import { note, part, scoreOf, stream, TICKS, time, type Player } from "../common.ts";

export const knobs = {
  ceiling: pitch({
    group: "Pitch",
    label: "Ceiling",
    help: "Where every climb stops, and the note they all end on",
    value: "E+5",
    min: "C5",
    max: "A5",
    step: 0.5,
  }),
  set: betweenSet({
    group: "Pitch",
    label: "Rising set",
    help: "The betweens the voices climb by (semitones, .5 for a quarter tone)",
    value: "1 1.5 2.5 3",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  rhythm: betweenSet({
    group: "Time",
    label: "Rhythm",
    help: "The time betweens, in atoms of each voice's family, drawn by combinations two at a time",
    value: "2 3 4 5",
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  entries: number({
    group: "Form",
    label: "Entries",
    help: "Beats between entries, from the lowest voice up",
    value: 2,
    min: 0,
    max: 8,
    step: 1,
    unit: "beats",
  }),
  after: number({
    group: "Form",
    label: "Then",
    help: "Bars after the last voice has reached the ceiling",
    value: 3,
    min: 1,
    max: 12,
    step: 1,
    unit: "bars",
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 72,
    min: 40,
    max: 140,
    step: 2,
    unit: "bpm",
  }),
};

interface Voice extends Player {
  start: number;
  family: Family;
}

// Top down, in score order; they enter from the bottom.
const VOICES: Voice[] = [
  { id: "fl", instrument: "flute", range: [60, 96], grids: [0, 1], start: 62, family: 5 },
  { id: "ob", instrument: "oboe", range: [58, 91], grids: [0, 1], start: 60, family: 3 },
  { id: "cl", instrument: "clarinet", range: [50, 91], grids: [0, 1], start: 52, family: 2 },
  { id: "vn1", instrument: "violins-1", range: [55, 100], grids: [0, 1], start: 57, family: 3 },
  { id: "vn2", instrument: "violins-2", range: [55, 96], grids: [0, 1], start: 55, family: 5 },
  { id: "va", instrument: "violas", range: [48, 88], grids: [0, 1], start: 50, family: 2 },
  { id: "vc", instrument: "cellos", range: [36, 84], grids: [0, 1], start: 41, family: 3 },
];

export function score(v: Values<typeof knobs>) {
  const lines = VOICES.map((vc, i) => {
    const atom = atomOf(vc.family);
    const step = stream(v.set, "shift each time", 1);
    const rhythm = stream(v.rhythm, "combinations", 2);
    // Each voice starts at its own place in the rules.
    for (let k = 0; k < i; k++) {
      step();
      rhythm();
    }
    const entry = (VOICES.length - 1 - i) * v.entries * TICKS;
    const notes: { at: number; dur: number; midi: number }[] = [];
    let t = entry;
    let midi = Math.min(vc.start, v.ceiling);
    while (midi < v.ceiling) {
      const d = rhythm() * atom;
      notes.push({ at: t, dur: d, midi });
      t += d;
      midi = Math.min(v.ceiling, midi + step());
    }
    return { vc, atom, notes, arrive: t, rhythm };
  });
  // After the last arrival, a few bars of the ceiling alone.
  const end =
    (Math.ceil(Math.max(...lines.map((l) => l.arrive)) / (4 * TICKS)) + v.after) * 4 * TICKS;
  const parts = lines.map(({ vc, atom, notes, arrive, rhythm }) => {
    let t = arrive;
    while (t < end) {
      const d = Math.min(rhythm() * atom, end - t);
      notes.push({ at: t, dur: d, midi: v.ceiling });
      t += d;
    }
    const events = notes.map((n) => note(n.at, n.dur, n.midi));
    // Growing while it climbs; the last bar fades.
    const fade = end - 4 * TICKS;
    const points: [number, number, boolean][] = [
      [notes[0]?.at ?? 0, 3, true],
      [Math.min(arrive, fade), 5, false],
      [fade, 5, true],
      [end, 3.5, false],
    ];
    // Where two points fall together, the later one stays.
    const dynamics = points
      .filter(([at], k) => k === points.length - 1 || points[k + 1]![0] !== at)
      .map(([at, level, ramp]) =>
        ramp ? { at: time(at), level, to: "linear" as const } : { at: time(at), level },
      );
    return part(vc, events, dynamics);
  });
  return scoreOf("antara · B · they stop at the ceiling", end / (4 * TICKS), v.tempo, parts);
}

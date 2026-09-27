// Test: heterophony. One line, played at once by several instruments, each its own way:
// ornamented, a little late, held, an octave up and ahead, reduced to its strong notes.
// The melody is a stand-in (type your own); nothing here is a proposal for the piece.

import type { NoteEvent, Part, Score } from "../../../src/score/types.ts";
import {
  number,
  numbersOf,
  pitchOf,
  random,
  seed,
  text,
  weights,
  type Values,
} from "../../../src/sketch/knobs.ts";

const voices = [
  { id: "fl", instrument: "flute", name: "Flute: ornaments", octave: 1 },
  { id: "ob", instrument: "oboe", name: "Oboe: late", octave: 0 },
  { id: "cl", instrument: "clarinet", name: "Clarinet: held", octave: 0 },
  { id: "vn", instrument: "violins-1", name: "Violins: early, above", octave: 1 },
  { id: "va", instrument: "violas", name: "Violas: strong notes", octave: 0 },
];

export const knobs = {
  melody: text({
    group: "Line",
    label: "Melody",
    help: "The line, as pitch:length in quarters, e.g. D4:1 E4:0.5. Every voice plays this line its own way",
    value:
      "D4:1 E4:0.5 F4:0.5 A4:1.5 G4:0.5 F4:1 E4:1 D4:1 C4:0.5 D4:0.5 E4:2 A4:1 C5:0.5 B4:0.5 A4:1 G4:1 F4:1 E4:1 D4:3",
    hint: "D4:1 E4:0.5 F+4:0.5 …",
  }),
  tempo: number({
    group: "Line",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 66,
    min: 30,
    max: 160,
    step: 2,
    unit: "bpm",
  }),
  who: weights({
    group: "Voices",
    label: "Voices",
    help: "How present each voice is: 0 leaves it out; above 0 it plays, louder the higher",
    value: [0.8, 0.6, 0.5, 0.6, 0.4],
    labels: voices.map((v) => v.name.split(":")[0]!),
  }),
  ornament: number({
    group: "Voices",
    label: "Ornaments",
    help: "Flute: how many of the longer notes get a turn of neighbours",
    value: 0.7,
    min: 0,
    max: 1,
    step: 0.05,
  }),
  lag: number({
    group: "Voices",
    label: "Late / early",
    help: "Oboe comes this much late, violins this much early",
    value: 2,
    min: 0,
    max: 8,
    step: 1,
    unit: "16ths",
  }),
  hold: number({
    group: "Voices",
    label: "Held from",
    help: "Clarinet: notes shorter than this are left out, the previous note held through them",
    value: 1,
    min: 0.25,
    max: 4,
    step: 0.25,
    unit: "beats",
  }),
  seed: seed({ group: "Voices", label: "Seed", help: "Which ornaments", value: 1 }),
};

export function score(v: Values<typeof knobs>): Score {
  const line = v.melody
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const [p, d] = w.split(":");
      return { midi: pitchOf("Melody", p!), dur: numbersOf("Melody", d ?? "1")[0]! };
    });
  let t = 0;
  const notes = line.map((n) => {
    const at = t;
    t += n.dur;
    return { ...n, at };
  });
  const total = t + 2;
  const rand = random(v.seed);
  // Neighbours come from the melody's own pitch classes, so ornaments stay in its mode.
  const pcs = new Set(notes.map((n) => ((n.midi % 12) + 12) % 12));
  const neighbour = (midi: number, dir: 1 | -1) => {
    for (let q = midi + dir * 0.5; Math.abs(q - midi) <= 12; q += dir * 0.5)
      if (pcs.has(((q % 12) + 12) % 12)) return q;
    return midi + dir;
  };
  const lag = v.lag / 4;
  const variants: NoteEvent[][] = [
    // Flute: an octave up; longer notes get a turn (upper, note, lower, note) at their start,
    // the neighbours taken from the melody's pitches.
    notes.flatMap((n) => {
      if (n.dur < 1 || rand() >= v.ornament)
        return [{ at: n.at, dur: n.dur, pitch: { midi: n.midi + 12 } }];
      const s = 0.125;
      return [
        { at: n.at, dur: s, pitch: { midi: neighbour(n.midi, 1) + 12 } },
        { at: n.at + s, dur: s, pitch: { midi: n.midi + 12 } },
        { at: n.at + 2 * s, dur: s, pitch: { midi: neighbour(n.midi, -1) + 12 } },
        { at: n.at + 3 * s, dur: n.dur - 3 * s, pitch: { midi: n.midi + 12 } },
      ];
    }),
    // Oboe: the line as it is, late.
    notes.map((n) => ({ at: n.at + lag, dur: n.dur, pitch: { midi: n.midi } })),
    // Clarinet: only the long notes, each held until the next long one.
    (() => {
      const kept = notes.filter((n, i) => i === 0 || n.dur >= v.hold);
      return kept.map((n, i) => ({
        at: n.at,
        dur: (kept[i + 1]?.at ?? t) - n.at,
        pitch: { midi: n.midi },
      }));
    })(),
    // Violins: an octave up, early (the first note cannot come before the start).
    notes.map((n, i) => {
      const at = Math.max(0, n.at - lag);
      const end = i + 1 < notes.length ? Math.max(at + 0.25, notes[i + 1]!.at - lag) : n.at + n.dur;
      return { at, dur: end - at, pitch: { midi: n.midi + 12 } };
    }),
    // Violas: pizzicato on the notes that fall on a beat.
    notes
      .filter((n) => Number.isInteger(n.at))
      .map((n) => ({ at: n.at, dur: 1, pitch: { midi: n.midi }, technique: "pizz" })),
  ];
  const parts: Part[] = voices
    .map((voice, i) => ({ voice, i }))
    .filter(({ i }) => v.who[i]! > 0)
    .map(({ voice, i }) => ({
      id: voice.id,
      instrument: voice.instrument,
      events: variants[i]!,
      dynamics: [{ at: 0, level: Math.round((2 + v.who[i]! * 4) * 2) / 2 }],
    }));
  return {
    title: "Test: heterophony",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: Math.ceil(total / 4),
    parts,
  };
}

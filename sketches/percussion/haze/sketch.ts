// Percussion: a haze of sustained colours. A bass drum's soft roll underneath; bowed tam-tam and
// cymbal, triangle roll and bowed crotales appearing and fading over it; one swell over all.
// A sketch of what BBC SO's percussion can do for atmosphere, not a proposal for the piece.

import type { DynamicPoint, NoteEvent, Part, Score } from "../../../src/score/types.ts";
import {
  envelope,
  number,
  pitchSet,
  random,
  seed,
  weights,
  type Values,
} from "../../../src/sketch/knobs.ts";

const layers = [
  { id: "bd", instrument: "bass-drum", name: "BD soft roll", technique: "roll+soft" },
  { id: "tt", instrument: "tam-tam", name: "Tam-tam bowed", technique: "bowed" },
  { id: "ttc", instrument: "tam-tam", name: "Tam-tam swell", technique: "crescendo" },
  { id: "cym", instrument: "suspended-cymbal", name: "Cymbal bowed", technique: "bowed" },
  { id: "cymr", instrument: "suspended-cymbal", name: "Cymbal roll", technique: "roll" },
  { id: "tri", instrument: "triangle", name: "Triangle roll", technique: "roll" },
  { id: "crot", instrument: "crotales", name: "Crotales bowed", technique: "bowed" },
];

export const knobs = {
  swell: envelope({
    group: "Shape",
    label: "Swell",
    help: "Loudness of everything over the passage",
    value: [
      [0, 0.05],
      [0.6, 0.55],
      [0.8, 0.3],
      [1, 0],
    ],
    ends: ["niente", "f"],
  }),
  bars: number({
    group: "Shape",
    label: "Length",
    help: "How long the haze lasts",
    value: 16,
    min: 4,
    max: 64,
    step: 1,
    unit: "bars",
  }),
  density: number({
    group: "Shape",
    label: "Density",
    help: "How often a new colour appears over the roll (per bar, on average)",
    value: 1.2,
    min: 0.1,
    max: 4,
    step: 0.1,
  }),
  mix: weights({
    group: "Colours",
    label: "Colours",
    help: "How often each colour appears; the bass drum's roll is there throughout when above 0",
    value: [1, 0.6, 0.4, 0.6, 0.3, 0.4, 0.5],
    labels: layers.map((l) => l.name),
  }),
  crotales: pitchSet({
    group: "Colours",
    label: "Crotale pitches",
    help: "Which pitch classes the bowed crotales use (0 = C)",
    value: [1, 6, 8],
    divisions: 12,
  }),
  seed: seed({ group: "Colours", label: "Seed", help: "Which of the possible hazes", value: 3 }),
};

export function score(v: Values<typeof knobs>): Score {
  const total = v.bars * 4;
  const rand = random(v.seed);
  const events = new Map<string, NoteEvent[]>(layers.map((l) => [l.id, []]));
  // The roll underneath, the whole time.
  if (v.mix[0]! > 0) events.get("bd")!.push({ at: 0, dur: total, technique: "roll+soft" });
  // Colours over it: on average `density` a bar, each 3–8 beats, no two of a layer at once.
  const free = new Map<string, number>();
  const chosen = layers.slice(1).map((l, i) => ({ ...l, weight: v.mix[i + 1]! }));
  const sum = chosen.reduce((a, l) => a + l.weight, 0);
  const pcs = v.crotales.length ? v.crotales : [0];
  for (let beat = 0; beat < total - 2; beat++) {
    if (sum === 0 || rand() >= v.density / 4) continue;
    let r = rand() * sum;
    const layer = chosen.find((l) => (r -= l.weight) < 0);
    if (!layer || (free.get(layer.id) ?? 0) > beat) continue;
    const dur = Math.min(total - beat, 3 + Math.floor(rand() * 6));
    const note: NoteEvent = { at: beat, dur, technique: layer.technique };
    if (layer.instrument === "crotales") {
      const pc = pcs[Math.floor(rand() * pcs.length)]!;
      note.pitch = { midi: 84 + (((pc % 12) + 12) % 12) };
    }
    events.get(layer.id)!.push(note);
    free.set(layer.id, beat + dur + 1);
  }
  const dynamics: DynamicPoint[] = [...v.swell]
    .sort((a, b) => a[0] - b[0])
    .map(([t, y]) => ({
      at: Math.round(t * total * 4) / 4,
      level: Math.round(y * 6 * 2) / 2,
      to: "linear" as const,
    }));
  const parts: Part[] = layers
    .filter((l) => events.get(l.id)!.length)
    .map((l) => ({
      id: l.id,
      instrument: l.instrument,
      name: l.name,
      events: events.get(l.id)!,
      dynamics,
    }));
  return {
    title: "Percussion: haze",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: 56 }],
    measures: v.bars,
    parts,
  };
}

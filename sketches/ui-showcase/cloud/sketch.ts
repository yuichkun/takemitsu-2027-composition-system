// UI showcase: a cloud of short notes, shaped by drawn curves.
// Shows: curve (density, register), pitch-set, pitch-range, weights, xy, seed.
// The music is only there to show the controls; nothing here is a proposal for the piece.

import { instrument } from "../../../src/instruments/catalog.ts";
import type { NoteEvent, Part, Score } from "../../../src/score/types.ts";
import {
  curve,
  curveAt,
  number,
  pick,
  pitchRange,
  pitchSet,
  random,
  seed,
  weights,
  xy,
  type Values,
} from "../../../src/sketch/knobs.ts";

const players = [
  { id: "fl", instrument: "flute", name: "Flute" },
  { id: "cl", instrument: "clarinet", name: "Clarinet" },
  { id: "hp", instrument: "harp", name: "Harp" },
  { id: "vn", instrument: "violins-1", name: "Vn pizz", technique: "pizz" },
  { id: "va", instrument: "violas", name: "Va pizz", technique: "pizz" },
  { id: "vc", instrument: "cellos", name: "Vc pizz", technique: "pizz" },
];

export const knobs = {
  density: curve({
    group: "Shape in time",
    label: "Density",
    help: "How likely a note is on each 16th, over the whole passage",
    value: (t) => 0.1 + 0.8 * Math.sin(Math.PI * t) ** 2,
    ends: ["silence", "every 16th"],
  }),
  register: curve({
    group: "Shape in time",
    label: "Register",
    help: "Where in the pitch range the notes cluster, over the whole passage",
    value: (t) => 0.2 + 0.6 * t,
    ends: ["bottom", "top"],
  }),
  bars: number({
    group: "Shape in time",
    label: "Length",
    help: "How long the passage is",
    value: 12,
    min: 2,
    max: 48,
    step: 1,
    unit: "bars",
  }),
  pcs: pitchSet({
    group: "Pitch",
    label: "Pitch classes",
    help: "Every note is one of these pitch classes (0 = C)",
    value: [0, 1, 5, 6],
    divisions: 12,
  }),
  span: pitchRange({
    group: "Pitch",
    label: "Range",
    help: "Lowest and highest pitch the cloud may use (each instrument also keeps to its own range)",
    value: ["C3", "C7"],
    min: "C1",
    max: "C8",
  }),
  who: weights({
    group: "Colour",
    label: "Instruments",
    help: "How often each instrument takes a note",
    value: [0.6, 0.4, 0.8, 0.5, 0.3, 0.3],
    labels: players.map((p) => p.name),
  }),
  touch: xy({
    group: "Colour",
    label: "Touch",
    help: "Across: how long the notes are (a 16th … a half note). Up: how loud (pp … f)",
    value: [0.15, 0.35],
    axes: ["length", "loudness"],
  }),
  seed: seed({
    group: "Chance",
    label: "Seed",
    help: "Which of the possible clouds with these settings",
    value: 1,
  }),
};

export function score(v: Values<typeof knobs>): Score {
  const rand = random(v.seed);
  const slots = v.bars * 16;
  const [lo, hi] = v.span;
  const pcs = new Set(v.pcs.map((p) => ((p % 12) + 12) % 12));
  const events: NoteEvent[][] = players.map(() => []);
  const free = players.map(() => 0); // the slot each player is free again
  const length = Math.max(1, Math.round(1 + v.touch[0] * 7)); // in 16ths
  const level = 2 + v.touch[1] * 4; // pp … f

  for (let s = 0; s < slots; s++) {
    const t = s / slots;
    if (rand() >= curveAt(v.density, t)) continue;
    const who = pick(
      v.who.map((w, i) => (free[i]! <= s ? w : 0)),
      rand(),
    );
    if (who < 0) continue;
    const range = instrument(players[who]!.instrument).range ?? [0, 127];
    const center = lo + curveAt(v.register, t) * (hi - lo);
    const candidates: number[] = [];
    for (let m = Math.ceil(Math.max(lo, range[0])); m <= Math.min(hi, range[1]); m++)
      if (pcs.has(m % 12) && Math.abs(m - center) <= 7) candidates.push(m);
    if (candidates.length === 0) continue;
    const midi = candidates[Math.floor(rand() * candidates.length)]!;
    events[who]!.push({
      at: s / 4,
      dur: length / 4,
      pitch: { midi },
      // The harp's lower staff takes what is below middle C.
      staff: players[who]!.instrument === "harp" && midi < 60 ? 2 : undefined,
      dynamic: Math.round(level * 2) / 2,
      technique: players[who]!.technique,
      articulations: length === 1 ? ["staccato"] : undefined,
    });
    free[who] = s + length;
  }

  const parts: Part[] = players.map((p, i) => ({
    id: p.id,
    instrument: p.instrument,
    events: events[i]!,
    dynamics: [{ at: 0, level }],
  }));
  return {
    title: "Showcase: cloud",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: 72 }],
    measures: v.bars,
    parts,
  };
}

// antara, the vertical and the horizontal line, B (pitch): one note handed on.
//
// A rising line is handed from instrument to instrument, one note each. Its betweens close to 0 the
// way they do in "the betweens narrow" (every between one quarter tone narrower at each stage),
// but who plays next keeps turning round: the order of the ten players is a rule of its own. When
// the pitch has become one note, the handing on goes on: a horizontal line drawn in colour instead
// of pitch. The line stays inside one band (C4 to F5) that every player can reach; a note on the
// grid a quarter tone off skips the vibraphone and the harp, which cannot sound it.
// Card: README.md.

import { betweenSet, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf } from "../../../between.ts";
import { fold, gridOf, note, part, scoreOf, stream, TICKS, type Player } from "../common.ts";

export const knobs = {
  set: betweenSet({
    group: "Pitch",
    label: "Rising set",
    help: "The betweens the line climbs by at first (semitones, .5 for a quarter tone). Each stage, all of them one quarter tone narrower",
    value: "1 1.5 2.5",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  start: pitch({
    group: "Pitch",
    label: "Start",
    help: "The first note",
    value: "C4",
    min: "C4",
    max: "F5",
    step: 0.5,
  }),
  notes: number({
    group: "Pitch",
    label: "Notes per stage",
    help: "How many notes each state of the set lasts",
    value: 6,
    min: 2,
    max: 16,
    step: 1,
  }),
  rhythm: betweenSet({
    group: "Time",
    label: "Rhythm",
    help: "The time betweens of the line, in triplet 8ths, drawn by combinations two at a time",
    value: "2 3 3 4",
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 66,
    min: 40,
    max: 140,
    step: 2,
    unit: "bpm",
  }),
};

const BAND: [number, number] = [60, 77];

// In score order.
const PLAYERS: Player[] = [
  { id: "fl", instrument: "flute", range: BAND, grids: [0, 1] },
  { id: "ob", instrument: "oboe", range: BAND, grids: [0, 1] },
  { id: "cl", instrument: "clarinet", range: BAND, grids: [0, 1] },
  { id: "hn", instrument: "horn", range: BAND, grids: [0, 1] },
  { id: "tpt", instrument: "trumpet", range: BAND, grids: [0, 1], technique: "muted" },
  { id: "vib", instrument: "vibraphone", range: BAND, grids: [0] },
  { id: "hp", instrument: "harp", range: BAND, grids: [0] },
  {
    id: "vn",
    instrument: "violins-1",
    name: "Violin (solo)",
    abbreviation: "Vn.",
    players: 1,
    range: BAND,
    grids: [0, 1],
    technique: "flautando",
  },
  {
    id: "va",
    instrument: "violas",
    name: "Viola (solo)",
    abbreviation: "Va.",
    players: 1,
    range: BAND,
    grids: [0, 1],
    technique: "sul-tasto",
  },
  {
    id: "vc",
    instrument: "cellos",
    name: "Cello (solo)",
    abbreviation: "Vc.",
    players: 1,
    range: BAND,
    grids: [0, 1],
  },
];
// The order the line is handed on in: neighbours far apart in colour.
const TURN = ["fl", "hn", "vn", "cl", "hp", "va", "ob", "vib", "tpt", "vc"];

export function score(v: Values<typeof knobs>) {
  const atom = atomOf(3);
  const rhythm = stream(v.rhythm, "combinations", 2);
  const stages: number[][] = [];
  for (let s = 0; ; s++) {
    const set = v.set.map((b) => Math.max(0, b - 0.5 * s));
    stages.push(set);
    if (set.every((b) => b === 0)) break;
  }
  stages.push(stages.at(-1)!, stages.at(-1)!);
  const events = PLAYERS.map(() => [] as ReturnType<typeof note>[]);
  let t = 0;
  let turn = 0;
  let midi = fold(v.start, BAND);
  for (const set of stages) {
    const step = stream(
      [...set].sort((a, b) => a - b),
      "shift each time",
      1,
    );
    for (let k = 0; k < v.notes; k++) {
      // The next player in the turn who can sound this note's grid.
      let i = -1;
      for (let tries = 0; tries < TURN.length && i < 0; tries++) {
        const p = PLAYERS.findIndex((x) => x.id === TURN[turn % TURN.length]);
        turn++;
        if (PLAYERS[p]!.grids.includes(gridOf(midi))) i = p;
      }
      const d = rhythm() * atom;
      const tech = PLAYERS[i]!.technique;
      events[i]!.push(note(t, d, midi, tech ? { technique: tech } : {}));
      t += d;
      midi = fold(midi + step(), BAND);
    }
  }
  const bars = Math.ceil(t / (4 * TICKS));
  const dynamics = [{ at: 0, level: 4 }];
  const parts = PLAYERS.map((p, i) => part(p, events[i]!, dynamics));
  return scoreOf("antara · B · one note handed on", bars, v.tempo, parts);
}

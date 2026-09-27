// Percussion: metal. At each mark, a run-up (cymbal roll, tam-tam swell, tambourine roll,
// sleigh bells) crescendos into a crash (clash cymbals, tam-tam, tubular bells), which rings
// or is choked; between them, triangle and glockenspiel glints.
// A sketch of BBC SO's metal percussion, not a proposal for the piece.

import type { DynamicPoint, NoteEvent, Part, Score } from "../../../src/score/types.ts";
import {
  markers,
  number,
  pitchSet,
  random,
  seed,
  toggle,
  type Values,
} from "../../../src/sketch/knobs.ts";

const bars = 20;

export const knobs = {
  crashes: markers({
    group: "Crashes",
    label: "Crashes",
    help: "Where the crashes land",
    value: [5, 11, 17],
    length: bars,
    unit: "bars",
  }),
  runUp: number({
    group: "Crashes",
    label: "Run-up",
    help: "How long the roll into each crash lasts",
    value: 6,
    min: 1,
    max: 16,
    step: 1,
    unit: "beats",
  }),
  choke: toggle({
    group: "Crashes",
    label: "Choke",
    help: "On: the clash cymbals are choked right after the crash; off: they ring",
    value: false,
  }),
  bells: pitchSet({
    group: "Colour",
    label: "Bell pitches",
    help: "Pitch classes for the tubular bells and the glockenspiel glints (0 = C)",
    value: [2, 3, 9],
    divisions: 12,
  }),
  glints: number({
    group: "Colour",
    label: "Glints",
    help: "Triangle and glockenspiel between the crashes: how likely one is on each beat",
    value: 0.25,
    min: 0,
    max: 1,
    step: 0.05,
  }),
  seed: seed({ group: "Colour", label: "Seed", help: "Where the glints fall", value: 2 }),
};

export function score(v: Values<typeof knobs>): Score {
  const rand = random(v.seed);
  const crashes = [...v.crashes].sort((a, b) => a - b).map((b) => b * 4);
  const pcs = v.bells.length ? v.bells : [0];
  const bell = (i: number) => 60 + (((pcs[i % pcs.length]! % 12) + 12) % 12);
  const ev: Record<string, NoteEvent[]> = {
    cym: [],
    tt: [],
    tamb: [],
    sl: [],
    clash: [],
    bells: [],
    tri: [],
    glk: [],
  };
  const busy: [number, number][] = [];
  crashes.forEach((c, i) => {
    const from = Math.max(0, c - v.runUp);
    busy.push([from, c + 4]);
    ev.cym!.push({ at: from, dur: c - from, technique: "roll" });
    ev.tt!.push({ at: from, dur: c - from, technique: "crescendo" });
    ev.tamb!.push({ at: from + (c - from) / 2, dur: (c - from) / 2, technique: "roll" });
    ev.sl!.push({ at: from, dur: c - from });
    ev.clash!.push({ at: c, dur: v.choke ? 0.5 : 4, articulations: ["accent"] });
    if (v.choke) ev.clash!.push({ at: c + 0.5, dur: 0.5, technique: "choke" });
    ev.tt!.push({ at: c, dur: 4 });
    ev.bells!.push({ at: c, dur: 4, pitch: { midi: bell(i) } });
  });
  for (let beat = 0; beat < bars * 4; beat++) {
    if (busy.some(([a, b]) => beat >= a && beat < b) || rand() >= v.glints) continue;
    if (rand() < 0.5) ev.tri!.push({ at: beat, dur: 1 });
    else ev.glk!.push({ at: beat, dur: 1, pitch: { midi: bell(Math.floor(rand() * 7)) + 24 } });
  }
  // Run-ups crescendo from p to ff into each crash, then back to p.
  const swell: DynamicPoint[] = crashes.flatMap((c) => [
    { at: Math.max(0, c - v.runUp), level: 3, to: "linear" as const },
    { at: c, level: 7 },
    { at: c + 2, level: 3 },
  ]);
  const flat: DynamicPoint[] = [{ at: 0, level: 4 }];
  const parts: Part[] = [
    { id: "tri", instrument: "triangle", events: ev.tri!, dynamics: flat },
    { id: "glk", instrument: "glockenspiel", events: ev.glk!, dynamics: flat },
    { id: "sl", instrument: "sleigh-bells", events: ev.sl!, dynamics: swell },
    { id: "tamb", instrument: "tambourine", events: ev.tamb!, dynamics: swell },
    { id: "cym", instrument: "suspended-cymbal", events: ev.cym!, dynamics: swell },
    {
      id: "clash",
      instrument: "clash-cymbals",
      events: ev.clash!,
      dynamics: [{ at: 0, level: 7 }],
    },
    { id: "tt", instrument: "tam-tam", events: ev.tt!, dynamics: swell },
    {
      id: "bells",
      instrument: "tubular-bells",
      events: ev.bells!,
      dynamics: [{ at: 0, level: 6 }],
    },
  ];
  return {
    title: "Percussion: metal",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: 72 }],
    measures: bars,
    parts: parts.filter((p) => p.events.length),
  };
}

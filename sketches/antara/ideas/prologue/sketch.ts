// antara, the prologue: a few seconds of the glass before the piece begins. Card: README.md.
//
// The chord of glass as two-grids first sounds it (that sketch's code and values: the chord that
// comes back after the climax), its thirty desks coming in from the top down, one a quintuplet 16th
// after the other, from the first violins' high stopped notes to the basses' lowest desk (G1, just above
// the opening's ground). Soon after all are in, everyone stops at once, softly, and a general pause
// under a fermata leaves only the hall's resonance. The opening's ground begins out of it.

import { fileURLToPath } from "node:url";

import { ensemble } from "../../../../pieces/antara/ensemble.ts";
import type { DynamicPoint, NoteEvent, Part, Score } from "../../../../src/score/types.ts";
import type { Seam } from "../../../../src/sketch/nest.ts";
import { number, resolveValues, type Values } from "../../../../src/sketch/knobs.ts";
import { readStored } from "../../../../src/sketch/run.ts";
import { atomOf, TICKS, time } from "../../between.ts";
import { knobs as glassKnobs, score as glassScore } from "../two-grids-orchestra/sketch.ts";

const BAR = 4 * TICKS;
const A5 = atomOf(5);

export const knobs = {
  noiseLevel: number({
    group: "Sound",
    label: "Cymbal noise",
    value: 1,
    min: 0,
    max: 2,
    step: 0.25,
    help: "A quiet suspended-cymbal roll behind the assembled chord (1 = ppp, 0 = off); damp with the strings",
  }),
  entries: number({
    group: "Time",
    label: "Entries",
    help: "Quintuplet 16ths between one desk's entry and the next, from the top desk down",
    value: 1,
    min: 1,
    max: 5,
    step: 1,
    unit: "atoms",
  }),
  stop: number({
    group: "Time",
    label: "Stop",
    help: "How long the whole chord sounds after the last desk (the basses' lowest) comes in, before everyone stops at once",
    value: 30,
    min: 0,
    max: 60,
    step: 1,
    unit: "atoms",
  }),
  level: number({
    group: "Sound",
    label: "Level",
    help: "How loud each desk grows out of nothing (2 = pp, 3 = p)",
    value: 2,
    min: 1,
    max: 4,
    step: 0.5,
  }),
};

type V = Values<typeof knobs>;

/** The chord of glass as two-grids is set now: its values, and only the chord (no light, no roles). */
function glass(): Score {
  const dir = fileURLToPath(new URL("../two-grids-orchestra", import.meta.url));
  const values = resolveValues(glassKnobs, readStored(dir).values);
  return glassScore({
    ...values,
    chords: 1,
    reflect: "off",
    breath: false,
    homes: false,
    doubled: false,
    horns: false,
    restacks: false,
    meetings: false,
    fixed: 0,
  } as Values<typeof glassKnobs>);
}

const num = (t: NoteEvent["at"]) => (typeof t === "number" ? t : t[0] / t[1]);

export function score(v: V): Score {
  const g = glass();
  // The desks top down (the order two-grids brings them in), each with the tone it first holds.
  const desks = g.parts
    .map((p) => ({ part: p, first: p.events.find((e): e is NoteEvent => e.type !== "text") }))
    .filter((d): d is { part: Part; first: NoteEvent } => d.first !== undefined)
    .sort((a, b) => num(a.first.at) - num(b.first.at));
  const step = v.entries * A5;
  const cut = (desks.length - 1) * step + v.stop * A5;
  const parts: Part[] = desks.map(({ part, first }, i) => {
    const at = i * step;
    const e: NoteEvent = { at: time(at), dur: time(cut - at), pitch: first.pitch };
    if (first.technique) e.technique = first.technique;
    const grown = Math.min(cut, at + TICKS);
    const dynamics: DynamicPoint[] = [
      { at: time(at), level: 0, to: "linear" },
      { at: time(grown), level: v.level },
    ];
    return { ...part, events: [e], dynamics };
  });
  // A thin, unaccented noise under the assembled chord, not another attack in the descent.
  const noiseAt = Math.ceil(((desks.length - 1) * step) / TICKS) * TICKS;
  if (v.noiseLevel > 0 && noiseAt < cut) {
    const cymbal = ensemble.find((p) => p.id === "scym")!;
    parts.push({
      id: cymbal.id,
      instrument: cymbal.instrument,
      name: cymbal.name,
      player: cymbal.player,
      events: [
        {
          type: "text",
          at: time(noiseAt),
          text: "soft felt mallets; no accent",
          placement: "above",
        },
        { at: time(noiseAt), dur: time(cut - noiseAt), technique: "roll" },
        { type: "text", at: time(cut), text: "damp", placement: "above" },
      ],
      dynamics: [
        { at: time(noiseAt), level: 0, to: "linear" },
        { at: time(Math.min(cut, noiseAt + TICKS)), level: v.noiseLevel },
      ],
    });
  }
  // After the cut, the rest of its bar, then a bar of general pause under a fermata: the hall's
  // resonance, as long as it lasts.
  const pause = Math.ceil(cut / BAR) * BAR;
  const rank = (id: string) => ensemble.findIndex((pl) => pl.id === id);
  parts.sort((a, b) => rank(a.id) - rank(b.id));
  return {
    title: "antara · prologue",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: g.tempo?.[0]?.bpm ?? 52 }],
    measures: pause / BAR + 1,
    fermatas: [{ at: time(pause) }],
    // Every player on a staff of their own (docs/decisions/0025).
    pairs: false,
    parts,
  };
}

/** Where a section made of this sketch may stop or start: while the chord holds. */
export function seams(score: Score): Record<string, Seam[]> {
  const out: Record<string, Seam[]> = {};
  for (const p of score.parts) {
    const ns = p.events.filter((e): e is NoteEvent => e.type !== "text");
    out[p.id] = ns.map((n): Seam => [num(n.at), num(n.at) + num(n.dur)]);
  }
  return out;
}

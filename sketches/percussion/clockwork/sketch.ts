// Percussion: dry clockwork. Woodblocks, castanets, guiro, cowbell, anvil, side stick and
// xylophone in a one-bar pattern that drifts apart row by row, with soft ghost notes.
// A sketch of BBC SO's dry percussion, not a proposal for the piece.

import type { NoteEvent, Part, Score } from "../../../src/score/types.ts";
import { number, random, seed, steps, type Values } from "../../../src/sketch/knobs.ts";

const rows = [
  { id: "wbh", instrument: "woodblock-high", name: "Woodblock high" },
  { id: "wbm", instrument: "woodblock-medium", name: "Woodblock mid" },
  { id: "wbl", instrument: "woodblock-low", name: "Woodblock low" },
  { id: "cast", instrument: "castanets", name: "Castanets" },
  { id: "gui", instrument: "guiro", name: "Guiro" },
  { id: "cow", instrument: "cowbell", name: "Cowbell" },
  { id: "anv", instrument: "anvil", name: "Anvil" },
  { id: "ss", instrument: "snare-drum", name: "Side stick", technique: "side-stick" },
  { id: "xyl", instrument: "xylophone", name: "Xylophone", pitch: "F#6" },
];

export const knobs = {
  pattern: steps({
    group: "Pattern",
    label: "Pattern",
    help: "One bar of 16ths per row; each row then drifts on its own",
    rows: rows.map((r) => r.name),
    value: [
      "x...x...x...x...",
      "..x.....x.x.....",
      "......x.......x.",
      ".x.x.....x.x....",
      "x.......x.......",
      "...x.......x....",
      "............x...",
      "....x.......x...",
      "..........x....x",
    ],
  }),
  drift: number({
    group: "Pattern",
    label: "Drift",
    help: "Every this many bars, each row moves one 16th later than the row above it (0: no drift)",
    value: 2,
    min: 0,
    max: 8,
    step: 1,
    unit: "bars",
  }),
  ghosts: number({
    group: "Pattern",
    label: "Ghost notes",
    help: "How likely a soft extra note is on an empty 16th",
    value: 0.06,
    min: 0,
    max: 0.5,
    step: 0.01,
  }),
  bars: number({
    group: "Time",
    label: "Length",
    help: "How many bars",
    value: 16,
    min: 2,
    max: 64,
    step: 1,
    unit: "bars",
  }),
  tempo: number({
    group: "Time",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 96,
    min: 40,
    max: 200,
    step: 2,
    unit: "bpm",
  }),
  seed: seed({ group: "Time", label: "Seed", help: "Where the ghost notes fall", value: 1 }),
};

export function score(v: Values<typeof knobs>): Score {
  const rand = random(v.seed);
  const parts: Part[] = rows.map((r, ri) => {
    const events: NoteEvent[] = [];
    for (let bar = 0; bar < v.bars; bar++) {
      const shift = v.drift > 0 ? (Math.floor(bar / v.drift) * ri) % 16 : 0;
      for (let s = 0; s < 16; s++) {
        const on = v.pattern[ri]![(s - shift + 16) % 16];
        const ghost = !on && rand() < v.ghosts;
        if (!on && !ghost) continue;
        events.push({
          at: bar * 4 + s / 4,
          dur: 0.25,
          technique: r.technique,
          ...(r.pitch ? { pitch: r.pitch } : {}),
          dynamic: ghost ? 2 : 5,
          articulations: ghost ? undefined : s % 4 === 0 ? ["accent"] : undefined,
        });
      }
    }
    return { id: r.id, instrument: r.instrument, name: r.name, events };
  });
  return {
    title: "Percussion: clockwork",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: v.bars,
    parts: parts.filter((p) => p.events.length),
  };
}

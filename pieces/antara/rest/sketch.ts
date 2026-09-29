// Section: a rest for the whole orchestra, as long as a join asks (Join n: How = rest). Placed
// between two sections it is a general pause; it keeps the tempo it is in.

import type { Score } from "../../../src/score/types.ts";
import { number, type Values } from "../../../src/sketch/knobs.ts";

export const knobs = {
  beats: number({
    group: "Rest",
    label: "Length",
    help: "Quarters of silence at most (each join says how many it takes)",
    value: 64,
    min: 1,
    max: 64,
    step: 1,
    unit: "beats",
  }),
};

export function score(v: Values<typeof knobs>): Score {
  return {
    title: "rest",
    meter: [{ measure: 1, beats: 1, beatType: 4 }],
    measures: v.beats,
    parts: [],
  };
}

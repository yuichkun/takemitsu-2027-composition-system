// Section: the palette's "the breaths walk the chord" as it is (sketches/antara/palette/b/breaths-walk).
//
// Seams: a wind may stop where it breathes and start where it comes in again; a string holds one
// tone, so any moment of it will do.

import type { NoteEvent, Score } from "../../../src/score/types.ts";
import type { Seam } from "../../../src/sketch/nest.ts";

export { knobs, score } from "../../../sketches/antara/palette/b/breaths-walk/sketch.ts";

const q = (t: NoteEvent["at"]) => (typeof t === "number" ? t : t[0] / t[1]);
const STRINGS = new Set(["violins-1", "violins-2", "violas", "cellos", "basses"]);

export function seams(score: Score): Record<string, Seam[]> {
  const out: Record<string, Seam[]> = {};
  for (const p of score.parts) {
    const notes = p.events.filter((e): e is NoteEvent => e.type !== "text");
    out[p.id] = STRINGS.has(p.instrument)
      ? notes.map((n): Seam => [q(n.at), q(n.at) + q(n.dur)])
      : notes.flatMap((n) => [q(n.at), q(n.at) + q(n.dur)]);
  }
  return out;
}

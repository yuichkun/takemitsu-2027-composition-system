// Section: the chord of glass between the two grids as it is (sketches/antara/ideas/two-grids).
//
// Seams: a voice may stop or start anywhere while it holds a tone, not while it slides. A
// reflection may stop or start at any of its notes.

import type { NoteEvent, Score } from "../../../src/score/types.ts";
import type { Seam } from "../../../src/sketch/nest.ts";

export { knobs, score } from "../../../sketches/antara/ideas/two-grids/sketch.ts";

const q = (t: NoteEvent["at"]) => (typeof t === "number" ? t : t[0] / t[1]);

export function seams(score: Score): Record<string, Seam[]> {
  const out: Record<string, Seam[]> = {};
  for (const p of score.parts) {
    const notes = p.events.filter((e): e is NoteEvent => e.type !== "text");
    out[p.id] = notes.map((n): Seam => {
      const at = q(n.at);
      const held = n.gliss ? q(n.glissAfter ?? 0) : q(n.dur);
      return held > 0 ? [at, at + held] : at;
    });
  }
  return out;
}

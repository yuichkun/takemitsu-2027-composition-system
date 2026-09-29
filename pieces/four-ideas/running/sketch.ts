// Section: the running strings as they are (sketches/antara/ideas/running), with Yogo's values
// ("My Fav") in values.json.
//
// Seams: a section of strings may stop or start at the head of a group (the accented stroke), where
// a pitch group begins; the basses at any of their notes.

import type { NoteEvent, Score } from "../../../src/score/types.ts";
import type { Seam } from "../../../src/sketch/nest.ts";

export { knobs, score } from "../../../sketches/antara/ideas/running/sketch.ts";

const q = (t: NoteEvent["at"]) => (typeof t === "number" ? t : t[0] / t[1]);

export function seams(score: Score): Record<string, Seam[]> {
  const out: Record<string, Seam[]> = {};
  for (const p of score.parts) {
    const notes = p.events.filter((e): e is NoteEvent => e.type !== "text");
    const heads = notes.filter((n) => n.articulations?.includes("accent"));
    out[p.id] = (p.instrument === "basses" || heads.length === 0 ? notes : heads).map((n) =>
      q(n.at),
    );
  }
  return out;
}

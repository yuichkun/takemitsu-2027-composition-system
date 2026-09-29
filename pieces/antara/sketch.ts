// antara, for orchestra (Takemitsu award 2027). The premise is docs/antara/premise.md; the sound's
// principles are docs/antara/sound.md.
//
// The piece is made of sections written as separate code, each knowing nothing of its neighbours,
// joined here with the operations of src/sketch/join.ts (docs/decisions/0023). A section is worked
// on as a sketch in sketches/ and is that sketch here (its folder's sketch.ts links it: the code and
// the values are the sketch's), so the sketch is where a section gets better and this node is where
// the sections are joined. Card: README.md.

import { Joiner } from "../../src/sketch/join.ts";
import { Motif } from "../../src/sketch/motif.ts";
import type { Context } from "../../src/sketch/nest.ts";
import type { Score } from "../../src/score/types.ts";
import { ensemble, shown } from "./ensemble.ts";

export function score(_values: Record<string, unknown>, ctx: Context): Score {
  const piece = ctx.with({
    ensemble,
    material: { motif: new Motif([{ at: 0, dur: 1, midi: 60 }]) },
    flows: {},
  });
  const J = new Joiner(piece);
  // The sections in order. One so far, so nothing is joined yet.
  J.place(J.section("two-grids"), { at: 0, label: "two-grids" });
  const out = J.score({ title: "antara" });
  // Every player on a staff of their own (docs/decisions/0025).
  return { ...out, pairs: false, parts: shown(out.parts) };
}

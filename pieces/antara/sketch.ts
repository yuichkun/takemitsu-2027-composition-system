// antara, for orchestra (Takemitsu award 2027). The premise is docs/antara/premise.md; the sound's
// principles are docs/antara/sound.md.
//
// The piece is made of sections written as separate code, each knowing nothing of its neighbours,
// joined here with the operations of src/sketch/join.ts (docs/decisions/0023). There are no
// sections yet: the score is the orchestra (ensemble.ts), empty. Card: README.md.

import { number, type Values } from "../../src/sketch/knobs.ts";
import { Joiner } from "../../src/sketch/join.ts";
import { Motif } from "../../src/sketch/motif.ts";
import type { Context } from "../../src/sketch/nest.ts";
import type { Score } from "../../src/score/types.ts";
import { ensemble, shown } from "./ensemble.ts";

export const knobs = {
  bars: number({
    group: "Empty score",
    label: "Bars",
    help: "How many empty bars of 4/4 the score has while there are no sections",
    value: 8,
    min: 1,
    max: 64,
    step: 1,
    unit: "bars",
  }),
  tempo: number({
    group: "Empty score",
    label: "Tempo",
    help: "Quarter notes per minute where no section sets the tempo",
    value: 60,
    min: 30,
    max: 160,
    step: 1,
    unit: "bpm",
  }),
};

export function score(v: Values<typeof knobs>, ctx: Context): Score {
  const piece = ctx.with({
    ensemble,
    material: { motif: new Motif([{ at: 0, dur: 1, midi: 60 }]) },
    flows: {},
  });
  const J = new Joiner(piece);
  const out = J.score({ title: "antara", length: v.bars * 4, bpm: v.tempo });
  // Every player on a staff of their own (docs/decisions/0025).
  return { ...out, pairs: false, parts: shown(out.parts) };
}

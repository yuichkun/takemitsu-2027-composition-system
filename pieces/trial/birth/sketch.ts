// Birth: two slides cross, and where they meet a term stands (palette A "pitch-terms-where-
// betweens-touch", turned around: the slides do not stop, they pass through each other).
//
// For each group of the home chord, one solo string slides up and another down through the whole
// reach the lines of that group will later walk (the set's ups above the standpoint, its downs
// below), at the same speed, so they cross at the standpoint. They swell to their loudest where
// they cross and fade as they go on. The harp sounds the crossing once; the wind that names it
// (it holds the pitch from there) is the first line of the next section, which writes it.
//
// The piece gives the births (params.births): group, time of the crossing, how long the slides
// take, and who slides up and down.

import { number, type Values } from "../../../src/sketch/knobs.ts";
import type { Context } from "../../../src/sketch/nest.ts";
import { glide, Out } from "../engine.ts";
import { reach, type Group, type Trial } from "../material.ts";

export interface Birth {
  group: Group;
  /** Ticks: the crossing. */
  at: number;
  /** Ticks the slides take from end to end. */
  span: number;
  up: string;
  down: string;
}

export const knobs = {
  peak: number({
    group: "Sound",
    label: "Crossing level",
    help: "How loud the slides are where they cross (they come from and go to nothing)",
    value: 2,
    min: 1,
    max: 5,
    step: 0.5,
  }),
};

export function score(v: Values<typeof knobs>, ctx: Context) {
  const trial = ctx.material.trial as Trial;
  const births = (ctx.params.births ?? []) as Birth[];
  const w = ctx.writer();
  const out = new Out(w, Math.round(ctx.start * 60));
  for (const b of births) {
    const [lo, hi] = reach(trial, b.group);
    const anchor = trial.home[b.group];
    // Same speed both ways: each slide covers lo…hi in `span`, and reaches the anchor at b.at.
    const speed = (hi - lo) / b.span;
    const upStart = b.at - (anchor - lo) / speed;
    const downStart = b.at - (hi - anchor) / speed;
    const tail = 30;
    const shape = (player: string, start: number) => {
      out.dyn(player, start, 0);
      out.dyn(player, start + 1, 0, true);
      out.dyn(player, b.at, v.peak, true);
      out.dyn(player, start + b.span, 0);
    };
    glide(out, b.up, Math.round(upStart), Math.round(upStart + b.span), lo, hi, tail, {
      technique: "sul-tasto",
    });
    shape(b.up, Math.round(upStart));
    glide(out, b.down, Math.round(downStart), Math.round(downStart + b.span), hi, lo, tail, {
      technique: "sul-tasto",
    });
    shape(b.down, Math.round(downStart));
    out.note("hp1", b.at, 120, anchor);
    out.dyn("hp1", b.at, 2);
  }
  return w.done();
}

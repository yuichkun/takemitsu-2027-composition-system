// Climax: running figures of the motif's notes over the motif itself in long notes (the cello's
// cantus); both move along the motif's path together, the vibraphone and harp striking where they
// move. Everything grows to one stroke of the whole ensemble on the motif's chord at home, then
// stops.

import { number, type Values } from "../../../src/sketch/knobs.ts";
import type { Context } from "../../../src/sketch/nest.ts";

export const knobs = {
  peak: number({
    group: "Timing",
    label: "Peak",
    help: "Beats before the end where everyone strikes together; the figures and the cantus lead up to it",
    value: 4,
    min: 1,
    max: 16,
    step: 1,
    unit: "beats",
  }),
};

export function score(v: Values<typeof knobs>, ctx: Context) {
  const L = ctx.length;
  const hit = Math.max(0, L - v.peak);
  const cantus = ctx.child("cantus", { at: 0, length: hit });
  const field = ctx.child("field", { at: 0, length: hit });
  const bells = ctx.child("bells", { at: 0, length: hit });
  const strike = ctx.child("strike", { at: hit, length: L - hit, prev: ctx.prev });
  return ctx.merge([cantus, field, bells, strike]);
}

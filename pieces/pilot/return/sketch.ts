// Return: the flute takes the pivot's note and plays the motif backwards, slower; the quartet's
// harmonics move from the return's centre home; the clarinet, which began the piece, says the
// motif again and again, shorter each time, until only its first note is left; harp and
// vibraphone ring that note at the end.

import { number, type Values } from "../../../src/sketch/knobs.ts";
import type { Context } from "../../../src/sketch/nest.ts";

export const knobs = {
  dissolve: number({
    group: "Timing",
    label: "Clarinet from",
    help: "Beats after the start where the clarinet begins to dissolve the motif",
    value: 9,
    min: 0,
    max: 24,
    step: 0.5,
    unit: "beats",
  }),
};

export function score(v: Values<typeof knobs>, ctx: Context) {
  const L = ctx.length;
  const from = Math.min(L, v.dissolve);
  const theme = ctx.child("theme", { at: 0, length: L });
  const liquidation = ctx.child("liquidation", { at: from, length: L - from });
  const halo = ctx.child("halo", { at: 0, length: L, prev: ctx.prev });
  const bells = ctx.child("bells", { at: 0, length: L });
  return ctx.merge([theme, liquidation, halo, bells]);
}

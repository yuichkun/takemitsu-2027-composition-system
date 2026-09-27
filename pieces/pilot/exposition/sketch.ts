// Exposition: the clarinet states the motif and spins it out; the viola answers it upside down
// while the clarinet is still singing; a halo of its pitch classes holds underneath, and the harp
// marks each step of the clarinet's phrase (the theme's marks, passed to the bells).

import { number, type Values } from "../../../src/sketch/knobs.ts";
import type { Context } from "../../../src/sketch/nest.ts";

export const knobs = {
  answer: number({
    group: "Timing",
    label: "Answer enters",
    help: "Beats after the start where the viola's answer comes in, over the clarinet's phrase",
    value: 10,
    min: 0,
    max: 28,
    step: 0.5,
    unit: "beats",
  }),
};

export function score(v: Values<typeof knobs>, ctx: Context) {
  const L = ctx.length;
  const theme = ctx.child("theme", { at: 0, length: L });
  const answer = ctx.child("answer", {
    at: Math.min(v.answer, L),
    length: L - Math.min(v.answer, L),
  });
  const halo = ctx.child("halo", { at: 0, length: L, prev: ctx.prev });
  const bells = ctx.child("bells", { at: 0, length: L, params: { marks: theme.fragment.marks } });
  return ctx.merge([theme, answer, halo, bells]);
}

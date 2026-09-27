// Development: the motif's head passed around the ensemble, the entries coming closer and faster
// until they run into the climax's figures; underneath, a held line in the second violin moves
// along the motif's path, the vibraphone and harp striking where it moves. It begins inside the
// exposition (the piece's Overlap); the held line waits until the exposition's halo has let go.

import { number, type Values } from "../../../src/sketch/knobs.ts";
import type { Context } from "../../../src/sketch/nest.ts";

export const knobs = {
  pedal: number({
    group: "Timing",
    label: "Pedal after",
    help: "Beats after the exposition ends where the held line (and the bells with it) comes in",
    value: 0,
    min: 0,
    max: 16,
    step: 1,
    unit: "beats",
  }),
};

export function score(v: Values<typeof knobs>, ctx: Context) {
  const L = ctx.length;
  const overlap = (ctx.params.overlap as number | undefined) ?? 0;
  const from = Math.min(L, overlap + v.pedal);
  const imitation = ctx.child("imitation", { at: 0, length: L });
  const halo = ctx.child("halo", { at: from, length: L - from, prev: ctx.prev });
  const bells = ctx.child("bells", { at: from, length: L - from });
  return ctx.merge([imitation, halo, bells]);
}

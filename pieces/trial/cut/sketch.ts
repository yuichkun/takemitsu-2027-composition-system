// Cut: the orchestra divides around the point the drift closed in on, and meets where nothing
// can sound.
//
// Each group's axis lies halfway between the drift's last two homes, a quarter tone apart: an
// eighth tone from each, on neither grid. Every pair of players mirrors itself around it: when
// one is a distance above, the other is the same distance below. So a pair always has one foot on
// each grid, and the closest it can come is a quarter tone, one on each side of the axis.
//
// A pair starts on those two nearest pitches (the drift's last two homes, now at once), opens by
// the set's betweens from the smallest to the largest, slowing down, holds wide, then closes by
// them from the largest to the smallest, speeding up and growing softer, back to the quarter tone
// around the axis. The pairs close at their own speeds (one family per group) and all arrive at
// the same moment: where they would meet, nothing is played for a bar. On the other side the two
// players of every pair have passed through each other: each is where the other was, loud, and
// they open again, slowing down, and fade.
//
// A pair is two colours (a string and a wind, say), so crossing the axis swaps which colour is
// above and which below.

import { number, type Values } from "../../../src/sketch/knobs.ts";
import type { Context } from "../../../src/sketch/nest.ts";
import { ATOM, Out, PLAYABLE, type Family } from "../engine.ts";
import type { Group, Trial } from "../material.ts";

export interface Pair {
  upper: string;
  lower: string;
  group: Group;
  family: Family;
  /** Ticks after the section starts that this pair starts to open. */
  delay: number;
}

export const knobs = {
  wide: number({
    group: "Levels",
    label: "Wide",
    help: "Level where the pairs are widest, before they close",
    value: 6,
    min: 3,
    max: 8,
    step: 0.5,
  }),
  close: number({
    group: "Levels",
    label: "Closest",
    help: "Level of the quarter tones around the axis just before the silence",
    value: 1.5,
    min: 0.5,
    max: 4,
    step: 0.5,
  }),
  burst: number({
    group: "Levels",
    label: "Burst",
    help: "Level on the far side of the silence",
    value: 7.5,
    min: 5,
    max: 8,
    step: 0.5,
  }),
};

export function score(v: Values<typeof knobs>, ctx: Context) {
  const trial = ctx.material.trial as Trial;
  const pairs = (ctx.params.pairs ?? []) as Pair[];
  const start = ctx.params.start as number;
  const hole = ctx.params.hole as number;
  const holeLength = ctx.params.holeLength as number;
  const w = ctx.writer();
  const out = new Out(w, Math.round(ctx.start * 60));
  // The set's sizes, smallest first: the opening; largest first: the closing.
  const sizes = [...trial.set].map(Math.abs).sort((a, b) => a - b);
  // Time betweens in atoms: slowing as a pair opens, speeding up as it closes.
  const slowing = [4, 6, 8, 10, 12];
  const quickening = [10, 7, 5, 3, 2];
  const after = hole + holeLength;

  for (const p of pairs) {
    const axis = trial.home[p.group] + trial.axis;
    const atom = ATOM[p.family];
    const up = PLAYABLE[ctx.player(p.upper).instrument]!;
    const down = PLAYABLE[ctx.player(p.lower).instrument]!;
    // Before the silence the upper player is above the axis; after it, below (and the lower
    // player the other way round). Each side must stay inside both players' ranges.
    const room = Math.min(up[1] - axis, axis - down[0], axis - up[0], down[1] - axis);
    const steps: number[] = [];
    let d = 0.25;
    for (const s of sizes) {
      if (d + s > room) break;
      steps.push(s);
      d += s;
    }
    const widest = d;
    const distances = [
      0.25,
      ...steps.map((_, i) => 0.25 + steps.slice(0, i + 1).reduce((a, b) => a + b, 0)),
    ];
    const times = slowing.slice(0, steps.length).map((a) => a * atom);
    const quick = quickening.slice(quickening.length - steps.length).map((a) => a * atom);
    const closeLength = quick.reduce((a, b) => a + b, 0);
    // Opening: from the pair's start, slowing down; closing: speeding up, to arrive a beat
    // before the silence and hold the quarter tone there.
    const openAt = start + p.delay;
    const lastAt = hole - 60;
    const closeAt = lastAt - closeLength;
    const open: { at: number; d: number }[] = [{ at: openAt, d: 0.25 }];
    let t = openAt;
    times.forEach((dt, i) => {
      t += dt;
      open.push({ at: t, d: distances[i + 1]! });
    });
    if (t > closeAt)
      throw new Error(`cut: the pair ${p.upper}/${p.lower} has no time to open before it closes`);
    const closing: { at: number; d: number }[] = [];
    let c = closeAt;
    quick.forEach((dt, i) => {
      closing.push({ at: c, d: distances[distances.length - 1 - i]! });
      c += dt;
    });
    closing.push({ at: lastAt, d: 0.25 });
    const before = [...open, ...closing];
    // After the silence: each where the other was, opening again, slowing.
    const opening: { at: number; d: number }[] = [{ at: after, d: 0.25 }];
    t = after;
    times.forEach((dt, i) => {
      t += dt;
      opening.push({ at: t, d: distances[i + 1]! });
    });
    const end = t + 8 * atom;

    const write = (
      player: string,
      sign: number,
      points: { at: number; d: number }[],
      until: number,
    ) => {
      points.forEach((pt, i) => {
        const next = points[i + 1]?.at ?? until;
        out.note(
          player,
          pt.at,
          next - pt.at,
          axis + sign * pt.d,
          i < points.length - 1 ? { slur: true } : {},
        );
      });
    };
    write(p.upper, 1, before, hole);
    write(p.lower, -1, before, hole);
    write(p.upper, -1, opening, end);
    write(p.lower, 1, opening, end);
    for (const player of [p.upper, p.lower]) {
      out.dyn(player, openAt, v.close + 1, true);
      out.dyn(player, open.at(-1)!.at, v.wide, false);
      out.dyn(player, closeAt, v.wide, true);
      out.dyn(player, lastAt, v.close);
      out.dyn(player, after, v.burst);
      out.dyn(player, after + 30, v.burst, true);
      out.dyn(player, end, 1);
      out.mark(end, `out:${player}`);
    }
    void widest;
  }

  // Time mirrors itself around the silence too: the woodblock strikes faster and softer toward it
  // (its betweens are the set's sizes counted in quarter tones, largest first), the timpani
  // slower and softer away from it (smallest first).
  const counts = sizes.map((x) => Math.round(x * 2));
  let tw = hole;
  counts.forEach((n, i) => {
    tw -= n * ATOM[2];
    out.note("wb", tw, 15, undefined);
    out.dyn("wb", tw, 1.5 + i * 0.5);
  });
  let tt = after;
  counts.forEach((n, i) => {
    tt += n * ATOM[2];
    out.note("timp", tt, 30, trial.home.L + trial.axis - 0.25);
    out.dyn("timp", tt, Math.max(2, v.burst - 1 - i * 1.2));
  });

  // The burst: what has no pitch strikes with it; the lowest group's nearest pitch on the grid
  // of the fixed-pitch instruments is struck too.
  const low = trial.home.L + trial.axis - 0.25;
  out.note("timp", after, 120, low);
  out.dyn("timp", after, v.burst);
  out.note("tam", after, 480, undefined);
  out.dyn("tam", after, v.burst - 0.5);
  out.note("bd", after, 240, undefined);
  out.dyn("bd", after, v.burst - 1);
  out.note("scym", after, 360, undefined, { technique: "roll" });
  out.dyn("scym", after, v.burst - 0.5);
  out.dyn("scym", after + 30, v.burst - 1, true);
  out.dyn("scym", after + 360, 0);
  return w.done();
}

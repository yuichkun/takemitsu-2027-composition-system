// Both sides: around the points no one can play, every relation stands on both grids.
//
// Each group's axis (an eighth tone from the nearest pitches, on neither grid) is now a centre.
// A pair of strings holds a dyad mirrored around it and widens it, step by step, by the set's
// sizes: the two slide away from each other and hold again. Whatever the width, one member of the
// dyad is on the grid of the fixed-pitch instruments and the other is not: the harps, piano,
// celesta and mallets sound the one they can (it changes sides as the dyad widens, whenever a
// step is an odd number of quarter tones), and a wind breathes the other.
//
// A pair stops where its players' range ends: the edge decides its last step. The pairs reach
// their edges one after another; the piece ends when the last, a solo violin and a solo double
// bass around the middle group's axis, reaches the edges of the orchestra, the middle empty.

import { number, type Values } from "../../../src/sketch/knobs.ts";
import type { Context } from "../../../src/sketch/nest.ts";
import { ATOM, gridOf, inOrder, Orders, Out, PLAYABLE, type Family } from "../engine.ts";
import type { Group, Trial } from "../material.ts";

export interface Ring {
  upper: string;
  lower: string;
  group: Group;
  family: Family;
  /** Time betweens in atoms, one per step, taken in turn. */
  time: number[];
  /** Ticks: where the pair starts, on the quarter tone around its axis. */
  enter: number;
  /** A wind that breathes the member the bells cannot sound, at each arrival. */
  breath?: string;
  /** Who takes the lower member over when it goes below `below` (they share the step there). */
  handover?: { player: string; below: number };
}

export const knobs = {
  level: number({
    group: "Levels",
    label: "Level",
    help: "How loud the dyads are (they fade as they widen)",
    value: 3,
    min: 1,
    max: 5,
    step: 0.5,
  }),
  bells: number({
    group: "Levels",
    label: "Bells",
    help: "How loud the fixed-pitch instruments sound their member of each dyad",
    value: 2.5,
    min: 1,
    max: 5,
    step: 0.5,
  }),
  slide: number({
    group: "Time",
    label: "Slide",
    help: "Share of each step spent sliding to the next width (the rest is held)",
    value: 0.3,
    min: 0.1,
    max: 0.8,
    step: 0.05,
  }),
};

/** The fixed-pitch instrument that sounds a pitch, by register. */
function bellFor(pitch: number, turn: number): string | undefined {
  if (pitch < 36) return "pno";
  if (pitch < 60) return turn % 2 ? "hp2" : "pno";
  if (pitch < 72) return turn % 2 ? "hp1" : "hp2";
  if (pitch < 84) return turn % 2 ? "vib" : "cel";
  if (pitch < 96) return turn % 2 ? "glk" : "cel";
  if (pitch <= 108) return "crot";
  return undefined;
}

export function score(v: Values<typeof knobs>, ctx: Context) {
  const trial = ctx.material.trial as Trial;
  const rings = (ctx.params.rings ?? []) as Ring[];
  const w = ctx.writer();
  const out = new Out(w, Math.round(ctx.start * 60));
  const sizes = [...trial.set].map(Math.abs).sort((a, b) => a - b);
  const orders = new Orders(trial.set.length, trial.seed * 613 + 9);
  // The winds' walks: short time betweens, one per between of the set.
  const walkTimes = [2, 3, 1, 4, 2];
  let turn = 0;
  let last = 0;

  for (const r of rings) {
    const axis = trial.home[r.group] + trial.axis;
    const atom = ATOM[r.family];
    const up = PLAYABLE[ctx.player(r.upper).instrument]!;
    const down = PLAYABLE[ctx.player(r.handover?.player ?? r.lower).instrument]!;
    const room = Math.min(up[1] - axis, axis - down[0]);
    // The widths: the set's sizes in turn while they fit, then what is left to the edge.
    const widths = [0.25];
    for (let i = 0; ; i++) {
      const h = widths[widths.length - 1]!;
      const s = sizes[i % sizes.length]!;
      if (h + s <= room + 1e-9) widths.push(h + s);
      else {
        const rest = Math.floor((room - h) * 2) / 2;
        if (rest >= 0.5) widths.push(h + rest);
        break;
      }
    }
    let t = r.enter;
    widths.forEach((h, i) => {
      const dt = r.time[i % r.time.length]! * atom;
      const final = i === widths.length - 1;
      const hold = final ? Math.round((dt * 1.25) / atom) * atom : dt;
      const slideAfter = Math.round((hold * (1 - v.slide)) / atom) * atom;
      const next = widths[i + 1];
      // The lower member: its first player, then (below the handover) the second; both at the step
      // where it passes.
      const low = axis - h;
      const prevLow = axis - (widths[i - 1] ?? h);
      const lowers = !r.handover
        ? [r.lower]
        : low >= r.handover.below
          ? [r.lower]
          : prevLow >= r.handover.below
            ? [r.lower, r.handover.player]
            : [r.handover.player];
      for (const [player, sign] of [
        [r.upper, 1] as [string, number],
        ...lowers.map((p) => [p, -1] as [string, number]),
      ]) {
        if (player === r.lower && r.handover && low < r.handover.below && lowers.length === 2) {
          // The first player hands the pitch over: it holds, without sliding on, and fades.
          out.note(player, t, hold, axis + sign * h, { technique: "sul-tasto" });
          out.dyn(player, t, v.level * 0.8, true);
          out.dyn(player, t + hold - 1, 0);
          continue;
        }
        const pitch = axis + sign * h;
        if (next !== undefined)
          out.note(player, t, hold, pitch, {
            gliss: true,
            glissAfter: [slideAfter, 60] as [number, number],
            technique: "sul-tasto",
          });
        else out.note(player, t, hold, pitch, { technique: "sul-tasto" });
        // pp to p, a little softer as the dyad widens; the last one fades to nothing.
        const lvl = Math.max(2, v.level - i / widths.length);
        out.dyn(player, t, lvl, true);
        out.dyn(player, t + hold - 1, final ? 0 : lvl - 0.4);
      }
      // One member on the fixed-pitch grid: the bells sound it. The other: a wind breathes it.
      const members = [axis + h, axis - h];
      const named = members.find((m) => gridOf(m) === 0)!;
      const other = members.find((m) => gridOf(m) === 1)!;
      const bell = bellFor(named, turn++);
      if (bell) {
        out.note(bell, t, Math.min(hold, 120), named);
        out.dyn(bell, t, v.bells);
      }
      const breath = r.breath;
      const range = breath ? PLAYABLE[ctx.player(breath).instrument]! : undefined;
      if (breath && range && other >= range[0] && other <= range[1]) {
        // Every other arrival the wind walks the set once from the member (the lines of the
        // standpoints, now around one side of a cut) and comes back to it; otherwise it breathes
        // the member alone.
        const order = i % 2 === 1 ? orders.fit(breath, trial.set, other, range) : undefined;
        let at = t + 2 * atom;
        out.dyn(breath, t, 0);
        out.dyn(breath, t + 1, 0, true);
        if (order) {
          const steps = inOrder(trial.set, order);
          const lengths = inOrder(walkTimes, order);
          let p = other;
          out.note(breath, t, 2 * atom, p, { slur: true });
          steps.forEach((b, j) => {
            p += b;
            const dur = lengths[j]! * atom;
            out.note(
              breath,
              at,
              j === steps.length - 1 ? Math.max(dur, hold - (at - t)) : dur,
              p,
              j < steps.length - 1 ? { slur: true } : {},
            );
            at += dur;
          });
          out.dyn(breath, t + 2 * atom, v.level, true);
          out.dyn(breath, t + hold - 1, 0);
        } else {
          out.note(breath, t, Math.min(hold, 12 * atom), other);
          out.dyn(breath, t + atom * 4, v.level - 0.5, true);
          out.dyn(breath, t + Math.min(hold, 12 * atom) - 1, 0);
        }
      }
      t += hold;
    });
    last = Math.max(last, t);
  }
  w.mark((last - Math.round(ctx.start * 60)) / 60, "end");
  return w.done();
}

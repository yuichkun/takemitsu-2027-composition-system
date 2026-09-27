// A strike: everyone at once on one chord of the motif's pitch classes, spread over the whole
// ensemble from the bottom of the lowest player to the top voice, which lands on a chosen note of
// the motif (so it can be the note that stays when the rest stops).

import type { NoteEvent } from "../src/score/types.ts";
import { choice, number, weights, type Values } from "../src/sketch/knobs.ts";
import { classOf } from "../src/sketch/motif.ts";
import type { Context, Fragment, Player } from "../src/sketch/nest.ts";
import {
  balance,
  chosen,
  classesAt,
  fieldAt,
  harpStaff,
  isStrings,
  names,
  nearestOfClass,
  voiceLead,
  weightsFor,
  windowOf,
} from "./common.ts";

export interface StrikeDefaults {
  players: Record<string, number>;
  chord?: "home" | "centre" | "field";
  top?: "last note" | "first note" | "any";
  hit?: number;
  length?: number;
  level?: number;
}

export function strike(ensemble: readonly Player[], d: StrikeDefaults) {
  const knobs = {
    who: weights({
      group: "Who",
      label: "Players",
      help: "Who strikes (0: not). Below 1 plays softer",
      value: weightsFor(ensemble, d.players),
      labels: names(ensemble),
    }),
    chord: choice({
      group: "Chord",
      label: "Chord",
      help: "home: the motif's pitch classes where it is written · centre: at the section's centre · field: every step along its path",
      value: d.chord ?? "home",
      options: ["home", "centre", "field"],
    }),
    top: choice({
      group: "Chord",
      label: "Top note",
      help: "Which note of the motif the highest voice takes",
      value: d.top ?? "last note",
      options: ["last note", "first note", "any"],
    }),
    hit: number({
      group: "Time",
      label: "Hits at",
      help: "Beats after the block starts",
      value: d.hit ?? 0,
      min: 0,
      max: 64,
      step: 0.5,
      unit: "beats",
    }),
    length: number({
      group: "Time",
      label: "Lasts",
      help: "Beats the chord is held",
      value: d.length ?? 2,
      min: 0.25,
      max: 8,
      step: 0.25,
      unit: "beats",
    }),
    level: number({
      group: "Time",
      label: "Dynamic",
      help: "5 mf · 6 f · 7 ff · 8 fff",
      value: d.level ?? 7.5,
      min: 1,
      max: 8,
      step: 0.5,
    }),
  };

  function score(v: Values<typeof knobs>, ctx: Context): Fragment {
    const w = ctx.writer();
    const who = chosen(ctx, v.who).sort((a, b) => {
      const [la, ha] = windowOf(a.player);
      const [lb, hb] = windowOf(b.player);
      return la + ha - (lb + hb);
    });
    if (!who.length) return w.done();
    const m = ctx.material.motif;
    const shift = v.chord === "home" ? 0 : ctx.centre;
    const classes = v.chord === "field" ? fieldAt(m, shift) : classesAt(m, shift);
    const windows = who.map((c) => windowOf(c.player));
    // The lowest voice on the motif's first note near the bottom of its range, the highest on the
    // chosen note high in its range, the others spread evenly between them, each on a class not
    // yet taken where it can.
    const n = who.length;
    const topWindow = windows[n - 1]!;
    const topClass =
      v.top === "last note"
        ? classOf(m.last + shift)
        : v.top === "first note"
          ? classOf(m.first + shift)
          : classes.at(-1)!;
    const top = nearestOfClass(topClass, topWindow[0] + (topWindow[1] - topWindow[0]) * 0.72);
    const bass = n > 1 ? nearestOfClass(classOf(m.first + shift), windows[0]![0] + 4) : top;
    const pitches: number[] = Array.from({ length: n }, () => Number.NaN);
    pitches[n - 1] = top;
    if (n > 1) pitches[0] = bass;
    const taken = new Set([classOf(top), classOf(bass)]);
    for (let i = 1; i < n - 1; i++) {
      const [lo, hi] = windows[i]!;
      const aim = bass + ((top - bass) * i) / (n - 1);
      const nearest = (pool: number[]) => {
        let best: number | undefined;
        for (const c of pool)
          for (const o of [-12, 0, 12]) {
            const p = nearestOfClass(c, aim) + o;
            if (p <= bass || p >= top || p < lo || p > hi || pitches.includes(p)) continue;
            if (best === undefined || Math.abs(p - aim) < Math.abs(best - aim)) best = p;
          }
        return best;
      };
      pitches[i] =
        nearest(classes.filter((c) => !taken.has(c))) ??
        nearest(classes) ??
        voiceLead([aim], classes, [[lo, hi]])[0]!;
      taken.add(classOf(pitches[i]!));
    }
    who.forEach(({ player, weight }, i) => {
      const note: NoteEvent = { at: v.hit, dur: v.length, pitch: { midi: pitches[i]! } };
      // Strings attack with the bow (a held note has no accented sample): the dynamic falls
      // away after the stroke instead.
      if (!isStrings(player)) note.articulations = ["accent"];
      const staff = harpStaff(player, pitches[i]!);
      if (staff) note.staff = staff;
      w.note(player.id, note);
      const level = v.level + balance(weight);
      w.dynamic(player.id, v.hit, level, "linear");
      w.dynamic(player.id, v.hit + v.length, level - 1.5);
    });
    w.mark(v.hit, "strike");
    w.mark(v.hit + v.length, "release");
    return w.done();
  }

  return { knobs, score };
}

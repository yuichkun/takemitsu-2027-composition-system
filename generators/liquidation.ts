// Liquidation: the motif said again and again, each time a note shorter, slower and softer, the
// silences between growing, until one note is left and held to the end (Schoenberg's word for a
// theme giving up what made it itself).

import type { NoteEvent } from "../src/score/types.ts";
import { choice, number, weights, type Auto, type Values } from "../src/sketch/knobs.ts";
import type { Form } from "../src/sketch/motif.ts";
import type { Context, Fragment, Player } from "../src/sketch/nest.ts";
import { balance, chosen, harpStaff, names, snap, weightsFor, windowOf } from "./common.ts";

export interface LiquidationDefaults {
  players: Record<string, number>;
  form?: Form;
  key?: "section" | "home";
  keep?: "head" | "tail";
  slower?: number;
  gap?: number;
  enters?: number;
  dynamic?: Auto;
}

export function liquidation(ensemble: readonly Player[], d: LiquidationDefaults) {
  const knobs = {
    who: weights({
      group: "Who",
      label: "Players",
      help: "Who says it, taking turns in the score's order (0: not)",
      value: weightsFor(ensemble, d.players),
      labels: names(ensemble),
    }),
    form: choice({
      group: "Motif",
      label: "Form",
      help: "P as written, I upside down, R backwards, RI both",
      value: d.form ?? "P",
      options: ["P", "I", "R", "RI"],
    }),
    key: choice({
      group: "Motif",
      label: "Key",
      help: "section: at the section's centre · home: where the motif is written",
      value: d.key ?? "home",
      options: ["section", "home"],
    }),
    keep: choice({
      group: "Motif",
      label: "Keeps",
      help: "head: the last notes go first, it ends on its first note · tail: the first notes go, it ends on its last",
      value: d.keep ?? "head",
      options: ["head", "tail"],
    }),
    enters: number({
      group: "Time",
      label: "Enters",
      help: "Beats after the block starts",
      value: d.enters ?? 0,
      min: 0,
      max: 32,
      step: 0.5,
      unit: "beats",
    }),
    slower: number({
      group: "Time",
      label: "Slowing",
      help: "Each time this much slower (×)",
      value: d.slower ?? 1.3,
      min: 1,
      max: 2,
      step: 0.05,
    }),
    gap: number({
      group: "Time",
      label: "Silence",
      help: "Beats of rest after the first time; it grows with the slowing",
      value: d.gap ?? 1,
      min: 0,
      max: 8,
      step: 0.5,
      unit: "beats",
    }),
    dynamic: number({
      group: "Sound",
      label: "Dynamic",
      help: "Where each time starts. 1 ppp · 2 pp · 3 p. As a ramp it dies away",
      follow: true,
      value: d.dynamic ?? { follow: "ramp", from: 3, to: 1 },
      min: 0,
      max: 8,
      step: 0.5,
    }),
  };

  function score(v: Values<typeof knobs>, ctx: Context): Fragment {
    const w = ctx.writer();
    const who = chosen(ctx, v.who);
    if (!who.length) return w.done();
    const m = ctx.material.motif.as(v.form as Form).transpose(v.key === "home" ? 0 : ctx.centre);
    w.use(m.form);
    let t = v.enters;
    let stretch = 1;
    let near: number | undefined;
    for (let k = 0; k < m.size && t < ctx.length - 0.5; k++) {
      const { player, weight } = who[k % who.length]!;
      const [lo, hi] = windowOf(player);
      const keep = m.size - k;
      let part = (v.keep === "head" ? m.head(keep) : m.tail(keep)).stretch(stretch).onGrid(0.25);
      part = near === undefined ? part.within(lo, hi) : part.near(near).within(lo, hi);
      near = part.first;
      const last = k === m.size - 1 || part.size === 1;
      const level = ctx.value(v.dynamic, t) + balance(weight);
      const end = last ? ctx.length : t + part.length;
      w.dynamic(player.id, t, level, "linear");
      w.dynamic(player.id, end, Math.max(0.5, level - (last ? 1.5 : 0.5)));
      part.tones.forEach((tone, i) => {
        const final = last && i === part.size - 1;
        const note: NoteEvent = {
          at: t + tone.at,
          dur: final ? Math.max(tone.dur, ctx.length - (t + tone.at)) : tone.dur,
          pitch: { midi: tone.midi },
        };
        if (i < part.size - 1) note.slur = true;
        const staff = harpStaff(player, tone.midi);
        if (staff) note.staff = staff;
        w.note(player.id, note);
      });
      w.mark(t, last ? "last" : "again");
      if (last) break;
      t += part.length + snap(v.gap * stretch);
      stretch *= v.slower;
    }
    return w.done();
  }

  return { knobs, score };
}

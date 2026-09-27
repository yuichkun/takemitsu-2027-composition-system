// Imitation: the motif's head passed from player to player, each entry a step further along the
// motif's own path, in P and I (or all four forms), the entries coming closer and the rhythm
// shrinking as the block goes on (stretto and diminution: both may follow a ramp or a flow).

import type { NoteEvent } from "../src/score/types.ts";
import { choice, number, toggle, weights, type Auto, type Values } from "../src/sketch/knobs.ts";
import type { Form } from "../src/sketch/motif.ts";
import type { Context, Fragment, Player } from "../src/sketch/nest.ts";
import {
  band,
  chosen,
  harpStaff,
  names,
  ordered,
  orders,
  snap,
  weightsFor,
  type Order,
} from "./common.ts";

export interface ImitationDefaults {
  players: Record<string, number>;
  order?: Order;
  fragment?: number;
  forms?: "P" | "P and I" | "all four";
  spacing?: Auto;
  pace?: Auto;
  height?: Auto;
  dynamic?: Auto;
  accent?: boolean;
}

/** Rhythm factors a composer would write (then every length is rounded to sixteenths). */
const paces = [0.25, 0.5, 0.75, 1, 1.5, 2];
const nearestPace = (x: number) =>
  paces.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));

export function imitation(ensemble: readonly Player[], d: ImitationDefaults) {
  const knobs = {
    who: weights({
      group: "Who",
      label: "Voices",
      help: "Who takes part (0: not). Below 1 plays softer",
      value: weightsFor(ensemble, d.players),
      labels: names(ensemble),
    }),
    order: choice({
      group: "Who",
      label: "Order",
      help: "Who comes in after whom: as in the score, by register, or from the outer voices inwards",
      value: d.order ?? "outside in",
      options: [...orders],
    }),
    fragment: number({
      group: "Motif",
      label: "Head",
      help: "How many notes of the motif each entry takes, from its start",
      value: d.fragment ?? 3,
      min: 1,
      max: 12,
      step: 1,
      unit: "notes",
    }),
    forms: choice({
      group: "Motif",
      label: "Forms",
      help: "Which forms the entries take, one after another",
      value: d.forms ?? "P and I",
      options: ["P", "P and I", "all four"],
    }),
    spacing: number({
      group: "Time",
      label: "Spacing",
      help: "Beats from one entry to the next. As a ramp, the entries crowd in (stretto)",
      follow: true,
      value: d.spacing ?? { follow: "ramp", from: 4, to: 1 },
      min: 0.25,
      max: 8,
      step: 0.25,
      unit: "beats",
    }),
    pace: number({
      group: "Time",
      label: "Pace",
      help: "The head's rhythm ×: under 1 is faster (diminution)",
      follow: true,
      value: d.pace ?? { follow: "ramp", from: 1, to: 0.5 },
      min: 0.25,
      max: 2,
      step: 0.25,
    }),
    height: number({
      group: "Sound",
      label: "Register",
      help: "Where each entry sits in its player's range: 0 low, 1 high",
      follow: true,
      value: d.height ?? { follow: "height", from: 0.2, to: 0.85 },
      min: 0,
      max: 1,
      step: 0.05,
    }),
    dynamic: number({
      group: "Sound",
      label: "Dynamic",
      help: "1 ppp · 3 p · 5 mf · 7 ff. May follow the piece's intensity",
      follow: true,
      value: d.dynamic ?? { follow: "intensity", from: 3, to: 6.5 },
      min: 0,
      max: 8,
      step: 0.5,
    }),
    accent: toggle({
      group: "Sound",
      label: "Accent the leap",
      help: "An accent on the note each entry leaps to (its longest). BBC SO's solo strings have no accented long note: theirs play as plain long notes",
      value: d.accent ?? false,
    }),
  };

  function score(v: Values<typeof knobs>, ctx: Context): Fragment {
    const w = ctx.writer();
    const voices = ordered(chosen(ctx, v.who), v.order);
    if (!voices.length) return w.done();
    const motif = ctx.material.motif;
    const forms: Form[] =
      v.forms === "P" ? ["P"] : v.forms === "P and I" ? ["P", "I"] : ["P", "I", "R", "RI"];
    const free = new Map<string, number>();
    let t = 0;
    let k = 0;
    let tries = 0;
    while (t < ctx.length - 0.25) {
      const { player, weight } = voices[k % voices.length]!;
      const id = player.id;
      if ((free.get(id) ?? 0) > t + 1e-6) {
        // Still playing its last entry: the next voice takes this one.
        k++;
        if (++tries >= voices.length) {
          t += 0.25;
          tries = 0;
        }
        continue;
      }
      tries = 0;
      const form = forms[k % forms.length]!;
      const pace = nearestPace(ctx.value(v.pace, t));
      const [lo, hi] = band(player, ctx.value(v.height, t), 0.5);
      const head = motif
        .as(form)
        .head(v.fragment)
        .stretch(pace)
        .onGrid(0.25)
        .transpose(ctx.centre + motif.path[k % motif.size]!)
        .within(lo, hi);
      w.use(form);
      const level = ctx.value(v.dynamic, t) + (Math.min(1, weight) - 1) * 3;
      const goal = head.peak;
      w.dynamic(id, t, level - 0.5, "linear");
      w.dynamic(id, t + goal.at, level + 0.5, "linear");
      w.dynamic(id, t + head.length, level - 0.5);
      head.tones.forEach((tone, i) => {
        const note: NoteEvent = { at: t + tone.at, dur: tone.dur, pitch: { midi: tone.midi } };
        if (i < head.size - 1) note.slur = true;
        if (v.accent && tone === goal && head.size > 1) note.articulations = ["accent"];
        const staff = harpStaff(player, tone.midi);
        if (staff) note.staff = staff;
        w.note(id, note);
      });
      w.mark(t, "entry");
      free.set(id, t + head.length);
      t += Math.max(0.25, snap(ctx.value(v.spacing, t)));
      k++;
    }
    return w.done();
  }

  return { knobs, score };
}

// A field: the motif's pitches turned into running figures, one cell per player, each player
// starting the cell at a different note and turning further every few beats (the parts drift apart
// like wheels of a clock). The harmony moves along the motif's path in its own rhythm stretched
// over the block, so a cantus of the motif over the same block (statement, "fill") moves with it.

import type { NoteEvent, Time } from "../src/score/types.ts";
import {
  choice,
  number,
  random,
  seed,
  weights,
  type Auto,
  type Values,
} from "../src/sketch/knobs.ts";
import type { Motif } from "../src/sketch/motif.ts";
import type { Context, Fragment, Player } from "../src/sketch/nest.ts";
import {
  balance,
  band,
  chosen,
  harpStaff,
  isStrings,
  names,
  ordered,
  orders,
  pathSegments,
  snap,
  weightsFor,
  type Order,
} from "./common.ts";

const pulses: Record<string, number> = { "16ths": 4, sextuplets: 6, triplets: 3 };

export interface FieldDefaults {
  players: Record<string, number>;
  order?: Order;
  pulse?: "16ths" | "sextuplets" | "triplets";
  harmony?: "motif" | "hold";
  drift?: number;
  entries?: number;
  density?: Auto;
  dynamic?: Auto;
  height?: Auto;
  touch?: "staccato" | "legato" | "accented";
  accents?: "none" | "beats" | "3+3+2";
  seed?: number;
}

export function field(ensemble: readonly Player[], d: FieldDefaults) {
  const knobs = {
    who: weights({
      group: "Who",
      label: "Players",
      help: "Who plays the figures (0: not). Below 1 plays softer",
      value: weightsFor(ensemble, d.players),
      labels: names(ensemble),
    }),
    order: choice({
      group: "Who",
      label: "Order",
      help: "Who comes in first, when they come in one after another",
      value: d.order ?? "low to high",
      options: [...orders],
    }),
    entries: number({
      group: "Who",
      label: "Entries",
      help: "Beats between one player coming in and the next (0: all at once)",
      value: d.entries ?? 1,
      min: 0,
      max: 8,
      step: 0.5,
      unit: "beats",
    }),
    pulse: choice({
      group: "Figures",
      label: "Pulse",
      help: "Notes per beat",
      value: d.pulse ?? "16ths",
      options: Object.keys(pulses),
    }),
    harmony: choice({
      group: "Figures",
      label: "Harmony",
      help: "motif: moves along the motif's path in its rhythm, stretched over the block · hold: stays on the centre",
      value: d.harmony ?? "motif",
      options: ["motif", "hold"],
    }),
    drift: number({
      group: "Figures",
      label: "Drift",
      help: "Every this many beats each player's cell starts one note later (0: never)",
      value: d.drift ?? 4,
      min: 0,
      max: 16,
      step: 1,
      unit: "beats",
    }),
    density: number({
      group: "Figures",
      label: "Density",
      help: "How many of the notes sound (1: all, the rest are rests). May follow the piece's intensity",
      follow: true,
      value: d.density ?? { follow: "intensity", from: 0.45, to: 1 },
      min: 0,
      max: 1,
      step: 0.05,
    }),
    height: number({
      group: "Sound",
      label: "Register",
      help: "Where the figures sit in each player's range: 0 low, 1 high",
      follow: true,
      value: d.height ?? { follow: "height", from: 0.3, to: 0.9 },
      min: 0,
      max: 1,
      step: 0.05,
    }),
    dynamic: number({
      group: "Sound",
      label: "Dynamic",
      help: "1 ppp · 3 p · 5 mf · 7 ff. May follow the piece's intensity",
      follow: true,
      value: d.dynamic ?? { follow: "intensity", from: 3, to: 7.5 },
      min: 0,
      max: 8,
      step: 0.5,
    }),
    touch: choice({
      group: "Sound",
      label: "Touch",
      help: "staccato (spiccato in the strings) · legato: slurred by the beat · accented: every note leaned on",
      value: d.touch ?? "staccato",
      options: ["staccato", "legato", "accented"],
    }),
    accents: choice({
      group: "Sound",
      label: "Accents",
      help: "none · beats: the first of each beat · 3+3+2: across each pair of beats",
      value: d.accents ?? "3+3+2",
      options: ["none", "beats", "3+3+2"],
    }),
    seed: seed({ group: "Sound", label: "Seed", help: "Where the rests fall", value: d.seed ?? 1 }),
  };

  function score(v: Values<typeof knobs>, ctx: Context): Fragment {
    const w = ctx.writer();
    const who = ordered(chosen(ctx, v.who), v.order);
    const L = ctx.length;
    if (!who.length || L <= 0) return w.done();
    const sub = pulses[v.pulse] ?? 4;
    const m = ctx.material.motif;
    const segments = v.harmony === "motif" ? pathSegments(m, L) : [{ at: 0, dur: L, shift: 0 }];
    const segmentAt = (t: number) => segments.find((s) => t < s.at + s.dur) ?? segments.at(-1)!;
    const rand = random(v.seed);
    who.forEach(({ player, weight }, i) => {
      const id = player.id;
      const entry = v.entries > 0 ? snap(i * v.entries) : 0;
      if (entry >= L) return;
      // The cell for a beat: the motif at the segment's step, placed in the player's band.
      let cell: Motif | undefined;
      let cellKey = "";
      const cellAt = (beat: number) => {
        const seg = segmentAt(beat);
        const [lo, hi] = band(player, ctx.value(v.height, beat), 0.45);
        const key = `${seg.at}:${Math.round(lo)}`;
        if (key !== cellKey) {
          cellKey = key;
          cell = m.transpose(ctx.centre + seg.shift).within(lo, hi);
        }
        return cell!;
      };
      for (let s = Math.ceil(entry * sub); s < L * sub; s++) {
        const t = s / sub;
        if (rand() >= ctx.value(v.density, t)) continue;
        const c = cellAt(Math.floor(t));
        const turn = i + (v.drift > 0 ? Math.floor(t / v.drift) : 0);
        const midi = c.tones[(((s + turn) % c.size) + c.size) % c.size]!.midi;
        const at: Time = sub === 4 ? t : [s, sub];
        const note: NoteEvent = { at, dur: [1, sub], pitch: { midi } };
        const accented =
          v.touch === "accented" ||
          (v.accents === "beats" && s % sub === 0) ||
          (v.accents === "3+3+2" && [0, 3, 6].includes(s % 8));
        if (v.touch === "staccato") {
          if (isStrings(player)) note.technique = "spiccato";
          else note.articulations = ["staccato"];
        }
        if (accented) note.articulations = [...(note.articulations ?? []), "accent"];
        if (v.touch === "legato" && (s + 1) % sub !== 0) note.slur = true;
        const staff = harpStaff(player, midi);
        if (staff) note.staff = staff;
        w.note(id, note);
      }
      for (let t = entry; t < L; t += 1)
        w.dynamic(id, t, ctx.value(v.dynamic, t) + balance(weight), "linear");
      w.dynamic(id, L, ctx.value(v.dynamic, L) + balance(weight));
    });
    w.use("P");
    return w.done();
  }

  return { knobs, score };
}

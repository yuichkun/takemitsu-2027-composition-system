// A pivot: one player holds a single note across a seam. By default the highest note the node
// before ended on, so what was the top of a chord becomes the thread into what follows.

import { choice, number, type Values } from "../src/sketch/knobs.ts";
import type { Context, Fragment, Player } from "../src/sketch/nest.ts";
import { harpStaff, isStrings, names, nearestOfClass, windowOf } from "./common.ts";

export interface PivotDefaults {
  by: string;
  from?: "previous top" | "motif's last" | "motif's first";
  colour?: "harmonics" | "sul tasto" | "ord";
  level?: number;
}

export function pivot(ensemble: readonly Player[], d: PivotDefaults) {
  const knobs = {
    by: choice({
      group: "Note",
      label: "Held by",
      help: "Who holds the note",
      value: d.by,
      options: names(ensemble),
    }),
    from: choice({
      group: "Note",
      label: "Note",
      help: "previous top: the highest note sounding at the end of what came before · the motif's last or first note (at the centre)",
      value: d.from ?? "previous top",
      options: ["previous top", "motif's last", "motif's first"],
    }),
    colour: choice({
      group: "Sound",
      label: "Colour",
      help: "How a string player holds it",
      value: d.colour ?? "harmonics",
      options: ["harmonics", "sul tasto", "ord"],
    }),
    level: number({
      group: "Sound",
      label: "Dynamic",
      help: "Where it starts; it fades by a dynamic and a half to the end. 1 ppp · 2 pp · 3 p",
      value: d.level ?? 2.5,
      min: 0.5,
      max: 6,
      step: 0.5,
    }),
  };

  function score(v: Values<typeof knobs>, ctx: Context): Fragment {
    const w = ctx.writer();
    const player = ctx.playerNamed(v.by);
    const strings = isStrings(player);
    const [lo, hi] = windowOf(player, strings && v.colour === "harmonics");
    const m = ctx.material.motif;
    const tops = Object.values(ctx.prev?.last ?? {}).flatMap((l) => l.pitches);
    const wanted =
      v.from === "previous top" && tops.length
        ? Math.max(...tops)
        : (v.from === "motif's first" ? m.first : m.last) + ctx.centre;
    let midi = wanted;
    if (midi < lo || midi > hi) midi = nearestOfClass(((wanted % 12) + 12) % 12, (lo + hi) / 2);
    w.note(player.id, {
      at: 0,
      dur: ctx.length,
      pitch: { midi },
      ...(strings && v.colour !== "ord"
        ? { technique: v.colour === "harmonics" ? "harmonic" : "sul-tasto" }
        : {}),
      ...(harpStaff(player, midi) ? { staff: harpStaff(player, midi) } : {}),
    });
    w.dynamic(player.id, 0, v.level, "linear");
    w.dynamic(player.id, ctx.length, Math.max(0.5, v.level - 1.5));
    return w.done();
  }

  return { knobs, score };
}

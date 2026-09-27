// Bells: harp and mallets marking moments with the motif's chord: where the block starts or ends,
// every bar, as the harmony moves along the motif's path, or at the moments a sibling marked (its
// phrase steps or cadences, passed down by the parent as params.marks).

import type { NoteEvent } from "../src/score/types.ts";
import { choice, number, weights, type Auto, type Values } from "../src/sketch/knobs.ts";
import { classOf } from "../src/sketch/motif.ts";
import type { Context, Fragment, Mark, Player } from "../src/sketch/nest.ts";
import {
  balance,
  band,
  chosen,
  classesAt,
  harpStaff,
  names,
  nearestOfClass,
  pathSegments,
  weightsFor,
} from "./common.ts";

export interface BellsDefaults {
  players: Record<string, number>;
  when?: "start" | "end" | "bars" | "path" | "phrases" | "cadences";
  key?: "section" | "home";
  chord?: "motif" | "first note" | "last note";
  roll?: "together" | "up";
  height?: number;
  dynamic?: Auto;
  ring?: number;
}

export function bells(ensemble: readonly Player[], d: BellsDefaults) {
  const knobs = {
    who: weights({
      group: "Who",
      label: "Players",
      help: "Who strikes (0: not). Below 1 plays softer",
      value: weightsFor(ensemble, d.players),
      labels: names(ensemble),
    }),
    when: choice({
      group: "When",
      label: "When",
      help: "start or end of the block · bars: every bar · path: as the harmony moves along the motif · phrases or cadences: where the melody beside it steps or closes",
      value: d.when ?? "path",
      options: ["start", "end", "bars", "path", "phrases", "cadences"],
    }),
    ring: number({
      group: "When",
      label: "Ring",
      help: "Beats each stroke is left to sound",
      value: d.ring ?? 3,
      min: 0.5,
      max: 12,
      step: 0.5,
      unit: "beats",
    }),
    key: choice({
      group: "Chord",
      label: "Key",
      help: "section: at the section's centre · home: where the motif is written",
      value: d.key ?? "section",
      options: ["section", "home"],
    }),
    chord: choice({
      group: "Chord",
      label: "Chord",
      help: "motif: all its pitch classes · or one note of it, doubled in octaves",
      value: d.chord ?? "motif",
      options: ["motif", "first note", "last note"],
    }),
    roll: choice({
      group: "Chord",
      label: "Roll",
      help: "together: struck at once · up: spread upwards in sixteenths",
      value: d.roll ?? "up",
      options: ["together", "up"],
    }),
    height: number({
      group: "Sound",
      label: "Register",
      help: "Where the chord sits in each player's range: 0 low, 1 high",
      value: d.height ?? 0.6,
      min: 0,
      max: 1,
      step: 0.05,
    }),
    dynamic: number({
      group: "Sound",
      label: "Dynamic",
      help: "2 pp · 4 mp · 6 f. May follow the piece's intensity",
      follow: true,
      value: d.dynamic ?? { follow: "intensity", from: 2, to: 6 },
      min: 0,
      max: 8,
      step: 0.5,
    }),
  };

  function score(v: Values<typeof knobs>, ctx: Context): Fragment {
    const w = ctx.writer();
    const who = chosen(ctx, v.who);
    const L = ctx.length;
    if (!who.length || L <= 0) return w.done();
    const m = ctx.material.motif;
    const home = v.key === "home" ? 0 : ctx.centre;
    const marks = (ctx.params.marks as Mark[] | undefined) ?? [];
    const strokes: { at: number; shift: number }[] =
      v.when === "start"
        ? [{ at: 0, shift: 0 }]
        : v.when === "end"
          ? [{ at: Math.max(0, L - v.ring), shift: 0 }]
          : v.when === "bars"
            ? Array.from({ length: Math.ceil(L / 4) }, (_, i) => ({ at: i * 4, shift: 0 }))
            : v.when === "path"
              ? pathSegments(m, L).map((s) => ({ at: s.at, shift: s.shift }))
              : marks
                  .filter((k) =>
                    v.when === "cadences" ? k.label === "cadence" : k.label !== "entry",
                  )
                  .map((k) => ({ at: k.at, shift: k.shift ?? 0 }));
    for (const { player, weight } of who) {
      const id = player.id;
      const [lo, hi] = band(player, v.height, 0.35);
      strokes.forEach((s, i) => {
        if (s.at >= L) return;
        const shift = home + s.shift;
        const classes =
          v.chord === "motif"
            ? classesAt(m, shift)
            : [classOf((v.chord === "first note" ? m.first : m.last) + shift)];
        // Close position from the bottom of the band up (one note: it and its octave).
        let pitches = classes
          .map((c) => nearestOfClass(c, lo + 3))
          .map((p) => (p < lo ? p + 12 : p))
          .sort((a, b) => a - b);
        if (pitches.length === 1) pitches = [pitches[0]!, pitches[0]! + 12];
        pitches = pitches.filter((p) => p <= hi + 6);
        const until = Math.min(L, s.at + v.ring, strokes[i + 1]?.at ?? L);
        const level = ctx.value(v.dynamic, s.at) + balance(weight);
        w.dynamic(id, s.at, level);
        if (v.roll === "up" && pitches.length > 1) {
          pitches.forEach((p, j) => {
            const at = s.at + j * 0.25;
            if (at >= until) return;
            const last = j === pitches.length - 1;
            const note: NoteEvent = { at, dur: last ? until - at : 0.25, pitch: { midi: p } };
            const staff = harpStaff(player, p);
            if (staff) note.staff = staff;
            w.note(id, note);
          });
        } else {
          // One chord per staff.
          for (const staff of [1, 2]) {
            const on = pitches.filter((p) => (harpStaff(player, p) ?? 1) === staff);
            if (!on.length) continue;
            const note: NoteEvent = {
              at: s.at,
              dur: until - s.at,
              pitch: on.map((p) => ({ midi: p })),
            };
            if (harpStaff(player, on[0]!)) note.staff = staff;
            w.note(id, note);
          }
        }
      });
    }
    return w.done();
  }

  return { knobs, score };
}

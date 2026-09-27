// A halo: a chord of the motif's pitch classes held by a few players, breathing (each swells and
// fades on its own), moving along the motif's path or back home. Voices keep their common tones and
// move least; the first chord starts from where the players were at the end of the node before.

import type { NoteEvent } from "../src/score/types.ts";
import { choice, number, weights, type Auto, type Values } from "../src/sketch/knobs.ts";
import type { Context, Fragment, Player } from "../src/sketch/nest.ts";
import {
  balance,
  chosen,
  classesAt,
  fieldAt,
  harpStaff,
  isStrings,
  names,
  pathSegments,
  voiceLead,
  weightsFor,
  windowOf,
  type Segment,
} from "./common.ts";

const colours = ["ord", "sul tasto", "harmonics", "tremolo", "sul pont"] as const;
const techniqueOf: Record<string, string | undefined> = {
  ord: undefined,
  "sul tasto": "sul-tasto",
  harmonics: "harmonic",
  tremolo: "tremolo",
  "sul pont": "sul-pont",
};

export interface HaloDefaults {
  players: Record<string, number>;
  chord?: "motif" | "along" | "field";
  moves?: "hold" | "path" | "home";
  colour?: (typeof colours)[number];
  dynamic?: Auto;
  breathe?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export function halo(ensemble: readonly Player[], d: HaloDefaults) {
  const knobs = {
    who: weights({
      group: "Who",
      label: "Players",
      help: "Who holds the chord (0: not playing). Below 1 plays softer than the others",
      value: weightsFor(ensemble, d.players),
      labels: names(ensemble),
    }),
    chord: choice({
      group: "Harmony",
      label: "Chord",
      help: "motif: its pitch classes at the centre · along: with those one step along its path · field: every step along its path",
      value: d.chord ?? "motif",
      options: ["motif", "along", "field"],
    }),
    moves: choice({
      group: "Harmony",
      label: "Moves",
      help: "hold: one chord · path: along the motif's intervals, in its rhythm stretched over the block · home: back to where the motif is written, halfway",
      value: d.moves ?? "hold",
      options: ["hold", "path", "home"],
    }),
    colour: choice({
      group: "Sound",
      label: "Colour",
      help: "How the strings play it (winds, harp and mallets play ord.)",
      value: d.colour ?? "sul tasto",
      options: [...colours],
    }),
    dynamic: number({
      group: "Sound",
      label: "Dynamic",
      help: "1 ppp · 2 pp · 3 p · 4 mp · 5 mf. May follow the piece's intensity",
      follow: true,
      value: d.dynamic ?? { follow: "intensity", from: 1.5, to: 4.5 },
      min: 0,
      max: 8,
      step: 0.5,
    }),
    breathe: number({
      group: "Sound",
      label: "Breathing",
      help: "Each player swells and fades on its own, once in this many beats (0: steady)",
      value: d.breathe ?? 8,
      min: 0,
      max: 24,
      step: 1,
      unit: "beats",
    }),
    fadeIn: number({
      group: "Sound",
      label: "Fade in",
      help: "Beats from nothing at the start",
      value: d.fadeIn ?? 0,
      min: 0,
      max: 16,
      step: 1,
      unit: "beats",
    }),
    fadeOut: number({
      group: "Sound",
      label: "Fade out",
      help: "Beats to nothing at the end",
      value: d.fadeOut ?? 0,
      min: 0,
      max: 16,
      step: 1,
      unit: "beats",
    }),
  };

  function score(v: Values<typeof knobs>, ctx: Context): Fragment {
    const w = ctx.writer();
    const L = ctx.length;
    const harmonic = v.colour === "harmonics";
    const who = chosen(ctx, v.who).sort((a, b) => {
      const [la, ha] = windowOf(a.player, harmonic && isStrings(a.player));
      const [lb, hb] = windowOf(b.player, harmonic && isStrings(b.player));
      return la + ha - (lb + hb);
    });
    if (!who.length || L <= 0) return w.done();
    const m = ctx.material.motif;
    const segments: Segment[] =
      v.moves === "path"
        ? pathSegments(m, L)
        : v.moves === "home"
          ? [
              { at: 0, dur: Math.round(L / 2), shift: 0 },
              { at: Math.round(L / 2), dur: L - Math.round(L / 2), shift: -ctx.centre },
            ]
          : [{ at: 0, dur: L, shift: 0 }];
    const windows = who.map((c) => windowOf(c.player, harmonic && isStrings(c.player)));
    let voices: (number | undefined)[] = who.map((c) => ctx.prev?.last[c.player.id]?.pitches[0]);
    // Each voice's notes: a held pitch, lengthened while the next chord keeps it.
    const held: { at: number; dur: number; midi: number }[][] = who.map(() => []);
    for (const seg of segments) {
      const shift = ctx.centre + seg.shift;
      const classes =
        v.chord === "field"
          ? fieldAt(m, shift)
          : v.chord === "along"
            ? fieldAt(m, shift, 2)
            : classesAt(m, shift);
      const next = voiceLead(voices, classes, windows);
      next.forEach((midi, i) => {
        const line = held[i]!;
        const prev = line.at(-1);
        if (prev && prev.midi === midi && prev.at + prev.dur === seg.at) prev.dur += seg.dur;
        else line.push({ at: seg.at, dur: seg.dur, midi });
      });
      voices = next;
    }
    who.forEach(({ player, weight }, i) => {
      const id = player.id;
      const strings = isStrings(player);
      const technique = strings ? techniqueOf[v.colour] : undefined;
      for (const n of held[i]!) {
        const note: NoteEvent = { at: n.at, dur: n.dur, pitch: { midi: n.midi } };
        if (technique) note.technique = technique;
        const staff = harpStaff(player, n.midi);
        if (staff) note.staff = staff;
        w.note(id, note);
      }
      // Breathing: a slow swell, out of step from one player to the next. Points at the swell's
      // tops and bottoms (hairpins between them), and where the fades begin and end.
      const phase = who.length > 1 ? i / who.length : 0;
      const at = (t: number) =>
        ctx.value(v.dynamic, t) +
        balance(weight) +
        (v.breathe > 0 ? 0.75 * Math.sin(2 * Math.PI * (t / v.breathe + phase)) : 0);
      const fade = (t: number) =>
        Math.min(
          v.fadeIn > 0 ? Math.min(1, t / v.fadeIn) : 1,
          v.fadeOut > 0 ? Math.min(1, (L - t) / v.fadeOut) : 1,
        );
      const times = new Set([0, L, Math.min(L, v.fadeIn), Math.max(0, L - v.fadeOut)]);
      if (v.breathe > 0)
        for (let k = -1; k * v.breathe < L; k++)
          for (const turn of [0.25, 0.75]) {
            const t = Math.round((k + turn - phase) * v.breathe * 4) / 4;
            if (t > 0 && t < L) times.add(t);
          }
      else for (let t = 4; t < L; t += 4) times.add(t);
      const points = [...times].sort((a, b) => a - b);
      points.forEach((t, j) =>
        w.dynamic(
          id,
          t,
          Math.max(0, at(t) * fade(t)),
          j < points.length - 1 ? "linear" : undefined,
        ),
      );
    });
    return w.done();
  }

  return { knobs, score };
}

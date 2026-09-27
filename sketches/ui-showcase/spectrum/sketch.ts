// UI showcase: one chord from a harmonic series, entering and leaving part by part.
// Shows: pitch, partials, toggle, choice, proportions, envelope.
// The music is only there to show the controls; nothing here is a proposal for the piece.

import { instrument } from "../../../src/instruments/catalog.ts";
import type { DynamicPoint, NoteEvent, Part, Score } from "../../../src/score/types.ts";
import {
  choice,
  envelope,
  partials,
  pitch,
  proportions,
  toggle,
  type Values,
} from "../../../src/sketch/knobs.ts";

/** Who may take a partial, low to high. Strings take more than one when the winds run out. */
const pool = [
  { id: "cb", instrument: "basses", strings: true },
  { id: "vc", instrument: "cellos", strings: true },
  { id: "bsn", instrument: "bassoon" },
  { id: "tbn", instrument: "trombone" },
  { id: "hn", instrument: "horn" },
  { id: "va", instrument: "violas", strings: true },
  { id: "cl", instrument: "clarinet" },
  { id: "vn2", instrument: "violins-2", strings: true },
  { id: "ob", instrument: "oboe" },
  { id: "vn1", instrument: "violins-1", strings: true },
  { id: "fl", instrument: "flute" },
];

export const knobs = {
  fundamental: pitch({
    group: "Spectrum",
    label: "Fundamental",
    help: "The pitch whose harmonic series the chord is taken from (it need not sound itself)",
    value: "E1",
    min: "C0",
    max: "C3",
    step: 0.5,
  }),
  partials: partials({
    group: "Spectrum",
    label: "Partials",
    help: "Which partials of the series sound",
    value: [2, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21],
    count: 32,
    fundamental: "fundamental",
  }),
  quarterTones: toggle({
    group: "Spectrum",
    label: "Quarter tones",
    help: "On: partials round to the nearest quarter tone. Off: to the nearest semitone",
    value: true,
  }),
  order: choice({
    group: "Time",
    label: "Entry order",
    help: "In which order the partials come in (and leave, the other way round)",
    value: "bottom up",
    options: ["bottom up", "top down", "together"],
  }),
  form: proportions({
    group: "Time",
    label: "Arc",
    help: "Bars spent bringing the partials in, holding them all, and letting them go",
    value: [4, 4, 4],
    labels: ["enter", "hold", "leave"],
    unit: "bars",
  }),
  swell: envelope({
    group: "Time",
    label: "Dynamics",
    help: "The loudness of the whole chord across the passage",
    value: [
      [0, 0.1],
      [0.55, 0.75],
      [1, 0],
    ],
    ends: ["niente", "ff"],
  }),
};

export function score(v: Values<typeof knobs>): Score {
  const grid = v.quarterTones ? 2 : 1;
  const notes = [...new Set(v.partials)]
    .sort((a, b) => a - b)
    .map((n) => Math.round((v.fundamental + 12 * Math.log2(n)) * grid) / grid);
  // Each pitch to the lowest free player who can play it. When none is free, a string section
  // may take it as a second note, if it lies within an octave of the one it has; else it is left out.
  const load = new Map<string, number[]>();
  for (const m of notes) {
    const fits = (p: (typeof pool)[number]) => {
      const [lo, hi] = instrument(p.instrument).range ?? [0, 127];
      return m >= lo && m <= hi;
    };
    const free = pool.find((p) => fits(p) && !load.has(p.id));
    const shared = pool.find((p) => {
      const has = load.get(p.id);
      return fits(p) && p.strings && has?.length === 1 && Math.abs(has[0]! - m) <= 12;
    });
    const who = free ?? shared;
    if (who) load.set(who.id, [...(load.get(who.id) ?? []), m]);
  }

  const [enter, hold, leave] = v.form;
  const total = (enter! + hold! + leave!) * 4; // quarters
  const players = pool.filter((p) => load.has(p.id));
  // Order the players by their lowest note, then give each an entry and exit time.
  const byPitch = [...players].sort((a, b) => load.get(a.id)![0]! - load.get(b.id)![0]!);
  const order = v.order === "top down" ? byPitch.reverse() : byPitch;
  const n = Math.max(1, order.length - 1);
  // The drawn envelope's own points, so the score gets one hairpin per segment.
  const dynamics: DynamicPoint[] = [...v.swell]
    .sort((a, b) => a[0] - b[0])
    .map(([t, level]) => ({
      at: Math.round(total * t * 4) / 4,
      level: Math.round(level * 7 * 2) / 2,
      to: "linear" as const,
    }));

  const parts: Part[] = players.map((p) => {
    const k = order.indexOf(p);
    const inAt = v.order === "together" ? 0 : Math.round(((enter! * 4) / n) * k);
    // They leave the other way round: the last in is the first out.
    const outAt = v.order === "together" ? total : total - Math.round(((leave! * 4) / n) * k);
    const event: NoteEvent = {
      at: inAt,
      dur: Math.max(1, outAt - inAt),
      pitch: load.get(p.id)!.map((midi) => ({ midi })),
    };
    return { id: p.id, instrument: p.instrument, events: [event], dynamics };
  });

  return {
    title: "Showcase: spectrum",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: 60 }],
    measures: Math.max(1, total / 4),
    parts,
  };
}

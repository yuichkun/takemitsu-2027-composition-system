// Every percussion sound this system can play from BBC SO, one after another, each labelled.
// A reference to listen through, not music. BBC SO has no thunder sheet, ratchet, shaker,
// temple blocks, toms, whip or brake drum: those need samples (samples/README.md).

import type { NoteEvent, Part, Score, TextEvent } from "../../../src/score/types.ts";
import { choice, number, type Values } from "../../../src/sketch/knobs.ts";

type Sound = {
  instrument: string;
  technique?: string;
  label: string;
  pitch?: string;
  long?: boolean;
};
const families: Record<string, Sound[]> = {
  drums: [
    { instrument: "bass-drum", label: "Bass drum" },
    { instrument: "bass-drum", technique: "damped", label: "Bass drum, damped" },
    { instrument: "bass-drum", technique: "muted", label: "Bass drum, muted by hand" },
    { instrument: "bass-drum", technique: "hard-sticks", label: "Bass drum, hard sticks" },
    { instrument: "bass-drum", technique: "superball", label: "Bass drum, superball", long: true },
    { instrument: "bass-drum", technique: "roll", label: "Bass drum, roll", long: true },
    { instrument: "bass-drum", technique: "roll+soft", label: "Bass drum, soft roll", long: true },
    { instrument: "snare-drum", label: "Snare" },
    { instrument: "snare-drum", technique: "rimshot", label: "Snare, rim shot" },
    { instrument: "snare-drum", technique: "side-stick", label: "Snare, side stick" },
    { instrument: "snare-drum", technique: "roll", label: "Snare, roll", long: true },
    { instrument: "tenor-drum", label: "Tenor drum" },
    { instrument: "tenor-drum", technique: "rimshot", label: "Tenor drum, rim shot" },
    { instrument: "tenor-drum", technique: "roll", label: "Tenor drum, roll", long: true },
    { instrument: "military-drum", label: "Military drum" },
    { instrument: "military-drum", technique: "side-stick", label: "Military drum, side stick" },
    { instrument: "military-drum", technique: "roll", label: "Military drum, roll", long: true },
    { instrument: "timpani", pitch: "D2", label: "Timpani" },
    { instrument: "timpani", pitch: "D2", technique: "soft", label: "Timpani, soft sticks" },
    { instrument: "timpani", pitch: "D2", technique: "hotrods", label: "Timpani, hot rods" },
    { instrument: "timpani", pitch: "D2", technique: "damped", label: "Timpani, damped" },
    {
      instrument: "timpani",
      pitch: "D2",
      technique: "roll+soft",
      label: "Timpani, soft roll",
      long: true,
    },
    { instrument: "timpani", pitch: "D2", technique: "roll", label: "Timpani, roll", long: true },
  ],
  metals: [
    { instrument: "suspended-cymbal", label: "Suspended cymbal" },
    { instrument: "suspended-cymbal", technique: "muted", label: "Suspended cymbal, muted" },
    {
      instrument: "suspended-cymbal",
      technique: "hard-sticks",
      label: "Suspended cymbal, hard sticks",
    },
    {
      instrument: "suspended-cymbal",
      technique: "roll",
      label: "Suspended cymbal, roll",
      long: true,
    },
    {
      instrument: "suspended-cymbal",
      technique: "bowed",
      label: "Suspended cymbal, bowed",
      long: true,
    },
    { instrument: "clash-cymbals", label: "Clash cymbals" },
    { instrument: "clash-cymbals", technique: "choke", label: "Clash cymbals, choked" },
    { instrument: "clash-cymbals", technique: "roll", label: "Clash cymbals, roll", long: true },
    { instrument: "tam-tam", label: "Tam-tam", long: true },
    { instrument: "tam-tam", technique: "damped", label: "Tam-tam, damped" },
    { instrument: "tam-tam", technique: "roll", label: "Tam-tam, roll", long: true },
    { instrument: "tam-tam", technique: "bowed", label: "Tam-tam, bowed", long: true },
    { instrument: "tam-tam", technique: "crescendo", label: "Tam-tam, swell", long: true },
    { instrument: "triangle", label: "Triangle" },
    { instrument: "triangle", technique: "muted", label: "Triangle, muted" },
    { instrument: "triangle", technique: "roll", label: "Triangle, roll", long: true },
    { instrument: "anvil", label: "Anvil" },
    { instrument: "anvil", technique: "choke", label: "Anvil, choked" },
    { instrument: "cowbell", label: "Cowbell" },
    { instrument: "sleigh-bells", label: "Sleigh bells", long: true },
    { instrument: "tambourine", label: "Tambourine" },
    { instrument: "tambourine", technique: "shake", label: "Tambourine, shaken", long: true },
    { instrument: "tambourine", technique: "roll", label: "Tambourine, roll", long: true },
  ],
  woods: [
    { instrument: "woodblock-high", label: "Woodblock, high" },
    { instrument: "woodblock-medium", label: "Woodblock, medium" },
    { instrument: "woodblock-low", label: "Woodblock, low" },
    { instrument: "castanets", label: "Castanets" },
    { instrument: "guiro", label: "Guiro, short" },
    { instrument: "guiro", technique: "long", label: "Guiro, long", long: true },
    { instrument: "vibraslap", label: "Vibraslap", long: true },
  ],
  keyboards: [
    { instrument: "glockenspiel", pitch: "E6", label: "Glockenspiel" },
    {
      instrument: "glockenspiel",
      pitch: "E6",
      technique: "roll",
      label: "Glockenspiel, trill",
      long: true,
    },
    { instrument: "xylophone", pitch: "E5", label: "Xylophone" },
    {
      instrument: "xylophone",
      pitch: "E5",
      technique: "roll",
      label: "Xylophone, trill",
      long: true,
    },
    { instrument: "marimba", pitch: "E3", label: "Marimba" },
    { instrument: "marimba", pitch: "E3", technique: "roll", label: "Marimba, trill", long: true },
    { instrument: "vibraphone", pitch: "E4", label: "Vibraphone", long: true },
    { instrument: "crotales", pitch: "E6", label: "Crotales", long: true },
    {
      instrument: "crotales",
      pitch: "E6",
      technique: "bowed",
      label: "Crotales, bowed",
      long: true,
    },
    { instrument: "tubular-bells", pitch: "E4", label: "Tubular bells", long: true },
    {
      instrument: "tubular-bells",
      pitch: "E4",
      technique: "damped",
      label: "Tubular bells, damped",
    },
    {
      instrument: "tubular-bells",
      pitch: "E4",
      technique: "roll",
      label: "Tubular bells, roll",
      long: true,
    },
    { instrument: "harp", pitch: "E3", label: "Harp", long: true },
    { instrument: "harp", pitch: "E3", technique: "damped", label: "Harp, damped" },
    {
      instrument: "harp",
      pitch: "E3",
      technique: "bisbigliando",
      label: "Harp, bisbigliando",
      long: true,
    },
    { instrument: "harp", pitch: "E3", technique: "gliss", label: "Harp, glissando", long: true },
  ],
};

export const knobs = {
  which: choice({
    group: "Listen",
    label: "Family",
    help: "Which sounds to go through",
    value: "all",
    options: ["all", "drums", "metals", "woods", "keyboards"],
  }),
  spacing: number({
    group: "Listen",
    label: "Spacing",
    help: "Beats from one sound to the next (at ♩=60, a beat is a second)",
    value: 4,
    min: 2,
    max: 8,
    step: 1,
    unit: "beats",
  }),
  loudness: number({
    group: "Listen",
    label: "Loudness",
    help: "Dynamic of every sound: 2 pp … 5 mf … 7 ff",
    value: 5,
    min: 1,
    max: 8,
    step: 0.5,
  }),
};

export function score(v: Values<typeof knobs>): Score {
  const sounds = v.which === "all" ? Object.values(families).flat() : families[v.which]!;
  // One part per instrument, in the order they first appear.
  const parts = new Map<string, Part>();
  sounds.forEach((s, i) => {
    const at = i * v.spacing;
    let part = parts.get(s.instrument);
    if (!part) {
      part = {
        id: s.instrument,
        instrument: s.instrument,
        events: [],
        dynamics: [{ at: 0, level: v.loudness }],
      };
      parts.set(s.instrument, part);
    }
    const note: NoteEvent = {
      at,
      dur: s.long ? v.spacing - 0.5 : 1,
      technique: s.technique,
      ...(s.pitch ? { pitch: s.pitch } : {}),
    };
    const label: TextEvent = { type: "text", at, text: s.label };
    part.events.push(label, note);
  });
  return {
    title: `Percussion inventory (${v.which})`,
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: 60 }],
    measures: Math.ceil((sounds.length * v.spacing) / 4),
    parts: [...parts.values()],
  };
}

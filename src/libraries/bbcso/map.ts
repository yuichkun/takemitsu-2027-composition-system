// How catalog instruments and techniques map onto BBC Symphony Orchestra patches.
// Articulation names are the plugin's (see inventory.json); percussion keys come from
// Dorico's BBCSO Pro template (docs/research/bbcso.md §6).

import type { Note } from "../../score/normalize.ts";

export interface PitchedMap {
  kind: "pitched";
  /** BBC SO instrument for a single player. */
  solo?: string;
  /** BBC SO instrument for the section, and how many players it holds. */
  section?: { name: string; size: number };
  family: "strings" | "woodwind" | "brass" | "timpani" | "mallets" | "harp" | "keyboard";
}

export interface UnpitchedMap {
  kind: "unpitched";
  /** Patch inside "Untuned Percussion". */
  articulation: string;
  /** Key per technique ("ord" is the plain hit). */
  keys: Record<string, number>;
}

export type BbcsoMap = PitchedMap | UnpitchedMap;

export const bbcsoMap: Record<string, BbcsoMap> = {
  piccolo: { kind: "pitched", solo: "Piccolo", family: "woodwind" },
  flute: {
    kind: "pitched",
    solo: "Flute",
    section: { name: "Flutes a3", size: 3 },
    family: "woodwind",
  },
  "bass-flute": { kind: "pitched", solo: "Bass Flute", family: "woodwind" },
  oboe: {
    kind: "pitched",
    solo: "Oboe",
    section: { name: "Oboes a3", size: 3 },
    family: "woodwind",
  },
  "cor-anglais": { kind: "pitched", solo: "Cor Anglais", family: "woodwind" },
  clarinet: {
    kind: "pitched",
    solo: "Clarinet",
    section: { name: "Clarinets a3", size: 3 },
    family: "woodwind",
  },
  "bass-clarinet": { kind: "pitched", solo: "Bass Clarinet", family: "woodwind" },
  "contrabass-clarinet": { kind: "pitched", solo: "Contrabass Clarinet", family: "woodwind" },
  bassoon: {
    kind: "pitched",
    solo: "Bassoon",
    section: { name: "Bassoons a3", size: 3 },
    family: "woodwind",
  },
  contrabassoon: { kind: "pitched", solo: "Contrabassoon", family: "woodwind" },
  horn: { kind: "pitched", solo: "Horn", section: { name: "Horns a4", size: 4 }, family: "brass" },
  trumpet: {
    kind: "pitched",
    solo: "Trumpet",
    section: { name: "Trumpets a2", size: 2 },
    family: "brass",
  },
  trombone: {
    kind: "pitched",
    solo: "Tenor Trombone",
    section: { name: "Tenor Trombones a3", size: 3 },
    family: "brass",
  },
  "bass-trombone": {
    kind: "pitched",
    section: { name: "Bass Trombones a2", size: 2 },
    family: "brass",
  },
  "contrabass-trombone": { kind: "pitched", solo: "Contrabass Trombone", family: "brass" },
  cimbasso: { kind: "pitched", solo: "Cimbasso", family: "brass" },
  tuba: { kind: "pitched", solo: "Tuba", family: "brass" },
  "contrabass-tuba": { kind: "pitched", solo: "Contrabass Tuba", family: "brass" },
  timpani: { kind: "pitched", solo: "Timpani", family: "timpani" },
  glockenspiel: { kind: "pitched", solo: "Glockenspiel", family: "mallets" },
  xylophone: { kind: "pitched", solo: "Xylophone", family: "mallets" },
  marimba: { kind: "pitched", solo: "Marimba", family: "mallets" },
  vibraphone: { kind: "pitched", solo: "Vibraphone", family: "mallets" },
  crotales: { kind: "pitched", solo: "Crotales", family: "mallets" },
  "tubular-bells": { kind: "pitched", solo: "Tubular bells", family: "mallets" },
  celesta: { kind: "pitched", solo: "Celeste", family: "keyboard" },
  harp: { kind: "pitched", solo: "Harp", family: "harp" },
  piano: { kind: "pitched", solo: "Discover Piano", family: "keyboard" },
  "violins-1": {
    kind: "pitched",
    solo: "Violin 1 Leader",
    section: { name: "Violins 1", size: 16 },
    family: "strings",
  },
  "violins-2": {
    kind: "pitched",
    solo: "Violin 2 Leader",
    section: { name: "Violins 2", size: 14 },
    family: "strings",
  },
  violas: {
    kind: "pitched",
    solo: "Viola Leader",
    section: { name: "Violas", size: 12 },
    family: "strings",
  },
  cellos: {
    kind: "pitched",
    solo: "Celli Leader",
    section: { name: "Celli", size: 10 },
    family: "strings",
  },
  basses: {
    kind: "pitched",
    solo: "Bass Leader",
    section: { name: "Basses", size: 8 },
    family: "strings",
  },

  anvil: { kind: "unpitched", articulation: "Anvil", keys: { ord: 48, choke: 52 } },
  "bass-drum": {
    kind: "unpitched",
    articulation: "Bass Drum 1",
    keys: { ord: 48, damped: 52, muted: 53, roll: 57, superball: 58 },
  },
  "suspended-cymbal": {
    kind: "unpitched",
    articulation: "Cymbal",
    keys: { ord: 49, muted: 48, "hard-sticks+muted": 53, "hard-sticks": 54, roll: 57, bowed: 58 },
  },
  "military-drum": {
    kind: "unpitched",
    articulation: "Military Drum",
    keys: { ord: 48, rimshot: 52, "side-stick": 54, roll: 57 },
  },
  "clash-cymbals": {
    kind: "unpitched",
    articulation: "Piatti",
    keys: { ord: 52, choke: 48, roll: 57 },
  },
  "snare-drum": {
    kind: "unpitched",
    articulation: "Snare 1",
    keys: { ord: 48, rimshot: 52, "side-stick": 54, roll: 57 },
  },
  "tam-tam": {
    kind: "unpitched",
    articulation: "Tam Tam",
    keys: { ord: 52, damped: 48, roll: 57, bowed: 58, crescendo: 59 },
  },
  tambourine: {
    kind: "unpitched",
    articulation: "Tambourine",
    keys: { ord: 48, shake: 52, roll: 57 },
  },
  "tenor-drum": {
    kind: "unpitched",
    articulation: "Tenor Drum",
    keys: { ord: 48, rimshot: 52, "side-stick": 54, roll: 57 },
  },
  castanets: { kind: "unpitched", articulation: "Toys", keys: { ord: 48 } },
  "woodblock-low": { kind: "unpitched", articulation: "Toys", keys: { ord: 52 } },
  "woodblock-medium": { kind: "unpitched", articulation: "Toys", keys: { ord: 53 } },
  vibraslap: { kind: "unpitched", articulation: "Toys", keys: { ord: 54 } },
  "woodblock-high": { kind: "unpitched", articulation: "Toys", keys: { ord: 55 } },
  cowbell: { kind: "unpitched", articulation: "Toys", keys: { ord: 57 } },
  "sleigh-bells": { kind: "unpitched", articulation: "Toys", keys: { ord: 58 } },
  guiro: { kind: "unpitched", articulation: "Toys", keys: { ord: 59, long: 60 } },
  triangle: { kind: "unpitched", articulation: "Triangle", keys: { ord: 48, muted: 52, roll: 57 } },
};

/** A note's articulation choice: the plugin articulation, and whether it only approximates the score. */
export interface Choice {
  articulation: string;
  approximate?: string;
}

const has = (t: string[], x: string) => t.includes(x);

/**
 * Picks the BBC SO articulation for a pitched note, falling back when the patch set lacks it.
 * `seconds` is the note's sounding length; `available` lists the instrument's articulations.
 */
export function chooseArticulation(
  map: PitchedMap,
  note: Note,
  seconds: number,
  available: Set<string>,
): Choice {
  const t = note.technique;
  const a = note.articulations;
  const short = a.includes("staccato") || a.includes("staccatissimo");
  const accented = a.includes("accent") || a.includes("marcato");
  const wants: string[] = [];

  switch (map.family) {
    case "strings":
      if (has(t, "pizz")) wants.push("Short Pizzicato");
      else if (has(t, "bartok-pizz")) wants.push("Short Pizzicato Bartok", "Short Pizzicato");
      else if (has(t, "col-legno")) wants.push("Short Col Legno");
      else if (has(t, "harmonic"))
        wants.push(seconds < 0.5 ? "Short Harmonics" : "Long Harmonics", "Long Harmonics");
      else if (has(t, "tremolo") && has(t, "sul-pont")) wants.push("Tremolo Sul Pont", "Tremolo");
      else if (has(t, "tremolo") && has(t, "con-sord")) wants.push("Tremolo CS", "Tremolo");
      else if (has(t, "tremolo")) wants.push("Tremolo");
      else if (note.trill) wants.push(note.trill === 1 ? "Trill (Minor 2nd)" : "Trill (Major 2nd)");
      else if (short && has(t, "con-sord"))
        wants.push("Short Spiccato CS", "Short Spicc CS", "Short Spiccato");
      else if (a.includes("staccatissimo")) wants.push("Short Spiccato", "Short Staccato");
      else if (a.includes("staccato")) wants.push("Short Staccato", "Short Spiccato");
      else if (accented && seconds < 0.5)
        wants.push("Short Marcato", "Long Marcato Attack", "Short Spiccato");
      else if (has(t, "sul-pont")) wants.push("Long Sul Pont", "Long");
      else if (has(t, "sul-tasto")) wants.push("Long Sul Tasto", "Long Flautando", "Long");
      else if (has(t, "flautando")) wants.push("Long Flautando", "Long Sul Tasto", "Long");
      else if (has(t, "con-sord")) wants.push("Long CS", "Long");
      else if (accented) wants.push("Long Marcato Attack", "Long");
      else if (note.slur) wants.push("Legato", "Long");
      wants.push("Long");
      break;
    case "woodwind":
    case "brass": {
      const muted = has(t, "muted");
      const m = (s: string) => (muted ? `${s} (Muted)` : s);
      if (has(t, "flutter")) wants.push("Long Flutter");
      else if (has(t, "multitongue")) wants.push("Multitongue");
      else if (note.trill) wants.push(note.trill === 1 ? "Trill (Minor 2nd)" : "Trill (Major 2nd)");
      else if (has(t, "cuivre")) wants.push("Long Cuivre");
      else if (has(t, "sfz")) wants.push("Long Sfz");
      else if (short) wants.push(m("Short Staccatissimo"), "Short Staccatissimo");
      else if (a.includes("tenuto") && seconds < 0.5) wants.push("Short Tenuto");
      else if (accented && seconds < 0.5) wants.push(m("Short Marcato"), "Short Marcato");
      else if (note.slur && !muted) wants.push("Legato");
      wants.push(m("Long"), "Long");
      break;
    }
    case "timpani":
      if (has(t, "roll"))
        wants.push(
          has(t, "soft")
            ? "Long Rolls Soft"
            : has(t, "hotrods")
              ? "Long Rolls Hotrods"
              : "Long Rolls",
        );
      else if (has(t, "damped"))
        wants.push(
          has(t, "soft")
            ? "Short Hits Damped Soft"
            : has(t, "hotrods")
              ? "Hotrods Hits Damped"
              : "Short Hits Damped",
        );
      else if (has(t, "soft")) wants.push("Short Hits Soft");
      else if (has(t, "hotrods")) wants.push("Short Hits Hotrods");
      wants.push("Short Hits");
      break;
    case "mallets":
      if (has(t, "roll")) wants.push("Long Trills", "Long Rolls");
      else if (has(t, "bowed")) wants.push("Short Hits Bowed");
      else if (has(t, "damped")) wants.push("Short Hits Damped");
      wants.push("Short Hits");
      break;
    case "harp":
      if (has(t, "bisbigliando")) wants.push("Long Bisbigliando Trem");
      else if (has(t, "damped")) wants.push("Short Damped");
      wants.push("Short Sustained");
      break;
    case "keyboard":
      if (has(t, "damped")) wants.push("Short Damped");
      wants.push("Short Sustained", "Piano");
      break;
  }

  const first = wants[0]!;
  const found = wants.find((w) => available.has(w));
  if (!found) throw new Error(`No usable articulation among ${wants.join(", ")}`);
  const asked = [...t, ...a].join("+") || "ord";
  return found === first || asked === "ord"
    ? { articulation: found }
    : { articulation: found, approximate: `${asked} → ${found}` };
}

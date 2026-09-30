// antara's orchestra (docs/decisions/0024-antara-orchestra.md, 0025), in score order.
//
// Woodwinds in threes, the third of each family on its own instrument throughout (piccolo, English
// horn, bass clarinet, contrabassoon: no one changes instruments); brass 4.3.3.1 with a bass trombone;
// timpani and three percussionists; two harps, the second with every string a quarter tone low; piano
// and celesta; strings 16.14.12.10.8.
//
// Each string section is written in the parts the music asks for: all together (t), its principal
// alone (s), the others (r), or divided into n parts, from two up to one a desk of two players
// (vn1-8-3: the first violins in eight, the third from the top). Parts of one section that sound at
// once never add up to more players than the section has (the score warns if they do).

import type { Player } from "../../src/sketch/nest.ts";

const winds: Player[] = [
  { id: "picc", instrument: "piccolo", name: "Piccolo" },
  { id: "fl1", instrument: "flute", name: "Flute 1" },
  { id: "fl2", instrument: "flute", name: "Flute 2" },
  { id: "ob1", instrument: "oboe", name: "Oboe 1" },
  { id: "ob2", instrument: "oboe", name: "Oboe 2" },
  { id: "eh", instrument: "cor-anglais", name: "English Horn" },
  { id: "cl1", instrument: "clarinet", name: "Clarinet 1" },
  { id: "cl2", instrument: "clarinet", name: "Clarinet 2" },
  { id: "bcl", instrument: "bass-clarinet", name: "Bass Clarinet" },
  { id: "bn1", instrument: "bassoon", name: "Bassoon 1" },
  { id: "bn2", instrument: "bassoon", name: "Bassoon 2" },
  { id: "cbn", instrument: "contrabassoon", name: "Contrabassoon" },
  { id: "hn1", instrument: "horn", name: "Horn 1" },
  { id: "hn2", instrument: "horn", name: "Horn 2" },
  { id: "hn3", instrument: "horn", name: "Horn 3" },
  { id: "hn4", instrument: "horn", name: "Horn 4" },
  { id: "tp1", instrument: "trumpet", name: "Trumpet 1" },
  { id: "tp2", instrument: "trumpet", name: "Trumpet 2" },
  { id: "tp3", instrument: "trumpet", name: "Trumpet 3" },
  { id: "tb1", instrument: "trombone", name: "Trombone 1" },
  { id: "tb2", instrument: "trombone", name: "Trombone 2" },
  { id: "btb", instrument: "bass-trombone", name: "Bass Trombone" },
  { id: "tba", instrument: "tuba", name: "Tuba" },
];

const percussion: Player[] = [
  { id: "timp", instrument: "timpani", name: "Timpani" },
  // Percussion 1: high metal.
  { id: "crot", instrument: "crotales", name: "Crotales", player: "p1" },
  { id: "glk", instrument: "glockenspiel", name: "Glockenspiel", player: "p1" },
  { id: "scym", instrument: "suspended-cymbal", name: "Suspended Cymbal", player: "p1" },
  { id: "shak", instrument: "shaker", name: "Shaker", player: "p1" },
  // Percussion 2: held metal.
  { id: "vib", instrument: "vibraphone", name: "Vibraphone", player: "p2" },
  { id: "tam", instrument: "tam-tam", name: "Tam-tam", player: "p2" },
  { id: "thsh", instrument: "thunder-sheet", name: "Thunder Sheet", player: "p2" },
  { id: "ratch", instrument: "ratchet", name: "Ratchet", player: "p2" },
  // Percussion 3: low, and what keeps time.
  { id: "mar", instrument: "marimba", name: "Marimba", player: "p3" },
  { id: "tub", instrument: "tubular-bells", name: "Tubular Bells", player: "p3" },
  { id: "bd", instrument: "bass-drum", name: "Bass Drum", player: "p3" },
  { id: "wbh", instrument: "woodblock-high", name: "Woodblock (high)", player: "p3" },
  { id: "wbm", instrument: "woodblock-medium", name: "Woodblock (medium)", player: "p3" },
  { id: "wbl", instrument: "woodblock-low", name: "Woodblock (low)", player: "p3" },
  // The climax's last stroke, where everything is cut off.
  { id: "vslap", instrument: "vibraslap", name: "Vibraslap", player: "p3" },
];

const harpsAndKeyboards: Player[] = [
  { id: "hp1", instrument: "harp", name: "Harp 1" },
  // Every string a quarter tone low (said on the score's first pages). Written at sounding pitch;
  // `tuning` only lets the check know its pitches sit a quarter tone off the semitones.
  { id: "hp2", instrument: "harp", name: "Harp 2", tuning: -0.5 },
  { id: "pno", instrument: "piano", name: "Piano" },
  { id: "cel", instrument: "celesta", name: "Celesta" },
];

/** A string section's parts: s (the principal), r (the rest), a b (halves), q1–q4 (quarters, top down), t (all). */
function section(key: string, instrument: string, name: string, size: number): Player[] {
  const out: Player[] = [
    { id: `${key}t`, instrument, name, players: size },
    { id: `${key}s`, instrument, name: `${name} solo`, players: 1 },
    { id: `${key}r`, instrument, name, players: size - 1 },
  ];
  // Divided into n parts, from two up to one part a desk (two players): the larger shares at the top.
  for (let n = 2; n <= Math.floor(size / 2); n++)
    for (let k = 1; k <= n; k++)
      out.push({
        id: `${key}-${n}-${k}`,
        instrument,
        name: `${name} ${k}/${n}`,
        players: Math.floor(size / n) + (k <= size % n ? 1 : 0),
      });
  return out;
}

export const STRING_SECTIONS = ["vn1", "vn2", "va", "vc", "cb"] as const;

const strings: Player[] = [
  ...section("vn1", "violins-1", "Violin I", 16),
  ...section("vn2", "violins-2", "Violin II", 14),
  ...section("va", "violas", "Viola", 12),
  ...section("vc", "cellos", "Violoncello", 10),
  ...section("cb", "basses", "Double Bass", 8),
];

export const ensemble: Player[] = [...winds, ...percussion, ...harpsAndKeyboards, ...strings];

/**
 * The parts a score shows: every wind, percussion, harp and keyboard part; of each string section,
 * the parts that play, or the whole section's part when none of them does.
 */
export function shown<P extends { id: string; events: unknown[] }>(parts: P[]): P[] {
  const sectionOf = (id: string) =>
    STRING_SECTIONS.find((k) => new RegExp(`^${k}(t|s|r|-\\d+-\\d+)$`).test(id));
  const playing = new Set(parts.filter((p) => p.events.length).map((p) => sectionOf(p.id)));
  return parts.filter((p) => {
    const key = sectionOf(p.id);
    if (!key) return true;
    return playing.has(key) ? p.events.length > 0 : p.id === `${key}t`;
  });
}

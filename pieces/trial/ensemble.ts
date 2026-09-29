// The trial piece's players: the largest orchestra the Takemitsu award allows (docs/competition.md).
// Woodwinds in threes, the third of each doubling (piccolo, English horn, bass clarinet,
// contrabassoon); brass 4.3.3.1; timpani and three percussionists; two harps, piano and celesta;
// strings 16.14.12.10.8.
//
// Each string section is written in the parts the music asks for: its principal alone, the others
// ("rest"), two halves, four quarters, or all together. Parts of one section that sound at once
// never add up to more players than the section has (the score warns if they do); the ones a
// version of the piece does not use are left out of its score.

import type { Player } from "../../src/sketch/nest.ts";

const winds: Player[] = [
  { id: "fl1", instrument: "flute", name: "Flute 1" },
  { id: "fl2", instrument: "flute", name: "Flute 2" },
  { id: "fl3", instrument: "flute", name: "Flute 3", player: "fl3" },
  { id: "picc", instrument: "piccolo", name: "Piccolo", player: "fl3" },
  { id: "ob1", instrument: "oboe", name: "Oboe 1" },
  { id: "ob2", instrument: "oboe", name: "Oboe 2" },
  { id: "ob3", instrument: "oboe", name: "Oboe 3", player: "ob3" },
  { id: "eh", instrument: "cor-anglais", name: "English Horn", player: "ob3" },
  { id: "cl1", instrument: "clarinet", name: "Clarinet 1" },
  { id: "cl2", instrument: "clarinet", name: "Clarinet 2" },
  { id: "cl3", instrument: "clarinet", name: "Clarinet 3", player: "cl3" },
  { id: "bcl", instrument: "bass-clarinet", name: "Bass Clarinet", player: "cl3" },
  { id: "bn1", instrument: "bassoon", name: "Bassoon 1" },
  { id: "bn2", instrument: "bassoon", name: "Bassoon 2" },
  { id: "bn3", instrument: "bassoon", name: "Bassoon 3", player: "bn3" },
  { id: "cbn", instrument: "contrabassoon", name: "Contrabassoon", player: "bn3" },
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
  { id: "glk", instrument: "glockenspiel", name: "Glockenspiel", player: "p1" },
  { id: "crot", instrument: "crotales", name: "Crotales", player: "p1" },
  { id: "scym", instrument: "suspended-cymbal", name: "Suspended Cymbal", player: "p1" },
  { id: "vib", instrument: "vibraphone", name: "Vibraphone", player: "p2" },
  { id: "tam", instrument: "tam-tam", name: "Tam-tam", player: "p2" },
  { id: "bd", instrument: "bass-drum", name: "Bass Drum", player: "p2" },
  { id: "mar", instrument: "marimba", name: "Marimba", player: "p3" },
  { id: "tub", instrument: "tubular-bells", name: "Tubular Bells", player: "p3" },
  { id: "wb", instrument: "woodblock-medium", name: "Woodblock", player: "p3" },
];

const keyboards: Player[] = [
  { id: "hp1", instrument: "harp", name: "Harp 1" },
  { id: "hp2", instrument: "harp", name: "Harp 2" },
  { id: "pno", instrument: "piano", name: "Piano" },
  { id: "cel", instrument: "celesta", name: "Celesta" },
];

/** A string section's parts: s (the principal), r (the rest), a b (halves), q1–q4 (quarters, top down), t (all). */
function section(key: string, instrument: string, name: string, size: number): Player[] {
  const half = Math.ceil(size / 2);
  const quarter = (i: number) => Math.floor(size / 4) + (i < size % 4 ? 1 : 0);
  return [
    { id: `${key}s`, instrument, name: `${name} solo`, players: 1 },
    { id: `${key}r`, instrument, name, players: size - 1 },
    { id: `${key}a`, instrument, name: `${name} a`, players: half },
    { id: `${key}b`, instrument, name: `${name} b`, players: size - half },
    ...[0, 1, 2, 3].map((i) => ({
      id: `${key}q${i + 1}`,
      instrument,
      name: `${name} ${i + 1}`,
      players: quarter(i),
    })),
    { id: `${key}t`, instrument, name, players: size },
  ];
}

const strings: Player[] = [
  ...section("vn1", "violins-1", "Violin I", 16),
  ...section("vn2", "violins-2", "Violin II", 14),
  ...section("va", "violas", "Viola", 12),
  ...section("vc", "cellos", "Violoncello", 10),
  ...section("cb", "basses", "Double Bass", 8),
];

export const ensemble: Player[] = [...winds, ...percussion, ...keyboards, ...strings];

/** Parts that are divisions of a string section: left out of the score when they never play. */
export const optional = new Set(strings.map((p) => p.id));

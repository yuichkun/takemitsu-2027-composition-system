// The pilot's players: flute, clarinet, vibraphone, harp and a solo string quartet.

import type { Player } from "../../src/sketch/nest.ts";

export const ensemble: Player[] = [
  { id: "fl", instrument: "flute", name: "Flute", abbreviation: "Fl." },
  { id: "cl", instrument: "clarinet", name: "Clarinet", abbreviation: "Cl." },
  { id: "vib", instrument: "vibraphone", name: "Vibraphone", abbreviation: "Vib." },
  { id: "hp", instrument: "harp", name: "Harp", abbreviation: "Hp." },
  { id: "vn1", instrument: "violins-1", name: "Violin I", abbreviation: "Vn. I", players: 1 },
  { id: "vn2", instrument: "violins-2", name: "Violin II", abbreviation: "Vn. II", players: 1 },
  { id: "va", instrument: "violas", name: "Viola", abbreviation: "Va.", players: 1 },
  { id: "vc", instrument: "cellos", name: "Cello", abbreviation: "Vc.", players: 1 },
];

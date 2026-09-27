// The halo: the motif's pitch classes held by two violins and the cello, breathing.

import { halo } from "../../../../generators/halo.ts";
import { ensemble } from "../../ensemble.ts";

export const { knobs, score } = halo(ensemble, {
  players: { "Violin I": 0.8, "Violin II": 1, Cello: 1 },
  colour: "sul tasto",
  fadeIn: 4,
});

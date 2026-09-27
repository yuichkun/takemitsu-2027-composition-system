// Harmonics in the quartet, from the return's centre home to where the motif is written.

import { halo } from "../../../../generators/halo.ts";
import { ensemble } from "../../ensemble.ts";

export const { knobs, score } = halo(ensemble, {
  players: { "Violin I": 0.8, "Violin II": 1, Viola: 1, Cello: 1 },
  colour: "harmonics",
  moves: "home",
  fadeOut: 6,
  dynamic: { follow: "intensity", from: 1.5, to: 4 },
});

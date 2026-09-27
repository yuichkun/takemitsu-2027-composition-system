// A held line in the second violin, moving along the motif's path.

import { halo } from "../../../../generators/halo.ts";
import { ensemble } from "../../ensemble.ts";

export const { knobs, score } = halo(ensemble, {
  players: { "Violin II": 1 },
  moves: "path",
  colour: "ord",
  breathe: 0,
  dynamic: { follow: "intensity", from: 2, to: 5 },
});

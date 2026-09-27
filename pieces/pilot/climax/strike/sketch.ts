// Everyone at once on the motif's chord at home, the first violin on top with its last note.

import { strike } from "../../../../generators/strike.ts";
import { ensemble } from "../../ensemble.ts";

export const { knobs, score } = strike(ensemble, {
  players: {
    Flute: 1,
    Clarinet: 1,
    Vibraphone: 1,
    Harp: 1,
    "Violin I": 1,
    "Violin II": 1,
    Viola: 1,
    Cello: 1,
  },
  level: 7,
});

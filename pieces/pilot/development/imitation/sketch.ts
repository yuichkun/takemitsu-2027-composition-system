// The motif's head passed around, closer and faster: stretto and diminution.

import { imitation } from "../../../../generators/imitation.ts";
import { ensemble } from "../../ensemble.ts";

export const { knobs, score } = imitation(ensemble, {
  players: { Flute: 1, Clarinet: 1, "Violin I": 1, Viola: 1, Cello: 1 },
});

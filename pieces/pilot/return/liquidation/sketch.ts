// The clarinet says the motif again and again, shorter each time, until its first note is left.

import { liquidation } from "../../../../generators/liquidation.ts";
import { ensemble } from "../../ensemble.ts";

export const { knobs, score } = liquidation(ensemble, {
  players: { Clarinet: 1 },
});

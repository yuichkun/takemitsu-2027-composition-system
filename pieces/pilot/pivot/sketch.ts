// The pivot: the first violin keeps the top note of the strike through the breath.

import { pivot } from "../../../generators/pivot.ts";
import { ensemble } from "../ensemble.ts";

export const { knobs, score } = pivot(ensemble, {
  by: "Violin I",
});

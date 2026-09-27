// The cantus: the motif in the cello, stretched over the whole build-up.

import { statement } from "../../../../generators/statement.ts";
import { ensemble } from "../../ensemble.ts";

export const { knobs, score } = statement(ensemble, {
  by: "Cello",
  phrase: "fill",
  octave: -1,
  touch: "tenuto",
  hairpins: "none",
  dynamic: { follow: "intensity", from: 4.5, to: 7 },
});

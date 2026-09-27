// The theme: the clarinet states the motif and spins it out, a step along its own path each time.

import { statement } from "../../../../generators/statement.ts";
import { ensemble } from "../../ensemble.ts";

export const { knobs, score } = statement(ensemble, {
  by: "Clarinet",
  phrase: "spin out",
  dynamic: { follow: "intensity", from: 2.5, to: 6 },
});

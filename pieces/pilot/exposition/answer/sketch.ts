// The answer: the viola, the motif upside down a fourth higher, over the clarinet's phrase.

import { statement } from "../../../../generators/statement.ts";
import { ensemble } from "../../ensemble.ts";

export const { knobs, score } = statement(ensemble, {
  by: "Viola",
  form: "I",
  transpose: 5,
  phrase: "spin out",
  dynamic: { follow: "intensity", from: 2, to: 5.5 },
});

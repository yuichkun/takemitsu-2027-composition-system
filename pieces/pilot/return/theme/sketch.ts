// The motif backwards on the flute, from where the pivot is, slower.

import { statement } from "../../../../generators/statement.ts";
import { ensemble } from "../../ensemble.ts";

export const { knobs, score } = statement(ensemble, {
  by: "Flute",
  form: "R",
  key: "home",
  stretch: 1.5,
  phrase: "motif",
  hairpins: "fade",
  dynamic: { follow: "intensity", from: 2.5, to: 5 },
});

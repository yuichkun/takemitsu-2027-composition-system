// Running figures of the motif's notes, moving with the cantus.

import { field } from "../../../../generators/field.ts";
import { ensemble } from "../../ensemble.ts";

export const { knobs, score } = field(ensemble, {
  players: { Flute: 1, Clarinet: 1, "Violin I": 1, "Violin II": 1, Viola: 1 },
  dynamic: { follow: "intensity", from: 3, to: 7 },
});

// Vibraphone and harp where the cantus moves.

import { bells } from "../../../../generators/bells.ts";
import { ensemble } from "../../ensemble.ts";

export const { knobs, score } = bells(ensemble, {
  players: { Vibraphone: 1, Harp: 1 },
  when: "path",
  roll: "together",
  height: 0.45,
  dynamic: { follow: "intensity", from: 3, to: 7 },
});

// Vibraphone and harp where the held line moves.

import { bells } from "../../../../generators/bells.ts";
import { ensemble } from "../../ensemble.ts";

export const { knobs, score } = bells(ensemble, {
  players: { Vibraphone: 1, Harp: 0.7 },
  when: "path",
  roll: "together",
  height: 0.5,
  ring: 4,
  dynamic: { follow: "intensity", from: 2.5, to: 5.5 },
});

// The harp, at each step of the clarinet's phrase.

import { bells } from "../../../../generators/bells.ts";
import { ensemble } from "../../ensemble.ts";

export const { knobs, score } = bells(ensemble, {
  players: { Harp: 1 },
  when: "phrases",
  height: 0.55,
  dynamic: { follow: "intensity", from: 2, to: 5 },
});

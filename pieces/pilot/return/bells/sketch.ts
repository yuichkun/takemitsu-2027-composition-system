// Harp and vibraphone on the motif's first note, at the end.

import { bells } from "../../../../generators/bells.ts";
import { ensemble } from "../../ensemble.ts";

export const { knobs, score } = bells(ensemble, {
  players: { Harp: 1, Vibraphone: 0.8 },
  when: "end",
  key: "home",
  chord: "first note",
  roll: "together",
  height: 0.35,
  ring: 6,
  dynamic: 2,
});

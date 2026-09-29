// antara, for orchestra (Takemitsu award 2027). The premise is docs/antara/premise.md; the sound's
// principles are docs/antara/sound.md.
//
// The piece is made of sections written as separate code, each knowing nothing of its neighbours,
// joined here with the operations of src/sketch/join.ts (docs/decisions/0023). A section is worked
// on as a sketch in sketches/ and is that sketch here (its folder's sketch.ts links it: the code and
// the values are the sketch's), so the sketch is where a section gets better and this node is where
// the sections are joined (docs/decisions/0026). Which sections come in which order is a knob; so is
// every join (Join 1 is between the first section and the second, and so on). Card: README.md.

import { joinKnobs, joinOf, Joiner } from "../../src/sketch/join.ts";
import { text } from "../../src/sketch/knobs.ts";
import { Motif } from "../../src/sketch/motif.ts";
import type { Context } from "../../src/sketch/nest.ts";
import type { Score } from "../../src/score/types.ts";
import { ensemble, shown } from "./ensemble.ts";

/** The sections, in the order they come (their folders' names). */
const SECTIONS = ["two-grids", "running"];

export const knobs = {
  sections: text({
    group: "Sections",
    label: "Order",
    help: "The sections in the order they come, by their folders' names, with spaces between. One left out is not played. The joins keep their places: Join 1 is always between the first and the second",
    value: SECTIONS.join(" "),
  }),
  ...joinKnobs(SECTIONS.length - 1),
};

export function score(values: Record<string, unknown>, ctx: Context): Score {
  const piece = ctx.with({
    ensemble,
    material: { motif: new Motif([{ at: 0, dur: 1, midi: 60 }]) },
    flows: {},
  });
  const J = new Joiner(piece);
  const order = typeof values.sections === "string" ? values.sections : SECTIONS.join(" ");
  const names = order.split(/\s+/).filter(Boolean);
  if (!names.length) throw new Error(`Order: name the sections (${SECTIONS.join(", ")})`);
  const rest = J.section("rest");
  J.chain(
    names.map((name) => ({ section: J.section(name), label: name })),
    names.slice(1).map((_, n) => joinOf(values, n + 1)),
    rest,
  );
  const out = J.score({ title: "antara" });
  // Every player on a staff of their own (docs/decisions/0025).
  return { ...out, pairs: false, parts: shown(out.parts) };
}

// antara, a combination on the map: the same rhythm row carried from family to family.
// The betweens stay the same numbers of atoms; the atoms change (16ths, triplet eighths, quintuplet
// 16ths) at bar lines, where every family's grid meets, so the row is augmented and diminished by
// the family alone.
// Three woodblocks, one for each family (2: high, 3: medium, 5: low): the change of family is heard
// as a change of wood, so the grain of time and the colour move together. Card: README.md.

import type { Values } from "../../../../src/sketch/knobs.ts";
import { text } from "../../../../src/sketch/knobs.ts";
import {
  familiesOf,
  notes,
  scoreOf,
  stretches,
  TICKS,
  timeLine,
  timeSetsOf,
  type Family,
} from "../../between.ts";
import { form, timeFluid } from "../../knobs.ts";

/** The time knobs without their family: here the families are written per stretch. */
function withoutFamily<T extends { family: unknown }>(knobs: T): Omit<T, "family"> {
  const rest: Partial<T> = { ...knobs };
  delete rest.family;
  return rest as Omit<T, "family">;
}

const woodOf: Record<Family, string> = {
  2: "woodblock-high",
  3: "woodblock-medium",
  5: "woodblock-low",
};

export const knobs = {
  families: text({
    group: "Time",
    label: "Families",
    help: "One family per stretch, split by | (2: high woodblock, 3: medium, 5: low). The stretches take turns over the length",
    value: "2 | 3 | 5 | 2",
  }),
  ...withoutFamily(
    timeFluid({
      family: "2 (16ths)",
      set: "2 1 1",
      rule: "shift each time",
      group: 3,
      order: "ascending",
    }),
  ),
  ...form({ bars: 8, tempo: 72 }),
};

export function score(v: Values<typeof knobs>) {
  const beats = v.bars * 4;
  const families = familiesOf("Families", v.families);
  const onsets = timeLine({
    beats,
    families,
    sets: timeSetsOf("Rhythm set", v.rhythm),
    rule: v.timeRule,
    k: v.timeGroup,
    order: v.timeOrder,
  });
  const byWood = new Map<string, ReturnType<typeof notes>>();
  const sets = timeSetsOf("Rhythm set", v.rhythm);
  stretches(beats, Math.max(families.length, sets.length)).forEach(([from, to], i) => {
    const wood = woodOf[families[i % families.length]!];
    const inside = onsets.filter((o) => o.at >= from * TICKS && o.at < to * TICKS);
    const events = notes(inside, { beats: to, accent: "time" });
    byWood.set(wood, [...(byWood.get(wood) ?? []), ...events]);
  });
  const parts = [...byWood].map(([instrument, events]) => ({
    id: instrument,
    instrument,
    dynamics: [{ at: 0, level: 5 }],
    events,
  }));
  return scoreOf("one row, three families", beats, v.tempo, parts);
}

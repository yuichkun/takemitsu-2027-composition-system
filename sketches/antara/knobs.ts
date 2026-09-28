// Knobs shared by the antara sketches: one set of knobs for each state an axis can be in
// (docs/antara/sound.md). A sketch spreads the ones for its cell of the map and adds its own.

import { choice, number, pitch, pitchRange, text } from "../../src/sketch/knobs.ts";
import { FAMILY_OPTIONS, ORDERS, STANDS, type Stand } from "./between.ts";

const stand = (value: Stand) =>
  choice({
    group: "Pitch",
    label: "Standpoint",
    help: "back to the anchor: every group starts again from the anchor · walk on: each group starts where the last one ended",
    value,
    options: [...STANDS],
  });

const anchorAndRange = (
  anchor: string,
  range: [string, string],
  bounds: [string, string],
  step = 0.5,
) => ({
  anchor: pitch({
    group: "Pitch",
    label: "Anchor",
    help: "The one pitch chosen: where the line stands. Everything else is betweens added to it",
    value: anchor,
    min: bounds[0],
    max: bounds[1],
    step,
  }),
  range: pitchRange({
    group: "Pitch",
    label: "Range",
    help: "Tones leaving it are moved by octaves back into it",
    value: range,
    min: bounds[0],
    max: bounds[1],
    step,
  }),
});

/** Pitch: a set holding one between. */
export const pitchOne = (d: {
  between: number;
  stand: Stand;
  anchor: string;
  range: [string, string];
  /** The instrument's range: how far the anchor and the range may go. */
  bounds: [string, string];
  step?: number;
}) => ({
  between: number({
    group: "Pitch",
    label: "Between",
    help: "The one between, in semitones (0: the same note again). With one between, no rule can be heard",
    value: d.between,
    min: -12,
    max: 12,
    step: d.step ?? 0.5,
    unit: "st",
  }),
  stand: stand(d.stand),
  ...anchorAndRange(d.anchor, d.range, d.bounds, d.step),
});

/** Pitch: a row drawn in order. */
export const pitchRow = (d: {
  row: string;
  stand: Stand;
  anchor: string;
  range: [string, string];
  /** The instrument's range: how far the anchor and the range may go. */
  bounds: [string, string];
  step?: number;
}) => ({
  row: text({
    group: "Pitch",
    label: "Row",
    help: "Betweens in semitones, drawn in this order again and again (quarter tones as .5). Sections split by | take turns over the length",
    value: d.row,
  }),
  stand: stand(d.stand),
  ...anchorAndRange(d.anchor, d.range, d.bounds, d.step),
});

/** Pitch: a set drawn by a moving rule. */
export const pitchFluid = (d: {
  set: string;
  rule: "combinations" | "shift each time";
  group: number;
  order: "ascending" | "descending";
  stand: Stand;
  anchor: string;
  range: [string, string];
  /** The instrument's range: how far the anchor and the range may go. */
  bounds: [string, string];
  step?: number;
}) => ({
  pitches: text({
    group: "Pitch",
    label: "Set",
    help: "Betweens in semitones; a between written twice comes up more often. Sections split by | take turns over the length",
    value: d.set,
  }),
  pitchRule: choice({
    group: "Pitch",
    label: "Rule",
    help: "combinations: every distinct group of the set, in dictionary order (as in Quantization) · shift each time: the set in order, starting one later each time round",
    value: d.rule,
    options: ["combinations", "shift each time"],
  }),
  pitchGroup: number({
    group: "Pitch",
    label: "Group size",
    help: "How many betweens in each group (combinations)",
    value: d.group,
    min: 1,
    max: 12,
    step: 1,
  }),
  pitchOrder: choice({
    group: "Pitch",
    label: "Order in a group",
    help: "ascending: falling betweens first, then rising ones from small to large · descending: the other way",
    value: d.order,
    options: [...ORDERS],
  }),
  stand: stand(d.stand),
  ...anchorAndRange(d.anchor, d.range, d.bounds, d.step),
});

const family = (value: string, help = "The prime family the atoms come from") =>
  choice({ group: "Time", label: "Family", help, value, options: FAMILY_OPTIONS });

/** Time: a set holding one between (a pulse). */
export const timePulse = (d: { family: string; atoms: number }) => ({
  family: family(d.family),
  pulse: number({
    group: "Time",
    label: "Pulse",
    help: "The one between, in atoms of the family",
    value: d.atoms,
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
});

/** Time: a rhythm row drawn in order. */
export const timeRow = (d: { family: string; row: string }) => ({
  family: family(d.family),
  rhythm: text({
    group: "Time",
    label: "Rhythm row",
    help: "Betweens in atoms of the family, drawn in this order again and again. Sections split by | take turns over the length",
    value: d.row,
  }),
});

/** Time: a set of betweens drawn by a moving rule. */
export const timeFluid = (d: {
  family: string;
  set: string;
  rule: "combinations" | "shift each time";
  group: number;
  order: "ascending" | "descending";
}) => ({
  family: family(d.family),
  rhythm: text({
    group: "Time",
    label: "Rhythm set",
    help: "Betweens in atoms of the family; one written twice comes up more often. Sections split by | take turns over the length",
    value: d.set,
  }),
  timeRule: choice({
    group: "Time",
    label: "Rule",
    help: "combinations: every distinct group, in dictionary order · shift each time: the set in order, starting one later each time round",
    value: d.rule,
    options: ["combinations", "shift each time"],
  }),
  timeGroup: number({
    group: "Time",
    label: "Group size",
    help: "How many betweens in each group (combinations)",
    value: d.group,
    min: 1,
    max: 12,
    step: 1,
  }),
  timeOrder: choice({
    group: "Time",
    label: "Order in a group",
    help: "ascending: short betweens first · descending: long ones first",
    value: d.order,
    options: [...ORDERS],
  }),
});

/** Length and speed. */
export const form = (d: { bars: number; tempo: number }) => ({
  bars: number({
    group: "Form",
    label: "Bars",
    help: "Length in bars of 4/4 (the bar lines are only where the line is written; the beat that is heard comes from the betweens)",
    value: d.bars,
    min: 1,
    max: 64,
    step: 1,
    unit: "bars",
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: d.tempo,
    min: 40,
    max: 160,
    step: 2,
    unit: "bpm",
  }),
});

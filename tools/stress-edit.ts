// Changes a score file the way a composer might, to try how the preview follows a save
// (docs/commands.md). The file is rewritten in place, so edits build on each other: tutti twice
// moves the pitches twice.
//
//   vp node tools/stress-edit.ts <note|dynamics|tutti|insert|tempo> [--at <measure>] [--by <n>] [--file <score.json>]
//   vp node tools/stress-edit.ts restore [--file <score.json>]
//
// --file is the 20-minute stress score unless given; --at is its middle measure unless given.
// Before the first edit, the file is kept as <file>.orig (the preview lists .json files only);
// restore puts it back.
//
//   note      the first note of the busiest part at the measure, --by semitones up
//   dynamics  the busiest part over 4 measures: a hairpin from level --by to 8 − --by (0–8)
//   tutti     every note of every part in 4 measures, --by semitones up
//   insert    an empty measure before the measure
//   tempo     the tempo from the measure on, × (1 + 0.1 × --by)

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

import type { Score } from "../src/score/types.ts";
import { edits, spotOf, type EditKind } from "./edits.ts";

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const kind = args[0];
const file = option("--file") ?? ".local/stress/stress-20min.json";
const orig = `${file}.orig`;

if (kind === "restore") {
  if (!existsSync(orig)) throw new Error(`Nothing to restore: ${orig} does not exist`);
  copyFileSync(orig, file);
  console.log(`${file}: back to how it was before the first edit`);
  process.exit(0);
}
if (!kind || !(kind in edits)) {
  console.error(
    "usage: vp node tools/stress-edit.ts <note|dynamics|tutti|insert|tempo|restore> [--at <measure>] [--by <n>] [--file <score.json>]",
  );
  process.exit(1);
}

if (!existsSync(orig)) copyFileSync(file, orig);
const score = JSON.parse(readFileSync(file, "utf8")) as Score;
const at = spotOf(score, option("--at") === undefined ? undefined : Number(option("--at")));
const by = Number(option("--by") ?? 1);
edits[kind as EditKind](score, at, by);
writeFileSync(file, JSON.stringify(score));
console.log(
  `${file}: ${kind} at measure ${at.number}${kind === "insert" ? "" : ` (by ${by})`}, saved ${new Date().toLocaleTimeString()}`,
);

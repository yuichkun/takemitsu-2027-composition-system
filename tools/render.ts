// Renders a score JSON with BBC SO: writes the mix and one stem per part.
//
//   vp node tools/render.ts examples/showcase.json [--from 3] [--to 8]   (measure numbers, inclusive)

import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { plan } from "../src/performance/plan.ts";
import { renderPlan } from "../src/performance/render.ts";
import { repoRoot } from "../src/render/host.ts";
import { normalize } from "../src/score/normalize.ts";
import type { Score } from "../src/score/types.ts";

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args.splice(i, 2)[1]) : undefined;
};
const fromMeasure = option("--from");
const toMeasure = option("--to");
const file = args[0];
if (!file) throw new Error("usage: tools/render.ts <score.json> [--from m] [--to m]");

const score = normalize(JSON.parse(await readFile(file, "utf8")) as Score);
const first = score.measures.find((m) => m.number === (fromMeasure ?? 1)) ?? score.measures[0]!;
const last =
  score.measures.find((m) => m.number === (toMeasure ?? score.measures.length)) ??
  score.measures.at(-1)!;
const range = { from: first.start, to: last.start.add(last.length) };
const p = plan(score, range);
console.log(`${p.lanes.length} lanes, ${p.duration.toFixed(1)} s`);
const name = basename(file).replace(/\.json$/, "");
const out = await renderPlan(
  p,
  join(repoRoot, ".local/renders", name, `m${first.number}-${last.number}`),
  (m, f) => process.stdout.write(`\r${m} ${Math.round(f * 100)}%   `),
);
console.log(`\n${out.mix}\npeak ${(20 * Math.log10(out.peak)).toFixed(1)} dBFS`);
for (const w of out.warnings) console.log(`warning: ${w}`);

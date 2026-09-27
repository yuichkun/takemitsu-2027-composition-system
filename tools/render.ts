// Renders a score JSON with BBC SO and writes the mix (and with --stems, one WAV per part).
//
//   vp node tools/render.ts examples/showcase.json [--stems]
//
// Uses the same chunks as the preview (.local/chunks), so it only renders what is missing.

import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { Engine } from "../src/performance/engine.ts";
import { mixdown } from "../src/performance/render.ts";
import { repoRoot } from "../src/render/host.ts";
import { normalize } from "../src/score/normalize.ts";
import type { Score } from "../src/score/types.ts";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) throw new Error("usage: tools/render.ts <score.json> [--stems]");

const score = normalize(JSON.parse(await readFile(file, "utf8")) as Score);
const engine = new Engine();
engine.onProgress = (_path, p) =>
  process.stdout.write(
    `\rRendering ${p.done}/${p.total} chunks${p.failed ? `, ${p.failed} failed` : ""}   `,
  );
const manifest = await engine.open(file, score);
const progress = await engine.whenDone(file);
engine.pool.stop();
if (progress.failed) console.log(`\n${progress.failed} chunk(s) failed`);

const name = basename(file).replace(/\.json$/, "");
const out = await mixdown(engine, file, join(repoRoot, ".local/renders", name), {
  stems: args.includes("--stems"),
});
console.log(
  `\n${manifest.chunks.length} chunks, ${out.seconds.toFixed(1)} s\n${out.mix}\npeak ${(20 * Math.log10(out.peak)).toFixed(1)} dBFS`,
);
for (const w of out.warnings) console.log(`warning: ${w}`);

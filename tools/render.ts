// Renders a score JSON with BBC SO and writes the mix (and with --stems, one WAV per part).
//
//   vp node tools/render.ts examples/showcase.json [--stems]
//   vp node tools/render.ts pieces/pilot            (a sketch or piece folder: its score)
//
// Uses the same chunks as the preview (.local/chunks), so it only renders what is missing.
// Every part at its own level (no mixer); the preview's Export gives the mix as its mixer plays it.

import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { Engine } from "../src/performance/engine.ts";
import { mixdown } from "../src/performance/render.ts";
import { repoRoot } from "../src/render/host.ts";
import { normalize } from "../src/score/normalize.ts";
import type { Score } from "../src/score/types.ts";
import { rootOf, scoreFileOf } from "../src/sketch/run.ts";

const args = process.argv.slice(2);
const given = args.find((a) => !a.startsWith("--"));
if (!given)
  throw new Error("usage: tools/render.ts <score.json | sketch or piece folder> [--stems]");
const file = statSync(given).isDirectory() ? scoreFileOf(rootOf(resolve(given))) : given;

const score = normalize(JSON.parse(await readFile(file, "utf8")) as Score);
const engine = new Engine();
engine.onStatus = (path) => {
  const p = engine.progress(path);
  process.stdout.write(
    `\rRendering ${p.done}/${p.total} chunks${p.failed ? `, ${p.failed} failed` : ""}   `,
  );
};
const manifest = await engine.open(file, score);
const progress = await engine.whenDone(file);
engine.stop();
if (progress.failed) console.log(`\n${progress.failed} chunk(s) failed`);

const name = basename(file).replace(/\.json$/, "");
const out = await mixdown(engine, file, join(repoRoot, ".local/renders", name), {
  stems: args.includes("--stems"),
});
console.log(
  `\n${manifest.chunks.length} chunks, ${out.seconds.toFixed(1)} s\n${out.mix}\npeak ${(20 * Math.log10(out.peak)).toFixed(1)} dBFS`,
);
for (const w of out.warnings) console.log(`warning: ${w}`);

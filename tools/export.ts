// Writes a score as MusicXML, to open in Sibelius (docs/decisions/0003: Sibelius only engraves;
// MusicXML is the one way out). The preview's Export button gives the same file.
//
//   vp node tools/export.ts <score.json | sketch or piece folder> [out.musicxml]
//
// A folder stands for its score: a sketch's, or for any folder of a piece, the whole piece's.
// Without `out`, the file goes to .local/exports/<name>.musicxml.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { toMusicXml } from "../src/notation/musicxml.ts";
import { repoRoot } from "../src/render/host.ts";
import type { Score } from "../src/score/types.ts";
import { rootOf, scoreFileOf } from "../src/sketch/run.ts";

const [given, out] = process.argv.slice(2);
if (!given) {
  process.stderr.write(
    "vp node tools/export.ts <score.json | sketch or piece folder> [out.musicxml]\n",
  );
  process.exit(1);
}
const input = resolve(given);
const scorePath = statSync(input).isDirectory() ? scoreFileOf(rootOf(input)) : input;
if (!existsSync(scorePath)) {
  process.stderr.write(
    `No score at ${scorePath}: write it first (vp node src/sketch/run.ts ${given})\n`,
  );
  process.exit(1);
}
const { musicxml, warnings } = toMusicXml(JSON.parse(readFileSync(scorePath, "utf8")) as Score);
const target = resolve(
  out ?? join(repoRoot, ".local/exports", `${basename(scorePath, ".json")}.musicxml`),
);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, musicxml);
process.stdout.write(`${target}\n`);
for (const w of warnings) process.stdout.write(`warning: ${w}\n`);

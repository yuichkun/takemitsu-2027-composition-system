// Draws a score as pages with Verovio, to look at the full-score layout (names, brackets, shared
// staves) without Sibelius. Verovio is not Sibelius: spacing and fonts differ, and it shows every
// staff on every system.
//
//   vp node tools/pages.ts <score.json | sketch or piece folder | file.musicxml> [out-dir]
//     [--pages 2] [--scale 35]
//
// Writes page-1.svg, page-1.png … (PNG through rsvg-convert, if it is installed).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import createVerovioModule from "verovio/wasm";
import { enableLog, LOG_OFF, VerovioToolkit } from "verovio/esm";

import { toMusicXml } from "../src/notation/musicxml.ts";
import { repoRoot } from "../src/render/host.ts";
import type { Score } from "../src/score/types.ts";
import { rootOf, scoreFileOf } from "../src/sketch/run.ts";

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1]! : fallback;
};
const [given, outArg] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!given) {
  console.error("vp node tools/pages.ts <score.json | folder | file.musicxml> [out-dir] [--pages 2]");
  process.exit(1);
}
const input = resolve(given);
let musicxml: string;
if (input.endsWith(".musicxml") || input.endsWith(".xml")) musicxml = readFileSync(input, "utf8");
else {
  const path = statSync(input).isDirectory() ? scoreFileOf(rootOf(input)) : input;
  musicxml = toMusicXml(JSON.parse(readFileSync(path, "utf8")) as Score).musicxml;
}
const out = resolve(outArg ?? join(repoRoot, ".local/pages", basename(input).replace(/\.[^.]+$/, "")));
mkdirSync(out, { recursive: true });

const module = await createVerovioModule();
enableLog(LOG_OFF, module);
const tk = new VerovioToolkit(module);
// A3 portrait, in Verovio's units (tenths of a millimetre at scale 100).
tk.setOptions({
  pageWidth: 2970,
  pageHeight: 4200,
  pageMarginLeft: 100,
  pageMarginRight: 100,
  pageMarginTop: 100,
  pageMarginBottom: 100,
  scale: Number(option("--scale", "35")),
  adjustPageHeight: false,
  breaks: "auto",
  font: "Bravura",
  footer: "none",
  header: "auto",
});
tk.loadData(musicxml);
const pages = Math.min(tk.getPageCount(), Number(option("--pages", "2")));
const rsvg = ["/opt/homebrew/bin/rsvg-convert", "/usr/local/bin/rsvg-convert"].find(existsSync);
for (let page = 1; page <= pages; page++) {
  const svg = join(out, `page-${page}.svg`);
  writeFileSync(svg, tk.renderToSVG(page));
  if (rsvg)
    execFileSync(rsvg, ["-b", "white", "-w", "1600", "-o", join(out, `page-${page}.png`), svg]);
}
console.log(`${pages} of ${tk.getPageCount()} pages in ${out}`);

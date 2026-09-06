// Builds the ManuScript plugins: src/*.plg (UTF-8, git-friendly) -> dist/*.plg (UTF-16BE with BOM,
// the encoding Sibelius uses for its own bundled plugins).
// Usage: node sibelius-plugins/build.mjs [--install]
//   --install also copies dist/*.plg into ~/Library/Application Support/Avid/Sibelius/Plugins/Takemitsu/

import { mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "src");
const dist = join(here, "dist");
mkdirSync(dist, { recursive: true });

function utf16be(text) {
  const units = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      units.push(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
    } else units.push(cp);
  }
  const buf = Buffer.alloc(2 + units.length * 2);
  buf[0] = 0xfe; buf[1] = 0xff; // BOM
  units.forEach((u, i) => buf.writeUInt16BE(u, 2 + i * 2));
  return buf;
}

const built = [];
for (const name of readdirSync(src).filter((f) => f.endsWith(".plg"))) {
  const text = readFileSync(join(src, name), "utf8").replace(/\r?\n/g, "\r\n");
  const out = join(dist, name);
  writeFileSync(out, utf16be(text));
  built.push(out);
  console.log("built", out);
}

if (process.argv.includes("--install")) {
  const target = join(homedir(), "Library/Application Support/Avid/Sibelius/Plugins/Takemitsu");
  mkdirSync(target, { recursive: true });
  for (const f of built) {
    const dest = join(target, f.split("/").pop());
    copyFileSync(f, dest);
    console.log("installed", dest);
  }
}

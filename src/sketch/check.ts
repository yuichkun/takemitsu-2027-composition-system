// Checks sketches without the preview: writes each one's score (src/sketch/run.ts, in a fresh
// process as the preview does), then reads it the way the preview does (the notation and the
// performance plan) and prints its length, its parts and every warning.
//
//   vp node src/sketch/check.ts sketches/<name> [more sketch folders…]
//
// Exits with 1 when a sketch fails or warns.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { toMusicXml } from "../notation/musicxml.ts";
import { plan } from "../performance/plan.ts";
import { normalize } from "../score/normalize.ts";
import type { Score } from "../score/types.ts";
import { rootOf, scoreFileOf } from "./run.ts";

const repo = resolve(import.meta.dirname, "../..");
const runner = join(repo, "src/sketch/run.ts");

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function check(dir: string): boolean {
  const name = relative(repo, resolve(dir));
  try {
    execFileSync(process.execPath, [runner, dir], {
      cwd: repo,
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (e) {
    const err = e as { stderr?: Buffer; message: string };
    process.stdout.write(`FAIL ${name}\n  ${err.stderr?.toString().trim() || err.message}\n`);
    return false;
  }
  const score = JSON.parse(readFileSync(scoreFileOf(rootOf(dir)), "utf8")) as Score;
  const normal = normalize(score);
  const performance = plan(normal);
  const warnings = [...new Set([...toMusicXml(score).warnings, ...performance.warnings])];
  const notes = normal.parts.reduce((n, p) => n + p.notes.length, 0);
  const ok = warnings.length === 0;
  process.stdout.write(
    `${ok ? "OK  " : "WARN"} ${name}\n` +
      `  ${normal.title} · ${clock(performance.duration)} · ${normal.measures.length} bars · ` +
      `${normal.parts.length} parts · ${notes} notes\n` +
      warnings.map((w) => `  ! ${w}\n`).join(""),
  );
  return ok;
}

const dirs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (dirs.length === 0) {
  process.stderr.write("usage: vp node src/sketch/check.ts <sketch folder> [more…]\n");
  process.exit(2);
}
let good = true;
for (const d of dirs) good = check(d) && good;
process.exit(good ? 0 : 1);

// Measures how long it takes from a saved score to playable audio, for a few editing scenarios.
//
//   vp node tools/bench.ts <score.json> [--out .local/bench/<name>.json]
//
// Every run starts from an empty cache of its own (so "cold" is really cold) and leaves the
// shared cache alone. Host memory is sampled while it runs.

import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import type { Score, NoteEvent, Part } from "../src/score/types.ts";

const args = process.argv.slice(2);
const scorePath = args.find((a) => !a.startsWith("--"));
if (!scorePath) throw new Error("usage: tools/bench.ts <score.json> [--out file]");
const outIndex = args.indexOf("--out");
const name = basename(scorePath).replace(/\.json$/, "");

const cache = mkdtempSync(join(tmpdir(), "takemitsu-bench-"));
process.env.TAKEMITSU_CACHE_DIR = cache;
const { renderPlan } = await import("../src/performance/render.ts");
const { plan } = await import("../src/performance/plan.ts");
const { normalize } = await import("../src/score/normalize.ts");
const { repoRoot } = await import("../src/render/host.ts");

const outFile =
  outIndex >= 0
    ? args[outIndex + 1]!
    : join(repoRoot, ".local/bench", `${name}-${Date.now()}.json`);

/** Peak resident memory of all host processes while `work` runs, in MB. */
async function withMemory<T>(work: () => Promise<T>): Promise<{ value: T; hostMB: number }> {
  let peak = 0;
  const timer = setInterval(() => {
    try {
      const kb = execSync(
        `ps -A -o rss=,comm= | grep 'Takemitsu Host' | awk '{s+=$1} END {print s+0}'`,
      ).toString();
      peak = Math.max(peak, Number(kb) / 1024);
    } catch {
      // ps can fail while processes come and go
    }
  }, 250);
  try {
    return { value: await work(), hostMB: Math.round(peak) };
  } finally {
    clearInterval(timer);
  }
}

interface Result {
  scenario: string;
  seconds: number;
  hostMB: number;
}
const results: Result[] = [];

async function measure(scenario: string, score: Score): Promise<void> {
  const started = performance.now();
  const { hostMB } = await withMemory(async () => {
    const p = plan(normalize(score));
    await renderPlan(p, join(cache, "out", scenario.replace(/\W+/g, "-")));
  });
  const seconds = (performance.now() - started) / 1000;
  results.push({ scenario, seconds, hostMB });
  console.log(`${scenario.padEnd(40)} ${seconds.toFixed(2).padStart(7)} s   host ${hostMB} MB`);
}

const original = JSON.parse(readFileSync(scorePath, "utf8")) as Score;
const clone = () => structuredClone(original);
const notesOf = (p: Part) => p.events.filter((e): e is NoteEvent => "dur" in e);

/** The part with the most notes that sounds through BBC SO (not unpitched percussion). */
function busiestPart(score: Score): Part {
  return [...score.parts].sort((a, b) => notesOf(b).length - notesOf(a).length)[0]!;
}

await measure("cold (nothing rendered)", clone());
await measure("warm (everything rendered)", clone());

{
  const s = clone();
  const part = busiestPart(s);
  const notes = notesOf(part);
  const note = notes[Math.floor(notes.length / 2)]!;
  note.dynamic = 7;
  await measure(`edit one note (${part.id})`, s);
}
{
  const s = clone();
  const part = busiestPart(s);
  part.dynamics = [
    { at: 0, level: 2, to: "linear" },
    { at: 8, level: 7 },
  ];
  await measure(`edit dynamics (${part.id})`, s);
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(
  outFile,
  JSON.stringify({ score: scorePath, when: new Date().toISOString(), results }, null, 2),
);
console.log(`\nwritten ${outFile}`);
rmSync(cache, { recursive: true, force: true });

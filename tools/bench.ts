// Measures how long it takes from a saved score to playable audio, for editing scenarios.
//
//   vp node tools/bench.ts <score.json> [--store <dir>] [--only <label>] [--shift <n>] [--out <file.json>]
//
// --store reuses a chunk store (default: a new empty one, so the first open is really cold; it is
// deleted at the end, as it grows to tens of GB for the 20-minute score).
// --shift is added to every edit's amount, so a run on a used store changes the music anew.
//
// Each edit starts from the original score with the playhead at the edited place. Times count from
// the save (planning included) to when chunks are stored; the browser's fetching comes on top.
//   start   playback from the playhead can start and play the next 10 s without waiting, by the
//           player's rules (docs/decisions/0019): the next 3 s complete before it starts, each 2 s
//           segment complete before it plays, and a chunk not rendered yet counts as sounding up
//           to its notes plus the longest tail
//   window  everything that sounds from 10 s before to 10 s after the playhead is rendered
//   near    every chunk whose origin is 30 s before to 10 s after the playhead (the measure used
//           before, for comparison)
//   all     the whole piece

import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import type { Score } from "../src/score/types.ts";
import { edits, spotOf } from "./edits.ts";

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const valued = new Set(["--store", "--out", "--only", "--shift"]);
const shift = Number(option("--shift") ?? 0);
const only = option("--only");
const scorePath = args.find((a, i) => !a.startsWith("--") && !valued.has(args[i - 1] ?? ""));
if (!scorePath) throw new Error("usage: tools/bench.ts <score.json> [--store dir] [--only label]");
const ownStore = option("--store") === undefined;
process.env.TAKEMITSU_CHUNKS_DIR =
  option("--store") ?? mkdtempSync(join(tmpdir(), "takemitsu-bench-"));

const { Engine } = await import("../src/performance/engine.ts");
const { normalize } = await import("../src/score/normalize.ts");
const { repoRoot } = await import("../src/render/host.ts");
const { secondsAt } = await import("../src/score/timeline.ts");

const name = basename(scorePath).replace(/\.json$/, "");
const outFile = option("--out") ?? join(repoRoot, ".local/bench", `${name}-${Date.now()}.json`);

const original = JSON.parse(readFileSync(scorePath, "utf8")) as Score;
const engine = new Engine();
const path = scorePath;
const sampleRate = 48000;

interface Result {
  scenario: string;
  /** Planning and chunking. */
  plan: number;
  start: number;
  window: number;
  near: number;
  all: number;
  rendered: number;
  failed: number;
  places: number;
  loads: number;
  /** Chunks tried again (a silent onset that should sound, a host that died). */
  retries: number;
  hostMB: number;
}
const results: Result[] = [];
let loads = 0;
engine.loaded = () => loads++;
let retries = 0;
const reasons = new Map<string, number>();
engine.onRetry = (_key, why) => {
  retries++;
  reasons.set(why, (reasons.get(why) ?? 0) + 1);
};
/** When each chunk was stored or given up, in seconds since the save. */
let doneAt = new Map<string, number>();
let started = 0;
engine.onChunk = (key) => doneAt.set(key, (performance.now() - started) / 1000);

async function measure(scenario: string, score: Score, playhead = 0): Promise<void> {
  started = performance.now();
  doneAt = new Map();
  loads = 0;
  retries = 0;
  reasons.clear();
  let hostMB = 0;
  const memory = setInterval(() => (hostMB = Math.max(hostMB, engine.memoryMB())), 250);
  const manifest = await engine.open(path, normalize(score), playhead);
  const plan = (performance.now() - started) / 1000;
  const before = engine.status(path);
  await engine.whenDone(path);
  clearInterval(memory);
  const status = engine.status(path);

  // When each place was ready: at planning if it was stored already.
  const at = manifest.chunks.map(([key], i) => (before.frames[i] !== -1 ? plan : doneAt.get(key)!));
  const p = playhead;
  const segment = 2;
  const need = new Map<number, number>();
  manifest.chunks.forEach(([, , origin, , noteFrames, tailMax], i) => {
    const end = origin + (noteFrames + tailMax) / sampleRate;
    const first = Math.max(Math.floor(origin / segment), Math.floor(p / segment));
    const last = Math.min(Math.floor(end / segment), Math.floor((p + 10) / segment));
    for (let k = first; k <= last; k++) need.set(k, Math.max(need.get(k) ?? plan, at[i]!));
  });
  let start = plan;
  for (const [k, complete] of need) {
    // Within the first 3 s it must be complete before starting; later, before it plays.
    const lead = k * segment < p + 3 ? 0 : k * segment - p;
    start = Math.max(start, complete - lead);
  }
  let window = plan;
  let near = plan;
  manifest.chunks.forEach(([, , origin, , noteFrames], i) => {
    const frames = status.frames[i]! >= 0 ? status.frames[i]! : noteFrames;
    if (origin < p + 10 && origin + frames / sampleRate > p - 10) window = Math.max(window, at[i]!);
    if (origin < p + 10 && origin > p - 30) near = Math.max(near, at[i]!);
  });
  const all = Math.max(plan, ...at);
  const r: Result = {
    scenario,
    plan,
    start,
    window,
    near,
    all,
    rendered: doneAt.size,
    failed: status.failed,
    places: manifest.chunks.length,
    loads,
    retries,
    hostMB: Math.round(hostMB),
  };
  results.push(r);
  const s = (x: number) => `${x.toFixed(2).padStart(7)} s`;
  console.log(
    `${scenario.padEnd(32)} plan ${r.plan.toFixed(2)} s  start ${s(r.start)}  window ${s(r.window)}  near ${s(r.near)}  all ${s(r.all)}  ` +
      `rendered ${r.rendered}${r.failed ? ` (failed ${r.failed})` : ""}  retries ${retries}  loads ${loads}  host ${r.hostMB} MB`,
  );
  for (const [why, n] of reasons) console.log(`    retried ${n}×: ${why}`);
}

//==============================================================================
// Edits (tools/edits.ts), at the middle measure

const clone = () => structuredClone(original);
const normal = normalize(original);
const at = spotOf(original);
const atS = secondsAt(normal.tempo, at.start);

console.log(
  `${name}: ${normal.parts.length} parts, ${normal.measures.length} measures; edits at measure ${at.number} (${atS.toFixed(0)} s)`,
);
await measure("open (as stored)", clone());
await measure("open again, unchanged", clone());
for (const [label, kind] of [
  ["one note", "note"],
  ["dynamics of one part (4 bars)", "dynamics"],
  ["tutti, 4 bars", "tutti"],
  ["insert a measure", "insert"],
  ["tempo from here on +10%", "tempo"],
] as const) {
  if (only && !label.includes(only)) continue;
  const s = clone();
  edits[kind](s, at, 1 + shift);
  await measure(label, s, atS);
  // The same kind of edit again, as while working on a passage.
  if (kind === "insert") continue;
  const again = clone();
  edits[kind](again, at, 2 + shift);
  await measure(`  ${label}, again`, again, atS);
}
engine.stop();

const disk = execSync(`du -sk "${process.env.TAKEMITSU_CHUNKS_DIR}"`).toString().split("\t")[0];
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(
  outFile,
  JSON.stringify(
    {
      score: scorePath,
      when: new Date().toISOString(),
      storeMB: Math.round(Number(disk) / 1024),
      results,
    },
    null,
    2,
  ),
);
console.log(`store ${Math.round(Number(disk) / 1024)} MB\nwritten ${outFile}`);
if (ownStore) rmSync(process.env.TAKEMITSU_CHUNKS_DIR, { recursive: true, force: true });
process.exit(0);

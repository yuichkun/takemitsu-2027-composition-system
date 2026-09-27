// The answer check: renders each lane the simple, slow way (the whole lane in one go, on an
// instance of its own) and compares it with the lane put together from its chunks (the fast way,
// as the preview plays it).
//
//   vp node tools/check.ts <score.json> [--lanes 12] [--seed 1] [--self-test]
//
// --self-test leaves one chunk out of every assembled lane (lanes with 2 or more chunks), to
// show that the check notices. It cannot notice a short note hidden under a much louder one
// (a col legno hit under the release of a held note, say): loudness barely changes there.
//
// Round robins differ between the two (a reused instance picks other samples), so waveforms are
// not compared. Per 50 ms window, the loudness must agree: a missing note, a cut tail, a stuck
// note or a note in the wrong place shows up as a window loud in one and silent in the other.
// Exits with 1 when a lane fails.

import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { chunkLanes, sampleRate, type ChunkedLane } from "../src/performance/chunks.ts";
import { Engine } from "../src/performance/engine.ts";
import { chunkPath, decodeChunk, statePath } from "../src/performance/store.ts";
import { pluginPath } from "../src/libraries/bbcso/patches.ts";
import { HostPool, type Batch, type WorkSource } from "../src/render/pool.ts";
import { repoRoot } from "../src/render/host.ts";
import { normalize } from "../src/score/normalize.ts";
import type { Score } from "../src/score/types.ts";

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1]! : fallback;
};
const scorePath = args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
if (!scorePath) throw new Error("usage: tools/check.ts <score.json> [--lanes n] [--seed n]");
const maxLanes = Number(option("--lanes", "12"));
const selfTest = args.includes("--self-test");
let seed = Number(option("--seed", "1"));
const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

export interface LaneVerdict {
  lane: string;
  seconds: number;
  activeWindows: number;
  meanDb: number;
  mismatches: number;
  ok: boolean;
}

const windowSeconds = 0.05;

function envelope(samples: Float32Array): number[] {
  const w = Math.round(windowSeconds * sampleRate) * 2;
  const out: number[] = [];
  for (let i = 0; i < samples.length; i += w) {
    let s = 0;
    const end = Math.min(samples.length, i + w);
    for (let k = i; k < end; k++) s += samples[k]! ** 2;
    out.push(10 * Math.log10(s / Math.max(1, end - i) + 1e-12));
  }
  return out;
}

/** Compares two loudness envelopes. */
export function compare(a: Float32Array, b: Float32Array): Omit<LaneVerdict, "lane"> {
  const ea = envelope(a);
  const eb = envelope(b);
  const n = Math.max(ea.length, eb.length);
  let active = 0;
  let sum = 0;
  let mismatches = 0;
  for (let i = 0; i < n; i++) {
    const x = ea[i] ?? -120;
    const y = eb[i] ?? -120;
    if (x < -60 && y < -60) continue;
    active++;
    sum += Math.min(20, Math.abs(x - y));
    // Loud in one, (nearly) silent in the other, and not just the edge of a tail.
    if ((x > -40 && y < -70) || (y > -40 && x < -70)) mismatches++;
  }
  const meanDb = active ? sum / active : 0;
  return {
    seconds: n * windowSeconds,
    activeWindows: active,
    meanDb,
    mismatches,
    ok: meanDb < 3 && mismatches <= Math.max(2, active * 0.01),
  };
}

/** A lane assembled from its stored chunks, starting at `origin`. */
async function assemble(lane: ChunkedLane, origin: number, length: number): Promise<Float32Array> {
  const out = new Float32Array(length * 2);
  const left =
    selfTest && lane.chunks.length > 1
      ? lane.chunks[Math.floor(lane.chunks.length / 2)]
      : undefined;
  for (const c of lane.chunks) {
    if (c === left) continue;
    const audio = decodeChunk(await readFile(chunkPath(c.key)));
    const offset = Math.round((c.origin - origin) * sampleRate) * 2;
    for (let i = 0; i < audio.samples.length && offset + i < out.length; i++)
      if (offset + i >= 0) out[offset + i]! += audio.samples[i]!;
  }
  return out;
}

/** Renders whole lanes, each on a fresh instance of its own. */
async function renderReference(lanes: ChunkedLane[], dir: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const batches: Batch[] = [];
  for (const l of lanes) {
    const c = l.chunks[0];
    if (!c || c.kind !== "bbcso" || !l.stateKey) continue;
    const output = join(dir, `${c.key}.tkch`);
    files.set(l.lane.id, output);
    batches.push({
      // A key of its own, so no instance is shared with another lane.
      stateKey: `${l.stateKey}-${l.lane.id}`,
      stateFile: statePath(l.stateKey),
      plugin: pluginPath,
      chunks: [{ id: c.key, frames: c.frames, tailMax: c.tailMax, events: c.events, output }],
    });
  }
  // processMemoryMB 1: every lane gets a fresh process, so no instance is reused.
  const pool = new HostPool({ resident: false, processMemoryMB: 1 });
  let left = batches.length;
  await new Promise<void>((resolve, reject) => {
    const source: WorkSource = {
      take: () => batches.shift(),
      pending: () => batches.length > 0,
      rendered: () => {
        if (--left === 0) resolve();
      },
      failed: (_b, error) => reject(new Error(error)),
    };
    if (left === 0) resolve();
    pool.kick(source);
  });
  pool.stop();
  return files;
}

const score = normalize(JSON.parse(readFileSync(scorePath, "utf8")) as Score);
const engine = new Engine();
const started = performance.now();
await engine.open(scorePath, score);
await engine.whenDone(scorePath);
engine.pool.stop();
console.log(`fast path rendered in ${((performance.now() - started) / 1000).toFixed(1)} s`);

const fast = engine.lanesOf(scorePath).filter((l) => l.lane.kind === "bbcso" && l.chunks.length);
const chosen = [...fast].sort(() => random() - 0.5).slice(0, maxLanes);
const whole = chunkLanes(
  chosen.map((l) => l.lane),
  { whole: true },
);
const dir = join(repoRoot, ".local/check");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const refStarted = performance.now();
const reference = await renderReference(whole, dir);
console.log(
  `reference (${whole.length} whole lanes) rendered in ${((performance.now() - refStarted) / 1000).toFixed(1)} s`,
);

const verdicts: LaneVerdict[] = [];
for (const [i, w] of whole.entries()) {
  const file = reference.get(w.lane.id);
  if (!file) continue;
  const ref = decodeChunk(await readFile(file));
  const origin = w.chunks[0]!.origin;
  const assembled = await assemble(chosen[i]!, origin, ref.frames);
  const v = { lane: w.lane.id, ...compare(ref.samples, assembled) };
  verdicts.push(v);
  console.log(
    `${v.ok ? "ok  " : "FAIL"} ${v.lane.padEnd(14)} ${v.seconds.toFixed(0).padStart(5)} s  ` +
      `mean ${v.meanDb.toFixed(2)} dB  mismatched windows ${v.mismatches}/${v.activeWindows}`,
  );
}
rmSync(dir, { recursive: true, force: true });
const failed = verdicts.filter((v) => !v.ok);
if (selfTest) {
  const broken = chosen.filter((l) => l.chunks.length > 1).length;
  console.log(`\nself-test: ${failed.length} of ${broken} broken lanes caught`);
  process.exit(failed.length > 0 ? 0 : 1);
}
console.log(
  failed.length ? `\n${failed.length} lane(s) failed` : `\nall ${verdicts.length} lanes agree`,
);
process.exit(failed.length ? 1 : 0);

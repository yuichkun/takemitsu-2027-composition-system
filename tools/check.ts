// The answer check (docs/decisions/0019): compares what the preview plays with renders made the
// simple, slow way. Two checks, because they catch different mistakes:
//
// - Chunks (what the hosts made): chunks picked at random are rendered again, one at a time, each
//   on a fresh process, and compared with the stored ones. Catches chunks stored silent or with
//   notes missing.
// - Parts (how chunks are put together): a part is mixed from its stored chunks segment by
//   segment, by the very rule the player uses (src/preview/segment-contents.ts) and the server's
//   mixing (src/performance/segments.ts), and compared with the part's lanes rendered whole, one
//   at a time on fresh processes. Catches chunks left out, placed wrong, or mixed at the wrong
//   gain.
//
//   vp node tools/check.ts <score.json> [--parts 6] [--chunks 24] [--seed 1] [--self-test]
//
// --self-test damages each checked part on purpose, in three ways, at a chunk that sounds alone
// (left out, 0.5 s late, first half silent), and passes only if every damaged part fails.
//
// Round robins differ between a fresh instance and a used one, so waveforms are not compared. Per
// 50 ms window, the loudness must agree: over the whole part on average, and in no chunk's span
// may a window be loud in one and silent in the other. Nothing else renders meanwhile (renders
// made while other processes render can come out silent), and every fresh instance first plays
// its test notes. Exits with 1 when something fails.

import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  chunkLanes,
  sampleRate,
  type BbcsoChunk,
  type ChunkedLane,
} from "../src/performance/chunks.ts";
import { Engine } from "../src/performance/engine.ts";
import { mixSegment } from "../src/performance/segments.ts";
import { chunkPath, decodeChunk, statePath } from "../src/performance/store.ts";
import { pluginPath } from "../src/libraries/bbcso/patches.ts";
import { segmentContents, segmentSeconds, type Place } from "../src/preview/segment-contents.ts";
import { repoRoot } from "../src/render/host.ts";
import { HostProcess, type ChunkJob } from "../src/render/hosts.ts";
import { normalize } from "../src/score/normalize.ts";
import type { Score } from "../src/score/types.ts";

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1]! : fallback;
};
const scorePath = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!scorePath) throw new Error("usage: tools/check.ts <score.json> [--parts n] [--chunks n]");
const partCount = Number(option("--parts", "6"));
const chunkCount = Number(option("--chunks", "24"));
const selfTest = args.includes("--self-test");
let seed = Number(option("--seed", "1"));
const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const shuffled = <T>(xs: T[]) => [...xs].sort(() => random() - 0.5);

const windowSeconds = 0.05;
const windowFrames = Math.round(windowSeconds * sampleRate);

/** Loudness per 50 ms window (dB), of interleaved stereo. */
function envelope(samples: Float32Array): number[] {
  const w = windowFrames * 2;
  const out: number[] = [];
  for (let i = 0; i < samples.length; i += w) {
    let s = 0;
    const end = Math.min(samples.length, i + w);
    for (let k = i; k < end; k++) s += samples[k]! ** 2;
    out.push(10 * Math.log10(s / Math.max(1, end - i) + 1e-12));
  }
  return out;
}

const mismatch = (x: number, y: number) => (x > -40 && y < -70) || (y > -40 && x < -70);

interface Verdict {
  meanDb: number;
  mismatches: number;
  active: number;
  /** Chunk spans with a loud-versus-silent window. */
  badSpans: number;
  ok: boolean;
}

/** Compares two renders; `spans` are chunk spans (in windows) that must have no mismatch. */
function compare(a: Float32Array, b: Float32Array, spans: [number, number][] = []): Verdict {
  const ea = envelope(a);
  const eb = envelope(b);
  const n = Math.max(ea.length, eb.length);
  let active = 0;
  let sum = 0;
  let mismatches = 0;
  const bad: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const x = ea[i] ?? -120;
    const y = eb[i] ?? -120;
    bad[i] = mismatch(x, y);
    if (x < -60 && y < -60) continue;
    active++;
    sum += Math.min(20, Math.abs(x - y));
    if (bad[i]) mismatches++;
  }
  const badSpans = spans.filter(([from, to]) => bad.slice(from, to).some(Boolean)).length;
  const meanDb = active ? sum / active : 0;
  return {
    meanDb,
    mismatches,
    active,
    badSpans,
    ok: meanDb < 3 && mismatches <= Math.max(2, active * 0.01) && badSpans === 0,
  };
}

//==============================================================================
// Renders on fresh processes, one at a time

const scratch = join(repoRoot, ".local/check");
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
let fresh = 0;

/** Renders one request on a fresh process, after its test notes sound. Returns interleaved audio. */
async function renderFresh(
  lane: ChunkedLane,
  job: Omit<ChunkJob, "output">,
): Promise<Float32Array> {
  const host = new HostProcess();
  const key = `${lane.stateKey}-check-${fresh++}`;
  try {
    await host.load(key, statePath(lane.stateKey!), pluginPath, 120_000);
    for (const [i, p] of (lane.probes ?? []).entries()) {
      for (let tries = 0; ; tries++) {
        const out = join(scratch, `probe-${i}.tkch`);
        const [r] = await host.render(
          key,
          statePath(lane.stateKey!),
          pluginPath,
          [
            {
              id: "probe",
              frames: 19712,
              tailMax: 24000,
              output: out,
              events: [
                [0, 0xb0, 123, 0],
                [0, 0xb0, 1, p.cc],
                [0, 0x90, p.keyswitch, 100],
                [480, 0x80, p.keyswitch, 0],
                [4800, 0x90, p.key, p.velocity],
                [19200, 0x80, p.key, 0],
              ],
            },
          ],
          120_000,
        );
        if (r && r.frames > 0 && r.silentOnsets.length === 0) break;
        if (tries > 60) throw new Error(`${lane.lane.id}: test note never sounded`);
        await new Promise((res) => setTimeout(res, 500));
      }
    }
    const output = join(scratch, `${job.id}.tkch`);
    await host.render(key, statePath(lane.stateKey!), pluginPath, [{ ...job, output }], 600_000);
    return decodeChunk(new Uint8Array(await readFile(output))).samples;
  } finally {
    host.stop();
  }
}

//==============================================================================

const score = normalize(JSON.parse(readFileSync(scorePath, "utf8")) as Score);
const engine = new Engine();
const started = performance.now();
const manifest = await engine.open(scorePath, score);
const done = await engine.whenDone(scorePath);
engine.stop();
console.log(
  `rendered in ${((performance.now() - started) / 1000).toFixed(1)} s (${done.failed} failed)`,
);
const lanes = engine.lanesOf(scorePath);
const status = engine.status(scorePath);
let failures = 0;

// 1. Chunks
const bbcsoLanes = lanes.filter((l) => l.lane.kind === "bbcso");
const candidates = shuffled(
  bbcsoLanes.flatMap((l) =>
    l.chunks
      .filter((c) => (engine.framesOf(c.key) ?? 0) > 0)
      .map((c) => ({ lane: l, chunk: c as BbcsoChunk })),
  ),
).slice(0, chunkCount);
for (const { lane, chunk } of candidates) {
  const stored = decodeChunk(new Uint8Array(await readFile(chunkPath(chunk.key)))).samples;
  const again = await renderFresh(lane, {
    id: chunk.key,
    frames: chunk.frames,
    tailMax: chunk.tailMax,
    events: chunk.events,
  });
  const v = compare(stored, again);
  if (!v.ok) failures++;
  console.log(
    `${v.ok ? "ok  " : "FAIL"} chunk ${lane.lane.id.padEnd(12)} m${String(chunk.measure + 1).padEnd(4)} ` +
      `mean ${v.meanDb.toFixed(2)} dB  mismatched windows ${v.mismatches}/${v.active}`,
  );
}

// 2. Parts
const partIndex = new Map(manifest.parts.map((p, i) => [p, i]));
const placesOf = (part: string): Place[] =>
  manifest.chunks
    .map(([key, p, origin, gain, noteFrames, tailMax], i) => ({
      key,
      part: p,
      origin,
      gain,
      noteFrames,
      tailMax,
      frames: status.frames[i]! >= 0 ? status.frames[i]! : undefined,
      failed: status.frames[i] === -2,
    }))
    .filter((x) => x.part === partIndex.get(part))
    .sort((a, b) => a.origin - b.origin);

/** A part as the preview plays it: its segments, mixed by the player's rule, end to end. */
async function assemble(places: Place[], length: number): Promise<Float32Array> {
  const reach = Math.max(0, ...places.map((p) => (p.noteFrames + p.tailMax) / sampleRate));
  const out = new Float32Array(length * 2);
  const segmentFrames = segmentSeconds * sampleRate;
  for (let index = 0; index * segmentFrames < length; index++) {
    const { mix } = segmentContents(places, reach, index);
    if (!mix.length) continue;
    const audio = decodeChunk(
      await mixSegment({ id: "", frames: segmentFrames, contributions: mix }),
    );
    out.set(
      audio.samples.subarray(
        0,
        Math.min(audio.samples.length, out.length - index * segmentFrames * 2),
      ),
      index * segmentFrames * 2,
    );
  }
  return out;
}

const parts = shuffled([...new Set(bbcsoLanes.map((l) => l.lane.partId))]).slice(0, partCount);
let damaged = 0;
let caught = 0;
for (const part of parts) {
  const partLanes = bbcsoLanes.filter((l) => l.lane.partId === part && l.chunks.length);
  const whole = chunkLanes(
    partLanes.map((l) => l.lane),
    { whole: true },
  );
  // The reference: each lane whole, alone, at its gain, summed.
  let reference = new Float32Array(0);
  for (const [i, w] of whole.entries()) {
    const c = w.chunks[0] as BbcsoChunk;
    const origin = Math.round(c.origin * sampleRate);
    const audio = await renderFresh(partLanes[i]!, {
      id: `whole-${c.key}`,
      frames: c.frames,
      tailMax: c.tailMax,
      events: c.events,
    });
    const needed = (origin + audio.length / 2) * 2;
    if (needed > reference.length) {
      const grown = new Float32Array(needed);
      grown.set(reference);
      reference = grown;
    }
    for (let k = 0; k < audio.length; k++) reference[origin * 2 + k]! += audio[k]! * c.gain;
  }
  const places = placesOf(part);
  const length = Math.max(
    reference.length / 2,
    ...places.map((p) => Math.round(p.origin * sampleRate) + (p.frames ?? 0)),
  );
  if (reference.length < length * 2) {
    const grown = new Float32Array(length * 2);
    grown.set(reference);
    reference = grown;
  }
  const spans = (ps: Place[]): [number, number][] =>
    ps
      .filter((p) => p.frames)
      .map((p) => [
        Math.floor((p.origin * sampleRate) / windowFrames),
        Math.ceil((p.origin * sampleRate + p.frames!) / windowFrames),
      ]);
  const assembled = await assemble(places, length);
  const v = compare(reference, assembled, spans(places));
  if (!v.ok) failures++;
  console.log(
    `${v.ok ? "ok  " : "FAIL"} part  ${part.padEnd(12)} ${(length / sampleRate).toFixed(0).padStart(5)} s  ` +
      `mean ${v.meanDb.toFixed(2)} dB  mismatched windows ${v.mismatches}/${v.active}  chunk spans with a gap ${v.badSpans}`,
  );

  if (!selfTest) continue;
  // The loudest chunk that sounds alone (no other chunk of the part reaches into its span).
  const peakOf = async (key: string) =>
    new DataView((await readFile(chunkPath(key))).buffer).getFloat32(20, true);
  let alone: Place | undefined;
  let loudest = 0;
  for (const p of places) {
    if (!p.frames) continue;
    const from = p.origin;
    const to = p.origin + p.frames / sampleRate;
    const isolated = places.every(
      (o) => o === p || !o.frames || o.origin + o.frames / sampleRate <= from || o.origin >= to,
    );
    if (!isolated) continue;
    const peak = await peakOf(p.key);
    if (peak > loudest) [alone, loudest] = [p, peak];
  }
  if (!alone) {
    console.log(`     self-test: no chunk of ${part} sounds alone; skipped`);
    continue;
  }
  const damages: [string, Place[], (a: Float32Array) => void][] = [
    ["left out", places.filter((p) => p !== alone), () => undefined],
    [
      "0.5 s late",
      places.map((p) => (p === alone ? { ...p, origin: p.origin + 0.5 } : p)),
      () => undefined,
    ],
    [
      "first half silent",
      places,
      (a) => {
        const from = Math.round(alone!.origin * sampleRate) * 2;
        a.fill(0, from, from + Math.round(alone!.frames! / 2) * 2);
      },
    ],
  ];
  for (const [label, damagedPlaces, harm] of damages) {
    const audio = await assemble(
      damagedPlaces.sort((a, b) => a.origin - b.origin),
      length,
    );
    harm(audio);
    const d = compare(reference, audio, spans(places));
    damaged++;
    if (!d.ok) caught++;
    console.log(`     self-test ${label.padEnd(18)} ${d.ok ? "NOT CAUGHT" : "caught"}`);
  }
}
rmSync(scratch, { recursive: true, force: true });

if (selfTest) {
  console.log(`\nself-test: ${caught} of ${damaged} damages caught`);
  process.exit(caught === damaged && damaged > 0 ? 0 : 1);
}
console.log(failures ? `\n${failures} check(s) failed` : "\nall agree");
process.exit(failures ? 1 : 0);

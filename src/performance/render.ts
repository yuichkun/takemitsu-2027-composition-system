// Lanes → audio: BBC SO lanes through the native host (cached, since renders are deterministic),
// sample lanes mixed here, then one stem per part and a stereo mix.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { encodeWav16, readWav, type Audio } from "../audio/wav.ts";
import { installedPatches, pluginPath, pluginSettings } from "../libraries/bbcso/patches.ts";
import { encodeState, stateXml } from "../libraries/bbcso/state.ts";
import { render as runHost, repoRoot, type TrackJob } from "../render/host.ts";
import type { BbcsoLane, Lane, Plan, SampleLane } from "./plan.ts";

const rate = 48000;
const tailSeconds = 4;
const cacheDir = join(repoRoot, ".local/cache");
/** Plugin instances per host process, and processes at once (BBC SO holds samples in RAM). */
const tracksPerProcess = 12;
const processes = 2;

export interface RenderOutput {
  dir: string;
  mix: string;
  stems: Record<string, string>;
  seconds: number;
  peak: number;
  warnings: string[];
}

export type Progress = (message: string, fraction: number) => void;

let patchNames: Map<string, string> | undefined;
function patchName(instrument: string, articulation: string): string {
  patchNames ??= new Map(
    installedPatches().map((p) => [`${p.instrument}|${p.articulation}`, p.name]),
  );
  const name = patchNames.get(`${instrument}|${articulation}`);
  if (!name) throw new Error(`BBC SO has no patch ${instrument} / ${articulation}`);
  return name;
}

function laneState(lane: BbcsoLane): string {
  return stateXml({
    ...pluginSettings[lane.instrument],
    family: "",
    name: lane.instrument,
    articulations: lane.articulations.map((a, i) => ({
      patch: patchName(lane.instrument, a),
      keyswitch: i,
    })),
    tune: lane.tune,
  });
}

interface HostTrack {
  lane: BbcsoLane;
  key: string;
  file: string;
  state: string;
}

async function renderBbcso(
  lanes: BbcsoLane[],
  frames: number,
  onProgress?: Progress,
): Promise<Map<BbcsoLane, string>> {
  await mkdir(cacheDir, { recursive: true });
  const tracks: HostTrack[] = lanes
    .filter((l) => l.articulations.length > 0)
    .map((lane) => {
      const state = laneState(lane);
      const events = lane.events.map((e) => ({
        frame: Math.round(e.seconds * rate),
        bytes: e.bytes,
      }));
      const key = createHash("sha256")
        .update(JSON.stringify({ state, events, frames, rate, v: 1 }))
        .digest("hex")
        .slice(0, 24);
      return { lane, key, file: join(cacheDir, `${key}.wav`), state };
    });
  const todo = tracks.filter((t) => !existsSync(t.file));
  const batches: HostTrack[][] = [];
  for (let i = 0; i < todo.length; i += tracksPerProcess)
    batches.push(todo.slice(i, i + tracksPerProcess));

  let done = 0;
  const runBatch = async (batch: HostTrack[], index: number) => {
    const jobTracks: TrackJob[] = [];
    for (const t of batch) {
      const stateFile = join(cacheDir, `${t.key}.state`);
      await writeFile(stateFile, encodeState(t.state));
      jobTracks.push({
        id: t.key,
        plugin: pluginPath,
        state: stateFile,
        events: t.lane.events.map((e) => ({ frame: Math.round(e.seconds * rate), bytes: e.bytes })),
        output: t.file,
      });
    }
    await runHost(
      {
        sampleRate: rate,
        blockSize: 512,
        frames,
        loadWaitMs: Math.min(30000, 12000 + 1500 * batch.length),
        tracks: jobTracks,
      },
      join(cacheDir, `job-${Date.now()}-${index}.json`),
      (pct) =>
        onProgress?.(
          `Rendering BBC SO (${done}/${batches.length} batches)`,
          (done + pct / 100) / Math.max(1, batches.length),
        ),
    );
    done++;
  };
  const queue = batches.map((b, i) => () => runBatch(b, i));
  await Promise.all(
    Array.from({ length: Math.min(processes, queue.length) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) await job();
    }),
  );
  return new Map(tracks.map((t) => [t.lane, t.file]));
}

const sampleCache = new Map<string, Audio>();
async function loadSample(file: string): Promise<Audio> {
  let audio = sampleCache.get(file);
  if (!audio) {
    audio = await readWav(file);
    sampleCache.set(file, audio);
  }
  return audio;
}

/** Deterministic pick among the files for a hit (the note's index is the seed). */
const pick = (files: string[], seed: number) =>
  files[Math.abs(Math.imul(seed + 1, 2654435761)) % files.length]!;

async function renderSamples(lane: SampleLane, out: Float32Array[]): Promise<void> {
  for (const hit of lane.hits) {
    const sample = await loadSample(pick(lane.files, hit.seed));
    const step = sample.sampleRate / rate;
    const start = Math.round(hit.seconds * rate);
    const length = Math.floor(sample.channels[0]!.length / step);
    for (let c = 0; c < 2; c++) {
      const src = sample.channels[Math.min(c, sample.channels.length - 1)]!;
      const dst = out[c]!;
      for (let i = 0; i < length && start + i < dst.length; i++) {
        const x = i * step;
        const j = Math.floor(x);
        const f = x - j;
        dst[start + i]! += (src[j]! * (1 - f) + (src[j + 1] ?? 0) * f) * hit.gain * lane.gain;
      }
    }
  }
}

export async function renderPlan(
  plan: Plan,
  outDir: string,
  onProgress?: Progress,
): Promise<RenderOutput> {
  const frames = Math.ceil((plan.duration + tailSeconds) * rate);
  const bbcso = plan.lanes.filter((l): l is BbcsoLane => l.kind === "bbcso");
  const files = await renderBbcso(bbcso, frames, onProgress);
  onProgress?.("Mixing", 1);

  const stems = new Map<string, Float32Array[]>();
  const stemOf = (partId: string) => {
    let s = stems.get(partId);
    if (!s) {
      s = [new Float32Array(frames), new Float32Array(frames)];
      stems.set(partId, s);
    }
    return s;
  };
  for (const lane of plan.lanes) {
    const stem = stemOf(lane.partId);
    if (lane.kind === "samples") {
      await renderSamples(lane, stem);
      continue;
    }
    const file = files.get(lane);
    if (!file) continue;
    const audio = await readWav(file);
    for (let c = 0; c < 2; c++) {
      const src = audio.channels[Math.min(c, audio.channels.length - 1)]!;
      const dst = stem[c]!;
      for (let i = 0; i < Math.min(src.length, frames); i++) dst[i]! += src[i]! * lane.gain;
    }
  }

  const mix = [new Float32Array(frames), new Float32Array(frames)];
  for (const stem of stems.values())
    for (let c = 0; c < 2; c++) for (let i = 0; i < frames; i++) mix[c]![i]! += stem[c]![i]!;
  let peak = 0;
  for (const ch of mix) for (const s of ch) peak = Math.max(peak, Math.abs(s));
  const warnings = [...plan.warnings];
  // Keep a fixed level so renders compare; only pull down when the mix would clip.
  const master = peak > 0.98 ? 0.98 / peak : 1;
  if (master < 1)
    warnings.push(
      `Mix peaked at ${(20 * Math.log10(peak)).toFixed(1)} dBFS; lowered by ${(-20 * Math.log10(master)).toFixed(1)} dB`,
    );
  if (peak === 0)
    warnings.push(
      "The render is silent. If BBC SO is involved, check the Splice login (docs/research/bbcso.md §2).",
    );

  await mkdir(outDir, { recursive: true });
  const stemFiles: Record<string, string> = {};
  for (const [partId, stem] of stems) {
    const file = join(outDir, `${partId}.wav`);
    await writeFile(
      file,
      encodeWav16({ sampleRate: rate, channels: stem.map((ch) => ch.map((s) => s * master)) }),
    );
    stemFiles[partId] = file;
  }
  const mixFile = join(outDir, "mix.wav");
  await writeFile(
    mixFile,
    encodeWav16({ sampleRate: rate, channels: mix.map((ch) => ch.map((s) => s * master)) }),
  );
  const result: RenderOutput = {
    dir: outDir,
    mix: mixFile,
    stems: stemFiles,
    seconds: frames / rate,
    peak: peak * master,
    warnings,
  };
  await writeFile(join(outDir, "manifest.json"), JSON.stringify(result, null, 2));
  return result;
}

export async function readManifest(dir: string): Promise<RenderOutput | undefined> {
  const file = join(dir, "manifest.json");
  return existsSync(file) ? (JSON.parse(await readFile(file, "utf8")) as RenderOutput) : undefined;
}

export type { Lane };

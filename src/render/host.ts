// Runs the native host (native/host) and parses its JSON-lines output.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export const repoRoot = resolve(import.meta.dirname, "../..");

export function hostBinary(): string {
  const fromEnv = process.env.TAKEMITSU_HOST;
  if (fromEnv) return fromEnv;
  const built = join(
    repoRoot,
    "native/build/TakemitsuHost_artefacts/Release/Takemitsu Host.app/Contents/MacOS/Takemitsu Host",
  );
  if (!existsSync(built)) {
    throw new Error(`Host not built. Run: vp run host:configure && vp run host:build (looked for ${built})`);
  }
  return built;
}

export interface MidiEvent {
  /** Sample frame from the start of the render. */
  frame: number;
  bytes: number[];
}

export interface TrackJob {
  id: string;
  plugin: string;
  /** Path to a saved plugin state (getStateInformation blob). */
  state?: string;
  parameters?: ({ index: number; value: number } | { name: string; value: number })[];
  events: MidiEvent[];
  output: string;
}

export interface RenderJob {
  sampleRate: number;
  blockSize: number;
  frames: number;
  bpm?: number;
  /** Wall-clock wait after loading, for the plugins to finish loading samples. */
  loadWaitMs: number;
  /** 0 = as fast as possible, 1 = real time. */
  maxSpeed?: number;
  tracks: TrackJob[];
}

export interface TrackResult {
  id: string;
  file: string;
  peak: number;
  rms: number;
}

export interface HostMessage {
  event: string;
  data: unknown;
}

export async function runHost(
  args: string[],
  onMessage?: (message: HostMessage) => void,
  signal?: AbortSignal,
): Promise<HostMessage[]> {
  const child = spawn(hostBinary(), args, { stdio: ["ignore", "pipe", "pipe"], signal });
  const messages: HostMessage[] = [];
  let buffer = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith("{")) continue;
      const message = JSON.parse(line) as HostMessage;
      messages.push(message);
      onMessage?.(message);
      // The result is in; do not wait on a plugin that hangs while shutting down.
      if (message.event === "complete") setTimeout(() => child.kill("SIGKILL"), 10_000).unref();
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => (stderr += chunk));
  const code: number = await new Promise((resolvePromise, reject) => {
    child.on("error", reject);
    child.on("close", (c) => resolvePromise(c ?? 1));
  });
  const error = messages.find((m) => m.event === "error");
  const completed = messages.some((m) => m.event === "complete");
  if ((code !== 0 && !completed) || error) {
    throw new Error(`Host failed (${code}): ${error ? String(error.data) : stderr.slice(-2000)}`);
  }
  return messages;
}

export async function render(
  job: RenderJob,
  jobFile: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<TrackResult[]> {
  await mkdir(dirname(jobFile), { recursive: true });
  for (const track of job.tracks) await mkdir(dirname(track.output), { recursive: true });
  await writeFile(jobFile, JSON.stringify(job));
  const messages = await runHost(
    ["render", jobFile],
    (m) => {
      if (m.event === "progress") onProgress?.(m.data as number);
    },
    signal,
  );
  const complete = messages.find((m) => m.event === "complete");
  if (!complete) throw new Error("Host finished without a result");
  return (complete.data as { tracks: TrackResult[] }).tracks;
}

// Rendered chunks on disk, by key: .local/chunks/<first two of key>/<key>.tkch
//
// The format (written by the host's serve command, and here for sample chunks): a 24-byte
// header — "TKCH", version 1, sample rate, frames, channels, float scale — then interleaved
// 16-bit samples, multiplied by `scale / 32767` to get the signal back. A silent chunk has
// 0 frames.
//
// The store keeps under a size limit by removing the chunks used longest ago (each read or
// write touches the file's time).

import { existsSync, mkdirSync, utimesSync } from "node:fs";
import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { repoRoot } from "../render/host.ts";

export const storeRoot = process.env.TAKEMITSU_CHUNKS_DIR ?? join(repoRoot, ".local/chunks");
/** Size limit of the store (bytes), from TAKEMITSU_CHUNKS_GB (default 30). */
export const storeLimit = Number(process.env.TAKEMITSU_CHUNKS_GB ?? 30) * 1e9;

export const chunkPath = (key: string) => join(storeRoot, key.slice(0, 2), `${key}.tkch`);
export const statePath = (stateKey: string) => join(storeRoot, "states", `${stateKey}.bin`);

export function hasChunk(key: string): boolean {
  return existsSync(chunkPath(key));
}

export interface ChunkAudio {
  sampleRate: number;
  frames: number;
  /** Interleaved stereo. */
  samples: Float32Array;
}

export const headerBytes = 24;

export function decodeChunk(bytes: Uint8Array): ChunkAudio {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== "TKCH") throw new Error("Not a chunk");
  const sampleRate = view.getInt32(8, true);
  const frames = view.getInt32(12, true);
  const scale = view.getFloat32(20, true) / 32767;
  // Little-endian 16-bit, as on every machine this runs on (Apple silicon, x86).
  const ints = new Int16Array(
    bytes.buffer.slice(bytes.byteOffset + headerBytes, bytes.byteOffset + headerBytes + frames * 4),
  );
  const samples = new Float32Array(frames * 2);
  for (let i = 0; i < samples.length; i++) samples[i] = ints[i]! * scale;
  return { sampleRate, frames, samples };
}

export function encodeChunk(
  sampleRate: number,
  left: Float32Array,
  right: Float32Array,
): Uint8Array {
  let peak = 0;
  for (let i = 0; i < left.length; i++)
    peak = Math.max(peak, Math.abs(left[i]!), Math.abs(right[i]!));
  const frames = peak > 0 ? left.length : 0;
  const bytes = new Uint8Array(headerBytes + frames * 4);
  const view = new DataView(bytes.buffer);
  bytes.set([0x54, 0x4b, 0x43, 0x48]);
  view.setInt32(4, 1, true);
  view.setInt32(8, sampleRate, true);
  view.setInt32(12, frames, true);
  view.setInt32(16, 2, true);
  view.setFloat32(20, peak, true);
  const scale = peak > 0 ? 32767 / peak : 0;
  const ints = new Int16Array(bytes.buffer, headerBytes, frames * 2);
  for (let i = 0; i < frames; i++) {
    ints[i * 2] = Math.round(left[i]! * scale);
    ints[i * 2 + 1] = Math.round(right[i]! * scale);
  }
  return bytes;
}

export async function readChunk(key: string): Promise<Uint8Array> {
  const path = chunkPath(key);
  const bytes = await readFile(path);
  touch(path);
  return bytes;
}

export async function writeChunk(key: string, bytes: Uint8Array): Promise<void> {
  const path = chunkPath(key);
  mkdirSync(join(path, ".."), { recursive: true });
  await writeFile(path, bytes);
}

function touch(path: string): void {
  try {
    const now = new Date();
    utimesSync(path, now, now);
  } catch {
    // removed meanwhile
  }
}

/** Frames stored for a chunk (from its header), or undefined if it is not rendered. */
export async function chunkFrames(key: string): Promise<number | undefined> {
  const path = chunkPath(key);
  if (!existsSync(path)) return undefined;
  const { size } = await stat(path);
  return Math.max(0, (size - headerBytes) / 4);
}

/**
 * Removes the least recently used chunks until the store is under its limit, never touching
 * the keys in `keep` (the chunks of the scores in use). Asynchronous throughout: the store can
 * hold tens of thousands of files, and the server must keep answering (and reading the hosts'
 * output) meanwhile.
 */
export async function trimStore(
  keep: Set<string>,
  limit = storeLimit,
): Promise<{ bytes: number; removed: number }> {
  if (!existsSync(storeRoot)) return { bytes: 0, removed: 0 };
  const files: { path: string; key: string; size: number; used: number }[] = [];
  for (const dir of await readdir(storeRoot)) {
    if (dir === "states" || dir.length !== 2) continue;
    const full = join(storeRoot, dir);
    const names = (await readdir(full)).filter((f) => f.endsWith(".tkch"));
    for (let i = 0; i < names.length; i += 256) {
      const stats = await Promise.all(
        names.slice(i, i + 256).map(async (f) => {
          try {
            return { f, s: await stat(join(full, f)) };
          } catch {
            return undefined; // removed meanwhile
          }
        }),
      );
      for (const x of stats)
        if (x)
          files.push({
            path: join(full, x.f),
            key: x.f.slice(0, -5),
            size: x.s.size,
            used: x.s.mtimeMs,
          });
    }
  }
  let bytes = files.reduce((n, f) => n + f.size, 0);
  let removed = 0;
  files.sort((a, b) => a.used - b.used);
  for (const f of files) {
    if (bytes <= limit) break;
    if (keep.has(f.key)) continue;
    await rm(f.path, { force: true });
    bytes -= f.size;
    removed++;
  }
  return { bytes, removed };
}

// Mixdown: the rendered chunks of a score → a stereo mix and (optionally) one stem per part,
// as 16-bit WAV. For listening outside the preview; the preview plays the chunks directly.
//
// Two mixes:
// - mixdown: every part at its chunks' own gain, at a fixed level (so mixdowns compare), with
//   stems if asked (tools/render.ts)
// - mixAsHeard: through the preview's mixer, as the page plays it: each part's compression and
//   fader, mute and solo, the master fader and its limiter (the preview's Export)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { compressInPlace, compressorParams, limiterParams } from "../audio/dynamics.ts";
import { audibleGains, dbToGain, type MixerSettings } from "../audio/mixer.ts";
import { encodeWav16 } from "../audio/wav.ts";
import { sampleRate } from "./chunks.ts";
import type { Engine } from "./engine.ts";
import { chunkPath, decodeChunk } from "./store.ts";

/** Frames the mix needs: to the end of the score, or of the last chunk's tail if later. */
function mixFrames(engine: Engine, path: string): number {
  const plan = engine.planOf(path);
  if (!plan) throw new Error(`Not open: ${path}`);
  let frames = Math.ceil(plan.duration * sampleRate);
  for (const l of engine.lanesOf(path))
    for (const c of l.chunks)
      frames = Math.max(
        frames,
        Math.round(c.origin * sampleRate) + (engine.framesOf(c.key) ?? c.frames),
      );
  return frames;
}

/**
 * Adds a part's rendered chunks into `into` (stereo, from the score's start), each at its own
 * gain. Returns how many of its chunks failed to render (left out, as the preview plays them: a
 * hole).
 */
async function addPart(
  engine: Engine,
  path: string,
  part: string,
  into: readonly [Float32Array, Float32Array],
): Promise<number> {
  const frames = into[0].length;
  let failed = 0;
  for (const l of engine.lanesOf(path).filter((x) => x.lane.partId === part))
    for (const c of l.chunks) {
      if (engine.framesOf(c.key) === undefined) {
        failed++;
        continue;
      }
      const audio = decodeChunk(await readFile(chunkPath(c.key)));
      const start = Math.round(c.origin * sampleRate);
      const g = c.gain;
      for (let i = 0; i < audio.frames; i++) {
        const f = start + i;
        if (f < 0 || f >= frames) continue;
        into[0][f]! += audio.samples[i * 2]! * g;
        into[1][f]! += audio.samples[i * 2 + 1]! * g;
      }
    }
  return failed;
}

export interface HeardMix {
  wav: Uint8Array;
  seconds: number;
  /** After the limiter. */
  peak: number;
  warnings: string[];
}

/**
 * The mix of an open, fully rendered score as the preview's mixer plays it: per part the
 * compressor (its amount) and the fader, mute and solo; then the master fader and the limiter
 * (src/audio/dynamics.ts has the same curves the page's compressors use).
 */
export async function mixAsHeard(
  engine: Engine,
  path: string,
  settings: MixerSettings,
): Promise<HeardMix> {
  const plan = engine.planOf(path);
  if (!plan) throw new Error(`Not open: ${path}`);
  const frames = mixFrames(engine, path);
  const parts = [...new Set(engine.lanesOf(path).map((l) => l.lane.partId))];
  // Solo counts over every part the mixer has, sounding or not.
  const gains = audibleGains(settings, [
    ...new Set([...parts, ...Object.keys(settings.parts ?? {})]),
  ]);
  const mix = [new Float32Array(frames), new Float32Array(frames)] as const;
  let failed = 0;
  // One part at a time, so a long piece with many parts needs only one stem in memory.
  for (const part of parts) {
    const gain = gains[part] ?? 1;
    if (gain === 0) continue;
    const stem = [new Float32Array(frames), new Float32Array(frames)] as const;
    failed += await addPart(engine, path, part, stem);
    compressInPlace([...stem], sampleRate, compressorParams(settings.parts?.[part]?.comp ?? 0));
    for (let i = 0; i < frames; i++) {
      mix[0][i]! += stem[0][i]! * gain;
      mix[1][i]! += stem[1][i]! * gain;
    }
  }
  const master = dbToGain(settings.master ?? 0);
  if (master !== 1) for (const ch of mix) for (let i = 0; i < frames; i++) ch[i]! *= master;
  compressInPlace([...mix], sampleRate, limiterParams);
  let peak = 0;
  for (const ch of mix) for (const s of ch) peak = Math.max(peak, Math.abs(s));
  const warnings = [...plan.warnings];
  if (failed) warnings.push(`${failed} chunk(s) failed to render and are silent in the mix`);
  if (peak > 1) warnings.push(`Clipped: peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS`);
  return {
    wav: encodeWav16({ sampleRate, channels: [...mix] }),
    seconds: frames / sampleRate,
    peak,
    warnings,
  };
}

export interface MixdownOutput {
  mix: string;
  stems: Record<string, string>;
  seconds: number;
  peak: number;
  warnings: string[];
}

/** Writes mix.wav (and <part>.wav with `stems`) for an open, fully rendered score. */
export async function mixdown(
  engine: Engine,
  path: string,
  outDir: string,
  options: { stems?: boolean } = {},
): Promise<MixdownOutput> {
  const lanes = engine.lanesOf(path);
  const plan = engine.planOf(path);
  if (!plan) throw new Error(`Not open: ${path}`);
  const frames = mixFrames(engine, path);
  const mix = [new Float32Array(frames), new Float32Array(frames)] as const;
  const stems: Record<string, string> = {};
  await mkdir(outDir, { recursive: true });
  const parts = [...new Set(lanes.map((l) => l.lane.partId))];
  /** Chunks that failed to render: left out, as the preview plays them (a hole). */
  let failed = 0;
  // One part at a time, so a long piece with many parts does not need every stem in memory.
  for (const part of parts) {
    const stem = [new Float32Array(frames), new Float32Array(frames)] as const;
    failed += await addPart(engine, path, part, stem);
    for (let i = 0; i < frames; i++) {
      mix[0][i]! += stem[0][i]!;
      mix[1][i]! += stem[1][i]!;
    }
    if (options.stems) {
      const file = join(outDir, `${part}.wav`);
      await writeFile(file, encodeWav16({ sampleRate, channels: [...stem] }));
      stems[part] = file;
    }
  }

  let peak = 0;
  for (const ch of mix) for (const s of ch) peak = Math.max(peak, Math.abs(s));
  const warnings = [...plan.warnings];
  if (failed) warnings.push(`${failed} chunk(s) failed to render and are silent in the mix`);
  // Keep a fixed level so mixdowns compare; only pull down when the mix would clip.
  const master = peak > 0.98 ? 0.98 / peak : 1;
  if (master < 1)
    warnings.push(
      `Mix peaked at ${(20 * Math.log10(peak)).toFixed(1)} dBFS; lowered by ${(-20 * Math.log10(master)).toFixed(1)} dB`,
    );
  if (peak === 0)
    warnings.push(
      "The render is silent. If BBC SO is involved, check the Splice login (docs/research/bbcso.md §2).",
    );
  const file = join(outDir, "mix.wav");
  await writeFile(
    file,
    encodeWav16({ sampleRate, channels: mix.map((ch) => ch.map((s) => s * master)) }),
  );
  return { mix: file, stems, seconds: frames / sampleRate, peak: peak * master, warnings };
}

// Mixdown: the rendered chunks of a score → a stereo mix and (optionally) one stem per part,
// as 16-bit WAV. For listening outside the preview; the preview plays the chunks directly.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { encodeWav16 } from "../audio/wav.ts";
import { sampleRate } from "./chunks.ts";
import type { Engine } from "./engine.ts";
import { chunkPath, decodeChunk } from "./store.ts";

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
  let frames = Math.ceil(plan.duration * sampleRate);
  for (const l of lanes)
    for (const c of l.chunks)
      frames = Math.max(
        frames,
        Math.round(c.origin * sampleRate) + (engine.framesOf(c.key) ?? c.frames),
      );

  const mix = [new Float32Array(frames), new Float32Array(frames)] as const;
  const stems: Record<string, string> = {};
  await mkdir(outDir, { recursive: true });
  const parts = [...new Set(lanes.map((l) => l.lane.partId))];
  // One part at a time, so a long piece with many parts does not need every stem in memory.
  for (const part of parts) {
    const stem = options.stems ? [new Float32Array(frames), new Float32Array(frames)] : undefined;
    for (const l of lanes.filter((x) => x.lane.partId === part)) {
      for (const c of l.chunks) {
        const audio = decodeChunk(await readFile(chunkPath(c.key)));
        const start = Math.round(c.origin * sampleRate);
        for (let i = 0; i < audio.frames; i++) {
          const f = start + i;
          if (f < 0 || f >= frames) continue;
          const left = audio.samples[i * 2]! * c.gain;
          const right = audio.samples[i * 2 + 1]! * c.gain;
          mix[0][f]! += left;
          mix[1][f]! += right;
          if (stem) {
            stem[0]![f]! += left;
            stem[1]![f]! += right;
          }
        }
      }
    }
    if (stem) {
      const file = join(outDir, `${part}.wav`);
      await writeFile(file, encodeWav16({ sampleRate, channels: stem }));
      stems[part] = file;
    }
  }

  let peak = 0;
  for (const ch of mix) for (const s of ch) peak = Math.max(peak, Math.abs(s));
  const warnings = [...plan.warnings];
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

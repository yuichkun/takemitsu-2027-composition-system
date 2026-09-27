// Minimal WAV reader/writer for the host's output (32-bit float or 16/24-bit PCM).

import { readFile } from "node:fs/promises";

export interface Audio {
  sampleRate: number;
  channels: Float32Array[];
}

export async function readWav(path: string): Promise<Audio> {
  return parseWav(await readFile(path));
}

export function parseWav(bytes: Uint8Array): Audio {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("Not a WAV file");

  let format = 0;
  let channelCount = 0;
  let sampleRate = 0;
  let bits = 0;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      format = view.getUint16(body, true);
      channelCount = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
      if (format === 0xfffe) format = view.getUint16(body + 24, true);
    } else if (id === "data") {
      const width = bits / 8;
      const frames = Math.floor(size / (width * channelCount));
      const channels = Array.from({ length: channelCount }, () => new Float32Array(frames));
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < channelCount; c++) {
          const at = body + (i * channelCount + c) * width;
          channels[c]![i] =
            format === 3
              ? view.getFloat32(at, true)
              : bits === 16
                ? view.getInt16(at, true) / 32768
                : bits === 24
                  ? (view.getUint8(at) |
                      (view.getUint8(at + 1) << 8) |
                      (view.getInt8(at + 2) << 16)) /
                    8388608
                  : view.getInt32(at, true) / 2147483648;
        }
      }
      return { sampleRate, channels };
    }
    offset = body + size + (size % 2);
  }
  throw new Error("WAV has no data chunk");
}

export function mono(audio: Audio): Float32Array {
  const [first, ...rest] = audio.channels;
  if (!first) return new Float32Array();
  const out = Float32Array.from(first);
  for (const channel of rest) for (let i = 0; i < out.length; i++) out[i]! += channel[i]!;
  for (let i = 0; i < out.length; i++) out[i]! /= audio.channels.length;
  return out;
}

// Segments: a part's audio over a short stretch of time, mixed from its chunks on request.
//
// The player streams each part as consecutive segments (2 s) rather than whole chunks, which
// can be long (a held note with its tail) and many at once. A request says exactly what to mix:
// which chunks, where each starts relative to the segment, and at what gain. The server keeps no
// state about it, and the player can name a segment by that list (src/preview/player.ts).

import { open } from "node:fs/promises";

import { encodeChunk, headerBytes, chunkPath } from "./store.ts";
import { sampleRate } from "./chunks.ts";

/** [chunk key, the chunk's frame 0 relative to the segment's start (may be negative), gain] */
export type Contribution = [string, number, number];

export interface SegmentRequest {
  id: string;
  frames: number;
  contributions: Contribution[];
}

/** Mixes one segment; returns it in the chunk format (0 frames when silent). */
export async function mixSegment(request: SegmentRequest): Promise<Uint8Array> {
  const { frames } = request;
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (const [key, offset, gain] of request.contributions) {
    let file;
    try {
      file = await open(chunkPath(key), "r");
    } catch {
      continue; // not rendered (any more)
    }
    try {
      const head = Buffer.alloc(headerBytes);
      await file.read(head, 0, headerBytes, 0);
      const stored = head.readInt32LE(12);
      const scale = (head.readFloatLE(20) / 32767) * gain;
      // The part of the chunk inside the segment.
      const from = Math.max(0, -offset);
      const to = Math.min(stored, frames - offset);
      if (to <= from) continue;
      const bytes = Buffer.alloc((to - from) * 4);
      await file.read(bytes, 0, bytes.length, headerBytes + from * 4);
      const samples = new Int16Array(bytes.buffer, bytes.byteOffset, (to - from) * 2);
      for (let i = 0; i < to - from; i++) {
        const at = offset + from + i;
        left[at]! += samples[i * 2]! * scale;
        right[at]! += samples[i * 2 + 1]! * scale;
      }
    } finally {
      await file.close();
    }
  }
  return encodeChunk(sampleRate, left, right);
}

/**
 * Many segments in one response: for each, the id's length (uint16), the id (UTF-8), the
 * payload's length (uint32), then the payload (chunk format). Little-endian.
 */
export async function segmentBundle(requests: SegmentRequest[]): Promise<Buffer> {
  // One after another: a few hundred files open at once would hit the process's file limit.
  const parts: Buffer[] = [];
  for (const r of requests) {
    const payload = await mixSegment(r);
    const id = Buffer.from(r.id, "utf8");
    const idLength = Buffer.alloc(2);
    idLength.writeUInt16LE(id.length, 0);
    const payloadLength = Buffer.alloc(4);
    payloadLength.writeUInt32LE(payload.length, 0);
    parts.push(
      idLength,
      id,
      payloadLength,
      Buffer.from(payload.buffer, payload.byteOffset, payload.length),
    );
  }
  return Buffer.concat(parts);
}

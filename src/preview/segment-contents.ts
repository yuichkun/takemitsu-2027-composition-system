// What a segment of one part mixes: the rule the player plays by (src/preview/player.ts), kept
// free of the browser and of Node so the answer check (tools/check.ts) can mix exactly the same.

export const segmentSeconds = 2;
const sampleRate = 48000;

/** [chunk key, the chunk's frame 0 relative to the segment's start, gain] */
export type Contribution = [string, number, number];

export interface Place {
  key: string;
  origin: number;
  gain: number;
  /** Frames of the notes, and of the tail at most (while not rendered). */
  noteFrames: number;
  tailMax: number;
  /** Stored frames; undefined while not rendered. */
  frames?: number;
  failed: boolean;
}

/**
 * The contributions to segment `index` from one part's places (sorted by origin), and whether
 * all of it is known: a place not rendered yet may sound up to its notes plus the longest tail,
 * so a segment it may reach is not complete. A failed place is a hole. `reach` is the longest a
 * place of the part may sound (seconds), to skip the earlier ones.
 */
export function segmentContents(
  places: Place[],
  reach: number,
  index: number,
): { complete: boolean; mix: Contribution[] } {
  const start = index * segmentSeconds;
  const end = start + segmentSeconds;
  const earliest = start - reach - 1;
  let lo = 0;
  let hi = places.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (places[mid]!.origin < earliest) lo = mid + 1;
    else hi = mid;
  }
  let complete = true;
  const mix: Contribution[] = [];
  for (let i = lo; i < places.length && places[i]!.origin < end; i++) {
    const e = places[i]!;
    if (e.failed) continue;
    if (e.frames === undefined) {
      if (e.origin + (e.noteFrames + e.tailMax) / sampleRate > start) complete = false;
      continue;
    }
    if (!e.frames) continue;
    const offset = Math.round((e.origin - start) * sampleRate);
    if (offset + e.frames <= 0) continue;
    mix.push([e.key, offset, e.gain]);
  }
  return { complete, mix };
}

/** The longest a place may sound (seconds), for `reach`. */
export const placeReach = (p: Place) => (p.noteFrames + p.tailMax) / sampleRate;

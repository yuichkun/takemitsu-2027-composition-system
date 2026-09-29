// antara, the opening — candidate "rings": the harps come where a stroke arrives while the one
// before still rings. Card: README.md; the scene and what the candidates share: ../README.md,
// ../common.ts.
//
// The celesta's betweens are drawn from a set that shrinks as time passes (../common.ts,
// shrinking). A struck note rings for a while (Ring). A stroke that comes while the one before
// still rings is joined to it: harp 1 plays too. A stroke that comes while the two before still
// ring (three sounds at once): harp 2 too, on the same string (the first interval). Where strokes
// keep coming so, the rings no longer stop between them: the first violins, in two, take the two
// notes (the note, and harp 2's) and hold them across each such stretch, so the joined rings are
// heard as one held sound. The ground has no pitch: only the rolls.

import type { DynamicPoint, NoteEvent, Score } from "../../../../../src/score/types.ts";
import { number, toggle, type Values } from "../../../../../src/sketch/knobs.ts";
import {
  BAND_SIZE,
  familyOf,
  ground,
  harpPitches,
  partOf,
  scoreOf,
  secondsOf,
  shrinking,
  shrinkKnobs,
  soundKnobs,
  strokeParts,
  strokesOf,
  TICKS,
  time,
} from "../common.ts";
import { atomOf } from "../../../between.ts";

export { seams } from "../common.ts";

export const knobs = {
  ...shrinkKnobs(),
  ring: number({
    group: "Harps",
    label: "Ring",
    help: "How long a struck note rings: a stroke that comes sooner than this after the one before is joined to it (harp 1); one that comes sooner than this after the one two before, harp 2 too",
    value: 1.25,
    min: 0.5,
    max: 6,
    step: 0.25,
    unit: "s",
  }),
  halo: toggle({
    group: "Harps",
    label: "Held rings",
    help: "Where every stroke has both harps, the first violins (in two, flautando) hold the two notes from the first such stroke to the ring of the last",
    value: true,
  }),
  ...soundKnobs("noise only"),
};

type V = Values<typeof knobs>;

export function score(v: V): Score {
  const family = familyOf(v.family);
  const seconds = secondsOf(family, v.tempo);
  const gaps = shrinking(v);
  const times = strokesOf(v.intro * TICKS, gaps, family);
  // The ring as a between: a whole number of atoms (so a held ring ends on the atoms' grid).
  const ring = Math.max(1, Math.round(v.ring / seconds));
  const ringTicks = ring * atomOf(family);
  // Stroke k comes after the between gaps[k - 1].
  const one: number[] = [];
  const two: number[] = [];
  for (let k = 1; k < times.length; k++) {
    if (gaps[k - 1]! >= ring) continue;
    one.push(k);
    if (k >= 2 && gaps[k - 1]! + gaps[k - 2]! < ring) two.push(k);
  }

  // Held rings: each run of strokes that all have harp 2, from its first to its last stroke's ring.
  const spans: [number, number][] = [];
  if (v.halo)
    for (let n = 0; n < two.length; n++) {
      let m = n;
      while (m + 1 < two.length && two[m + 1] === two[m]! + 1) m++;
      const span: [number, number] = [times[two[n]!]!, times[two[m]!]! + ringTicks];
      const last = spans.at(-1);
      if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
      else spans.push(span);
      n = m;
    }

  const end = Math.max(times.at(-1)! + 2 * TICKS, ...spans.map((s) => s[1]));
  // With the six low voices (Ground: gives way), one leaves each time harp 2 plays.
  const leaves = two.slice(0, BAND_SIZE).map((k) => times[k]!);
  const parts = [...strokeParts(v, times, one, two, end), ...ground(v, end, leaves)];
  if (spans.length) {
    const held = (midi: number): NoteEvent[] =>
      spans.map(([a, b]) => ({
        at: time(a),
        dur: time(b - a),
        pitch: { midi },
        technique: "flautando",
      }));
    // Out of nothing into pp over two beats (or half the stretch), and back into nothing.
    const swells: DynamicPoint[] = spans.flatMap(([a, b]) => {
      const rise = Math.round(Math.min(2 * TICKS, (b - a) / 2));
      const top: DynamicPoint[] =
        b - rise > a + rise
          ? [
              { at: time(a + rise), level: 2, to: "linear" },
              { at: time(b - rise), level: 2, to: "linear" },
            ]
          : [{ at: time(a + rise), level: 2, to: "linear" }];
      return [{ at: time(a), level: 0.5, to: "linear" }, ...top, { at: time(b), level: 0.5 }];
    });
    const [h1, h2] = harpPitches(v);
    parts.push(partOf("vn1-2-1", held(Math.max(h1, h2)), swells));
    parts.push(partOf("vn1-2-2", held(Math.min(h1, h2)), swells));
  }
  return scoreOf("antara · opening, where the rings join", v, parts, end, [
    times[one[0]!],
    times[two[0]!],
  ]);
}

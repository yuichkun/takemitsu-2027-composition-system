// Shared by the palette sketches (sketches/antara/palette/): the helpers of the line sketches, and
// what more a chord of many voices needs: string sections divided by register, players handed
// out low to high, and dynamic curves built from pieces.

import type { DynamicPoint } from "../../../src/score/types.ts";
import { time, type Player } from "../ideas/lines/common.ts";

export {
  assign,
  fold,
  gridOf,
  note,
  part,
  scoreOf,
  stack,
  stream,
  TICKS,
  time,
  type Player,
} from "../ideas/lines/common.ts";

interface Section {
  instrument: string;
  name: string;
  abbreviation: string;
  size: number;
  range: [number, number];
}

const SECTIONS: Section[] = [
  { instrument: "basses", name: "Contrabasses", abbreviation: "Cb.", size: 8, range: [28, 67] },
  { instrument: "cellos", name: "Violoncellos", abbreviation: "Vc.", size: 10, range: [36, 84] },
  { instrument: "violas", name: "Violas", abbreviation: "Va.", size: 12, range: [48, 91] },
  {
    instrument: "violins-2",
    name: "Violins II",
    abbreviation: "Vn. II",
    size: 14,
    range: [55, 100],
  },
  { instrument: "violins-1", name: "Violins I", abbreviation: "Vn. I", size: 16, range: [55, 103] },
];

const fits = (r: [number, number], [lo, hi]: [number, number]) => r[0] >= lo && r[1] <= hi;

/**
 * Divides the string sections among voices, low to high: each voice (given by the lowest and
 * highest pitch it reaches) gets a divided part of a section whose range holds it, spread over the
 * cellos, violas and violins as evenly as the ranges allow (basses only for voices below the
 * cellos). Each section's players are shared out among its parts. Parts come back in the voices'
 * order, with ids like "vc-2".
 */
export function divisi(ranges: [number, number][], prefix = ""): Player[] {
  const upper = SECTIONS.slice(1);
  let floor = 0;
  const chosen = ranges.map((r, k) => {
    if (r[0] < upper[0]!.range[0]) return SECTIONS[0]!;
    const ideal = Math.floor((k * upper.length) / ranges.length);
    const order = upper
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => i >= floor)
      .sort((a, b) => Math.abs(a.i - ideal) - Math.abs(b.i - ideal) || a.i - b.i);
    const hit = order.find(({ s }) => fits(r, s.range)) ?? order[0]!;
    floor = hit.i;
    return hit.s;
  });
  const counts = new Map<Section, number>();
  for (const s of chosen) counts.set(s, (counts.get(s) ?? 0) + 1);
  const seen = new Map<Section, number>();
  return chosen.map((s, k) => {
    const n = counts.get(s)!;
    const below = seen.get(s) ?? 0;
    seen.set(s, below + 1);
    // Divisions are numbered from the top (1 is the highest); the larger shares go to the top.
    const j = n - 1 - below;
    const players = Math.floor(s.size / n) + (j < s.size % n ? 1 : 0);
    const one = n === 1;
    const short = s.abbreviation.replace(".", "").toLowerCase().replace(" ", "");
    return {
      id: `${prefix}${short}-${j + 1}`,
      instrument: s.instrument,
      name: one ? s.name : `${s.name} ${j + 1}`,
      abbreviation: one ? s.abbreviation : `${s.abbreviation} ${j + 1}`,
      players: Math.max(1, players),
      range: ranges[k]!,
      grids: [0, 1],
    };
  });
}

/**
 * Hands players to voices in order, low to high: each voice takes the next player whose range
 * holds it, leaving enough players for the voices above. When none fits, the next one is taken
 * anyway (its notes may leave its range). `pool` is ordered low to high.
 */
export function inOrder(ranges: [number, number][], pool: Player[]): Player[] {
  let j = 0;
  return ranges.map((r, k) => {
    const spare = pool.length - j - (ranges.length - k);
    let pick = j;
    for (let a = j; a <= j + Math.max(0, spare); a++) {
      if (a < pool.length && fits(r, pool[a]!.range)) {
        pick = a;
        break;
      }
    }
    pick = Math.min(pick, pool.length - 1);
    j = pick + 1;
    return { ...pool[pick]!, range: r };
  });
}

/**
 * Numbers the players of each instrument from the top (1 is the highest, by the range each one
 * plays); a player alone on its instrument gets no number.
 */
export function numberFromTop(players: Player[]): Player[] {
  const strip = (s: string) => s.replace(/\s*\d+$/, "");
  const middle = (p: Player) => p.range[0] + p.range[1];
  return players.map((p) => {
    const same = players.filter((q) => q.instrument === p.instrument);
    const id = strip(p.id);
    const name = strip(p.name ?? p.instrument);
    const abbreviation = strip(p.abbreviation ?? p.instrument);
    if (same.length === 1) return { ...p, id, name, abbreviation };
    const rank = [...same].sort((a, b) => middle(b) - middle(a)).indexOf(p) + 1;
    return {
      ...p,
      id: `${id}${rank}`,
      name: `${name} ${rank}`,
      abbreviation: `${abbreviation} ${rank}`,
    };
  });
}

/**
 * A dynamic curve from pieces, in ticks: each piece is a point, and says whether the curve moves
 * on to the next point gradually. Points at the same tick keep the last one given; the result is
 * in time order, ready for a part.
 */
export function curve(points: { at: number; level: number; ramp?: boolean }[]): DynamicPoint[] {
  const byTick = new Map<number, { level: number; ramp?: boolean }>();
  for (const p of points) byTick.set(Math.round(p.at), { level: p.level, ramp: p.ramp });
  return [...byTick.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([at, p]) => ({
      at: time(at),
      level: p.level,
      ...(p.ramp ? { to: "linear" as const } : {}),
    }));
}

// The trial piece's material, handed from the piece to every section (ctx.material.trial).
//
// - `set`: the pitch betweens every line walks. Its sum is 0, so a line comes back to its standpoint
//   at the end of every cycle: its home.
// - `home`: the standpoints of the four register groups, low to high. Every line of a group stands
//   on its group's pitch. Together they are the home chord.
// - `drift`: the sums the set takes, one after another, when the home starts to move (the fourth
//   section). They swing to and fro and shrink, so the home closes in on a point between two
//   positions a quarter tone apart: the axis, which no one can play.

export type Group = "L" | "ML" | "MH" | "H";
export const GROUPS: Group[] = ["L", "ML", "MH", "H"];

export interface Trial {
  set: number[];
  home: Record<Group, number>;
  drift: number[];
  /** Where the drift closes in, from the home: halfway between its last two positions. */
  axis: number;
  seed: number;
  /** Ticks: where every line comes home at once and the dance begins. */
  meet: number;
}

/** The home chord: a bass and the betweens above it, one per group. */
export function homeOf(bass: number, betweens: number[]): Record<Group, number> {
  if (betweens.length !== 3)
    throw new Error("Home: give three betweens, from the bottom (e.g. 13 14 11)");
  const L = bass;
  const ML = L + betweens[0]!;
  const MH = ML + betweens[1]!;
  const H = MH + betweens[2]!;
  return { L, ML, MH, H };
}

/** Positions the home takes as the drift's sums add up (0 first). */
export function driftPositions(drift: number[]): number[] {
  const out = [0];
  for (const s of drift) out.push(out[out.length - 1]! + s);
  return out;
}

/** Sounding ranges where each group's lines may go, for choosing who plays in which group. */
export const reach = (t: Trial, g: Group): [number, number] => {
  const up = t.set.filter((b) => b > 0).reduce((a, b) => a + b, 0);
  const down = t.set.filter((b) => b < 0).reduce((a, b) => a + b, 0);
  return [t.home[g] + down, t.home[g] + up];
};

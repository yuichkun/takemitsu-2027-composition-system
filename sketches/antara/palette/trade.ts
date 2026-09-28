// The betweens trade places (palette/a/pitch-trade-places, and the B sketches that use it).
//
// A chord is its betweens stacked on a standpoint: the lowest voice is the standpoint, each voice
// above is the one below it plus a between. When two neighbouring betweens trade places, exactly
// one voice moves (the one standing between them, by the difference of the two) and every other
// voice holds: the betweens below it and above it are the same numbers as before, in the other
// order. The lowest voice and the highest (the standpoint plus the sum) never move.

/** The pitches of a chord: the standpoint, then each between added in turn, bottom up. */
export function tones(anchor: number, betweens: number[]): number[] {
  const out = [anchor];
  for (const b of betweens) out.push(out.at(-1)! + b);
  return out;
}

/**
 * One event of trading: the neighbours that trade places at the same moment (each number is the
 * position of the lower between of a pair; the voice at position + 1 moves), and whether it begins
 * a new wave.
 */
export interface Trade {
  pairs: number[];
  wave: number;
}

/**
 * Turns the order round one pair at a time. The between furthest out of place travels down,
 * trading places with each neighbour below it in turn (one wave: one voice at a time, from the top
 * of the chord down), then the next. `wider` sends the wide betweens down (the chord ends wide at
 * the bottom); otherwise the narrow ones go down.
 */
export function waves(start: number[], wider: boolean): Trade[] {
  const b = [...start];
  const out: Trade[] = [];
  const outOfPlace = (lo: number, hi: number) => (wider ? hi > lo : hi < lo);
  let wave = 0;
  for (let top = 0; top < b.length - 1; top++) {
    let moved = false;
    for (let pos = b.length - 2; pos >= top; pos--) {
      if (!outOfPlace(b[pos]!, b[pos + 1]!)) continue;
      [b[pos], b[pos + 1]] = [b[pos + 1]!, b[pos]!];
      out.push({ pairs: [pos], wave });
      moved = true;
    }
    if (moved) wave++;
  }
  return out;
}

/**
 * Turns the order round in fewer, larger steps: at each step every other pair of neighbours that is
 * out of order trades places at once (the pairs starting at even positions, then at odd ones), so
 * several voices move together. `wider` as in `waves`.
 */
export function steps(start: number[], wider: boolean): Trade[] {
  const b = [...start];
  const out: Trade[] = [];
  const outOfPlace = (lo: number, hi: number) => (wider ? hi > lo : hi < lo);
  let idle = 0;
  for (let r = 0; idle < 2; r++) {
    const pairs: number[] = [];
    for (let pos = r % 2; pos < b.length - 1; pos += 2) {
      if (!outOfPlace(b[pos]!, b[pos + 1]!)) continue;
      [b[pos], b[pos + 1]] = [b[pos + 1]!, b[pos]!];
      pairs.push(pos);
    }
    if (pairs.length === 0) idle++;
    else {
      idle = 0;
      out.push({ pairs, wave: out.length });
    }
  }
  return out;
}

/** Applies a trade to an order of betweens (a new array). */
export function apply(b: number[], trade: Trade): number[] {
  const out = [...b];
  for (const pos of trade.pairs) [out[pos], out[pos + 1]] = [out[pos + 1]!, out[pos]!];
  return out;
}

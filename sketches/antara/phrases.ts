// Continuous four-group phrase sharing, used by running and climax.

/** Bounded continuous slices; overlap is included in the limit, never appended beyond it. */
export function sharedPhrases<T>(strokes: readonly T[], size: number, overlap: number): T[][] {
  if (
    !Number.isInteger(size) ||
    size < 1 ||
    !Number.isInteger(overlap) ||
    overlap < 0 ||
    overlap >= size ||
    overlap * 2 > size
  )
    throw new Error("Chunk must be a positive whole number; Overlap must be 0 to half of Chunk");
  const groups: T[][] = Array.from({ length: 4 }, () => []);
  let from = 0;
  let turn = 0;
  while (from < strokes.length) {
    const to = Math.min(strokes.length, from + size);
    groups[turn % groups.length]!.push(...strokes.slice(from, to));
    if (to === strokes.length) break;
    from = to - overlap;
    turn++;
  }
  return groups;
}

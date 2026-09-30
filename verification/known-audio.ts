import assert from "node:assert/strict";

/** Ratchet is scored but awaits the user's sample (decision 0012). Keep all other warnings fatal. */
export function assertKnownAudioWarnings(warnings: string[]): void {
  assert.deepEqual(
    warnings.filter((w) => w !== "Ratchet: no sound for Ratchet (put samples in samples/ratchet/)"),
    [],
  );
}

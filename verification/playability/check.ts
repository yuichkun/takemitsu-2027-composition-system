// vp node verification/playability/check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hornAssignment } from "../../sketches/antara/ideas/running-orchestra/sketch.ts";
import { normalize } from "../../src/score/normalize.ts";
import { toMusicXml } from "../../src/notation/musicxml.ts";
const previous = [70, 60, 52, 55].map((midi) => ({ at: 0, midi }));
assert.deepEqual(hornAssignment([51.5, 60, 70], 240, previous), [2, 1, 0]);
const doubles = hornAssignment([70, 70], 240, previous);
assert.equal(new Set(doubles).size, 2, "unisons still need two distinct players");
assert.deepEqual(hornAssignment([70, 60, 52], 0, Array(4).fill(undefined)), [0, 1, 2]);
const raw = JSON.parse(
  readFileSync(new URL("../../pieces/antara/antara.json", import.meta.url), "utf8"),
);
const score = normalize(raw);
let maximum = 0;
let fastLarge = 0;
for (const p of score.parts.filter((p) => /^hn[1-4]$/.test(p.id))) {
  const notes = p.notes.filter((n) => n.at.value >= 420 && n.at.value < 520);
  for (let i = 1; i < notes.length; i++) {
    const previous = notes[i - 1]!;
    const n = notes[i]!;
    assert(n.at.gte(previous.end), "one player cannot overlap notes");
    const leap = Math.abs(n.pitches[0]!.midi - previous.pitches[0]!.midi);
    maximum = Math.max(maximum, leap);
    if (leap > 12 && n.at.sub(previous.at).value <= 2) fastLarge++;
  }
}
assert.equal(maximum, 11.5);
assert.equal(fastLarge, 0);
for (const [id, text, at] of [
  ["wbl", "prepare marimba", 268],
  ["scym", "prepare glockenspiel", 604],
  ["tam", "prepare vibraphone", 604],
] as const) {
  assert(
    score.parts.find((p) => p.id === id)!.texts.some((t) => t.text === text && t.at.value === at),
  );
}
assert.deepEqual(toMusicXml(raw).warnings, []);
console.log(
  "PASS: horn continuity, distinct players on unisons, no overlaps, early percussion preparation marks.",
);

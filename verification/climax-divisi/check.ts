// vp node verification/climax-divisi/check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sharedPhrases } from "../../sketches/antara/phrases.ts";
import { knobs, score } from "../../sketches/antara/ideas/climax/sketch.ts";
import { resolveValues, type Values } from "../../src/sketch/knobs.ts";
import { normalize } from "../../src/score/normalize.ts";
import { toMusicXml } from "../../src/notation/musicxml.ts";
import { plan } from "../../src/performance/plan.ts";

const groups = sharedPhrases(
  Array.from({ length: 30 }, (_, i) => i),
  10,
  3,
);
assert.deepEqual(
  groups.map((g) => [g[0], g.at(-1)]),
  [
    [0, 9],
    [7, 16],
    [14, 23],
    [21, 29],
  ],
);
assert.throws(() => sharedPhrases([1], 10, 6));
const v = resolveValues(knobs, {}) as Values<typeof knobs>;
const s = normalize(score(v));
const alternate = normalize(score({ ...v, chunk: 24, overlap: 0 }));
const signature = (n: (typeof s.parts)[number]["notes"][number]) =>
  JSON.stringify([n.at.value, n.end.value, n.pitches.map((p) => p.midi), n.articulations]);
for (const prefix of ["vn1", "vn2", "va"]) {
  const divided = s.parts.filter((p) => p.id.startsWith(`${prefix}-4-`));
  assert.equal(divided.length, 4);
  const tutti = s.parts.find((p) => p.id === `${prefix}t`)!;
  assert.equal(tutti.notes.length, 1);
  const cut = tutti.notes[0]!.at.value;
  const coverage = new Map<string, number>();
  for (const p of divided) {
    let run = 0;
    let end = -1;
    for (const n of p.notes) {
      run = n.at.value === end ? run + 1 : 1;
      assert(run <= 10, "a player's uninterrupted chunk stays within the limit");
      end = n.end.value;
      assert(end <= cut);
      const key = signature(n);
      coverage.set(key, (coverage.get(key) ?? 0) + 1);
    }
  }
  assert([...coverage.values()].every((n) => n === 1 || n === 2));
  const original = alternate.parts
    .filter((p) => p.id.startsWith(`${prefix}-4-`))
    .flatMap((p) => p.notes);
  assert.deepEqual([...coverage.keys()].sort(), original.map(signature).sort());
  const ordered = [...coverage.keys()]
    .map((k) => JSON.parse(k) as [number, number])
    .sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ordered.length; i++)
    assert.equal(ordered[i]![0], ordered[i - 1]![1], "no hole in the combined line");
  assert.equal(ordered.at(-1)![1], cut);
}
const cellos = s.parts.filter((p) => p.id.startsWith("vc-4-"));
assert.equal(cellos.length, 4);
const counts = new Map<number, number>();
for (const p of cellos) {
  const midi = p.notes[0]!.pitches[0]!.midi;
  counts.set(midi, (counts.get(midi) ?? 0) + p.players);
}
assert.deepEqual([...counts.values()], [5, 5]);
const full = JSON.parse(
  readFileSync(new URL("../../pieces/antara/antara.json", import.meta.url), "utf8"),
);
assert.deepEqual(toMusicXml(full).warnings, []);
assert.deepEqual(plan(normalize(full)).warnings, []);
console.log(
  "PASS: same four groups, <=10 consecutive notes, three-note overlap, complete unchanged line, tutti cut, five cellists per original pitch, full-score checks.",
);

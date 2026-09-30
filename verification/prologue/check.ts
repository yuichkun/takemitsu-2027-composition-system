// vp node verification/prologue/check.ts
import assert from "node:assert/strict";
import { knobs, score } from "../../sketches/antara/ideas/prologue/sketch.ts";
import { resolveValues, type Values } from "../../src/sketch/knobs.ts";
import { normalize } from "../../src/score/normalize.ts";
import { plan } from "../../src/performance/plan.ts";
import { toMusicXml } from "../../src/notation/musicxml.ts";
const v = resolveValues(knobs, {}) as Values<typeof knobs>;
const old = normalize(score({ ...v, stop: 5, noiseLevel: 0 }));
const raw = score(v);
const current = normalize(raw);
for (const p of old.parts) {
  const next = current.parts.find((n) => n.id === p.id)!;
  assert.deepEqual(next.dynamics, p.dynamics);
  assert.equal(next.notes.length, 1);
  const a = p.notes[0]!,
    b = next.notes[0]!;
  assert.equal(b.at.value, a.at.value);
  assert.equal(b.end.sub(a.end).value, 5);
  assert.deepEqual(b.pitches, a.pitches);
  assert.deepEqual(b.technique, a.technique);
}
const cym = current.parts.find((p) => p.id === "scym")!;
assert.equal(cym.notes.length, 1);
assert.equal(cym.notes[0]!.at.value, 6);
assert.equal(cym.notes[0]!.end.value, 11.8);
assert(cym.notes[0]!.technique.includes("roll"));
assert.equal(cym.notes[0]!.articulations.length, 0);
assert(cym.texts.some((t) => t.text === "damp" && t.at.value === 11.8));
assert.equal(raw.measures, 4);
assert.deepEqual(raw.fermatas, [{ at: [12, 1] }]);
assert(!normalize(score({ ...v, noiseLevel: 0 })).parts.some((p) => p.id === "scym"));
assert.deepEqual(plan(current).warnings, []);
assert.deepEqual(toMusicXml(raw).warnings, []);
console.log(
  "PASS: every string held five extra beats; original entries/pitches/dynamics; quiet roll with common cut; full fermata bar; noise off control.",
);

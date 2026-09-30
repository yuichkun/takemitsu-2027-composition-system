// vp node verification/harp-parts/check.ts
// Sparse fixed-pedal reflections, and both simultaneous ending reflections surviving export.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { knobs, score } from "../../sketches/antara/ideas/two-grids-orchestra/sketch.ts";
import { toMusicXml } from "../../src/notation/musicxml.ts";
import { plan } from "../../src/performance/plan.ts";
import { normalize } from "../../src/score/normalize.ts";
import { parsePitch } from "../../src/score/pitch.ts";
import type { Score, Step } from "../../src/score/types.ts";
import { resolveValues, type Values } from "../../src/sketch/knobs.ts";

const v = resolveValues(knobs, {}) as Values<typeof knobs>;
const stored = JSON.parse(
  readFileSync(
    new URL("../../sketches/antara/ideas/two-grids-orchestra/values.json", import.meta.url),
    "utf8",
  ),
);
for (const [name, overrides] of Object.entries(stored.presets)) {
  const s = score(
    resolveValues(knobs, { ...stored.values, ...(overrides as object) }) as Values<typeof knobs>,
  );
  assert.deepEqual(toMusicXml(s).warnings, [], name);
  assert.deepEqual(plan(normalize(s)).warnings, [], name);
  for (const p of normalize(s).parts.filter((p) => p.instrument.id === "harp")) {
    const alters = new Map<Step, Set<number>>();
    for (let i = 0; i < p.notes.length; i++) {
      const n = p.notes[i]!;
      assert.equal(n.pitches.length, 1, name);
      assert.equal(n.technique.length, 0, name);
      assert(Number.isInteger(n.at.value), name);
      if (i) assert(n.at.sub(p.notes[i - 1]!.at).value >= 4, name);
      const pitch = n.pitches[0]!;
      const tuning = p.id === "hp2" ? -0.5 : 0;
      assert(Number.isInteger(pitch.midi - tuning), name);
      assert(pitch.midi >= 60 + tuning && pitch.midi <= 79 + tuning, name);
      assert([-1, 0, 1].includes(pitch.alter - tuning), name);
      alters.set(pitch.step, new Set([...(alters.get(pitch.step) ?? []), pitch.alter]));
    }
    assert(
      [...alters.values()].every((x) => x.size === 1),
      name,
    );
  }
}
assert(!score({ ...v, reflect: "off" }).parts.some((p) => p.instrument === "harp"));

const ending = JSON.parse(
  readFileSync(new URL("../../sketches/antara/ideas/ending/ending.json", import.meta.url), "utf8"),
) as Score;
const hp2 = ending.parts.find((p) => p.id === "hp2")!;
const normal = normalize({ ...ending, parts: [hp2] });
assert.deepEqual(
  normal.parts[0]!.notes.filter((n) => n.at.value === 2)
    .map((n) => n.pitches[0]!.midi)
    .sort((a, b) => a - b),
  [65.5, 78.5],
);
for (const p of normalize(ending).parts.filter((p) => p.instrument.id === "harp")) {
  for (const voice of new Set(p.notes.map((n) => n.voice))) {
    const notes = p.notes.filter((n) => n.voice === voice);
    for (let i = 1; i < notes.length; i++) assert(notes[i]!.at.gte(notes[i - 1]!.end));
  }
}
const { musicxml, warnings } = toMusicXml({ ...ending, parts: [hp2] });
assert.deepEqual(warnings, []);
const first = musicxml.match(/<measure number="1">([\s\S]*?)<\/measure>/)![1]!;
const pitches = [
  ...first.matchAll(
    /<pitch><step>([A-G])<\/step>(?:<alter>([^<]+)<\/alter>)?<octave>(\d+)<\/octave><\/pitch>/g,
  ),
]
  .map(
    (m) => parsePitch({ step: m[1] as Step, alter: Number(m[2] ?? 0), octave: Number(m[3]) }).midi,
  )
  .sort((a, b) => a - b);
assert.deepEqual(pitches, [65.5, 78.5]);
console.log(
  "PASS: every glass preset has sparse ordinary single-note harps on fixed pedals; ending voices do not overlap internally; both pitches survive MusicXML export.",
);

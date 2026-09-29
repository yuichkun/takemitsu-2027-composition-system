// vp node verification/harp-gliss/check.ts
// A harp sweep must pluck the specified strings (including tuning), never bend one note.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { knobs, score as climax } from "../../sketches/antara/ideas/climax/sketch.ts";
import { toMusicXml } from "../../src/notation/musicxml.ts";
import { plan } from "../../src/performance/plan.ts";
import { normalize } from "../../src/score/normalize.ts";
import type { Score } from "../../src/score/types.ts";
import { resolveValues, type Values } from "../../src/sketch/knobs.ts";

const fixture = (tuning = 0): Score => ({
  meter: [{ measure: 1, beats: 4, beatType: 4 }],
  tempo: [{ at: 0, bpm: 120 }],
  measures: 2,
  parts: [
    {
      id: "hp",
      instrument: "harp",
      tuning,
      events: [
        {
          at: 0,
          dur: 2,
          pitch: { midi: 60 + tuning },
          gliss: true,
          glissPitches: [60, 62, 64].map((midi) => ({ midi: midi + tuning })),
        },
        {
          at: 2,
          dur: 2,
          pitch: { midi: 64 + tuning },
          gliss: true,
          glissAfter: 1,
          glissPitches: [64, 62, 60].map((midi) => ({ midi: midi + tuning })),
        },
        { at: 4, dur: 1, pitch: { midi: 60 + tuning } },
      ],
    },
  ],
});

for (const tuning of [0, -0.5]) {
  const s = fixture(tuning);
  const p = plan(normalize(s));
  assert.deepEqual(p.warnings, []);
  const notes = p.lanes.flatMap((l) =>
    l.kind === "bbcso"
      ? l.notes.map((n) => ({
          midi: n.key + l.tune,
          on: n.on,
          off: n.off,
          glide: n.glide,
          articulation: n.articulation,
        }))
      : [],
  );
  assert.deepEqual(
    notes.map((n) => n.midi),
    [60, 62, 64, 62, 60].map((m) => m + tuning),
  );
  assert.deepEqual(
    notes.map((n) => n.on),
    [0, 0.5, 1, 1.75, 2],
  );
  assert(notes.every((n) => !n.glide && n.articulation === "Short Sustained"));
  const xml = toMusicXml(s);
  assert.deepEqual(xml.warnings, []);
  assert(xml.musicxml.includes("<glissando"));
  assert.equal(normalize(s).parts[0]!.notes.length, 3);
}

const invalid = fixture();
const first = invalid.parts[0]!.events[0]!;
if (first.type === "text") throw new Error("fixture");
first.glissPitches = [{ midi: 60 }, { midi: 62.5 }, { midi: 64 }];
assert.throws(() => normalize(invalid), /tuning/);
first.glissPitches = [{ midi: 60 }, { midi: 62 }, { midi: 65 }];
assert.throws(() => plan(normalize(invalid)), /next note/);

// Existing continuous glissandi still use a tuning path.
const continuous = fixture();
continuous.parts[0]!.instrument = "violins-1";
continuous.parts[0]!.players = 1;
for (const event of continuous.parts[0]!.events)
  if (event.type !== "text") delete event.glissPitches;
assert(
  plan(normalize(continuous)).lanes.some((l) => l.kind === "bbcso" && l.notes.some((n) => n.glide)),
);

// The actual climax: each harp has one legal, unchanged seven-string pedal configuration,
// every swept pitch belongs to the intersection of its bell's pitch classes over all states.
const v = resolveValues(knobs, {}) as Values<typeof knobs>;
const s = climax(v);
const normal = normalize(s);
const performance = plan(normal);
assert.deepEqual(toMusicXml(s).warnings, []);
assert.deepEqual(performance.warnings, []);
for (const [id, tuning, shift] of [
  ["hp1", 0, 0],
  ["hp2", -0.5, 2.5],
] as const) {
  const part = normal.parts.find((p) => p.id === id)!;
  const routes = part.notes.flatMap((n) => n.glissPitches ?? []);
  const spelling = new Map<string, Set<number>>();
  for (const p of routes) {
    assert(Number.isInteger(p.midi - tuning));
    assert([-1, 0, 1].includes(p.alter - tuning));
    spelling.set(p.step, new Set([...(spelling.get(p.step) ?? []), p.alter]));
    for (let state = 0; state < 8; state++) {
      const gray = state ^ (state >> 1);
      const sizes = [6, 9, 13, 32].map((x, i) =>
        i < 3 && (gray >> i) & 1 ? x + [1, 2, -3][i]! : x,
      );
      const pcs = Array.from(
        { length: 16 },
        (_, mask) =>
          (28 + shift + sizes.reduce((sum, x, i) => sum + ((mask >> i) & 1 ? x : 0), 0)) % 12,
      );
      assert(pcs.includes(p.midi % 12));
    }
  }
  assert.equal(spelling.size, 7);
  assert([...spelling.values()].every((a) => a.size === 1));
  assert(part.notes[0]!.at.value >= 8);
  assert.equal(part.notes.at(-1)!.end.value, 92.5);
  const lanes = performance.lanes.filter((l) => l.partId === id);
  assert(
    lanes.every((l) => l.kind === "bbcso" && l.notes.every((n) => !n.glide && n.off <= 46.25)),
  );
  console.log(
    `${id}: ${routes.length} swept pitch entries, fixed pedals, no pitch bends, release by 46.25s`,
  );
}

const full = JSON.parse(
  readFileSync(new URL("../../pieces/antara/antara.json", import.meta.url), "utf8"),
) as Score;
assert.deepEqual(plan(normalize(full)).warnings, []);
console.log(
  "PASS: discrete sweeps, held starts, reversed sweeps, quarter-tone tuning, endpoints, MusicXML, fixed pedals, full piece",
);

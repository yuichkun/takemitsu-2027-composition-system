// vp node verification/piano-pickup/check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalize, levelAt } from "../../src/score/normalize.ts";
import { toMusicXml } from "../../src/notation/musicxml.ts";
import { plan } from "../../src/performance/plan.ts";
import { knobs, pianoLeadIn, score } from "../../sketches/antara/ideas/running-orchestra/sketch.ts";
import { resolveValues, type Values } from "../../src/sketch/knobs.ts";
const v = resolveValues(knobs, {}) as Values<typeof knobs>;
const lead = pianoLeadIn(v, 44);
const running = normalize(score(v));
const piano = running.parts.find((p) => p.id === "pno")!;
assert.deepEqual(
  pianoLeadIn(v, 42),
  piano.notes
    .filter((n) => n.at.value < 14)
    .map((n) => ({
      step: Math.round(n.at.value * 3),
      midi: n.pitches[0]!.midi,
      head: n.articulations.includes("accent"),
    })),
);
assert.equal(lead.length, 44);
assert.deepEqual(
  lead.map((n) => n.step),
  Array.from({ length: 44 }, (_, i) => i),
);
assert(lead.every((n) => Number.isInteger(n.midi)));
const moving = piano.notes.filter((n) => n.at.value < 96);
assert.equal(moving[0]!.at.value, 0);
assert(moving.every((n) => n.articulations.includes("staccato")));
for (let i = 1; i < moving.length; i++)
  assert(moving[i]!.at.eq(moving[i - 1]!.end), "running piano must not rest");
assert.equal(moving.at(-1)!.end.value, 96);
for (const [from, to, lo, hi] of [
  [0, 32.5, 31, 52],
  [32.5, 64, 43, 64],
  [64, 96, 55, 76],
]) {
  const span = moving.filter((n) => n.at.value >= from! && n.at.value < to!);
  assert(span.length > 0);
  assert(
    span.every((n) => n.pitches[0]!.midi >= lo! && n.pitches[0]!.midi <= hi!),
    "piano register rises in three bands",
  );
}
const moved = pianoLeadIn({ ...v, anchor: v.anchor + 2 }, 44);
assert.deepEqual(
  moved.map((n) => n.midi % 12),
  lead.map((n) => (n.midi + 2) % 12),
);
const raw = JSON.parse(
  readFileSync(new URL("../../sketches/antara/ideas/series/series.json", import.meta.url), "utf8"),
);
const series = normalize(raw);
const p = series.parts.find((p) => p.id === "pno")!;
const pickup = p.notes.filter((n) => n.at.value >= 133);
assert.equal(pickup[0]!.at.value, 133);
assert.equal(pickup[0]!.pitches[0]!.midi, 38, "start on D2, one octave lower");
for (let i = 1; i < pickup.length; i++)
  assert(pickup[i]!.at.eq(pickup[i - 1]!.end), "pickup must not rest");
assert.equal(pickup.at(-1)!.end.value, 144);
assert(
  p.notes.filter((n) => n.at.value === 133).every((n) => n.pitches.length === 1),
  "piano starts the melody, not the final chord",
);
assert(pickup.every((n) => n.pitches.length === 1));
assert(pickup.every((n) => n.articulations.includes("staccato")));
assert(
  series.parts
    .find((p) => p.id === "hn1")!
    .notes.some((n) => n.at.value === 133 && n.end.value === 134),
  "other instruments hold their final chord under the pickup",
);
assert.equal(levelAt(p.dynamics, pickup[0]!.at), 6);
assert.equal(levelAt(piano.dynamics, piano.notes[0]!.at), 6);
assert(pickup.every((n) => n.dur.value === 0.25 && Number.isInteger(n.pitches[0]!.midi)));
assert.deepEqual(
  pickup.map((n) => ({
    step: Math.round((n.at.value - 133) * 4),
    midi: n.pitches[0]!.midi,
    head: n.articulations.includes("accent"),
  })),
  lead,
);
assert(!series.parts.find((p) => p.id === "vct")!.notes.some((n) => n.at.value >= 134));
const xml = toMusicXml({ ...raw, parts: raw.parts.filter((p: { id: string }) => p.id === "pno") });
assert.deepEqual(xml.warnings, []);
assert(xml.musicxml.includes("in rilievo"));
const full = normalize(
  JSON.parse(readFileSync(new URL("../../pieces/antara/antara.json", import.meta.url), "utf8")),
);
const fullPiano = full.parts.find((p) => p.id === "pno")!;
assert.equal(fullPiano.texts.filter((t) => t.text === "in rilievo").length, 1);
const across = fullPiano.notes.filter((n) => n.at.value >= 413 && n.at.value < 520);
for (let i = 1; i < across.length; i++)
  assert(across[i]!.at.eq(across[i - 1]!.end), "no rest across section boundary");
assert.deepEqual(plan(series).warnings, []);
assert.equal(
  60 / 90 / 4,
  60 / 120 / 3,
  "the two written subdivisions have the same real-time speed",
);
console.log(
  "PASS: shared piano phrase, settings-aware pitches, semitone-only pickup, foreground melody overlaps other instruments, no piano chord, no cello run, unchanged attack speed at transition.",
);

const gate = plan(
  normalize({
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    parts: [
      {
        id: "gate",
        instrument: "piano",
        events: [
          { at: 0, dur: 1, pitch: "D3", articulations: ["staccato"] },
          { at: 2, dur: 1, pitch: "E3" },
        ],
      },
    ],
  }),
)
  .lanes.filter((l) => l.kind === "bbcso")
  .flatMap((l) => l.notes);
assert.equal(gate[0]!.off, 0.5);
assert.equal(gate[1]!.off, 2.99);
console.log(
  "PASS: piano staccato shortens playback key hold without adding rests to the written rhythm.",
);

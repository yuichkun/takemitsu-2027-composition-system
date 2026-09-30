// vp node verification/opening-pulse/check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalize } from "../../src/score/normalize.ts";
import { toMusicXml, layoutFor, dynamicMarks } from "../../src/notation/musicxml.ts";
import { plan } from "../../src/performance/plan.ts";
import type { Score, DynamicPoint } from "../../src/score/types.ts";
const raw = JSON.parse(
  readFileSync(
    new URL("../../sketches/antara/ideas/opening/opening.json", import.meta.url),
    "utf8",
  ),
) as Score;
const score = normalize(raw);
const onEighth = (n: number) => Number.isInteger(n * 2);
for (const p of score.parts) {
  for (const n of p.notes.filter((n) => n.at.value >= 120)) {
    assert(onEighth(n.at.value), p.id);
    assert(onEighth(n.end.value), p.id);
  }
  for (const d of p.dynamics.filter((d) => d.at.value >= 120)) assert(onEighth(d.at.value), p.id);
}
for (const id of ["picc", "fl1", "fl2", "ob1", "ob2"])
  assert(
    score.parts
      .find((p) => p.id === id)!
      .notes.filter((n) => n.at.value >= 120)
      .every((n) => n.dur.value === 0.5),
  );
// The notation rule applies to all families, without reattacking the original held note.
for (const [instrument, pitch] of [
  ["flute", "E5"],
  ["tuba", "E2"],
  ["basses", "E2"],
  ["bass-drum", undefined],
] as const) {
  const dynamics: DynamicPoint[] = Array.from({ length: 9 }, (_, i) => ({
    at: i / 2,
    level: i % 2 ? 2 : 3.5,
    to: "linear",
  }));
  const fixture: Score = {
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    parts: [
      {
        id: "held",
        instrument,
        events: [{ at: 0, dur: 4, ...(pitch ? { pitch } : { technique: "roll+soft" }) }],
        dynamics,
      },
    ],
  };
  const normal = normalize(fixture);
  const before = JSON.stringify(plan(normal));
  const xml = toMusicXml(fixture).musicxml;
  assert.equal((xml.match(/<type>eighth<\/type>/g) ?? []).length, 8, instrument);
  assert.equal((xml.match(/<tie type="start"/g) ?? []).length, 7, instrument);
  assert(!xml.includes("<time-modification>"), instrument);
  assert.equal(normal.parts[0]!.notes.length, 1);
  assert.equal(JSON.stringify(plan(normal)), before);
  const marks = dynamicMarks(layoutFor(normal).staves[0]!).marks;
  assert.equal(
    marks.filter((m) => m.mark === "mp").length,
    1,
    "a wave returning to the known peak need not repeat its mark",
  );
}
const full = JSON.parse(
  readFileSync(new URL("../../pieces/antara/antara.json", import.meta.url), "utf8"),
) as Score;
const { musicxml, warnings } = toMusicXml(full);
assert.deepEqual(warnings, []);
assert(
  [...musicxml.matchAll(/<actual-notes>(\d+)<\/actual-notes>/g)].every(
    (m) => m[1] === "3" || m[1] === "5",
  ),
  "no mixed tuplets introduced by dynamic anchors",
);
assert.deepEqual(plan(normalize(full)).warnings, []);
console.log(
  "PASS: all opening pulse notes and dynamics on eighth grid; rings are eighths; held notes stay single playback events; ties and dynamic anchors for all families; no mixed tuplets.",
);

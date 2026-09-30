// vp node verification/dynamics/check.ts
// Notation must never connect dynamics across silence, or change the performance curve.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { dynamicMarks, layoutFor, stripMeasures, toMusicXml } from "../../src/notation/musicxml.ts";
import { plan } from "../../src/performance/plan.ts";
import { normalize, type NormalPart } from "../../src/score/normalize.ts";
import type { Score } from "../../src/score/types.ts";

function covered(part: NormalPart, start: number, end: number): boolean {
  let at = start;
  for (const n of [...part.notes].sort((a, b) => a.at.cmp(b.at))) {
    if (n.end.value <= at) continue;
    if (n.at.value > at + 1e-8) break;
    at = Math.max(at, n.end.value);
    if (at >= end - 1e-8) return true;
  }
  return false;
}

const fixture: Score = {
  meter: [{ measure: 1, beats: 4, beatType: 4 }],
  measures: 12,
  parts: [
    {
      id: "cb",
      instrument: "basses",
      players: 2,
      events: [
        { at: 0, dur: 4, pitch: "E2" },
        { at: 40, dur: 4, pitch: "G2" },
      ],
      dynamics: [
        { at: 0, level: 2, to: "linear" },
        { at: 4, level: 6 },
        { at: 40, level: 3, to: "linear" },
        { at: 44, level: 5 },
      ],
    },
  ],
};
const first = layoutFor(normalize(fixture)).staves[0]!;
assert.deepEqual(
  dynamicMarks(first).wedges.map((w) => [w.start.value, w.end.value]),
  [
    [0, 4],
    [40, 44],
  ],
);
const strip = stripMeasures(normalize(fixture));
for (const m of strip.measures.slice(2, 10)) {
  assert(!m.musicxml.includes("<wedge"));
  assert(!m.musicxml.includes("<dynamics>"));
  assert.equal(m.seam.hairpins.length, 0);
}

const steady: Score = {
  ...fixture,
  parts: [
    {
      ...fixture.parts[0]!,
      events: [
        { at: 2, dur: 1, pitch: "E2" },
        { at: 40, dur: 1, pitch: "E2" },
      ],
      dynamics: [{ at: 0, level: 3 }],
    },
  ],
};
assert.deepEqual(
  dynamicMarks(layoutFor(normalize(steady)).staves[0]!).marks.map((m) => m.at.value),
  [2, 40],
);

for (const [from, to, word] of [
  [2, 6, "cresc."],
  [6, 2, "dim."],
] as const) {
  const s: Score = {
    ...fixture,
    measures: 6,
    parts: [
      {
        ...fixture.parts[0]!,
        events: [{ at: 0, dur: 20, pitch: "E2" }],
        dynamics: [
          { at: 0, level: from, to: "linear" },
          { at: 20, level: to },
        ],
      },
    ],
  };
  const xml = toMusicXml(s).musicxml;
  assert(xml.includes(word));
  assert(!xml.includes("<wedge"));
  const strips = stripMeasures(normalize(s));
  assert.equal(strips.measures.flatMap((m) => m.seam.hairpins).length, 0);
  assert.equal(strips.measures.filter((m) => m.musicxml.includes(word)).length, 1);
}
const niente: Score = {
  ...fixture,
  parts: [
    {
      ...fixture.parts[0]!,
      events: [{ at: 0, dur: 20, pitch: "E2" }],
      dynamics: [
        { at: 0, level: 0, to: "linear" },
        { at: 20, level: 4 },
      ],
    },
  ],
};
assert(toMusicXml(niente).musicxml.includes('niente="yes"'));
assert(!toMusicXml(niente).musicxml.includes(">cresc.</words>"));

// Shared winds also need a closed curve when a member or the entire staff rests.
const paired: Score = {
  ...fixture,
  parts: [0, 1].map((i) => ({
    ...fixture.parts[0]!,
    id: `fl${i}`,
    instrument: "flute",
    players: 1,
    events: [
      { at: 0, dur: 4, pitch: "C5" },
      { at: 40, dur: 4, pitch: "D5" },
    ],
  })),
};
assert.equal(layoutFor(normalize(paired)).staves.length, 1);

const full = JSON.parse(
  readFileSync(new URL("../../pieces/antara/antara.json", import.meta.url), "utf8"),
) as Score;
let wedges = 0,
  words = 0;
for (const s of [fixture, paired, full]) {
  const n = normalize(s);
  const playback = JSON.stringify(plan(n));
  for (const staff of layoutFor(n).staves) {
    for (const dynamics of [staff.dynamics, staff.dynamicsAbove]) {
      for (const w of dynamicMarks({ ...staff, dynamics }).wedges) {
        assert(
          covered(staff, w.start.value, w.end.value),
          `${staff.id}: ${w.start.value}–${w.end.value} crosses a rest`,
        );
        wedges += Number(!w.asText);
        words += Number(!!w.asText);
      }
    }
  }
  assert.deepEqual(toMusicXml(s).warnings, []);
  assert.equal(JSON.stringify(plan(n)), playback);
}
const cb = full.parts.find((p) => p.id === "cb-4-2")!;
const cbStrip = stripMeasures(normalize({ ...full, parts: [cb] }));
const sectionAt = (node: string) => (full as Score).outline!.nodes.find((n) => n.node === node)!.at;
for (const m of cbStrip.measures.slice(sectionAt("rhythm") / 4, sectionAt("two-grids") / 4 + 3)) {
  assert(!m.musicxml.includes("<wedge"));
  assert.equal(m.seam.hairpins.length, 0);
}
console.log(
  `PASS: silence, late entries, shared staves, full-piece coverage, Cb from rhythm through early two-grids, long words, niente, strip seams; playback unchanged. ${wedges} hairpins, ${words} textual changes checked.`,
);

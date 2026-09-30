// vp node verification/tempo-joins/check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Joiner, sectionOf } from "../../src/sketch/join.ts";
import { Context, type LoadedNode } from "../../src/sketch/nest.ts";
import { normalize } from "../../src/score/normalize.ts";
import { secondsAt } from "../../src/score/timeline.ts";
import { toMusicXml } from "../../src/notation/musicxml.ts";
import { plan } from "../../src/performance/plan.ts";
import { knobs, score } from "../../sketches/antara/ideas/rhythm/sketch.ts";
import { score as pieceScore, knobs as pieceKnobs } from "../../pieces/antara/sketch.ts";
import { resolveValues, type Values } from "../../src/sketch/knobs.ts";
import type { Score } from "../../src/score/types.ts";
const local = score(resolveValues(knobs, {}) as Values<typeof knobs>);
const ctx = Context.root({
  name: "test",
  path: "",
  values: {},
  children: new Map(),
  score: () => local,
});
const j = new Joiner(
  ctx.with({
    ensemble: local.parts.map((p) => ({
      id: p.id,
      instrument: p.instrument,
      name: p.name ?? p.id,
      players: p.players,
    })),
  }),
);
const section = sectionOf({ path: "rhythm", result: local }, ctx);
const placed = j.place(section, { at: 0, from: 84, to: 100, scale: 2 });
assert.equal(placed.bpm, 130);
assert.equal(placed.bpmAt(92 * 240), 150);
const clipped = j.score({ title: "slice" });
assert.equal(clipped.tempo![0]!.bpm, 130);
assert.equal(clipped.tempo![0]!.to, "linear");
assert.equal(clipped.tempo!.at(-1)!.bpm, 170);
assert.equal(clipped.tempo!.at(-1)!.to, undefined);
const full = JSON.parse(
  readFileSync(new URL("../../pieces/antara/antara.json", import.meta.url), "utf8"),
) as Score;
const n = normalize(full);
const rhythm = full.outline!.nodes.find((p) => p.node === "rhythm")!;
const series = full.outline!.nodes.find((p) => p.node === "series")!;
const ramp = n.tempo.find((t) => t.at === rhythm.at + 80)!;
assert.equal(ramp.qpm, 60);
assert.equal(ramp.qpmEnd, 90);
assert.equal(ramp.end, series.at - 8);
const arrival = n.tempo.find((t) => t.at === series.at - 8)!;
assert.equal(arrival.qpm, 90);
assert.equal(arrival.qpmEnd, undefined);
assert(
  Math.abs(secondsAt(n.tempo, series.at) - secondsAt(n.tempo, series.at - 8) - (8 * 60) / 90) <
    1e-8,
);
assert.equal(n.tempoMarks.filter((m) => m.change === "accel.").length, 1);
assert.deepEqual(toMusicXml(full).warnings, []);
assert.deepEqual(plan(n).warnings, []);
// The parent derives the arrival from the next section, including a changed series tempo.
const empty = (bpm?: number): Score => ({
  meter: [{ measure: 1, beats: 4, beatType: 4 }],
  measures: 4,
  parts: [],
  ...(bpm ? { tempo: [{ at: 0, bpm }] } : {}),
});
const children = new Map<string, LoadedNode>([
  ["rest", { name: "rest", path: "rest", values: {}, children: new Map(), score: () => empty() }],
  [
    "rhythm",
    {
      name: "rhythm",
      path: "rhythm",
      values: resolveValues(knobs, {}),
      children: new Map(),
      score: (v) => score(v as Values<typeof knobs>),
    },
  ],
  [
    "series",
    {
      name: "series",
      path: "series",
      values: { tempo: 104 },
      children: new Map(),
      score: (v) => empty(Number(v.tempo)),
    },
  ],
]);
const root: LoadedNode = { name: "piece", path: "", values: {}, children, score: () => empty() };
const adjusted = pieceScore(
  resolveValues(pieceKnobs, { sections: "rhythm series" }),
  Context.root(root),
);
assert.equal(
  adjusted.tempo!.find((t) => (typeof t.at === "number" ? t.at : t.at[0] / t.at[1]) === 104)!.bpm,
  104,
);
console.log(
  "PASS: ramp retained in full piece; complete two bars before C; bridge constant; sliced/scaled ramp endpoints; next-section tempo follows parameter changes.",
);

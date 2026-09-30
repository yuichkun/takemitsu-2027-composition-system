import { assertKnownAudioWarnings } from "../known-audio.ts";
// vp node verification/score-repairs/check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { layoutFor, toMusicXml } from "../../src/notation/musicxml.ts";
import { plan } from "../../src/performance/plan.ts";
import { normalize } from "../../src/score/normalize.ts";
import { parsePitch } from "../../src/score/pitch.ts";
import type { NoteEvent, Score } from "../../src/score/types.ts";
import { Joiner, sectionOf } from "../../src/sketch/join.ts";
import { Context } from "../../src/sketch/nest.ts";

const piece = JSON.parse(
  readFileSync(new URL("../../pieces/antara/antara.json", import.meta.url), "utf8"),
) as Score;
const normal = normalize(piece);
const sectionAt = (node: string) => piece.outline!.nodes.find((n) => n.node === node)!.at;
const endingAt = sectionAt("ending");
const glassAt = sectionAt("two-grids");
assert(!normal.parts.flatMap((p) => p.notes).some((n) => n.technique.includes("harmonic")));
const ending = normal.parts
  .find((p) => p.id === "vn1s")!
  .notes.filter((n) => n.at.value >= endingAt);
assert.equal(ending.at(-1)!.pitches[0]!.midi, 102.5);
assert(ending.every((n) => !n.technique.includes("artificial-harmonic")));
assert(ending.slice(0, -1).every((n) => n.gliss));
assert.equal(
  normal.parts
    .find((p) => p.id === "vct")!
    .notes.filter((n) => n.technique.includes("artificial-harmonic")).length,
  50,
);
const hp = normal.parts.find((p) => p.id === "hp1")!;
for (const at of [18, 27, 31, 47].map((t) => glassAt + t)) {
  const pitch = hp.notes.find((n) => n.at.value === at)!.pitches[0]!;
  assert.equal(pitch.step, "D");
  assert.equal(pitch.alter, 1);
}
assert.equal(hp.notes.find((n) => n.at.value === glassAt + 42)!.pitches[0]!.step, "G");
for (const id of ["hp1", "hp2"]) {
  const harp = normal.parts.find((p) => p.id === id)!;
  const notes = harp.notes.filter((n) => n.at.value >= endingAt);
  const tuning = id === "hp2" ? -0.5 : 0;
  const pedals = new Map<string, number>();
  for (const n of notes)
    for (const pitch of n.pitches) {
      const alter = pitch.alter - tuning;
      assert([-1, 0, 1].includes(alter));
      if (pedals.has(pitch.step)) assert.equal(pedals.get(pitch.step), alter);
      pedals.set(pitch.step, alter);
    }
  assert(harp.texts.some((t) => t.at.value === endingAt && t.text.startsWith("Pedals:")));
}
const layout = layoutFor(normal);
for (const prefix of ["vn1", "vn2", "va", "vc"]) {
  const names = [1, 2, 3, 4].map(
    (i) => layout.staves.find((s) => s.members.some((p) => p.id === `${prefix}-4-${i}`))!.name,
  );
  assert.equal(new Set(names).size, 4, `${prefix}: groups must be individually identifiable`);
}
assert.deepEqual(toMusicXml(piece).warnings, []);
assertKnownAudioWarnings(plan(normal).warnings);

// Explicit spelling survives chords and discrete-gliss paths, including a no-op fold;
// actual transposition still moves the pitch and never mutates the source.
const source: Score = {
  meter: [{ measure: 1, beats: 4, beatType: 4 }],
  parts: [
    {
      id: "h",
      instrument: "harp",
      events: [
        { at: 0, dur: 1, pitch: [{ step: "D", alter: 1, octave: 5 }, "Gb5"] },
        { at: 1, dur: 1, pitch: "D#5", gliss: true, glissPitches: ["D#5", "Gb5"] },
        { at: 2, dur: 1, pitch: "Gb5" },
      ],
    },
  ],
};
const before = JSON.stringify(source);
const ctx = Context.root({
  name: "test",
  path: "",
  values: {},
  children: new Map(),
  score: () => source,
}).with({ ensemble: [{ id: "h", instrument: "harp", name: "Harp" }] });
for (const transpose of [0, 1]) {
  const joiner = new Joiner(ctx);
  joiner.place(sectionOf({ path: "test", result: source }, ctx), {
    at: 0,
    transpose,
    parts: { h: { part: "h", fold: [60, 90] } },
  });
  const events = joiner.score({ title: "test" }).parts[0]!.events as NoteEvent[];
  if (!transpose) {
    assert.deepEqual(
      events.map((e) => e.pitch),
      source.parts[0]!.events.map((e) => (e as NoteEvent).pitch),
    );
    assert.deepEqual(events[1]!.glissPitches, ["D#5", "Gb5"]);
  } else {
    assert.equal(parsePitch(events[1]!.pitch as string).midi, 76);
    assert.deepEqual(
      events[1]!.glissPitches!.map((p) => parsePitch(p).midi),
      [76, 79],
    );
  }
}
assert.equal(JSON.stringify(source), before);

// Rendering keeps absolute pitches above the recorded range and across a >36-semitone glide.
const preview: Score = {
  meter: [{ measure: 1, beats: 4, beatType: 4 }],
  parts: [
    {
      id: "v",
      instrument: "violins-1",
      players: 2,
      events: [
        { at: 0, dur: 1, pitch: { midi: 98.5 } },
        { at: 2, dur: 1, pitch: { midi: 66 }, gliss: true },
        { at: 3, dur: 1, pitch: { midi: 102.5 } },
        { at: 5, dur: 1, pitch: { midi: 80 }, technique: "sul-tasto", gliss: true },
        { at: 6, dur: 1, pitch: { midi: 93 }, gliss: true },
        { at: 7, dur: 1, pitch: { midi: 102.5 } },
      ],
    },
  ],
};
const playback = plan(normalize(preview));
assert.deepEqual(playback.warnings, []);
const lanes = playback.lanes.filter((l) => l.kind === "bbcso");
const high = lanes.find((l) => l.notes.some((n) => n.on === 0))!;
assert.equal(high.notes.find((n) => n.on === 0)!.key + high.tune, 98.5);
const glides = lanes.flatMap((l) => l.notes).filter((n) => n.glide);
const wide = glides.find((n) => n.on === 2)!;
assert.equal(wide.key + wide.glide![0]![1], 66);
assert.equal(wide.key + wide.glide!.at(-1)![1], 102.5);
assert(glides.every((n) => n.glide!.every(([, tune]) => Math.abs(tune) <= 36)));
assert.equal(glides.find((n) => n.on === 5)!.articulation, "Long Sul Tasto");
assert.equal(glides.find((n) => n.on === 6)!.articulation, "Long");
console.log(
  "PASS: ordinary strings, full-height connected ending, preserved spellings, distinct group names, exact preview pitches and articulation changes.",
);

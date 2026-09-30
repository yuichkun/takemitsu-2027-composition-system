// vp node verification/tracks/check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TrackState, type Track } from "../../src/preview/tracks.ts";
import { linkedMuteSolo } from "../../src/preview/mixer-selection.ts";
import { notation } from "../../src/preview/notation-thread.ts";
import { normalize } from "../../src/score/normalize.ts";
import { layoutFor } from "../../src/notation/musicxml.ts";
import { plan } from "../../src/performance/plan.ts";
import type { ChannelState } from "../../src/audio/mixer.ts";

const parts: Track[] = ["a", "b", "c", "d"].map((id, i) => ({
  id,
  name: id,
  instrument: i < 2 ? "harp" : "basses",
  group: i < 2 ? "Harp" : "Double Bass",
  players: 1,
}));
const s = new TrackState();
s.setParts(parts);
s.select("a");
s.select("c", { ctrlKey: true });
assert.deepEqual([...s.selected], ["a", "c"]);
s.select("d", { shiftKey: true });
assert.deepEqual([...s.selected], ["c", "d"]);
s.selectGroup("harp");
assert.deepEqual([...s.selected], ["a", "b"]);
s.onlySelected();
assert.deepEqual(s.hiddenIds(), ["c", "d"]);
s.setVisible("a", false);
assert.deepEqual([...s.selected], ["b"]);
s.setVisible("a", true);
s.select("a", { metaKey: true });
assert.deepEqual(s.targets("a"), ["b", "a"]);
assert.deepEqual(s.targets("c"), []);
s.setParts([...parts, { ...parts[0]!, id: "new" }]);
assert(s.visible("new"));
s.setParts(parts.slice(1));
assert(!s.selected.has("a"));

const channels: Record<string, ChannelState> = Object.fromEntries(
  parts.map((p) => [p.id, { mute: false, solo: false, db: -3, comp: 0.2 }]),
);
channels.a!.mute = true;
const before = JSON.stringify(channels);
let changes = linkedMuteSolo(
  parts.map((p) => p.id),
  ["a", "b"],
  channels.a!,
  "mute",
);
assert.equal(JSON.stringify(channels), before); // Computing a command is pure.
assert.deepEqual(changes, [
  ["a", { mute: false }],
  ["b", { mute: false }],
]);
changes = linkedMuteSolo(
  parts.map((p) => p.id),
  ["a", "b"],
  channels.b!,
  "solo",
  true,
);
assert.deepEqual(changes, [
  ["a", { solo: true }],
  ["b", { solo: true }],
  ["c", { solo: false }],
  ["d", { solo: false }],
]);
assert(changes.every(([, p]) => !("db" in p) && !("comp" in p)));

const text = readFileSync(new URL("../../pieces/antara/antara.json", import.meta.url), "utf8");
const source = JSON.parse(text);
const ids = source.parts.map((p: { id: string }) => p.id) as string[];
const audioBefore = JSON.stringify(plan(normalize(source)));
const full = notation(text);
const harps = notation(
  text,
  ids.filter((id) => id !== "hp1" && id !== "hp2"),
);
assert.deepEqual(harps.view.parts, full.view.parts);
assert.deepEqual(harps.view.measures, full.view.measures);
assert.deepEqual(harps.view.tempo, full.view.tempo);
assert.deepEqual(harps.view.visibleParts, ["hp1", "hp2"]);
assert.equal(harps.strip.staves, 4);
assert.equal(harps.strip.measures.length, full.strip.measures.length);
const single = notation(
  text,
  ids.filter((id) => id !== "hp2"),
);
assert.equal(single.strip.staves, 2);
assert(single.strip.measures[0]!.musicxml.includes("Harp 2"));
const cb = notation(
  text,
  ids.filter((id) => id !== "cb-4-2"),
);
const original = layoutFor(normalize(source)).staves.find((p) =>
  p.members.some((m) => m.id === "cb-4-2"),
)!;
assert(cb.strip.measures[0]!.musicxml.includes(original.name));
const none = notation(text, ids);
assert.equal(none.strip.staves, 0);
assert.equal(none.strip.measures.length, 0);
assert.equal(none.view.parts.length, ids.length);
assert.equal(none.view.measures.length, full.view.measures.length);
assert.equal(JSON.stringify(plan(normalize(source))), audioBefore);
assert.equal(
  readFileSync(new URL("../../pieces/antara/antara.json", import.meta.url), "utf8"),
  text,
);
const panel = readFileSync(new URL("../../src/preview/tracks.ts", import.meta.url), "utf8");
assert(!panel.includes('data-action="mute"') && !panel.includes('data-action="solo"'));
console.log(
  "PASS: range/group selection, visibility independent of M/S, hidden selection safety, touched-state linking, faders/Comp untouched, complete audio catalog/timeline, single/multiple/no staves, full-score player names retained, source/audio unchanged, no M/S in sidebar.",
);

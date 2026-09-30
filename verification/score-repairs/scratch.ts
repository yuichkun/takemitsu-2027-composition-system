// vp node verification/score-repairs/scratch.ts
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Engine } from "../../src/performance/engine.ts";
import { storeRoot } from "../../src/performance/store.ts";
const root = join(storeRoot, "scratch");
mkdirSync(root, { recursive: true });
const before = new Set(readdirSync(root));
const a = new Engine({ processes: 0 });
const dir = readdirSync(root).find((x) => !before.has(x))!;
const sentinel = join(root, dir, "in-flight.tkch");
writeFileSync(sentinel, "in flight");
const b = new Engine({ processes: 0 });
assert.equal(readFileSync(sentinel, "utf8"), "in flight");
a.stop();
b.stop();
rmSync(sentinel);
console.log("PASS: a second engine cannot erase the first engine’s in-flight files.");

await assert.rejects(a.open("stopped", {} as never), /stopped engine/);
console.log("PASS: a stopped engine cannot start loading a score again.");

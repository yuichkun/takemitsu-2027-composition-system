// vp node verification/ratchet/check.ts
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalize } from "../../src/score/normalize.ts";
import { toMusicXml } from "../../src/notation/musicxml.ts";
import { plan, type SampleLane } from "../../src/performance/plan.ts";
import { chunkLanes, type SampleChunk } from "../../src/performance/chunks.ts";
import { Engine } from "../../src/performance/engine.ts";
import { encodeWav16 } from "../../src/audio/wav.ts";
import { decodeChunk } from "../../src/performance/store.ts";
import { assertKnownAudioWarnings } from "../known-audio.ts";
const raw = JSON.parse(
  readFileSync(new URL("../../pieces/antara/antara.json", import.meta.url), "utf8"),
);
const s = normalize(raw);
const ratchet = s.parts.find((p) => p.id === "ratch")!;
const cut = s.parts.find((p) => p.id === "vslap")!.notes[0]!.at;
assert.equal(ratchet.notes.length, 1);
const r = ratchet.notes[0]!;
assert(r.end.eq(cut));
assert(cut.sub(r.at).value >= 8 && cut.sub(r.at).value <= 16);
assert.equal(ratchet.player, "p2");
assert.equal(s.parts.find((p) => p.id === "vslap")!.player, "p3");
assert(
  s.parts
    .find((p) => p.id === "timp")!
    .notes.some((n) => n.at.eq(r.at) && !n.technique.includes("roll")),
);
assert(
  s.parts
    .find((p) => p.id === "vib")!
    .notes.filter((n) => n.at.gte(r.at))
    .every((n) => n.at.gte(cut)),
);
assert.deepEqual(toMusicXml(raw).warnings, []);
assertKnownAudioWarnings(plan(s).warnings);
console.log(
  `PASS: ratchet starts on a bell at beat ${r.at.value}, stops at vibraslap ${cut.value}, uses percussion 2.`,
);

// Only a temporary test waveform: never installed as the ratchet's sound.
const dir = mkdtempSync(join(tmpdir(), "ratchet-test-"));
const file = join(dir, "test.wav");
const engine = new Engine({ processes: 0 });
try {
  writeFileSync(
    file,
    encodeWav16({ sampleRate: 48000, channels: [new Float32Array(4800).fill(0.25)] }),
  );
  const make = (sustainSeconds?: number) => {
    const lane: SampleLane = {
      kind: "samples",
      id: "test",
      partId: "test",
      files: [file],
      gain: 1,
      hits: [
        {
          seconds: 0,
          gain: 1,
          seed: 0,
          measure: 0,
          ...(sustainSeconds !== undefined ? { sustainSeconds } : {}),
        },
      ],
    };
    return chunkLanes([lane])[0]!.chunks[0] as SampleChunk;
  };
  const mix = (c: SampleChunk) =>
    (engine as unknown as { mixSamples(c: SampleChunk): Promise<Uint8Array> }).mixSamples(c);
  const held = decodeChunk(await mix(make(1)));
  assert.equal(held.frames, 48000);
  assert(held.samples[40000] !== 0, "short sample must loop through the held duration");
  assert.equal(held.samples.at(-1), 0);
  assert.equal(
    decodeChunk(await mix(make(0.025))).frames,
    1200,
    "long sample stops at written end",
  );
  assert.equal(
    decodeChunk(await mix(make())).frames,
    4800,
    "ordinary one-shot retains natural length",
  );
  assert.notEqual(make(1).key, make(0.025).key);
  console.log(
    "PASS: sustained samples loop and stop at the exact written end; one-shot playback unchanged.",
  );
} finally {
  engine.stop();
  rmSync(dir, { recursive: true, force: true });
}

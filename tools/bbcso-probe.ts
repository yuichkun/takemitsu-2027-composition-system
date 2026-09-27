// Experiments against the installed BBC Symphony Orchestra. Results go to .local/probe/.
//
//   vp node tools/bbcso-probe.ts pitch            pitch bend and global tune accuracy
//   vp node tools/bbcso-probe.ts stream           offline render speed vs real time (streaming dropouts)
//   vp node tools/bbcso-probe.ts scan <instrument> [articulation…]
//                                                 which keys sound, their level and pitch (all articulations by default)

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { measurePitch, peak, rms, toDb } from "../src/audio/analysis.ts";
import { mono, readWav } from "../src/audio/wav.ts";
import { encodeState, stateXml, type StateSpec } from "../src/libraries/bbcso/state.ts";
import {
  installedPatches,
  patchesOf,
  pluginPath,
  pluginSettings,
} from "../src/libraries/bbcso/patches.ts";
import { render, repoRoot, type MidiEvent, type TrackJob } from "../src/render/host.ts";

const out = join(repoRoot, ".local/probe");
const rate = 48000;
const sec = (s: number) => Math.round(s * rate);

async function writeState(name: string, spec: StateSpec): Promise<string> {
  const file = join(out, "states", `${name}.bin`);
  await mkdir(join(out, "states"), { recursive: true });
  await writeFile(file, encodeState(stateXml(spec)));
  return file;
}

function singleArticulation(instrument: string, articulation: string, tune = 0): StateSpec {
  const patch = patchesOf(instrument).find((p) => p.articulation === articulation);
  if (!patch) throw new Error(`No patch ${instrument} / ${articulation}`);
  return {
    ...pluginSettings[instrument],
    family: "",
    name: instrument,
    articulations: [{ patch: patch.name, keyswitch: 0 }],
    tune,
  };
}

const note = (frame: number, key: number, velocity: number, length: number): MidiEvent[] => [
  { frame, bytes: [0x90, key, velocity] },
  { frame: frame + length, bytes: [0x80, key, 0] },
];
const cc = (frame: number, controller: number, value: number): MidiEvent => ({
  frame,
  bytes: [0xb0, controller, value],
});
const bend = (frame: number, value14: number): MidiEvent => ({
  frame,
  bytes: [0xe0, value14 & 0x7f, value14 >> 7],
});

async function track(id: string, state: string, events: MidiEvent[]): Promise<TrackJob> {
  return { id, plugin: pluginPath, state, events, output: join(out, `${id}.wav`) };
}

async function pitch() {
  const plain = await writeState("vn1-long", singleArticulation("Violins 1", "Long"));
  const tuned = await writeState("vn1-long-tune50", singleArticulation("Violins 1", "Long", 0.5));
  const events = (extra: MidiEvent[]) => [
    cc(0, 1, 90),
    cc(0, 11, 110),
    ...extra,
    ...note(sec(0.5), 69, 100, sec(4)),
  ];
  const tracks = [
    await track("pitch-plain", plain, events([])),
    await track("pitch-bend-plus2048", plain, events([bend(0, 8192 + 2048)])),
    await track("pitch-bend-plus8191", plain, events([bend(0, 16383)])),
    await track("pitch-tune50", tuned, events([])),
  ];
  const results = await render(
    { sampleRate: rate, blockSize: 512, frames: sec(6), loadWaitMs: 15000, tracks },
    join(out, "jobs/pitch.json"),
  );
  for (const r of results) {
    const samples = mono(await readWav(r.file));
    const measured = measurePitch(samples, sec(2), 69);
    console.log(
      r.id,
      "peak",
      toDb(r.peak).toFixed(1),
      "dB  pitch",
      measured?.toFixed(3),
      `(${(((measured ?? 69) - 69) * 100).toFixed(1)} cents)`,
    );
  }
}

async function stream() {
  const state = await writeState("vn1-long", singleArticulation("Violins 1", "Long"));
  const events = [
    cc(0, 1, 90),
    cc(0, 11, 110),
    ...note(sec(0.2), 62, 100, sec(10)),
    ...note(sec(0.2), 69, 100, sec(10)),
  ];
  const results = [];
  for (const [id, maxSpeed] of [
    ["stream-fast", 0],
    ["stream-realtime", 1],
  ] as const) {
    const started = Date.now();
    const [r] = await render(
      {
        sampleRate: rate,
        blockSize: 512,
        frames: sec(12),
        loadWaitMs: 15000,
        maxSpeed,
        tracks: [await track(id, state, events)],
      },
      join(out, `jobs/${id}.json`),
    );
    results.push({ id, file: r!.file, wall: (Date.now() - started) / 1000 });
  }
  const envelopes = await Promise.all(
    results.map(async (r) => {
      const s = mono(await readWav(r.file));
      return Array.from({ length: 24 }, (_, i) => toDb(rms(s, sec(i * 0.5), sec((i + 1) * 0.5))));
    }),
  );
  for (const [i, r] of results.entries())
    console.log(r.id, `wall ${r.wall}s`, envelopes[i]!.map((d) => d.toFixed(0)).join(" "));
  const maxDiff = Math.max(
    ...envelopes[0]!.map((d, i) => Math.abs(d - envelopes[1]![i]!)).filter(Number.isFinite),
  );
  console.log("max envelope difference (dB):", maxDiff.toFixed(2));
}

export interface ScanOptions {
  keys: [number, number];
  spacing: number;
  length: number;
  velocity: number;
}

/** Plays every key of each articulation of `instrument` (one plugin instance per articulation). */
async function scan(instrument: string, articulations: string[], o: ScanOptions, dir = out) {
  if (articulations.length === 0) articulations = patchesOf(instrument).map((p) => p.articulation);
  const keys = Array.from({ length: o.keys[1] - o.keys[0] + 1 }, (_, i) => i + o.keys[0]);
  const events: MidiEvent[] = [cc(0, 1, 100), cc(0, 11, 127)];
  const onset = (i: number) => sec(1 + i * o.spacing);
  keys.forEach((k, i) => events.push(...note(onset(i), k, o.velocity, sec(o.length))));
  const slug = (a: string) => `scan-${instrument}-${a}`.replace(/\W+/g, "_");
  const tracks = await Promise.all(
    articulations.map(async (a) =>
      track(slug(a), await writeState(slug(a), singleArticulation(instrument, a)), events),
    ),
  );
  const results = await render(
    {
      sampleRate: rate,
      blockSize: 512,
      frames: sec(2 + keys.length * o.spacing),
      loadWaitMs: 25000,
      tracks,
    },
    join(out, `jobs/scan-${instrument}.json`.replace(/\s+/g, "_")),
  );
  const report: Record<string, unknown> = {};
  for (const [i, r] of results.entries()) {
    const s = mono(await readWav(r.file));
    const rows = keys.map((k, j) => {
      const t = onset(j);
      // Onset: peak in the first 250 ms against the level just before (so a ringing previous note does not count).
      const before = rms(s, t - sec(0.05), t);
      const attack = peak(s, t, t + sec(0.25));
      const sustain = rms(s, t + sec(o.length * 0.5), t + sec(o.length * 0.9));
      const sounding = attack > 1e-3 && attack > before * 4;
      const measured = sounding ? measurePitch(s, t + sec(0.1), k, rate, 32768) : undefined;
      return {
        key: k,
        attackDb: Number(toDb(attack).toFixed(1)),
        sustainDb: Number(toDb(sustain).toFixed(1)),
        sounding,
        pitch: measured === undefined ? null : Number(measured.toFixed(2)),
      };
    });
    const sounding = rows.filter((row) => row.sounding);
    console.log(
      `${instrument} / ${articulations[i]}: ${sounding.length} keys` +
        (sounding.length ? ` (${sounding[0]!.key}–${sounding.at(-1)!.key})` : ""),
    );
    console.log(
      "  " +
        sounding
          .map(
            (row) =>
              `${row.key}:${row.attackDb}/${row.sustainDb}${row.pitch === null ? "" : `@${row.pitch}`}`,
          )
          .join(" "),
    );
    report[articulations[i]!] = rows;
  }
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `${instrument}.json`.replace(/\s+/g, "_")),
    JSON.stringify(report, null, 2),
  );
}

/** Re-plays keys that the scan reported silent inside an articulation's range, one at a time with long gaps. */
async function verifyGaps() {
  const inventory = JSON.parse(
    await readFile(join(repoRoot, "src/libraries/bbcso/inventory.json"), "utf8"),
  ) as Record<string, Record<string, { gaps: number[] } | null>>;
  const jobs: { instrument: string; articulation: string; keys: number[] }[] = [];
  for (const [instrument, arts] of Object.entries(inventory)) {
    if (instrument === "Untuned Percussion") continue;
    for (const [articulation, inv] of Object.entries(arts))
      if (inv?.gaps.length) jobs.push({ instrument, articulation, keys: inv.gaps });
  }
  const spacing = 4;
  const results: Record<
    string,
    Record<string, { key: number; attackDb: number; sustainDb: number }[]>
  > = {};
  for (let i = 0; i < jobs.length; i += 16) {
    const batch = jobs.slice(i, i + 16);
    const tracks = await Promise.all(
      batch.map(async (j) => {
        const id = `gap-${j.instrument}-${j.articulation}`.replace(/\W+/g, "_");
        const events: MidiEvent[] = [cc(0, 1, 100), cc(0, 11, 127)];
        j.keys.forEach((k, n) => events.push(...note(sec(1 + n * spacing), k, 100, sec(2))));
        return track(
          id,
          await writeState(id, singleArticulation(j.instrument, j.articulation)),
          events,
        );
      }),
    );
    const longest = Math.max(...batch.map((j) => j.keys.length));
    const rendered = await render(
      {
        sampleRate: rate,
        blockSize: 512,
        frames: sec(2 + longest * spacing),
        loadWaitMs: 25000,
        tracks,
      },
      join(out, `jobs/gaps-${i}.json`),
    );
    for (const [n, r] of rendered.entries()) {
      const j = batch[n]!;
      const s = mono(await readWav(r.file));
      const rows = j.keys.map((k, m) => {
        const t = sec(1 + m * spacing);
        return {
          key: k,
          attackDb: Number(toDb(peak(s, t, t + sec(0.5))).toFixed(1)),
          sustainDb: Number(toDb(rms(s, t + sec(1), t + sec(1.8))).toFixed(1)),
        };
      });
      (results[j.instrument] ??= {})[j.articulation] = rows;
      const silent = rows.filter((row) => row.attackDb < -60);
      console.log(
        `${j.instrument} / ${j.articulation}: ${rows.length - silent.length}/${rows.length} sound` +
          (silent.length ? `; silent ${silent.map((row) => row.key).join(" ")}` : ""),
      );
      await rm(r.file);
    }
  }
  await writeFile(join(out, "gaps.json"), JSON.stringify(results, null, 2));
}

function option(args: string[], name: string, fallback: string): string {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1]! : fallback;
}

const [command, ...rest] = process.argv.slice(2);
if (command === "pitch") await pitch();
else if (command === "stream") await stream();
else if (command === "scan") {
  const [lo, hi] = option(rest, "--keys", "12-127").split("-").map(Number);
  const o: ScanOptions = {
    keys: [lo!, hi!],
    spacing: Number(option(rest, "--spacing", "1.2")),
    length: Number(option(rest, "--length", "0.8")),
    velocity: Number(option(rest, "--velocity", "100")),
  };
  await scan(rest[0]!, rest.slice(1), o);
} else if (command === "scan-all") {
  const instruments = [...new Set(installedPatches().map((p) => p.instrument))];
  for (const instrument of instruments) {
    await scan(
      instrument,
      [],
      { keys: [12, 127], spacing: 1.2, length: 0.8, velocity: 100 },
      join(out, "scans"),
    );
  }
} else if (command === "verify-gaps") await verifyGaps();
else
  console.log(
    "pitch | stream | scan <instrument> [articulation…] [--keys 12-127] [--spacing s] [--length s] [--velocity v]",
  );

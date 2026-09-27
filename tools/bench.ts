// Measures how long it takes from a saved score to playable audio, for editing scenarios.
//
//   vp node tools/bench.ts <score.json> [--store <dir>] [--only <label>] [--shift <n>] [--out <file.json>]
//
// --store reuses a chunk store (default: a new empty one, so the first open is really cold).
// --shift is added to every edit's amount, so a run on a used store changes the music anew.
//
// Each edit starts from the original score with the playhead at the edited place. Times count from
// the save (planning included) to when chunks are stored; the browser's fetching comes on top.
//   start   playback from the playhead can start and play the next 10 s without waiting, by the
//           player's rules (docs/decisions/0019): the next 3 s complete before it starts, each 2 s
//           segment complete before it plays, and a chunk not rendered yet counts as sounding up
//           to its notes plus the longest tail
//   window  everything that sounds from 10 s before to 10 s after the playhead is rendered
//   near    every chunk whose origin is 30 s before to 10 s after the playhead (the measure used
//           before, for comparison)
//   all     the whole piece

import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import type { DynamicPoint, NoteEvent, Part, Score, Time } from "../src/score/types.ts";

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const valued = new Set(["--store", "--out", "--only", "--shift"]);
const shift = Number(option("--shift") ?? 0);
const only = option("--only");
const scorePath = args.find((a, i) => !a.startsWith("--") && !valued.has(args[i - 1] ?? ""));
if (!scorePath) throw new Error("usage: tools/bench.ts <score.json> [--store dir] [--only label]");
process.env.TAKEMITSU_CHUNKS_DIR =
  option("--store") ?? mkdtempSync(join(tmpdir(), "takemitsu-bench-"));

const { Engine } = await import("../src/performance/engine.ts");
const { normalize } = await import("../src/score/normalize.ts");
const { repoRoot } = await import("../src/render/host.ts");
const { secondsAt } = await import("../src/score/timeline.ts");

const name = basename(scorePath).replace(/\.json$/, "");
const outFile = option("--out") ?? join(repoRoot, ".local/bench", `${name}-${Date.now()}.json`);

const original = JSON.parse(readFileSync(scorePath, "utf8")) as Score;
const engine = new Engine();
const path = scorePath;
const sampleRate = 48000;

interface Result {
  scenario: string;
  /** Planning and chunking. */
  plan: number;
  start: number;
  window: number;
  near: number;
  all: number;
  rendered: number;
  failed: number;
  places: number;
  loads: number;
  hostMB: number;
}
const results: Result[] = [];
let loads = 0;
engine.loaded = () => loads++;
/** When each chunk was stored or given up, in seconds since the save. */
let doneAt = new Map<string, number>();
let started = 0;
engine.onChunk = (key) => doneAt.set(key, (performance.now() - started) / 1000);

async function measure(scenario: string, score: Score, playhead = 0): Promise<void> {
  started = performance.now();
  doneAt = new Map();
  loads = 0;
  let hostMB = 0;
  const memory = setInterval(() => (hostMB = Math.max(hostMB, engine.memoryMB())), 250);
  const manifest = await engine.open(path, normalize(score), playhead);
  const plan = (performance.now() - started) / 1000;
  const before = engine.status(path);
  await engine.whenDone(path);
  clearInterval(memory);
  const status = engine.status(path);

  // When each place was ready: at planning if it was stored already.
  const at = manifest.chunks.map(([key], i) => (before.frames[i] !== -1 ? plan : doneAt.get(key)!));
  const p = playhead;
  const segment = 2;
  const need = new Map<number, number>();
  manifest.chunks.forEach(([, , origin, , noteFrames, tailMax], i) => {
    const end = origin + (noteFrames + tailMax) / sampleRate;
    const first = Math.max(Math.floor(origin / segment), Math.floor(p / segment));
    const last = Math.min(Math.floor(end / segment), Math.floor((p + 10) / segment));
    for (let k = first; k <= last; k++) need.set(k, Math.max(need.get(k) ?? plan, at[i]!));
  });
  let start = plan;
  for (const [k, complete] of need) {
    // Within the first 3 s it must be complete before starting; later, before it plays.
    const lead = k * segment < p + 3 ? 0 : k * segment - p;
    start = Math.max(start, complete - lead);
  }
  let window = plan;
  let near = plan;
  manifest.chunks.forEach(([, , origin, , noteFrames], i) => {
    const frames = status.frames[i]! >= 0 ? status.frames[i]! : noteFrames;
    if (origin < p + 10 && origin + frames / sampleRate > p - 10) window = Math.max(window, at[i]!);
    if (origin < p + 10 && origin > p - 30) near = Math.max(near, at[i]!);
  });
  const all = Math.max(plan, ...at);
  const r: Result = {
    scenario,
    plan,
    start,
    window,
    near,
    all,
    rendered: doneAt.size,
    failed: status.failed,
    places: manifest.chunks.length,
    loads,
    hostMB: Math.round(hostMB),
  };
  results.push(r);
  const s = (x: number) => `${x.toFixed(2).padStart(7)} s`;
  console.log(
    `${scenario.padEnd(32)} plan ${r.plan.toFixed(2)} s  start ${s(r.start)}  window ${s(r.window)}  near ${s(r.near)}  all ${s(r.all)}  ` +
      `rendered ${r.rendered}${r.failed ? ` (failed ${r.failed})` : ""}  loads ${loads}  host ${r.hostMB} MB`,
  );
}

//==============================================================================
// Edits

const q = (t: Time) => (Array.isArray(t) ? t[0] / t[1] : t);
const clone = () => structuredClone(original);
const notesOf = (p: Part) => p.events.filter((e): e is NoteEvent => "dur" in e);
const busiest = (s: Score) =>
  [...s.parts].sort((a, b) => notesOf(b).length - notesOf(a).length)[0]!;

// Measure starts in quarters and seconds, from the normalised original.
const normal = normalize(original);
const middle = Math.floor(normal.measures.length / 2);
const at = normal.measures[middle]!;
const atQ = at.start.value;
const atS = secondsAt(normal.tempo, atQ);
const spanQ = normal.measures.slice(middle, middle + 4).reduce((n, m) => n + m.length.value, 0);

function editOneNote(s: Score, by = 1): void {
  const part = busiest(s);
  const note = notesOf(part).find((n) => q(n.at) >= atQ)!;
  const p = note.pitch;
  if (p && typeof p === "object" && "midi" in p) p.midi += by;
  else note.articulations = [by === 1 ? "accent" : "tenuto"];
}

function editDynamics(s: Score, by = 1): void {
  const part = busiest(s);
  const dyn = (part.dynamics ?? []).filter((d) => q(d.at) < atQ || q(d.at) > atQ + spanQ);
  dyn.push({ at: atQ, level: by, to: "linear" }, {
    at: atQ + spanQ,
    level: 8 - by,
  } as DynamicPoint);
  part.dynamics = dyn.sort((a, b) => q(a.at) - q(b.at));
}

function editTutti(s: Score, by = 1): void {
  for (const part of s.parts)
    for (const n of notesOf(part)) {
      if (q(n.at) < atQ || q(n.at) >= atQ + spanQ) continue;
      const p = n.pitch;
      if (Array.isArray(p))
        n.pitch = p.map((x) => (typeof x === "object" && "midi" in x ? { midi: x.midi + by } : x));
      else if (p && typeof p === "object" && "midi" in p) p.midi += by;
      else n.articulations = ["accent"];
    }
}

function insertMeasure(s: Score, _by = 1): void {
  // Exact fractions: a float here would move every later note by a rounding error.
  const len = at.length;
  const shiftTime = (t: Time): Time => {
    if (q(t) < atQ) return t;
    const [n, d] = Array.isArray(t) ? t : [t, 1];
    return [n * len.d + len.n * d, d * len.d];
  };
  for (const part of s.parts) {
    for (const e of part.events) e.at = shiftTime(e.at);
    for (const d of part.dynamics ?? []) d.at = shiftTime(d.at);
  }
  for (const t of s.tempo ?? []) t.at = shiftTime(t.at);
  for (const m of s.meter) if (m.measure > at.number) m.measure++;
  for (const r of s.rehearsal ?? []) if (r.measure > at.number) r.measure++;
  if (s.measures) s.measures++;
}

function changeTempo(s: Score, by = 1): void {
  const tempo = s.tempo ?? [];
  const before = [...tempo].filter((t) => q(t.at) <= atQ).at(-1);
  if (before && q(before.at) < atQ) tempo.push({ at: atQ, bpm: before.bpm });
  for (const t of tempo) if (q(t.at) >= atQ) t.bpm = Math.round(t.bpm * (1 + 0.1 * by));
  s.tempo = tempo.sort((a, b) => q(a.at) - q(b.at));
}

console.log(
  `${name}: ${normal.parts.length} parts, ${normal.measures.length} measures; edits at measure ${at.number} (${atS.toFixed(0)} s)`,
);
await measure("open (as stored)", clone());
await measure("open again, unchanged", clone());
for (const [label, edit] of [
  ["one note", editOneNote],
  ["dynamics of one part (4 bars)", editDynamics],
  ["tutti, 4 bars", editTutti],
  ["insert a measure", insertMeasure],
  ["tempo from here on +10%", changeTempo],
] as const) {
  if (only && !label.includes(only)) continue;
  const s = clone();
  edit(s, 1 + shift);
  await measure(label, s, atS);
  // The same kind of edit again, as while working on a passage.
  if (edit === insertMeasure) continue;
  const again = clone();
  edit(again, 2 + shift);
  await measure(`  ${label}, again`, again, atS);
}
engine.stop();

const disk = execSync(`du -sk "${process.env.TAKEMITSU_CHUNKS_DIR}"`).toString().split("\t")[0];
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(
  outFile,
  JSON.stringify(
    {
      score: scorePath,
      when: new Date().toISOString(),
      storeMB: Math.round(Number(disk) / 1024),
      results,
    },
    null,
    2,
  ),
);
console.log(`store ${Math.round(Number(disk) / 1024)} MB\nwritten ${outFile}`);
process.exit(0);

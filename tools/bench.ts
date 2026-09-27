// Measures how long it takes from a saved score to playable audio, for editing scenarios.
//
//   vp node tools/bench.ts <score.json> [--store <dir>] [--no-resident] [--out <file.json>]
//
// --store reuses a chunk store (default: a new empty one, so "cold" is really cold).
// --no-resident stops the host processes whenever there is no work (every edit loads again).
//
// Each edit starts from the original score with the playhead at the edited place. "near" is the
// time until everything sounding in the 10 s from there is rendered (what you wait for before
// pressing play); "all" until the whole piece is.

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
/** Added to every edit's amount, so a run on a used store still changes the music anew. */
const shift = Number(option("--shift") ?? 0);
/** Only the edits whose label contains this. */
const only = option("--only");
const scorePath = args.find((a, i) => !a.startsWith("--") && !valued.has(args[i - 1] ?? ""));
if (!scorePath) throw new Error("usage: tools/bench.ts <score.json> [--store dir] [--no-resident]");
const resident = !args.includes("--no-resident");
process.env.TAKEMITSU_CHUNKS_DIR =
  option("--store") ?? mkdtempSync(join(tmpdir(), "takemitsu-bench-"));
process.env.TAKEMITSU_RESIDENT = resident ? "1" : "0";

const { Engine } = await import("../src/performance/engine.ts");
const { normalize } = await import("../src/score/normalize.ts");
const { repoRoot } = await import("../src/render/host.ts");
const { HostPool } = await import("../src/render/pool.ts");

const name = basename(scorePath).replace(/\.json$/, "");
const outFile =
  option("--out") ??
  join(repoRoot, ".local/bench", `${name}-${resident ? "resident" : "oneshot"}-${Date.now()}.json`);

const original = JSON.parse(readFileSync(scorePath, "utf8")) as Score;
const engine = new Engine(new HostPool({ resident }));
const path = scorePath;

interface Result {
  scenario: string;
  /** Planning and chunking. */
  openSeconds: number;
  nearSeconds: number;
  allSeconds: number;
  chunks: number;
  rendered: number;
  hostMB: number;
  /** This process (planning, the queue). */
  nodeMB: number;
  loads: number;
}
const results: Result[] = [];
let loads = 0;
engine.loaded = () => loads++;

async function measure(scenario: string, score: Score, playhead = 0): Promise<void> {
  const started = performance.now();
  loads = 0;
  let hostMB = 0;
  let nodeMB = 0;
  const memory = setInterval(() => {
    nodeMB = Math.max(nodeMB, process.memoryUsage().rss / 1e6);
    void engine.pool.memory().then((mb) => (hostMB = Math.max(hostMB, mb)));
  }, 500);
  const manifest = await engine.open(path, normalize(score), playhead);
  const missing = manifest.chunks.filter((c) => c[4] < 0).length;
  const openSeconds = (performance.now() - started) / 1000;
  const soon = new Set(
    manifest.chunks.filter((c) => c[2] < playhead + 10 && c[2] > playhead - 30).map((c) => c[0]),
  );
  let nearSeconds = 0;
  for (;;) {
    const p = engine.progress(path);
    if (!nearSeconds && [...soon].every((k) => engine.framesOf(k) !== undefined))
      nearSeconds = (performance.now() - started) / 1000;
    if (p.done + p.failed >= p.total && nearSeconds) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  clearInterval(memory);
  const allSeconds = (performance.now() - started) / 1000;
  const r: Result = {
    scenario,
    openSeconds,
    nearSeconds,
    allSeconds,
    chunks: manifest.chunks.length,
    rendered: missing,
    hostMB: Math.round(hostMB),
    nodeMB: Math.round(nodeMB),
    loads,
  };
  results.push(r);
  console.log(
    `${scenario.padEnd(34)} plan ${openSeconds.toFixed(2)} s  near ${nearSeconds.toFixed(2).padStart(6)} s  all ${allSeconds.toFixed(2).padStart(7)} s  ` +
      `chunks ${r.rendered}/${r.chunks}  loads ${loads}  host ${r.hostMB} MB  node ${r.nodeMB} MB`,
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
const { secondsAt } = await import("../src/score/timeline.ts");
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
  const shift = (t: Time): Time => {
    if (q(t) < atQ) return t;
    const [n, d] = Array.isArray(t) ? t : [t, 1];
    return [n * len.d + len.n * d, d * len.d];
  };
  for (const part of s.parts) {
    for (const e of part.events) e.at = shift(e.at);
    for (const d of part.dynamics ?? []) d.at = shift(d.at);
  }
  for (const t of s.tempo ?? []) t.at = shift(t.at);
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
  `${name}: ${normal.parts.length} parts, ${normal.measures.length} measures; edits at measure ${at.number} (${atS.toFixed(0)} s); ${resident ? "resident" : "one-shot"} hosts`,
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
  // The same kind of edit again, as while working on a passage: instances are loaded now.
  if (edit === insertMeasure) continue;
  const again = clone();
  edit(again, 2 + shift);
  await measure(`  ${label}, again`, again, atS);
}
engine.pool.stop();

const disk = execSync(`du -sk "${process.env.TAKEMITSU_CHUNKS_DIR}"`).toString().split("\t")[0];
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(
  outFile,
  JSON.stringify(
    {
      score: scorePath,
      resident,
      when: new Date().toISOString(),
      storeMB: Math.round(Number(disk) / 1024),
      results,
    },
    null,
    2,
  ),
);
console.log(`store ${Math.round(Number(disk) / 1024)} MB\nwritten ${outFile}`);

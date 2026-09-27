// The preview's dev-server side (docs/decisions/0016, 0019): lists and watches score JSON files,
// keeps their chunks rendered in the background, turns them into notation, and serves both.
//
// Score folders: examples/, scores/, sketches/ and pieces/ in the repository, plus any in
// PREVIEW_SCORE_DIRS (colon-separated), so a composition layer can write its output anywhere.
// A piece (src/sketch/nest.ts) is listed as its tree of sketches, each opening the piece's score
// with its own knobs.
//
// A score is read when the page first asks for it, and again after every save. Its audio is
// planned here (src/performance/engine.ts) while its notation is made in a worker thread
// (notation-thread.ts). A save that comes while the score is being read is not lost: the file is
// read again until it has not changed.
//
// The page is only told that something is newer, and then fetches the whole of it:
// - "status": a new version, or chunks rendered → /api/manifest (a version's chunk places) and
//   /api/status (which of them are rendered)
// - "score": new notation → /api/score (measures, times, names)
// - "notation": measures drawn (engraver.ts) → /api/notation (where each drawing is)
// - "list": score files came or went → /api/scores
// - "sketch": a sketch's knobs may have changed (sketch.ts saved) → /api/sketch
// The open score can be downloaded as MusicXML for Sibelius (/api/musicxml; docs/decisions/0003),
// and as audio mixed the way the page's mixer plays it (/api/wav).
// Audio is fetched shortly before it plays, mixed from the chunks in 2 s segments (/api/segments).
// Drawings are fetched by key (/api/engraving/<key>.svg and .json); a key's content never changes.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, watch, type FSWatcher } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Worker } from "node:worker_threads";

import type { MixerSettings } from "../audio/mixer.ts";
import { toMusicXml } from "../notation/musicxml.ts";
import { Engine } from "../performance/engine.ts";
import { mixAsHeard } from "../performance/render.ts";
import { segmentBundle, type SegmentRequest } from "../performance/segments.ts";
import { repoRoot } from "../render/host.ts";
import { normalize } from "../score/normalize.ts";
import type { Score } from "../score/types.ts";
import { childNodes, rootOf, scoreFileOf, sketchFile } from "../sketch/run.ts";
import { Engraver, type StripDocs } from "./engraver.ts";
import {
  changeSketch,
  nodeIn,
  rerun,
  sketchOf,
  sketchState,
  type SketchChange,
} from "./sketches.ts";
import type { NotationAnswer, NotationView } from "./notation-thread.ts";

type Next = (err?: unknown) => void;

export function scoreDirs(): string[] {
  const extra = (process.env.PREVIEW_SCORE_DIRS ?? "").split(":").filter(Boolean);
  return [
    join(repoRoot, "examples"),
    join(repoRoot, "scores"),
    join(repoRoot, "sketches"),
    join(repoRoot, "pieces"),
    ...extra.map((d) => resolve(d)),
  ];
}

interface ScoreEntry {
  path: string;
  name: string;
  /** The score folder it is in (relative to the repository when inside it). */
  root: string;
  /** Its folder inside the score folder ("" at the top); folders nest. */
  dir: string;
  /** In a piece: the node's folder (the piece's own for the piece), and how deep it is. */
  node?: string;
  depth?: number;
}

function listScores(): ScoreEntry[] {
  const out: ScoreEntry[] = [];
  for (const top of scoreDirs()) {
    if (!existsSync(top)) continue;
    const root = relative(repoRoot, top) || top;
    const walk = (dir: string): void => {
      const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      for (const e of entries) {
        if (e.name.startsWith(".") || e.name === "node_modules") continue;
        const path = join(dir, e.name);
        if (e.isDirectory() && existsSync(sketchFile(path)) && childNodes(path).length)
          piece(path, relative(top, dir));
        else if (e.isDirectory()) walk(path);
        else if (e.name.endsWith(".json") && e.name !== "values.json")
          out.push({ path, name: e.name.replace(/\.json$/, ""), root, dir: relative(top, dir) });
      }
    };
    // A piece: its nodes in the order they come in the piece (by name before its first score),
    // each opening the piece's score (written first if it is not yet).
    const piece = (dir: string, inside: string): void => {
      const score = scoreFileOf(dir);
      // Where each node starts, and the order its parent placed it in.
      const starts = new Map<string, [number, number]>();
      if (!existsSync(score)) void rerun(dir);
      else
        try {
          const outline = (JSON.parse(readFileSync(score, "utf8")) as Score).outline;
          outline?.nodes.forEach((n, i) => starts.set(join(dir, n.node), [n.at, i]));
        } catch {
          // Being written: by name for now.
        }
      const tree = (node: string, depth: number): void => {
        out.push({ path: score, name: basename(node), root, dir: inside, node, depth });
        const children = childNodes(node).map((c) => join(node, c));
        const key = (n: string) => starts.get(n) ?? [Infinity, Infinity];
        children.sort((a, b) => key(a)[0] - key(b)[0] || key(a)[1] - key(b)[1]);
        for (const c of children) tree(c, depth + 1);
      };
      tree(dir, 0);
    };
    walk(top);
  }
  return out;
}

/** Only files inside a score folder may be read. */
function allowed(path: string): boolean {
  const abs = resolve(path);
  return (
    abs.endsWith(".json") &&
    scoreDirs().some((d) => !relative(d, abs).startsWith("..") && !isAbsolute(relative(d, abs)))
  );
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

//==============================================================================
// Events to the browser (server-sent events)

const clients = new Set<ServerResponse>();
function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) c.write(payload);
}

//==============================================================================
// Open scores

// Made when the dev server starts (previewMiddleware): importing this module (the Vite config
// does, for `vp check` too) must not start anything or touch the store.
let engine!: Engine;
let engraver!: Engraver;
/** The score the page shows: the engraver draws only its measures. */
let shown = "";

interface Opened {
  /** Hash of the file content whose audio is planned. */
  audio?: string;
  /** Why the file could not be read or planned (a save in the middle of editing, say). */
  error?: string;
  notation?: { seq: number; view: NotationView; strip: StripDocs };
  notationError?: string;
  /** Notation requests so far; an answer older than the one shown is dropped. */
  requested: number;
}
const opened = new Map<string, Opened>();
const reading = new Map<string, Promise<void>>();
const stale = new Set<string>();
const notationWaiters = new Map<string, (() => void)[]>();

// Started on first use: importing this module (the Vite config does) must not start threads.
let notationWorker: Worker | undefined;
let nextNotation = 0;
const answers = new Map<number, (a: NotationAnswer) => void>();
function notationOf(text: string): Promise<NotationAnswer> {
  if (!notationWorker) {
    notationWorker = new Worker(new URL("./notation-thread.ts", import.meta.url));
    notationWorker.unref();
    notationWorker.on("message", (a: NotationAnswer) => {
      answers.get(a.id)?.(a);
      answers.delete(a.id);
    });
  }
  const worker = notationWorker;
  return new Promise<NotationAnswer>((resolve) => {
    const id = nextNotation++;
    answers.set(id, resolve);
    worker.postMessage({ id, text });
  });
}

function applyNotation(path: string, seq: number, answer: NotationAnswer): void {
  const entry = opened.get(path);
  if (!entry || (entry.notation?.seq ?? -1) > seq) return;
  if ("error" in answer) entry.notationError = answer.error;
  else {
    entry.notationError = undefined;
    entry.notation = { seq, view: answer.view, strip: answer.strip };
    if (path === shown) engraver.show(path, answer.strip);
  }
  for (const done of notationWaiters.get(path)?.splice(0) ?? []) done();
  broadcast("score", { path });
}

/**
 * Brings a score up to what is on disk now: plans its audio here and has its notation made in the
 * worker. Resolves once the audio is planned (the notation follows with a "score" event).
 */
function refresh(path: string): Promise<void> {
  stale.add(path);
  const running = reading.get(path);
  if (running) return running;
  const entry = opened.get(path) ?? { requested: 0 };
  opened.set(path, entry);
  const run = (async () => {
    while (stale.delete(path)) {
      let text: string;
      try {
        text = await readFile(path, "utf8");
      } catch (e) {
        entry.error = message(e);
        continue;
      }
      const hash = createHash("sha256").update(text).digest("hex");
      if (entry.audio === hash && !entry.error) continue;
      const seq = ++entry.requested;
      void notationOf(text).then((a) => applyNotation(path, seq, a));
      try {
        await engine.open(path, normalize(JSON.parse(text) as Score));
        entry.audio = hash;
        entry.error = undefined;
      } catch (e) {
        entry.error = message(e);
      }
    }
  })().finally(() => {
    reading.delete(path);
    broadcast("status", { path, ...engine.stamp(path), error: entry.error });
  });
  reading.set(path, run);
  return run;
}

async function scoreView(path: string): Promise<NotationView | { error: string }> {
  const entry = opened.get(path);
  if (!entry?.notation && !entry?.notationError) {
    const drawn = new Promise<void>((resolve) =>
      notationWaiters.set(path, [...(notationWaiters.get(path) ?? []), resolve]),
    );
    void refresh(path);
    await drawn;
  }
  const now = opened.get(path)!;
  if (now.notation && path !== shown) {
    shown = path;
    engraver.show(path, now.notation.strip);
  }
  return now.notation?.view ?? { error: now.notationError ?? "No notation" };
}

const generatorsDir = join(repoRoot, "generators");

let watchers: FSWatcher[] = [];
let watched = "";
function watchScores(): void {
  const existing = scoreDirs().filter((d) => existsSync(d));
  if (existing.join(":") === watched) return;
  for (const w of watchers) w.close();
  watchers = existing.map((dir) =>
    watch(dir, { recursive: true }, (_type, file) => {
      if (!file) return;
      const path = join(dir, file);
      // A saved sketch, or a file a piece imports, writes the score again (which comes back here
      // as a .json). For a node of a piece, that is the piece's score.
      if (file.endsWith(".ts")) {
        let d = dirname(path);
        while (!existsSync(sketchFile(d)) && d.startsWith(dir + sep)) d = dirname(d);
        if (!existsSync(sketchFile(d))) return;
        const root = rootOf(d);
        const changed = basename(file) === "sketch.ts" ? d : root;
        void rerun(root).then(() => {
          broadcast("sketch", { dir: changed });
          broadcast("list", {});
        });
        return;
      }
      if (!file.endsWith(".json") || basename(file) === "values.json") return;
      // An open score is read again (and starts rendering its changes) before the page asks.
      if (opened.has(path)) void refresh(path);
      broadcast("list", {});
    }),
  );
  // Generators are shared by pieces: a change writes every piece again.
  if (existsSync(generatorsDir))
    watchers.push(
      watch(generatorsDir, { recursive: true }, (_type, file) => {
        if (!file?.endsWith(".ts")) return;
        const pieces = [
          ...new Set(
            listScores()
              .filter((e) => e.depth === 0)
              .map((e) => dirname(e.path)),
          ),
        ];
        for (const root of pieces) void rerun(root).then(() => broadcast("sketch", { dir: root }));
      }),
    );
  // A folder that appeared later (or vanished): let the page refresh its list.
  if (watched) broadcast("list", {});
  watched = existing.join(":");
}

//==============================================================================
// Mixer settings, one file per score (the balance is separate from the score's dynamics)

const mixerRoot = join(repoRoot, ".local/mixer");
const mixerFile = (scorePath: string) =>
  join(mixerRoot, `${basename(scorePath).replace(/\.json$/, "")}.json`);

//==============================================================================

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

/** Asks the browser to save the response as a file with this name. */
function attachment(res: ServerResponse, name: string): void {
  res.setHeader(
    "content-disposition",
    `attachment; filename="${name.replace(/[^\x20-\x7e]|"/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
  );
}

async function body(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

/** The score read and planned (reading it first if needed); an error text if it cannot be. */
async function planned(path: string): Promise<string | undefined> {
  if (!opened.get(path)?.audio) await refresh(path);
  const entry = opened.get(path)!;
  if (!entry.audio) return entry.error ?? "Not read";
  return undefined;
}

/**
 * The running preview's hosts, threads and watchers. Vite restarts the dev server inside the same
 * process when a file the config imports changes (this one, say): the preview before must let go
 * of them, or every restart leaves another set of BBC SO hosts running.
 */
const previous = globalThis as typeof globalThis & { takemitsuPreview?: { close(): void } };

export function previewMiddleware() {
  previous.takemitsuPreview?.close();
  engine = new Engine();
  engine.onStatus = (path) => broadcast("status", { path, ...engine.stamp(path) });
  engraver = new Engraver({
    threads: Number(process.env.TAKEMITSU_ENGRAVERS ?? 4),
    dir: resolve(process.env.TAKEMITSU_ENGRAVINGS_DIR ?? join(repoRoot, ".local/engravings")),
    memoryBytes: 1.5e9,
    diskBytes: Number(process.env.TAKEMITSU_ENGRAVINGS_GB ?? 10) * 1e9,
  });
  engraver.onChange = (path) => broadcast("notation", { path });
  watchScores();
  const rewatch = setInterval(watchScores, 3000);
  rewatch.unref();
  previous.takemitsuPreview = {
    close() {
      clearInterval(rewatch);
      for (const w of watchers) w.close();
      watchers = [];
      watched = "";
      engine.stop();
      engraver.stop();
      void notationWorker?.terminate();
      notationWorker = undefined;
      for (const c of clients) c.end();
      clients.clear();
    },
  };
  return async (req: IncomingMessage, res: ServerResponse, next: Next) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.searchParams.get("path") ?? "";
    try {
      if (url.pathname === "/api/scores") return json(res, 200, listScores());
      if (url.pathname === "/api/score") {
        if (!allowed(path)) return json(res, 403, { error: "Not a score file in a score folder" });
        const view = await scoreView(path);
        return json(res, "error" in view ? 500 : 200, view);
      }
      if (url.pathname === "/api/notation") {
        const snapshot = engraver.snapshot(path);
        if (!snapshot) return json(res, 404, { error: "Not the score being shown" });
        return json(res, 200, snapshot);
      }
      const drawing = url.pathname.match(/^\/api\/engraving\/([0-9a-f]{32})\.(svg|json)$/);
      if (drawing) {
        const kind = drawing[2] as "svg" | "json";
        const content = engraver.file(drawing[1]!, kind);
        if (content === undefined) return json(res, 404, { error: "Unknown drawing" });
        res.setHeader("content-type", kind === "svg" ? "image/svg+xml" : "application/json");
        res.setHeader("cache-control", "public, max-age=31536000, immutable");
        return res.end(content);
      }
      if (url.pathname === "/api/view" && req.method === "POST") {
        const {
          path: p,
          from,
          to,
        } = (await body(req)) as { path: string; from: number; to: number };
        engraver.setFocus(p, from, to);
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/api/manifest") {
        if (!allowed(path)) return json(res, 403, { error: "Not a score file in a score folder" });
        const error = await planned(path);
        if (error) return json(res, 500, { error });
        return json(res, 200, engine.manifest(path));
      }
      if (url.pathname === "/api/status") {
        if (!allowed(path)) return json(res, 403, { error: "Not a score file in a score folder" });
        const error = await planned(path);
        if (error) return json(res, 500, { error });
        return json(res, 200, { ...engine.status(path), error: opened.get(path)?.error });
      }
      if (url.pathname === "/api/playhead" && req.method === "POST") {
        const { path: p, seconds } = (await body(req)) as { path: string; seconds: number };
        engine.setPlayhead(p, seconds);
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/api/segments" && req.method === "POST") {
        const { segments } = (await body(req)) as { segments: SegmentRequest[] };
        res.setHeader("content-type", "application/octet-stream");
        return res.end(await segmentBundle(segments));
      }
      if (url.pathname === "/api/sketch") {
        // `node`: a folder inside the piece whose score is open (default: the piece itself).
        const root = allowed(path) ? sketchOf(resolve(path)) : undefined;
        const asked = url.searchParams.get("node");
        const dir = root && (asked ? nodeIn(root, resolve(asked)) : root);
        if (!dir) return json(res, 404, { error: "Not a sketch's score" });
        if (req.method === "POST") {
          try {
            await changeSketch(dir, (await body(req)) as SketchChange);
          } catch (e) {
            return json(res, 400, { error: message(e) });
          }
        }
        return json(res, 200, await sketchState(dir, scoreDirs()));
      }
      if (url.pathname === "/api/musicxml") {
        // The whole score as one MusicXML file, as Sibelius opens it (a piece: the whole piece).
        if (!allowed(path)) return json(res, 403, { error: "Not a score file in a score folder" });
        const { musicxml } = toMusicXml(JSON.parse(await readFile(path, "utf8")) as Score);
        res.setHeader("content-type", "application/vnd.recordare.musicxml+xml; charset=utf-8");
        attachment(res, `${basename(path, ".json")}.musicxml`);
        return res.end(musicxml);
      }
      if (url.pathname === "/api/wav") {
        // The audio as the page's mixer plays it (its settings come with the request), once
        // every chunk is rendered: 48 kHz, 16-bit stereo, to the end of the last note's tail.
        if (!allowed(path)) return json(res, 403, { error: "Not a score file in a score folder" });
        const error = await planned(path);
        if (error) return json(res, 500, { error });
        let settings: MixerSettings = {};
        try {
          settings = JSON.parse(url.searchParams.get("mixer") ?? "{}") as MixerSettings;
        } catch {
          // The saved balance is only a convenience: mix at 0 dB.
        }
        await engine.whenDone(path);
        const mix = await mixAsHeard(engine, path, settings);
        res.setHeader("content-type", "audio/wav");
        res.setHeader("x-mix-warnings", encodeURIComponent(JSON.stringify(mix.warnings)));
        attachment(res, `${basename(path, ".json")}.wav`);
        return res.end(mix.wav);
      }
      if (url.pathname === "/api/mixer") {
        if (!allowed(path)) return json(res, 403, { error: "Not a score file in a score folder" });
        if (req.method === "PUT") {
          await mkdir(mixerRoot, { recursive: true });
          await writeFile(mixerFile(path), JSON.stringify(await body(req), null, 2));
          return json(res, 200, { ok: true });
        }
        const file = mixerFile(path);
        return json(res, 200, existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : {});
      }
      if (url.pathname === "/api/events") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        res.write(": connected\n\n");
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
    } catch (e) {
      return json(res, 500, { error: message(e) });
    }
    next();
  };
}

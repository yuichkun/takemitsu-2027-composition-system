// The preview's dev-server side (docs/decisions/0016): lists and watches score JSON files,
// turns them into MusicXML, keeps their chunks rendered in the background, and serves chunks.
//
// Score folders: examples/ and scores/ in the repository, plus any in PREVIEW_SCORE_DIRS
// (colon-separated), so a composition layer can write its output anywhere.
//
// Rendering: opening a score, and every save of an open score, plans it and queues the chunks
// that are not stored yet (src/performance/engine.ts), nearest the playhead first. The page gets
// the list of chunks (/api/manifest), hears which become ready ("chunks" events), and fetches
// the parts' audio shortly before it plays, mixed from the chunks in 2 s segments (/api/segments).

import { createHash } from "node:crypto";
import { existsSync, readdirSync, watch, type FSWatcher } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

import { musicXmlWindows } from "../notation/musicxml.ts";
import { Engine, type Manifest } from "../performance/engine.ts";
import { segmentBundle, type SegmentRequest } from "../performance/segments.ts";
import { repoRoot } from "../render/host.ts";
import { normalize, type NormalScore } from "../score/normalize.ts";
import { secondsAt } from "../score/timeline.ts";
import type { Score } from "../score/types.ts";

type Next = (err?: unknown) => void;

export function scoreDirs(): string[] {
  const extra = (process.env.PREVIEW_SCORE_DIRS ?? "").split(":").filter(Boolean);
  return [join(repoRoot, "examples"), join(repoRoot, "scores"), ...extra.map((d) => resolve(d))];
}

function listScores(): { path: string; name: string; dir: string }[] {
  const out: { path: string; name: string; dir: string }[] = [];
  for (const dir of scoreDirs()) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith(".json")) continue;
      const path = join(dir, f);
      out.push({ path, name: f.replace(/\.json$/, ""), dir: relative(repoRoot, dir) || dir });
    }
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

//==============================================================================
// Open scores: parsed once per content, planned and queued for rendering

const engine = new Engine();

interface Loaded {
  hash: string;
  score: NormalScore;
  manifest: Manifest;
}
const loaded = new Map<string, Loaded>();
const loading = new Map<string, Promise<Loaded>>();

/** The score at `path` as it is on disk now, planned and queued (again only if it changed). */
async function load(path: string): Promise<Loaded> {
  const text = await readFile(path, "utf8");
  const hash = createHash("sha256").update(text).digest("hex");
  const current = loaded.get(path);
  if (current?.hash === hash) return current;
  const pending = loading.get(path);
  if (pending) return pending;
  const work = (async () => {
    const score = normalize(JSON.parse(text) as Score);
    const manifest = await engine.open(path, score);
    const entry = { hash, score, manifest };
    loaded.set(path, entry);
    return entry;
  })();
  loading.set(path, work);
  try {
    return await work;
  } finally {
    loading.delete(path);
  }
}

/**
 * The notation of each loaded score, as short MusicXML documents ("windows") the page draws one
 * by one, by content hash: after an edit, only windows whose MusicXML changed are drawn again.
 */
const notation = new Map<
  string,
  { hash: string; windows: { from: number; to: number; hash: string }[]; warnings: string[] }
>();
const windowXml = new Map<string, string>();

function notationOf(path: string, entry: Loaded) {
  const known = notation.get(path);
  if (known?.hash === entry.hash) return known;
  const { windows, warnings } = musicXmlWindows(entry.score);
  const list = windows.map((w) => {
    const hash = createHash("sha256").update(w.musicxml).digest("hex").slice(0, 32);
    windowXml.set(hash, w.musicxml);
    return { from: w.from, to: w.to, hash };
  });
  const result = { hash: entry.hash, windows: list, warnings };
  notation.set(path, result);
  // Keep the documents of the loaded scores only.
  const used = new Set([...notation.values()].flatMap((n) => n.windows.map((w) => w.hash)));
  for (const h of windowXml.keys()) if (!used.has(h)) windowXml.delete(h);
  return result;
}

async function scoreView(path: string) {
  const entry = await load(path);
  const { score } = entry;
  const { windows, warnings } = notationOf(path, entry);
  return {
    title: score.title,
    windows,
    warnings,
    measures: score.measures.map((m) => ({
      number: m.number,
      quarters: m.start.value,
      seconds: secondsAt(score.tempo, m.start.value),
      endSeconds: secondsAt(score.tempo, m.start.add(m.length).value),
    })),
    parts: score.parts.map((p) => ({ id: p.id, name: p.name })),
  };
}

//==============================================================================
// Events to the browser (server-sent events)

const clients = new Set<ServerResponse>();
function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) c.write(payload);
}

engine.onReady = (path, keys) =>
  broadcast("chunks", {
    path,
    version: loaded.get(path)?.manifest.version,
    ready: keys.map((k) => [k, engine.framesOf(k) ?? 0]),
  });
engine.onProgress = (path, progress) => broadcast("progress", { path, ...progress });

let watchers: FSWatcher[] = [];
let watched = "";
function watchScores(): void {
  const existing = scoreDirs().filter((d) => existsSync(d));
  if (existing.join(":") === watched) return;
  for (const w of watchers) w.close();
  watchers = existing.map((dir) =>
    watch(dir, (_type, file) => {
      if (!file?.endsWith(".json")) return;
      const path = join(dir, file);
      // An open score starts rendering its changes before the page asks.
      if (loaded.has(path))
        void load(path).then(
          () => broadcast("changed", { path }),
          () => broadcast("changed", { path }),
        );
      else broadcast("changed", { path });
    }),
  );
  // A folder that appeared later (or vanished): let the page refresh its list.
  if (watched) broadcast("changed", { path: "" });
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

async function body(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export function previewMiddleware() {
  watchScores();
  setInterval(watchScores, 3000).unref();
  return async (req: IncomingMessage, res: ServerResponse, next: Next) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.searchParams.get("path") ?? "";
    try {
      if (url.pathname === "/api/scores") return json(res, 200, listScores());
      if (url.pathname === "/api/score") {
        if (!allowed(path)) return json(res, 403, { error: "Not a score file in a score folder" });
        return json(res, 200, await scoreView(path));
      }
      if (url.pathname === "/api/window") {
        const xml = windowXml.get(url.searchParams.get("hash") ?? "");
        if (xml === undefined) return json(res, 404, { error: "Unknown window" });
        res.setHeader("content-type", "application/xml");
        return res.end(xml);
      }
      if (url.pathname === "/api/manifest") {
        if (!allowed(path)) return json(res, 403, { error: "Not a score file in a score folder" });
        await load(path);
        return json(res, 200, { ...engine.manifest(path), progress: engine.progress(path) });
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
      return json(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
    next();
  };
}

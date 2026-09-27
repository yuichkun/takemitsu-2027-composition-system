// The preview's dev-server side (docs/decisions/0016): lists and watches score JSON files,
// turns them into MusicXML, runs renders, and serves the results.
//
// Score folders: examples/ and scores/ in the repository, plus any in PREVIEW_SCORE_DIRS
// (colon-separated), so a composition layer can write its output anywhere.

import {
  createReadStream,
  existsSync,
  readdirSync,
  statSync,
  watch,
  type FSWatcher,
} from "node:fs";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

import { musicXmlOf } from "../notation/musicxml.ts";
import { plan } from "../performance/plan.ts";
import { renderPlan, type RenderOutput } from "../performance/render.ts";
import { repoRoot } from "../render/host.ts";
import { normalize } from "../score/normalize.ts";
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

async function loadScore(path: string) {
  const score = normalize(JSON.parse(await readFile(path, "utf8")) as Score);
  const { musicxml, warnings } = musicXmlOf(score);
  return {
    title: score.title,
    musicxml,
    warnings,
    measures: score.measures.map((m) => ({
      number: m.number,
      quarters: m.start.value,
      seconds: secondsAt(score.tempo, m.start.value),
    })),
    parts: score.parts.map((p) => ({ id: p.id, name: p.name })),
    score,
  };
}

//==============================================================================
// Events to the browser (server-sent events)

const clients = new Set<ServerResponse>();
function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) c.write(payload);
}

let watchers: FSWatcher[] = [];
let watched = "";
function watchScores(): void {
  const existing = scoreDirs().filter((d) => existsSync(d));
  if (existing.join(":") === watched) return;
  for (const w of watchers) w.close();
  watchers = existing.map((dir) =>
    watch(dir, (_type, file) => {
      if (file?.endsWith(".json")) broadcast("changed", { path: join(dir, file) });
    }),
  );
  // A folder that appeared later (or vanished): let the page refresh its list.
  if (watched) broadcast("changed", { path: "" });
  watched = existing.join(":");
}

//==============================================================================
// Render jobs (one at a time; a new request waits for the running one)

interface Job {
  id: string;
  path: string;
  from: number;
  to: number;
  status: "queued" | "running" | "done" | "failed";
  message: string;
  fraction: number;
  result?: RenderOutput & { url: string; startSeconds: number };
  error?: string;
}
const jobs = new Map<string, Job>();
let chain: Promise<unknown> = Promise.resolve();

function startRender(path: string, from: number, to: number): Job {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const job: Job = { id, path, from, to, status: "queued", message: "Waiting", fraction: 0 };
  jobs.set(id, job);
  const update = () => broadcast("job", job);
  chain = chain.then(async () => {
    job.status = "running";
    update();
    try {
      const { score } = await loadScore(path);
      const first = score.measures.find((m) => m.number === from) ?? score.measures[0]!;
      const last = score.measures.find((m) => m.number === to) ?? score.measures.at(-1)!;
      const p = plan(score, { from: first.start, to: last.start.add(last.length) });
      const name = basename(path).replace(/\.json$/, "");
      const dir = join(repoRoot, ".local/renders", name, `m${first.number}-${last.number}`);
      const out = await renderPlan(p, dir, (message, fraction) => {
        job.message = message;
        job.fraction = fraction;
        update();
      });
      job.result = {
        ...out,
        url: `/renders/${relative(join(repoRoot, ".local/renders"), out.mix)}?v=${Date.now()}`,
        startSeconds: secondsAt(score.tempo, first.start.value),
      };
      job.status = "done";
      job.message = "Done";
      job.fraction = 1;
    } catch (e) {
      job.status = "failed";
      job.error = e instanceof Error ? e.message : String(e);
    }
    update();
  });
  return job;
}

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
    try {
      if (url.pathname === "/api/scores") return json(res, 200, listScores());
      if (url.pathname === "/api/score") {
        const path = url.searchParams.get("path") ?? "";
        if (!allowed(path)) return json(res, 403, { error: "Not a score file in a score folder" });
        const { score: _score, ...rest } = await loadScore(path);
        return json(res, 200, rest);
      }
      if (url.pathname === "/api/render" && req.method === "POST") {
        const { path, from, to } = (await body(req)) as { path: string; from: number; to: number };
        if (!allowed(path)) return json(res, 403, { error: "Not a score file in a score folder" });
        return json(res, 200, startRender(path, from, to));
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
      if (url.pathname.startsWith("/renders/")) {
        const root = join(repoRoot, ".local/renders");
        const file = resolve(root, decodeURIComponent(url.pathname.slice("/renders/".length)));
        if (relative(root, file).startsWith("..") || !existsSync(file) || !statSync(file).isFile())
          return json(res, 404, { error: "Not found" });
        // Byte ranges, so the audio element can seek.
        const size = statSync(file).size;
        res.setHeader(
          "content-type",
          file.endsWith(".wav") ? "audio/wav" : "application/octet-stream",
        );
        res.setHeader("accept-ranges", "bytes");
        const match = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
        if (match) {
          const start = match[1] ? Number(match[1]) : 0;
          const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
          res.statusCode = 206;
          res.setHeader("content-range", `bytes ${start}-${end}/${size}`);
          res.setHeader("content-length", end - start + 1);
          createReadStream(file, { start, end }).pipe(res);
          return;
        }
        res.setHeader("content-length", size);
        createReadStream(file).pipe(res);
        return;
      }
    } catch (e) {
      return json(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
    next();
  };
}

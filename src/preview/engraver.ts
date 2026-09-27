// Draws the open score's measures for the strip ahead of time, on worker threads of the dev
// server (docs/decisions/0020). The page only places the drawings.
//
// Each measure is drawn twice (engrave.ts):
// 1. with the least space between staves, which shows how much space each staff needs above it;
// 2. with the space every measure shares: for each pair of staves, the most any measure needs
//    (rounded up to whole staff spaces), so the staves line up from measure to measure.
// The shared space is worked out from the score as it is now (from what its measures need), never
// from what was drawn before. Until all measures are measured, the page shows the first drawings,
// whose staves may not line up. When the shared space changes, every measure is drawn again,
// nearest the view first.
//
// Drawings are kept by a key made of everything that goes into them (the document, its seam, the
// spacing, the drawing code and Verovio's version), in memory and on disk, so a drawing is never
// made twice and a restart finds them again. The page gets the whole state of the open score at
// once (snapshot); drawings themselves are fetched by key and never change.

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

import type { Seam } from "../notation/musicxml.ts";
import { bleed, engraveOptions, type EngraveRequest, type Engraving } from "./engrave.ts";
import type { EngraveAnswer, EngraveJob } from "./engrave-thread.ts";

/** The open score, as documents to draw (src/notation/musicxml.ts, stripMeasures). */
export interface StripDocs {
  measures: { musicxml: string; seam: Seam; margin: number }[];
  margins: string[];
  /** Staves in the score, from the top. */
  staves: number;
}

/** Where a drawing's staves are, to place it (all in the drawing's own units). */
export interface Shot {
  key: string;
  width: number;
  height: number;
  /** Top line of staff 1, and bottom line of the last staff. */
  top: number;
  bottom: number;
  /** The closing barline: where the next measure starts. */
  right: number;
  /** Drawn with the spacing all measures share; otherwise its staves may not line up. */
  aligned: boolean;
}

/** A drawing's own facts, kept beside it. */
type Facts = Omit<Engraving, "svg">;

export interface NotationSnapshot {
  /** Grows with every change. */
  serial: number;
  /** How far drawings reach left of their first barline. */
  bleed: number;
  /** Per measure: its drawing, not drawn yet (null), or could not be drawn. */
  measures: (Shot | null | "failed")[];
  /** Per margin (StripDocs.margins). */
  margins: (Shot | null | "failed")[];
  /** Which margin each measure takes. */
  marginOf: number[];
  /** Measures not yet drawn with the shared spacing. */
  pending: number;
}

/** Verovio's own least space between staves (MEI units): the first drawing uses it. */
const least = 12;
/** A thread is replaced after this many drawings, or once Verovio's memory is this large. */
const threadDrawings = 500;
const threadHeap = 1.5e9;

export interface EngraverOptions {
  /** Worker threads drawing at once. */
  threads: number;
  /** Where drawings are kept between runs. */
  dir: string;
  /** Limits for the drawings kept in memory and on disk. */
  memoryBytes: number;
  diskBytes: number;
}

interface Job {
  key: string;
  request: EngraveRequest;
  /** Lower goes first. */
  rank: number;
}

interface Thread {
  worker: Worker;
  ready: boolean;
  job?: Job;
  drawn: number;
}

export class Engraver {
  /** Called (at most every 200 ms) when the open score's drawings change. */
  onChange?: (path: string) => void;

  private readonly dir: string;
  private readonly version: string;
  private readonly threads: Thread[] = [];
  private readonly onDisk = new Set<string>();
  private readonly facts = new Map<string, Facts>();
  /** SVG text, most recently used last, up to `memoryBytes`. */
  private readonly svgs = new Map<string, string>();
  private svgBytes = 0;
  private readonly failures = new Map<string, number>();
  private open?: { path: string; docs: StripDocs; contents: string[]; marginContents: string[] };
  /** The spacing all measures share, once every measure has been measured. */
  private shared?: number[];
  private focus = { from: 0, to: 0 };
  private queue: Job[] = [];
  private serial = 0;
  private notifyTimer?: NodeJS.Timeout;
  private writes = 0;

  private readonly options: EngraverOptions;

  constructor(options: EngraverOptions) {
    this.options = options;
    this.dir = options.dir;
    mkdirSync(this.dir, { recursive: true });
    for (const f of readdirSync(this.dir))
      if (f.endsWith(".json")) this.onDisk.add(f.slice(0, -".json".length));
    const source = (name: string) =>
      readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");
    const verovio = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../node_modules/verovio/package.json", import.meta.url)),
        "utf8",
      ),
    ) as { version: string };
    this.version = hash(
      verovio.version,
      JSON.stringify(engraveOptions),
      String(bleed),
      source("./engrave.ts"),
    );
    this.prune();
    for (let i = 0; i < options.threads; i++) this.threads.push(this.spawn());
  }

  /** Makes a score the open one (or updates it after a save). */
  show(path: string, docs: StripDocs): void {
    const contents = docs.measures.map((m) => hash(m.musicxml, JSON.stringify(m.seam)));
    const marginContents = docs.margins.map((m) => hash("margin", m));
    const same = this.open?.path === path && this.open.docs.staves === docs.staves;
    if (!same) this.shared = undefined;
    this.open = { path, docs, contents, marginContents };
    this.updateShared();
    this.plan();
  }

  /** The measures in view (indices), drawn first. */
  setFocus(path: string, from: number, to: number): void {
    if (this.open?.path !== path) return;
    this.focus = { from, to };
    this.plan();
  }

  snapshot(path: string): NotationSnapshot | undefined {
    const open = this.open;
    if (open?.path !== path) return undefined;
    const least = this.leastSpacing();
    let pending = 0;
    const measures = open.contents.map((c) => {
      const shared = this.shared && this.shot(this.key(c, this.shared), true);
      if (!shared) pending++;
      return shared ?? this.shot(this.key(c, least), false) ?? this.failedOr(c, least);
    });
    const spacing = this.shared ?? least;
    const margins = open.marginContents.map(
      (c) =>
        this.shot(this.key(c, spacing), this.shared !== undefined) ?? this.failedOr(c, spacing),
    );
    return {
      serial: this.serial,
      bleed,
      measures,
      margins,
      marginOf: open.docs.measures.map((m) => m.margin),
      pending,
    };
  }

  /** A drawing (".svg") or its facts (".json") by key. */
  file(key: string, kind: "svg" | "json"): string | undefined {
    if (!/^[0-9a-f]{32}$/.test(key)) return undefined;
    if (kind === "json") {
      const facts = this.factsOf(key);
      return facts && JSON.stringify(facts);
    }
    const kept = this.svgs.get(key);
    if (kept !== undefined) {
      this.svgs.delete(key);
      this.svgs.set(key, kept);
      return kept;
    }
    if (!this.onDisk.has(key)) return undefined;
    try {
      const svg = readFileSync(join(this.dir, `${key}.svg`), "utf8");
      this.remember(key, svg);
      return svg;
    } catch {
      return undefined;
    }
  }

  stop(): void {
    for (const t of this.threads) void t.worker.terminate();
    this.threads.length = 0;
    clearTimeout(this.notifyTimer);
  }

  //============================================================================
  // Keys and drawings

  private key(content: string, spacing: number[]): string {
    return hash(this.version, content, JSON.stringify(spacing)).slice(0, 32);
  }

  private leastSpacing(): number[] {
    const staves = this.open?.docs.staves ?? 0;
    return Array.from({ length: staves + 1 }, (_, n) => (n < 2 ? 0 : least));
  }

  private factsOf(key: string): Facts | undefined {
    const known = this.facts.get(key);
    if (known || !this.onDisk.has(key)) return known;
    try {
      const facts = JSON.parse(readFileSync(join(this.dir, `${key}.json`), "utf8")) as Facts;
      this.facts.set(key, facts);
      return facts;
    } catch {
      this.onDisk.delete(key);
      return undefined;
    }
  }

  private shot(key: string, aligned: boolean): Shot | undefined {
    const f = this.factsOf(key);
    if (!f) return undefined;
    const [top] = f.staves[0] ?? [0];
    const bottom = f.staves.at(-1)?.[1] ?? 0;
    return { key, width: f.width, height: f.height, top, bottom, right: f.right, aligned };
  }

  private failedOr(content: string, spacing: number[]): "failed" | null {
    return (this.failures.get(this.key(content, spacing)) ?? 0) >= 2 ? "failed" : null;
  }

  private remember(key: string, svg: string): void {
    this.svgs.set(key, svg);
    this.svgBytes += svg.length;
    for (const [k, v] of this.svgs) {
      if (this.svgBytes <= this.options.memoryBytes) break;
      this.svgs.delete(k);
      this.svgBytes -= v.length;
    }
  }

  private store(key: string, engraving: Engraving): void {
    const { svg, ...facts } = engraving;
    this.facts.set(key, facts);
    this.remember(key, svg);
    try {
      writeFileSync(join(this.dir, `${key}.svg`), svg);
      writeFileSync(join(this.dir, `${key}.json`), JSON.stringify(facts));
      this.onDisk.add(key);
      if (++this.writes % 500 === 0) this.prune();
    } catch {
      // The disk copy is only a convenience: the drawing stays in memory.
    }
  }

  /** Keeps the disk copies under their limit, dropping the oldest. */
  private prune(): void {
    const files = readdirSync(this.dir)
      .filter((f) => f.endsWith(".svg"))
      .map((f) => {
        const s = statSync(join(this.dir, f));
        return { key: f.slice(0, -4), size: s.size, time: s.mtimeMs };
      })
      .sort((a, b) => a.time - b.time);
    let total = files.reduce((n, f) => n + f.size, 0);
    for (const f of files) {
      if (total <= this.options.diskBytes) break;
      for (const ext of [".svg", ".json"]) {
        const p = join(this.dir, f.key + ext);
        if (existsSync(p)) unlinkSync(p);
      }
      this.onDisk.delete(f.key);
      this.facts.delete(f.key);
      total -= f.size;
    }
  }

  //============================================================================
  // The shared spacing

  /** Works out the shared spacing if every measure has been measured (drawn with the least). */
  private updateShared(): void {
    const open = this.open;
    if (!open) return;
    const least = this.leastSpacing();
    const need = [...least];
    for (const c of open.contents) {
      const f = this.factsOf(this.key(c, least));
      if (!f) return; // not all measured yet: keep what there is
      f.gaps.forEach((g, i) => {
        const n = i + 1;
        if (n >= 2 && n < need.length) need[n] = Math.max(need[n]!, g);
      });
    }
    // Whole staff spaces (2 units), so that small differences do not move every staff.
    const shared = need.map((g, n) => (n < 2 ? 0 : Math.ceil(g / 2 - 1e-6) * 2));
    if (JSON.stringify(shared) === JSON.stringify(this.shared)) return;
    this.shared = shared;
    this.changed();
  }

  //============================================================================
  // Work

  private plan(): void {
    const open = this.open;
    if (!open) return;
    const least = this.leastSpacing();
    const { from, to } = this.focus;
    const distance = (m: number) => (m < from ? from - m : m > to ? m - to : 0);
    const jobs: Job[] = [];
    const want = (key: string, request: EngraveRequest, rank: number) => {
      if (this.facts.has(key) || this.onDisk.has(key)) return;
      if ((this.failures.get(key) ?? 0) >= 2) return;
      jobs.push({ key, request, rank });
    };
    open.docs.measures.forEach((m, i) => {
      const doc = { musicxml: m.musicxml, seam: m.seam };
      // Measuring comes first: the shared spacing waits for every measure.
      want(this.key(open.contents[i]!, least), { ...doc, spacing: least }, distance(i));
      if (this.shared)
        want(
          this.key(open.contents[i]!, this.shared),
          { ...doc, spacing: this.shared },
          1e6 + distance(i),
        );
    });
    // Margins: before the shared spacing is known, only the one in view (a score can have many
    // sets of clefs); then all of them, with the aligned measures near them.
    const spacing = this.shared ?? least;
    const nearest = new Map<number, number>();
    open.docs.measures.forEach((m, i) =>
      nearest.set(m.margin, Math.min(nearest.get(m.margin) ?? Infinity, distance(i))),
    );
    open.docs.margins.forEach((musicxml, i) => {
      const near = nearest.get(i) ?? 0;
      if (!this.shared && near > 0) return;
      const rank = (this.shared ? 1e6 : 0) + near - 0.5;
      want(this.key(open.marginContents[i]!, spacing), { musicxml, spacing, margin: true }, rank);
    });
    const busy = new Set(this.threads.map((t) => t.job?.key));
    this.queue = jobs.filter((j) => !busy.has(j.key)).sort((a, b) => a.rank - b.rank);
    this.dispatch();
  }

  private dispatch(): void {
    for (const t of this.threads) {
      if (!t.ready || t.job) continue;
      const job = this.queue.shift();
      if (!job) return;
      t.job = job;
      t.worker.postMessage({ id: 0, request: job.request } satisfies EngraveJob);
    }
  }

  private spawn(): Thread {
    const worker = new Worker(new URL("./engrave-thread.ts", import.meta.url));
    worker.unref();
    const thread: Thread = { worker, ready: false, drawn: 0 };
    worker.on("message", (m: EngraveAnswer | { ready: true }) => {
      if ("ready" in m) {
        thread.ready = true;
        this.dispatch();
        return;
      }
      const job = thread.job!;
      thread.job = undefined;
      thread.drawn++;
      if ("error" in m) this.fail(job.key);
      else this.store(job.key, m.engraving);
      if (thread.drawn >= threadDrawings || m.heap >= threadHeap) this.replace(thread);
      this.updateShared();
      this.changed();
      this.plan();
    });
    const lost = () => {
      if (!this.threads.includes(thread)) return;
      if (thread.job) this.fail(thread.job.key);
      thread.job = undefined;
      this.replace(thread);
      this.plan();
    };
    worker.on("error", lost);
    worker.on("exit", lost);
    return thread;
  }

  private replace(thread: Thread): void {
    const i = this.threads.indexOf(thread);
    if (i < 0) return;
    this.threads[i] = this.spawn();
    void thread.worker.terminate();
  }

  private fail(key: string): void {
    this.failures.set(key, (this.failures.get(key) ?? 0) + 1);
  }

  private changed(): void {
    this.serial++;
    if (this.notifyTimer || !this.open) return;
    const path = this.open.path;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = undefined;
      this.onChange?.(path);
    }, 200);
  }
}

function hash(...parts: string[]): string {
  const h = createHash("sha256");
  for (const p of parts) h.update(p).update("\0");
  return h.digest("hex");
}

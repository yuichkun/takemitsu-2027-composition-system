// Keeps the chunks of the open scores rendered.
//
// open(path, score) plans the score, cuts it into chunks and queues the ones that are not in
// the store. The queue is ordered by distance from the playhead (setPlayhead): the measure under
// the playhead first, then onwards, then the measures before it. The host pool takes batches of
// chunks that share a plugin state, preferring states a process already has loaded.
//
// Nothing here tracks what changed in a score: a new version is planned from scratch, and its
// chunks are looked up by key. Chunks that are already stored are simply found.

import { readWav, type Audio } from "../audio/wav.ts";
import { encodeState } from "../libraries/bbcso/state.ts";
import { pluginPath } from "../libraries/bbcso/patches.ts";
import type { NormalScore } from "../score/normalize.ts";
import { HostPool, type Batch, type WorkSource } from "../render/pool.ts";
import {
  chunkLanes,
  sampleRate,
  type Chunk,
  type ChunkedLane,
  type SampleChunk,
} from "./chunks.ts";
import { plan, type Plan } from "./plan.ts";
import { chunkFrames, chunkPath, encodeChunk, statePath, trimStore, writeChunk } from "./store.ts";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface Manifest {
  version: number;
  duration: number;
  measures: { start: number; end: number }[];
  /** Part ids, indexed by the chunks. */
  parts: string[];
  /** [key, part index, origin (s), gain, stored frames or -1 while not rendered] */
  chunks: [string, number, number, number, number][];
  warnings: string[];
}

export interface Progress {
  done: number;
  total: number;
  failed: number;
}

interface Open {
  path: string;
  version: number;
  plan: Plan;
  lanes: ChunkedLane[];
  keys: Set<string>;
  playhead: number;
  /** Measure index of the playhead. */
  playMeasure: number;
  failures: Map<string, string>;
  /** Keys of the version before, kept in the store too. */
  previous: Set<string>;
}

/**
 * Near the playhead (this many measures ahead), batches stay short so a moved playhead is served
 * soon. Further away, a batch takes much more of one state's work, so each state is loaded as
 * few times as possible (loading costs about 1–2 s, and a process holds only a few instances).
 */
const nearMeasures = 8;
const nearBatch = { chunks: 24, seconds: 20 };
const farBatch = { chunks: 400, seconds: 120 };
/** Near the playhead, a state already loaded in the asking process wins if its work is this many measures further. */
const loadedSlack = 6;

export class Engine implements WorkSource {
  readonly pool: HostPool;
  onReady?: (path: string, keys: string[]) => void;
  onProgress?: (path: string, progress: Progress) => void;
  /** A plugin instance was loaded (for measuring). */
  loaded?: (stateKey: string, seconds: number) => void;

  private open_ = new Map<string, Open>();
  /** Stored frames per key, as far as known. */
  private frames = new Map<string, number>();
  /** Queued chunks by key. */
  private queued = new Map<string, { chunk: Chunk; state?: string }>();
  private inFlight = new Set<string>();
  /** Far batches being rendered (id → keys left); one process always stays free for near work. */
  private far = new Map<number, Set<string>>();
  private farOf = new Map<string, number>();
  private batches = 0;
  private versions = 0;

  constructor(pool = new HostPool()) {
    this.pool = pool;
  }

  /**
   * Plans a score (again) and queues what is missing, nearest `playhead` (seconds) first when
   * given. Returns what the player needs.
   */
  async open(path: string, score: NormalScore, playhead?: number): Promise<Manifest> {
    const p = plan(score);
    const lanes = chunkLanes(p.lanes);
    const previous = this.open_.get(path);
    const entry: Open = {
      path,
      version: ++this.versions,
      plan: p,
      lanes,
      keys: new Set(lanes.flatMap((l) => l.chunks.map((c) => c.key))),
      playhead: previous?.playhead ?? 0,
      playMeasure: previous?.playMeasure ?? 0,
      failures: new Map(),
      previous: previous?.keys ?? new Set(),
    };
    this.open_.set(path, entry);
    if (playhead !== undefined) this.setPlayhead(path, playhead);

    // Forget queued chunks that no open score needs any more.
    const needed = new Set<string>();
    for (const o of this.open_.values()) for (const k of o.keys) needed.add(k);
    for (const key of this.queued.keys()) if (!needed.has(key)) this.queued.delete(key);

    await Promise.all(
      lanes.flatMap((l) =>
        l.chunks.map(async (c) => {
          if (this.frames.has(c.key)) return;
          const frames = await chunkFrames(c.key);
          if (frames !== undefined) this.frames.set(c.key, frames);
        }),
      ),
    );
    const samples: SampleChunk[] = [];
    for (const l of lanes) {
      if (l.state && l.stateKey && !existsSync(statePath(l.stateKey))) {
        mkdirSync(dirname(statePath(l.stateKey)), { recursive: true });
        writeFileSync(statePath(l.stateKey), encodeState(l.state));
      }
      for (const c of l.chunks) {
        if (this.frames.has(c.key) || this.inFlight.has(c.key)) continue;
        if (c.kind === "samples") samples.push(c);
        else this.queued.set(c.key, { chunk: c });
      }
    }
    void this.renderSamples(samples);
    this.pool.kick(this);
    this.report(entry);
    return this.manifest(entry);
  }

  close(path: string): void {
    this.open_.delete(path);
  }

  manifest(entry: Open | string): Manifest {
    const o = typeof entry === "string" ? this.open_.get(entry) : entry;
    if (!o) throw new Error(`Not open: ${typeof entry === "string" ? entry : entry.path}`);
    const parts = [...new Set(o.lanes.map((l) => l.lane.partId))];
    const index = new Map(parts.map((p, i) => [p, i]));
    return {
      version: o.version,
      duration: o.plan.duration,
      measures: o.plan.measures,
      parts,
      chunks: o.lanes.flatMap((l) =>
        l.chunks.map((c): Manifest["chunks"][number] => [
          c.key,
          index.get(c.partId)!,
          Math.round(c.origin * 1e6) / 1e6,
          c.gain,
          this.frames.get(c.key) ?? -1,
        ]),
      ),
      warnings: o.plan.warnings,
    };
  }

  lanesOf(path: string): ChunkedLane[] {
    return this.open_.get(path)?.lanes ?? [];
  }

  planOf(path: string): Plan | undefined {
    return this.open_.get(path)?.plan;
  }

  framesOf(key: string): number | undefined {
    return this.frames.get(key);
  }

  setPlayhead(path: string, seconds: number): void {
    const o = this.open_.get(path);
    if (!o) return;
    o.playhead = seconds;
    const m = o.plan.measures;
    let i = m.findIndex((x) => seconds < x.end);
    if (i < 0) i = Math.max(0, m.length - 1);
    o.playMeasure = i;
  }

  progress(path: string): Progress {
    const o = this.open_.get(path);
    if (!o) return { done: 0, total: 0, failed: 0 };
    let done = 0;
    for (const k of o.keys) if (this.frames.has(k)) done++;
    return { done, total: o.keys.size, failed: o.failures.size };
  }

  /** Resolves when every chunk of the score is rendered (or failed). */
  async whenDone(path: string): Promise<Progress> {
    for (;;) {
      const p = this.progress(path);
      if (p.done + p.failed >= p.total) return p;
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  //============================================================================
  // WorkSource

  pending(): boolean {
    return this.queued.size > 0;
  }

  take(
    loaded: ReadonlySet<string>,
    elsewhere: ReadonlySet<string>,
    idleElsewhere: ReadonlySet<string>,
  ): Batch | undefined {
    if (this.queued.size === 0) return undefined;
    // Rank queued chunks by the most urgent open score that needs them.
    // A chunk from before the playhead that still sounds there (a long note) is as urgent as
    // the playhead's own measure; its tail is not known yet, so allow a few seconds.
    const rank = (c: Chunk) => {
      let best = Infinity;
      for (const o of this.open_.values()) {
        if (!o.keys.has(c.key)) continue;
        const d = c.measure - o.playMeasure;
        const sounding = d < 0 && c.origin + c.frames / sampleRate + 3 > o.playhead;
        best = Math.min(best, d >= 0 ? d : sounding ? 0 : 1e6 - d);
      }
      return best;
    };
    let top: { chunk: Chunk; rank: number } | undefined;
    const bestByState = new Map<string, number>();
    const nearCount = new Map<string, number>();
    for (const { chunk } of this.queued.values()) {
      if (chunk.kind !== "bbcso") continue;
      const r = rank(chunk);
      if (!top || r < top.rank) top = { chunk, rank: r };
      const s = chunk.stateKey;
      if (r < (bestByState.get(s) ?? Infinity)) bestByState.set(s, r);
      if (r < nearMeasures) nearCount.set(s, (nearCount.get(s) ?? 0) + 1);
    }
    if (!top || top.chunk.kind !== "bbcso") return undefined;

    // Which state: one this process has loaded; else one no other process has (an idle one that
    // has it is about to be asked, a busy one is occupied); else the most urgent, loading it here
    // too rather than waiting. Near the playhead only close work counts; away from it any will do.
    const near = top.rank < nearMeasures;
    const slack = near ? loadedSlack : Infinity;
    const within = (r: number) => r <= top.rank + slack;
    const pick = (ok: (s: string) => boolean) => {
      let best: [string, number] | undefined;
      for (const [s, r] of bestByState)
        if (ok(s) && within(r) && (!best || r < best[1])) best = [s, r];
      return best;
    };
    const [state, stateRank] = pick((s) => loaded.has(s)) ??
      pick((s) => !elsewhere.has(s)) ??
      (near ? undefined : pick((s) => !idleElsewhere.has(s))) ?? [top.chunk.stateKey, top.rank];
    const isFar = stateRank >= nearMeasures;
    if (isFar && this.far.size >= this.pool.size - 1) return undefined;
    const limit = isFar ? farBatch : nearBatch;
    const batchId = this.batches++;

    const candidates = [...this.queued.values()]
      .map((q) => q.chunk)
      .filter(
        (c): c is Extract<Chunk, { kind: "bbcso" }> => c.kind === "bbcso" && c.stateKey === state,
      )
      .map((c) => ({ c, r: rank(c) }))
      .sort((a, b) => a.r - b.r);
    const chunks: Batch["chunks"] = [];
    let seconds = 0;
    for (const { c } of candidates) {
      if (chunks.length >= limit.chunks || (chunks.length > 0 && seconds > limit.seconds)) break;
      chunks.push({
        id: c.key,
        frames: c.frames,
        tailMax: c.tailMax,
        events: c.events,
        output: chunkPath(c.key),
      });
      seconds += c.frames / sampleRate;
      this.queued.delete(c.key);
      this.inFlight.add(c.key);
      if (isFar) {
        const keys = this.far.get(batchId) ?? new Set<string>();
        keys.add(c.key);
        this.far.set(batchId, keys);
        this.farOf.set(c.key, batchId);
      }
    }
    return { stateKey: state, stateFile: statePath(state), plugin: pluginPath, chunks };
  }

  rendered(key: string, frames: number): void {
    this.inFlight.delete(key);
    this.frames.set(key, frames);
    this.settleFar(key);
    this.announce(key);
  }

  private settleFar(key: string): void {
    const id = this.farOf.get(key);
    if (id === undefined) return;
    this.farOf.delete(key);
    const keys = this.far.get(id);
    keys?.delete(key);
    if (keys?.size === 0) {
      this.far.delete(id);
      // A process may have gone idle waiting for far work to be allowed again.
      if (this.queued.size) this.pool.kick(this);
    }
  }

  failed(batch: Batch, error: string): void {
    for (const c of batch.chunks) {
      this.settleFar(c.id);
      if (!this.inFlight.delete(c.id)) continue;
      for (const o of this.open_.values()) if (o.keys.has(c.id)) o.failures.set(c.id, error);
    }
    for (const o of this.open_.values()) this.report(o);
  }

  //============================================================================

  private pendingReady = new Map<string, string[]>();
  private readyTimer?: ReturnType<typeof setTimeout>;

  private announce(key: string): void {
    for (const o of this.open_.values()) {
      if (!o.keys.has(key)) continue;
      const list = this.pendingReady.get(o.path) ?? [];
      list.push(key);
      this.pendingReady.set(o.path, list);
    }
    this.readyTimer ??= setTimeout(() => {
      this.readyTimer = undefined;
      for (const [path, keys] of this.pendingReady) {
        this.onReady?.(path, keys);
        const o = this.open_.get(path);
        if (o) this.report(o);
      }
      this.pendingReady.clear();
      if (this.queued.size === 0 && this.inFlight.size === 0) {
        void this.trim();
      }
    }, 150);
  }

  private trimming = false;
  private lastTrim = 0;
  /**
   * Keeps the store under its limit, at most once a minute and one at a time. The chunks of the
   * open scores and of their previous versions stay (going back after an edit renders nothing).
   */
  private async trim(): Promise<void> {
    if (this.trimming || Date.now() - this.lastTrim < 60_000) return;
    this.trimming = true;
    this.lastTrim = Date.now();
    try {
      const keep = new Set<string>();
      for (const o of this.open_.values()) for (const k of [...o.keys, ...o.previous]) keep.add(k);
      await trimStore(keep);
    } finally {
      this.trimming = false;
    }
  }

  private report(o: Open): void {
    this.onProgress?.(o.path, this.progress(o.path));
  }

  private samples = new Map<string, Audio>();
  private async renderSamples(chunks: SampleChunk[]): Promise<void> {
    for (const c of chunks) {
      if (this.frames.has(c.key)) continue;
      let length = c.frames;
      const sources: { audio: Audio; hit: SampleChunk["hits"][number] }[] = [];
      for (const hit of c.hits) {
        const file = pick(c.files, hit.seed);
        let audio = this.samples.get(file);
        if (!audio) {
          audio = await readWav(file);
          this.samples.set(file, audio);
        }
        const len = Math.floor(audio.channels[0]!.length / (audio.sampleRate / sampleRate));
        length = Math.max(length, hit.frame + len);
        sources.push({ audio, hit });
      }
      const left = new Float32Array(length);
      const right = new Float32Array(length);
      for (const { audio, hit } of sources) {
        const step = audio.sampleRate / sampleRate;
        const len = Math.floor(audio.channels[0]!.length / step);
        for (const [c2, dst] of [left, right].entries()) {
          const src = audio.channels[Math.min(c2, audio.channels.length - 1)]!;
          for (let i = 0; i < len; i++) {
            const x = i * step;
            const j = Math.floor(x);
            const f = x - j;
            dst[hit.frame + i]! += (src[j]! * (1 - f) + (src[j + 1] ?? 0) * f) * hit.gain;
          }
        }
      }
      const bytes = encodeChunk(sampleRate, left, right);
      await writeChunk(c.key, bytes);
      this.rendered(c.key, (bytes.length - 24) / 4);
    }
  }
}

/** Deterministic pick among the files for a hit (the note's index is the seed). */
const pick = (files: string[], seed: number) =>
  files[Math.abs(Math.imul(seed + 1, 2654435761)) % files.length]!;

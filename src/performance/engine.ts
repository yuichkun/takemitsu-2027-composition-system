// Keeps the chunks of the open scores rendered (docs/decisions/0018, 0019).
//
// open(path, score) plans the score, cuts it into chunks and looks each one up in the store by
// key; the missing ones become work. Nothing here tracks what changed in a score: a new version
// is planned from scratch, and its chunks are found or rendered.
//
// Hosts: a fixed number of host processes, each holding a fixed set of plugin states. Every state
// the open scores use is loaded, grouped by instrument; instruments are spread over the processes
// by amount of work, the heaviest on more than one. A process holds exactly the states assigned
// to it: when that set changes (a new articulation, a new instrument) the process is started
// again and loads its set. Loading never overlaps rendering, because BBC SO can play silence when
// it loads while other processes render: all work waits while any process loads, and each loaded
// state plays test notes until they sound.
//
// Order: every place a chunk occurs in the open scores has an urgency (seconds after the
// playhead; sounding at the playhead first; already over last), and a chunk is as urgent as its
// most urgent place. Each process renders, one chunk at a time, the most urgent chunk among its
// states.
//
// Checking: the host writes into a scratch folder, and a chunk moves into the store only if no
// onset that should sound came out silent. Otherwise it is rendered again; after a few tries it is
// marked failed, plays as a hole, and is reported.

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { readWav, type Audio } from "../audio/wav.ts";
import { encodeState } from "../libraries/bbcso/state.ts";
import { pluginPath } from "../libraries/bbcso/patches.ts";
import type { NormalScore } from "../score/normalize.ts";
import { HostProcess, type ChunkJob, type ChunkResult } from "../render/hosts.ts";
import {
  chunkLanes,
  fileHash,
  sampleRate,
  type BbcsoChunk,
  type Chunk,
  type ChunkedLane,
  type Probe,
  type SampleChunk,
} from "./chunks.ts";
import { plan, type Plan } from "./plan.ts";
import {
  chunkFrames,
  chunkPath,
  encodeChunk,
  statePath,
  storeLimit,
  storeRoot,
  trimStore,
} from "./store.ts";

export interface Manifest {
  version: number;
  duration: number;
  measures: { start: number; end: number }[];
  /** Part ids, indexed by the chunks. */
  parts: string[];
  /**
   * Every place a chunk occurs (a key can occur at several places):
   * [key, part index, origin (s), gain, frames of its notes, frames of tail at most].
   */
  chunks: [string, number, number, number, number, number][];
  warnings: string[];
}

export interface Status {
  version: number;
  /** Counts up whenever anything here changes. */
  serial: number;
  /** For each place in the manifest: frames stored, -1 while not rendered, -2 when failed. */
  frames: number[];
  done: number;
  total: number;
  failed: number;
  /** Problems beyond single chunks: states not loaded, the store over its limit. */
  notices: string[];
}

export interface Progress {
  done: number;
  total: number;
  failed: number;
}

export interface EngineOptions {
  /** Host processes (TAKEMITSU_HOSTS, default 8). */
  processes: number;
  /** No more states are loaded once the hosts use this much memory (TAKEMITSU_HOSTS_MB). */
  memoryMB: number;
}

const defaults: EngineOptions = {
  processes: Number(process.env.TAKEMITSU_HOSTS ?? 8),
  memoryMB: Number(process.env.TAKEMITSU_HOSTS_MB ?? 24000),
};

/** A request that takes longer than this is taken for a hung host. */
const renderTimeoutMs = 120_000;
const loadTimeoutMs = 120_000;
/** Tries per chunk before it is marked failed, and the wait before trying again. */
const maxTries = 3;
const retryDelayMs = 2000;
/** How long a loaded state may take to sound its test notes. */
const probeDeadlineMs = 30_000;

interface Place {
  key: string;
  part: number;
  origin: number;
  gain: number;
  frames: number;
  tailMax: number;
}

interface Open {
  path: string;
  version: number;
  plan: Plan;
  lanes: ChunkedLane[];
  parts: string[];
  places: Place[];
  keys: Set<string>;
  /** Keys of the version before (kept in the store too). */
  previous: Set<string>;
  playhead: number;
}

interface Work {
  chunk: Chunk;
  tries: number;
  /** Not before this time (after a failed try). */
  notBefore: number;
}

/** Seconds until a place is needed from the playhead: sounding there 0, ahead its distance, over last. */
function urgencyOf(p: Place, playhead: number): number {
  const end = p.origin + (p.frames + p.tailMax) / sampleRate;
  if (p.origin <= playhead && playhead < end) return 0;
  if (p.origin > playhead) return p.origin - playhead;
  return 1e6 + (playhead - end);
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((x) => b.has(x));

function jobOf(chunk: BbcsoChunk, output: string): ChunkJob {
  return {
    id: chunk.key,
    frames: chunk.frames,
    tailMax: chunk.tailMax,
    events: chunk.events,
    params: chunk.params,
    output,
  };
}

/** A short note on one articulation, to hear whether a loaded state sounds. */
function probeJob(p: Probe, output: string, id: string): ChunkJob {
  const on = 4800;
  const off = on + 14400;
  return {
    id,
    frames: off + 512,
    tailMax: 24000,
    events: [
      [0, 0xb0, 123, 0],
      [0, 0xb0, 1, p.cc],
      [0, 0x90, p.keyswitch, 100],
      [480, 0x80, p.keyswitch, 0],
      [on, 0x90, p.key, p.velocity],
      [off, 0x80, p.key, 0],
    ],
    output,
  };
}

export class Engine {
  /** Something in a score's status changed (at most every 200 ms). */
  onStatus?: (path: string) => void;
  /** A state was loaded (for measuring). */
  loaded?: (stateKey: string, seconds: number) => void;
  /** A chunk was stored (ok) or given up (for measuring). */
  onChunk?: (key: string, ok: boolean) => void;
  /** A chunk is tried again, and why (for measuring). */
  onRetry?: (key: string, why: string) => void;

  private readonly options: EngineOptions;
  private stopped = false;
  private readonly hosts: HostProcess[];
  private open_ = new Map<string, Open>();
  /** Stored frames by key, as far as known. */
  private frames = new Map<string, number>();
  private failures = new Map<string, string>();
  private work = new Map<string, Work>();
  private inFlight = new Set<string>();
  /** Instrument → the processes it is placed on. */
  private homes = new Map<string, number[]>();
  /** States per instrument, and the test notes per state. */
  private statesOf = new Map<string, Set<string>>();
  private probes = new Map<string, Map<number, Probe>>();
  /** States each process must hold. */
  private required: Set<string>[];
  /** States that could not be loaded or did not sound, and why. */
  private unavailable = new Map<string, string>();
  private instrumentOf = new Map<string, string>();
  private queues: string[][];
  private cursors: number[];
  private driving: boolean[];
  private preparing?: Promise<void>;
  private prepareAgain = false;
  private drainWaiters: (() => void)[] = [];
  private versions = 0;
  private serial = 0;
  private storeNotice?: string;
  private readonly scratch: string;

  constructor(options: Partial<EngineOptions> = {}) {
    this.options = { ...defaults, ...options };
    const n = this.options.processes;
    this.hosts = Array.from({ length: n }, () => new HostProcess());
    this.required = Array.from({ length: n }, () => new Set<string>());
    this.queues = Array.from({ length: n }, () => []);
    this.cursors = Array.from({ length: n }, () => 0);
    this.driving = Array.from({ length: n }, () => false);
    // Preview and CLI rendering can run together. Never delete or reuse another engine's
    // in-flight files (including probe outputs); only completed chunks share the store.
    const scratchRoot = join(storeRoot, "scratch");
    mkdirSync(scratchRoot, { recursive: true });
    this.scratch = mkdtempSync(join(scratchRoot, "engine-"));
    // Hosts also leave when their stdin closes, but do not wait for that.
    process.once("exit", () => {
      this.stop();
      rmSync(this.scratch, { recursive: true, force: true });
    });
  }

  /**
   * Plans a score (again) and queues what is missing, nearest `playhead` (seconds) first when
   * given. Returns what the player needs.
   */
  async open(path: string, score: NormalScore, playhead?: number): Promise<Manifest> {
    if (this.stopped) throw new Error("Cannot open a score on a stopped engine");
    const p = plan(score);
    const lanes = chunkLanes(p.lanes);
    const previous = this.open_.get(path);
    const parts = [...new Set(lanes.map((l) => l.lane.partId))];
    const index = new Map(parts.map((x, i) => [x, i]));
    const places = lanes.flatMap((l) =>
      l.chunks.map((c): Place => ({
        key: c.key,
        part: index.get(c.partId)!,
        origin: c.origin,
        gain: c.gain,
        frames: c.frames,
        tailMax: c.tailMax,
      })),
    );
    const entry: Open = {
      path,
      version: ++this.versions,
      plan: p,
      lanes,
      parts,
      places,
      keys: new Set(places.map((x) => x.key)),
      previous: previous?.keys ?? new Set(),
      playhead: playhead ?? previous?.playhead ?? 0,
    };
    this.open_.set(path, entry);

    for (const l of lanes) {
      if (l.lane.kind !== "bbcso" || !l.stateKey || !l.state) continue;
      if (!existsSync(statePath(l.stateKey))) {
        mkdirSync(dirname(statePath(l.stateKey)), { recursive: true });
        writeFileSync(statePath(l.stateKey), encodeState(l.state));
      }
      this.instrumentOf.set(l.stateKey, l.lane.instrument);
      const known = this.probes.get(l.stateKey) ?? new Map<number, Probe>();
      for (const probe of l.probes ?? [])
        if (!known.has(probe.keyswitch)) known.set(probe.keyswitch, probe);
      this.probes.set(l.stateKey, known);
    }
    await Promise.all(
      [...entry.keys].map(async (key) => {
        if (this.frames.has(key)) return;
        const frames = await chunkFrames(key);
        if (frames !== undefined) this.frames.set(key, frames);
      }),
    );
    // A new version is a new chance for chunks that failed before.
    for (const key of entry.keys) this.failures.delete(key);

    this.refreshWork();
    this.place();
    void this.renderSamples();
    this.rebuild();
    if (this.needsPrepare()) void this.prepare();
    else this.kick();
    this.changed();
    return this.manifest(entry);
  }

  close(path: string): void {
    this.open_.delete(path);
    this.refreshWork();
    this.place();
    this.rebuild();
  }

  manifest(entry: Open | string): Manifest {
    const o = typeof entry === "string" ? this.open_.get(entry) : entry;
    if (!o) throw new Error(`Not open: ${typeof entry === "string" ? entry : entry.path}`);
    return {
      version: o.version,
      duration: o.plan.duration,
      measures: o.plan.measures,
      parts: o.parts,
      chunks: o.places.map((pl) => [
        pl.key,
        pl.part,
        Math.round(pl.origin * 1e6) / 1e6,
        pl.gain,
        pl.frames,
        pl.tailMax,
      ]),
      warnings: o.plan.warnings,
    };
  }

  status(path: string): Status {
    const o = this.open_.get(path);
    if (!o) throw new Error(`Not open: ${path}`);
    let done = 0;
    let failed = 0;
    const frames = o.places.map((pl) => {
      const f = this.frames.get(pl.key);
      if (f !== undefined) {
        done++;
        return f;
      }
      if (this.failures.has(pl.key)) {
        failed++;
        return -2;
      }
      return -1;
    });
    const inUse = new Set(this.required.flatMap((r) => [...r]));
    const notices = [...this.unavailable]
      .filter(([state]) => inUse.has(state))
      .map(([state, why]) => `${this.instrumentOf.get(state) ?? state}: ${why}`);
    if (this.storeNotice) notices.push(this.storeNotice);
    return {
      version: o.version,
      serial: this.serial,
      frames,
      done,
      total: o.places.length,
      failed,
      notices,
    };
  }

  /** A score's version and the status serial: enough to tell whether the page is behind. */
  stamp(path: string): { version: number; serial: number } | undefined {
    const o = this.open_.get(path);
    return o && { version: o.version, serial: this.serial };
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

  failureOf(key: string): string | undefined {
    return this.failures.get(key);
  }

  setPlayhead(path: string, seconds: number): void {
    const o = this.open_.get(path);
    if (!o) return;
    o.playhead = seconds;
    this.rebuild();
    this.kick();
  }

  progress(path: string): Progress {
    const o = this.open_.get(path);
    if (!o) return { done: 0, total: 0, failed: 0 };
    let done = 0;
    let failed = 0;
    for (const k of o.keys)
      if (this.frames.has(k)) done++;
      else if (this.failures.has(k)) failed++;
    return { done, total: o.keys.size, failed };
  }

  /** Resolves when every chunk of the score is rendered (or failed). */
  async whenDone(path: string): Promise<Progress> {
    for (;;) {
      const p = this.progress(path);
      if (p.done + p.failed >= p.total) return p;
      await sleep(50);
    }
  }

  /** Memory of all host processes, as they last reported it (MB). */
  memoryMB(): number {
    return this.hosts.reduce((n, h) => n + h.mb, 0);
  }

  /** Which processes each instrument is placed on (for measuring). */
  placement(): Map<string, number[]> {
    return new Map(this.homes);
  }

  stop(): void {
    this.stopped = true;
    for (const h of this.hosts) h.stop();
  }

  //============================================================================
  // Work and placement

  /** Work is every chunk the open scores need that is neither stored nor failed. */
  private refreshWork(): void {
    const needed = new Map<string, Chunk>();
    for (const o of this.open_.values())
      for (const l of o.lanes)
        for (const c of l.chunks)
          if (!this.frames.has(c.key) && !this.failures.has(c.key)) needed.set(c.key, c);
    for (const key of this.work.keys())
      if (!needed.has(key) && !this.inFlight.has(key)) this.work.delete(key);
    for (const [key, chunk] of needed)
      if (!this.work.has(key)) this.work.set(key, { chunk, tries: 0, notBefore: 0 });
  }

  /**
   * Places instruments on processes. Placed instruments stay; new ones go where there is least
   * work, the heaviest on several processes (so that none carries more than its share). Each
   * process must then hold exactly the states of the instruments placed on it.
   */
  private place(): void {
    const weight = new Map<string, number>();
    this.statesOf = new Map();
    for (const o of this.open_.values())
      for (const l of o.lanes) {
        if (l.lane.kind !== "bbcso" || !l.stateKey) continue;
        const inst = l.lane.instrument;
        this.statesOf.set(inst, (this.statesOf.get(inst) ?? new Set()).add(l.stateKey));
        weight.set(
          inst,
          (weight.get(inst) ?? 0) + l.chunks.reduce((n, c) => n + c.frames / sampleRate, 0),
        );
      }
    for (const inst of [...this.homes.keys()]) if (!weight.has(inst)) this.homes.delete(inst);
    const n = this.hosts.length;
    const total = [...weight.values()].reduce((a, b) => a + b, 0) || 1;
    const load = Array.from({ length: n }, () => 0);
    for (const [inst, procs] of this.homes)
      for (const i of procs) load[i]! += weight.get(inst)! / procs.length;
    const fresh = [...weight.keys()]
      .filter((inst) => !this.homes.has(inst))
      .sort((a, b) => weight.get(b)! - weight.get(a)!);
    for (const inst of fresh) {
      const copies = Math.min(n, Math.max(1, Math.ceil((weight.get(inst)! * n) / total - 1e-9)));
      const chosen = [...load.keys()].sort((a, b) => load[a]! - load[b]!).slice(0, copies);
      for (const i of chosen) load[i]! += weight.get(inst)! / copies;
      this.homes.set(inst, chosen);
    }
    this.required = Array.from({ length: n }, () => new Set<string>());
    for (const [inst, procs] of this.homes)
      for (const i of procs) for (const s of this.statesOf.get(inst)!) this.required[i]!.add(s);
  }

  /** States a process should hold now (those that could not be loaded are left out). */
  private wanted(i: number): Set<string> {
    return new Set([...this.required[i]!].filter((s) => !this.unavailable.has(s)));
  }

  private needsPrepare(): boolean {
    return this.hosts.some((h, i) => !sameSet(h.loaded, this.wanted(i)));
  }

  /** Brings every process to its states. Nothing renders meanwhile. */
  private prepare(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.preparing) {
      this.prepareAgain = true;
      return this.preparing;
    }
    this.preparing = (async () => {
      do {
        this.prepareAgain = false;
        await this.drained();
        if (this.stopped) return;
        const changed = this.hosts
          .map((_, i) => i)
          .filter((i) => !sameSet(this.hosts[i]!.loaded, this.wanted(i)));
        if (!changed.length) continue;
        for (const i of changed) this.hosts[i]!.stop();
        // Everything loads first, on all processes at once; then each state has to sound.
        await Promise.all(changed.map((i) => this.loadAll(i)));
        await Promise.all(changed.map((i) => this.probeAll(i)));
        this.failUnavailable();
      } while (!this.stopped && (this.prepareAgain || this.needsPrepare()));
    })().finally(() => {
      this.preparing = undefined;
      this.rebuild();
      this.kick();
      this.changed();
    });
    return this.preparing;
  }

  private async loadAll(i: number): Promise<void> {
    const host = this.hosts[i]!;
    for (const state of this.wanted(i)) {
      if (this.stopped) return;
      if (this.memoryMB() > this.options.memoryMB) {
        this.unavailable.set(
          state,
          `ホストのメモリが上限（${this.options.memoryMB} MB）に達したので読み込まなかった`,
        );
        continue;
      }
      try {
        const seconds = await host.load(state, statePath(state), pluginPath, loadTimeoutMs);
        this.loaded?.(state, seconds);
      } catch (e) {
        this.unavailable.set(state, `読み込めなかった（${message(e)}）`);
        if (!host.running) return;
      }
    }
  }

  /** Plays each loaded state's test notes until all sound (or gives the state up). */
  private async probeAll(i: number): Promise<void> {
    const host = this.hosts[i]!;
    for (const state of [...host.loaded]) {
      if (this.stopped) return;
      let left = [...(this.probes.get(state)?.values() ?? [])];
      const deadline = Date.now() + probeDeadlineMs;
      while (left.length && host.running) {
        const jobs = left.map((p, n) =>
          probeJob(p, join(this.scratch, `probe-${i}-${n}.tkch`), `probe-${n}`),
        );
        let results: ChunkResult[];
        try {
          results = await host.render(state, statePath(state), pluginPath, jobs, renderTimeoutMs);
        } catch (e) {
          this.unavailable.set(state, `試し音を鳴らせなかった（${message(e)}）`);
          break;
        }
        left = left.filter((_, n) => {
          const r = results[n];
          return !r || r.frames === 0 || r.silentOnsets.length > 0;
        });
        if (left.length && Date.now() > deadline) {
          this.unavailable.set(
            state,
            `読み込んで ${probeDeadlineMs / 1000} 秒たっても鳴らない奏法がある`,
          );
          break;
        }
        if (left.length) await sleep(500);
      }
      await Promise.all(
        Array.from({ length: this.probes.get(state)?.size ?? 0 }, (_, n) =>
          rm(join(this.scratch, `probe-${i}-${n}.tkch`), { force: true }),
        ),
      );
    }
  }

  /** Chunks of states that could not be loaded fail at once. */
  private failUnavailable(): void {
    if (this.unavailable.size === 0) return;
    for (const [key, w] of this.work) {
      if (w.chunk.kind !== "bbcso" || this.inFlight.has(key)) continue;
      const why = this.unavailable.get(w.chunk.stateKey);
      if (!why) continue;
      this.fail(key, why);
    }
  }

  private drained(): Promise<void> {
    if (this.inFlight.size === 0) return Promise.resolve();
    return new Promise((resolve) => this.drainWaiters.push(resolve));
  }

  /** Sorts each process's work by urgency (after an edit or a playhead move). */
  private rebuild(): void {
    this.failUnavailable();
    const urgency = new Map<string, number>();
    for (const o of this.open_.values())
      for (const pl of o.places) {
        if (!this.work.has(pl.key)) continue;
        const u = urgencyOf(pl, o.playhead);
        if (u < (urgency.get(pl.key) ?? Infinity)) urgency.set(pl.key, u);
      }
    const byState = new Map<string, string[]>();
    for (const [key, w] of this.work) {
      if (w.chunk.kind !== "bbcso") continue;
      const list = byState.get(w.chunk.stateKey) ?? [];
      list.push(key);
      byState.set(w.chunk.stateKey, list);
    }
    this.queues = this.required.map((states) =>
      [...states]
        .flatMap((s) => byState.get(s) ?? [])
        .sort((a, b) => urgency.get(a)! - urgency.get(b)!),
    );
    this.cursors = this.queues.map(() => 0);
  }

  /** The most urgent chunk process `i` can render now. */
  private next(i: number): string | undefined {
    const queue = this.queues[i]!;
    const now = Date.now();
    let cursor = this.cursors[i]!;
    for (let at = cursor; at < queue.length; at++) {
      const key = queue[at]!;
      const w = this.work.get(key);
      if (!w) {
        // Done or failed: never needed again in this order.
        if (at === cursor) cursor++;
        continue;
      }
      if (this.inFlight.has(key) || w.notBefore > now) continue;
      this.cursors[i] = cursor;
      return key;
    }
    this.cursors[i] = cursor;
    return undefined;
  }

  private kick(): void {
    if (this.stopped) return;
    for (let i = 0; i < this.hosts.length; i++) void this.drive(i);
  }

  private async drive(i: number): Promise<void> {
    if (this.stopped || this.driving[i] || this.preparing) return;
    this.driving[i] = true;
    const host = this.hosts[i]!;
    try {
      while (!this.stopped && !this.preparing) {
        const key = this.next(i);
        if (!key) break;
        const w = this.work.get(key)!;
        const chunk = w.chunk as BbcsoChunk;
        if (this.unavailable.has(chunk.stateKey)) {
          this.failUnavailable();
          continue;
        }
        if (!host.loaded.has(chunk.stateKey)) {
          // The process died or never got this state: load again (nothing renders meanwhile).
          void this.prepare();
          break;
        }
        this.inFlight.add(key);
        const output = join(this.scratch, `${key}.tkch`);
        try {
          const [r] = await host.render(
            chunk.stateKey,
            statePath(chunk.stateKey),
            pluginPath,
            [jobOf(chunk, output)],
            renderTimeoutMs,
          );
          await this.settle(key, w, chunk, r!, output);
        } catch (e) {
          await rm(output, { force: true });
          this.retry(key, w, message(e));
          if (!host.running) void this.prepare();
        } finally {
          this.inFlight.delete(key);
          if (this.inFlight.size === 0) for (const done of this.drainWaiters.splice(0)) done();
        }
      }
    } finally {
      this.driving[i] = false;
    }
  }

  /** Stores a rendered chunk if every onset that should sound did; otherwise tries again. */
  private async settle(
    key: string,
    w: Work,
    chunk: BbcsoChunk,
    r: ChunkResult,
    output: string,
  ): Promise<void> {
    const should = new Set(chunk.shouldSound);
    const silent = r.frames === 0 ? chunk.shouldSound : r.silentOnsets.filter((f) => should.has(f));
    if (silent.length) {
      await rm(output, { force: true });
      this.retry(key, w, `鳴るはずの音が ${silent.length} 音、無音だった`);
      return;
    }
    await mkdir(dirname(chunkPath(key)), { recursive: true });
    await rename(output, chunkPath(key));
    this.finish(key, r.frames);
  }

  private retry(key: string, w: Work, why: string): void {
    this.onRetry?.(key, why);
    w.tries++;
    if (w.tries >= maxTries) {
      this.fail(key, why);
      return;
    }
    w.notBefore = Date.now() + retryDelayMs;
    // The key may sit behind a cursor now; cursors skip done keys again cheaply.
    this.cursors = this.cursors.map(() => 0);
    setTimeout(() => this.kick(), retryDelayMs + 10).unref();
  }

  private finish(key: string, frames: number): void {
    this.work.delete(key);
    this.frames.set(key, frames);
    this.onChunk?.(key, true);
    this.changed();
  }

  private fail(key: string, why: string): void {
    this.work.delete(key);
    this.failures.set(key, why);
    this.onChunk?.(key, false);
    this.changed();
  }

  //============================================================================
  // Status

  private statusTimer?: ReturnType<typeof setTimeout>;

  private changed(): void {
    this.serial++;
    this.statusTimer ??= setTimeout(() => {
      this.statusTimer = undefined;
      for (const path of this.open_.keys()) this.onStatus?.(path);
      if (this.work.size === 0 && this.inFlight.size === 0) void this.trim();
    }, 200);
  }

  private trimming = false;
  private lastTrim = 0;
  /**
   * Keeps the store under its limit, at most once a minute. The chunks of the open scores and of
   * their previous versions stay; if they alone are over the limit, that is reported.
   */
  private async trim(): Promise<void> {
    if (this.trimming || Date.now() - this.lastTrim < 60_000) return;
    this.trimming = true;
    this.lastTrim = Date.now();
    try {
      const keep = new Set<string>();
      for (const o of this.open_.values()) for (const k of [...o.keys, ...o.previous]) keep.add(k);
      const { bytes } = await trimStore(keep);
      const notice =
        bytes > storeLimit
          ? `保存場所が上限を超えている（${(bytes / 1e9).toFixed(0)} GB。開いている楽譜の今と直前の版だけでこの大きさ。TAKEMITSU_CHUNKS_GB で上げられる）`
          : undefined;
      if (notice !== this.storeNotice) {
        this.storeNotice = notice;
        this.changed();
      }
    } finally {
      this.trimming = false;
    }
  }

  //============================================================================
  // User samples (mixed here, not in a host)

  private samples = new Map<string, Audio>();
  private samplesRunning = false;

  private async renderSamples(): Promise<void> {
    if (this.stopped || this.samplesRunning) return;
    this.samplesRunning = true;
    try {
      for (;;) {
        const next = [...this.work].find(([, w]) => w.chunk.kind === "samples");
        if (!next) break;
        const [key, w] = next;
        const c = w.chunk as SampleChunk;
        try {
          const bytes = await this.mixSamples(c);
          const output = join(this.scratch, `${key}.tkch`);
          await writeFile(output, bytes);
          await mkdir(dirname(chunkPath(key)), { recursive: true });
          await rename(output, chunkPath(key));
          this.finish(key, (bytes.length - 24) / 4);
        } catch (e) {
          this.fail(key, message(e));
        }
      }
    } finally {
      this.samplesRunning = false;
    }
  }

  private async mixSamples(c: SampleChunk): Promise<Uint8Array> {
    let length = c.frames;
    const sources: { audio: Audio; hit: SampleChunk["hits"][number] }[] = [];
    for (const hit of c.hits) {
      const file = pick(c.files, hit.seed);
      // By content: a file replaced at the same path is read again.
      const id = fileHash(file);
      let audio = this.samples.get(id);
      if (!audio) {
        audio = await readWav(file);
        this.samples.set(id, audio);
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
    return encodeChunk(sampleRate, left, right);
  }
}

/** Deterministic pick among the files for a hit (the note's index is the seed). */
const pick = (files: string[], seed: number) =>
  files[Math.abs(Math.imul(seed + 1, 2654435761)) % files.length]!;

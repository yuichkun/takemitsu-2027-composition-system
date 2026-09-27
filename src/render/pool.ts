// A pool of host processes in serve mode (native/host, `serve`).
//
// Each process keeps the plugin instances it has loaded. The pool asks a work source for the
// next batch, preferring a state the process already has, so loading (about 1 s per instance)
// happens once per state and process. A process that grows past its memory share is replaced
// after its batch: instances are never unloaded one by one, because BBC SO can hang while being
// destroyed.
//
// Requests are complete ("this state, these events"): a process that dies or is replaced loses
// nothing but its loaded instances, and a batch can simply be sent again.

import { spawn, execFile, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

import { hostBinary } from "./host.ts";

export interface ChunkRequest {
  id: string;
  frames: number;
  tailMax: number;
  events: number[][];
  output: string;
}

export interface Batch {
  stateKey: string;
  stateFile: string;
  plugin: string;
  chunks: ChunkRequest[];
}

export interface WorkSource {
  /**
   * The next batch for a process that has `loaded` states, or undefined when there is none for
   * it. `elsewhere` are states loaded in other processes, `idleElsewhere` those in idle ones
   * (which will be asked next, so their states are better left to them).
   */
  take(
    loaded: ReadonlySet<string>,
    elsewhere: ReadonlySet<string>,
    idleElsewhere: ReadonlySet<string>,
  ): Batch | undefined;
  /** Whether any work is left (taken or not). The pool drops a source once this is false. */
  pending(): boolean;
  /** A chunk is on disk. */
  rendered(id: string, frames: number, seconds: number): void;
  /** A batch failed; its unrendered chunks can be taken again (or given up). */
  failed(batch: Batch, error: string): void;
  /** A state finished loading in a process. */
  loaded?(stateKey: string, seconds: number): void;
}

export interface PoolOptions {
  processes: number;
  /**
   * Memory for all processes together. Before a process loads another instance past it, the
   * process used longest ago is replaced (its instances are lost; they load again when needed).
   */
  memoryMB: number;
  /** A single process above this is replaced after its batch. */
  processMemoryMB: number;
  /** Keep processes (and their instances) when there is no work. */
  resident: boolean;
}

export const defaultPoolOptions: PoolOptions = {
  processes: Number(process.env.TAKEMITSU_HOSTS ?? 8),
  memoryMB: Number(process.env.TAKEMITSU_HOSTS_MB ?? 12000),
  processMemoryMB: Number(process.env.TAKEMITSU_HOST_MB ?? 6000),
  resident: process.env.TAKEMITSU_RESIDENT !== "0",
};

/** Room kept for one more instance (a BBC SO instance with many articulations is about 1.2 GB). */
const instanceMB = 1300;

let nextRequest = 0;

class HostProcess {
  readonly loaded = new Set<string>();
  busy = false;
  /** Resident size as last measured (MB), and when the process last finished a batch. */
  mb = 0;
  lastUsed = 0;
  private child?: ChildProcessWithoutNullStreams;
  private pending = new Map<
    string,
    { resolve: () => void; reject: (e: Error) => void; source: WorkSource }
  >();

  private start(): ChildProcessWithoutNullStreams {
    const child = spawn(hostBinary(), ["serve"], { stdio: ["pipe", "pipe", "pipe"] });
    // Requests belong to the process they were sent to; a replaced process fails only its own.
    const pending = new Map<
      string,
      { resolve: () => void; reject: (e: Error) => void; source: WorkSource }
    >();
    this.pending = pending;
    child.stderr.resume();
    createInterface({ input: child.stdout }).on("line", (line) => {
      if (!line.startsWith("{")) return;
      let m: { event: string; data: Record<string, unknown> };
      try {
        m = JSON.parse(line) as typeof m;
      } catch {
        return;
      }
      const [first] = pending.values();
      if (m.event === "chunk") {
        first?.source.rendered(String(m.data.id), Number(m.data.frames), Number(m.data.seconds));
      } else if (m.event === "loaded") {
        this.loaded.add(String(m.data.key));
        first?.source.loaded?.(String(m.data.key), Number(m.data.seconds));
      } else if (m.event === "done" || m.event === "error") {
        const id = String(m.data.id);
        const waiter = pending.get(id);
        pending.delete(id);
        if (m.event === "done") waiter?.resolve();
        else waiter?.reject(new Error(String(m.data.message)));
      }
    });
    child.on("exit", () => {
      if (this.child === child) {
        this.child = undefined;
        this.loaded.clear();
      }
      for (const w of pending.values()) w.reject(new Error("Host process exited"));
      pending.clear();
    });
    child.on("error", () => undefined);
    return child;
  }

  run(batch: Batch, source: WorkSource): Promise<void> {
    this.child ??= this.start();
    const id = `b${nextRequest++}`;
    const request = {
      op: "render",
      id,
      plugin: batch.plugin,
      key: batch.stateKey,
      state: batch.stateFile,
      chunks: batch.chunks,
    };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, source });
      this.child!.stdin.write(`${JSON.stringify(request)}\n`);
    });
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  /** Resident memory in MB (0 if not running). */
  memory(): Promise<number> {
    const pid = this.pid;
    if (!pid) return Promise.resolve(0);
    return new Promise((resolve) =>
      execFile("ps", ["-o", "rss=", "-p", String(pid)], (err, out) =>
        resolve(err ? 0 : Number(out.trim()) / 1024),
      ),
    );
  }

  stop(): void {
    const child = this.child;
    this.child = undefined;
    this.loaded.clear();
    this.mb = 0;
    child?.kill("SIGKILL");
  }
}

export class HostPool {
  private readonly hosts: HostProcess[];
  private readonly options: PoolOptions;
  private sources = new Set<WorkSource>();

  constructor(options: Partial<PoolOptions> = {}) {
    this.options = { ...defaultPoolOptions, ...options };
    this.hosts = Array.from({ length: this.options.processes }, () => new HostProcess());
    // Hosts also leave when their stdin closes, but do not wait for that.
    process.once("exit", () => this.stop());
  }

  /** Adds a source of work (or wakes the pool after its work changed). */
  kick(source: WorkSource): void {
    this.sources.add(source);
    // Processes with instances loaded first: they are the ones the work probably wants.
    const idle = this.hosts.filter((h) => !h.busy).sort((a, b) => b.loaded.size - a.loaded.size);
    for (const host of idle) void this.drive(host);
  }

  /** Resident memory of all processes, in MB. */
  async memory(): Promise<number> {
    const each = await Promise.all(this.hosts.map((h) => h.memory()));
    return each.reduce((a, b) => a + b, 0);
  }

  get size(): number {
    return this.hosts.length;
  }

  get busy(): boolean {
    return this.hosts.some((h) => h.busy);
  }

  stop(): void {
    for (const h of this.hosts) h.stop();
  }

  /** Before `host` loads another instance: stay under the memory budget. */
  private makeRoom(host: HostProcess): void {
    const total = () => this.hosts.reduce((n, h) => n + h.mb, 0);
    const idle = this.hosts
      .filter((h) => h !== host && !h.busy && h.mb > 0)
      .sort((a, b) => a.lastUsed - b.lastUsed);
    for (const h of idle) {
      if (total() + instanceMB <= this.options.memoryMB) return;
      h.stop();
    }
    if (total() + instanceMB > this.options.memoryMB) host.stop();
  }

  private async drive(host: HostProcess): Promise<void> {
    if (host.busy) return;
    host.busy = true;
    try {
      for (;;) {
        const elsewhere = new Set<string>();
        const idleElsewhere = new Set<string>();
        for (const other of this.hosts)
          if (other !== host)
            for (const k of other.loaded) {
              elsewhere.add(k);
              if (!other.busy) idleElsewhere.add(k);
            }
        let batch: Batch | undefined;
        let source: WorkSource | undefined;
        for (const s of this.sources) {
          batch = s.take(host.loaded, elsewhere, idleElsewhere);
          if (batch) {
            source = s;
            break;
          }
          if (!s.pending()) this.sources.delete(s);
        }
        if (!batch || !source) break;
        if (!host.loaded.has(batch.stateKey)) this.makeRoom(host);
        try {
          await host.run(batch, source);
        } catch (e) {
          source.failed(batch, e instanceof Error ? e.message : String(e));
        }
        host.mb = await host.memory();
        host.lastUsed = Date.now();
        if (host.mb > this.options.processMemoryMB) host.stop();
      }
    } finally {
      host.busy = false;
    }
    if (!this.options.resident && !this.busy) this.stop();
  }
}

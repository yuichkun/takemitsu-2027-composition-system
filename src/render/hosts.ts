// One host process in serve mode (native/host `serve`), holding the plugin states it was told to
// load. What a process holds and what it renders next is decided by the engine
// (src/performance/engine.ts, docs/decisions/0019); this file only talks to the process.
//
// Requests are complete ("this state, these events"): a process that dies or is killed loses
// nothing but its loaded instances, and a request can simply be sent again. Instances are never
// unloaded one by one (BBC SO can hang while being destroyed): the whole process is stopped.

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

import { hostBinary } from "./host.ts";

export interface ChunkJob {
  id: string;
  frames: number;
  tailMax: number;
  events: number[][];
  output: string;
}

export interface ChunkResult {
  id: string;
  /** Frames written (0 when the chunk came out silent). */
  frames: number;
  /** Frames of note-ons whose first 250 ms stayed silent. */
  silentOnsets: number[];
  seconds: number;
}

interface Waiting {
  id: string;
  results: ChunkResult[];
  loadSeconds?: number;
  resolve: (r: { results: ChunkResult[]; loadSeconds?: number }) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let nextRequest = 0;

export class HostProcess {
  /** States loaded in the running process. */
  readonly loaded = new Set<string>();
  /** Memory footprint in MB, as the process last reported it (0 when not running). */
  mb = 0;
  private child?: ChildProcessWithoutNullStreams;
  private waiting?: Waiting;

  get running(): boolean {
    return this.child !== undefined;
  }

  private start(): ChildProcessWithoutNullStreams {
    const child = spawn(hostBinary(), ["serve"], { stdio: ["pipe", "pipe", "pipe"] });
    child.stderr.resume();
    createInterface({ input: child.stdout }).on("line", (line) => {
      if (!line.startsWith("{") || this.child !== child) return;
      let m: { event: string; data: Record<string, unknown> };
      try {
        m = JSON.parse(line) as typeof m;
      } catch {
        return;
      }
      const w = this.waiting;
      if (!w) return;
      if (m.event === "loaded") {
        this.loaded.add(String(m.data.key));
        w.loadSeconds = Number(m.data.seconds);
      } else if (m.event === "chunk") {
        w.results.push({
          id: String(m.data.id),
          frames: Number(m.data.frames),
          silentOnsets: (m.data.silentOnsets as number[] | undefined) ?? [],
          seconds: Number(m.data.seconds),
        });
      } else if (m.data.id === w.id && (m.event === "done" || m.event === "error")) {
        this.waiting = undefined;
        clearTimeout(w.timer);
        if (m.event === "done") {
          if (typeof m.data.mb === "number") this.mb = m.data.mb;
          w.resolve({ results: w.results, loadSeconds: w.loadSeconds });
        } else w.reject(new Error(String(m.data.message)));
      }
    });
    child.on("exit", () => {
      if (this.child !== child) return;
      this.forget(new Error("Host process exited"));
    });
    child.on("error", () => undefined);
    return child;
  }

  /** Sends one request (one at a time per process) and waits for it to finish. */
  private request(
    stateKey: string,
    stateFile: string,
    plugin: string,
    chunks: ChunkJob[],
    timeoutMs: number,
  ): Promise<{ results: ChunkResult[]; loadSeconds?: number }> {
    if (this.waiting) throw new Error("A request is already running on this host");
    this.child ??= this.start();
    const id = `r${nextRequest++}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // Stuck (BBC SO can hang): stop the process; the engine starts it again with its states.
        this.stop();
        reject(new Error(`Host did not answer within ${Math.round(timeoutMs / 1000)} s`));
      }, timeoutMs);
      this.waiting = { id, results: [], resolve, reject, timer };
      this.child!.stdin.write(
        `${JSON.stringify({ op: "render", id, plugin, key: stateKey, state: stateFile, chunks })}\n`,
      );
    });
  }

  /** Loads a state (a request with nothing to render). Returns the load time in seconds. */
  async load(stateKey: string, stateFile: string, plugin: string, timeoutMs: number) {
    const r = await this.request(stateKey, stateFile, plugin, [], timeoutMs);
    return r.loadSeconds ?? 0;
  }

  async render(
    stateKey: string,
    stateFile: string,
    plugin: string,
    chunks: ChunkJob[],
    timeoutMs: number,
  ): Promise<ChunkResult[]> {
    return (await this.request(stateKey, stateFile, plugin, chunks, timeoutMs)).results;
  }

  private forget(error: Error): void {
    this.child = undefined;
    this.loaded.clear();
    this.mb = 0;
    const w = this.waiting;
    this.waiting = undefined;
    if (w) {
      clearTimeout(w.timer);
      w.reject(error);
    }
  }

  stop(): void {
    const child = this.child;
    if (!child) return;
    this.forget(new Error("Host process stopped"));
    child.kill("SIGKILL");
  }
}

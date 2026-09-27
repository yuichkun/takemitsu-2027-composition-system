// The score on screen, drawn in windows: short MusicXML documents of a few measures each
// (src/notation/musicxml.ts, musicXmlWindows). Windows are drawn by Verovio in workers
// (src/preview/notation-worker.ts), only when they come near the visible area, and kept by
// content hash: after an edit, only windows whose MusicXML changed are drawn again. So a long
// score opens and redraws as fast as a short one.
//
// Also shows the playhead, colours the sounding notes, and turns clicks and drags of the
// playhead into seeks.
//
// Time ↔ position: each measure maps its left edge, its notes and its right edge to times
// (notes from Verovio's timing, edges from the score's measure times) and interpolates between.

import type { DrawRequest, DrawResult } from "./notation-worker.ts";

export interface MeasureTime {
  number: number;
  seconds: number;
  endSeconds: number;
}

export interface WindowInfo {
  /** Measure numbers, inclusive. */
  from: number;
  to: number;
  /** Hash of the window's MusicXML. */
  hash: string;
}

interface Geometry {
  number: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** (x, seconds) pairs from left to right. */
  anchors: [number, number][];
}

interface Block {
  info: WindowInfo;
  el: HTMLDivElement;
  state: "waiting" | "drawing" | "drawn";
  /** Width the block was drawn for. */
  width: number;
  /** [note id, onset s, release s], in piece time. */
  notes: [string, number, number][];
  /** Measured once the block is laid out. */
  geometry: Geometry[];
  measuredWidth: number;
}

const interpolate = (pairs: [number, number][], x: number): number => {
  if (x <= pairs[0]![0]) return pairs[0]![1];
  for (let i = 1; i < pairs.length; i++) {
    const [x0, y0] = pairs[i - 1]!;
    const [x1, y1] = pairs[i]!;
    if (x <= x1) return x1 === x0 ? y1 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return pairs.at(-1)![1];
};

interface Drawing {
  svg: string;
  /** [note id, onset ms, release ms] from the window's start. */
  notes: [string, number, number][];
  bytes: number;
}

/** Drawings by hash and width, so scrolling back or undoing an edit does not draw again. */
const drawings = new Map<string, Drawing>();
const drawingsLimit = 200e6;
/** Drawn windows kept in the page; beyond this, those furthest from the playhead are put away. */
const drawnLimit = 32;
function remember(key: string, value: Drawing): void {
  drawings.delete(key);
  drawings.set(key, value);
  let total = 0;
  for (const v of drawings.values()) total += v.bytes;
  for (const [k, v] of drawings) {
    if (total <= drawingsLimit) break;
    drawings.delete(k);
    total -= v.bytes;
  }
}

/**
 * A few workers drawing windows; urgent requests (the visible ones) jump the queue. Verovio's
 * WebAssembly memory grows with the densest window it has drawn and never shrinks, so each
 * worker is replaced after `drawsPerWorker` drawings.
 */
const drawsPerWorker = 12;
class Workers {
  private idle: { worker: Worker; draws: number }[] = [];
  private waiting = new Map<number, (r: DrawResult) => void>();
  private next = 0;
  private queue: { request: Omit<DrawRequest, "id">; resolve: (r: DrawResult) => void }[] = [];

  constructor(count: number) {
    for (let i = 0; i < count; i++) this.idle.push(this.spawn());
  }

  private spawn(): { worker: Worker; draws: number } {
    const entry = {
      worker: new Worker(new URL("./notation-worker.ts", import.meta.url), { type: "module" }),
      draws: 0,
    };
    entry.worker.onmessage = (e: MessageEvent<DrawResult>) => {
      this.waiting.get(e.data.id)?.(e.data);
      this.waiting.delete(e.data.id);
      if (++entry.draws >= drawsPerWorker) {
        entry.worker.terminate();
        this.idle.push(this.spawn());
      } else this.idle.push(entry);
      this.pump();
    };
    return entry;
  }

  draw(request: Omit<DrawRequest, "id">, urgent: boolean): Promise<DrawResult> {
    return new Promise((resolve) => {
      if (urgent) this.queue.unshift({ request, resolve });
      else this.queue.push({ request, resolve });
      this.pump();
    });
  }

  private pump(): void {
    while (this.idle.length && this.queue.length) {
      const { worker } = this.idle.pop()!;
      const { request, resolve } = this.queue.shift()!;
      const id = this.next++;
      this.waiting.set(id, resolve);
      worker.postMessage({ ...request, id } satisfies DrawRequest);
    }
  }
}

export class ScoreView {
  onSeek?: (seconds: number) => void;

  private measures: MeasureTime[] = [];
  private blocks: Block[] = [];
  private playhead = document.createElement("div");
  private highlighted: Element[] = [];
  private cursor = 0;
  private readonly workers = new Workers(2);
  private readonly observer: IntersectionObserver;

  private readonly container: HTMLElement;
  private readonly fetchXml: (hash: string) => Promise<string>;

  constructor(container: HTMLElement, fetchXml: (hash: string) => Promise<string>) {
    this.container = container;
    this.fetchXml = fetchXml;
    this.playhead.className = "playhead";
    this.playhead.title = "ドラッグで再生位置を動かす";
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const block = this.blocks.find((b) => b.el === e.target);
          if (block) void this.drawBlock(block, true);
        }
      },
      { root: container, rootMargin: "800px 0px" },
    );
    this.bindPointer();
  }

  private width(): number {
    return Math.max(800, this.container.clientWidth - 40);
  }

  /** Shows a score as windows. Windows with the same hash as before keep their drawing. */
  draw(windows: WindowInfo[], measures: MeasureTime[]): void {
    this.measures = measures;
    const width = this.width();
    const old = new Map(this.blocks.map((b) => [b.info.hash, b]));
    const estimate = this.typicalHeight();
    const blocks = windows.map((info): Block => {
      const kept = old.get(info.hash);
      if (kept && kept.width === width) {
        old.delete(info.hash);
        kept.info = info;
        kept.measuredWidth = 0;
        return kept;
      }
      const el = document.createElement("div");
      el.className = "window waiting";
      el.style.minHeight = `${estimate}px`;
      el.dataset.label = info.from === info.to ? `${info.from}` : `${info.from}–${info.to}`;
      return { info, el, state: "waiting", width, notes: [], geometry: [], measuredWidth: 0 };
    });
    for (const b of old.values()) {
      this.observer.unobserve(b.el);
      b.el.remove();
    }
    this.container.querySelector(".empty")?.remove();
    // Put the elements in order, moving kept ones rather than rebuilding them.
    blocks.forEach((b, i) => {
      const at = this.container.children[i];
      if (at !== b.el) this.container.insertBefore(b.el, at ?? null);
    });
    this.blocks = blocks;
    for (const b of blocks) this.observer.observe(b.el);
    this.setCursor(this.cursor);
  }

  /** Draws everything again (the width changed). */
  redraw(): void {
    const windows = this.blocks.map((b) => b.info);
    for (const b of this.blocks) {
      this.observer.unobserve(b.el);
      b.el.remove();
    }
    this.blocks = [];
    this.draw(windows, this.measures);
  }

  private typicalHeight(): number {
    const heights = this.blocks.filter((b) => b.state === "drawn").map((b) => b.el.offsetHeight);
    return heights.length ? heights.reduce((a, b) => a + b, 0) / heights.length : 400;
  }

  private async drawBlock(block: Block, urgent: boolean): Promise<void> {
    if (block.state !== "waiting") return;
    block.state = "drawing";
    const key = `${block.info.hash}@${block.width}`;
    let drawing = drawings.get(key);
    if (!drawing) {
      const musicxml = await this.fetchXml(block.info.hash);
      const r = await this.workers.draw({ musicxml, width: block.width }, urgent);
      if (r.error) console.warn(`window ${block.el.dataset.label}: ${r.error}`);
      drawing = { svg: r.svg, notes: r.notes, bytes: r.svg.length * 2 };
      remember(key, drawing);
    }
    // Replaced meanwhile by another save: the drawing stays in the cache only.
    if (!this.blocks.includes(block)) return;
    const start = this.measures.find((m) => m.number === block.info.from)?.seconds ?? 0;
    block.el.innerHTML = drawing.svg;
    block.el.classList.remove("waiting");
    block.el.style.minHeight = "";
    block.notes = drawing.notes.map(([id, on, off]) => [id, start + on / 1000, start + off / 1000]);
    block.state = "drawn";
    block.measuredWidth = 0;
    this.putAway(block);
    if (this.blockOf(this.measureAt(this.cursor)) === block) this.setCursor(this.cursor);
  }

  /**
   * Keeps the page light: beyond `drawnLimit` drawn windows, the ones furthest from the playhead
   * and from `fresh` are emptied again, keeping their height (their drawing stays cached).
   */
  private putAway(fresh: Block): void {
    const drawn = this.blocks.filter((b) => b.state === "drawn");
    if (drawn.length <= drawnLimit) return;
    const here = this.blocks.indexOf(this.blockOf(this.measureAt(this.cursor)) ?? fresh);
    const near = this.blocks.indexOf(fresh);
    const distance = (b: Block) => {
      const i = this.blocks.indexOf(b);
      return Math.min(Math.abs(i - here), Math.abs(i - near));
    };
    for (const b of drawn
      .sort((a, b) => distance(b) - distance(a))
      .slice(0, drawn.length - drawnLimit)) {
      b.el.style.minHeight = `${b.el.offsetHeight}px`;
      b.el.innerHTML = "";
      b.el.classList.add("waiting");
      b.state = "waiting";
      b.geometry = [];
      b.measuredWidth = 0;
      if (this.playhead.parentElement === b.el) this.playhead.remove();
      // Observe again: if it is still near the view, it is drawn again.
      this.observer.unobserve(b.el);
      this.observer.observe(b.el);
    }
  }

  private blockOf(measure: number): Block | undefined {
    return this.blocks.find((b) => measure >= b.info.from && measure <= b.info.to);
  }

  /** Measures positions in a drawn block when its layout exists and has changed. */
  private ensureGeometry(block: Block): boolean {
    if (block.state !== "drawn") return false;
    const origin = block.el.getBoundingClientRect();
    if (origin.width === 0) return false;
    if (origin.width === block.measuredWidth) return true;
    block.measuredWidth = origin.width;
    block.geometry = [];
    const times = new Map(this.measures.map((m) => [m.number, m]));
    const onsets = new Map(block.notes.map(([id, on]) => [id, on]));
    for (const g of block.el.querySelectorAll<SVGGElement>("g.measure")) {
      const number = Number(g.dataset.n);
      const t = times.get(number);
      if (!t) continue;
      // The staff lines give the measure's true extent; the group's own box also covers
      // hairpins and text that run into the next measure.
      const lines = [...g.querySelectorAll<SVGPathElement>(":scope > g.staff > path")].map((l) =>
        l.getBoundingClientRect(),
      );
      const r = lines.length
        ? {
            left: Math.min(...lines.map((l) => l.left)),
            right: Math.max(...lines.map((l) => l.right)),
            top: Math.min(...lines.map((l) => l.top)),
            bottom: Math.max(...lines.map((l) => l.bottom)),
          }
        : g.getBoundingClientRect();
      const left = r.left - origin.left;
      const right = r.right - origin.left;
      const anchors: [number, number][] = [];
      for (const note of g.querySelectorAll<SVGGElement>("g.note")) {
        const seconds = onsets.get(note.dataset.id ?? "");
        if (seconds === undefined) continue;
        const nr = note.getBoundingClientRect();
        anchors.push([nr.left + nr.width / 2 - origin.left, seconds]);
      }
      anchors.sort((a, b) => a[0] - b[0]);
      // Keep only anchors that move forward in time, framed by the measure's edges.
      const clean: [number, number][] = [[left, t.seconds]];
      for (const a of anchors) if (a[1] > clean.at(-1)![1] && a[1] < t.endSeconds) clean.push(a);
      if (clean.length > 1 && clean[1]![1] - t.seconds < 1e-3) clean.shift();
      clean.push([right, t.endSeconds]);
      block.geometry.push({
        number,
        left,
        right,
        top: r.top - origin.top,
        bottom: r.bottom - origin.top,
        anchors: clean,
      });
    }
    return true;
  }

  measureAt(seconds: number): number {
    const m =
      this.measures.find((m) => seconds >= m.seconds && seconds < m.endSeconds) ??
      this.measures.at(-1);
    return m?.number ?? 1;
  }

  /** Moves the playhead. With `follow`, scrolls it into view. */
  setCursor(seconds: number, follow = false): void {
    this.cursor = seconds;
    const number = this.measureAt(seconds);
    const block = this.blockOf(number);
    if (!block) {
      this.playhead.remove();
      return;
    }
    if (!this.ensureGeometry(block)) {
      this.playhead.remove();
      if (follow) this.reveal(block.el.getBoundingClientRect());
      if (block.state === "waiting") void this.drawBlock(block, true);
      return;
    }
    const g = block.geometry.find((m) => m.number === number);
    if (!g) {
      this.playhead.remove();
      return;
    }
    const x = interpolate(
      g.anchors.map(([ax, at]) => [at, ax]),
      seconds,
    );
    if (this.playhead.parentElement !== block.el) block.el.append(this.playhead);
    Object.assign(this.playhead.style, {
      left: `${x}px`,
      top: `${g.top - 6}px`,
      height: `${g.bottom - g.top + 12}px`,
    });
    if (follow) this.reveal(this.playhead.getBoundingClientRect());
  }

  /** Scrolls so that a box is in view: its top, when it is taller than the view. */
  private reveal(r: DOMRect): void {
    const box = this.container.getBoundingClientRect();
    const tall = r.height > box.height * 0.8;
    const out = tall
      ? r.top < box.top || r.top > box.bottom - 60
      : r.top < box.top + 20 || r.bottom > box.bottom - 20;
    if (!out) return;
    const top = r.top - box.top - (tall ? 20 : box.height / 3);
    // Far away: jump. Scrolling smoothly would pass (and draw) every window in between.
    this.container.scrollBy({
      top,
      behavior: Math.abs(top) > box.height * 2 ? "instant" : "smooth",
    });
  }

  scrollToTop(): void {
    this.container.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Colours the notes sounding at `seconds` (piece time). Pass undefined to clear. */
  highlight(seconds: number | undefined): void {
    for (const el of this.highlighted) el.classList.remove("playing");
    this.highlighted = [];
    if (seconds === undefined) return;
    const block = this.blockOf(this.measureAt(seconds));
    if (!block || block.state !== "drawn") return;
    for (const [id, on, off] of block.notes) {
      if (seconds < on || seconds >= off) continue;
      const el = block.el.querySelector(`[data-id="${id}"]`);
      if (el) {
        el.classList.add("playing");
        this.highlighted.push(el);
      }
    }
  }

  private hit(e: PointerEvent): { seconds: number } | undefined {
    for (const block of this.blocks) {
      if (block.state !== "drawn") continue;
      const origin = block.el.getBoundingClientRect();
      if (e.clientY < origin.top || e.clientY > origin.bottom) continue;
      if (!this.ensureGeometry(block)) continue;
      const x = e.clientX - origin.left;
      const y = e.clientY - origin.top;
      for (const g of block.geometry)
        if (x >= g.left && x <= g.right && y >= g.top - 10 && y <= g.bottom + 10)
          return { seconds: interpolate(g.anchors, x) };
    }
    return undefined;
  }

  private bindPointer(): void {
    let mode: "none" | "pending" | "scrub" = "none";
    let startX = 0;
    let startY = 0;
    this.container.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      startX = e.clientX;
      startY = e.clientY;
      if (e.target === this.playhead) {
        mode = "scrub";
        this.container.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
      mode = "pending";
    });
    this.container.addEventListener("pointermove", (e) => {
      if (mode === "scrub") {
        const h = this.hit(e);
        if (h) this.onSeek?.(h.seconds);
        return;
      }
      // A drag is not a click (selecting text, scrolling with a trackpad).
      if (mode === "pending" && Math.hypot(e.clientX - startX, e.clientY - startY) > 6)
        mode = "none";
    });
    const end = (e: PointerEvent) => {
      if (mode === "pending") {
        const h = this.hit(e);
        if (h) this.onSeek?.(h.seconds);
      }
      mode = "none";
    };
    this.container.addEventListener("pointerup", end);
    this.container.addEventListener("pointercancel", () => (mode = "none"));
  }
}

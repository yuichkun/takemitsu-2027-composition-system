// The score on screen: draws MusicXML with Verovio, shows the playhead and the render range,
// and turns clicks into seeks and horizontal drags into a measure range.
//
// Time ↔ position: each measure maps its left edge, its notes and its right edge to times
// (notes from Verovio's timing, edges from the score's measure times) and interpolates between.

import type { VerovioToolkit } from "verovio/esm";

export interface MeasureTime {
  number: number;
  seconds: number;
  endSeconds: number;
}

interface Geometry {
  number: number;
  page: HTMLElement;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** (x, seconds) pairs from left to right. */
  anchors: [number, number][];
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

export class ScoreView {
  onSeek?: (seconds: number) => void;
  onRange?: (from: number, to: number) => void;

  private measures: MeasureTime[] = [];
  private geometry: Geometry[] = [];
  private playhead = document.createElement("div");
  private bands: HTMLElement[] = [];
  private highlighted: Element[] = [];
  private cursor = 0;
  private range: [number, number] = [1, 1];
  /** Page width the geometry was measured at; 0 = not measured (e.g. drawn while hidden). */
  private measuredWidth = 0;

  private readonly container: HTMLElement;
  private readonly toolkit: VerovioToolkit;

  constructor(container: HTMLElement, toolkit: VerovioToolkit) {
    this.container = container;
    this.toolkit = toolkit;
    this.playhead.className = "playhead";
    this.playhead.title = "ドラッグで再生位置を動かす";
    this.bindPointer();
  }

  draw(musicxml: string, measures: MeasureTime[]): void {
    this.measures = measures;
    const width = Math.max(800, this.container.clientWidth - 40);
    this.toolkit.setOptions({
      pageWidth: Math.round((width * 100) / 35),
      pageHeight: 60000,
      adjustPageHeight: true,
      scale: 35,
      breaks: "auto",
      font: "Bravura",
      svgAdditionalAttribute: ["measure@n"],
      svgHtml5: true,
    });
    this.toolkit.loadData(musicxml);
    // Builds the timing table used by getTimeForElement and getElementsAtTime.
    this.toolkit.renderToMIDI();
    this.container.innerHTML = "";
    for (let p = 1; p <= this.toolkit.getPageCount(); p++) {
      const page = document.createElement("div");
      page.className = "page";
      page.innerHTML = this.toolkit.renderToSVG(p);
      this.container.append(page);
    }
    this.measuredWidth = 0;
    this.setCursor(this.cursor);
  }

  /** Measures positions when the layout exists and has changed since the last time. */
  private ensureGeometry(): boolean {
    const width = this.container.querySelector(".page")?.getBoundingClientRect().width ?? 0;
    if (width === 0) return false;
    if (width !== this.measuredWidth) {
      this.measureGeometry();
      this.measuredWidth = width;
      this.setRange(...this.range);
    }
    return true;
  }

  private measureGeometry(): void {
    this.geometry = [];
    const times = new Map(this.measures.map((m) => [m.number, m]));
    for (const page of this.container.querySelectorAll<HTMLElement>(".page")) {
      const origin = page.getBoundingClientRect();
      for (const g of page.querySelectorAll<SVGGElement>("g.measure")) {
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
          const id = note.dataset.id;
          if (!id) continue;
          const ms = this.toolkit.getTimeForElement(id);
          if (!Number.isFinite(ms)) continue;
          const nr = note.getBoundingClientRect();
          anchors.push([nr.left + nr.width / 2 - origin.left, ms / 1000]);
        }
        anchors.sort((a, b) => a[0] - b[0]);
        // Keep only anchors that move forward in time, framed by the measure's edges.
        const clean: [number, number][] = [[left, t.seconds]];
        for (const a of anchors) if (a[1] > clean.at(-1)![1] && a[1] < t.endSeconds) clean.push(a);
        if (clean.length > 1 && clean[1]![1] - t.seconds < 1e-3) clean.shift();
        clean.push([right, t.endSeconds]);
        this.geometry.push({
          number,
          page,
          left,
          right,
          top: r.top - origin.top,
          bottom: r.bottom - origin.top,
          anchors: clean,
        });
      }
    }
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
    if (!this.ensureGeometry()) return;
    const g = this.geometry.find((m) => m.number === this.measureAt(seconds));
    if (!g) {
      this.playhead.remove();
      return;
    }
    const x = interpolate(
      g.anchors.map(([ax, at]) => [at, ax]),
      seconds,
    );
    if (this.playhead.parentElement !== g.page) g.page.append(this.playhead);
    Object.assign(this.playhead.style, {
      left: `${x}px`,
      top: `${g.top - 6}px`,
      height: `${g.bottom - g.top + 12}px`,
    });
    if (follow) {
      const box = this.container.getBoundingClientRect();
      const ph = this.playhead.getBoundingClientRect();
      if (ph.top < box.top + 20 || ph.bottom > box.bottom - 20) {
        this.container.scrollBy({ top: ph.top - box.top - box.height / 3, behavior: "smooth" });
      }
    }
  }

  scrollToTop(): void {
    this.container.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Shades the render range; no shading when it is the whole piece. */
  setRange(from: number, to: number): void {
    this.range = [from, to];
    for (const b of this.bands) b.remove();
    this.bands = [];
    if (from === 1 && to === this.measures.length) return;
    for (const g of this.geometry) {
      if (g.number < from || g.number > to) continue;
      const band = document.createElement("div");
      band.className = "range-band";
      Object.assign(band.style, {
        left: `${g.left}px`,
        top: `${g.top}px`,
        width: `${g.right - g.left}px`,
        height: `${g.bottom - g.top}px`,
      });
      g.page.append(band);
      this.bands.push(band);
    }
  }

  /** Colours the notes sounding at `seconds` (piece time). Pass undefined to clear. */
  highlight(seconds: number | undefined): void {
    for (const el of this.highlighted) el.classList.remove("playing");
    this.highlighted = [];
    if (seconds === undefined) return;
    for (const id of this.toolkit.getElementsAtTime(seconds * 1000).notes ?? []) {
      const el = this.container.querySelector(`[data-id="${id}"]`);
      if (el) {
        el.classList.add("playing");
        this.highlighted.push(el);
      }
    }
  }

  private hit(e: PointerEvent): { geometry: Geometry; seconds: number } | undefined {
    if (!this.ensureGeometry()) return undefined;
    for (const g of this.geometry) {
      const origin = g.page.getBoundingClientRect();
      const x = e.clientX - origin.left;
      const y = e.clientY - origin.top;
      if (x >= g.left && x <= g.right && y >= g.top - 10 && y <= g.bottom + 10) {
        return { geometry: g, seconds: interpolate(g.anchors, x) };
      }
    }
    return undefined;
  }

  private bindPointer(): void {
    let mode: "none" | "pending" | "range" | "scrub" = "none";
    let startX = 0;
    let startMeasure = 0;
    this.container.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      startX = e.clientX;
      if (e.target === this.playhead) {
        mode = "scrub";
        this.container.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
      const h = this.hit(e);
      if (!h) return;
      mode = "pending";
      startMeasure = h.geometry.number;
    });
    this.container.addEventListener("pointermove", (e) => {
      if (mode === "scrub") {
        const h = this.hit(e);
        if (h) this.onSeek?.(h.seconds);
        return;
      }
      if (mode === "pending" && Math.abs(e.clientX - startX) > 6) mode = "range";
      if (mode === "range") {
        const h = this.hit(e);
        if (!h) return;
        const a = Math.min(startMeasure, h.geometry.number);
        const b = Math.max(startMeasure, h.geometry.number);
        this.onRange?.(a, b);
      }
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

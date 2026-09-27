// The score on screen (docs/decisions/0020): the measures drawn by the engraver
// (src/preview/engraver.ts), laid side by side as one strip. Two ways to read it:
// - panorama: one long row, scrolled sideways. While playing, it glides so that the playhead
//   stays a third of the way across.
// - page: the strip folded at barlines into rows as wide as the screen, one under the other.
//   While playing, it turns when the playhead moves to the next row, keeping how far down the
//   row you were looking.
// Zoom scales the drawings; nothing is drawn again, and a window of another size only lays them
// out again. The margin on the left shows names and the clefs in force; the ruler above shows
// measure numbers, rehearsal marks, meters and tempi.
//
// Time ↔ place: seconds ↔ quarters through the tempo map (src/score/timeline.ts), and quarters
// ↔ x within a measure through the beats the engraver found in its drawing.
//
// Drawings are images placed by measure. A new layout (zoom, window size, a drawing arriving)
// moves them; an image is replaced only when its measure's drawing changes, and the old one stays
// until the new one is ready.

import { quartersAt, secondsAt, type TempoSegment } from "../score/timeline.ts";
import type { NotationSnapshot, Shot } from "./engraver.ts";
import type { MeasureInfo } from "./notation-thread.ts";

export type Mode = "page" | "panorama";
export type Zoom = number | "fit";

/** Height of the ruler above a row, in CSS pixels. */
const rulerHeight = 22;
/** Space between rows on a page, in CSS pixels. */
const rowGap = 18;
/** Padding around the strip, in CSS pixels. */
const pad = 12;
/** Largest and smallest scale (CSS pixels per drawing unit); a five-line staff is 720 units. */
export const maxScale = 60 / 720;
export const minScale = 3 / 720;
/** Width guessed for a measure not drawn yet, in drawing units. */
const guessWidth = 3000;
/** How long following waits after the user scrolls by hand, in ms. */
const handsOff = 3000;

interface Layout {
  scale: number;
  /** Drawing units above staff 1, the staves, and below the last staff (the same in every row). */
  top: number;
  span: number;
  bottom: number;
  /** Width of the margin, in units. */
  margin: number;
  /** Per measure: its row, x in units from the row's first barline, and its width. */
  row: number[];
  x: number[];
  width: number[];
  /** Rows: their first and last measures, and top edge (of the ruler) in CSS pixels. */
  rows: { first: number; last: number; y: number }[];
  contentWidth: number;
  contentHeight: number;
}

interface Placed {
  el: HTMLElement;
  /** What it shows; a different one replaces it. */
  sig: string;
  /** The element it replaces, until it is ready. */
  old?: HTMLElement;
}

export class StripView {
  /** A click or drag on the notation asks to move the playhead there. */
  onSeek?: (seconds: number) => void;
  /** The measures in view changed (indices), so the server can draw them first. */
  onFocus?: (from: number, to: number) => void;
  /** Where the playhead is now (read every frame while following). */
  position?: () => number;

  private mode: Mode = "page";
  private zoom: Zoom = "fit";
  private measures: MeasureInfo[] = [];
  private tempo: TempoSegment[] = [];
  private snapshot?: NotationSnapshot;
  private layout?: Layout;
  private readonly canvas: HTMLDivElement;
  private readonly pinned: HTMLDivElement;
  private readonly playhead: HTMLDivElement;
  private readonly placed = new Map<string, Placed>();
  private readonly anchors = new Map<string, [number, number][]>();
  private readonly fetching = new Set<string>();
  private cursor = 0;
  private following = false;
  private userScrolled = -Infinity;
  private frame = 0;
  private lastFocus = "";

  private readonly container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement("div");
    this.canvas.className = "strip-canvas";
    // The panorama's margin stays at the left edge (sticky); the page draws one per row.
    this.pinned = document.createElement("div");
    this.pinned.className = "margin pinned";
    this.playhead = document.createElement("div");
    this.playhead.className = "playhead";
    this.playhead.hidden = true;
    this.canvas.append(this.pinned, this.playhead);
    container.replaceChildren(this.canvas);
    container.addEventListener("scroll", () => this.schedule(), { passive: true });
    for (const kind of ["wheel", "touchmove", "pointerdown"])
      container.addEventListener(kind, () => (this.userScrolled = performance.now()), {
        passive: true,
      });
    this.canvas.addEventListener("click", (e) => this.click(e));
    this.dragPlayhead();
  }

  //============================================================================
  // Inputs

  setScore(measures: MeasureInfo[], tempo: TempoSegment[]): void {
    this.measures = measures;
    this.tempo = tempo;
    this.relayout();
  }

  setSnapshot(snapshot: NotationSnapshot): void {
    this.snapshot = snapshot;
    this.relayout();
  }

  setMode(mode: Mode, zoom: Zoom): void {
    if (mode === this.mode && zoom === this.zoom) return;
    const at = this.pointAt();
    this.mode = mode;
    this.zoom = zoom;
    this.relayout(at);
  }

  /** Zooms, keeping the point under `anchor` (client coordinates), or the top left, in place. */
  setZoom(zoom: Zoom, anchor?: { x: number; y: number }): void {
    const at = this.pointAt(anchor);
    this.zoom = zoom;
    this.relayout(at, anchor);
  }

  get currentMode(): Mode {
    return this.mode;
  }

  /** The scale in use (CSS pixels per unit), to zoom from it. */
  get scale(): number {
    return this.layout?.scale ?? 0.05;
  }

  /** Lays out again after the view changed size. */
  resize(): void {
    this.relayout(this.pointAt());
  }

  /**
   * Moves the playhead; with `follow` (while playing), the view keeps it in sight, except for a
   * moment after the user scrolls by hand.
   */
  setCursor(seconds: number, follow = false): void {
    this.cursor = seconds;
    this.following = follow;
    this.schedule();
  }

  /** Brings the playhead into view now (after a jump). */
  reveal(): void {
    this.userScrolled = -Infinity;
    const wasFollowing = this.following;
    this.following = true;
    this.follow();
    this.following = wasFollowing;
    this.schedule();
  }

  /** Stops following (playback paused). */
  release(): void {
    this.following = false;
  }

  /** The measure number at a time. */
  measureAt(seconds: number): number {
    return this.measures[this.indexAt(seconds)]?.number ?? 1;
  }

  //============================================================================
  // Layout

  private shots(): (Shot | null)[] {
    const s = this.snapshot;
    return this.measures.map((_, i) => {
      const m = s?.measures[i];
      return m && m !== "failed" ? m : null;
    });
  }

  private fitScale(rowUnits: number): number {
    const h = this.container.clientHeight - rulerHeight - 2 * pad;
    return Math.max(minScale, Math.min(maxScale, h / rowUnits));
  }

  private relayout(
    keep?: { i: number; f: number; dy: number },
    anchor?: { x: number; y: number },
  ): void {
    keep ??= this.pointAt();
    const shots = this.shots();
    const margins = (this.snapshot?.margins ?? []).filter((m): m is Shot => !!m && m !== "failed");
    const drawn = [...shots.filter((s): s is Shot => !!s), ...margins];
    const top = Math.max(1, ...drawn.map((s) => s.top));
    const span = Math.max(1, ...drawn.map((s) => s.bottom - s.top));
    const bottom = Math.max(0, ...drawn.map((s) => s.height - s.bottom));
    const margin = Math.max(0, ...margins.map((m) => m.right));
    const scale = this.zoom === "fit" ? this.fitScale(top + span + bottom) : this.zoom;
    const known = shots.filter((s): s is Shot => !!s).map((s) => s.right);
    const guess = known.length ? known.reduce((a, b) => a + b, 0) / known.length : guessWidth;
    const width = shots.map((s) => s?.right ?? guess);
    const rowPx = rulerHeight + (top + span + bottom) * scale;
    const row: number[] = [];
    const x: number[] = [];
    const rows: Layout["rows"] = [];
    let at = 0;
    const room =
      this.mode === "panorama" ? Infinity : (this.container.clientWidth - 2 * pad) / scale - margin;
    width.forEach((w, i) => {
      if (i > 0 && at + w > room) {
        rows.at(-1)!.last = i - 1;
        at = 0;
      }
      if (i === 0 || at === 0) rows.push({ first: i, last: i, y: rows.length * (rowPx + rowGap) });
      row.push(rows.length - 1);
      x.push(at);
      at += w;
    });
    if (rows.length) rows.at(-1)!.last = width.length - 1;
    const widest = Math.max(0, ...rows.map((r) => x[r.last]! + width[r.last]!));
    this.layout = {
      scale,
      top,
      span,
      bottom,
      margin,
      row,
      x,
      width,
      rows,
      contentWidth: (margin + widest) * scale + 2 * pad,
      contentHeight: rows.length * rowPx + Math.max(0, rows.length - 1) * rowGap + 2 * pad,
    };
    this.canvas.style.width = `${this.layout.contentWidth}px`;
    this.canvas.style.height = `${this.layout.contentHeight}px`;
    this.canvas.dataset.mode = this.mode;
    if (keep) this.restore(keep, anchor);
    this.render();
  }

  /** Where a measure's first barline is, in CSS pixels of the content. */
  private measureLeft(i: number): number {
    const l = this.layout!;
    return pad + (l.margin + l.x[i]!) * l.scale;
  }

  private rowTop(r: number): number {
    return pad + (this.layout!.rows[r]?.y ?? 0);
  }

  /** Top of staff 1 in a row, in CSS pixels of the content. */
  private staffTop(r: number): number {
    const l = this.layout!;
    return this.rowTop(r) + rulerHeight + l.top * l.scale;
  }

  //============================================================================
  // Time and place

  private indexAt(seconds: number): number {
    const q = quartersAt(this.tempo, seconds);
    let lo = 0;
    let hi = this.measures.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.measures[mid]!.quarters <= q + 1e-9) lo = mid;
      else hi = mid - 1;
    }
    return Math.max(0, lo);
  }

  /** The measure's beats [quarters in, x in units], ending where the next measure's first beat is. */
  private pointsOf(i: number): [number, number][] {
    const l = this.layout!;
    const shots = this.shots();
    const own = this.anchorsOf(shots[i]?.key);
    const next = this.anchorsOf(shots[i + 1]?.key);
    const nextFirst = next?.[0]?.[0] === 0 ? next[0][1] : 0;
    const end: [number, number] = [this.measures[i]!.length, l.width[i]! + nextFirst];
    if (!own?.length) return [[0, 0], end];
    return [...(own[0]![0] === 0 ? [] : ([[0, 0]] as [number, number][])), ...own, end];
  }

  private anchorsOf(key: string | undefined): [number, number][] | undefined {
    if (!key) return undefined;
    const known = this.anchors.get(key);
    if (known || this.fetching.has(key)) return known;
    this.fetching.add(key);
    void fetch(`/api/engraving/${key}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<{ anchors: [number, number][] }>) : undefined))
      .then((facts) => {
        if (facts) this.anchors.set(key, facts.anchors);
        this.schedule();
      })
      .finally(() => this.fetching.delete(key));
    return undefined;
  }

  /** The playhead's place: its measure, row and x in CSS pixels of the content. */
  private place(seconds: number): { i: number; row: number; x: number } | undefined {
    const l = this.layout;
    if (!l || !this.measures.length) return undefined;
    const i = this.indexAt(seconds);
    const q = Math.max(0, quartersAt(this.tempo, seconds) - this.measures[i]!.quarters);
    const points = this.pointsOf(i);
    let x = points.at(-1)![1];
    for (let k = 1; k < points.length; k++) {
      const [q0, x0] = points[k - 1]!;
      const [q1, x1] = points[k]!;
      if (q <= q1) {
        x = q1 === q0 ? x1 : x0 + ((q - q0) / (q1 - q0)) * (x1 - x0);
        break;
      }
    }
    return { i, row: l.row[i]!, x: this.measureLeft(i) + x * l.scale };
  }

  /** The measure, fraction of it and depth into its row at a point of the view (default: top left). */
  private pointAt(at?: { x: number; y: number }): { i: number; f: number; dy: number } | undefined {
    const l = this.layout;
    if (!l || !this.measures.length || !l.rows.length) return undefined;
    const box = this.container.getBoundingClientRect();
    const cx = (at ? at.x - box.left : 0) + this.container.scrollLeft;
    const cy = (at ? at.y - box.top : 0) + this.container.scrollTop;
    const r = this.rowIndexAt(cy);
    const row = l.rows[r]!;
    for (let i = row.first; i <= row.last; i++) {
      const left = this.measureLeft(i);
      const w = l.width[i]! * l.scale;
      if (cx < left + w || i === row.last)
        return { i, f: Math.min(1, Math.max(0, (cx - left) / w)), dy: cy - this.rowTop(r) };
    }
    return undefined;
  }

  private rowIndexAt(y: number): number {
    const rows = this.layout!.rows;
    let r = 0;
    while (r + 1 < rows.length && this.rowTop(r + 1) <= y) r++;
    return r;
  }

  private restore(p: { i: number; f: number; dy: number }, at?: { x: number; y: number }): void {
    const l = this.layout!;
    if (p.i >= l.row.length) return;
    const box = this.container.getBoundingClientRect();
    const x = this.measureLeft(p.i) + p.f * l.width[p.i]! * l.scale;
    this.container.scrollLeft = x - (at ? at.x - box.left : 0);
    this.container.scrollTop = this.rowTop(l.row[p.i]!) + p.dy - (at ? at.y - box.top : 0);
  }

  /** Seconds at a point of the view. */
  private secondsAt(clientX: number, clientY: number): number | undefined {
    const l = this.layout;
    const p = this.pointAt({ x: clientX, y: clientY });
    if (!l || !p) return undefined;
    const m = this.measures[p.i]!;
    // The inverse of place(): x → quarters over the measure's beats.
    const x = p.f * l.width[p.i]!;
    const points = this.pointsOf(p.i);
    let q = m.length;
    for (let k = 1; k < points.length; k++) {
      const [q0, x0] = points[k - 1]!;
      const [q1, x1] = points[k]!;
      if (x <= x1) {
        q = x1 === x0 ? q1 : q0 + ((x - x0) / (x1 - x0)) * (q1 - q0);
        break;
      }
    }
    return secondsAt(this.tempo, m.quarters + Math.min(Math.max(0, q), m.length));
  }

  private click(e: MouseEvent): void {
    if (e.target === this.playhead) return;
    const s = this.secondsAt(e.clientX, e.clientY);
    if (s !== undefined) this.onSeek?.(s);
  }

  private dragPlayhead(): void {
    this.playhead.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.playhead.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        const s = this.secondsAt(ev.clientX, ev.clientY);
        if (s !== undefined) this.onSeek?.(s);
      };
      const up = () => {
        this.playhead.removeEventListener("pointermove", move);
        this.playhead.removeEventListener("pointerup", up);
      };
      this.playhead.addEventListener("pointermove", move);
      this.playhead.addEventListener("pointerup", up);
    });
  }

  //============================================================================
  // Drawing what is in view

  private schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  private render(): void {
    const l = this.layout;
    if (!l) return;
    if (this.following && this.position) this.cursor = this.position();
    this.follow();
    const c = this.container;
    const view = {
      left: c.scrollLeft,
      top: c.scrollTop,
      width: c.clientWidth,
      height: c.clientHeight,
    };
    const rowPx = rulerHeight + (l.top + l.span + l.bottom) * l.scale;
    const near = (x0: number, x1: number, y0: number, y1: number) =>
      x1 >= view.left - view.width &&
      x0 <= view.left + 2 * view.width &&
      y1 >= view.top - view.height &&
      y0 <= view.top + 2 * view.height;
    const seen = (x0: number, x1: number, y0: number, y1: number) =>
      x1 >= view.left &&
      x0 <= view.left + view.width &&
      y1 >= view.top &&
      y0 <= view.top + view.height;
    const wanted = new Set<string>();
    const shots = this.shots();
    let seenFrom = Infinity;
    let seenTo = -1;
    for (const [r, row] of l.rows.entries()) {
      const y0 = this.rowTop(r);
      if (!near(0, l.contentWidth, y0, y0 + rowPx)) continue;
      if (this.mode === "page") this.placeMargin(`g${r}`, row.first, r, wanted);
      for (let i = row.first; i <= row.last; i++) {
        const x0 = this.measureLeft(i);
        const x1 = x0 + l.width[i]! * l.scale;
        if (!near(x0, x1, y0, y0 + rowPx)) continue;
        if (seen(x0, x1, y0, y0 + rowPx)) {
          seenFrom = Math.min(seenFrom, i);
          seenTo = Math.max(seenTo, i);
        }
        this.placeMeasure(i, shots[i] ?? null, r, wanted);
        this.placeLabel(i, r, wanted);
      }
    }
    this.pinned.hidden = this.mode !== "panorama";
    if (this.mode === "panorama") this.fillPinned(this.pointAt()?.i ?? 0);
    for (const [k, p] of this.placed)
      if (!wanted.has(k)) {
        p.el.remove();
        p.old?.remove();
        this.placed.delete(k);
      }
    this.drawPlayhead();
    if (seenTo >= 0) {
      const focus = `${seenFrom}:${seenTo}`;
      if (focus !== this.lastFocus) {
        this.lastFocus = focus;
        this.onFocus?.(seenFrom, seenTo);
      }
    }
    // Keep going while following, for a smooth glide.
    if (this.following && this.position) this.schedule();
  }

  /** Puts an element in place: kept if it shows the same, replaced once the new one is ready. */
  private put(
    k: string,
    sig: string,
    make: () => HTMLElement,
    position: Partial<CSSStyleDeclaration>,
    wanted: Set<string>,
  ): void {
    wanted.add(k);
    const had = this.placed.get(k);
    if (had?.sig === sig) {
      Object.assign(had.el.style, position);
      return;
    }
    const el = make();
    Object.assign(el.style, position);
    const entry: Placed = { el, sig, old: had?.old ?? had?.el };
    if (had?.old && had.el !== entry.old) had.el.remove();
    this.placed.set(k, entry);
    const img = el instanceof HTMLImageElement ? el : el.querySelector("img");
    const show = () => {
      if (this.placed.get(k) !== entry) return;
      entry.old?.remove();
      entry.old = undefined;
      if (!el.isConnected) this.canvas.insertBefore(el, this.playhead);
    };
    if (img && entry.old) void img.decode().then(show, show);
    else show();
  }

  private image(key: string, className: string): HTMLImageElement {
    const img = new Image();
    img.decoding = "async";
    img.alt = "";
    img.draggable = false;
    img.className = className;
    img.src = `/api/engraving/${key}.svg`;
    return img;
  }

  private placeMeasure(i: number, shot: Shot | null, r: number, wanted: Set<string>): void {
    const l = this.layout!;
    const bleed = this.snapshot?.bleed ?? 0;
    if (shot)
      this.put(
        `m${i}`,
        shot.key,
        () => this.image(shot.key, shot.aligned ? "measure" : "measure unaligned"),
        {
          left: `${this.measureLeft(i) - bleed * l.scale}px`,
          top: `${this.staffTop(r) - shot.top * l.scale}px`,
          width: `${(shot.width + bleed) * l.scale}px`,
          height: `${shot.height * l.scale}px`,
        },
        wanted,
      );
    else
      this.put(
        `m${i}`,
        "pending",
        () => Object.assign(document.createElement("div"), { className: "measure pending" }),
        {
          left: `${this.measureLeft(i)}px`,
          top: `${this.staffTop(r)}px`,
          width: `${l.width[i]! * l.scale}px`,
          height: `${l.span * l.scale}px`,
        },
        wanted,
      );
  }

  private placeLabel(i: number, r: number, wanted: Set<string>): void {
    const l = this.layout!;
    const m = this.measures[i]!;
    const prev = this.measures[i - 1];
    const meter = !prev || prev.beats !== m.beats || prev.beatType !== m.beatType;
    const html = [
      `<span class="number">${m.number}</span>`,
      m.rehearsal ? `<span class="rehearsal">${escape(m.rehearsal)}</span>` : "",
      meter ? `<span class="meter">${m.beats}/${m.beatType}</span>` : "",
      m.tempo ? `<span class="tempo">${escape(m.tempo)}</span>` : "",
    ].join("");
    this.put(
      `l${i}`,
      html,
      () =>
        Object.assign(document.createElement("div"), { className: "ruler-label", innerHTML: html }),
      {
        left: `${this.measureLeft(i)}px`,
        top: `${this.rowTop(r)}px`,
        maxWidth: `${Math.max(16, l.width[i]! * l.scale - 2)}px`,
      },
      wanted,
    );
  }

  private marginShot(i: number): Shot | undefined {
    const s = this.snapshot;
    const which = s?.marginOf[i];
    const shot = which === undefined ? undefined : s?.margins[which];
    return shot && shot !== "failed" ? shot : undefined;
  }

  /** A page row's margin: the names and clefs in force at its first measure. */
  private placeMargin(k: string, i: number, r: number, wanted: Set<string>): void {
    const l = this.layout!;
    const shot = this.marginShot(i);
    this.put(
      k,
      shot?.key ?? "none",
      () => {
        const box = Object.assign(document.createElement("div"), { className: "margin" });
        if (shot) box.append(this.image(shot.key, ""));
        return box;
      },
      {
        left: "0px",
        top: `${this.rowTop(r) + rulerHeight}px`,
        width: `${pad + l.margin * l.scale}px`,
        height: `${(l.top + l.span + l.bottom) * l.scale}px`,
      },
      wanted,
    );
    const img = this.placed.get(k)?.el.querySelector("img");
    if (img && shot) this.sizeMarginImage(img, shot);
  }

  /** The panorama's margin, for the measure at the left edge. */
  private fillPinned(i: number): void {
    const l = this.layout!;
    const shot = this.marginShot(i);
    Object.assign(this.pinned.style, {
      marginTop: `${pad + rulerHeight}px`,
      width: `${pad + l.margin * l.scale}px`,
      height: `${(l.top + l.span + l.bottom) * l.scale}px`,
    });
    const img = this.pinned.querySelector("img");
    if (!shot) {
      img?.remove();
      return;
    }
    if (img?.dataset.key !== shot.key) {
      const fresh = this.image(shot.key, "");
      fresh.dataset.key = shot.key;
      if (img)
        void fresh.decode().then(
          () => img.replaceWith(fresh),
          () => img.replaceWith(fresh),
        );
      else this.pinned.append(fresh);
    }
    const now = this.pinned.querySelector("img");
    if (now) this.sizeMarginImage(now, shot);
  }

  private sizeMarginImage(img: HTMLImageElement, shot: Shot): void {
    const l = this.layout!;
    Object.assign(img.style, {
      left: `${pad}px`,
      top: `${(l.top - shot.top) * l.scale}px`,
      width: `${shot.width * l.scale}px`,
      height: `${shot.height * l.scale}px`,
    });
  }

  private drawPlayhead(): void {
    const p = this.place(this.cursor);
    const l = this.layout;
    if (!p || !l) {
      this.playhead.hidden = true;
      return;
    }
    this.playhead.hidden = false;
    Object.assign(this.playhead.style, {
      left: `${p.x}px`,
      top: `${this.staffTop(p.row) - 8}px`,
      height: `${l.span * l.scale + 16}px`,
    });
  }

  /** Keeps the playhead in sight while playing (see the top of this file). */
  private follow(): void {
    if (!this.following || performance.now() - this.userScrolled < handsOff) return;
    const p = this.place(this.cursor);
    if (!p) return;
    const c = this.container;
    if (this.mode === "panorama") {
      const target = p.x - c.clientWidth / 3;
      if (Math.abs(c.scrollLeft - target) > 0.5) c.scrollLeft = target;
      return;
    }
    // Page: turn when the playhead's row is not the one in view, keeping the depth in the row.
    const current = this.rowIndexAt(c.scrollTop + rulerHeight);
    if (p.row !== current)
      c.scrollTop = this.rowTop(p.row) + Math.max(0, c.scrollTop - this.rowTop(current));
    if (p.x < c.scrollLeft || p.x > c.scrollLeft + c.clientWidth)
      c.scrollLeft = Math.max(0, p.x - c.clientWidth / 3);
  }
}

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

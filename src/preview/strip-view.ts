// The score on screen (docs/decisions/0020): the measures drawn by the engraver
// (src/preview/engraver.ts), laid side by side as one long strip (a panorama), scrolled sideways.
// While playing, it glides so that the playhead stays a third of the way across. The margin on
// the left stays put and shows names and the clefs in force; the ruler above shows measure
// numbers, rehearsal marks, meters and tempi.
//
// Zoom scales the drawings; nothing is drawn again, and a window of another size only lays them
// out again. A pinch (or ⌘-wheel) does not lay out while it goes on: it only scales what is on
// screen, as one picture (a CSS transform, done by the GPU), and lays out at the new scale once
// the fingers rest. Laying out resizes dozens of drawings, which the browser must draw again at
// the new size; doing that for every step of a pinch made it stutter. The point under the fingers
// stays where it is, during the pinch and after.
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

export type Zoom = number | "fit";

/** Height of the ruler above the strip, in CSS pixels. */
const rulerHeight = 22;
/** Padding around the strip, in CSS pixels. */
const pad = 12;
/** Largest and smallest scale (CSS pixels per drawing unit); a five-line staff is 720 units. */
export const maxScale = 60 / 720;
export const minScale = 1 / 720;
/** Width guessed for a measure not drawn yet, in drawing units. */
const guessWidth = 3000;
/** How long following waits after the user scrolls by hand, in ms. */
const handsOff = 3000;

interface Layout {
  scale: number;
  /** Drawing units above staff 1, the staves, and below the last staff. */
  top: number;
  span: number;
  bottom: number;
  /** Width of the margin, in units. */
  margin: number;
  /** Per measure: x in units from the first barline, and its width. */
  x: number[];
  width: number[];
  contentWidth: number;
  contentHeight: number;
}

/**
 * A place in the score, kept across layouts: a measure, how far into it, and how far below the
 * top of staff 1 in drawing units (so it stays put at another scale), or, above staff 1 (the
 * ruler, whose height does not scale), in CSS pixels.
 */
interface Spot {
  i: number;
  f: number;
  u: number;
  above: number;
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
  /** A pinch ended at this scale (to remember it). */
  onZoom?: (scale: number) => void;

  private zoom: Zoom = "fit";
  private measures: MeasureInfo[] = [];
  private tempo: TempoSegment[] = [];
  private snapshot?: NotationSnapshot;
  private layout?: Layout;
  private readonly container: HTMLElement;
  private readonly sizer: HTMLDivElement;
  private readonly canvas: HTMLDivElement;
  private readonly margin: HTMLDivElement;
  private readonly playhead: HTMLDivElement;
  /** The time a chosen part of a piece takes (setSpan), shaded behind the notation. */
  private readonly span: HTMLDivElement;
  private spanSeconds?: [number, number];
  private readonly placed = new Map<string, Placed>();
  private readonly anchors = new Map<string, [number, number][]>();
  private readonly fetching = new Set<string>();
  private cursor = 0;
  private following = false;
  private userScrolled = -Infinity;
  private frame = 0;
  /**
   * A pinch going on: the scale it started from, the transform it has applied so far (content
   * point c is shown at k·c + t), and where the pointer last was.
   */
  private gesture?: {
    base: number;
    k: number;
    tx: number;
    ty: number;
    anchor: { x: number; y: number };
    timer: number;
  };
  private lastFocus = "";

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement("div");
    this.canvas.className = "strip-canvas";
    // Stays at the left edge (sticky) while the strip scrolls under it.
    this.margin = document.createElement("div");
    this.margin.className = "margin";
    this.playhead = document.createElement("div");
    this.playhead.className = "playhead";
    this.playhead.hidden = true;
    this.span = document.createElement("div");
    this.span.className = "span";
    this.span.hidden = true;
    this.canvas.append(this.span, this.margin, this.playhead);
    // Keeps the scroll range while a pinch shrinks the picture, so the browser does not pull the
    // view back (which would move the point under the fingers).
    this.sizer = document.createElement("div");
    this.sizer.className = "strip-sizer";
    container.replaceChildren(this.sizer, this.canvas);
    container.addEventListener("scroll", () => this.schedule(), { passive: true });
    // The view changes size with the window, the messages, the mixer, the sidebar, full screen.
    new ResizeObserver(() => this.resize()).observe(container);
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

  /** Zooms, keeping the point under `anchor` (client coordinates), or the middle of the view, in place. */
  setZoom(zoom: Zoom, anchor?: { x: number; y: number }): void {
    this.endPinch();
    const box = this.container.getBoundingClientRect();
    const around = anchor ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const at = this.pointAt(around);
    this.zoom = zoom;
    this.relayout(at, around);
  }

  /**
   * One step of a pinch: scales what is shown by `factor` around `anchor` (client coordinates) at
   * once, and lays out at the new scale when no step has come for a moment.
   */
  pinch(factor: number, anchor: { x: number; y: number }): void {
    const l = this.layout;
    if (!l) return;
    const g = (this.gesture ??= { base: l.scale, k: 1, tx: 0, ty: 0, anchor, timer: 0 });
    // Each step scales around where the pointer is now: that point of the picture stays under it.
    const k = Math.max(minScale, Math.min(maxScale * 2, g.base * g.k * factor)) / g.base;
    const f = k / g.k;
    const q = this.scrolled(anchor);
    g.tx = f * g.tx + (1 - f) * q.x;
    g.ty = f * g.ty + (1 - f) * q.y;
    g.k = k;
    g.anchor = anchor;
    Object.assign(this.canvas.style, {
      transformOrigin: "0 0",
      transform: `translate(${g.tx}px, ${g.ty}px) scale(${g.k})`,
    });
    clearTimeout(g.timer);
    g.timer = window.setTimeout(() => this.endPinch(), 160);
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
  /** Shades the time from one point to another (seconds), or nothing. */
  setSpan(span?: [number, number]): void {
    this.spanSeconds = span;
    this.drawPlayhead();
  }

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

  /** The scale that fits the strip's height in the view (up to a size that stays readable). */
  private fitScale(units: number): number {
    const h = this.container.clientHeight - rulerHeight - 2 * pad;
    return Math.max(minScale, Math.min(maxScale, h / units));
  }

  private relayout(keep?: Spot, anchor?: { x: number; y: number }): void {
    // During a pinch the picture is only scaled; the pinch lays out when it ends.
    if (this.gesture) return;
    // A view at the very start stays there. (Keeping the point at its left edge would scroll by the
    // margin's width when the margin arrives after the measures, hiding bar 1 behind it.)
    const atStart = !anchor && this.container.scrollLeft <= 1;
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
    const x: number[] = [];
    let at = 0;
    for (const w of width) {
      x.push(at);
      at += w;
    }
    this.layout = {
      scale,
      top,
      span,
      bottom,
      margin,
      x,
      width,
      contentWidth: (margin + at) * scale + 2 * pad,
      contentHeight: rulerHeight + (top + span + bottom) * scale + 2 * pad,
    };
    for (const el of [this.canvas, this.sizer]) {
      el.style.width = `${this.layout.contentWidth}px`;
      el.style.height = `${this.layout.contentHeight}px`;
    }
    if (keep) this.restore(keep, anchor);
    if (atStart) this.container.scrollLeft = 0;
    this.render();
  }

  /** Where a measure's first barline is, in CSS pixels of the content. */
  private measureLeft(i: number): number {
    const l = this.layout!;
    return pad + (l.margin + l.x[i]!) * l.scale;
  }

  /** Top of staff 1, in CSS pixels of the content. */
  private staffTop(): number {
    const l = this.layout!;
    return pad + rulerHeight + l.top * l.scale;
  }

  private endPinch(): void {
    const g = this.gesture;
    if (!g) return;
    clearTimeout(g.timer);
    // The point under the pointer, in the layout before the pinch.
    const q = this.scrolled(g.anchor);
    const at = this.spotAt((q.x - g.tx) / g.k, (q.y - g.ty) / g.k);
    this.gesture = undefined;
    Object.assign(this.canvas.style, { transform: "", transformOrigin: "" });
    this.zoom = g.base * g.k;
    this.relayout(at, g.anchor);
    this.onZoom?.(this.zoom);
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

  /** The playhead's place: its measure and x in CSS pixels of the content. */
  private place(seconds: number): { i: number; x: number } | undefined {
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
    return { i, x: this.measureLeft(i) + x * l.scale };
  }

  /** A client point in the scrolled content's coordinates. */
  private scrolled(at: { x: number; y: number }): { x: number; y: number } {
    const box = this.container.getBoundingClientRect();
    return {
      x: at.x - box.left + this.container.scrollLeft,
      y: at.y - box.top + this.container.scrollTop,
    };
  }

  /** The spot at a point of the view (client coordinates; default: its top left). */
  private pointAt(at?: { x: number; y: number }): Spot | undefined {
    const box = this.container.getBoundingClientRect();
    const q = this.scrolled(at ?? { x: box.left, y: box.top });
    return this.spotAt(q.x, q.y);
  }

  /** The spot at a point of the content (CSS pixels, in the current layout). */
  private spotAt(cx: number, cy: number): Spot | undefined {
    const l = this.layout;
    if (!l || !this.measures.length) return undefined;
    // The last measure starting left of cx.
    let lo = 0;
    let hi = this.measures.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.measureLeft(mid) <= cx) lo = mid;
      else hi = mid - 1;
    }
    const w = l.width[lo]! * l.scale;
    const below = cy - this.staffTop();
    return {
      i: lo,
      f: Math.min(1, Math.max(0, (cx - this.measureLeft(lo)) / w)),
      u: Math.max(0, below) / l.scale,
      above: Math.min(0, below),
    };
  }

  /** Scrolls so that a spot is at a point of the view (client coordinates; default: top left). */
  private restore(p: Spot, at?: { x: number; y: number }): void {
    const l = this.layout!;
    if (p.i >= l.x.length) return;
    const box = this.container.getBoundingClientRect();
    const x = this.measureLeft(p.i) + p.f * l.width[p.i]! * l.scale;
    const y = this.staffTop() + p.u * l.scale + p.above;
    this.container.scrollLeft = x - (at ? at.x - box.left : 0);
    this.container.scrollTop = y - (at ? at.y - box.top : 0);
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
    if (!l || this.gesture) return;
    if (this.following && this.position) this.cursor = this.position();
    this.follow();
    const c = this.container;
    const left = c.scrollLeft;
    const width = c.clientWidth;
    const wanted = new Set<string>();
    const shots = this.shots();
    let seenFrom = Infinity;
    let seenTo = -1;
    // Place what is in view and a screen on either side.
    for (let i = 0; i < this.measures.length; i++) {
      const x0 = this.measureLeft(i);
      const x1 = x0 + l.width[i]! * l.scale;
      if (x1 < left - width || x0 > left + 2 * width) continue;
      if (x1 >= left && x0 <= left + width) {
        seenFrom = Math.min(seenFrom, i);
        seenTo = Math.max(seenTo, i);
      }
      this.placeMeasure(i, shots[i] ?? null, wanted);
      this.placeLabel(i, wanted);
    }
    this.fillMargin(this.pointAt()?.i ?? 0);
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
    const show = () => {
      if (this.placed.get(k) !== entry) return;
      entry.old?.remove();
      entry.old = undefined;
      if (!el.isConnected) this.canvas.insertBefore(el, this.playhead);
    };
    if (el instanceof HTMLImageElement && entry.old) void el.decode().then(show, show);
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

  private placeMeasure(i: number, shot: Shot | null, wanted: Set<string>): void {
    const l = this.layout!;
    const bleed = this.snapshot?.bleed ?? 0;
    if (shot)
      this.put(
        `m${i}`,
        shot.key,
        () => this.image(shot.key, shot.aligned ? "measure" : "measure unaligned"),
        {
          left: `${this.measureLeft(i) - bleed * l.scale}px`,
          top: `${this.staffTop() - shot.top * l.scale}px`,
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
          top: `${this.staffTop()}px`,
          width: `${l.width[i]! * l.scale}px`,
          height: `${l.span * l.scale}px`,
        },
        wanted,
      );
  }

  private placeLabel(i: number, wanted: Set<string>): void {
    const l = this.layout!;
    const m = this.measures[i]!;
    const prev = this.measures[i - 1];
    const meter = !prev || prev.beats !== m.beats || prev.beatType !== m.beatType;
    // Where measures are too narrow for their numbers, every tenth one is shown (reaching over
    // the next ones, which show none).
    const px = l.width[i]! * l.scale;
    const narrow = px < 22;
    const html = [
      !narrow || m.number % 10 === 0 ? `<span class="number">${m.number}</span>` : "",
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
        top: `${pad}px`,
        maxWidth: narrow ? "none" : `${px - 2}px`,
      },
      wanted,
    );
  }

  /** The margin for the measure at the left edge: names, brackets and the clefs in force there. */
  private fillMargin(i: number): void {
    const l = this.layout!;
    const s = this.snapshot;
    const which = s?.marginOf[i];
    const drawn = which === undefined ? undefined : s?.margins[which];
    const shot = drawn && drawn !== "failed" ? drawn : undefined;
    Object.assign(this.margin.style, {
      marginTop: `${pad + rulerHeight}px`,
      width: `${pad + l.margin * l.scale}px`,
      height: `${(l.top + l.span + l.bottom) * l.scale}px`,
    });
    const img = this.margin.querySelector("img");
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
      else this.margin.append(fresh);
    }
    const now = this.margin.querySelector("img");
    if (now)
      Object.assign(now.style, {
        left: `${pad}px`,
        top: `${(l.top - shot.top) * l.scale}px`,
        width: `${shot.width * l.scale}px`,
        height: `${shot.height * l.scale}px`,
      });
  }

  private drawPlayhead(): void {
    const p = this.place(this.cursor);
    const l = this.layout;
    const from = this.spanSeconds && this.place(this.spanSeconds[0]);
    const to = this.spanSeconds && this.place(this.spanSeconds[1]);
    this.span.hidden = !from || !to || !l;
    if (from && to && l)
      Object.assign(this.span.style, {
        left: `${from.x}px`,
        width: `${Math.max(2, to.x - from.x)}px`,
        top: `${this.staffTop() - 8}px`,
        height: `${l.span * l.scale + 16}px`,
      });
    if (!p || !l) {
      this.playhead.hidden = true;
      return;
    }
    this.playhead.hidden = false;
    Object.assign(this.playhead.style, {
      left: `${p.x}px`,
      top: `${this.staffTop() - 8}px`,
      height: `${l.span * l.scale + 16}px`,
    });
  }

  /** Keeps the playhead a third of the way across while playing (see the top of this file). */
  private follow(): void {
    if (!this.following || performance.now() - this.userScrolled < handsOff) return;
    const p = this.place(this.cursor);
    if (!p) return;
    const c = this.container;
    const target = p.x - c.clientWidth / 3;
    if (Math.abs(c.scrollLeft - target) > 0.5) c.scrollLeft = target;
  }
}

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

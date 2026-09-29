// The knob panel: shown beside the score when the open score belongs to a sketch
// (src/sketch/knobs.ts, src/preview/sketches.ts). One row per knob, grouped as the sketch groups
// them; each kind draws itself (knobs/controls.ts). A change is sent when it is finished; the
// server writes the sketch's score again and the preview picks it up like any save, keeping the
// playhead where it is.
//
// For a piece (src/sketch/nest.ts) the panel shows one node at a time, the piece or a part of it,
// with the path to it at the top and the piece's map under it: every node on the piece's timeline,
// coloured by the forms of the motif it plays, the flows behind them, the playhead. Choosing a node
// there (or in the list) shows its knobs.
//
// Hovering a row shows what the knob is for and how to use it. The panel's left edge drags to
// resize it (remembered by the browser).

import type { Outline, OutlineNode } from "../score/types.ts";
import type { Value } from "../sketch/knobs.ts";
import { controls, type Context } from "./knobs/controls.ts";
import type { SketchChange, SketchState } from "./sketches.ts";

/** A measure of the open score, for the map's ruler. */
export interface MapMeasure {
  number: number;
  quarters: number;
  rehearsal?: string;
}

/** The map's colours for the forms of the motif (anything else, harmony and colour, is grey). */
export const formColours: Record<string, string> = {
  P: "#4a6fb5",
  I: "#3f8f73",
  R: "#b9822f",
  RI: "#8467b8",
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const widthKey = "takemitsu.knobs-width";

export class KnobPanel {
  private path: string | undefined;
  /** The node shown, from the piece's folder ("" for the piece, or a plain sketch). */
  private node = "";
  private state: SketchState | undefined;
  private playhead = 0;
  private measures: MapMeasure[] = [];
  private mapBoxes: { node: OutlineNode; x0: number; x1: number; y0: number; y1: number }[] = [];
  private busy = false;
  private error: string | undefined;
  private naming = false;
  /** Hidden with K (or the toolbar button) while a sketch is open. */
  collapsed = false;
  /** Called when the panel appears or goes, so the page can show its toolbar button. */
  onChange?: (isSketch: boolean) => void;
  /** A node of the piece was chosen in the map or the path at the top. */
  onSelect?: (node: string) => void;

  private readonly el: HTMLElement;
  private readonly tip: HTMLElement;
  private tipTimer = 0;

  constructor(el: HTMLElement) {
    this.el = el;
    try {
      const w = Number(localStorage.getItem(widthKey));
      if (w) document.documentElement.style.setProperty("--knobs-width", `${w}px`);
    } catch {
      // The default width.
    }
    this.tip = document.createElement("div");
    this.tip.className = "knob-tip";
    this.tip.hidden = true;
    document.body.append(this.tip);

    el.addEventListener("click", (e) => {
      const map = (e.target as HTMLElement).closest<HTMLCanvasElement>("canvas.map");
      if (map) {
        const found = this.mapAt(map, e);
        if (found) this.onSelect?.(found.node);
        return;
      }
      const b = (e.target as HTMLElement).closest("button");
      if (!b) return;
      if (b.dataset.node !== undefined) this.onSelect?.(b.dataset.node);
      else if (b.dataset.load) void this.send({ load: b.dataset.load });
      else if (b.dataset.remove) void this.send({ remove: b.dataset.remove });
      else if (b.dataset.action === "reset") void this.send({ reset: true });
      else if (b.dataset.action === "name") {
        this.naming = true;
        this.render();
        this.el.querySelector<HTMLInputElement>("#preset-name")?.focus();
      }
    });
    el.addEventListener("keydown", (e) => {
      const t = e.target as HTMLElement;
      if (t.id !== "preset-name") return;
      if (e.key === "Enter") {
        const name = (t as HTMLInputElement).value.trim();
        this.naming = false;
        if (name) void this.send({ save: name });
        else this.render();
      } else if (e.key === "Escape") {
        this.naming = false;
        this.render();
      }
    });
    el.addEventListener("focusout", (e) => {
      if ((e.target as HTMLElement).id === "preset-name" && this.naming) {
        this.naming = false;
        this.render();
      }
    });
    // Tooltips: what the knob is for, and how to use it.
    el.addEventListener("pointerover", (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>(".knob");
      if (!row || row.dataset.tip === undefined) return;
      clearTimeout(this.tipTimer);
      this.tipTimer = window.setTimeout(() => this.showTip(row), this.tip.hidden ? 350 : 0);
    });
    el.addEventListener("pointerout", (e) => {
      const to = (e.relatedTarget as HTMLElement | null)?.closest(".knob");
      if (to === (e.target as HTMLElement).closest(".knob")) return;
      clearTimeout(this.tipTimer);
      this.tipTimer = window.setTimeout(() => (this.tip.hidden = true), 80);
    });
    el.addEventListener("pointerdown", (e) => {
      this.tip.hidden = true;
      clearTimeout(this.tipTimer);
      if ((e.target as HTMLElement).classList.contains("knobs-resize")) this.resize(e);
    });
    // The map names what is under the pointer.
    el.addEventListener("pointermove", (e) => {
      const map = (e.target as HTMLElement).closest<HTMLCanvasElement>("canvas.map");
      if (!map) return;
      const found = this.mapAt(map, e);
      map.title = found ? this.describe(found) : "";
      map.style.cursor = found ? "pointer" : "";
    });
  }

  /** The score now open, and the node of it to show (a piece's; "" for the piece or a sketch). */
  async show(path: string | undefined, node = ""): Promise<void> {
    const same = path === this.path && node === this.node;
    this.path = path;
    this.node = node;
    if (!same) {
      this.error = undefined;
      this.naming = false;
    }
    await this.refresh();
  }

  /** The request for the shown node. */
  private url(): string {
    const path = this.path!;
    const q = new URLSearchParams({ path });
    if (this.node) q.set("node", `${path.slice(0, path.lastIndexOf("/"))}/${this.node}`);
    return `/api/sketch?${q}`;
  }

  /** Fetches the knobs again (after sketch.ts was saved, or the score was written again). */
  async refresh(): Promise<void> {
    const path = this.path;
    const node = this.node;
    if (!path) return this.render();
    const res = await fetch(this.url());
    if (path !== this.path || node !== this.node) return;
    if (res.status === 404) this.state = undefined;
    else if (res.ok) this.state = (await res.json()) as SketchState;
    else this.error = ((await res.json()) as { error: string }).error;
    this.render();
  }

  /** Whether `dir` (an absolute folder path) is the sketch shown, or the piece it is part of. */
  isSketch(dir: string): boolean {
    const s = this.state;
    return s !== undefined && (dir.endsWith(`/${s.dir}`) || dir.endsWith(`/${s.root}`));
  }

  /** The node's place in the piece, if the open score is a piece's. */
  span(node = this.node): OutlineNode | undefined {
    return this.state?.outline?.nodes.find((n) => n.node === node);
  }

  get outline(): Outline | undefined {
    return this.state?.outline;
  }

  /** Where the playhead is (quarters), for the map. */
  setPlayhead(quarters: number): void {
    if (Math.abs(quarters - this.playhead) < 0.05) return;
    this.playhead = quarters;
    this.drawMap();
  }

  /** The open score's measures, for the map's ruler. */
  setMeasures(measures: MapMeasure[]): void {
    this.measures = measures;
    this.drawMap();
  }

  toggle(): void {
    if (!this.state) return;
    this.collapsed = !this.collapsed;
    this.render();
  }

  private showTip(row: HTMLElement): void {
    this.tip.innerHTML = row.dataset.tip!;
    this.tip.hidden = false;
    const r = row.getBoundingClientRect();
    const t = this.tip.getBoundingClientRect();
    this.tip.style.left = `${Math.max(8, r.left - t.width - 10)}px`;
    this.tip.style.top = `${Math.min(window.innerHeight - t.height - 8, Math.max(8, r.top))}px`;
  }

  /** Drags the panel's left edge. */
  private resize(e: PointerEvent): void {
    const handle = e.target as HTMLElement;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const start = this.el.getBoundingClientRect().width;
    let width = start;
    document.body.classList.add("resizing");
    const move = (m: PointerEvent) => {
      width = Math.round(Math.min(760, Math.max(280, start + e.clientX - m.clientX)));
      document.documentElement.style.setProperty("--knobs-width", `${width}px`);
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      document.body.classList.remove("resizing");
      try {
        localStorage.setItem(widthKey, String(width));
      } catch {
        // Not kept.
      }
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  }

  private commit(name: string, value: Value): void {
    const s = this.state;
    if (!s || !(name in s.knobs)) return;
    if (JSON.stringify(s.values[name]) === JSON.stringify(value)) return;
    s.values[name] = value;
    void this.send({ set: { [name]: value } });
  }

  private async send(change: SketchChange): Promise<void> {
    const path = this.path;
    const node = this.node;
    if (!path) return;
    this.busy = true;
    this.el.querySelector(".knobs-busy")?.removeAttribute("hidden");
    const res = await fetch(this.url(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(change),
    });
    const answer = (await res.json()) as SketchState & { error?: string };
    if (path !== this.path || node !== this.node) return;
    this.busy = false;
    if (res.ok) {
      this.state = answer;
      this.error = undefined;
    } else this.error = answer.error;
    this.render();
  }

  //============================================================================
  // The map

  /** The node under a point of the map, deepest first. */
  private mapAt(canvas: HTMLCanvasElement, e: MouseEvent): OutlineNode | undefined {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const hits = this.mapBoxes.filter((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);
    return hits.sort((a, b) => b.node.depth - a.node.depth)[0]?.node;
  }

  private describe(n: OutlineNode): string {
    const bar = (q: number) => {
      let found = this.measures[0];
      for (const m of this.measures) if (m.quarters <= q + 1e-6) found = m;
      return found?.number ?? Math.floor(q / 4) + 1;
    };
    const end = n.at + n.length;
    const lastBar = bar(Math.max(n.at, end - 0.01));
    return [
      n.node || "the whole piece",
      `bars ${bar(n.at)}–${lastBar}`,
      n.uses.length ? `motif: ${n.uses.join(", ")}` : "",
      n.players.join(", "),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  private drawMap(): void {
    const canvas = this.el.querySelector<HTMLCanvasElement>("canvas.map");
    const outline = this.state?.outline;
    if (!canvas || !outline || outline.length <= 0) return;
    const css = getComputedStyle(document.documentElement);
    const colour = (name: string) => css.getPropertyValue(name).trim();
    const font = colour("--sans");
    // Rows: blocks packed into lanes so none overlaps another.
    const deep = outline.nodes.filter((n) => n.depth >= 2).sort((a, b) => a.at - b.at);
    const lanes: number[] = [];
    const laneOf = new Map<OutlineNode, number>();
    for (const n of deep) {
      let lane = lanes.findIndex((end) => end <= n.at + 1e-6);
      if (lane < 0) lane = lanes.push(0) - 1;
      lanes[lane] = n.at + n.length;
      laneOf.set(n, lane);
    }
    const flowH = 26;
    const sectionsY = flowH + 4;
    const blocksY = sectionsY + mapRow + 3;
    const rulerY = blocksY + Math.max(1, lanes.length) * mapRow + 4;
    const height = rulerY + 14;
    const w = canvas.clientWidth || 300;
    canvas.style.height = `${height}px`;
    canvas.width = w * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    const g = canvas.getContext("2d")!;
    g.scale(devicePixelRatio, devicePixelRatio);
    g.clearRect(0, 0, w, height);
    const x = (q: number) => mapPad + (q / outline.length) * (w - 2 * mapPad);
    // The flows, behind: the first filled, the others as lines.
    Object.values(outline.flows).forEach((samples, i) => {
      g.beginPath();
      samples.forEach((v, j) => {
        const px = mapPad + (j / (samples.length - 1)) * (w - 2 * mapPad);
        const py = 2 + (1 - v) * (flowH - 2);
        if (j) g.lineTo(px, py);
        else g.moveTo(px, py);
      });
      if (i === 0) {
        g.lineTo(w - mapPad, flowH);
        g.lineTo(mapPad, flowH);
        g.fillStyle = colour("--accent-soft");
        g.fill();
      } else {
        g.strokeStyle = colour("--faint");
        g.lineWidth = 1;
        g.setLineDash([2, 2]);
        g.stroke();
        g.setLineDash([]);
      }
    });
    g.font = `9px ${font}`;
    g.fillStyle = colour("--faint");
    g.fillText(Object.keys(outline.flows).join(" · "), mapPad + 2, 9);
    // The node shown, the nodes it is inside.
    const shown = this.node;
    const inside = (n: OutlineNode) => shown === n.node || shown.startsWith(`${n.node}/`);
    this.mapBoxes = [];
    const box = (n: OutlineNode, y0: number, fill: string, label: string) => {
      const x0 = x(n.at);
      const x1 = Math.max(x0 + 2, x(n.at + n.length));
      const h = mapRow - 2;
      const on = n.node === shown;
      g.globalAlpha = on ? 1 : 0.85;
      g.fillStyle = on ? colour("--ink") : fill;
      g.beginPath();
      g.roundRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, h, 2);
      g.fill();
      g.globalAlpha = 1;
      if (inside(n) && !on) {
        g.strokeStyle = colour("--ink");
        g.lineWidth = 1;
        g.stroke();
      }
      if (x1 - x0 > 24) {
        g.save();
        g.beginPath();
        g.rect(x0, y0, x1 - x0 - 2, h);
        g.clip();
        g.fillStyle = on ? colour("--paper") : colour("--ink");
        g.font = `10px ${font}`;
        g.fillText(label, x0 + 4, y0 + h - 2.5);
        g.restore();
      }
      this.mapBoxes.push({ node: n, x0, x1, y0, y1: y0 + h });
    };
    for (const n of outline.nodes.filter((n) => n.depth === 1))
      box(n, sectionsY, colour("--hover"), n.node.split("/").at(-1)!);
    for (const n of deep) {
      const form = n.uses[0];
      box(
        n,
        blocksY + laneOf.get(n)! * mapRow,
        form ? `${formColours[form] ?? "#c9ccd2"}55` : "#c9ccd255",
        n.node.split("/").at(-1)!,
      );
    }
    // The whole piece: a click on empty space between rows chooses nothing; the name at the top does.
    this.mapBoxes.push({
      node: outline.nodes[0]!,
      x0: 0,
      x1: w,
      y0: 0,
      y1: flowH,
    });
    // Measures: a tick each, rehearsal letters and every fourth number.
    g.fillStyle = colour("--faint");
    g.font = `9px ${font}`;
    for (const m of this.measures) {
      const mx = x(m.quarters);
      g.fillRect(Math.round(mx), rulerY - 2, 1, m.rehearsal ? 5 : 3);
      if (m.rehearsal) {
        g.fillStyle = colour("--ink");
        g.fillText(m.rehearsal, mx + 2, rulerY + 10);
        g.fillStyle = colour("--faint");
      } else if (m.number % 4 === 1) g.fillText(String(m.number), mx + 2, rulerY + 10);
    }
    // The playhead.
    g.fillStyle = colour("--play");
    g.fillRect(Math.round(x(Math.min(this.playhead, outline.length))) - 1, 0, 2, rulerY);
  }

  //============================================================================
  // Drawing

  private render(): void {
    const s = this.state;
    this.el.hidden = !s || this.collapsed;
    this.onChange?.(s !== undefined);
    if (!s || this.collapsed) {
      this.tip.hidden = true;
      return;
    }
    // Keep keyboard focus on the same knob across a redraw.
    const focused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(".knob")
      ?.dataset.name;
    const scroll = this.el.scrollTop;
    const error = this.error ?? s.error;
    const touched = new Set(s.touched);
    const presets = Object.keys(s.presets);
    const current = presets.find((p) => same(s.presets[p]!, s.values));

    // In a piece: the path from the piece to the node shown, each step a link.
    const steps = s.node ? s.node.split("/") : [];
    const title = s.outline
      ? `<nav class="crumbs" aria-label="Where in the piece">${[
          `<button type="button" data-node="" ${steps.length ? "" : 'aria-current="true"'}>${escapeHtml(s.root.split("/").at(-1)!)}</button>`,
          ...steps.map((name, i) => {
            const node = steps.slice(0, i + 1).join("/");
            const here = i === steps.length - 1;
            return `<span class="sep">/</span><button type="button" data-node="${escapeHtml(node)}" ${here ? 'aria-current="true"' : ""}>${escapeHtml(name)}</button>`;
          }),
        ].join("")}</nav>`
      : `<span class="knobs-title" title="${escapeHtml(s.dir)}">${escapeHtml(s.dir)}</span>`;
    const warnings = s.outline?.warnings ?? [];
    this.el.innerHTML = `
      <div class="knobs-resize" title="Drag to resize"></div>
      <header class="knobs-head">
        ${title}
        <span class="knobs-busy" ${this.busy ? "" : "hidden"} title="Writing the score">●</span>
        <button type="button" class="quiet" data-action="reset" title="Back to the provisional values">Reset</button>
      </header>
      ${
        s.sketch
          ? `<p class="knobs-link">The sketch <code>${escapeHtml(s.sketch)}</code>: its code and its values. Changing a knob here changes the sketch.</p>`
          : ""
      }
      ${
        s.outline
          ? `<div class="map-wrap">
          <canvas class="map" aria-label="The piece's map: click a part to show its knobs"></canvas>
          <div class="map-key">${Object.entries(formColours)
            .map(([f, c]) => `<span style="--dot: ${c}">${f}</span>`)
            .join("")}<span style="--dot: #c9ccd2">harmony, colour</span></div>
          ${warnings.length ? `<ul class="map-warnings">${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>` : ""}
        </div>`
          : ""
      }
      <div class="presets" role="group" aria-label="Presets">
        ${presets
          .map(
            (p) => `<span class="chip${p === current ? " on" : ""}">
              <button type="button" data-load="${escapeHtml(p)}" title="Use these values">${escapeHtml(p)}</button>
              <button type="button" class="x" data-remove="${escapeHtml(p)}" aria-label="Delete ${escapeHtml(p)}" title="Delete">×</button>
            </span>`,
          )
          .join("")}
        ${
          this.naming
            ? `<input id="preset-name" class="chip-input" type="text" placeholder="Name, then Enter" spellcheck="false" />`
            : `<button type="button" class="chip add" data-action="name" title="Save the current values as a preset">+ Save</button>`
        }
      </div>
      ${error ? `<p class="knobs-error">${escapeHtml(error)}</p>` : ""}
      <div class="knob-list"></div>
      <p class="knobs-legend"><span class="prov"></span>provisional: Claude's value, not moved yet</p>`;

    const list = this.el.querySelector<HTMLElement>(".knob-list")!;
    const flows = Object.keys(s.outline?.flows ?? {});
    const ctx = (name: string): Context => ({
      commit: (v) => this.commit(name, v),
      knobs: s.knobs,
      values: s.values,
      flows,
    });
    let group: string | undefined;
    for (const [name, k] of Object.entries(s.knobs)) {
      if (k.group !== group) {
        group = k.group;
        if (group) {
          const g = document.createElement("h3");
          g.className = "group";
          g.textContent = group;
          list.append(g);
        }
      }
      const control = controls[k.kind] as (typeof controls)["number"];
      const provisional = !touched.has(name);
      const row = document.createElement("div");
      row.className = `knob${control.wide ? " wide" : ""}`;
      row.dataset.name = name;
      row.dataset.tip = `<b>${escapeHtml(k.label)}</b>${
        k.help ? `<p>${escapeHtml(k.help)}</p>` : ""
      }<p class="how">${escapeHtml(typeof control.how === "function" ? control.how(k as never) : control.how)}</p>${
        provisional
          ? `<p class="how"><span class="prov"></span>Claude's value, not moved yet</p>`
          : ""
      }`;
      const label = document.createElement("label");
      label.textContent = k.label;
      if (provisional) {
        const dot = document.createElement("span");
        dot.className = "prov";
        label.append(dot);
      }
      const host = document.createElement("div");
      host.className = "control";
      row.append(label, host);
      list.append(row);
      control.mount(host, k as never, s.values[name] as never, ctx(name));
    }
    this.el.scrollTop = scroll;
    this.drawMap();
    if (focused)
      this.el
        .querySelector<HTMLElement>(
          `.knob[data-name="${CSS.escape(focused)}"] [tabindex], .knob[data-name="${CSS.escape(focused)}"] button`,
        )
        ?.focus();
  }
}

// The map: rows are the flows, the sections, then the blocks inside them (as many rows as they
// need not to overlap), over the piece's measures.
const mapRow = 13;
const mapPad = 6;

const same = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  Object.keys(b).every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));

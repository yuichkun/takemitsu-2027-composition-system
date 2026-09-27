// The knob panel: shown beside the score when the open score belongs to a sketch
// (src/sketch/knobs.ts, src/preview/sketches.ts). One row per knob, grouped as the sketch groups
// them; each kind draws itself (knobs/controls.ts). A change is sent when it is finished; the
// server writes the sketch's score again and the preview picks it up like any save, keeping the
// playhead where it is.
//
// Hovering a row shows what the knob is for and how to use it. The panel's left edge drags to
// resize it (remembered by the browser).

import type { Value } from "../sketch/knobs.ts";
import { controls, type Context } from "./knobs/controls.ts";
import type { SketchChange, SketchState } from "./sketches.ts";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const widthKey = "takemitsu.knobs-width";

export class KnobPanel {
  private path: string | undefined;
  private state: SketchState | undefined;
  private busy = false;
  private error: string | undefined;
  private naming = false;
  /** Hidden with K (or the toolbar button) while a sketch is open. */
  collapsed = false;
  /** Called when the panel appears or goes, so the page can show its toolbar button. */
  onChange?: (isSketch: boolean) => void;

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
      const b = (e.target as HTMLElement).closest("button");
      if (!b) return;
      if (b.dataset.load) void this.send({ load: b.dataset.load });
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
  }

  /** The score now open; the panel shows if it is a sketch's. */
  async show(path: string | undefined): Promise<void> {
    this.path = path;
    this.state = undefined;
    this.error = undefined;
    this.naming = false;
    await this.refresh();
  }

  /** Fetches the knobs again (after sketch.ts was saved). */
  async refresh(): Promise<void> {
    const path = this.path;
    if (!path) return this.render();
    const res = await fetch(`/api/sketch?path=${encodeURIComponent(path)}`);
    if (path !== this.path) return;
    if (res.status === 404) this.state = undefined;
    else if (res.ok) this.state = (await res.json()) as SketchState;
    else this.error = ((await res.json()) as { error: string }).error;
    this.render();
  }

  /** Whether the open score is the sketch in `dir` (an absolute folder path). */
  isSketch(dir: string): boolean {
    return this.state !== undefined && dir.endsWith(`/${this.state.dir}`);
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
    if (!path) return;
    this.busy = true;
    this.el.querySelector(".knobs-busy")?.removeAttribute("hidden");
    const res = await fetch(`/api/sketch?path=${encodeURIComponent(path)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(change),
    });
    const answer = (await res.json()) as SketchState & { error?: string };
    if (path !== this.path) return;
    this.busy = false;
    if (res.ok) {
      this.state = answer;
      this.error = undefined;
    } else this.error = answer.error;
    this.render();
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

    this.el.innerHTML = `
      <div class="knobs-resize" title="Drag to resize"></div>
      <header class="knobs-head">
        <span class="knobs-title" title="sketches/${escapeHtml(s.dir)}">${escapeHtml(s.dir)}</span>
        <span class="knobs-busy" ${this.busy ? "" : "hidden"} title="Writing the score">●</span>
        <button type="button" class="quiet" data-action="reset" title="Back to the provisional values">Reset</button>
      </header>
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
    const ctx = (name: string): Context => ({
      commit: (v) => this.commit(name, v),
      knobs: s.knobs,
      values: s.values,
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
      }<p class="how">${escapeHtml(control.how)}</p>${
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
    if (focused)
      this.el
        .querySelector<HTMLElement>(
          `.knob[data-name="${CSS.escape(focused)}"] [tabindex], .knob[data-name="${CSS.escape(focused)}"] button`,
        )
        ?.focus();
  }
}

const same = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  Object.keys(b).every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));

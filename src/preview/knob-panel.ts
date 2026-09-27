// The knob panel: shown beside the score when the open score belongs to a sketch
// (src/sketch/knobs.ts, src/preview/sketches.ts). A change is sent when it is committed (a slider
// let go, Enter, leaving a field, a choice picked); the server writes the sketch's score again and
// the preview picks the new score up like any save, keeping the playhead where it is.

import type { Knob } from "../sketch/knobs.ts";
import type { SketchChange, SketchState } from "./sketches.ts";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export class KnobPanel {
  private path: string | undefined;
  private state: SketchState | undefined;
  private busy = false;
  private error: string | undefined;
  /** Shown or hidden with K; remembered while the page is open. */
  collapsed = false;
  onShown?: () => void;

  private readonly el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    el.addEventListener("change", (e) => this.changed(e.target as HTMLElement));
    el.addEventListener("input", (e) => {
      // A slider and its number field move together while dragging; the change is sent on release.
      const t = e.target as HTMLInputElement;
      const pair =
        t.dataset.knob &&
        this.el.querySelectorAll<HTMLInputElement>(`[data-knob="${t.dataset.knob}"]`);
      if (pair) for (const other of pair) if (other !== t) other.value = t.value;
    });
    el.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (!b) return;
      if (b.dataset.load) void this.send({ load: b.dataset.load });
      else if (b.dataset.remove) void this.send({ remove: b.dataset.remove });
      else if (b.dataset.action === "reset") void this.send({ reset: true });
      else if (b.dataset.action === "save") this.save();
      else if (b.dataset.action === "collapse") this.toggle();
    });
    el.addEventListener("keydown", (e) => {
      const t = e.target as HTMLInputElement;
      if (e.key === "Enter" && t.id === "preset-name") this.save();
      else if (e.key === "Enter" && t instanceof HTMLInputElement) t.blur();
    });
  }

  /** The score now open; the panel shows if it is a sketch's. */
  async show(path: string | undefined): Promise<void> {
    this.path = path;
    this.state = undefined;
    this.error = undefined;
    await this.refresh();
  }

  /** Fetches the knobs again (after sketch.ts was saved, or the score changed). */
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

  /** Whether the open score is a sketch's (its folder's absolute path ends with `dir`). */
  isSketch(dir: string): boolean {
    return this.state !== undefined && dir.endsWith(`/${this.state.dir}`);
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
    this.render();
  }

  private save(): void {
    const input = this.el.querySelector<HTMLInputElement>("#preset-name");
    const name = input?.value.trim();
    if (name) void this.send({ save: name });
  }

  private changed(t: HTMLElement): void {
    if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;
    const name = t.dataset.knob;
    const knob = name ? this.state?.knobs[name] : undefined;
    if (!name || !knob) return;
    const value = knob.kind === "number" ? Number(t.value) : t.value;
    if (knob.kind === "number" && !Number.isFinite(value)) return;
    if (this.state?.values[name] === value) return;
    void this.send({ set: { [name]: value } });
  }

  private async send(change: SketchChange): Promise<void> {
    const path = this.path;
    if (!path) return;
    this.busy = true;
    this.render();
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

  private render(): void {
    const s = this.state;
    this.el.hidden = !s;
    document.body.classList.toggle("knobs-collapsed", this.collapsed);
    if (!s) return;
    const error = this.error ?? s.error;
    const touched = new Set(s.touched);
    const head = `
      <div class="knobs-head">
        <span>つまみ</span>
        <span class="knobs-sketch" title="sketches/${escapeHtml(s.dir)}">${escapeHtml(s.dir)}</span>
        <span class="knobs-busy">${this.busy ? "書き直し中…" : ""}</span>
        <button type="button" data-action="collapse" title="つまみの欄をたたむ / ひらく（K）">${this.collapsed ? "ひらく" : "たたむ"}</button>
      </div>`;
    if (this.collapsed) {
      this.el.innerHTML = head;
      return;
    }
    const knobs = Object.entries(s.knobs)
      .map(([name, k]) => this.knobHtml(name, k, s.values[name]!, !touched.has(name)))
      .join("");
    const presets = Object.keys(s.presets);
    this.el.innerHTML = `${head}
      ${error ? `<p class="knobs-error">${escapeHtml(error)}</p>` : ""}
      <div class="knob-list">${knobs}</div>
      <section class="presets">
        <h3>保存した組</h3>
        ${
          presets.length
            ? `<ul>${presets
                .map(
                  (p) => `<li class="${same(s.presets[p]!, s.values) ? "current" : ""}">
                    <button type="button" data-load="${escapeHtml(p)}" title="この組にする">${escapeHtml(p)}</button>
                    <button type="button" class="remove" data-remove="${escapeHtml(p)}" title="この組を消す" aria-label="${escapeHtml(p)} を消す">×</button>
                  </li>`,
                )
                .join("")}</ul>`
            : `<p class="knobs-note">まだない</p>`
        }
        <div class="save-row">
          <input id="preset-name" type="text" placeholder="今の値に名前を付ける" />
          <button type="button" data-action="save">保存</button>
        </div>
        <button type="button" class="reset" data-action="reset" title="僕が置いた値（仮）に全部戻す">仮の値に戻す</button>
      </section>`;
  }

  private knobHtml(name: string, k: Knob, value: number | string, provisional: boolean): string {
    const id = `knob-${name}`;
    const label = `<label for="${id}">${escapeHtml(k.label)}${
      provisional
        ? ` <span class="prov" title="僕が仮に置いた値。まだ誰も動かしていない">仮</span>`
        : ""
    }</label>`;
    let control: string;
    if (k.kind === "number") {
      const attrs = `min="${k.min}" max="${k.max}" step="${k.step}" value="${value}" data-knob="${name}"`;
      control = `<div class="number-row">
        <input type="range" ${attrs} aria-label="${escapeHtml(k.label)}" />
        <input id="${id}" type="number" ${attrs} />
        ${k.unit ? `<span class="unit">${escapeHtml(k.unit)}</span>` : ""}
      </div>`;
    } else if (k.kind === "choice") {
      control = `<select id="${id}" data-knob="${name}">${k.options
        .map((o) => `<option${o === value ? " selected" : ""}>${escapeHtml(o)}</option>`)
        .join("")}</select>`;
    } else {
      control = `<input id="${id}" type="text" value="${escapeHtml(String(value))}" data-knob="${name}"${
        k.hint ? ` placeholder="${escapeHtml(k.hint)}"` : ""
      } spellcheck="false" />`;
    }
    return `<div class="knob">${label}${control}</div>`;
  }
}

const same = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  Object.keys(b).every((k) => a[k] === b[k]);

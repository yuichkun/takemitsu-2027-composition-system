// The knob panel: shown beside the score when the open score belongs to a sketch
// (src/sketch/knobs.ts, src/preview/sketches.ts). One row per knob, grouped as the sketch groups
// them. A change is sent when it is committed; the server writes the sketch's score again and the
// preview picks the new score up like any save, keeping the playhead where it is.
//
// Numbers are values you drag sideways (or step with ↑↓, Shift for ×10, or click to type); a few
// short choices are a segmented control; text is a plain field.

import type { ChoiceKnob, Knob, NumberKnob } from "../sketch/knobs.ts";
import type { SketchChange, SketchState } from "./sketches.ts";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Pixels of drag per step. */
const pxPerStep = 6;

const decimals = (step: number) => (String(step).split(".")[1] ?? "").length;
const clamp = (k: NumberKnob, v: number) =>
  Math.min(
    k.max,
    Math.max(k.min, Number((Math.round(v / k.step) * k.step).toFixed(decimals(k.step)))),
  );
const format = (k: NumberKnob, v: number) => v.toFixed(decimals(k.step));
const segmented = (k: ChoiceKnob) =>
  k.options.length <= 4 && k.options.every((o) => o.length <= 10);

export class KnobPanel {
  private path: string | undefined;
  private state: SketchState | undefined;
  private busy = false;
  private error: string | undefined;
  private naming = false;
  private stepTimer = 0;
  /** Hidden with K (or the toolbar button) while a sketch is open. */
  collapsed = false;
  /** Called when the panel appears or goes, so the page can show its toolbar button. */
  onChange?: (isSketch: boolean) => void;

  private readonly el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    el.addEventListener("change", (e) => {
      const t = e.target as HTMLElement;
      if (
        t instanceof HTMLSelectElement ||
        (t instanceof HTMLInputElement && t.classList.contains("text"))
      )
        this.commit(t.dataset.knob!, t.value);
    });
    el.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (!b) return;
      if (b.dataset.option !== undefined) this.commit(b.dataset.knob!, b.dataset.option);
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
      if (t.id === "preset-name") {
        if (e.key === "Enter") {
          const name = (t as HTMLInputElement).value.trim();
          this.naming = false;
          if (name) void this.send({ save: name });
          else this.render();
        } else if (e.key === "Escape") {
          this.naming = false;
          this.render();
        }
        return;
      }
      if (t instanceof HTMLInputElement && e.key === "Enter") t.blur();
      if (t.classList.contains("scrub")) this.scrubKey(t, e);
    });
    el.addEventListener("focusout", (e) => {
      if ((e.target as HTMLElement).id === "preset-name" && this.naming) {
        this.naming = false;
        this.render();
      }
    });
    el.addEventListener("pointerdown", (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>(".scrub");
      if (t && e.button === 0) this.scrubDrag(t, e);
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

  //============================================================================
  // Numbers: drag, keys, typing

  private numberKnob(name: string): NumberKnob | undefined {
    const k = this.state?.knobs[name];
    return k?.kind === "number" ? k : undefined;
  }

  private shown(el: HTMLElement, k: NumberKnob, v: number): void {
    el.querySelector(".v")!.textContent = format(k, v);
    el.dataset.value = String(v);
  }

  private scrubDrag(el: HTMLElement, e: PointerEvent): void {
    const name = el.dataset.knob!;
    const k = this.numberKnob(name);
    if (!k) return;
    e.preventDefault();
    el.focus();
    const x0 = e.clientX;
    const start = Number(el.dataset.value);
    let moved = false;
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");
    const move = (m: PointerEvent) => {
      const dx = m.clientX - x0;
      if (!moved && Math.abs(dx) < 3) return;
      moved = true;
      const factor = m.shiftKey ? 10 : 1;
      this.shown(el, k, clamp(k, start + Math.round(dx / pxPerStep) * k.step * factor));
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.classList.remove("dragging");
      if (moved) this.commit(name, Number(el.dataset.value));
      else this.edit(el, k);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  private scrubKey(el: HTMLElement, e: KeyboardEvent): void {
    const name = el.dataset.knob!;
    const k = this.numberKnob(name);
    if (!k) return;
    const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (e.key === "Enter") {
      e.preventDefault();
      this.edit(el, k);
      return;
    }
    if (!dir) return;
    e.preventDefault();
    this.shown(el, k, clamp(k, Number(el.dataset.value) + dir * k.step * (e.shiftKey ? 10 : 1)));
    // Held keys send once they rest.
    clearTimeout(this.stepTimer);
    this.stepTimer = window.setTimeout(() => this.commit(name, Number(el.dataset.value)), 450);
  }

  /** Click (or Enter): type the value. */
  private edit(el: HTMLElement, k: NumberKnob): void {
    const input = document.createElement("input");
    input.className = "scrub-input";
    input.value = format(k, Number(el.dataset.value));
    input.setAttribute("aria-label", k.label);
    el.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (keep: boolean) => {
      if (done) return;
      done = true;
      const v = Number(input.value);
      if (keep && Number.isFinite(v)) this.commit(el.dataset.knob!, clamp(k, v));
      else this.render();
    };
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") finish(true);
      else if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
  }

  //============================================================================

  private commit(name: string, value: number | string): void {
    const s = this.state;
    if (!s || !(name in s.knobs)) return;
    if (s.values[name] === value) return this.render();
    s.values[name] = value;
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

  //============================================================================
  // Drawing

  private render(): void {
    const s = this.state;
    this.el.hidden = !s || this.collapsed;
    this.onChange?.(s !== undefined);
    if (!s || this.collapsed) return;
    // Keep keyboard focus on the same knob across a redraw.
    const focused = (document.activeElement as HTMLElement | null)?.dataset?.knob;
    const error = this.error ?? s.error;
    const touched = new Set(s.touched);
    const presets = Object.keys(s.presets);
    const current = presets.find((p) => same(s.presets[p]!, s.values));

    let rows = "";
    let group: string | undefined;
    for (const [name, k] of Object.entries(s.knobs)) {
      if (k.group !== group) {
        group = k.group;
        if (group) rows += `<h3 class="group">${escapeHtml(group)}</h3>`;
      }
      rows += this.row(name, k, s.values[name]!, !touched.has(name));
    }

    this.el.innerHTML = `
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
      <div class="knob-list">${rows}</div>
      <p class="knobs-legend"><span class="prov"></span>provisional: Claude's value, not moved yet</p>`;
    if (focused)
      this.el
        .querySelector<HTMLElement>(`[data-knob="${CSS.escape(focused)}"]:not(button)`)
        ?.focus();
  }

  private row(name: string, k: Knob, value: number | string, provisional: boolean): string {
    const id = `knob-${name}`;
    const help = k.help ? ` title="${escapeHtml(k.help)}"` : "";
    const label = `<label for="${id}"${help}>${escapeHtml(k.label)}${
      provisional
        ? `<span class="prov" title="Provisional: Claude's value, not moved yet"></span>`
        : ""
    }</label>`;
    let control: string;
    if (k.kind === "number") {
      const v = Number(value);
      control = `<div id="${id}" class="scrub" tabindex="0" role="spinbutton" data-knob="${name}" data-value="${v}"
        aria-valuemin="${k.min}" aria-valuemax="${k.max}" aria-valuenow="${v}" aria-label="${escapeHtml(k.label)}"
        title="Drag sideways or ↑↓ (Shift ×10); click to type"><span class="v">${format(k, v)}</span>${
          k.unit ? `<span class="u">${escapeHtml(k.unit)}</span>` : ""
        }</div>`;
    } else if (k.kind === "choice" && segmented(k)) {
      control = `<div id="${id}" class="seg" role="radiogroup" aria-label="${escapeHtml(k.label)}">${k.options
        .map(
          (o) =>
            `<button type="button" role="radio" aria-checked="${o === value}" data-knob="${name}" data-option="${escapeHtml(o)}">${escapeHtml(o)}</button>`,
        )
        .join("")}</div>`;
    } else if (k.kind === "choice") {
      control = `<select id="${id}" class="select" data-knob="${name}">${k.options
        .map((o) => `<option${o === value ? " selected" : ""}>${escapeHtml(o)}</option>`)
        .join("")}</select>`;
    } else {
      control = `<input id="${id}" class="text" type="text" value="${escapeHtml(String(value))}" data-knob="${name}"${
        k.hint ? ` placeholder="${escapeHtml(k.hint)}"` : ""
      } spellcheck="false" />`;
    }
    return `<div class="knob${k.kind === "text" ? " wide" : ""}">${label}${control}</div>`;
  }
}

const same = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  Object.keys(b).every((k) => a[k] === b[k]);

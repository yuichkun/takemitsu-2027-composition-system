// Shared track selection and visibility for the score and mixer. Visibility never changes audio.
import type { NotationView } from "./notation-thread.ts";

export type Track = NotationView["parts"][number];
type Modifiers = { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean };
export class TrackState {
  parts: Track[] = [];
  selected = new Set<string>();
  hidden = new Set<string>();
  anchor?: string;

  setParts(parts: Track[]): void {
    this.parts = parts;
    const ids = new Set(parts.map((p) => p.id));
    this.selected = new Set([...this.selected].filter((id) => ids.has(id)));
    this.hidden = new Set([...this.hidden].filter((id) => ids.has(id)));
    if (this.anchor && !ids.has(this.anchor)) this.anchor = undefined;
  }
  select(id: string, modifiers: Modifiers = {}, order = this.parts.map((p) => p.id)): void {
    const additive = modifiers.metaKey || modifiers.ctrlKey;
    if (modifiers.shiftKey && this.anchor && order.includes(this.anchor) && order.includes(id)) {
      const a = order.indexOf(this.anchor),
        b = order.indexOf(id);
      const range = order.slice(Math.min(a, b), Math.max(a, b) + 1);
      this.selected = new Set(additive ? [...this.selected, ...range] : range);
    } else if (additive) {
      if (this.selected.has(id)) this.selected.delete(id);
      else this.selected.add(id);
      this.anchor = id;
    } else {
      this.selected = new Set([id]);
      this.anchor = id;
    }
  }
  selectGroup(instrument: string, additive = false): void {
    const ids = this.parts.filter((p) => p.instrument === instrument).map((p) => p.id);
    if (!additive) this.selected = new Set(ids);
    else if (ids.every((id) => this.selected.has(id)))
      ids.forEach((id) => this.selected.delete(id));
    else ids.forEach((id) => this.selected.add(id));
    this.anchor = ids[0];
  }
  onlySelected(): void {
    if (this.selected.size)
      this.hidden = new Set(this.parts.filter((p) => !this.selected.has(p.id)).map((p) => p.id));
  }
  setVisible(id: string, visible: boolean): void {
    if (visible) this.hidden.delete(id);
    else {
      this.hidden.add(id);
      this.selected.delete(id);
      if (this.anchor === id) this.anchor = undefined;
    }
  }
  visible(id: string): boolean {
    return !this.hidden.has(id);
  }
  hiddenIds(): string[] {
    return [...this.hidden].sort();
  }
  targets(id: string): string[] {
    if (!this.visible(id)) return [];
    return this.selected.has(id) ? [...this.selected] : [id];
  }
}

interface Hooks {
  selection: () => void;
  visibility: () => void;
}
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export class TrackPanel {
  readonly state = new TrackState();
  private path = "";
  private signature = "";
  private search: HTMLInputElement;
  private list: HTMLElement;
  private summary: HTMLElement;
  private query = "";
  private el: HTMLElement;
  private hooks: Hooks;

  constructor(el: HTMLElement, hooks: Hooks) {
    this.el = el;
    this.hooks = hooks;
    el.innerHTML = `
      <input class="track-search" type="search" placeholder="Find a track…" aria-label="Find a track" />
      <div class="track-actions" aria-label="Track selection">
        <button type="button" data-action="select-all">Select all</button><button type="button" data-action="clear">Clear selection</button>
      </div>
      <div class="track-actions" aria-label="Track visibility">
        <button type="button" data-action="only" data-needs-selection>Only selected</button>
        <button type="button" data-action="hide" data-needs-selection>Hide selected</button>
        <button type="button" data-action="show-all">Show all</button>
      </div>
      <p class="track-summary" aria-live="polite"></p>
      <p class="hint track-hint">Select and show tracks here; adjust them in Mixer.<br>⌘/Ctrl-click to add · Shift-click for a range.</p>
      <div class="track-list"></div>`;
    this.search = el.querySelector<HTMLInputElement>(".track-search")!;
    this.list = el.querySelector(".track-list")!;
    this.summary = el.querySelector(".track-summary")!;
    this.search.addEventListener("input", () => {
      this.query = this.search.value.toLowerCase().trim();
      this.build();
    });
    el.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!button) return;
      const { action, id, instrument } = button.dataset;
      if (id) {
        if (action === "visible") {
          this.state.setVisible(id, !this.state.visible(id));
          this.changed(true);
        } else if (action === "select") this.select(id, event);
      } else if (instrument) {
        event.preventDefault();
        this.state.selectGroup(instrument, event.metaKey || event.ctrlKey);
        this.changed(false);
      } else if (action === "select-all") {
        this.state.selected = new Set(this.matches().map((p) => p.id));
        this.changed(false);
      } else if (action === "clear") {
        this.state.selected.clear();
        this.changed(false);
      } else if (action === "only") {
        this.state.onlySelected();
        this.changed(true);
      } else if (action === "hide") {
        [...this.state.selected].forEach((id) => this.state.setVisible(id, false));
        this.changed(true);
      } else if (action === "show-all") {
        this.state.hidden.clear();
        this.changed(true);
      }
    });
  }
  open(path: string): void {
    this.path = path;
    this.signature = "";
    this.state.parts = [];
    this.state.hidden.clear();
    this.state.selected.clear();
    this.state.anchor = undefined;
    this.query = "";
    this.search.value = "";
    try {
      const value = JSON.parse(localStorage.getItem(`takemitsu.tracks:${path}`) ?? "{}");
      const ids = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
      this.state.hidden = new Set(ids(value.hidden));
      this.state.selected = new Set(ids(value.selected));
    } catch {
      /* Missing or invalid preferences start with every track visible. */
    }
    this.build();
  }
  setParts(parts: Track[]): void {
    this.state.setParts(parts);
    const signature = JSON.stringify(parts);
    if (signature !== this.signature) {
      this.signature = signature;
      this.build();
    } else this.sync();
  }
  select(id: string, modifiers: Modifiers, order?: string[]): void {
    this.state.select(id, modifiers, order ?? this.matches().map((p) => p.id));
    this.changed(false);
  }
  private matches(): Track[] {
    return this.state.parts.filter((p) =>
      `${p.name} ${p.id} ${p.group}`.toLowerCase().includes(this.query),
    );
  }
  private changed(visibility: boolean): void {
    try {
      localStorage.setItem(
        `takemitsu.tracks:${this.path}`,
        JSON.stringify({ hidden: this.state.hiddenIds(), selected: [...this.state.selected] }),
      );
    } catch {
      /* Session still works. */
    }
    this.sync();
    if (visibility) this.hooks.visibility();
    else this.hooks.selection();
  }
  private build(): void {
    const opened = new Set(
      [...this.list.querySelectorAll<HTMLDetailsElement>("details[open]")].map(
        (d) => d.dataset.group,
      ),
    );
    const fresh = !this.list.querySelector("details");
    const groups = new Map<string, Track[]>();
    for (const p of this.matches())
      groups.set(p.instrument, [...(groups.get(p.instrument) ?? []), p]);
    this.list.innerHTML =
      [...groups]
        .map(
          ([
            id,
            parts,
          ]) => `<details data-group="${esc(id)}" ${opened.has(id) || fresh || this.query ? "open" : ""}>
      <summary><button type="button" data-instrument="${esc(id)}" title="Select every ${esc(parts[0]!.group)} track">${esc(parts[0]!.group)} <span>${this.state.parts.filter((p) => p.instrument === id).length}</span></button></summary>
      ${parts
        .map(
          (p) => `<div class="track-row" data-track="${esc(p.id)}">
        <button type="button" data-action="visible" data-id="${esc(p.id)}" class="track-eye"></button>
        <button type="button" data-action="select" data-id="${esc(p.id)}" class="track-name" title="${esc(p.name)} · ${esc(p.id)} · ${p.players} player(s)">${esc(p.name)}<small>${esc(p.id)}</small></button>
      </div>`,
        )
        .join("")}</details>`,
        )
        .join("") || '<p class="hint">No matching tracks</p>';
    this.sync();
  }
  sync(): void {
    const visible = this.state.parts.filter((p) => this.state.visible(p.id)).length;
    this.summary.textContent = `${this.state.selected.size} selected · ${visible}/${this.state.parts.length} visible`;
    for (const b of this.el.querySelectorAll<HTMLButtonElement>("[data-needs-selection]"))
      b.disabled = this.state.selected.size === 0;
    for (const row of this.list.querySelectorAll<HTMLElement>(".track-row")) {
      const id = row.dataset.track!;
      row.classList.toggle("selected", this.state.selected.has(id));
      row.classList.toggle("track-hidden", !this.state.visible(id));
      const select = row.querySelector<HTMLButtonElement>('[data-action="select"]')!;
      select.setAttribute("aria-pressed", String(this.state.selected.has(id)));
      const eye = row.querySelector<HTMLButtonElement>('[data-action="visible"]')!;
      const visible = this.state.visible(id);
      if (eye.dataset.visible !== String(visible)) {
        eye.dataset.visible = String(visible);
        eye.innerHTML = `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 10c4-7 12-7 16 0-4 7-12 7-16 0Z"/><circle cx="10" cy="10" r="2.5"/>${visible ? "" : '<path d="m3 3 14 14"/>'}</svg>`;
      }
      eye.setAttribute("aria-pressed", String(this.state.visible(id)));
      eye.setAttribute("aria-label", `${this.state.visible(id) ? "Hide" : "Show"} ${id}`);
      eye.title = `${this.state.visible(id) ? "Hide" : "Show"} in score and mixer (audio unchanged)`;
    }
    for (const b of this.list.querySelectorAll<HTMLButtonElement>("[data-instrument]")) {
      const own = this.state.parts.filter((p) => p.instrument === b.dataset.instrument);
      b.setAttribute(
        "aria-pressed",
        String(own.length > 0 && own.every((p) => this.state.selected.has(p.id))),
      );
    }
  }
}

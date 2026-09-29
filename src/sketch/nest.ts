// Pieces made of sketches (docs/architecture.md, "Pieces").
//
// A node is a folder with sketch.ts; the folders under it that have a sketch.ts are its children,
// and a piece is a node with children (pieces/<name>/). A node's `score(values, ctx)` writes its
// music in its own time (0 = where it starts) and hands it back as a Fragment. A parent places each
// child, like a patcher inside a patcher: where it starts and how long it lasts, and what it passes
// down besides what every child inherits (the piece's flows, its material and players, the centre
// it is in, what the node before it left). The piece at the top turns it all into the score, with
// an outline of where every node is, which the preview draws as the piece's map.
//
// Plain sketches (sketches/) are nodes without children: their score(values) returns a whole Score
// and never looks at the context.

import { parsePitch } from "../score/pitch.ts";
import type {
  DynamicPoint,
  Event,
  NoteEvent,
  Outline,
  OutlineNode,
  Pitch,
  Score,
  Time,
} from "../score/types.ts";
import { envelopeAt, type Auto } from "./knobs.ts";
import { Motif } from "./motif.ts";

/** A player of the piece's ensemble: a part of the score. */
export interface Player {
  id: string;
  instrument: string;
  name: string;
  abbreviation?: string;
  /** 1 for a solo string player (docs/decisions/0015). */
  players?: number;
  /** Who plays it, when one player plays several parts (a flute and a piccolo): see Part.player. */
  player?: string;
}

/** What the piece gives every node to make its music from. The piece may add more. */
export interface Material {
  motif: Motif;
  [name: string]: unknown;
}

/** What a node leaves for the one after it: each player's last pitches, and when they ended. */
export interface EndState {
  last: Record<string, { pitches: number[]; end: number }>;
}

/** A point a node marks for its parent (a phrase's start, a climax), in the node's time. */
export interface Mark {
  at: number;
  label: string;
  /** Where the harmony is there, in semitones from the node's centre (a phrase's step, say). */
  shift?: number;
}

/** What a node writes: each player's events and dynamics, in the node's own time. */
export interface Fragment {
  parts: Record<string, { events: Event[]; dynamics: DynamicPoint[] }>;
  end: EndState;
  /** Forms of the motif it plays (the map colours by them). */
  uses: string[];
  marks: Mark[];
}

/** Where a parent puts a child, and what it passes down besides what the child inherits. */
export interface Placement {
  /** Start, in the parent's time, and length, in quarters. */
  at: number;
  length: number;
  /** Semitones from the motif as written (default: the parent's centre). */
  centre?: number;
  /** What the node before it left (to start from its pitches, say). */
  prev?: EndState;
  /** Anything else the child reads (a sibling's marks, say). */
  params?: Record<string, unknown>;
}

export interface Placed {
  name: string;
  at: number;
  length: number;
  fragment: Fragment;
}

/** A node read from its folder, with its children (src/sketch/run.ts). */
export interface LoadedNode {
  name: string;
  /** Its folder from the piece's folder ("" for the piece). */
  path: string;
  score: (values: Record<string, unknown>, ctx: Context) => unknown;
  values: Record<string, unknown>;
  children: Map<string, LoadedNode>;
}

type Flow = (quarters: number) => number;

interface Shared {
  outline: OutlineNode[];
  warnings: string[];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const at = (t: Time) => (typeof t === "number" ? t : t[0] / t[1]);
/** A time moved by a number of quarters, exact fractions kept when they can be. */
export function later(t: Time, by: number): Time {
  if (typeof t === "number") return t + by;
  const n = t[0] + by * t[1];
  return Number.isInteger(n) ? [n, t[1]] : at(t) + by;
}
const midiOf = (p: Pitch) => parsePitch(p).midi;
/** Snapped to 1/48 of a quarter: fine enough for any rhythm a node means, exact for the score. */
export const grid = (x: number) => Math.round(x * 48) / 48;

export class Context {
  /** Where the node starts in the piece, and how long it lasts (quarters). */
  readonly start: number;
  readonly length: number;
  /** Its folder from the piece's ("" for the piece), and how deep it is (0 for the piece). */
  readonly path: string;
  readonly depth: number;
  readonly ensemble: readonly Player[];
  readonly material: Material;
  /** The piece's flows, each a height 0–1 at a time from the start of the piece. */
  readonly flows: Readonly<Record<string, Flow>>;
  /** Semitones from the motif as written: the harmonic centre the node is in. */
  readonly centre: number;
  readonly prev: EndState | undefined;
  readonly params: Readonly<Record<string, unknown>>;
  private readonly node: LoadedNode;
  private readonly shared: Shared;

  constructor(init: {
    start: number;
    length: number;
    path: string;
    depth: number;
    ensemble: readonly Player[];
    material: Material;
    flows: Readonly<Record<string, Flow>>;
    centre: number;
    prev?: EndState;
    params: Readonly<Record<string, unknown>>;
    node: LoadedNode;
    shared: Shared;
  }) {
    this.start = init.start;
    this.length = init.length;
    this.path = init.path;
    this.depth = init.depth;
    this.ensemble = init.ensemble;
    this.material = init.material;
    this.flows = init.flows;
    this.centre = init.centre;
    this.prev = init.prev;
    this.params = init.params;
    this.node = init.node;
    this.shared = init.shared;
  }

  /** The context of a node run on its own (the top of the tree). */
  static root(node: LoadedNode): Context {
    return new Context({
      start: 0,
      length: 0,
      path: node.path,
      depth: 0,
      ensemble: [],
      material: { motif: new Motif([{ at: 0, dur: 1, midi: 60 }]) },
      flows: {},
      centre: 0,
      params: {},
      node,
      shared: { outline: [], warnings: [] },
    });
  }

  /** The same node with some of what its children inherit replaced (the piece sets these). */
  with(changes: {
    ensemble?: readonly Player[];
    material?: Material;
    flows?: Readonly<Record<string, Flow>>;
    centre?: number;
    length?: number;
  }): Context {
    return new Context({ ...this.fields(), ...changes });
  }

  private fields() {
    return {
      start: this.start,
      length: this.length,
      path: this.path,
      depth: this.depth,
      ensemble: this.ensemble,
      material: this.material,
      flows: this.flows,
      centre: this.centre,
      prev: this.prev,
      params: this.params,
      node: this.node,
      shared: this.shared,
    };
  }

  /** A flow's height (0–1) at a time in this node (quarters from its start). */
  flow(name: string, t: number): number {
    const f = this.flows[name];
    if (!f)
      throw new Error(
        `No flow "${name}" (the piece has ${Object.keys(this.flows).join(", ") || "none"})`,
      );
    return clamp01(f(this.start + t));
  }

  /** A follow knob's value at a time in this node. */
  value(v: Auto, t: number): number {
    if (typeof v === "number") return v;
    const x =
      v.follow === "ramp"
        ? this.length > 0
          ? clamp01(t / this.length)
          : 0
        : this.flows[v.follow]
          ? this.flow(v.follow, t)
          : 0;
    return v.from + (v.to - v.from) * x;
  }

  player(id: string): Player {
    const p = this.ensemble.find((x) => x.id === id);
    if (!p)
      throw new Error(
        `No player "${id}" in the ensemble (${this.ensemble.map((x) => x.id).join(", ")})`,
      );
    return p;
  }

  /** A player by the name a knob shows ("Clarinet"), or by id. */
  playerNamed(name: string): Player {
    return this.ensemble.find((p) => p.name === name) ?? this.player(name);
  }

  /** The names of this node's children (sub-folders with a sketch.ts). */
  get children(): string[] {
    return [...this.node.children.keys()];
  }

  /** Runs a child at a place in this node. Its fragment is in its own time; merge() puts it here. */
  child(name: string, place: Placement): Placed {
    const node = this.node.children.get(name);
    if (!node)
      throw new Error(
        `${this.path || "The piece"} has no child "${name}" (a folder with sketch.ts). It has: ${this.children.join(", ") || "none"}`,
      );
    const ctx = new Context({
      ...this.fields(),
      start: this.start + place.at,
      length: Math.max(0, place.length),
      path: node.path,
      depth: this.depth + 1,
      centre: place.centre ?? this.centre,
      prev: place.prev,
      params: place.params ?? {},
      node,
    });
    const entry: OutlineNode = {
      node: node.path,
      at: ctx.start,
      length: ctx.length,
      depth: ctx.depth,
      uses: [],
      players: [],
    };
    this.shared.outline.push(entry);
    const fragment = node.score(node.values, ctx) as Fragment;
    if (!fragment || typeof fragment !== "object" || !("parts" in fragment) || !("end" in fragment))
      throw new Error(
        `${node.path}: score() must return a fragment (ctx.writer().done() or ctx.merge())`,
      );
    entry.uses = fragment.uses;
    entry.players = Object.keys(fragment.parts).filter((id) => fragment.parts[id]!.events.length);
    return { name, at: place.at, length: place.length, fragment };
  }

  /** Something to write this node's notes with. */
  writer(): Writer {
    return new Writer(this);
  }

  warn(text: string): void {
    this.shared.warnings.push(`${this.path || "piece"}: ${text}`);
  }

  /**
   * Children's fragments put together in this node's time. Two children giving one player notes
   * at the same time in the same voice are reported (the preview shows it with the map).
   */
  merge(placed: readonly Placed[], extra: { marks?: Mark[] } = {}): Fragment {
    const parts: Fragment["parts"] = {};
    const uses = new Set<string>();
    const marks: Mark[] = [...(extra.marks ?? [])];
    const last: EndState["last"] = {};
    const spans = new Map<string, { from: number; to: number; who: string }[]>();
    for (const p of placed) {
      for (const [id, voice] of Object.entries(p.fragment.parts)) {
        const into = (parts[id] ??= { events: [], dynamics: [] });
        for (const e of voice.events) {
          into.events.push({ ...e, at: later(e.at, p.at) });
          if (e.type !== "text") {
            const from = at(e.at) + p.at;
            const key = `${id}#${e.voice ?? 1}`;
            const list = spans.get(key) ?? [];
            list.push({ from, to: from + at(e.dur), who: p.name });
            spans.set(key, list);
          }
        }
        for (const d of voice.dynamics) into.dynamics.push({ ...d, at: later(d.at, p.at) });
      }
      for (const u of p.fragment.uses) uses.add(u);
      for (const m of p.fragment.marks) marks.push({ ...m, at: m.at + p.at });
    }
    Object.assign(last, endOf(placed).last);
    const reported = new Set<string>();
    for (const [key, list] of spans) {
      list.sort((a, b) => a.from - b.from);
      let open = list[0];
      for (const s of list.slice(1)) {
        if (open && s.who !== open.who && s.from < open.to - 1e-6) {
          const pair = `${key.split("#")[0]}: ${open.who} and ${s.who}`;
          if (!reported.has(pair)) {
            reported.add(pair);
            this.warn(`${pair} both play at ${Math.round((this.start + s.from) * 100) / 100} q`);
          }
        }
        if (!open || s.to > open.to) open = s;
      }
    }
    return { parts, end: { last }, uses: [...uses].sort(), marks };
  }

  /**
   * The piece's score, at the top: every player of the ensemble in its order, and the outline of
   * where each node is.
   */
  score(fragment: Fragment, head: Omit<Score, "parts" | "outline"> & { length: number }): Score {
    const { length, ...rest } = head;
    const byTime = <T extends { at: Time }>(xs: T[]) => [...xs].sort((a, b) => at(a.at) - at(b.at));
    for (const id of Object.keys(fragment.parts))
      if (!this.ensemble.some((p) => p.id === id))
        this.warn(`notes for "${id}", who is not in the ensemble`);
    const parts = this.ensemble.map((p) => ({
      id: p.id,
      instrument: p.instrument,
      name: p.name,
      ...(p.abbreviation ? { abbreviation: p.abbreviation } : {}),
      ...(p.players ? { players: p.players } : {}),
      ...(p.player ? { player: p.player } : {}),
      events: byTime(fragment.parts[p.id]?.events ?? []),
      dynamics: byTime(fragment.parts[p.id]?.dynamics ?? []),
    }));
    const samples = 240;
    const flows: Record<string, number[]> = {};
    for (const [name, f] of Object.entries(this.flows))
      flows[name] = Array.from(
        { length: samples + 1 },
        (_, i) => Math.round(clamp01(f((i / samples) * length)) * 1000) / 1000,
      );
    const outline: Outline = {
      length,
      nodes: [
        {
          node: "",
          at: 0,
          length,
          depth: 0,
          uses: fragment.uses,
          players: parts.filter((p) => p.events.length).map((p) => p.id),
        },
        ...this.shared.outline,
      ],
      flows,
      warnings: this.shared.warnings,
    };
    return { ...rest, parts, outline };
  }
}

/** Writes one node's notes, in its own time; notes past its end are cut there. */
export class Writer {
  private readonly ctx: Context;
  private readonly parts = new Map<string, { events: Event[]; dynamics: DynamicPoint[] }>();
  private readonly uses = new Set<string>();
  private readonly marks: Mark[] = [];

  constructor(ctx: Context) {
    this.ctx = ctx;
  }

  private voice(player: string) {
    this.ctx.player(player);
    let v = this.parts.get(player);
    if (!v) {
      v = { events: [], dynamics: [] };
      this.parts.set(player, v);
    }
    return v;
  }

  /** A note; times that are plain numbers are snapped to 1/48 of a quarter (they must be exact). */
  note(player: string, n: NoteEvent): void {
    const t = typeof n.at === "number" ? grid(n.at) : n.at;
    const start = at(t);
    const room = grid(this.ctx.length - start);
    if (room <= 1e-6 || at(n.dur) <= 1e-6) return;
    const dur = at(n.dur) > room + 1e-6 ? room : typeof n.dur === "number" ? grid(n.dur) : n.dur;
    if (at(dur) <= 1e-6) return;
    this.voice(player).events.push({ ...n, at: t, dur });
  }

  dynamic(player: string, t: number, level: number, to?: "linear"): void {
    if (t > this.ctx.length + 1e-6) return;
    const point: DynamicPoint = {
      at: grid(Math.max(0, t)),
      level: Math.round(Math.max(0, Math.min(8, level)) * 100) / 100,
    };
    if (to) point.to = to;
    this.voice(player).dynamics.push(point);
  }

  text(player: string, t: number, text: string, placement?: "above" | "below"): void {
    this.voice(player).events.push({
      type: "text",
      at: grid(t),
      text,
      ...(placement ? { placement } : {}),
    });
  }

  /** Records a form of the motif as played here (for the map). */
  use(form: string): void {
    this.uses.add(form);
  }

  mark(t: number, label: string, shift?: number): void {
    this.marks.push({ at: t, label, ...(shift !== undefined ? { shift } : {}) });
  }

  done(): Fragment {
    const parts: Fragment["parts"] = {};
    const last: EndState["last"] = {};
    for (const [id, v] of this.parts) {
      parts[id] = v;
      let end = -Infinity;
      let pitches: number[] = [];
      for (const e of v.events) {
        if (e.type === "text" || e.pitch === undefined) continue;
        const stop = at(e.at) + at(e.dur);
        const ps = (Array.isArray(e.pitch) ? e.pitch : [e.pitch]).map(midiOf);
        if (stop > end + 1e-6) {
          end = stop;
          pitches = ps;
        } else if (Math.abs(stop - end) <= 1e-6) pitches = [...pitches, ...ps];
      }
      if (pitches.length) last[id] = { pitches, end };
    }
    return { parts, end: { last }, uses: [...this.uses].sort(), marks: this.marks };
  }
}

/**
 * A flow drawn over a piece's sections (an envelope knob with `guides`): each section takes an
 * equal share of the drawing, so the shape stays with its section whatever the section's length.
 * `bounds` are the sections' starts and the end, in quarters.
 */
export function formCurve(points: [number, number][], bounds: number[]): Flow {
  const n = bounds.length - 1;
  return (q) => {
    let k = 0;
    while (k < n - 1 && q >= bounds[k + 1]!) k++;
    const span = bounds[k + 1]! - bounds[k]!;
    const u = span > 0 ? clamp01((q - bounds[k]!) / span) : 0;
    return envelopeAt(points, (k + u) / n);
  };
}

/** What several placed nodes leave together: each player's last pitches, from whichever ends last. */
export function endOf(placed: readonly Placed[]): EndState {
  const last: EndState["last"] = {};
  for (const p of placed)
    for (const [id, l] of Object.entries(p.fragment.end.last)) {
      const end = l.end + p.at;
      if (!last[id] || end >= last[id].end) last[id] = { pitches: l.pitches, end };
    }
  return { last };
}

/** An empty fragment (a node with nothing to play). */
export const silence = (): Fragment => ({ parts: {}, end: { last: {} }, uses: [], marks: [] });

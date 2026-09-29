// Joining sections written as separate code (docs/architecture.md, "Joining sections").
//
// A section knows nothing of its neighbours. It is any sketch (its score(values) returns a whole
// score: its parts are the section's voices, in its own time and tempo) or a node that writes a
// fragment. It may also export seams(score): where each voice may stop or start without breaking
// its own logic (a group's head, a re-entry, a held tone). Without them, any note's start will do.
//
// A piece's top node renders each section once, in its own time (ctx.render: some of the section's
// knobs may be set from what the section before it wrote), and joins them here:
//
// - place: where a section starts in the piece, which slice of it, at what time scale (a section
//   written at 60 placed where the piece runs at 120 takes twice the quarters), which part of the
//   piece's orchestra each voice plays (a default by instrument), and a transposition
// - handOver: from one section to the next, part by part: each group of players stops at the first
//   seam after the time asked for, and the next section takes the same players from there
// - join: the usual ways, end to end, a rest, all at once, or player by player over a stretch
// - hold: a voice's last tone held on
// - chain: sections one after another, each join as its spec says; joinKnobs() gives a piece the
//   same knobs for every join (joinOf() reads them back)
//
// Nothing here goes into a section's code: it only cuts, moves and reassigns what a section wrote.
// Times are counted in ticks, 240 to the quarter (exact for 16ths, triplets, quintuplets, 32nds).

import { instrument } from "../instruments/catalog.ts";
import { parsePitch } from "../score/pitch.ts";
import type {
  DynamicPoint,
  Event,
  NoteEvent,
  OutlineNode,
  Pitch,
  Score,
  TextEvent,
  Time,
} from "../score/types.ts";
import { choice, number, type Knob } from "./knobs.ts";
import type { Context, Fragment, Material, Placed, Player, Rendering, Seam } from "./nest.ts";

const T = 240;
const toTicks = (t: Time) => Math.round((typeof t === "number" ? t : t[0] / t[1]) * T);
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const toTime = (k: number): Time => {
  const n = Math.round(k);
  if (n % T === 0) return n / T;
  const g = gcd(n, T);
  return [n / g, T / g];
};
const midiOf = (p: Pitch) => parsePitch(p).midi;

//==============================================================================
// Sections

interface Note {
  /** Ticks of the section's own time. */
  at: number;
  dur: number;
  event: NoteEvent;
}

interface Text {
  at: number;
  event: TextEvent;
}

interface Level {
  at: number;
  level: number;
  to?: "linear" | "step";
}

/** Seams in ticks: a moment, or a stretch where any moment will do. */
type Span = number | [number, number];

export interface Voice {
  /** The part id the section wrote it as. */
  id: string;
  instrument: string;
  name?: string;
  players?: number;
  notes: Note[];
  texts: Text[];
  dynamics: Level[];
  seams: Span[];
}

/** A section rendered once, in its own time. */
export interface Section {
  /** Its folder in the piece: where the map shows it. */
  node: string;
  /** Quarters a minute. A rest has none: it keeps the tempo it is in. */
  bpm?: number;
  /** Ticks. */
  length: number;
  voices: Voice[];
  /** Where its fermatas are (ticks, in its own time; Score.fermatas). */
  fermatas?: number[];
}

const levelsOf = (points: readonly DynamicPoint[] = []): Level[] =>
  points
    .map((p) => ({ at: toTicks(p.at), level: p.level, ...(p.to ? { to: p.to } : {}) }))
    .sort((a, b) => a.at - b.at);

function voiceOf(
  id: string,
  instrumentId: string,
  events: readonly Event[],
  dynamics: readonly DynamicPoint[] | undefined,
  seams: Seam[] | undefined,
  extra: { name?: string; players?: number },
): Voice {
  const notes: Note[] = [];
  const texts: Text[] = [];
  for (const e of events)
    if (e.type === "text") texts.push({ at: toTicks(e.at), event: e });
    else notes.push({ at: toTicks(e.at), dur: toTicks(e.dur), event: e });
  notes.sort((a, b) => a.at - b.at);
  const spans: Span[] = seams
    ? seams.map((s) => (typeof s === "number" ? toTicks(s) : [toTicks(s[0]), toTicks(s[1])]))
    : [...new Set(notes.map((n) => n.at))];
  return {
    id,
    instrument: instrumentId,
    ...extra,
    notes,
    texts,
    dynamics: levelsOf(dynamics),
    seams: spans,
  };
}

/**
 * A rendered child as a section: a whole score (a sketch; its tempo is its first tempo mark) or a
 * fragment (a node of a piece; give its tempo, and its players come from the piece's ensemble).
 */
export function sectionOf(
  rendering: Rendering,
  ctx: Context,
  given: { bpm?: number } = {},
): Section {
  const r = rendering.result as Partial<Score> & Partial<Fragment>;
  if (Array.isArray(r.parts)) {
    const score = r as Score;
    const seams = rendering.seams?.(score) ?? {};
    const tempos = score.tempo ?? [];
    if (tempos.length > 1)
      ctx.warn(`${rendering.path}: only its first tempo is kept (${tempos.length} tempo marks)`);
    const meter = score.meter[0];
    const quarters =
      meter && score.measures ? score.measures * meter.beats * (4 / meter.beatType) : 0;
    const voices = score.parts.map((p) =>
      voiceOf(p.id, p.instrument, p.events, p.dynamics, seams[p.id], {
        ...(p.name ? { name: p.name } : {}),
        ...(p.players !== undefined ? { players: p.players } : {}),
      }),
    );
    const bpm = given.bpm ?? tempos[0]?.bpm;
    return {
      node: rendering.path,
      ...(bpm !== undefined ? { bpm } : {}),
      length: Math.max(Math.round(quarters * T), endOf(voices)),
      voices,
      ...(score.fermatas?.length ? { fermatas: score.fermatas.map((f) => toTicks(f.at)) } : {}),
    };
  }
  if (r.parts && r.end) {
    const fragment = r as Fragment;
    const voices = Object.entries(fragment.parts).map(([id, v]) =>
      voiceOf(id, ctx.player(id).instrument, v.events, v.dynamics, undefined, {}),
    );
    const endMark = fragment.marks.find((m) => m.label === "end");
    return {
      node: rendering.path,
      ...(given.bpm !== undefined ? { bpm: given.bpm } : {}),
      length: endMark ? Math.round(endMark.at * T) : endOf(voices),
      voices,
    };
  }
  throw new Error(`${rendering.path}: score() returned neither a score nor a fragment`);
}

const endOf = (voices: readonly Voice[]) =>
  Math.max(0, ...voices.flatMap((v) => v.notes.map((n) => n.at + n.dur)));

//==============================================================================
// Parts of the piece

/**
 * Where a voice goes: a part of the piece; optionally with its technique replaced (null: removed),
 * and folded by octaves into a range (true: the instrument's).
 */
export type PartChoice = string | null | Target;
export interface Target {
  part: string;
  technique?: string | null;
  fold?: boolean | [number, number];
}

/** A pitch a voice sounds, for reading what a section played (sounding, last). */
export interface Tone {
  voice: string;
  instrument: string;
  midi: number;
}

/** Whether an instrument is a bowed string section (by the catalog's id). */
export const isString = (id: string) => id in SECTIONS;

const SECTIONS: Record<string, string> = {
  "violins-1": "vn1",
  "violins-2": "vn2",
  violas: "va",
  cellos: "vc",
  basses: "cb",
};

/**
 * The players a part belongs to: a string section (its divisions share the players), a doubling
 * player (flute 3 and piccolo), or the part alone.
 */
export function groupOf(part: string, ensemble: readonly Player[]): string {
  const m = /^(vn1|vn2|va|vc|cb)(s|r|a|b|q[1-4]|t|-\d+-\d+)$/.exec(part);
  if (m) return m[1]!;
  return ensemble.find((p) => p.id === part)?.player ?? part;
}

/**
 * Each voice's part by default: the part with the same id and instrument, if the piece has one;
 * divided strings to the section's halves or quarters (one voice: the whole section, or its solo);
 * any other voice to the next free part of its instrument.
 */
function defaultParts(
  voices: readonly Voice[],
  ensemble: readonly Player[],
): Map<string, string | null> {
  const out = new Map<string, string | null>();
  const taken = new Set<string>();
  const same = (v: Voice) => ensemble.find((p) => p.id === v.id && p.instrument === v.instrument);
  for (const v of voices) {
    const p = same(v);
    if (p) {
      out.set(v.id, p.id);
      taken.add(p.id);
    }
  }
  const byInstrument = new Map<string, Voice[]>();
  for (const v of voices)
    if (!out.has(v.id))
      byInstrument.set(v.instrument, [...(byInstrument.get(v.instrument) ?? []), v]);
  for (const [inst, vs] of byInstrument) {
    const key = SECTIONS[inst];
    if (key) {
      // The section divided into as many parts as the section has voices (vn1-3-2), when the piece
      // has them; else halves and quarters (a b, q1–q4).
      const inN = vs.map((_, k) => `-${vs.length}-${k + 1}`);
      const divisions =
        vs.length === 1
          ? [vs[0]!.players === 1 ? "s" : "t"]
          : inN.every((d) => ensemble.some((p) => p.id === `${key}${d}`))
            ? inN
            : vs.length === 2
              ? ["a", "b"]
              : ["q1", "q2", "q3", "q4"];
      vs.forEach((v, i) => {
        const id = i < divisions.length ? `${key}${divisions[i]}` : undefined;
        out.set(v.id, id && ensemble.some((p) => p.id === id) ? id : null);
      });
      continue;
    }
    const free = ensemble.filter((p) => p.instrument === inst && !taken.has(p.id));
    vs.forEach((v, i) => {
      const p = free[i];
      out.set(v.id, p ? p.id : null);
      if (p) taken.add(p.id);
    });
  }
  return out;
}

//==============================================================================
// Placements

export interface Placing {
  /** Quarters of the piece where the slice starts. */
  at: number;
  /** The slice, in the section's own quarters (default: all of it). */
  from?: number;
  to?: number;
  /** Quarters of the piece per quarter of the section (2: written at 60, placed where the piece runs at 120). */
  scale?: number;
  /** Voices whose part is not the default (null: left out). */
  parts?: Record<string, PartChoice>;
  /** Semitones. */
  transpose?: number;
  /** A name for the map and for warnings. */
  label?: string;
}

/** From a tick of the section on, how many ticks of the piece each of its ticks takes. */
interface Stretch {
  from: number;
  scale: number;
  /**
   * The piece's tempo over it, where the section is not played at its own speed there (a retime to
   * the nearest ratio that keeps its notes on their grid). Default: the section's tempo × scale.
   */
  bpm?: number;
}

export class Placement {
  readonly section: Section;
  /** Ticks of the piece. */
  readonly at: number;
  /** Ticks of the section. */
  readonly from: number;
  to: number;
  /** The time scale, from its start, and wherever the piece's tempo changes under it (retime). */
  readonly stretches: Stretch[];
  readonly transpose: number;
  readonly label: string;
  readonly parts: Map<string, Target | null>;
  /** Per voice, the stretch of it that sounds (ticks of the section). */
  readonly windows = new Map<string, [number, number]>();
  /** Per voice, a level to take at a moment (ticks of the section): handing over at the same strength. */
  readonly levels = new Map<string, Level>();
  /** Per voice, the time (ticks of the section) its last tone is held to. */
  readonly holds = new Map<string, number>();
  /** Voices whose first tone is drawn back to where their window starts (coming in with a change). */
  readonly pulls = new Set<string>();

  constructor(init: {
    section: Section;
    at: number;
    from: number;
    to: number;
    scale: number;
    transpose: number;
    label: string;
    parts: Map<string, Target | null>;
  }) {
    this.section = init.section;
    this.at = init.at;
    this.from = init.from;
    this.to = init.to;
    this.stretches = [{ from: init.from, scale: init.scale }];
    this.transpose = init.transpose;
    this.label = init.label;
    this.parts = init.parts;
  }

  /** Ticks of the section → ticks of the piece. */
  toPiece(u: number): number {
    let t = this.at;
    this.stretches.forEach((s, i) => {
      const next = this.stretches[i + 1]?.from ?? Infinity;
      if (u > s.from) t += (Math.min(u, next) - s.from) * s.scale;
    });
    return u < this.from ? this.at + (u - this.from) * this.stretches[0]!.scale : t;
  }

  /** Ticks of the piece → ticks of the section. */
  toOwn(t: number): number {
    let piece = this.at;
    for (let i = 0; i < this.stretches.length; i++) {
      const s = this.stretches[i]!;
      const next = this.stretches[i + 1]?.from;
      const span = next === undefined ? Infinity : (next - s.from) * s.scale;
      if (t <= piece + span || next === undefined) return s.from + (t - piece) / s.scale;
      piece += span;
    }
    return this.from;
  }

  /** Where the slice ends in the piece (ticks). */
  get end(): number {
    return this.toPiece(this.to);
  }

  /** The piece's tempo where it starts. */
  get bpm(): number | undefined {
    return this.bpmAt(this.from);
  }

  /** The piece's tempo while it plays a tick of the section. */
  bpmAt(u: number): number | undefined {
    if (this.section.bpm === undefined) return undefined;
    const s = [...this.stretches].reverse().find((x) => x.from <= u) ?? this.stretches[0]!;
    return s.bpm ?? this.section.bpm * s.scale;
  }

  /** Its scale from its start. */
  get scale(): number {
    return this.stretches[0]!.scale;
  }

  window(voice: string): [number, number] {
    return this.windows.get(voice) ?? [this.from, this.to];
  }

  partOf(voice: string): string | undefined {
    return this.parts.get(voice)?.part;
  }
}

/** The first moment at or after `u` where the voice may stop or start (u itself inside a held stretch). */
function nextSeam(v: Voice, u: number): number | undefined {
  let best: number | undefined;
  for (const s of v.seams) {
    const c =
      typeof s === "number" ? (s >= u ? s : undefined) : s[1] < u ? undefined : Math.max(s[0], u);
    if (c !== undefined && (best === undefined || c < best)) best = c;
  }
  return best;
}

/** A dynamic curve's level at a tick. */
function levelAt(points: readonly Level[], t: number): number {
  return pointAt(points, t).level;
}

/** A dynamic curve at a tick, as a point: its level there, and how it goes on to the next point. */
function pointAt(points: readonly Level[], t: number): Level {
  if (points.length === 0) return { at: t, level: 3 };
  let i = -1;
  while (i + 1 < points.length && points[i + 1]!.at <= t) i++;
  if (i < 0) return { at: t, level: points[0]!.level };
  const p = points[i]!;
  const q = points[i + 1];
  const level =
    p.to === "linear" && q && q.at > p.at
      ? p.level + ((q.level - p.level) * (t - p.at)) / (q.at - p.at)
      : p.level;
  return { at: t, level, ...(p.to ? { to: p.to } : {}) };
}

//==============================================================================
// Joining

/** The usual ways from one section to the next. */
export const HOWS = ["end to end", "rest", "at once", "by players"] as const;
export type How = (typeof HOWS)[number];

export interface JoinSpec {
  how: How;
  /**
   * at once, by players: how many of its own quarters before its end the section before gives way:
   * where everything changes (at once), or where the next one comes in (by players).
   */
  lead: number;
  /** by players: quarters of the next section from the first group's change to the last. */
  spread: number;
  /** by players: which register changes first. */
  order: "low first" | "high first";
  /** rest: quarters of silence between, at the tempo of the section before (a rest section, so the map shows it). */
  rest: number;
  /** by players: the groups of the section before that the next does not take play on to its end, or stop with the last change. */
  others: "play on" | "stop";
  /** by players: the next section takes over at the strength the one before had. */
  adopt?: boolean;
}

/** What a join does unless its knobs are moved. */
const JOIN_DEFAULTS: JoinSpec = {
  how: "end to end",
  lead: 4,
  spread: 8,
  order: "low first",
  rest: 4,
  others: "play on",
};

/**
 * Knobs for the joins of a piece whose sections come one after another, the same for every join and
 * every piece: join n is between the n-th section and the next. `d`: what they do unless moved
 * (default: end to end).
 */
export function joinKnobs(count: number, d: Partial<JoinSpec> = {}): Record<string, Knob> {
  const x = { ...JOIN_DEFAULTS, ...d };
  const out: Record<string, Knob> = {};
  for (let n = 1; n <= count; n++) {
    const group = `Join ${n}`;
    out[`how${n}`] = choice({
      group,
      label: "How",
      help: "end to end: the next starts where this one ends · rest: a silence between · at once: everything changes at one moment · by players: the players change over one group at a time",
      value: x.how,
      options: [...HOWS],
    });
    out[`lead${n}`] = number({
      group,
      label: "Lead",
      help: "at once, by players: how many quarters before its end the section before gives way (counted in its own quarters)",
      value: x.lead,
      min: 0,
      max: 48,
      step: 1,
      unit: "beats",
    });
    out[`spread${n}`] = number({
      group,
      label: "Spread",
      help: "by players: quarters (of the next section) from the first group's change to the last",
      value: x.spread,
      min: 0,
      max: 48,
      step: 1,
      unit: "beats",
    });
    out[`order${n}`] = choice({
      group,
      label: "Order",
      help: "by players: which register changes first",
      value: x.order,
      options: ["low first", "high first"],
    });
    out[`others${n}`] = choice({
      group,
      label: "The others",
      help: "by players: the players of the section before that the next one does not take: play on to its end, or stop with the last change",
      value: x.others,
      options: ["play on", "stop"],
    });
    out[`rest${n}`] = number({
      group,
      label: "Rest",
      help: "rest: quarters of silence between",
      value: x.rest,
      min: 0,
      max: 32,
      step: 1,
      unit: "beats",
    });
  }
  return out;
}

/** Join n's spec from a piece's values (joinKnobs); a join without knobs is end to end. */
export function joinOf(values: Record<string, unknown>, n: number): JoinSpec {
  const get = <K extends keyof JoinSpec>(k: K) =>
    (values[`${k}${n}`] ?? JOIN_DEFAULTS[k]) as JoinSpec[K];
  return {
    how: get("how"),
    lead: get("lead"),
    spread: get("spread"),
    order: get("order"),
    rest: get("rest"),
    others: get("others"),
  };
}

/** Tempo ratios under which a slice may be written again at another tempo and stay on its grid. */
const SCALES = [0.5, 2 / 3, 1, 1.5, 2];
/** The ratio of SCALES nearest to `x` (by how many times, not by how much). */
const nearestScale = (x: number) =>
  SCALES.reduce((best, s) => (Math.abs(Math.log(s / x)) < Math.abs(Math.log(best / x)) ? s : best));

export class Joiner {
  private readonly ctx: Context;
  private readonly placements: Placement[] = [];

  /** `ctx`: the piece, with its ensemble set (ctx.with({ ensemble })). */
  constructor(ctx: Context) {
    this.ctx = ctx;
  }

  get ensemble(): readonly Player[] {
    return this.ctx.ensemble;
  }

  /** Renders a child as a section (see Context.render; a fragment needs its tempo). */
  section(
    name: string,
    over: {
      values?: Record<string, unknown>;
      params?: Record<string, unknown>;
      material?: Material;
      length?: number;
      bpm?: number;
    } = {},
  ): Section {
    const { bpm, ...rest } = over;
    return sectionOf(this.ctx.render(name, rest), this.ctx, bpm !== undefined ? { bpm } : {});
  }

  place(section: Section, p: Placing): Placement {
    const defaults = defaultParts(section.voices, this.ensemble);
    const parts = new Map<string, Target | null>();
    for (const v of section.voices) {
      const given = p.parts?.[v.id];
      const choice = given !== undefined ? given : (defaults.get(v.id) ?? null);
      const target: Target | null =
        choice === null ? null : typeof choice === "string" ? { part: choice } : choice;
      if (target && !this.ensemble.some((x) => x.id === target.part))
        throw new Error(
          `${section.node}: voice ${v.id} goes to "${target.part}", not a part of the piece`,
        );
      if (given === undefined && target === null)
        this.ctx.warn(
          `${section.node}: no part of the piece for voice ${v.id} (${v.instrument}); it is left out`,
        );
      parts.set(v.id, target);
    }
    const scale = p.scale ?? 1;
    if (!SCALES.some((s) => Math.abs(s - scale) < 1e-9))
      this.ctx.warn(`${section.node}: time scale ${scale} may leave its notes off their grid`);
    const placement = new Placement({
      section,
      at: Math.round(p.at * T),
      from: Math.round((p.from ?? 0) * T),
      to: Math.round((p.to ?? section.length / T) * T),
      scale,
      transpose: p.transpose ?? 0,
      label: p.label ?? section.node,
      parts,
    });
    this.placements.push(placement);
    return placement;
  }

  /**
   * A placement from a moment of the piece on written at another time scale: the piece's tempo
   * changes there, and the section keeps its own speed (a tone held across it stays one tone).
   * With `bpm`, the piece's tempo there is that, and the section goes on at bpm / scale.
   */
  retime(a: Placement, at: number, scale: number, bpm?: number): Placement {
    if (!SCALES.some((s) => Math.abs(s - scale) < 1e-9))
      this.ctx.warn(`${a.label}: time scale ${scale} may leave its notes off their grid`);
    const u = Math.round(a.toOwn(Math.round(at * T)));
    const keep = a.stretches.filter((s) => s.from < u);
    a.stretches.splice(0, a.stretches.length, ...keep, { from: u, scale, ...(bpm ? { bpm } : {}) });
    return a;
  }

  /**
   * From one section to the next, group by group of players (a string section, a doubling player, a
   * part): `times` are quarters of the piece. The one before stops each of its voices in the group
   * at the voice's first seam at or after the time; the next takes the group's players from the
   * moment the last of them has stopped (at its own first seam from there, unless snap.b is false).
   * Returns when each group changed, in quarters.
   */
  handOver(
    a: Placement,
    b: Placement,
    times: Record<string, number>,
    opts: { snapA?: boolean; snapB?: boolean; adopt?: boolean; pull?: boolean } = {},
  ): Record<string, number> {
    const done: Record<string, number> = {};
    for (const [group, q] of Object.entries(times)) {
      const t = Math.round(q * T);
      const inA = a.section.voices.filter((v) => this.groupOfVoice(a, v.id) === group);
      const inB = b.section.voices.filter((v) => this.groupOfVoice(b, v.id) === group);
      let change = t;
      const ends = new Map<string, number>();
      for (const v of inA) {
        const [s, e] = a.window(v.id);
        const asked = Math.round(a.toOwn(t));
        const stop = Math.min(
          e,
          Math.max(s, opts.snapA === false ? asked : (nextSeam(v, asked) ?? asked)),
        );
        a.windows.set(v.id, [s, stop]);
        ends.set(v.id, e);
        change = Math.max(change, Math.round(a.toPiece(stop)));
      }
      const starts = new Map<string, number>();
      for (const v of inB) {
        const [s, e] = b.window(v.id);
        const asked = Math.round(b.toOwn(change));
        // A voice that has not come in yet by the change may come in with it (its first tone drawn
        // back); one already playing comes in at its first seam from there.
        const first = v.notes.find((n) => n.at + n.dur > s);
        const early = opts.pull === true && first !== undefined && first.at >= asked;
        const start = Math.max(
          s,
          early || opts.snapB === false ? asked : (nextSeam(v, asked) ?? asked),
        );
        b.windows.set(v.id, [start, e]);
        starts.set(v.id, start);
        if (early) b.pulls.add(v.id);
      }
      // A part both play in is the same players: the one before plays on until the next comes in.
      for (const v of inA) {
        const part = a.partOf(v.id);
        const w = inB.find((x) => b.partOf(x.id) === part);
        if (!w) continue;
        const [s, stop] = a.window(v.id);
        const until = Math.round(a.toOwn(b.toPiece(starts.get(w.id)!)));
        a.windows.set(v.id, [s, Math.min(ends.get(v.id)!, Math.max(stop, until))]);
      }
      if (opts.adopt) {
        // The next takes over at the strength the one before had: on the same part, where it comes
        // in; elsewhere, the average of the group where it stopped.
        const sounding = (v: Voice, u: number) =>
          v.notes.some((n) => n.at < u && n.at + n.dur > u - 1);
        const levels = inA
          .map((v) => ({ v, stop: a.window(v.id)[1] }))
          .filter(({ v, stop }) => sounding(v, stop))
          .map(({ v, stop }) => levelAt(v.dynamics, stop));
        for (const w of inB) {
          const start = starts.get(w.id)!;
          const same = inA.find((v) => a.partOf(v.id) === b.partOf(w.id));
          const level = same
            ? levelAt(same.dynamics, Math.round(a.toOwn(b.toPiece(start))))
            : levels.length
              ? levels.reduce((x, y) => x + y, 0) / levels.length
              : undefined;
          if (level !== undefined) b.levels.set(w.id, { at: start, level });
        }
      }
      done[group] = change / T;
    }
    return done;
  }

  /** Holds a voice's last tone (before its window ends) on until a moment of the piece (quarters). */
  hold(a: Placement, voice: string, until: number): void {
    a.holds.set(voice, Math.round(a.toOwn(Math.round(until * T))));
  }

  /**
   * Sections one after another: the first at `at` (quarters), each next one joined to the one
   * before by its spec (specs[0] joins the first and the second; end to end where there is none).
   * A rest join puts `rest` between. The placements, in order.
   */
  chain(
    items: { section: Section; label: string; parts?: Placing["parts"] }[],
    specs: JoinSpec[],
    rest?: Section,
    at = 0,
  ): Placement[] {
    const out: Placement[] = [];
    items.forEach((item, n) => {
      const p = { label: item.label, ...(item.parts ? { parts: item.parts } : {}) };
      out.push(
        n === 0
          ? this.place(item.section, { ...p, at })
          : this.next(out[n - 1]!, item.section, specs[n - 1] ?? JOIN_DEFAULTS, p, rest),
      );
    });
    return out;
  }

  /** Where the next section comes in after `a` (quarters of the piece), before it is placed. */
  startOf(a: Placement, spec: JoinSpec): number {
    if (spec.how === "end to end") return a.end / T;
    if (spec.how === "rest") return a.end / T + spec.rest;
    return a.toPiece(Math.max(a.from, a.to - Math.round(spec.lead * T))) / T;
  }

  /**
   * The next section after `a`, the usual way (JoinSpec). For "by players", the groups both play
   * in change in order of register, spread evenly; groups only the next has come in with it; groups
   * only the one before has play on or stop (spec.others). Where the tempo changes under an overlap,
   * the rest of the one before is written again at the new tempo (retime).
   */
  next(
    a: Placement,
    section: Section,
    spec: JoinSpec,
    p: Omit<Placing, "at"> = {},
    rest?: Section,
  ): Placement {
    const start = this.startOf(a, spec);
    if (spec.how === "end to end") return this.place(section, { ...p, at: start });
    if (spec.how === "rest") {
      if (rest && spec.rest > 0) this.place(rest, { at: a.end / T, to: spec.rest, label: "rest" });
      return this.place(section, { ...p, at: start });
    }
    if (spec.how === "at once") {
      const u = Math.round(a.toOwn(Math.round(start * T)));
      for (const v of a.section.voices) {
        const [s, e] = a.window(v.id);
        a.windows.set(v.id, [s, Math.min(e, u)]);
      }
      a.to = Math.min(a.to, u);
      return this.place(section, { ...p, at: start });
    }
    const first = start;
    const b = this.place(section, { ...p, at: first });
    let before = a;
    const tempoThen = a.bpmAt(Math.round(a.toOwn(Math.round(first * T))));
    if (tempoThen !== undefined && b.bpm !== undefined && Math.abs(tempoThen - b.bpm) > 1e-9) {
      // The rest of the one before is written again at the next one's tempo, at the nearest ratio
      // that keeps its notes on their grid: when the two tempos are not in one of those ratios, it
      // moves a little over the overlap (at 52 against 120 it goes on at 60).
      const exact = b.bpm / a.section.bpm!;
      const scale = nearestScale(exact);
      if (Math.abs(scale - exact) > 1e-9)
        this.ctx.warn(
          `${a.label}: from ${+first.toFixed(2)} q it goes on at ♩ = ${+(b.bpm / scale).toFixed(1)} (its own ♩ = ${a.section.bpm}), so that it stays on its grid under ♩ = ${b.bpm}`,
        );
      before = this.retime(a, first, scale, b.bpm);
    }
    const shared = [...new Set(before.section.voices.map((v) => this.groupOfVoice(before, v.id)))]
      .filter((g): g is string => g !== undefined)
      .filter((g) => b.section.voices.some((v) => this.groupOfVoice(b, v.id) === g));
    const height = (g: string) => {
      const ps = before.section.voices
        .filter((v) => this.groupOfVoice(before, v.id) === g)
        .flatMap((v) => v.notes.map((n) => pitchesOf(n.event)[0] ?? 60));
      return ps.length ? ps.reduce((x, y) => x + y, 0) / ps.length : 60;
    };
    shared.sort((x, y) =>
      spec.order === "low first" ? height(x) - height(y) : height(y) - height(x),
    );
    const times: Record<string, number> = {};
    shared.forEach((g, i) => {
      times[g] =
        shared.length > 1 ? first + (spec.spread * i) / (shared.length - 1) : first + spec.spread;
    });
    const changed = this.handOver(before, b, times, { adopt: spec.adopt ?? true, pull: true });
    if (spec.others === "stop") {
      const lastChange = Math.max(first, ...Object.values(changed));
      const asked = Math.round(before.toOwn(Math.round(lastChange * T)));
      for (const v of before.section.voices) {
        const g = this.groupOfVoice(before, v.id);
        if (g === undefined || shared.includes(g)) continue;
        const [s, e] = before.window(v.id);
        before.windows.set(v.id, [s, Math.min(e, Math.max(s, nextSeam(v, asked) ?? asked))]);
      }
    }
    return b;
  }

  /** The group of players a voice of a placement plays in (undefined: left out). */
  groupOfVoice(p: Placement, voice: string): string | undefined {
    const part = p.partOf(voice);
    return part === undefined ? undefined : groupOf(part, this.ensemble);
  }

  /** The pitches sounding in a placement at a moment of the piece (quarters), low to high, with their voices. */
  sounding(p: Placement, at: number): Tone[] {
    const u = Math.round(p.toOwn(Math.round(at * T)));
    const out: Tone[] = [];
    for (const v of p.section.voices) {
      const [s, e] = p.window(v.id);
      if (u < s || u >= e) continue;
      for (const n of v.notes)
        if (n.at <= u && u < n.at + n.dur)
          for (const m of pitchesOf(n.event))
            out.push({ voice: v.id, instrument: v.instrument, midi: m + p.transpose });
    }
    return out.sort((x, y) => x.midi - y.midi);
  }

  /** The pitches sounding just before a moment of the piece (quarters): what was heard when something changed there. */
  before(p: Placement, at: number): Tone[] {
    return this.sounding(p, at - 1 / T);
  }

  /** Each voice's last pitch in the placement (before its window ends), low to high. */
  last(p: Placement): Tone[] {
    const out: Tone[] = [];
    for (const v of p.section.voices) {
      const [s, e] = p.window(v.id);
      const inside = v.notes.filter(
        (n) => n.at < e && n.at + n.dur > s && pitchesOf(n.event).length,
      );
      const n = inside.at(-1);
      if (n)
        out.push({
          voice: v.id,
          instrument: v.instrument,
          midi: Math.max(...pitchesOf(n.event)) + p.transpose,
        });
    }
    return out.sort((x, y) => x.midi - y.midi);
  }

  /**
   * The piece's score: every placement's voices in their parts, the tempo from the placements (each
   * at its section's tempo times its scale), a rehearsal letter where each section starts, and each
   * placement on the map.
   */
  score(head: {
    title: string;
    rehearsal?: boolean;
    /** Quarters the score lasts at least (an empty score, or room after the last section). */
    length?: number;
    /** The tempo where no section sets one (an empty score). */
    bpm?: number;
  }): Score {
    const order = [...this.placements].sort((x, y) => x.at - y.at);
    // The tempo: from where each placement starts, and wherever one changes its scale (a rest keeps
    // the tempo it is in).
    const changes: { at: number; bpm: number }[] = [];
    for (const p of order)
      for (const s of p.stretches) {
        const bpm = p.bpmAt(s.from);
        if (bpm !== undefined && s.from < p.to)
          changes.push({ at: Math.round(p.toPiece(s.from)), bpm });
      }
    changes.sort((x, y) => x.at - y.at);
    const tempo: { at: Time; bpm: number }[] = [];
    let now: number | undefined;
    for (const c of changes)
      if (now === undefined || Math.abs(now - c.bpm) > 1e-9) {
        tempo.push({ at: toTime(c.at), bpm: Math.round(c.bpm * 100) / 100 });
        now = c.bpm;
      }
    for (const x of order)
      for (const y of order) {
        if (x === y || !(x.at < y.at && y.at < x.end) || y.bpm === undefined) continue;
        const u = x.toOwn(y.at);
        const there = x.bpmAt(u);
        if (
          there !== undefined &&
          Math.abs(there - y.bpm) > 1e-9 &&
          x.section.voices.some((v) => x.parts.get(v.id) && x.window(v.id)[1] > u)
        )
          this.ctx.warn(
            `${x.label} (at ${there}) still plays where ${y.label} (at ${y.bpm}) sets the tempo`,
          );
      }

    const placed: Placed[] = order.map((p) => ({
      name: p.label,
      at: 0,
      length: (p.end - p.at) / T,
      fragment: this.fragmentOf(p),
    }));
    const merged = this.ctx.merge(placed);
    // Where one placement's curve ends and the next one's starts on the same tick, the next one's
    // point stands.
    for (const part of Object.values(merged.parts)) {
      const byTick = new Map<number, DynamicPoint>();
      for (const d of part.dynamics) byTick.set(toTicks(d.at), d);
      part.dynamics = [...byTick.entries()].sort((x, y) => x[0] - y[0]).map(([, d]) => d);
    }
    let length = 0;
    for (const p of order) {
      const players = Object.keys(this.fragmentOf(p).parts);
      const entry: OutlineNode = {
        node: p.section.node,
        at: p.at / T,
        length: (p.end - p.at) / T,
        depth: 1,
        uses: [],
        players,
      };
      this.ctx.addToMap(entry);
      length = Math.max(length, p.end / T);
    }
    length = Math.max(length, head.length ?? 0);
    if (head.bpm !== undefined && (tempo.length === 0 || tempo[0]!.at !== 0))
      tempo.unshift({ at: 0, bpm: head.bpm });
    const measures = Math.max(1, Math.ceil(length / 4 - 1e-9));
    // A letter where each section starts (not its later slices, not a rest).
    const starts = order.filter((p) => p.from === 0 && p.section.bpm !== undefined);
    const letters =
      head.rehearsal === false ? [] : [...new Set(starts.map((p) => Math.floor(p.at / T / 4) + 1))];
    const rehearsal = letters
      .filter((m) => m > 1)
      .map((measure, i) => ({ measure, label: String.fromCharCode(65 + i) }));
    // The sections' fermatas, where their placements play them.
    const fermatas = order.flatMap((p) =>
      (p.section.fermatas ?? [])
        .filter((f) => f >= p.from && f < p.to)
        .map((f) => ({ at: toTime(Math.round(p.toPiece(f))) })),
    );
    return this.ctx.score(merged, {
      title: head.title,
      length,
      meter: [{ measure: 1, beats: 4, beatType: 4 }],
      tempo,
      rehearsal,
      ...(fermatas.length ? { fermatas } : {}),
      measures,
    });
  }

  /** A placement's voices, cut to their windows, in piece time and in their parts. */
  private fragmentOf(p: Placement): Fragment {
    const parts: Fragment["parts"] = {};
    for (const v of p.section.voices) {
      const target = p.parts.get(v.id);
      if (!target) continue;
      let [s, e] = p.window(v.id);
      if (e <= s) continue;
      const hold = p.holds.get(v.id);
      const notes = cut(v.notes, s, e, hold);
      // Coming in with the change: the first tone starts where the window does, held that much longer,
      // and the voice's own way in (its curve up to where it came in) is left out.
      const first = notes[0];
      let entrance: number | undefined;
      if (p.pulls.has(v.id) && first && first.at > s) {
        entrance = first.at;
        const early = first.at - s;
        first.at = s;
        first.dur += early;
        if (first.event.gliss && first.event.glissAfter !== undefined)
          first.event.glissAfter = toTime(toTicks(first.event.glissAfter) + early);
      }
      if (hold !== undefined) e = Math.max(e, hold);
      const texts = v.texts.filter((x) => x.at >= s && x.at < e);
      if (!notes.length && !texts.length) continue;
      const range = Array.isArray(target.fold)
        ? target.fold
        : target.fold
          ? instrument(this.ensemble.find((x) => x.id === target.part)!.instrument).range
          : undefined;
      const into = (parts[target.part] ??= { events: [], dynamics: [] });
      for (const n of notes) {
        const at = p.toPiece(n.at);
        const event: NoteEvent = {
          ...n.event,
          at: toTime(at),
          dur: toTime(p.toPiece(n.at + n.dur) - at),
        };
        if (event.pitch !== undefined) {
          const ms = pitchesOf(n.event).map((m) => fold(m + p.transpose, range));
          event.pitch = ms.length === 1 ? { midi: ms[0]! } : ms.map((midi) => ({ midi }));
        }
        if (event.glissAfter !== undefined)
          event.glissAfter = toTime(p.toPiece(n.at + toTicks(event.glissAfter)) - at);
        if (event.glissPitches)
          event.glissPitches = event.glissPitches.map((pitch) => ({
            midi: fold(midiOf(pitch) + p.transpose, range),
          }));
        if (target.technique === null) delete event.technique;
        else if (target.technique !== undefined) event.technique = target.technique;
        into.events.push(event);
      }
      for (const x of texts) into.events.push({ ...x.event, at: toTime(p.toPiece(x.at)) });
      // The curve inside the window, starting and ending at the levels it had there. Taking over
      // at another's strength: from that level, gliding to the section's own next point.
      const points: Level[] = [pointAt(v.dynamics, s)];
      for (const d of v.dynamics)
        if (d.at > s && d.at < e && (entrance === undefined || d.at > entrance)) points.push(d);
      const adopt = p.levels.get(v.id);
      if (adopt) points[0] = { at: s, level: adopt.level, to: "linear" };
      const last = points.at(-1)!;
      points.push({ at: e, level: hold !== undefined ? last.level : levelAt(v.dynamics, e) });
      for (const d of points)
        into.dynamics.push({
          at: toTime(p.toPiece(d.at)),
          level: Math.round(d.level * 100) / 100,
          ...(d.to ? { to: d.to } : {}),
        });
    }
    return { parts, end: { last: {} }, uses: [], marks: [] };
  }
}

const pitchesOf = (e: NoteEvent): number[] =>
  e.pitch === undefined ? [] : (Array.isArray(e.pitch) ? e.pitch : [e.pitch]).map(midiOf);

function fold(m: number, range?: [number, number]): number {
  if (!range) return m;
  let q = m;
  while (q > range[1]) q -= 12;
  while (q < range[0]) q += 12;
  return q;
}

/**
 * Notes inside [s, e): cut where the window cuts them. A note cut at its start keeps its slide
 * (it comes in partway through it); a note cut at its end, or whose slide would reach a note that is
 * gone, does not slide. With `hold`, the last note is held to that tick instead.
 */
function cut(notes: readonly Note[], s: number, e: number, hold?: number): Note[] {
  const out: Note[] = [];
  if (e <= s) return out;
  for (const n of notes) {
    const end = n.at + n.dur;
    if (end <= s || n.at >= e) continue;
    const at = Math.max(n.at, s);
    const stop = Math.min(end, e);
    if (stop <= at) continue;
    const event: NoteEvent = { ...n.event };
    if (at > n.at) {
      delete event.dynamic;
      if (event.glissAfter !== undefined)
        event.glissAfter = toTime(Math.max(0, toTicks(event.glissAfter) - (at - n.at)));
    }
    if (stop < end) {
      delete event.gliss;
      delete event.glissAfter;
      delete event.glissPitches;
    }
    out.push({ at, dur: stop - at, event });
  }
  if (hold !== undefined && out.length) {
    const last = out.at(-1)!;
    if (hold > last.at + last.dur) {
      last.dur = hold - last.at;
      delete last.event.gliss;
      delete last.event.glissAfter;
      delete last.event.glissPitches;
    }
  }
  // A slide needs the note it slides to, right after it in the same voice.
  for (const n of out)
    if (n.event.gliss) {
      const voice = n.event.voice ?? 1;
      const to = out.find(
        (m) => m !== n && (m.event.voice ?? 1) === voice && m.at === n.at + n.dur,
      );
      if (!to) {
        delete n.event.gliss;
        delete n.event.glissAfter;
        delete n.event.glissPitches;
      }
    }
  return out;
}

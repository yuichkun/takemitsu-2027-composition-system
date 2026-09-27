// Reads a score JSON into exact, validated form shared by the notation and performance projections.

import { instrument, playersOf, type Instrument } from "../instruments/catalog.ts";
import { techniqueOf } from "../instruments/techniques.ts";
import { parsePitch, type Spelled } from "./pitch.ts";
import { max, Rational } from "./rational.ts";
import { measures, tempoMap, type Measure, type TempoSegment } from "./timeline.ts";
import type { Articulation, DynamicPoint, NoteEvent, Part, Score, TextEvent } from "./types.ts";

export interface Note {
  at: Rational;
  dur: Rational;
  end: Rational;
  /** Empty for unpitched percussion. */
  pitches: Spelled[];
  voice: number;
  staff: number;
  /** Technique components, e.g. ["tremolo", "sul-pont"]; empty for ord. */
  technique: string[];
  articulations: Articulation[];
  slur: boolean;
  trill?: 1 | 2;
  /** Index in the part's events, for messages. */
  index: number;
}

export interface Dynamic {
  at: Rational;
  level: number;
  to: "linear" | "step";
}

export interface NormalPart {
  id: string;
  instrument: Instrument;
  name: string;
  abbreviation: string;
  players: number;
  notes: Note[];
  texts: { at: Rational; text: string; placement: "above" | "below" }[];
  dynamics: Dynamic[];
}

export interface NormalScore {
  title: string;
  parts: NormalPart[];
  measures: Measure[];
  tempo: TempoSegment[];
  tempoMarks: { at: Rational; bpm: number; beat: Rational; text?: string }[];
  rehearsal: { measure: number; label: string }[];
  end: Rational;
  warnings: string[];
}

function splitTechnique(t: string | undefined): string[] {
  if (!t || t === "ord") return [];
  return t
    .split("+")
    .filter((x) => x && x !== "ord")
    .sort();
}

function normalizePart(part: Part, warnings: string[]): NormalPart {
  const inst = instrument(part.instrument);
  const players = playersOf(part);
  const where = (i: number) => `part "${part.id}", event ${i}`;
  const notes: Note[] = [];
  const texts: NormalPart["texts"] = [];
  const dynamics: Dynamic[] = (part.dynamics ?? []).map((d: DynamicPoint) => ({
    at: Rational.of(d.at),
    level: d.level,
    to: d.to ?? "step",
  }));

  part.events.forEach((event, index) => {
    if (event.type === "text") {
      const t = event as TextEvent;
      texts.push({ at: Rational.of(t.at), text: t.text, placement: t.placement ?? "above" });
      return;
    }
    const e = event as NoteEvent;
    const at = Rational.of(e.at);
    const dur = Rational.of(e.dur);
    if (dur.lte(Rational.zero)) throw new Error(`${where(index)}: duration must be positive`);
    const raw = e.pitch === undefined ? [] : Array.isArray(e.pitch) ? e.pitch : [e.pitch];
    const pitches = raw.map((p) => parsePitch(p)).sort((a, b) => a.midi - b.midi);
    if (inst.unpitched && pitches.length)
      warnings.push(`${where(index)}: ${inst.name} is unpitched; pitch ignored`);
    if (!inst.unpitched && pitches.length === 0)
      throw new Error(`${where(index)}: ${inst.name} needs a pitch`);
    const technique = splitTechnique(e.technique);
    for (const t of technique) {
      if (!techniqueOf(t)) {
        warnings.push(
          `${where(index)}: technique "${t}" is not in src/instruments/techniques.ts; written as "${t}"`,
        );
      }
    }
    if (inst.range) {
      for (const p of pitches) {
        if (p.midi < inst.range[0] || p.midi > inst.range[1])
          warnings.push(`${where(index)}: ${inst.name} pitch ${p.midi} is outside its range`);
      }
    }
    const staff = e.staff ?? 1;
    if (staff < 1 || staff > inst.clefs.length)
      throw new Error(`${where(index)}: ${inst.name} has ${inst.clefs.length} staff/staves`);
    if (e.dynamic !== undefined) dynamics.push({ at, level: e.dynamic, to: "step" });
    notes.push({
      at,
      dur,
      end: at.add(dur),
      pitches: inst.unpitched ? [] : pitches,
      voice: e.voice ?? 1,
      staff,
      technique,
      articulations: e.articulations ?? [],
      slur: e.slur ?? false,
      trill: e.trill,
      index,
    });
  });

  notes.sort((a, b) => a.at.cmp(b.at) || a.voice - b.voice);
  dynamics.sort((a, b) => a.at.cmp(b.at));
  // A later point at the same time replaces an earlier one.
  const merged: Dynamic[] = [];
  for (const d of dynamics) {
    if (merged.length && merged.at(-1)!.at.eq(d.at))
      merged[merged.length - 1] = { ...d, to: d.to === "linear" ? "linear" : merged.at(-1)!.to };
    else merged.push(d);
  }

  const name =
    part.name ??
    (inst.sectionSize && players < inst.sectionSize ? `${inst.name} (${players})` : inst.name);
  return {
    id: part.id,
    instrument: inst,
    name,
    abbreviation: part.abbreviation ?? inst.abbreviation,
    players,
    notes,
    texts,
    dynamics: merged,
  };
}

export function normalize(score: Score): NormalScore {
  const warnings: string[] = [];
  const ids = new Set<string>();
  for (const p of score.parts) {
    if (ids.has(p.id)) throw new Error(`Duplicate part id "${p.id}"`);
    ids.add(p.id);
  }
  const parts = score.parts.map((p) => normalizePart(p, warnings));

  // Divisi: players of parts from the same section must fit in the section.
  const bySection = new Map<string, number>();
  for (const p of parts)
    if (p.instrument.sectionSize)
      bySection.set(p.instrument.id, (bySection.get(p.instrument.id) ?? 0) + p.players);
  for (const [id, total] of bySection) {
    const size = instrument(id).sectionSize!;
    if (total > size)
      warnings.push(`${instrument(id).name}: parts use ${total} players, the section has ${size}`);
  }

  let end = Rational.zero;
  for (const p of parts) {
    for (const n of p.notes) end = max(end, n.end);
    for (const t of p.texts) end = max(end, t.at);
    for (const d of p.dynamics) end = max(end, d.at);
  }
  return {
    title: score.title ?? "Untitled",
    parts,
    measures: measures(score, end),
    tempo: tempoMap(score),
    tempoMarks: (score.tempo ?? []).map((t) => ({
      at: Rational.of(t.at),
      bpm: t.bpm,
      beat: Rational.of(t.beat ?? 1),
      text: t.text,
    })),
    rehearsal: score.rehearsal ?? [],
    end,
    warnings,
  };
}

/** Dynamic level at time t: holds after a "step" point, interpolates after a "linear" one. Default mf (5). */
export function levelAt(dynamics: Dynamic[], t: Rational): number {
  if (dynamics.length === 0) return 5;
  let i = -1;
  for (let k = 0; k < dynamics.length; k++) if (dynamics[k]!.at.lte(t)) i = k;
  if (i < 0) return dynamics[0]!.level;
  const d = dynamics[i]!;
  const next = dynamics[i + 1];
  if (d.to === "linear" && next) {
    const span = next.at.sub(d.at).value;
    const f = span > 0 ? t.sub(d.at).value / span : 1;
    return d.level + (next.level - d.level) * f;
  }
  return d.level;
}

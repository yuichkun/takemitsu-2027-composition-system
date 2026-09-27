// Turns a voice's notes and rests inside one measure into notatable pieces:
// splits at beats, detects tuplets per beat, picks note values with dots, and beams.
//
// Rules (kept simple and predictable):
// - A beat is a group of the meter (Score.meter groups): a quarter in x/4, a dotted quarter in
//   6/8, 9/8, 12/8, and twos and threes of eighths or 16ths in other x/8 and x/16 (7/8 = 2+2+3).
// - If the onsets and ends inside a beat need an odd subdivision (3, 5, 7…), the whole beat
//   becomes one tuplet k:n where n is the largest power of two below k.
// - Anything crossing a beat is split and tied, except a piece that starts and ends on beats
//   outside tuplets and fits one note value (with up to two dots). Rests join only into undotted
//   values that start on a multiple of their length (a half rest on beat 1 or 3 in 4/4).

import type { Note } from "../score/normalize.ts";
import { lcm, max, min, Rational } from "../score/rational.ts";
import type { Measure } from "../score/timeline.ts";

export interface Piece {
  start: Rational;
  /** Actual duration in quarters. */
  dur: Rational;
  note?: Note;
  type: string;
  dots: number;
  tuplet?: { actual: number; normal: number; first: boolean; last: boolean };
  tieFromPrevious: boolean;
  tieToNext: boolean;
  /** Beam state per level (1 = eighth beam): "begin" | "continue" | "end" | "forward hook" | "backward hook". */
  beams: string[];
  /** A rest filling the whole measure. */
  measureRest?: boolean;
}

const types: [Rational, string][] = [
  [new Rational(4), "whole"],
  [new Rational(2), "half"],
  [new Rational(1), "quarter"],
  [new Rational(1, 2), "eighth"],
  [new Rational(1, 4), "16th"],
  [new Rational(1, 8), "32nd"],
  [new Rational(1, 16), "64th"],
  [new Rational(1, 32), "128th"],
];

const flags: Record<string, number> = { eighth: 1, "16th": 2, "32nd": 3, "64th": 4, "128th": 5 };

/** Note value (type + dots) for a displayed duration, if one exists. */
function value(displayed: Rational): { type: string; dots: number } | undefined {
  for (const [base, type] of types) {
    for (const [dots, factor] of [
      [0, new Rational(1)],
      [1, new Rational(3, 2)],
      [2, new Rational(7, 4)],
    ] as const) {
      if (base.mul(factor).eq(displayed)) return { type, dots };
    }
  }
  return undefined;
}

/** Largest note value not longer than `displayed`. */
function largestFitting(displayed: Rational): { type: string; dots: number; length: Rational } {
  for (const [base, type] of types) {
    for (const [dots, factor] of [
      [2, new Rational(7, 4)],
      [1, new Rational(3, 2)],
      [0, new Rational(1)],
    ] as const) {
      const length = base.mul(factor);
      if (length.lte(displayed)) return { type, dots, length };
    }
  }
  throw new Error(`Duration ${displayed.toString()} is shorter than a 128th`);
}

const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;
const oddPart = (n: number) => {
  while (n % 2 === 0) n /= 2;
  return n;
};
const powerBelow = (k: number) => 2 ** Math.floor(Math.log2(k));

/** The measure's beats as [start, end], one per beat group (see Score.meter). */
export function beatSpans(m: Measure): [Rational, Rational][] {
  const unit = new Rational(4, m.beatType);
  const out: [Rational, Rational][] = [];
  let at = m.start;
  for (const g of m.groups) {
    const end = at.add(unit.mul(new Rational(g)));
    out.push([at, end]);
    at = end;
  }
  return out;
}

interface Span {
  start: Rational;
  end: Rational;
  note?: Note;
  /** The note continues from before this span (tie in). */
  tiedIn: boolean;
  /** The note continues after this span (tie out). */
  tiedOut: boolean;
}

/**
 * @param notes notes of one voice on one staff that overlap the measure (at most one sounding at a time;
 *              chords are one note with several pitches)
 * @param restIfEmpty write a whole-measure rest when the voice has nothing in this measure
 */
export function layoutMeasure(notes: Note[], m: Measure, restIfEmpty: boolean): Piece[] {
  const mEnd = m.start.add(m.length);
  const spans: Span[] = [];
  let cursor = m.start;
  for (const n of notes) {
    const s = max(n.at, m.start);
    const e = min(n.end, mEnd);
    if (e.lte(s)) continue;
    if (s.lt(cursor)) continue; // overlapping notes in one voice: the earlier one wins
    if (s.gt(cursor)) spans.push({ start: cursor, end: s, tiedIn: false, tiedOut: false });
    spans.push({ start: s, end: e, note: n, tiedIn: n.at.lt(m.start), tiedOut: n.end.gt(mEnd) });
    cursor = e;
  }
  if (spans.length === 0) {
    if (!restIfEmpty) return [];
    return [
      {
        start: m.start,
        dur: m.length,
        type: "whole",
        dots: 0,
        tieFromPrevious: false,
        tieToNext: false,
        beams: [],
        measureRest: true,
      },
    ];
  }
  if (cursor.lt(mEnd)) spans.push({ start: cursor, end: mEnd, tiedIn: false, tiedOut: false });

  // Beats and their tuplet ratio.
  const beats: { start: Rational; end: Rational; actual: number; normal: number }[] = [];
  for (const [b, spanEnd] of beatSpans(m)) {
    const bEnd = min(spanEnd, mEnd);
    let den = 1;
    for (const sp of spans) {
      for (const t of [sp.start, sp.end]) {
        if (t.gt(b) && t.lt(bEnd)) den = lcm(den, t.sub(b).d);
      }
    }
    // Plain eighths in a compound beat sit on halves, so an odd factor always means a tuplet.
    const k = oddPart(den);
    const actual = isPowerOfTwo(den) ? 1 : k;
    beats.push({ start: b, end: bEnd, actual, normal: actual === 1 ? 1 : powerBelow(actual) });
  }
  const beatAt = (t: Rational) => beats.findIndex((b) => t.gte(b.start) && t.lt(b.end));

  // Split spans at beat boundaries, then merge plain whole-beat runs back where one value fits.
  /** A piece of a span within beats `beat` … `last`. */
  type Cut = Span & { beat: number; last: number };
  const cuts: Cut[] = [];
  for (const sp of spans) {
    let s = sp.start;
    while (s.lt(sp.end)) {
      const bi = beatAt(s);
      const e = min(sp.end, beats[bi]!.end);
      cuts.push({
        ...sp,
        start: s,
        end: e,
        beat: bi,
        last: bi,
        tiedIn: s.gt(sp.start) || sp.tiedIn,
        tiedOut: e.lt(sp.end) || sp.tiedOut,
      });
      s = e;
    }
  }
  const merged: Cut[] = [];
  for (const c of cuts) {
    const prev = merged.at(-1);
    // Whole beats, none of them a tuplet (a run already merged spans several).
    const plain = (x: Cut) =>
      beats.slice(x.beat, x.last + 1).every((b) => b.actual === 1) &&
      x.start.eq(beats[x.beat]!.start) &&
      x.end.eq(beats[x.last]!.end);
    if (prev && prev.note === c.note && prev.end.eq(c.start) && plain(prev) && plain(c)) {
      const joined = c.end.sub(prev.start);
      const startsOnBeat = prev.start.eq(beats[beatAt(prev.start)]!.start);
      const v = value(joined);
      // Rests are stricter: no dots, and a rest starts on a multiple of its own length
      // (a half rest on beat 1 or 3 in 4/4), so beat 2 to the end is a quarter rest and a half rest.
      const restFits =
        prev.note !== undefined || (v?.dots === 0 && prev.start.sub(m.start).div(joined).d === 1);
      if (startsOnBeat && v && restFits) {
        merged[merged.length - 1] = { ...prev, end: c.end, last: c.last, tiedOut: c.tiedOut };
        continue;
      }
    }
    merged.push(c);
  }

  // Decompose each cut into note values.
  const pieces: Piece[] = [];
  for (const c of merged) {
    const b = beats[c.beat]!;
    const scale = new Rational(b.actual, b.normal);
    let s = c.start;
    while (s.lt(c.end)) {
      const remaining = c.end.sub(s).mul(scale);
      const exact = value(remaining);
      const v = exact ? { ...exact, length: remaining } : largestFitting(remaining);
      const actualLength = v.length.div(scale);
      const e = s.add(actualLength);
      pieces.push({
        start: s,
        dur: actualLength,
        note: c.note,
        type: v.type,
        dots: v.dots,
        tuplet:
          b.actual > 1
            ? { actual: b.actual, normal: b.normal, first: s.eq(b.start), last: e.eq(b.end) }
            : undefined,
        tieFromPrevious: c.note !== undefined && (s.gt(c.start) || c.tiedIn),
        tieToNext: c.note !== undefined && (e.lt(c.end) || c.tiedOut),
        beams: [],
      });
      s = e;
    }
  }

  beam(
    pieces,
    beats.map((b) => b.start),
  );
  return pieces;
}

/** Beams consecutive flagged notes within a beat. */
function beam(pieces: Piece[], beatStarts: Rational[]): void {
  const beatOf = (p: Piece) => {
    let i = 0;
    for (let k = 0; k < beatStarts.length; k++) if (beatStarts[k]!.lte(p.start)) i = k;
    return i;
  };
  let group: Piece[] = [];
  const flush = () => {
    if (group.length >= 2) {
      const levels = Math.max(...group.map((p) => flags[p.type] ?? 0));
      for (let level = 1; level <= levels; level++) {
        for (let i = 0; i < group.length; i++) {
          const has = (j: number) =>
            j >= 0 && j < group.length && (flags[group[j]!.type] ?? 0) >= level;
          if (!has(i)) continue;
          const left = has(i - 1);
          const right = has(i + 1);
          group[i]!.beams[level - 1] =
            left && right
              ? "continue"
              : left
                ? "end"
                : right
                  ? "begin"
                  : level === 1
                    ? ""
                    : i > 0
                      ? "backward hook"
                      : "forward hook";
        }
      }
      for (const p of group) p.beams = p.beams.map((b) => b ?? "");
    }
    group = [];
  };
  let currentBeat = -1;
  let feather: number | undefined;
  for (const p of pieces) {
    const flagged = p.note !== undefined && (flags[p.type] ?? 0) > 0;
    const b = beatOf(p);
    // A feathered group is one beam, whatever beats it crosses.
    const f = p.note?.feather?.group;
    const sameFeather = f !== undefined && f === feather && !p.note!.feather!.first;
    if (!flagged || (b !== currentBeat && !sameFeather) || (f !== feather && group.length)) flush();
    currentBeat = b;
    feather = f;
    if (flagged) group.push(p);
  }
  flush();
}

/** Divisions per quarter so that every piece start and duration is an integer. */
export function divisionsFor(pieces: Iterable<Piece>): number {
  let d = 1;
  for (const p of pieces) {
    d = lcm(d, p.dur.d);
    d = lcm(d, p.start.d);
  }
  return d;
}

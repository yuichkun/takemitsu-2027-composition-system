// Measures and tempo: where each measure starts, and quarter-note time → seconds.

import { Rational } from "./rational.ts";
import type { Score } from "./types.ts";

export interface Measure {
  number: number;
  start: Rational;
  length: Rational;
  beats: number;
  beatType: number;
}

export function measureLength(beats: number, beatType: number): Rational {
  return new Rational(beats * 4, beatType);
}

/** Lays out measures until `end` is covered (or `score.measures` if given). */
export function measures(score: Score, end: Rational): Measure[] {
  const meters = [...score.meter].sort((a, b) => a.measure - b.measure);
  if (meters[0]?.measure !== 1) throw new Error("The first time signature must be at measure 1");
  const out: Measure[] = [];
  let start = Rational.zero;
  let meter = meters[0];
  for (let number = 1; ; number++) {
    const next = meters.find((m) => m.measure === number);
    if (next) meter = next;
    if (score.measures !== undefined ? number > score.measures : start.gte(end) && number > 1)
      break;
    const length = measureLength(meter.beats, meter.beatType);
    out.push({ number, start, length, beats: meter.beats, beatType: meter.beatType });
    start = start.add(length);
  }
  return out;
}

export interface TempoSegment {
  /** Start in quarter notes. */
  at: number;
  /** Start in seconds. */
  seconds: number;
  /** Quarter notes per minute. */
  qpm: number;
}

export function tempoMap(score: Score): TempoSegment[] {
  const changes = (score.tempo ?? [{ at: 0, bpm: 60 }])
    .map((t) => ({ at: Rational.of(t.at).value, qpm: t.bpm * Rational.of(t.beat ?? 1).value }))
    .sort((a, b) => a.at - b.at);
  if (changes.length === 0 || changes[0]!.at > 0)
    changes.unshift({ at: 0, qpm: changes[0]?.qpm ?? 60 });
  const out: TempoSegment[] = [];
  let seconds = 0;
  for (const [i, c] of changes.entries()) {
    if (i > 0) {
      const prev = changes[i - 1]!;
      seconds += ((c.at - prev.at) * 60) / prev.qpm;
    }
    out.push({ at: c.at, seconds, qpm: c.qpm });
  }
  return out;
}

export function secondsAt(map: TempoSegment[], quarters: number): number {
  let seg = map[0]!;
  for (const s of map) if (s.at <= quarters) seg = s;
  return seg.seconds + ((quarters - seg.at) * 60) / seg.qpm;
}

/** The inverse of secondsAt. */
export function quartersAt(map: TempoSegment[], seconds: number): number {
  let seg = map[0]!;
  for (const s of map) if (s.seconds <= seconds) seg = s;
  return seg.at + ((seconds - seg.seconds) * seg.qpm) / 60;
}

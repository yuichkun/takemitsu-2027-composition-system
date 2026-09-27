// Measures and tempo: where each measure starts, and quarter-note time → seconds.

import { Rational } from "./rational.ts";
import type { Score } from "./types.ts";

export interface Measure {
  number: number;
  start: Rational;
  length: Rational;
  beats: number;
  beatType: number;
  /** Beat groups in units of beatType (see Score.meter). */
  groups: number[];
}

/** The default grouping of a meter (see Score.meter). */
export function defaultGroups(beats: number, beatType: number): number[] {
  if (beatType <= 4) return Array.from({ length: beats }, () => 1);
  if (beatType === 8 && beats % 3 === 0 && beats > 3)
    return Array.from({ length: beats / 3 }, () => 3);
  if (beats <= 3) return [beats];
  const out = Array.from({ length: Math.floor(beats / 2) }, () => 2);
  if (beats % 2) out[out.length - 1] = 3;
  return out;
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
    const given = meter.groups;
    const groups =
      given &&
      given.length &&
      given.every((g) => g > 0) &&
      given.reduce((a, b) => a + b, 0) === meter.beats
        ? given
        : defaultGroups(meter.beats, meter.beatType);
    out.push({ number, start, length, beats: meter.beats, beatType: meter.beatType, groups });
    start = start.add(length);
  }
  return out;
}

export interface TempoSegment {
  /** Start in quarter notes. */
  at: number;
  /** Start in seconds. */
  seconds: number;
  /** Quarter notes per minute at the start. */
  qpm: number;
  /**
   * A gradual change: the tempo moves in a straight line (over quarter notes) to `qpmEnd` at
   * `end` (the next change). Absent: the tempo holds.
   */
  qpmEnd?: number;
  end?: number;
}

/** Tempo change per quarter note over a gradual segment (0 when it holds). */
const slope = (s: TempoSegment) =>
  s.qpmEnd !== undefined && s.end !== undefined && s.end > s.at
    ? (s.qpmEnd - s.qpm) / (s.end - s.at)
    : 0;

/** Seconds from a segment's start to `dq` quarters into it. */
function secondsInto(s: TempoSegment, dq: number): number {
  const b = slope(s);
  // With qpm(x) = qpm + b·x, the time is the integral of 60 / qpm(x).
  return Math.abs(b) < 1e-9 ? (dq * 60) / s.qpm : (60 / b) * Math.log((s.qpm + b * dq) / s.qpm);
}

export function tempoMap(score: Score): TempoSegment[] {
  const changes = (score.tempo ?? [{ at: 0, bpm: 60 }])
    .map((t) => ({
      at: Rational.of(t.at).value,
      qpm: t.bpm * Rational.of(t.beat ?? 1).value,
      gradual: t.to === "linear",
    }))
    .sort((a, b) => a.at - b.at);
  if (changes.length === 0 || changes[0]!.at > 0)
    changes.unshift({ at: 0, qpm: changes[0]?.qpm ?? 60, gradual: false });
  const out: TempoSegment[] = [];
  let seconds = 0;
  for (const [i, c] of changes.entries()) {
    if (i > 0) {
      const prev = out[i - 1]!;
      seconds += secondsInto(prev, c.at - prev.at);
    }
    const next = changes[i + 1];
    out.push({
      at: c.at,
      seconds,
      qpm: c.qpm,
      ...(c.gradual && next ? { qpmEnd: next.qpm, end: next.at } : {}),
    });
  }
  return out;
}

export function secondsAt(map: TempoSegment[], quarters: number): number {
  let seg = map[0]!;
  for (const s of map) if (s.at <= quarters) seg = s;
  return seg.seconds + secondsInto(seg, quarters - seg.at);
}

/** The inverse of secondsAt. */
export function quartersAt(map: TempoSegment[], seconds: number): number {
  let seg = map[0]!;
  for (const s of map) if (s.seconds <= seconds) seg = s;
  const ds = seconds - seg.seconds;
  const b = slope(seg);
  return (
    seg.at +
    (Math.abs(b) < 1e-9 ? (ds * seg.qpm) / 60 : (seg.qpm * (Math.exp((b * ds) / 60) - 1)) / b)
  );
}

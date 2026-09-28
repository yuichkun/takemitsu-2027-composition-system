// antara's rule of writing (docs/antara/sound.md): a between, a set of betweens and a rule that
// draws from it, on two axes.
//
// - Pitch: betweens in semitones (quarter tones as .5, 0 allowed). Notes are a standpoint (the
//   anchor) plus the betweens drawn: each group starts at the anchor again, or the line walks on.
// - Time: betweens in atoms of a prime family (2: 16ths, 3: triplet eighths, 5: quintuplet 16ths).
//   Onsets are added from the start; a line keeps one family for a stretch and changes family only
//   at bar lines, where every family's grid meets.
//
// A set may be written in sections, "0 | 0 0 0 2 | 2 5 7": the length is split into that many
// stretches at bar lines and each stretch uses its own set (the set moves). Families may be
// written the same way ("2 | 3 | 5").
//
// Time is counted in ticks of 1/60 of a beat, the least unit all three families share. The tick
// is for counting only; the atoms are the units the music is made of.

import type { Articulation, NoteEvent, Score } from "../../src/score/types.ts";
import { numbersOf } from "../../src/sketch/knobs.ts";

export const TICKS = 60;
export type Family = 2 | 3 | 5;
const atomTicks: Record<Family, number> = { 2: 15, 3: 20, 5: 12 };

export const FAMILY_OPTIONS = ["2 (16ths)", "3 (triplet 8ths)", "5 (quintuplet 16ths)"];
export const familyOf = (option: string): Family => Number(option.split(" ")[0]) as Family;

export const RULES = ["in order", "shift each time", "combinations"] as const;
export type Rule = (typeof RULES)[number];
export const ORDERS = ["ascending", "descending"] as const;
export type Order = (typeof ORDERS)[number];
export const STANDS = ["back to the anchor", "walk on"] as const;
export type Stand = (typeof STANDS)[number];

/** Sets written as numbers, sections separated by "|". */
export function setsOf(label: string, value: string): number[][] {
  const sections = value
    .replaceAll("−", "-")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  if (sections.length === 0) throw new Error(`${label}: write at least one set (e.g. 2 5 7)`);
  return sections.map((s) => numbersOf(label, s));
}

/** Time betweens: whole numbers of atoms, at least 1. */
export function timeSetsOf(label: string, value: string): number[][] {
  const sets = setsOf(label, value);
  for (const set of sets)
    if (set.some((n) => !Number.isInteger(n) || n < 1))
      throw new Error(`${label}: time betweens are whole numbers of atoms, 1 or more`);
  return sets;
}

/** Pitch betweens: semitones on the quarter-tone grid. */
export function pitchSetsOf(label: string, value: string): number[][] {
  const sets = setsOf(label, value);
  for (const set of sets)
    if (set.some((n) => !Number.isInteger(n * 2)))
      throw new Error(
        `${label}: pitch betweens are semitones on the quarter-tone grid (2, 3.5, -5)`,
      );
  return sets;
}

/** Families written as "2 | 3 | 5" (or "2 3 5"). */
export function familiesOf(label: string, value: string): Family[] {
  const out = numbersOf(label, value.replaceAll("|", " "));
  if (out.some((n) => n !== 2 && n !== 3 && n !== 5))
    throw new Error(`${label}: families are 2, 3 and 5`);
  return out as Family[];
}

/**
 * Groups of betweens drawn from a set by a rule, one group per call, forever.
 * - in order: the set as written, again and again
 * - shift each time: the set as written, starting one later each time round
 * - combinations: every distinct group of k betweens, in dictionary order, each group sorted
 */
export function drawer(set: number[], rule: string, k: number, order: string): () => number[] {
  if (!(RULES as readonly string[]).includes(rule))
    throw new Error(`Rule: "${rule}" is not one of ${RULES.join(", ")}`);
  if (rule === "in order") return () => set;
  if (rule === "shift each time") {
    let r = 0;
    return () => {
      const s = r++ % set.length;
      return [...set.slice(s), ...set.slice(0, s)];
    };
  }
  const size = Math.max(1, Math.min(k, set.length));
  const sorted = [...set].sort((a, b) => a - b);
  const seen = new Set<string>();
  const groups: number[][] = [];
  const pick = (from: number, acc: number[]) => {
    if (acc.length === size) {
      const key = acc.join(",");
      if (!seen.has(key)) {
        seen.add(key);
        groups.push(order === "descending" ? [...acc].reverse() : [...acc]);
      }
      return;
    }
    for (let i = from; i < sorted.length; i++) pick(i + 1, [...acc, sorted[i]!]);
  };
  pick(0, []);
  let i = 0;
  return () => groups[i++ % groups.length]!;
}

/** Splits `beats` into `n` stretches at bar lines (4 beats), as evenly as the bars allow. */
export function stretches(beats: number, n: number): [number, number][] {
  const bars = Math.round(beats / 4);
  if (bars < n) throw new Error(`Bars: ${n} sections need at least ${n} bars`);
  const out: [number, number][] = [];
  let at = 0;
  for (let i = 0; i < n; i++) {
    const take = Math.floor((bars * (i + 1)) / n) - Math.floor((bars * i) / n);
    if (take > 0) out.push([at * 4, (at + take) * 4]);
    at += take;
  }
  return out;
}

export interface Onset {
  /** In ticks from the start. */
  at: number;
  /** First onset of a drawn group (with more than one between): where a strong beat may be heard. */
  head: boolean;
}

/** Onsets by addition: each stretch starts on its bar line and adds its set's betweens. */
export function timeLine(o: {
  beats: number;
  families: Family[];
  sets: number[][];
  rule: string;
  k: number;
  order: string;
  /** Atoms of silence before the first onset of each stretch. */
  offset?: number;
}): Onset[] {
  const n = Math.max(o.families.length, o.sets.length);
  const out: Onset[] = [];
  stretches(o.beats, n).forEach(([from, to], i) => {
    const family = o.families[i % o.families.length]!;
    const atom = atomTicks[family];
    const draw = drawer(o.sets[i % o.sets.length]!, o.rule, o.k, o.order);
    const end = to * TICKS;
    let at = from * TICKS + (o.offset ?? 0) * atom;
    for (;;) {
      const group = draw();
      for (let g = 0; g < group.length; g++) {
        if (at >= end) return;
        out.push({ at, head: g === 0 && group.length > 1 });
        at += group[g]! * atom;
      }
    }
  });
  return out;
}

/** One onset on every `atoms` atoms of a family: a pulse (a set holding one between). */
export const pulse = (beats: number, family: Family, atoms: number): Onset[] =>
  timeLine({
    beats,
    families: [family],
    sets: [[atoms]],
    rule: "in order",
    k: 1,
    order: "ascending",
  });

export interface Tone {
  midi: number;
  /** First tone of a drawn group (with more than one between). */
  head: boolean;
  /** Last tone of a drawn group: a slur over the group ends here. */
  last: boolean;
}

/**
 * A pitch for each onset. The pitch sets change at their own stretches (by onset time). Tones
 * leaving the range are moved by octaves back into it.
 */
export function pitchLine(
  onsets: Onset[],
  o: {
    beats: number;
    sets: number[][];
    rule: string;
    k: number;
    order: string;
    stand: string;
    anchor: number;
    range: [number, number];
  },
): Tone[] {
  const [lo, hi] = o.range;
  if (hi - lo < 12) throw new Error("Range: give the line at least an octave");
  const fold = (p: number) => {
    let q = p;
    while (q > hi) q -= 12;
    while (q < lo) q += 12;
    return q;
  };
  const bounds = stretches(o.beats, o.sets.length).map(([, to]) => to * TICKS);
  let section = -1;
  let draw = () => [0];
  let queue: Tone[] = [];
  let current = fold(o.anchor);
  let started = false;
  const refill = () => {
    const group = draw();
    const multi = group.length > 1;
    const tones: Tone[] = [];
    if (o.stand === "back to the anchor") {
      let p = o.anchor;
      tones.push({ midi: fold(p), head: multi, last: false });
      for (const b of group) {
        p += b;
        tones.push({ midi: fold(p), head: false, last: false });
      }
    } else {
      if (!started) tones.push({ midi: current, head: false, last: false });
      group.forEach((b, i) => {
        current = fold(current + b);
        tones.push({ midi: current, head: multi && i === 0, last: false });
      });
    }
    started = true;
    tones.at(-1)!.last = true;
    queue = tones;
  };
  return onsets.map(({ at }) => {
    const s = Math.max(
      0,
      bounds.findIndex((end) => at < end),
    );
    if (s !== section) {
      section = s;
      draw = drawer(o.sets[s % o.sets.length]!, o.rule, o.k, o.order);
      queue = [];
    }
    if (queue.length === 0) refill();
    return queue.shift()!;
  });
}

/** Ticks as an exact time in quarters. */
export function time(ticks: number): [number, number] {
  const g = gcd(Math.abs(ticks), TICKS) || 1;
  return [ticks / g, TICKS / g];
}
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * Note events for a line: each note lasts to the next onset (or to the end). Accents go on the
 * heads of the time groups and/or the pitch groups; a slur may cover each pitch group.
 */
export function notes(
  onsets: Onset[],
  o: {
    beats: number;
    tones?: Tone[];
    pitch?: string;
    accent?: "time" | "pitch" | "both" | "none";
    slurs?: boolean;
    technique?: string;
    /** Longest written length in ticks (a short stroke on a long between); default: to the next onset. */
    longest?: number;
  },
): NoteEvent[] {
  const end = o.beats * TICKS;
  return onsets.map((on, i) => {
    const next = i + 1 < onsets.length ? onsets[i + 1]!.at : end;
    const len = Math.min(next - on.at, o.longest ?? Infinity);
    const tone = o.tones?.[i];
    const accented =
      (o.accent === "time" || o.accent === "both" ? on.head : false) ||
      (o.accent === "pitch" || o.accent === "both" ? (tone?.head ?? false) : false);
    const articulations: Articulation[] = accented ? ["accent"] : [];
    const event: NoteEvent = { at: time(on.at), dur: time(len) };
    if (tone) event.pitch = { midi: tone.midi };
    else if (o.pitch) event.pitch = o.pitch;
    if (articulations.length) event.articulations = articulations;
    if (o.technique) event.technique = o.technique;
    if (o.slurs && tone && !tone.last && i + 1 < onsets.length) event.slur = true;
    return event;
  });
}

/** A score in 4/4 at one tempo. */
export function scoreOf(title: string, beats: number, bpm: number, parts: Score["parts"]): Score {
  return {
    title,
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm }],
    measures: Math.ceil(beats / 4),
    parts,
  };
}

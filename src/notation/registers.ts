// Where each staff leaves its own clef, and where it uses octave lines, so that notes stay near
// the staff (the score JSON gives only sounding pitches).
//
// Clefs: one per measure. Each passage (measures with notes, between empty measures) is decided on
// its own, starting from the staff's own clef: the fewest ledger lines (a second line costs a
// little, each further one more), with a cost for each change so a staff does not flip back and
// forth. Empty measures keep the clef they follow, so a
// change is written where the notes that need it start. Staves change only at barlines, and an
// edit changes the clefs of its own passage only.
//
// Octave lines: after the clef, a note (a chord counts as one) still more than `far` ledger lines
// away takes the smallest octave line that brings it back. A line runs from the first to the last
// note that needs one, over notes in between that read well under it; where 8va and 15ma needs
// meet, the passage takes 15ma if all its notes read well under it. A line stops at a note that
// does not read well under it, and at a gap of a whole bar's length.

import type { Clef, Instrument, Register } from "../instruments/catalog.ts";
import type { Note, NormalPart } from "../score/normalize.ts";
import type { Spelled } from "../score/pitch.ts";
import type { Measure } from "../score/timeline.ts";

/** An octave line over notes of one staff. */
export interface Ottava {
  /** Octaves the notes sound above where they are drawn: 1 = 8va, 2 = 15ma, −1 = 8vb, −2 = 15mb. */
  octaves: number;
  /** The notes under the line, in order. */
  notes: Note[];
}

export interface StaffRegisters {
  /** The clef in force in each measure of the score (same indices as score.measures). */
  clefs: Clef[];
  ottavas: Ottava[];
}

/** Ledger lines a note may need before it takes an octave line (Register.far overrides it). */
const defaultFar = 3;
/**
 * Cost of a clef change, against the cost of ledger lines (see penalty): high enough that a
 * staff never changes clef for one or two notes, only for a stretch that would otherwise sit on
 * three or more ledger lines (docs/research/score-layout/instruments.md).
 */
const changeCost = 12;
/** Cost of a measure with notes in a clef other than the staff's own. */
const awayCost = 0.5;

const stepIndex: Record<Spelled["step"], number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
/** Diatonic position of the clef's own note (G4, F3, C4), counting C0 as 0. */
const clefNote: Record<Exclude<Clef["sign"], "percussion">, number> = { G: 32, F: 24, C: 28 };

/** Diatonic position of a written pitch, counting C0 as 0. */
export const diatonic = (p: Spelled): number => p.octave * 7 + stepIndex[p.step];

/** Ledger lines a written position needs on a staff in this clef (0 inside the staff). */
export function ledgerLines(position: number, clef: Clef): number {
  if (clef.sign === "percussion") return 0;
  const bottom = clefNote[clef.sign] - 2 * (clef.line - 1);
  const top = bottom + 8;
  if (position > top) return Math.floor((position - top) / 2);
  if (position < bottom) return Math.floor((bottom - position) / 2);
  return 0;
}

/** One ledger line is free; beyond that each line costs more than the last. */
const penalty = (lines: number) => (lines <= 1 ? 0 : (lines - 1) ** 2);

/**
 * Registers of every staff of a part. `written` gives the written pitch of a sounding one (the
 * instrument's octave), the same function the MusicXML writer uses.
 */
export function registersOf(
  part: NormalPart,
  measures: Measure[],
  written: (p: Spelled, inst: Instrument) => Spelled,
): StaffRegisters[] {
  const inst = part.instrument;
  return inst.clefs.map((home, i) => {
    const register: Register = inst.registers?.[i] ?? {};
    const notes = inst.unpitched ? [] : part.notes.filter((n) => n.staff === i + 1);
    const positions = new Map(
      notes.map((n) => [n, n.pitches.map((p) => diatonic(written(p, inst)))]),
    );
    const clefs = chooseClefs(home, register.clefs ?? [], notes, positions, measures);
    return { clefs, ottavas: octaveLines(register, notes, positions, clefs, measures) };
  });
}

function chooseClefs(
  home: Clef,
  others: Clef[],
  notes: Note[],
  positions: Map<Note, number[]>,
  measures: Measure[],
): Clef[] {
  const choices = [home, ...others];
  if (choices.length === 1) return measures.map(() => home);
  // Notes drawn in each measure: those starting in it and those tied into it.
  const byMeasure: Note[][] = measures.map(() => []);
  let first = 0;
  for (const n of notes) {
    while (
      first < measures.length - 1 &&
      measures[first]!.start.add(measures[first]!.length).lte(n.at)
    )
      first++;
    for (let m = first; m < measures.length && measures[m]!.start.lt(n.end); m++)
      byMeasure[m]!.push(n);
  }
  const cost = byMeasure.map((ns) =>
    choices.map((c, ci) => {
      let sum = ci === 0 ? 0 : awayCost;
      for (const n of ns) for (const d of positions.get(n)!) sum += penalty(ledgerLines(d, c));
      return sum;
    }),
  );
  const chosen: Clef[] = measures.map(() => home);
  let previous = home;
  for (let m = 0; m < measures.length;) {
    if (!byMeasure[m]!.length) {
      chosen[m++] = previous;
      continue;
    }
    let end = m;
    while (end < measures.length && byMeasure[end]!.length) end++;
    const passage = leastCost(cost.slice(m, end));
    passage.forEach((ci, k) => (chosen[m + k] = choices[ci]!));
    previous = chosen[end - 1]!;
    m = end;
  }
  return chosen;
}

/** Clef indices of least total cost (Viterbi), starting from the staff's own clef (index 0). */
function leastCost(cost: number[][]): number[] {
  const total: number[][] = [];
  const from: number[][] = [];
  cost.forEach((row, m) => {
    total.push(
      row.map((c, ci) => {
        if (m === 0) return c + (ci === 0 ? 0 : changeCost);
        let best = Infinity;
        let arg = 0;
        // Ties keep the earlier (own) clef, so equal passages come out the same every time.
        total[m - 1]!.forEach((t, pi) => {
          const v = t + (pi === ci ? 0 : changeCost);
          if (v < best) [best, arg] = [v, pi];
        });
        (from[m] ??= [])[ci] = arg;
        return best + c;
      }),
    );
  });
  const last = total.at(-1)!;
  let ci = last.indexOf(Math.min(...last));
  const out: number[] = [];
  for (let m = cost.length - 1; m >= 0; m--) {
    out[m] = ci;
    if (m > 0) ci = from[m]![ci]!;
  }
  return out;
}

function octaveLines(
  register: Register,
  notes: Note[],
  positions: Map<Note, number[]>,
  clefs: Clef[],
  measures: Measure[],
): Ottava[] {
  const far = register.far ?? defaultFar;
  const allowed = [0];
  if (register.ottava === "up" || register.ottava === "both") allowed.push(1, 2);
  if (register.ottava === "down" || register.ottava === "both") allowed.push(-1, -2);
  if (allowed.length === 1) return [];
  const clefAt = (n: Note) => {
    let m = measures.length - 1;
    while (m > 0 && measures[m]!.start.gt(n.at)) m--;
    return clefs[m]!;
  };
  // The farthest a note (all its pitches) lies from the staff, drawn `octaves` lower.
  const reach = (n: Note, octaves: number) =>
    Math.max(...positions.get(n)!.map((d) => ledgerLines(d - 7 * octaves, clefAt(n))));
  // The smallest line that brings the note near the staff; if none does, the one that comes closest.
  const byReach = allowed.sort((a, b) => Math.abs(a) - Math.abs(b));
  const need = (n: Note) => {
    const near = byReach.find((o) => reach(n, o) <= far);
    if (near !== undefined) return near;
    return byReach.reduce((best, o) => (reach(n, o) < reach(n, best) ? o : best));
  };
  const bar = measures[0]?.length.value ?? 4;
  const lines: Ottava[] = [];
  // The open line, and the notes after its last needing note that it may still take in.
  let open: Ottava | undefined;
  let pending: Note[] = [];
  let lastEnd = -Infinity;
  const close = () => {
    if (open) lines.push(open);
    open = undefined;
    pending = [];
  };
  for (const n of notes) {
    if (n.at.value - lastEnd >= bar) close();
    lastEnd = Math.max(lastEnd, n.end.value);
    const o = need(n);
    if (open && o !== 0 && Math.sign(o) === Math.sign(open.octaves)) {
      // Same way: one line for the passage, the larger one if every note reads well under it.
      const octaves = Math.abs(o) > Math.abs(open.octaves) ? o : open.octaves;
      const all = [...open.notes, ...pending, n];
      if (all.every((x) => reach(x, octaves) <= far)) {
        open = { octaves, notes: all };
        pending = [];
        continue;
      }
    } else if (open && o === 0 && reach(n, open.octaves) <= far) {
      pending.push(n);
      continue;
    }
    close();
    if (o !== 0) open = { octaves: o, notes: [n] };
  }
  close();
  return lines;
}

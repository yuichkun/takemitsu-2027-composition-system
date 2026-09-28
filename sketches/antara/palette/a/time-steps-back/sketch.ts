// antara palette, A (time): a step back in time.
//
// A line of onsets is its origin plus the time betweens a rule draws from a set. On the pitch axis a
// between has a direction (up or down); on the time axis it has been read as forward only. Here the
// time set holds negative betweens too, and the line is walked exactly as a pitch line is: each
// term is the one before it plus the next between drawn. A negative between puts the next term
// before the one the walk stands on.
//
// Each step sounds for the stretch of time it covers, from the earlier of its two terms to the
// later one: a forward step as a note lasting its between, the way a note lasts until the next
// onset; a step back the same, over the stretch it went back across. Nothing else tells the steps
// apart: no step is marked forward or back. A line with only positive betweens is one voice, each
// note handing over to the next. A step back goes over time the walk has already covered, so there
// another note is already sounding: how many notes sound at a moment is how many times the walk
// passed over it. Between the origin and the last term the walk crosses every moment once more
// forward than back (1, 3, 5 ... notes); before the origin (reached only by going back, left only
// forward) and after the last term, an even number of times. Where the walk turns, two notes
// begin together (back, then forward) or end together (forward, then back); where it goes on the
// same way, one ends as the next begins.
//
// The rule: every group of Group size betweens, in the order the set is read (a group keeps that
// order), and each cycle the reading starts Shift places further on (negative: earlier), so the
// walk's shape does not come back while the starts last. The first cycle reads the set as written.
// The default shift is two places earlier: a shift of one, either way, makes the second half
// thicker than the first (the notes pile up towards the end), and two places on puts the
// thickest moment in the middle; two earlier leaves no such one-way shape.
//
// The first violins in unison on their lowest note (the open string: every player sounds it the
// same way), divided into as many equal parts as the walk ever passes over one moment. A note goes
// to the lowest part free at its start. All at p, arco, no accents: only how long each note is,
// and how many sound together, change. The origin is placed on the first beat with room before it
// for the earliest term.
//
// Negative time betweens widen the principle's reading of addition (forward from the first onset):
// a reading for 余湖さん to confirm, not a settled rule.
// Card: README.md.

import type { Part } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { note, part, scoreOf, TICKS } from "../../common.ts";

/** The first violins: sixteen players, and the lowest note of the section (the open G string). */
const DESKS = 16;
const PITCH = 55;

export const knobs = {
  set: betweenSet({
    group: "Time",
    label: "Set",
    help: "The time betweens, in atoms of the family, with a direction, read in the order written. A negative one steps back: the next term goes before the one the walk stands on. 0 covers no time and sounds nothing",
    value: "-3 -1 2 4 5",
    min: -6,
    max: 6,
    step: 1,
    unit: "atoms",
  }),
  k: number({
    group: "Time",
    label: "Group size",
    help: "The rule draws every group of this many betweens, in the order the set is read; each group keeps that order",
    value: 2,
    min: 1,
    max: 6,
    step: 1,
  }),
  shift: number({
    group: "Time",
    label: "Shift",
    help: "How many places further on the reading starts each cycle (negative: earlier). 0 reads the set the same way every cycle, and the walk's shape comes back each time",
    value: -2,
    min: -6,
    max: 6,
    step: 1,
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the betweens count in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  cycles: number({
    group: "Form",
    label: "Cycles",
    help: "How many times the rule draws all its groups. With the set's length of cycles, a Shift sharing no factor with the length starts the reading once at every place",
    value: 5,
    min: 1,
    max: 24,
    step: 1,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 60,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

/** Every group of k betweens, in the order they are read (positions in dictionary order). */
function groupsOf(reading: number[], k: number): number[][] {
  const size = Math.max(1, Math.min(k, reading.length));
  const out: number[][] = [];
  const pick = (from: number, acc: number[]) => {
    if (acc.length === size) {
      out.push(acc);
      return;
    }
    for (let i = from; i < reading.length; i++) pick(i + 1, [...acc, reading[i]!]);
  };
  pick(0, []);
  return out;
}

/** The walk, whole, in the order the terms are added: positions in atoms from the origin. */
function walk(v: Values<typeof knobs>): number[] {
  const set = [...v.set];
  const n = set.length;
  const terms = [0];
  let here = 0;
  for (let c = 0; c < v.cycles; c++) {
    const start = (((c * v.shift) % n) + n) % n;
    for (const group of groupsOf([...set.slice(start), ...set.slice(0, start)], v.k))
      for (const b of group) {
        here += b;
        terms.push(here);
      }
  }
  return terms;
}

export function score(v: Values<typeof knobs>) {
  if (v.set.some((n) => !Number.isInteger(n)))
    throw new Error("Set: time betweens are whole numbers of atoms (negative ones step back)");
  const atom = atomOf(familyOf(v.family));
  const terms = walk(v);

  // Each step sounds for the stretch it covers, from its earlier term to its later one.
  const steps: { from: number; to: number; voice: number }[] = [];
  for (let i = 1; i < terms.length; i++) {
    const a = terms[i - 1]!;
    const b = terms[i]!;
    if (a !== b) steps.push({ from: Math.min(a, b), to: Math.max(a, b), voice: 0 });
  }
  steps.sort((x, y) => x.from - y.from || x.to - y.to);

  // Each note to the lowest part free at its start: as many parts as notes ever sound together.
  const busy: number[] = [];
  for (const s of steps) {
    let p = busy.findIndex((until) => until <= s.from);
    if (p < 0) p = busy.push(0) - 1;
    busy[p] = s.to;
    s.voice = p;
  }
  const voices = busy.length;
  if (voices > DESKS)
    throw new Error(
      `Set: the walk passes over one moment ${voices} times, more than the ${DESKS} first violins`,
    );
  const players = Math.floor(DESKS / voices);

  // The origin stands on the first beat with room for the earliest term.
  // (A loop, not Math.min(...): large sets and groups make more terms than a call can spread.)
  let earliest = 0;
  let latest = 0;
  for (const t of terms) {
    if (t < earliest) earliest = t;
    if (t > latest) latest = t;
  }
  const origin = Math.ceil((-earliest * atom) / TICKS) * TICKS;
  const bar = 4 * TICKS;
  const end = Math.max(bar, Math.ceil((origin + latest * atom) / bar) * bar);

  const parts: Part[] = Array.from({ length: voices }, (_, p) => {
    const events = steps
      .filter((s) => s.voice === p)
      .map((s) => note(origin + s.from * atom, (s.to - s.from) * atom, PITCH));
    const one = voices === 1;
    return part(
      {
        id: `vn1-${p + 1}`,
        instrument: "violins-1",
        name: one ? "Violins I" : `Violins I ${p + 1}`,
        abbreviation: one ? "Vn. I" : `Vn. I ${p + 1}`,
        players,
        range: [PITCH, PITCH],
        grids: [0],
      },
      events,
      [{ at: 0, level: 3 }],
    );
  });
  return scoreOf("antara · palette A · a step back in time", end / bar, v.tempo, parts);
}

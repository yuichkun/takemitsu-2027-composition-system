// antara palette, A (texture): what rings on is seen from now.
//
// One line, played by two harps. Every new tone is a standpoint, and every earlier tone still
// sounding is measured from it. If the between (its size, either direction) is one of the sizes of
// the set, the earlier tone rings on; if not, it is stopped at that very onset (and the same pitch
// struck again ends it too). That is the only rule. How many tones sound at once is written nowhere:
// it is what the relations seen from each new standpoint leave. And whatever sounds together is
// always made of the set's betweens, since every tone left ringing has been related to every
// standpoint since its own onset.
//
// The line is the standpoint plus the betweens a rule draws from the set, walking on. A between
// that would leave the range is taken the other way (the same size, the opposite direction); no
// octave folding, which would make sizes the set does not hold. Time is a pulse (a time set holding
// one between), so no time rule can be heard; a tone's length comes from the pitch relations, not
// from the time set. The set may be written in stretches split at bar lines ("|"), each drawn by a
// fresh rule; by default one of its betweens widens by a quarter tone from bar 8.
//
// Harp I holds the usual grid; Harp II, tuned a quarter tone low, holds the other. Each tone goes to
// the harp of its grid. Card: README.md.

import {
  choice,
  number,
  pitch,
  pitchRange,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import type { NoteEvent } from "../../../../../src/score/types.ts";
import {
  familyOf,
  FAMILY_OPTIONS,
  pitchSetsOf,
  pulse,
  RULES,
  stretches,
} from "../../../between.ts";
import { curve, gridOf, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

/** Bars of onsets; after the last onset whatever still sounds rings on for RING beats. */
const BARS = 15;
const RING = 4;
/** Betweens drawn at a time by the combinations rule. */
const GROUP = 2;

export const knobs = {
  set: text({
    group: "Pitch",
    label: "Set",
    help: "Signed betweens in semitones (.5 for a quarter tone). The line walks by them; their sizes (without sign) decide which earlier tones ring on. Sections split by | take turns at bar lines",
    value: "-3.5 -1 2.5 4 | -3.5 -1 2.5 4.5",
  }),
  rule: choice({
    group: "Pitch",
    label: "Rule",
    help: "How the line draws from the set. combinations: every pair of the set, in dictionary order · shift each time: the set in order, starting one later each time round · in order: the set as written",
    value: "combinations",
    options: [...RULES],
  }),
  anchor: pitch({
    group: "Pitch",
    label: "Standpoint",
    help: "The first tone of the line",
    value: "C4",
    min: "C2",
    max: "C7",
    step: 0.5,
  }),
  range: pitchRange({
    group: "Pitch",
    label: "Range",
    help: "A between that would take the line out of it is taken the other way (same size, opposite direction)",
    value: ["C3", "C6"],
    min: "C2",
    max: "C7",
    step: 0.5,
  }),
  pulse: number({
    group: "Time",
    label: "Time between",
    help: "The one time between, in atoms of the family (a pulse)",
    value: 2,
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time between counts in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
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

interface Tone {
  at: number;
  midi: number;
  end: number;
}

// Harp I on the usual grid, Harp II tuned a quarter tone low for the other.
const HARPS: Player[] = [
  {
    id: "hp1",
    instrument: "harp",
    name: "Harp I",
    abbreviation: "Hp. I",
    range: [23, 104],
    grids: [0],
  },
  {
    id: "hp2",
    instrument: "harp",
    name: "Harp II (tuned ¼ tone low)",
    abbreviation: "Hp. II",
    range: [23, 104],
    grids: [1],
  },
];

/** The line and the ring rule: each tone with the onset where it is stopped (or the end). */
function ring(v: Values<typeof knobs>): { tones: Tone[]; last: number; end: number } {
  const beats = BARS * 4;
  const sets = pitchSetsOf("Set", v.set);
  const [lo, hi] = v.range;
  if (v.anchor < lo || v.anchor > hi) throw new Error("Standpoint: put it inside the range");
  const bounds = stretches(beats, sets.length).map(([, to]) => to * TICKS);
  const onsets = pulse(beats, familyOf(v.family), v.pulse);

  const tones: Tone[] = [];
  let sounding: Tone[] = [];
  let section = -1;
  let draw = () => 0;
  let sizes = new Set<number>();
  let current = v.anchor;
  onsets.forEach(({ at }, i) => {
    const s = Math.max(
      0,
      bounds.findIndex((end) => at < end),
    );
    if (s !== section) {
      section = s;
      const set = sets[s % sets.length]!;
      draw = stream(set, v.rule, GROUP);
      sizes = new Set(set.map(Math.abs));
    }
    if (i > 0) {
      const b = draw();
      const next = current + b;
      const back = current - b;
      if (next >= lo && next <= hi) current = next;
      else if (back >= lo && back <= hi) current = back;
      else throw new Error("Range: too narrow for the set");
    }
    // The new tone is the standpoint: earlier tones ring on only if their between with it is a
    // size of the set (0 is the same string struck again, which ends the old tone).
    sounding = sounding.filter((q) => {
      const b = Math.abs(current - q.midi);
      if (b !== 0 && sizes.has(b)) return true;
      q.end = at;
      return false;
    });
    const t: Tone = { at, midi: current, end: 0 };
    sounding.push(t);
    tones.push(t);
  });
  const last = onsets.at(-1)?.at ?? 0;
  const end = last + RING * TICKS;
  for (const q of sounding) q.end = end;
  return { tones, last, end };
}

/**
 * A harp's events: staff 1 from middle C up, staff 2 below; tones that overlap on a staff take
 * separate voices (the first free one, in onset order). A staff with four voices busy lends one of
 * the other staff's.
 */
function harpEvents(tones: Tone[]): NoteEvent[] {
  const busy = [0, 0].map(() => [0, 0, 0, 0]);
  return tones.map((t) => {
    const own = t.midi >= 60 ? 0 : 1;
    for (const staff of [own, 1 - own]) {
      const voice = busy[staff]!.findIndex((until) => until <= t.at);
      if (voice < 0) continue;
      busy[staff]![voice] = t.end;
      return note(t.at, t.end - t.at, t.midi, { staff: staff + 1, voice: voice + 1 });
    }
    throw new Error("More than eight tones ringing at once on one harp");
  });
}

export function score(v: Values<typeof knobs>) {
  const { tones, last, end } = ring(v);
  const parts = HARPS.map((h) => {
    const mine = tones.filter((t) => gridOf(t.midi) === h.grids[0]);
    // p throughout; after the last onset, away to nothing.
    const dynamics = curve([
      { at: 0, level: 3 },
      { at: last, level: 3, ramp: true },
      { at: end, level: 0 },
    ]);
    return part(h, harpEvents(mine), dynamics);
  });
  return scoreOf(
    "antara · palette A · what rings on is seen from now",
    Math.ceil(end / (4 * TICKS)),
    v.tempo,
    parts,
  );
}

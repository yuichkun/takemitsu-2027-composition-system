// antara palette, A (pitch): sand through the neck.
//
// A chord is a standpoint, the neck, and a set of betweens measured up from it: every voice stands
// a between d above the neck. The neck itself is never sounded; no voice holds it at any moment.
//
// One rule, taken once per grain: of the voices still above the neck, the one nearest to it reads
// its between the other way round, from +d to −d. It does so by one straight glissando lasting a
// whole grain period, so it passes through the neck exactly halfway, and then holds its new pitch
// below. The between keeps its size; only its name (above or below) turns over. The glide lasts the
// whole period, so exactly one voice is moving at any moment and the next one starts as it
// arrives. When no voice is left above the neck the rule has nothing to take and the sketch ends:
// the last chord is the first one read upside down about the neck, reached one voice at a time.
//
// Time is a set holding one between (a pulse): the grain period, in atoms of one family. The heap
// is held for one grain period, rounded up to a bar line (where every family's grid meets), before
// the first grain; the last chord is held one grain period, to a bar line, and fades over a bar.
//
// One string section, divided into one part per voice: the section whose range holds every voice
// and whose players share out equally among them, so every voice has the same weight and colour.
// Arco, pp, non vibrato. The gliding voice swells to p as it passes the neck and is back to pp as
// it arrives.
// Card: README.md.

import { instrument } from "../../../../../src/instruments/catalog.ts";
import type { TextEvent } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, TICKS, time, type Player } from "../../common.ts";

/** The string sections above the basses, low to high. */
const SECTIONS = ["cellos", "violas", "violins-2", "violins-1"];

/** The register the strings reach together: the cellos' lowest to the first violins' highest. */
const REGISTER: [number, number] = [
  Math.min(...SECTIONS.map((s) => instrument(s).range![0])),
  Math.max(...SECTIONS.map((s) => instrument(s).range![1])),
];

/** The middle of that register, on the quarter-tone grid: the neck by default. */
const MIDDLE = Math.round(REGISTER[0] + REGISTER[1]) / 2;

// Default values, by structure. The neck is the middle of the strings' register (it falls on the
// grid a quarter tone off as a result). Seven betweens whose neighbours differ by 1, 2, 1.5, 2.5,
// 0.5 and 3: each size from 0.5 to 3 exactly once, so every adjacent between in the first chord is
// a different size. In this order the differences grow and shrink by turns (never three the same
// way); 122 orderings do, starting either way. Among them this one is provisional: it was also
// picked so that no sum d_i + d_j (the between from a tone still above to one already below) is
// 12 or 24, which is not a structural reason (12 and 24 are betweens like any other; 51 of the 122
// pass it). The first is the atom of the pitch betweens (0.5). Four carry .5; the neck being on
// the grid a quarter tone off, those four stand on the usual grid and the other three on the
// offset one, and N + d, N − d (2d apart, no .5) are always on the same grid: crossing never
// changes a grid. The grain is 18 atoms of family 3 (6 beats): even, so the neck is passed on the
// family's grid (9 atoms in); 6 beats is not a whole bar, so the grains do not stick to bar lines.
// At tempo 54 a grain is 6.7 s.
export const knobs = {
  heap: betweenSet({
    group: "Chord",
    label: "Betweens above the neck",
    help: "Each voice's between up from the neck (semitones, .5 for a quarter tone). In turn, nearest first, each is read the other way round (+d to −d); its size never changes",
    value: "0.5 1.5 3.5 5 7.5 8 11",
    min: 0.5,
    max: 24,
    step: 0.5,
    unit: "st",
    anchor: "neck",
  }),
  neck: pitch({
    group: "Chord",
    label: "Neck",
    help: "The standpoint every voice passes through and nobody sounds. By default the middle of the strings' register",
    value: MIDDLE,
    min: "C3",
    max: "C6",
    step: 0.5,
  }),
  grain: number({
    group: "Time",
    label: "Grain",
    help: "The one time between: from one voice starting to glide to the next, in atoms of the family. The glide lasts all of it, so one voice moves at a time; when even, the neck is passed on the family's grid",
    value: 18,
    min: 2,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the grain counts in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 54,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

/**
 * The one section that plays every voice: its range holds all of them, and among those, one whose
 * players share out equally among the voices first, then the one with most players to a voice.
 */
function sectionFor(lo: number, hi: number, voices: number) {
  const fits = SECTIONS.map((id) => instrument(id)).filter(
    (s) => s.range![0] <= lo && hi <= s.range![1] && s.sectionSize! >= voices,
  );
  if (fits.length === 0)
    throw new Error(
      `Betweens above the neck: no one string section holds ${voices} voices reaching ` +
        `${lo}–${hi} (cellos ${instrument("cellos").range!.join("–")}, violins ` +
        `${instrument("violins-1").range!.join("–")}, at most 16 players). Narrow the heap, ` +
        `give fewer betweens or move the neck`,
    );
  const even = (s: (typeof fits)[number]) => (s.sectionSize! % voices === 0 ? 0 : 1);
  return [...fits].sort((a, b) => even(a) - even(b) || b.sectionSize! - a.sectionSize!)[0]!;
}

export function score(v: Values<typeof knobs>) {
  // Nearest first; a between written twice is one voice, and 0 would be the neck itself.
  const heap = [...new Set(v.heap.filter((d) => d > 0))].sort((a, b) => a - b);
  if (heap.length === 0) throw new Error("Betweens above the neck: give at least one above 0");

  const bar = 4 * TICKS;
  const grain = v.grain * atomOf(familyOf(v.family));
  // The heap is heard whole for a grain period, to the next bar line, before the first grain.
  const head = Math.ceil(grain / bar) * bar;
  const glides = heap.map((d, k) => ({ d, from: head + k * grain, to: head + (k + 1) * grain }));
  const lastArrival = glides.at(-1)!.to;
  // The last chord holds a grain period, to the next bar line, then fades over one bar.
  const fadeFrom = Math.ceil((lastArrival + grain) / bar) * bar;
  const end = fadeFrom + bar;

  const lo = v.neck - heap.at(-1)!;
  const hi = v.neck + heap.at(-1)!;
  const section = sectionFor(lo, hi, heap.length);
  const size = section.sectionSize!;
  const n = heap.length;
  const short = section.abbreviation.replace(".", "").toLowerCase().replace(" ", "");

  // Numbered from the top of the first chord: 1 is the widest between, the last to cross.
  const parts = glides.map(({ d, from, to }, k) => {
    const j = n - 1 - k;
    const player: Player = {
      id: `${short}-${j + 1}`,
      instrument: section.id,
      name: n === 1 ? section.name : `${section.name} ${j + 1}`,
      abbreviation: n === 1 ? section.abbreviation : `${section.abbreviation} ${j + 1}`,
      players: Math.max(1, Math.floor(size / n) + (j < size % n ? 1 : 0)),
      range: [v.neck - d, v.neck + d],
      grids: [0, 1],
    };
    // Above the neck from the start; the glide is the last grain period of this note.
    const events = [
      note(0, to, v.neck + d, { gliss: true, glissAfter: time(from) }),
      note(to, end - to, v.neck - d),
    ];
    const cross = from + grain / 2;
    const dynamics = curve([
      { at: 0, level: 2 },
      { at: from, level: 2, ramp: true },
      { at: cross, level: 3, ramp: true },
      { at: to, level: 2 },
      { at: fadeFrom, level: 2, ramp: true },
      { at: end, level: 0 },
    ]);
    const out = part(player, events, dynamics);
    const marks: TextEvent[] = [
      { type: "text", at: 0, text: "non vib." },
      { type: "text", at: time(from), text: "gliss." },
    ];
    out.events.unshift(...marks);
    return out;
  });
  // Score order: high to low in the first chord.
  return scoreOf("antara · palette A · sand through the neck", end / bar, v.tempo, parts.reverse());
}

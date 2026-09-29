// antara palette, A (pitch): sand through the neck.
//
// A chord is a standpoint, the neck, and a set of betweens measured up from it: every voice stands
// a between d above the neck. The neck itself is never sounded; no voice holds it at any moment.
//
// One rule, taken once per grain: the next voice in the written order reads its between the other
// way round, from +d to −d. It does so by one straight glissando that passes through the neck
// exactly in the middle of its grain and then holds its new pitch below. The between keeps its
// size; only its name (above or below) turns over. Every glide moves at the same speed, one quarter
// tone (the pitch atom) per time atom, so it lasts 4d atoms; no glide lingers within a quarter
// tone longer than any other. When the written order is used up no voice is left above the neck
// and the sketch ends: the last chord is the first one read upside down about the neck, reached
// one voice at a time.
//
// Time is a set holding one between (a pulse): the grain, from one crossing of the neck to the
// next. It is the length of the farthest voice's glide (4 × the largest d, in atoms), the shortest
// pulse at which no two glides overlap in any order: at most one voice moves at any moment, and
// between glides the chord stands still. The heap is held for one grain, rounded up to a bar line
// (where every family's grid meets), before the first grain; after the last grain the last chord
// is held one grain, to a bar line, and fades over a bar.
//
// One string section, divided into one part per voice: the section whose range holds every voice
// and whose players share out equally among them, so every voice has the same weight and colour.
// Arco, pp, non vibrato. The gliding voice swells to p as it passes the neck and is back to pp as
// it arrives.
// Card: README.md.

import { instrument } from "../../../../../src/instruments/catalog.ts";
import type { TextEvent } from "../../../../../src/score/types.ts";
import {
  choice,
  number,
  numbersOf,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
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

const HEAP = "Betweens above the neck, in the order they cross";

// Default values, by structure (the card gives the counts).
// The set: seven betweens whose neighbours differ by each size from 0.5 to 3 exactly once, growing
// and shrinking by turns (never three the same way), the nearest a pitch atom (0.5) above the
// neck: 122 sets. Among them, the one whose sums d_i + d_j (the betweens between a tone still
// above and one already below, heard only because of the neck) are most often sizes the first
// chord does not hold (18 of its 19 sum sizes; one other set reaches 18 too), and of those two the
// one whose first chord holds more sizes of between (15 against 14). Four of the seven carry .5;
// the neck being on the grid a quarter tone off, those four stand on the usual grid and the other
// three on the offset one, and N + d, N − d (2d apart, no .5) are always on the same grid.
// The order: the glide sizes grow and shrink by turns (the same test as the set's differences);
// the widest glide crosses in the middle grain, so the chord's span, which by the mechanism grows
// until the farthest voice crosses and shrinks after, turns in the middle; the gap across the neck
// neither only widens nor only narrows; and the first three grains and the last three glide as
// nearly the same total of d as can be (19 and 18). Two orders pass, each the other
// backwards; this one puts the heavier half first, so the total does not grow towards the end.
// Time: family 5, the finest atom: at one quarter tone per atom it gives the shortest grain at a
// tempo. The grain is then 44 atoms (8.8 beats), not a whole number of beats, so the crossings do
// not stick to beats or bar lines. Tempo 72 is the slowest (in steps of 2) at which the whole
// stays within an A's length (1:15).
export const knobs = {
  heap: text({
    group: "Chord",
    label: HEAP,
    help: "Each voice's between up from the neck (semitones, .5 for a quarter tone), in the order the voices cross: each is read the other way round (+d to −d) in turn; its size never changes. A between written twice is one voice",
    value: "8 10.5 0.5 11 3.5 9 5.5",
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
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom time counts in. A glide passes one quarter tone per atom (4d atoms in all); the grain is the farthest voice's glide",
    value: FAMILY_OPTIONS[2]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 72,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

/** The betweens as written: each above 0 and on the quarter-tone grid; a repeat is dropped. */
function heapOf(value: string): number[] {
  const out: number[] = [];
  for (const d of numbersOf(HEAP, value.replaceAll("−", "-"))) {
    if (d <= 0) throw new Error(`${HEAP}: ${d} is not above the neck (give betweens above 0)`);
    if (Math.abs(d * 2 - Math.round(d * 2)) > 1e-9)
      throw new Error(`${HEAP}: ${d} is not on the quarter-tone grid (.5 steps)`);
    if (!out.includes(d)) out.push(d);
  }
  return out;
}

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
      `${HEAP}: no one string section holds ${voices} voices reaching ` +
        `${lo}–${hi} (cellos ${instrument("cellos").range!.join("–")}, violins ` +
        `${instrument("violins-1").range!.join("–")}, at most 16 players). Narrow the heap, ` +
        `give fewer betweens or move the neck`,
    );
  const even = (s: (typeof fits)[number]) => (s.sectionSize! % voices === 0 ? 0 : 1);
  return [...fits].sort((a, b) => even(a) - even(b) || b.sectionSize! - a.sectionSize!)[0]!;
}

export function score(v: Values<typeof knobs>) {
  // In the order written: that is the order the voices cross.
  const heap = heapOf(v.heap);
  const n = heap.length;
  const far = Math.max(...heap);

  const bar = 4 * TICKS;
  const atom = atomOf(familyOf(v.family));
  // One quarter tone per atom: a glide over 2d semitones (4d quarter tones) lasts 4d atoms. The
  // grain is the farthest voice's glide, so no two glides overlap whatever the order.
  const grain = 4 * far * atom;
  // The heap is heard whole for a grain, to the next bar line, before the first grain.
  const head = Math.ceil(grain / bar) * bar;
  const glides = heap.map((d, k) => {
    const cross = head + k * grain + grain / 2;
    return { d, cross, from: cross - 2 * d * atom, to: cross + 2 * d * atom };
  });
  // After the last grain the last chord holds a grain, to the next bar line, then fades over a bar.
  const fadeFrom = Math.ceil((head + n * grain + grain) / bar) * bar;
  const end = fadeFrom + bar;

  const section = sectionFor(v.neck - far, v.neck + far, n);
  const size = section.sectionSize!;
  const short = section.abbreviation.replace(".", "").toLowerCase().replace(" ", "");
  // Numbered from the top of the first chord: 1 is the widest between.
  const fromTop = [...heap].sort((a, b) => b - a);

  const parts = glides.map(({ d, cross, from, to }) => {
    const j = fromTop.indexOf(d);
    const player: Player = {
      id: `${short}-${j + 1}`,
      instrument: section.id,
      name: n === 1 ? section.name : `${section.name} ${j + 1}`,
      abbreviation: n === 1 ? section.abbreviation : `${section.abbreviation} ${j + 1}`,
      players: Math.max(1, Math.floor(size / n) + (j < size % n ? 1 : 0)),
      range: [v.neck - d, v.neck + d],
      grids: [0, 1],
    };
    // Above the neck from the start; the glide is the last stretch of this note.
    const events = [
      note(0, to, v.neck + d, { gliss: true, glissAfter: time(from) }),
      note(to, end - to, v.neck - d),
    ];
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
    return { j, out };
  });
  // Score order: high to low in the first chord.
  parts.sort((a, b) => a.j - b.j);
  return scoreOf(
    "antara · palette A · sand through the neck",
    end / bar,
    v.tempo,
    parts.map((p) => p.out),
  );
}

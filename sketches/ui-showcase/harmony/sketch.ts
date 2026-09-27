// UI showcase: two chords for strings, alternating at marks on a timeline, coloured by a band of
// techniques. Chord A is drawn on a pitch lattice; chord B is a set found by its interval vector.
// Shows: lattice, vector-set, markers, lanes, pitch, pitch-range.
// The music is only there to show the controls; nothing here is a proposal for the piece.

import { instrument } from "../../../src/instruments/catalog.ts";
import type { NoteEvent, Part, Score } from "../../../src/score/types.ts";
import {
  laneAt,
  lanes,
  lattice,
  latticePitch,
  markers,
  pitch,
  pitchRange,
  vectorSet,
  type Values,
} from "../../../src/sketch/knobs.ts";

const bars = 24;
/** Low to high: who takes the lowest notes first. */
const sections = [
  { id: "cb", instrument: "basses" },
  { id: "vc", instrument: "cellos" },
  { id: "va", instrument: "violas" },
  { id: "vn2", instrument: "violins-2" },
  { id: "vn1", instrument: "violins-1" },
];

export const knobs = {
  root: pitch({
    group: "Chords",
    label: "Centre",
    help: "The lattice's centre, and the pitch chord B stands on",
    value: "D3",
    min: "C2",
    max: "C5",
  }),
  chordA: lattice({
    group: "Chords",
    label: "Chord A",
    help: "Chord A as nodes of a lattice: across in fifths, up in major thirds, from the centre",
    value: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 0],
    ],
    axes: [7, 4],
    size: [7, 5],
    centre: "root",
  }),
  chordB: vectorSet({
    group: "Chords",
    label: "Chord B",
    help: "Chord B as a pitch-class set above the centre, found by the intervals it holds",
    value: [0, 1, 4, 6],
  }),
  spread: pitchRange({
    group: "Chords",
    label: "Spread",
    help: "The chord is spread over this range: its notes, low to high, go to evenly spaced places, each at the nearest octave",
    value: ["E2", "A5"],
    min: "C1",
    max: "C8",
  }),
  changes: markers({
    group: "Time",
    label: "Changes",
    help: "Where the chord changes: A, then B, then A …",
    value: [6, 12, 18],
    length: bars,
    unit: "bars",
  }),
  colour: lanes({
    group: "Time",
    label: "Technique",
    help: "How the strings play, over time; a change re-bows the chord",
    value: [
      [0, "sul-tasto"],
      [8, "ord"],
      [16, "sul-pont"],
    ],
    options: ["ord", "sul-tasto", "sul-pont", "tremolo", "flautando"],
    length: bars,
    unit: "bars",
  }),
};

/** Spreads the chord over a range: the notes, low to high, go to evenly spaced places in it, each
 * at the octave nearest its place. Then they are shared out low to high among the sections, at
 * most two a section and those within an octave. */
function voice(pitches: number[], [lo, hi]: [number, number]): Map<string, number[]> {
  const sorted = [...new Set(pitches)].sort((a, b) => a - b);
  const n = sorted.length;
  const folded = [
    ...new Set(
      sorted.map((p, i) => {
        const place = n > 1 ? lo + ((hi - lo) * i) / (n - 1) : (lo + hi) / 2;
        return p + 12 * Math.round((place - p) / 12);
      }),
    ),
  ].sort((a, b) => a - b);
  const out = new Map<string, number[]>(sections.map((s) => [s.id, []]));
  // The k-th lowest note goes to section k·5/n (low to high, so voices do not cross), or the
  // nearest one that can take it.
  folded.forEach((p, k) => {
    const home = Math.min(sections.length - 1, Math.floor((k * sections.length) / folded.length));
    const order = [...sections.keys()].sort(
      (x, y) => Math.abs(x - home) - Math.abs(y - home) || y - x,
    );
    const who = order
      .map((i) => sections[i]!)
      .find((s) => {
        const [a, b] = instrument(s.instrument).range ?? [0, 127];
        const has = out.get(s.id)!;
        return p >= a && p <= b && has.length < 2 && has.every((q) => Math.abs(q - p) <= 12);
      });
    if (who) out.get(who.id)!.push(p);
  });
  return out;
}

export function score(v: Values<typeof knobs>): Score {
  const a = v.chordA.map((node) => latticePitch(v.root, node, knobs.chordA.axes));
  const b = v.chordB.map((pc) => v.root + pc);
  const voicings = [voice(a, v.spread), voice(b, v.spread)];
  const changes = [...v.changes].sort((x, y) => x - y);
  // Cut the time wherever the chord or the technique changes.
  const cuts = [...new Set([0, ...changes, ...v.colour.map(([s]) => s), bars])]
    .filter((c) => c >= 0 && c <= bars)
    .sort((x, y) => x - y);
  const chordAt = (bar: number) => changes.filter((c) => c <= bar).length % 2;

  const parts: Part[] = sections.map((s) => {
    const events: NoteEvent[] = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const [from, to] = [cuts[i]!, cuts[i + 1]!];
      const notes = voicings[chordAt(from)]!.get(s.id)!;
      const technique = laneAt(v.colour, from);
      if (notes.length)
        events.push({
          at: from * 4,
          dur: (to - from) * 4,
          pitch: notes.map((midi) => ({ midi })),
          technique: technique === "ord" ? undefined : technique,
        });
    }
    return { id: s.id, instrument: s.instrument, events, dynamics: [{ at: 0, level: 4 }] };
  });

  return {
    title: "Showcase: harmony",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: 60 }],
    measures: bars,
    rehearsal: [0, ...changes].map((c, i) => ({
      measure: c + 1,
      label: String.fromCharCode(65 + i),
    })),
    parts,
  };
}

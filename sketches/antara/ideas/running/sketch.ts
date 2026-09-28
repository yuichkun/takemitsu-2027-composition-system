// antara, an idea for the piece: the string sections running, both axes drawn by moving rules.
//
// Every section runs the same rules in canon, each from its own entry. A line is two layers of time
// added up from the start: the strokes, one on every atom of the family in force (the gear), and the
// heads, where a group of strokes begins, drawn from a set of group lengths. Each group plays one
// pitch group: from the section's standpoint (or on from the last note), as many betweens as the
// group has strokes after its head. So the metre that is heard comes from the group lengths, and the
// harmony from the standpoints and the set.
//
// Three things change over the bars, each on its own band (the story): which set the lines draw
// from, where the sections stand (all on the anchor in octaves; split onto the notes of the set's
// first group, so the vertical is made of the same betweens as the lines; walking on), and the gear
// (3, 2 and 5 strokes' families: faster at the same tempo). A change reaches the sections one after
// another, bottom up, so for a moment sections run in different families and meet only on the beat.
// The basses play only where the heads of several sections meet: the beat that arises, sounded after
// the fact. At the end every section meets on one downbeat, on the anchor in octaves or on the
// split. Card: README.md.

import type { Articulation, NoteEvent, Part, Score } from "../../../../src/score/types.ts";
import {
  betweenSet,
  choice,
  laneAt,
  lanes,
  number,
  pitch,
  toggle,
  type Values,
} from "../../../../src/sketch/knobs.ts";
import { atomOf, drawer, type Family, TICKS, time } from "../../between.ts";

/** Bars of running; the sections meet on the downbeat of the bar after. */
const BARS = 24;
const marks = ["pp", "p", "mp", "mf", "f", "ff", "fff"];
const levelOf = (mark: string) => marks.indexOf(mark) + 2; // pp = 2 … fff = 8
const GEARS = ["3 · triplet 8ths", "2 · 16ths", "5 · quintuplets"];
const gearOf = (option: string): Family => Number(option.split(" ")[0]) as Family;
const STANDS = ["one", "split", "walk on"];
const RULES = ["combinations", "shift each time"];

export const knobs = {
  setA: betweenSet({
    group: "Pitch",
    label: "Set A",
    help: "The betweens the lines draw from while the Set band says A, in semitones (quarter tones as .5; one written twice comes up more often)",
    value: "-5 -2 3 4",
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
    anchor: "anchor",
  }),
  setB: betweenSet({
    group: "Pitch",
    label: "Set B",
    help: "The betweens the lines draw from while the Set band says B",
    value: "-2 -1 2 3",
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
    anchor: "anchor",
  }),
  pitchRule: choice({
    group: "Pitch",
    label: "Rule",
    help: "combinations: each group takes the next combination of as many betweens as it needs, in dictionary order (as in Quantization) · shift each time: the set in order, starting one later each time round",
    value: "combinations",
    options: RULES,
  }),
  anchor: pitch({
    group: "Pitch",
    label: "Anchor",
    help: "The cellos' standpoint. The others stand on the same note one, two and three octaves up, or on the notes of the set's first group",
    value: "D3",
    min: "G2",
    max: "D4",
    step: 0.5,
  }),
  lengths: betweenSet({
    group: "Time",
    label: "Group lengths",
    help: "How many strokes a group lasts. Each group begins with an accent and plays one pitch group, so these lengths are the metre that is heard",
    value: "2 3 3 4",
    min: 1,
    max: 8,
    step: 1,
    unit: "strokes",
  }),
  timeRule: choice({
    group: "Time",
    label: "Rule",
    help: "combinations: the lengths come in every distinct combination, in dictionary order · shift each time: the set in order, starting one later each time round",
    value: "combinations",
    options: RULES,
  }),
  timeGroup: number({
    group: "Time",
    label: "Group size",
    help: "How many lengths each combination holds",
    value: 2,
    min: 1,
    max: 6,
    step: 1,
  }),
  sets: lanes({
    group: "Story",
    label: "Set",
    help: "Which set the lines draw from, bar by bar",
    value: [
      [0, "A"],
      [14, "B"],
    ],
    options: ["A", "B"],
    length: BARS,
    unit: "bars",
  }),
  stand: lanes({
    group: "Story",
    label: "Standpoint",
    help: "one: every section on the anchor, in octaves · split: each on a note of the set's first group (the cellos keep the anchor) · walk on: each group starts where the last one ended",
    value: [
      [0, "one"],
      [6, "split"],
      [12, "walk on"],
    ],
    options: STANDS,
    length: BARS,
    unit: "bars",
  }),
  end: choice({
    group: "Story",
    label: "Meet on",
    help: "Where every section lands together on the last downbeat: the anchor in octaves, or the notes of the split",
    value: "the anchor",
    options: ["the anchor", "the split"],
  }),
  gears: lanes({
    group: "Story",
    label: "Gear",
    help: "The family the strokes are added in: 3 strokes a beat, 4 (16ths) or 5. Faster with no change of tempo; a family changes only on a beat, where they all meet",
    value: [
      [0, GEARS[0]!],
      [8, GEARS[1]!],
      [16, GEARS[2]!],
    ],
    options: GEARS,
    length: BARS,
    unit: "bars",
  }),
  entries: number({
    group: "Layers",
    label: "Entries",
    help: "Beats between one section's entry and the next, cellos first. Against the length of the rules' round, it decides whether the sections' accents fall together or across",
    value: 6,
    min: 0,
    max: 16,
    step: 1,
    unit: "beats",
  }),
  ripple: number({
    group: "Layers",
    label: "Ripple",
    help: "Beats between sections when a change on the bands passes through them, bottom up. While it passes, sections run in different gears and meet only on the beat; afterwards their accents fall in new places. 0: all at once",
    value: 3,
    min: 0,
    max: 8,
    step: 1,
    unit: "beats",
  }),
  basses: toggle({
    group: "Layers",
    label: "Basses on the meetings",
    help: "The basses play (pizz.) only where groups of several sections begin at the same moment: the beat that arises, sounded after the fact",
    value: true,
  }),
  meet: number({
    group: "Layers",
    label: "Meeting",
    help: "How many sections must begin a group at the same moment for the basses to play",
    value: 3,
    min: 2,
    max: 4,
    step: 1,
    unit: "sections",
  }),
  stroke: choice({
    group: "Sound",
    label: "Stroke",
    help: "spiccato: dots with spicc., bouncing (BBC SO Short Spiccato) · staccato: dots, on the string (Short Staccato)",
    value: "spiccato",
    options: ["spiccato", "staccato"],
  }),
  from: choice({
    group: "Sound",
    label: "Start",
    help: "Dynamic at the first stroke; it grows in one line to the last bar",
    value: "p",
    options: marks,
  }),
  to: choice({
    group: "Sound",
    label: "Peak",
    help: "Dynamic at the end of the running (the meeting is a step louder)",
    value: "ff",
    options: marks,
  }),
  tempo: number({
    group: "Sound",
    label: "Tempo",
    help: "Quarter notes per minute. At 120 the gears run 6, 8 and 10 strokes a second",
    value: 120,
    min: 72,
    max: 160,
    step: 2,
    unit: "bpm",
  }),
};

type V = Values<typeof knobs>;

interface Section {
  id: string;
  instrument: string;
  /** Semitones above the anchor when every section stands on it. */
  register: number;
  /** Where the line stays: notes leaving it move by octaves back in. */
  window: [number, number];
}

// Bottom up: the order of the entries and of every change.
const SECTIONS: Section[] = [
  { id: "vc", instrument: "cellos", register: 0, window: [43, 64] }, // G2–E4
  { id: "va", instrument: "violas", register: 12, window: [53, 74] }, // F3–D5
  { id: "vn2", instrument: "violins-2", register: 24, window: [62, 84] }, // D4–C6
  { id: "vn1", instrument: "violins-1", register: 36, window: [72, 93] }, // C5–A6
];
const BASS_WINDOW: [number, number] = [28, 47]; // E1–B2, sounding

const fold = (p: number, [lo, hi]: [number, number]) => {
  let q = p;
  while (q > hi) q -= 12;
  while (q < lo) q += 12;
  return q;
};

/** Pitch groups of any size from a set: the next `k` betweens the rule gives. */
function pitchDraw(set: number[], rule: string): (k: number) => number[] {
  if (rule === "combinations") {
    const bySize = new Map<number, () => number[]>();
    return (k) => {
      const out: number[] = [];
      while (out.length < k) {
        // More betweens than the set holds: whole sets, one after another.
        const size = Math.min(k - out.length, set.length);
        let draw = bySize.get(size);
        if (!draw) bySize.set(size, (draw = drawer(set, "combinations", size, "ascending")));
        out.push(...draw());
      }
      return out;
    };
  }
  return stream(set, rule, 1);
}

/** A rule's groups laid end to end, taken `k` at a time. */
function stream(set: number[], rule: string, size: number): (k: number) => number[] {
  const draw = drawer(set, rule, size, "ascending");
  let queue: number[] = [];
  return (k) => {
    const out: number[] = [];
    while (out.length < k) {
      if (queue.length === 0) queue = [...draw()];
      out.push(queue.shift()!);
    }
    return out;
  };
}

/** The notes of the set's first group of three, as betweens from the standpoint (0 first). */
function chordOf(set: number[], rule: string): number[] {
  const group = drawer(set, rule, 3, "ascending")().slice(0, 3);
  const sums = [0];
  for (const b of group) sums.push(sums.at(-1)! + b);
  return sums;
}

function standpoint(v: V, s: number, mode: string, set: number[]): number {
  const sec = SECTIONS[s]!;
  const chord = chordOf(set, v.pitchRule);
  const lift = mode === "one" || s === 0 ? 0 : chord[1 + ((s - 1) % (chord.length - 1))]!;
  return fold(v.anchor + sec.register + lift, sec.window);
}

interface Stroke {
  at: number;
  dur: number;
  midi: number;
  head: boolean;
}

/** One section's line: its strokes, and the standpoint it meets on at the end. */
function line(v: V, s: number): { strokes: Stroke[]; last: number } {
  const sec = SECTIONS[s]!;
  const lag = s * v.ripple; // beats behind the bands
  const end = BARS * 4 * TICKS;
  // Where this section is on the bands (in bars) at a beat.
  const bandAt = (beat: number) => Math.min(BARS - 1e-9, Math.max(0, (beat - lag) / 4));
  const setOf = (label: string) => (label === "A" ? v.setA : v.setB);
  const draws = new Map<string, (k: number) => number[]>();
  const nextLength = stream(v.lengths, v.timeRule, v.timeGroup);
  const strokes: Stroke[] = [];
  let queue: number[] = [];
  let current: number | undefined;
  let t = s * v.entries * TICKS;
  while (t < end) {
    const band = bandAt(Math.floor(t / TICKS));
    const atom = atomOf(gearOf(laneAt(v.gears, band)));
    const head = queue.length === 0;
    if (head) {
      const label = laneAt(v.sets, band);
      const set = setOf(label);
      const mode = laneAt(v.stand, band);
      let draw = draws.get(label);
      if (!draw) draws.set(label, (draw = pitchDraw(set, v.pitchRule)));
      const strokesInGroup = nextLength(1)[0]!;
      if (mode === "walk on") {
        let p = current ?? standpoint(v, s, "split", set);
        queue = draw(strokesInGroup).map((b) => (p = fold(p + b, sec.window)));
      } else {
        const from = standpoint(v, s, mode, set);
        let p = from;
        queue = [from, ...draw(strokesInGroup - 1).map((b) => fold((p += b), sec.window))];
      }
    }
    const midi = queue.shift()!;
    strokes.push({ at: t, dur: atom, midi, head });
    current = midi;
    t += atom;
  }
  const band = bandAt(BARS * 4);
  const mode = v.end === "the anchor" ? "one" : "split";
  return { strokes, last: standpoint(v, s, mode, setOf(laneAt(v.sets, band))) };
}

export function score(v: V): Score {
  const end = BARS * 4 * TICKS;
  const technique = v.stroke === "spiccato" ? "spiccato" : undefined;
  const dynamics = [
    { at: 0, level: levelOf(v.from), to: "linear" as const },
    { at: BARS * 4, level: levelOf(v.to) },
  ];
  const meeting = Math.min(8, levelOf(v.to) + 1);
  const lines = SECTIONS.map((_, s) => line(v, s));

  const parts: Part[] = SECTIONS.map((sec, s) => {
    const { strokes, last } = lines[s]!;
    const events: NoteEvent[] = strokes.map((k) => {
      const articulations: Articulation[] = k.head ? ["staccato", "accent"] : ["staccato"];
      return {
        at: time(k.at),
        dur: time(k.dur),
        pitch: { midi: k.midi },
        articulations,
        technique,
      };
    });
    events.push({
      at: time(end),
      dur: 0.5,
      pitch: { midi: last },
      articulations: ["staccato", "accent"],
      dynamic: meeting,
    });
    return { id: sec.id, instrument: sec.instrument, dynamics, events };
  });

  if (v.basses) {
    // Where groups of several sections begin together; the lowest of them, down in the basses.
    const heads = new Map<number, Stroke[]>();
    for (const { strokes } of lines)
      for (const k of strokes) if (k.head) heads.set(k.at, [...(heads.get(k.at) ?? []), k]);
    const meetings = [...heads]
      .filter(([, met]) => met.length >= v.meet)
      .sort((a, b) => a[0] - b[0]);
    const events: NoteEvent[] = meetings.map(([at, met], i) => {
      const next = meetings[i + 1]?.[0] ?? end;
      const event: NoteEvent = {
        at: time(at),
        // Plucked, one atom long: on the grid of the sections that meet, never tied.
        dur: time(Math.min(next - at, ...met.map((k) => k.dur))),
        pitch: { midi: fold(Math.min(...met.map((k) => k.midi)), BASS_WINDOW) },
        technique: "pizz",
      };
      if (met.length === SECTIONS.length) event.articulations = ["accent"];
      return event;
    });
    events.push({
      at: time(end),
      dur: 0.5,
      pitch: { midi: fold(lines[0]!.last, BASS_WINDOW) },
      technique: "pizz",
      articulations: ["accent"],
      dynamic: meeting,
    });
    parts.push({ id: "cb", instrument: "basses", dynamics, events });
  }

  // A letter where anything on the bands changes.
  const changes = [
    ...new Set([...v.sets, ...v.stand, ...v.gears].map(([bar]) => Math.round(bar))),
  ].sort((a, b) => a - b);
  const rehearsal = changes.map((bar, i) => ({
    measure: bar + 1,
    label: String.fromCharCode(65 + i),
  }));

  return {
    title: "antara · running strings",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: BARS + 1,
    rehearsal,
    // Score order: violins at the top.
    parts: [...parts.slice(0, 4).reverse(), ...parts.slice(4)],
  };
}

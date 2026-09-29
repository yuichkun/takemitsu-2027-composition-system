// antara, an idea for the piece: the string sections running (../running, with 余湖さん's values "My
// Fav"), on antara's orchestra (pieces/antara/ensemble.ts), the rest of the orchestra sounding what
// the running makes. Card: README.md.
//
// The strings run as in running. Every section runs the same rules in canon, each from its own entry:
// strokes on every atom of the family in force (the gear), and heads, where a group of strokes begins,
// drawn from a set of group lengths. Each group plays one pitch group from the section's standpoint
// (or on from the last note). Three bands change over the bars (the set, the standpoint, the gear),
// each change reaching the sections one after another, bottom up. At the end every section meets on
// one downbeat.
// Each line is passed round four divisions in continuous phrases. A division rests between its
// phrases; no strokes are removed inside one. Each phrase has at most ten strokes including the
// three shared with the next division (defaults). Pitch grids are not
// assigned to divisions. The underlying lines also feed the other instruments unchanged.
//
// The rest of the orchestra, each by what it can play:
// - Winds on the heads: each section's group heads (the accents, the metre that is heard), doubled by
//   a pair of winds of its register taking turns: flutes (first violins), oboes (seconds), clarinets
//   (violas), bassoons (cellos).
// - Brass on the meetings: where the heads of two sections fall together the basses pluck (as in
//   running); where three meet the horns sound their notes; where all four meet the trumpets, the
//   trombones, the tuba and the timpani too. The more lines meet, the more of the orchestra marks the
//   beat that arises.
// - Fixed pitches double: the two harps share the second violins' line by the notes each can play
//   (harp 1 the semitone pitches, harp 2, a quarter tone low, the others); the marimba doubles the
//   violas' semitone strokes, the piano the cellos', the celesta the first violins'. Which
//   instrument sounds a stroke changes as a line moves between the semitone pitches and those a
//   quarter tone off.
// - Everyone on the meeting: the last downbeat is played by the whole orchestra, each instrument on
//   the notes of the meeting it can play.

import { ensemble } from "../../../../pieces/antara/ensemble.ts";
import type {
  Articulation,
  DynamicPoint,
  NoteEvent,
  Part,
  Pitch,
  Score,
} from "../../../../src/score/types.ts";
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
import type { Seam } from "../../../../src/sketch/nest.ts";
import { atomOf, drawer, type Family, TICKS, time } from "../../between.ts";

/** Bars of running; the sections meet on the downbeat of the bar after. */
const BARS = 24;
const marks = ["pp", "p", "mp", "mf", "f", "ff", "fff"];
const levelOf = (mark: string) => marks.indexOf(mark) + 2; // pp = 2 … fff = 8
const GEARS = ["3 · triplet 8ths", "2 · 16ths", "5 · quintuplets"];
const gearOf = (option: string): Family => Number(option.split(" ")[0]) as Family;
const STANDS = ["one", "split", "walk on"];
const RULES = ["combinations", "shift each time"];
const ORCHESTRA = "Orchestra";

export const knobs = {
  setA: betweenSet({
    group: "Pitch",
    label: "Set A",
    help: "The betweens the lines draw from while the Set band says A, on the quarter-tone grid (in semitones, .5 for a quarter tone; one written twice comes up more often). An odd number of quarter tones moves a line to the pitches a quarter tone off",
    value: "-1.5 2 5",
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
    value: "-6.5 -5.5 -4.5 8.5",
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
    anchor: "anchor",
  }),
  pitchRule: choice({
    group: "Pitch",
    label: "Rule",
    help: "combinations: each group takes the next combination of as many betweens as it needs, in dictionary order · shift each time: the set in order, starting one later each time round",
    value: "shift each time",
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
    value: "2 4 4 4",
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
    value: [[0, "A"]],
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
    help: "Where every section lands together on the last downbeat: the notes of the split (of the set in force), or the anchor in octaves",
    value: "the split",
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
    help: "Beats between one section's entry and the next, cellos first",
    value: 6,
    min: 0,
    max: 16,
    step: 1,
    unit: "beats",
  }),
  ripple: number({
    group: "Layers",
    label: "Ripple",
    help: "Beats between sections when a change on the bands passes through them, bottom up. 0: all at once",
    value: 3,
    min: 0,
    max: 8,
    step: 1,
    unit: "beats",
  }),
  sharing: choice({
    group: "Strings",
    label: "Sharing",
    help: "Four groups pass continuous phrases round, resting between phrases; whole sections is the original version. Both keep every pitch, onset and accent",
    value: "four groups, phrases",
    options: ["four groups, phrases", "whole sections"],
  }),
  chunk: number({
    group: "Strings",
    label: "Chunk",
    help: "Maximum strokes in one continuous phrase, including its overlap with the next division. The next division enters after Chunk minus Overlap strokes; original accents stay where they are",
    value: 10,
    min: 8,
    max: 24,
    step: 1,
    unit: "strokes",
  }),
  overlap: number({
    group: "Strings",
    label: "Overlap",
    help: "Strokes shared by consecutive divisions, included in Chunk's limit. The same notes at the same times; no held notes or new pitches are added",
    value: 3,
    min: 0,
    max: 4,
    step: 1,
    unit: "strokes",
  }),
  basses: toggle({
    group: "Layers",
    label: "Basses on the meetings",
    help: "The basses play (pizz.) only where groups of several sections begin at the same moment",
    value: true,
  }),
  meet: number({
    group: "Layers",
    label: "Meeting",
    help: "How many sections must begin a group at the same moment for the basses to play",
    value: 2,
    min: 2,
    max: 4,
    step: 1,
    unit: "sections",
  }),
  winds: toggle({
    group: ORCHESTRA,
    label: "Winds on the heads",
    help: "Each section's group heads doubled by a pair of winds of its register, taking turns: flutes (first violins), oboes (seconds), clarinets (violas), bassoons (cellos)",
    value: true,
  }),
  brass: toggle({
    group: ORCHESTRA,
    label: "Brass on the meetings",
    help: "Where three sections' heads fall together the horns sound their notes; where all four do, the trumpets, trombones, tuba and timpani too",
    value: true,
  }),
  keys: toggle({
    group: ORCHESTRA,
    label: "Fixed pitches double",
    help: "The two harps share the second violins' line (harp 1 the semitone pitches, harp 2 those a quarter tone off); the marimba doubles the violas' semitone strokes, the piano the cellos', the celesta the first violins'",
    value: true,
  }),
  tutti: toggle({
    group: ORCHESTRA,
    label: "Everyone on the meeting",
    help: "The last downbeat played by the whole orchestra, each instrument on the notes of the meeting it can play",
    value: true,
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

const player = (id: string) => {
  const p = ensemble.find((x) => x.id === id);
  if (!p) throw new Error(`${id} is not in antara's orchestra`);
  return p;
};

/** A part of antara's orchestra, with its events and dynamics. */
function partOf(id: string, events: Part["events"], dynamics: DynamicPoint[]): Part {
  const p = player(id);
  const out: Part = { id: p.id, instrument: p.instrument, name: p.name, dynamics, events };
  if (p.players !== undefined) out.players = p.players;
  if (p.player !== undefined) out.player = p.player;
  if (p.tuning !== undefined) out.tuning = p.tuning;
  return out;
}

interface Section {
  id: string;
  /** Semitones above the anchor when every section stands on it. */
  register: number;
  /** Where the line stays: notes leaving it move by octaves back in. */
  window: [number, number];
}

// Bottom up: the order of the entries and of every change. Whole sections.
const SECTIONS: Section[] = [
  { id: "vct", register: 0, window: [43, 64] }, // G2–E4
  { id: "vat", register: 12, window: [53, 74] }, // F3–D5
  { id: "vn2t", register: 24, window: [62, 84] }, // D4–C6
  { id: "vn1t", register: 36, window: [72, 93] }, // C5–A6
];
const BASS_WINDOW: [number, number] = [28, 47]; // E1–B2, sounding

/** Which pitches a note is among: 0 the semitone pitches, 1 those a quarter tone off. */
const gridOf = (m: number) => Math.round(m * 2) % 2;

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

/** Bounded continuous slices; overlap is included in the limit, never appended beyond it. */
function sharedPhrases(strokes: Stroke[], size: number, overlap: number): Stroke[][] {
  if (
    !Number.isInteger(size) ||
    size < 1 ||
    !Number.isInteger(overlap) ||
    overlap < 0 ||
    overlap >= size ||
    overlap * 2 > size
  )
    throw new Error("Chunk must be a positive whole number; Overlap must be 0 to half of Chunk");
  const groups: Stroke[][] = Array.from({ length: 4 }, () => []);
  let from = 0;
  let turn = 0;
  while (from < strokes.length) {
    const to = Math.min(strokes.length, from + size);
    groups[turn % groups.length]!.push(...strokes.slice(from, to));
    if (to === strokes.length) break;
    from = to - overlap;
    turn++;
  }
  return groups;
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

// Winds on the heads: a pair for each section, and where their notes sit (sounding).
const WINDS: Record<string, { pair: [string, string]; window: [number, number] }> = {
  vn1t: { pair: ["fl1", "fl2"], window: [72, 94] },
  vn2t: { pair: ["ob1", "ob2"], window: [60, 86] },
  vat: { pair: ["cl1", "cl2"], window: [52, 84] },
  vct: { pair: ["bn1", "bn2"], window: [36, 66] },
};

// Fixed pitches double: which section's strokes, on which pitches (0: semitone, 1: a quarter tone off).
const DOUBLES: { id: string; line: string; grid: 0 | 1 }[] = [
  { id: "hp1", line: "vn2t", grid: 0 },
  { id: "hp2", line: "vn2t", grid: 1 },
  { id: "mar", line: "vat", grid: 0 },
  { id: "pno", line: "vct", grid: 0 },
  { id: "cel", line: "vn1t", grid: 0 },
];

// Everyone on the meeting: where each instrument plays the meeting's notes (sounding). Instruments
// that play chords take every note of the meeting they can play; the others one each.
const TUTTI: { id: string; window: [number, number]; chord?: boolean }[] = [
  { id: "picc", window: [79, 98] },
  { id: "fl1", window: [67, 91] },
  { id: "fl2", window: [65, 89] },
  { id: "ob1", window: [62, 86] },
  { id: "ob2", window: [60, 84] },
  { id: "eh", window: [55, 77] },
  { id: "cl1", window: [58, 84] },
  { id: "cl2", window: [52, 79] },
  { id: "bcl", window: [38, 65] },
  { id: "bn1", window: [43, 65] },
  { id: "bn2", window: [38, 60] },
  { id: "cbn", window: [26, 45] },
  { id: "hn1", window: [55, 74] },
  { id: "hn2", window: [50, 70] },
  { id: "hn3", window: [53, 72] },
  { id: "hn4", window: [45, 65] },
  { id: "tp1", window: [62, 82] },
  { id: "tp2", window: [58, 79] },
  { id: "tp3", window: [55, 76] },
  { id: "tb1", window: [48, 67] },
  { id: "tb2", window: [45, 65] },
  { id: "btb", window: [36, 58] },
  { id: "tba", window: [30, 50] },
  { id: "timp", window: [40, 55] },
  { id: "hp1", window: [48, 84], chord: true },
  { id: "hp2", window: [48, 84], chord: true },
  { id: "pno", window: [36, 96], chord: true },
  { id: "cel", window: [72, 96], chord: true },
  { id: "mar", window: [48, 84], chord: true },
];

export function score(v: V): Score {
  const end = BARS * 4 * TICKS;
  const technique = v.stroke === "spiccato" ? "spiccato" : undefined;
  const curve = (down = 0): DynamicPoint[] => [
    { at: 0, level: Math.max(1, levelOf(v.from) - down), to: "linear" },
    { at: BARS * 4, level: Math.max(1, levelOf(v.to) - down) },
  ];
  const meeting = Math.min(8, levelOf(v.to) + 1);
  const lines = SECTIONS.map((_, s) => line(v, s));
  const lineOf = (id: string) => lines[SECTIONS.findIndex((s) => s.id === id)]!;
  const parts: Part[] = [];
  const add = (id: string, events: Part["events"], dynamics: DynamicPoint[]) => {
    const had = parts.find((p) => p.id === id);
    if (had) had.events.push(...events);
    else parts.push(partOf(id, events, dynamics));
  };

  SECTIONS.forEach((sec, s) => {
    const { strokes, last } = lines[s]!;
    const eventOf = (k: Stroke): NoteEvent => {
      const articulations: Articulation[] = k.head ? ["staccato", "accent"] : ["staccato"];
      return {
        at: time(k.at),
        dur: time(k.dur),
        pitch: { midi: k.midi },
        articulations,
        technique,
      };
    };
    const divided = v.sharing === "four groups, phrases";
    if (divided)
      sharedPhrases(strokes, v.chunk, v.overlap).forEach((phrase, i) => {
        if (phrase.length) add(`${sec.id.slice(0, -1)}-4-${i + 1}`, phrase.map(eventOf), curve());
      });
    const events: NoteEvent[] = divided ? [] : strokes.map(eventOf);
    events.push({
      at: time(end),
      dur: 0.5,
      pitch: { midi: last },
      articulations: ["staccato", "accent"],
      dynamic: meeting,
    });
    add(sec.id, events, curve());
  });

  // Where groups of several sections begin together.
  const heads = new Map<number, Stroke[]>();
  for (const { strokes } of lines)
    for (const k of strokes) if (k.head) heads.set(k.at, [...(heads.get(k.at) ?? []), k]);
  const meetings = [...heads].sort((a, b) => a[0] - b[0]);
  const short = (at: number, met: Stroke[], midi: number, accent: boolean): NoteEvent => ({
    at: time(at),
    // One atom long: on the grid of the sections that meet, never tied.
    dur: time(Math.min(...met.map((k) => k.dur))),
    pitch: { midi },
    articulations: accent ? ["staccato", "accent"] : ["staccato"],
  });

  if (v.basses) {
    const met2 = meetings.filter(([, met]) => met.length >= v.meet);
    const events: NoteEvent[] = met2.map(([at, met], i) => {
      const next = met2[i + 1]?.[0] ?? end;
      const event: NoteEvent = {
        at: time(at),
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
    add("cbt", events, curve());
  }

  if (v.winds) {
    for (const sec of SECTIONS) {
      const w = WINDS[sec.id]!;
      const both: NoteEvent[][] = [[], []];
      lineOf(sec.id)
        .strokes.filter((k) => k.head)
        .forEach((k, n) => {
          both[n % 2]!.push(short(k.at, [k], fold(k.midi, w.window), true));
        });
      w.pair.forEach((id, n) => {
        if (both[n]!.length) add(id, both[n]!, curve(1));
      });
    }
  }

  if (v.brass) {
    const horns: NoteEvent[][] = [[], [], [], []];
    const all: Record<string, NoteEvent[]> = {};
    const put = (id: string, e: NoteEvent) => (all[id] = [...(all[id] ?? []), e]);
    for (const [at, met] of meetings) {
      if (met.length < 3) continue;
      const top = met.map((k) => k.midi).sort((a, b) => b - a);
      top.forEach((p, h) => horns[h]!.push(short(at, met, fold(p, [50, 72]), true)));
      if (met.length < SECTIONS.length) continue;
      const low = top.at(-1)!;
      ["tp1", "tp2", "tp3"].forEach((id, n) =>
        put(id, short(at, met, fold(top[n]!, [58, 81]), true)),
      );
      put("tb1", short(at, met, fold(top[1]!, [48, 67]), true));
      put("tb2", short(at, met, fold(top[2]!, [45, 65]), true));
      put("btb", short(at, met, fold(low, [36, 58]), true));
      put("tba", short(at, met, fold(low, [30, 50]), true));
      put("timp", short(at, met, fold(low, [40, 55]), true));
    }
    horns.forEach((events, h) => {
      if (events.length) add(`hn${h + 1}`, events, curve(1));
    });
    for (const [id, events] of Object.entries(all)) add(id, events, curve(1));
  }

  if (v.keys) {
    for (const d of DOUBLES) {
      const events = lineOf(d.line)
        .strokes.filter((k) => gridOf(k.midi) === d.grid)
        .map((k): NoteEvent => ({ at: time(k.at), dur: time(k.dur), pitch: { midi: k.midi } }));
      if (events.length) add(d.id, events, curve(2));
    }
  }

  if (v.tutti) {
    // The notes the sections meet on, bottom up, with the basses' below.
    const chord = [fold(lines[0]!.last, BASS_WINDOW), ...lines.map((l) => l.last)];
    TUTTI.forEach((t, n) => {
      const p = player(t.id);
      const fixed = ["harp", "piano", "celesta", "marimba"].includes(p.instrument);
      const own = (m: number) => !fixed || gridOf(m) === (p.tuning ? 1 : 0);
      const can = chord.filter(own);
      if (!can.length) return;
      const pitches = t.chord
        ? [...new Set(can.map((m) => fold(m, t.window)))].sort((a, b) => a - b)
        : [fold(can[n % can.length]!, t.window)];
      const pitch: Pitch | Pitch[] =
        pitches.length === 1 ? { midi: pitches[0]! } : pitches.map((midi) => ({ midi }));
      add(
        t.id,
        [{ at: time(end), dur: 0.5, pitch, articulations: ["accent"], dynamic: meeting }],
        curve(1),
      );
    });
    add("tam", [{ at: time(end), dur: 4, dynamic: meeting }], [{ at: 0, level: meeting }]);
  }

  // A letter where anything on the bands changes.
  const changes = [
    ...new Set([...v.sets, ...v.stand, ...v.gears].map(([bar]) => Math.round(bar))),
  ].sort((a, b) => a - b);
  const rehearsal = changes.map((bar, i) => ({
    measure: bar + 1,
    label: String.fromCharCode(65 + i),
  }));

  // Score order: antara's orchestra.
  const rank = (id: string) => ensemble.findIndex((p) => p.id === id);
  parts.sort((a, b) => rank(a.id) - rank(b.id));
  for (const p of parts)
    p.events.sort(
      (a, b) =>
        (typeof a.at === "number" ? a.at : a.at[0] / a.at[1]) -
        (typeof b.at === "number" ? b.at : b.at[0] / b.at[1]),
    );
  return {
    title: "antara · running, the orchestra",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: BARS + 1,
    rehearsal,
    // Every player on a staff of their own (docs/decisions/0025).
    pairs: false,
    parts,
  };
}

/**
 * Where a section made of this sketch may stop or start (src/sketch/join.ts): the strings where a
 * group begins (an accented stroke), or a division enters after a rest; everything else at any
 * of its notes.
 */
export function seams(score: Score): Record<string, Seam[]> {
  const q = (t: NoteEvent["at"]) => (typeof t === "number" ? t : t[0] / t[1]);
  const lines = new Set(
    SECTIONS.flatMap((s) => [
      s.id,
      ...Array.from({ length: 4 }, (_, i) => `${s.id.slice(0, -1)}-4-${i + 1}`),
    ]),
  );
  const out: Record<string, Seam[]> = {};
  for (const p of score.parts) {
    const notes = p.events.filter((e): e is NoteEvent => e.type !== "text");
    out[p.id] = notes
      .filter(
        (n, i) =>
          !lines.has(p.id) ||
          n.articulations?.includes("accent") ||
          (p.id.includes("-4-") &&
            (i === 0 || q(notes[i - 1]!.at) + q(notes[i - 1]!.dur) < q(n.at) - 1e-9)),
      )
      .map((n) => q(n.at));
  }
  return out;
}

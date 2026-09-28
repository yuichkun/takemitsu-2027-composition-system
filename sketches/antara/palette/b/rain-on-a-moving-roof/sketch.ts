// antara palette, B: rain on a moving roof.
//
// Uses the lines sketch "they stop at the ceiling" (../../../ideas/lines/b-ceiling), whose logic is
// copied here: voices climb from their own low notes by betweens drawn from one rising set, each in
// its own rhythm and family; a step that would pass the ceiling is cut there, so the last between of
// a climb is decided by the ceiling and not by the set; a voice that has arrived draws only 0 and
// repeats the ceiling in its own rhythm. And the mirrors of the idea "a chord of glass between two
// grids" (../../../ideas/two-grids): an instrument that holds only one of the two quarter-tone grids
// sounds a pitch of that grid once.
//
// Added here: the ceiling moves. It is a roof put there from outside the voices' lines (no voice's
// set or rule decides it), walking slowly by betweens of its own at bar lines, held by two muted
// trumpets in turn. Eight divided string parts
// climb to it. When it steps down, every voice at or above it takes the new roof at its next onset;
// when it steps up, the voices at the roof are released and climb again from the old roof until the
// new one cuts them; when it is removed, the voices climb on until a step would pass their
// section's top (the highest note the playback has samples for), and hold their last note to
// nothing. The sketch ends one bar after the bar in which the last voice stops.
//
// Each note's colour is the name its between gives it: a note reached by a between that is not 0
// (climbing, a cut step included) is arco; a note reached by 0 (repeating the roof, the first note
// after a roof move included, since the voice drew 0 and the roof moved) is pizzicato: the rain. An
// arrival by climbing also sends one strike to a mirror of the roof's grid, the mirrors of a grid
// taking turns: harp I, celesta and glockenspiel on the usual grid; harp II and piano, tuned a
// quarter tone low, on the other. A roof move never strikes. Everything stays soft.
// Card: README.md.

import type { NoteEvent, Part, TextEvent } from "../../../../../src/score/types.ts";
import { betweenSet, number, pitch, text, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, type Family } from "../../../between.ts";
import { curve, fold, gridOf, note, part, scoreOf, stream, TICKS, time } from "../../common.ts";

export const knobs = {
  roof: pitch({
    group: "Roof",
    label: "First roof",
    help: "The roof in force from the start: where the first climbs are cut and the first rain falls. It is put there from outside the voices' lines",
    value: "G+5",
    min: "C5",
    max: "Bb5",
    step: 0.5,
  }),
  roofSteps: text({
    group: "Roof",
    label: "Roof betweens",
    help: "The roof's own line: the betweens it moves by, in order (semitones, .5 for a quarter tone; minus is down). A between with .5 moves the roof, the rain and the mirrors that can answer to the other grid",
    value: "-2.5 -1.5 6.5 -3 -4.5 -2",
  }),
  roofBars: text({
    group: "Roof",
    label: "Roof moves at bars",
    help: "The bar each roof between is taken at, in order, and one more: the bar the roof is removed at",
    value: "10 13 16 22 25 28 31",
  }),
  set: betweenSet({
    group: "Climb",
    label: "Rising set",
    help: "The betweens the voices climb by (semitones, .5 for a quarter tone), drawn by shift each time, each voice starting at its own place",
    value: "1 1.5 2.5 3",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  rhythm: betweenSet({
    group: "Climb",
    label: "Rhythm",
    help: "The time betweens, in atoms of each voice's family, drawn by combinations two at a time, each voice starting at its own place. The rain keeps the same rhythm",
    value: "2 3 4 5",
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  entries: number({
    group: "Form",
    label: "Entries",
    help: "Beats between entries, from the lowest voice up",
    value: 2,
    min: 0,
    max: 8,
    step: 1,
    unit: "beats",
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 76,
    min: 40,
    max: 140,
    step: 2,
    unit: "bpm",
  }),
};

type V = Values<typeof knobs>;
const BAR = 4 * TICKS;

interface Voice {
  id: string;
  instrument: string;
  name: string;
  abbreviation: string;
  players: number;
  /**
   * The highest note of the section that the playback (BBC SO) has samples for: after the roof is
   * removed, a voice stops rather than step past it.
   */
  top: number;
  family: Family;
}

// Bottom up: each section in two halves. The lowest starts at LOWEST, each one above STACK higher
// (a between with .5, so neighbours start on opposite grids); the families go 3, 2, 5 again and
// again, so no two neighbours share one.
const LOWEST = 40;
const STACK = 4.5;
const half = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  players: number,
  top: number,
  family: Family,
): Voice => ({ id, instrument, name, abbreviation, players, top, family });
const VOICES: Voice[] = [
  half("vc-2", "cellos", "Violoncellos 2", "Vc. 2", 5, 82, 3),
  half("vc-1", "cellos", "Violoncellos 1", "Vc. 1", 5, 82, 2),
  half("va-2", "violas", "Violas 2", "Va. 2", 6, 90, 5),
  half("va-1", "violas", "Violas 1", "Va. 1", 6, 90, 3),
  half("vn2-2", "violins-2", "Violins II 2", "Vn. II 2", 7, 97, 2),
  half("vn2-1", "violins-2", "Violins II 1", "Vn. II 1", 7, 97, 5),
  half("vn1-2", "violins-1", "Violins I 2", "Vn. I 2", 8, 97, 3),
  half("vn1-1", "violins-1", "Violins I 1", "Vn. I 1", 8, 97, 2),
];

interface Mirror {
  id: string;
  instrument: string;
  name: string;
  abbreviation: string;
  /** Where its strikes go: the roof, moved by octaves nearest the middle of this range. */
  range: [number, number];
}

// The instruments that hold each grid: [0] the usual semitones, [1] a quarter tone off.
const MIRRORS: Mirror[][] = [
  [
    { id: "hp1", instrument: "harp", name: "Harp I", abbreviation: "Hp. I", range: [67, 91] },
    { id: "cel", instrument: "celesta", name: "Celesta", abbreviation: "Cel.", range: [72, 100] },
    {
      id: "glk",
      instrument: "glockenspiel",
      name: "Glockenspiel",
      abbreviation: "Glk.",
      range: [79, 103],
    },
  ],
  [
    {
      id: "hp2",
      instrument: "harp",
      name: "Harp II (tuned ¼ tone low)",
      abbreviation: "Hp. II",
      range: [67, 91],
    },
    {
      id: "pno",
      instrument: "piano",
      name: "Piano (tuned ¼ tone low)",
      abbreviation: "Pno.",
      range: [72, 100],
    },
  ],
];
// Score order: percussion, harps, keyboards.
const MIRROR_ORDER = ["glk", "hp1", "hp2", "cel", "pno"];

/** The octave of a pitch nearest the middle of a range, inside the range. */
const placeFor = (p: number, [lo, hi]: [number, number]) =>
  fold(p + 12 * Math.round((lo + hi) / 2 / 12 - p / 12), [lo, hi]);

/** A stretch of time with one roof in force (null: the roof is removed). */
interface Segment {
  from: number;
  roof: number | null;
}

function roofLine(v: V): Segment[] {
  const steps = v.roofSteps
    .replaceAll("−", "-")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  const bars = v.roofBars
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (steps.some((s) => !Number.isFinite(s) || !Number.isInteger(s * 2)))
    throw new Error("Roof betweens: semitones on the quarter-tone grid, e.g. -2.5 -1.5 6.5");
  if (bars.length !== steps.length + 1)
    throw new Error(
      `Roof moves at bars: one bar for each of the ${steps.length} roof betweens, and one more for the removal (${steps.length + 1} bars)`,
    );
  if (bars.some((b, i) => !Number.isInteger(b) || b < 2 || (i > 0 && b <= bars[i - 1]!)))
    throw new Error("Roof moves at bars: whole bar numbers from 2 up, each later than the last");
  const out: Segment[] = [{ from: 0, roof: v.roof }];
  let roof = v.roof;
  steps.forEach((s, i) => {
    roof += s;
    if (roof > VOICES[0]!.top)
      throw new Error(
        `Roof betweens: the roof reaches ${roof}, above the cellos' highest note (${VOICES[0]!.top})`,
      );
    out.push({ from: (bars[i]! - 1) * BAR, roof });
  });
  out.push({ from: (bars.at(-1)! - 1) * BAR, roof: null });
  return out;
}

/** How a note was reached: its between is not 0 (start, climb) or 0 (repeat, moved with the roof). */
type How = "start" | "climb" | "repeat" | "moved";
interface Tone {
  at: number;
  midi: number;
  how: How;
  /** Reached the roof by climbing. */
  arrive: boolean;
  /** Its step was cut by the roof. */
  cut: boolean;
}
const plucked = (h: How) => h === "repeat" || h === "moved";

function climb(v: V, k: number, segments: Segment[]): { tones: Tone[]; stop: number } {
  const voice = VOICES[k]!;
  const atom = atomOf(voice.family);
  const step = stream(v.set, "shift each time", 1);
  const rhythm = stream(v.rhythm, "combinations", 2);
  // Each voice starts at its own place in the rules.
  for (let i = 0; i < k; i++) {
    step();
    rhythm();
  }
  const roofAt = (t: number) => segments.findLast((s) => s.from <= t)!.roof;
  const removed = segments.at(-1)!.from;
  let t = k * v.entries * TICKS;
  const first = roofAt(t);
  let midi = first === null ? LOWEST + STACK * k : Math.min(LOWEST + STACK * k, first);
  let atRoof = midi === first;
  const tones: Tone[] = [{ at: t, midi, how: "start", arrive: false, cut: false }];
  const push = (how: How, arrive = false, cut = false) =>
    tones.push({ at: t, midi, how, arrive, cut });
  for (;;) {
    t += rhythm() * atom;
    if (t > removed + 64 * BAR) throw new Error("Rising set: the voices never leave their range");
    const roof = roofAt(t);
    if (roof === null) {
      // No roof: climb on, until a step would leave the section's range.
      const s = step();
      if (midi + s > voice.top) return { tones, stop: t };
      midi += s;
      atRoof = false;
      push("climb");
      continue;
    }
    // The roof went up: released, the voice climbs again from the old roof.
    if (atRoof && roof > midi) atRoof = false;
    if (atRoof || midi >= roof) {
      // At the roof (or the roof came down onto the voice): it draws 0; the roof carries it.
      const how = midi === roof ? "repeat" : "moved";
      midi = roof;
      atRoof = true;
      push(how);
      continue;
    }
    const s = step();
    const cut = midi + s > roof;
    midi = Math.min(roof, midi + s);
    atRoof = midi === roof;
    push("climb", atRoof, cut);
  }
}

export function score(v: V) {
  const segments = roofLine(v);
  const removed = segments.at(-1)!.from;
  const lines = VOICES.map((_, k) => climb(v, k, segments));
  const end = (Math.floor(Math.max(...lines.map((l) => l.stop)) / BAR) + 2) * BAR;

  // The strings: arco where the between into a note is not 0, pizzicato where it is 0.
  const strings: Part[] = lines.map(({ tones }, k) => {
    const events = tones.map((x, i) =>
      note(
        x.at,
        (tones[i + 1]?.at ?? end) - x.at,
        x.midi,
        plucked(x.how) ? { technique: "pizz" } : {},
      ),
    );
    // Arco p rising to mp towards each arrival; pizzicato p; from the removal, to nothing.
    const points: { at: number; level: number; ramp?: boolean }[] = [];
    tones.forEach((x, i) => {
      if (x.at >= removed) return;
      const prev = tones[i - 1];
      if (!plucked(x.how) && (!prev || plucked(prev.how)))
        points.push({ at: x.at, level: 3, ramp: true });
      if (x.arrive) points.push({ at: x.at, level: 4 });
      if (plucked(x.how) && prev && !plucked(prev.how)) points.push({ at: x.at, level: 3 });
    });
    points.push({ at: removed, level: 3, ramp: true }, { at: end, level: 0 });
    const p = VOICES[k]!;
    return part({ ...p, range: [0, 0], grids: [0, 1] }, events, curve(points));
  });

  // The mirrors: one strike at each arrival by climbing, on the roof's grid, taking turns.
  const arrivals = lines
    .flatMap(({ tones }) => tones.filter((x) => x.arrive))
    .sort((a, b) => a.at - b.at);
  const turn = [0, 0];
  const strikes = new Map<string, Map<number, number[]>>();
  for (const x of arrivals) {
    const grid = gridOf(x.midi);
    const m = MIRRORS[grid]![turn[grid]!++ % MIRRORS[grid]!.length]!;
    const byTime = strikes.get(m.id) ?? new Map<number, number[]>();
    strikes.set(m.id, byTime);
    const q = placeFor(x.midi, m.range);
    byTime.set(x.at, [...new Set([...(byTime.get(x.at) ?? []), q])]);
  }
  const mirrors: Part[] = MIRROR_ORDER.map((id) => {
    const m = MIRRORS.flat().find((x) => x.id === id)!;
    const times = [...(strikes.get(id) ?? new Map<number, number[]>())].sort((a, b) => a[0] - b[0]);
    const events: (NoteEvent | TextEvent)[] = times.map(([at, pitches], i) =>
      note(at, Math.min(2 * TICKS, (times[i + 1]?.[0] ?? end) - at, end - at), pitches),
    );
    if (times.length > 0)
      events.unshift({ type: "text", at: time(times[0]![0]), text: "l.v. sempre" });
    return {
      id: m.id,
      instrument: m.instrument,
      name: m.name,
      abbreviation: m.abbreviation,
      dynamics: [{ at: 0, level: 4 }],
      events,
    };
  });

  // The roof: two muted trumpets take its pitches in turn, each held to the next move.
  const held = segments.flatMap((s, i) =>
    s.roof === null ? [] : [{ at: s.from, stop: segments[i + 1]!.from, midi: s.roof }],
  );
  const trumpets: Part[] = [0, 1].map((n) => ({
    id: `tpt${n + 1}`,
    instrument: "trumpet",
    name: `Trumpet ${n + 1}`,
    abbreviation: `Tpt. ${n + 1}`,
    dynamics: [{ at: 0, level: 2 }],
    events: held
      .filter((_, i) => i % 2 === n)
      .map((h) => note(h.at, h.stop - h.at, h.midi, { technique: "muted" })),
  }));

  const out = scoreOf("antara · palette B · rain on a moving roof", end / BAR, v.tempo, [
    ...trumpets,
    ...mirrors,
    ...strings.reverse(),
  ]);
  out.rehearsal = segments.slice(1).map((s, i) => {
    const b = s.roof === null ? null : s.roof - segments[i]!.roof!;
    return {
      measure: s.from / BAR + 1,
      label: b === null ? "roof off" : `roof ${b > 0 ? "+" : "−"}${Math.abs(b)}`,
    };
  });
  return out;
}

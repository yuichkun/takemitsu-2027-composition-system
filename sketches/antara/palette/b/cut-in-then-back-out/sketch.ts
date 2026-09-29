// antara palette, B: cut in from both ends, then cut back out from the middle.
//
// Uses the A sketch "a chord cut from both ends" (../../a/pitch-cut-from-both-ends): the chord is
// not betweens stacked on a standpoint but one wide between, the frame (two held voices), cut again
// and again by the betweens a rule draws from the cut set. Its cutting is rewritten here with one
// change: every cut goes into the middle between (the one between the latest voice of each end),
// where the A cuts the widest between. A cut c measured up from the lower end puts a voice c above
// it; a cut measured down from the upper end puts a voice c below it; the two ends take turns. When
// the next c is as wide as the middle between or wider, it is not used and the cutting in stops.
// What is left in the middle is a between no term stands on and the set does not hold, defined by
// the width of the frame and the cuts.
//
// New here, three stretches, each with its own kind of event:
// 1. In: voices only enter, from the two ends toward the middle.
// 2. Out: the two voices on either side of the middle between become the standpoints, and the same
//    cut stream, continued (never reset), cuts back out: down from the lower one, up from the upper
//    one, in turn, each side stopping where the next cut would pass the frame (the other side then
//    takes the following cuts). At each new voice one voice of the first chord leaves, in the order
//    the first chord's voices entered (the frame first), so the voices are traded, not added.
// 3. Empty: the chord's voices leave in the order they entered, from the middle out, until only the
//    last cut of each side is left.
//
// Colour is the direction a voice was measured in: measured upward, strings; measured downward,
// winds. The frame's lower end is the standpoint of the upward cuts (strings), its upper end that
// of the downward cuts (winds). Within a colour the section follows the half of the chord: below the
// middle, basses, cellos and violas, or bassoons and brass; above it, violins, or woodwinds. Going
// in, the lower half fills with strings and the upper half with woodwinds; coming out, the lower
// half is measured down from the middle (bassoons and brass) and the upper half up from it
// (violins), so the colours of the two halves trade. With the default values the cuts going in use
// up the rule's period exactly, so each side coming out takes the same cuts in the same order as it
// took going in, measured from the other end: each half comes back turned upside down about its own
// centre, the last cuts land on the frame's two pitches, and they end in the opposite colours.
//
// Every entry and departure falls on one time stream (one family, a set of time betweens read
// "shift each time"). A voice enters at p and settles to pp over a beat; a leaving voice fades out
// over a beat. The strings are con sord., two players to a divided part; the winds one player each.
// No accents, no glissandi. Each staff name says which cut the voice is (in or out) or "frame".
// Card: README.md.

import type { Part } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, inOrder, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

const RULE_OPTIONS = ["in order", "shift each time"];

// Default values, by structure. The cut set holds four betweens of four different sizes, two with
// .5 and two without (the A's set). "Shift each time" reads it one place later each time round, so
// it comes back to its start after four rounds (16 cuts, sum 44) and neither half of the chord
// repeats one shape; read "in order", the lower end would take 1.5 and 3 again and again and its
// half would be one shape moved up by 4.5 each time. The frame 44.5 is the narrowest width (in
// quarter tones) that takes that whole period in the middle (44 and below stop at 15 cuts or
// fewer), so the 17th cut (1.5) does not fit the 0.5 left, the cuts back out read the period again
// from its start, and each side lands exactly on the frame; with .5 the frame's ends stand on
// different grids. The remainder 0.5 is the width minus the sum, not a quarter tone put there for
// its sound. The bottom 40 is chosen by register only (each frame pitch can be played by strings
// and by winds).
// The time set {5, 6, 8} (family 3): only 6 lies on the beat grid, and a round sums to 19 atoms,
// not a multiple of the beat (3) or the bar (12). The tempo only sets the length.
export const knobs = {
  bottom: pitch({
    group: "Frame",
    label: "Bottom",
    help: "The lower end of the frame. The upward cuts are measured from it, so it sounds in the strings",
    value: "E2",
    min: "C2",
    max: "C4",
    step: 0.5,
  }),
  span: number({
    group: "Frame",
    label: "Span",
    help: "The frame: the one wide between the chord is cut from. Its upper end (bottom plus this) is where the downward cuts are measured from, so it sounds in the winds",
    value: 44.5,
    min: 6,
    max: 50,
    step: 0.5,
    unit: "st",
  }),
  cuts: betweenSet({
    group: "Cuts",
    label: "Cut set",
    help: "The betweens the frame is cut by, going in and coming out (semitones, .5 for a quarter tone)",
    value: "1.5 2.5 3 4",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  rule: choice({
    group: "Cuts",
    label: "Rule",
    help: "in order: the set narrowest first, again and again · shift each time: the same, starting one later each time round. One stream for the whole sketch, never reset",
    value: RULE_OPTIONS[1]!,
    options: RULE_OPTIONS,
  }),
  times: betweenSet({
    group: "Time",
    label: "Time set",
    help: "The time from one entry or departure to the next, in atoms of the family, read shift each time",
    value: "5 6 8",
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time betweens count in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Time",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 66,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

type Direction = "up" | "down";

export interface Voice {
  midi: number;
  /** Measured up from a lower standpoint, or down from an upper one. */
  dir: Direction;
  /** 1: cut in from the ends (the frame too); 2: cut back out from the middle. */
  phase: 1 | 2;
  /** Which cut it is within its phase (0 for the frame). */
  cut: number;
  /** The onset of the time stream where it enters. */
  enter: number;
  /** The onset where it starts to fade out (undefined: it holds to the end). */
  leave?: number;
}

// ---- Players --------------------------------------------------------------------------------

interface Section {
  instrument: string;
  name: string;
  abbreviation: string;
  short: string;
  size: number;
  range: [number, number];
}

const LOW_STRINGS: Section[] = [
  {
    instrument: "basses",
    name: "Contrabasses",
    abbreviation: "Cb.",
    short: "cb",
    size: 8,
    range: [28, 67],
  },
  {
    instrument: "cellos",
    name: "Violoncellos",
    abbreviation: "Vc.",
    short: "vc",
    size: 10,
    range: [36, 84],
  },
  {
    instrument: "violas",
    name: "Violas",
    abbreviation: "Va.",
    short: "va",
    size: 12,
    range: [48, 91],
  },
];
const VIOLINS: Section[] = [
  {
    instrument: "violins-2",
    name: "Violins II",
    abbreviation: "Vn. II",
    short: "vn2",
    size: 14,
    range: [55, 100],
  },
  {
    instrument: "violins-1",
    name: "Violins I",
    abbreviation: "Vn. I",
    short: "vn1",
    size: 16,
    range: [55, 103],
  },
];
/** Players in each divided string part. */
const PER_PART = 2;

const wind = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  range: [number, number],
): Player => ({ id, instrument, name, abbreviation, range, grids: [0, 1] });

// One player to a voice, low to high (the order voices take them in).
const WOODWINDS: Player[] = [
  wind("bcl", "bass-clarinet", "Bass Clarinet", "B. Cl.", [34, 77]),
  wind("cl3", "clarinet", "Clarinet 3", "Cl. 3", [50, 94]),
  wind("ca", "cor-anglais", "Cor anglais", "C. ingl.", [52, 81]),
  wind("cl2", "clarinet", "Clarinet 2", "Cl. 2", [50, 94]),
  wind("cl1", "clarinet", "Clarinet 1", "Cl. 1", [50, 94]),
  wind("ob2", "oboe", "Oboe 2", "Ob. 2", [58, 93]),
  wind("ob1", "oboe", "Oboe 1", "Ob. 1", [58, 93]),
  wind("fl2", "flute", "Flute 2", "Fl. 2", [59, 98]),
  wind("fl1", "flute", "Flute 1", "Fl. 1", [59, 98]),
];
const LOW_WINDS: Player[] = [
  wind("tba", "tuba", "Tuba", "Tba.", [26, 65]),
  wind("btbn", "bass-trombone", "Bass Trombone", "B. Tbn.", [28, 67]),
  wind("tbn2", "trombone", "Trombone 2", "Tbn. 2", [40, 72]),
  wind("tbn1", "trombone", "Trombone 1", "Tbn. 1", [40, 72]),
  wind("hn2", "horn", "Horn 2", "Hn. 2", [34, 77]),
  wind("hn1", "horn", "Horn 1", "Hn. 1", [34, 77]),
  wind("bsn2", "bassoon", "Bassoon 2", "Bsn. 2", [34, 75]),
  wind("bsn1", "bassoon", "Bassoon 1", "Bsn. 1", [34, 75]),
];

/** Score order, top to bottom. */
const ORDER = [
  "flute",
  "oboe",
  "cor-anglais",
  "clarinet",
  "bass-clarinet",
  "bassoon",
  "horn",
  "trombone",
  "bass-trombone",
  "tuba",
  "violins-1",
  "violins-2",
  "violas",
  "cellos",
  "basses",
];

type Group = "low strings" | "violins" | "woodwinds" | "low winds";

/**
 * The colour of a voice: its direction gives strings (up) or winds (down), and the half of the
 * chord it stands in gives the sections. Cutting in, the upward cuts stay below the middle and the
 * downward ones above it; cutting out, the other way round.
 */
const groupOf = (phase: 1 | 2, dir: Direction): Group =>
  dir === "up"
    ? phase === 1
      ? "low strings"
      : "violins"
    : phase === 1
      ? "woodwinds"
      : "low winds";

const fits = (m: number, [lo, hi]: [number, number]) => m >= lo && m <= hi;

/**
 * Divides string sections among voices (pitches low to high), as evenly over the sections as their
 * ranges allow, the way divisi() of common.ts does, but among the given sections only and with
 * PER_PART players to each part. Parts are numbered from the top within a section. Undefined when a
 * section has too few players for its parts.
 */
function spread(pitches: number[], sections: Section[]): Player[] | undefined {
  let floor = 0;
  const chosen = pitches.map((m, k) => {
    const ideal = Math.floor((k * sections.length) / pitches.length);
    const order = sections
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => i >= floor)
      .sort((a, b) => Math.abs(a.i - ideal) - Math.abs(b.i - ideal) || a.i - b.i);
    const hit = order.find(({ s }) => fits(m, s.range)) ?? order[0]!;
    floor = hit.i;
    return hit.s;
  });
  const counts = new Map<Section, number>();
  for (const s of chosen) counts.set(s, (counts.get(s) ?? 0) + 1);
  for (const [s, n] of counts) if (n * PER_PART > s.size) return undefined;
  const seen = new Map<Section, number>();
  return chosen.map((s, k) => {
    const below = seen.get(s) ?? 0;
    seen.set(s, below + 1);
    const j = counts.get(s)! - below;
    return {
      id: `${s.short}-${j}`,
      instrument: s.instrument,
      name: `${s.name} ${j}`,
      abbreviation: `${s.abbreviation} ${j}`,
      players: PER_PART,
      range: [pitches[k]!, pitches[k]!],
      grids: [0, 1],
      technique: "con-sord",
    };
  });
}

/** The players of a group for these voices (pitches low to high), or undefined if too many. */
function playersOf(group: Group, pitches: number[]): Player[] | undefined {
  if (group === "low strings") return spread(pitches, LOW_STRINGS);
  if (group === "violins") return spread(pitches, VIOLINS);
  const pool = group === "woodwinds" ? WOODWINDS : LOW_WINDS;
  if (pitches.length > pool.length) return undefined;
  return inOrder(
    pitches.map((m): [number, number] => [m, m]),
    pool,
  );
}

// ---- Cutting --------------------------------------------------------------------------------

/** A stream of cuts that can take back the cut it just gave (a cut not used is not consumed). */
function cutStream(set: number[], rule: string) {
  const next = stream(set, rule, 1);
  let held: number | undefined;
  return {
    take: (): number => {
      const c = held ?? next();
      held = undefined;
      return c;
    },
    giveBack: (c: number) => {
      held = c;
    },
  };
}

/**
 * The cuts, in and out. In: from the frame [lo, hi], the lower end (up) and the upper end (down)
 * cut the middle between in turn, until the next cut does not fit it. Out: from the two voices on
 * either side of what is left, the lower side (down) and the upper side (up) cut in turn with the
 * same stream, each side stopping where its next cut would pass the frame; when one side stops, the
 * other takes the following cuts. Cutting also stops where a colour has no players left (never
 * with the default values).
 */
export function cutInThenOut(lo: number, hi: number, set: number[], rule: string) {
  const cuts = cutStream(set, rule);
  const inward: Voice[] = [
    { midi: lo, dir: "up", phase: 1, cut: 0, enter: 0 },
    { midi: hi, dir: "down", phase: 1, cut: 0, enter: 0 },
  ];
  const room = (vs: Voice[], phase: 1 | 2, dir: Direction, midi: number) =>
    playersOf(
      groupOf(phase, dir),
      [...vs.filter((x) => x.phase === phase && x.dir === dir).map((x) => x.midi), midi].sort(
        (x, y) => x - y,
      ),
    ) !== undefined;

  let a = lo;
  let b = hi;
  // The latest voice of each end: the two sides of the middle between.
  const middle: [Voice, Voice] = [inward[0]!, inward[1]!];
  for (let k = 1; ; k++) {
    const c = cuts.take();
    const dir: Direction = k % 2 === 1 ? "up" : "down";
    const midi = dir === "up" ? a + c : b - c;
    if (c >= b - a || !room(inward, 1, dir, midi)) {
      cuts.giveBack(c);
      break;
    }
    const x: Voice = { midi, dir, phase: 1, cut: k, enter: 0 };
    inward.push(x);
    if (dir === "up") {
      a = midi;
      middle[0] = x;
    } else {
      b = midi;
      middle[1] = x;
    }
  }

  const outward: Voice[] = [];
  const open: Record<Direction, boolean> = { down: true, up: true };
  let turn: Direction = "down";
  let k = 1;
  while (open.down || open.up) {
    const dir: Direction = open[turn] ? turn : turn === "down" ? "up" : "down";
    const c = cuts.take();
    const midi = dir === "down" ? a - c : b + c;
    const passes = dir === "down" ? midi < lo : midi > hi;
    if (passes || !room(outward, 2, dir, midi)) {
      cuts.giveBack(c);
      open[dir] = false;
      continue;
    }
    outward.push({ midi, dir, phase: 2, cut: k++, enter: 0 });
    if (dir === "down") a = midi;
    else b = midi;
    turn = dir === "down" ? "up" : "down";
  }
  return { inward, middle, outward };
}

// ---- Score ----------------------------------------------------------------------------------

export function score(v: Values<typeof knobs>) {
  const atom = atomOf(familyOf(v.family));
  const lo = v.bottom;
  const hi = v.bottom + v.span;
  const { inward, middle, outward } = cutInThenOut(lo, hi, v.cuts, v.rule);

  // One time stream. Onset 0 is the frame; every entry and every departure takes the next onset.
  const draw = stream(v.times, "shift each time", 1);
  const at: number[] = [0];
  const tick = () => {
    at.push(at.at(-1)! + draw() * atom);
    return at.length - 1;
  };

  // In: one cut per onset.
  for (const x of inward) if (x.cut > 0) x.enter = tick();
  // The full chord holds for two time betweens.
  tick();
  // Out: at each onset a new voice enters from the middle, and the next voice of the first chord
  // (in the order they entered, the frame first) leaves. The two middle voices are the last to have
  // entered, and they are the standpoints of the cuts out: with the default values they stay.
  // Only the frame's two voices share an onset; the lower is counted first.
  const byEntry = (vs: Voice[]) => [...vs].sort((p, q) => p.enter - q.enter || p.midi - q.midi);
  const departing = byEntry(inward).filter((x) => !middle.includes(x));
  outward.forEach((x, j) => {
    x.enter = tick();
    const old = departing[j];
    if (old) old.leave = x.enter;
  });
  // The second chord holds for two time betweens.
  tick();
  // Empty: the chord's voices leave in the order they entered, one per onset, until only its
  // lowest and highest are left (the last cut of each side, with the default values the frame's
  // pitches).
  const chord = [...inward, ...outward].filter((x) => x.leave === undefined);
  const lowest = chord.reduce((p, q) => (q.midi < p.midi ? q : p));
  const highest = chord.reduce((p, q) => (q.midi > p.midi ? q : p));
  for (const x of byEntry(chord)) if (x !== lowest && x !== highest) x.leave = tick();
  // The last two hold for two time betweens, then fade out over one more.
  tick();
  const fade = at[tick()]!;
  const end = at[tick()]!;

  // Players: each voice gets its own part, by the colour of its direction and half.
  const all = [...inward, ...outward];
  const players = new Map<Voice, Player>();
  for (const [phase, dir] of [
    [1, "up"],
    [1, "down"],
    [2, "down"],
    [2, "up"],
  ] as const) {
    const vs = all
      .filter((x) => x.phase === phase && x.dir === dir)
      .sort((p, q) => p.midi - q.midi);
    if (vs.length === 0) continue;
    const ps = playersOf(
      groupOf(phase, dir),
      vs.map((x) => x.midi),
    )!;
    vs.forEach((x, i) => players.set(x, ps[i]!));
  }

  const parts = all.map((x) => {
    const p = players.get(x)!;
    const start = at[x.enter]!;
    const leave = x.leave === undefined ? undefined : at[x.leave]!;
    const stop = leave === undefined ? end : leave + TICKS;
    const points = [
      { at: start, level: 3, ramp: true },
      { at: Math.min(start + TICKS, leave ?? end), level: 2 },
    ];
    if (leave === undefined) points.push({ at: fade, level: 2, ramp: true }, { at: end, level: 0 });
    else points.push({ at: leave, level: 2, ramp: true }, { at: stop, level: 0 });
    const label = x.cut === 0 ? "frame" : `${x.phase === 1 ? "in" : "out"} ${x.cut}`;
    const extra = p.technique ? { technique: p.technique } : {};
    return {
      midi: x.midi,
      part: part(
        { ...p, name: `${p.name} (${label})` },
        [note(start, stop - start, x.midi, extra)],
        curve(points),
      ) as Part,
    };
  });
  // Score order: winds, then strings; each instrument's parts from the top.
  const rank = (q: Part) => ORDER.indexOf(q.instrument);
  parts.sort((p, q) => rank(p.part) - rank(q.part) || q.midi - p.midi);

  return scoreOf(
    "antara · palette B · cut in from both ends, then back out from the middle",
    Math.ceil(end / (4 * TICKS)),
    v.tempo,
    parts.map((p) => p.part),
  );
}

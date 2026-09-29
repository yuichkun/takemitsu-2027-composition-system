// antara palette, B: rings from a drop.
//
// Uses the A sketch "the centre nobody can play" (../../a/pitch-unplayed-centre), whose logic is
// copied here: halfway between the two semitone grids that make the quarter-tone grid is a point no
// instrument can sound. It is the centre. A pair of voices on a span s sounds the centre minus s/2
// and the centre plus s/2; the centre being off the grid, every span has .5, so every pair has one
// voice on each grid. A pair moves both voices at once, in contrary motion by the same amount; the
// centre never moves and never sounds.
//
// Here a pair is a ring, and the A's rule ("to a free span") is kept but turned one way: outward.
// A ring is born on the narrowest span there is around the centre, 0.5 (a quarter tone, one voice
// a quarter of a semitone below the centre, one above), and steps out. At each step both voices
// move by a between taken from a set of steps; a ring takes every step of the set once, so all
// rings end on the same widest span, and after one period there it leaves (both voices stop).
// The steps are laid out largest first and taken by the rule "shift each time": ring n takes them
// from the n-th on, so every ring of the first seven walks a ladder of spans no other ring does.
// Largest first, a ring's first step is smaller than that of the ring born before it (except
// where the order wraps round), so a ring just born has room at once; smallest first, every new
// ring's first step would reach past the one before's and it would hold the quarter-tone pair
// until that ring had stepped twice.
// A ring steps only if its next span is still narrower than the ring ahead of it (the next wider
// ring in the air): rings never touch or cross. Otherwise it waits one period and tries again.
// Rings due at the same tick move outermost first (the A's order), so a ring may follow into the
// room its neighbour has just made.
//
// Drops (births) come at times added from the start: betweens counted in beats, where every
// family's grid meets, taken from a set by the same rule, "shift each time" (3 3 12: bursts of
// drops 3 beats apart, 12 beats between bursts; ten drops are one whole turn of the rule, bursts
// of 3, 2, 2 and 3). A drop is born only when the narrowest span is free; otherwise it is born at
// the first tick of its own family's grid on which it is free. Ring n counts in family 2, 3, 5 in
// turn, and is due to move every 11 atoms of its family (2 3/4, 3 2/3 or 2 1/5 beats): the rings
// differ in speed by their family, and a fast ring catches up with a slow one and waits behind it.
// The period has no factor 2, 3 or 5, so a ring comes back onto a beat only every 4th, 3rd or 5th
// step (every 11 beats), and the three families meet only there, across the 4-beat bar. Of such
// periods, 11 is the smallest for which the 3-beat gap lies between the family periods (2 1/5 and
// 2 3/4 below it, 3 2/3 above), so a drop 3 beats after a family-3 ring waits.
//
// Loudness is the ring's distance from the centre: p on the narrowest span, ppp on the widest,
// reached over the period after each step (a waiting ring holds its level). At a birth the harps
// sound the birth pair, each only the tone on its own grid: harp I (usual grid) and harp II (tuned
// a quarter tone low). "In turn": one harp a birth, harp I first; "together": both at every birth.
// A ring keeps its players for its life: its upper voice takes the lowest-numbered free part of
// Violins I 1-4, Violins II 1-4; its lower voice the lowest-numbered free part of Violas 1-4,
// Cellos 1-4. Strings arco, non vib.
// Card: README.md.

import type { NoteEvent, Part, TextEvent } from "../../../../../src/score/types.ts";
import {
  betweenSet,
  choice,
  number,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, familiesOf, type Family } from "../../../between.ts";
import {
  curve,
  gridOf,
  note,
  part,
  scoreOf,
  stream,
  TICKS,
  time,
  type Player,
} from "../../common.ts";

const HARP_MODES = ["in turn", "together"];

export const knobs = {
  steps: betweenSet({
    group: "Rings",
    label: "Steps",
    help: "How far each voice of a ring moves when the ring steps out (semitones; the span grows by twice this). A ring takes every step once, from the narrowest span 0.5 to the widest. The steps are laid out largest first; ring n starts at the n-th (shift each time)",
    value: "1 1.5 2 2.5 3 3.5 4",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  centre: pitch({
    group: "Rings",
    label: "Centre",
    help: "The centre is a quarter of a semitone above this pitch, halfway between the two grids: no instrument can sound it, and nothing ever does",
    value: "F#4",
    min: "C4",
    max: "C5",
    step: 0.5,
  }),
  period: number({
    group: "Rings",
    label: "Period",
    help: "A ring is due to step out every this many atoms of its family; when its next span would reach the ring ahead, it waits one period. With no factor 2, 3 or 5, a ring comes back onto a beat only every 4th, 3rd or 5th step (every Period beats)",
    value: 11,
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  families: text({
    group: "Rings",
    label: "Families",
    help: "The families the rings count in, ring by ring, in turn (2: 16ths, 3: triplet 8ths, 5: quintuplet 16ths). The rings differ in speed only by this",
    value: "2 3 5",
  }),
  drops: betweenSet({
    group: "Drops",
    label: "Drops",
    help: "The times from one drop to the next, in beats (where every family's grid meets), taken in turn, starting one later each time round. The first drop is at the start. A drop that finds the narrowest span taken is born when it frees",
    value: "3 3 12",
    min: 1,
    max: 48,
    step: 1,
    unit: "beats",
  }),
  count: number({
    group: "Drops",
    label: "Count",
    help: "How many drops (rings)",
    value: 10,
    min: 1,
    max: 30,
    step: 1,
  }),
  harps: choice({
    group: "Colour",
    label: "Harps",
    help: "At a birth, each harp sounds only the birth pair's tone on its own grid. In turn: one harp a birth, harp I first, so the pair's two tones are never struck together. Together: both harps at every birth",
    value: HARP_MODES[0]!,
    options: HARP_MODES,
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

/** One stretch of a ring on one span. */
interface Stay {
  at: number;
  rung: number;
}

interface Ring {
  family: Family;
  period: number;
  born: number;
  /** The ring's own ladder: its spans, narrow to wide. */
  spans: number[];
  stays: Stay[];
  due: number;
  left?: number;
  upper?: number;
  lower?: number;
}

/** The narrowest span around a centre between the grids: a quarter tone. */
const NARROW = 0.5;
const HIGH = { lo: 55, hi: 100 };
const LOW = { lo: 48, hi: 84 };

const strings = (
  instrument: string,
  name: string,
  abbreviation: string,
  id: string,
  sizes: number[],
): Player[] =>
  sizes.map((players, j) => ({
    id: `${id}-${j + 1}`,
    instrument,
    name: `${name} ${j + 1}`,
    abbreviation: `${abbreviation} ${j + 1}`,
    players,
    range: [0, 0],
    grids: [0, 1],
  }));

// The two pools, in the order parts are taken (lowest-numbered free first).
const UPPER: Player[] = [
  ...strings("violins-1", "Violins I", "Vn. I", "vn1", [4, 4, 4, 4]),
  ...strings("violins-2", "Violins II", "Vn. II", "vn2", [4, 4, 3, 3]),
];
const LOWER: Player[] = [
  ...strings("violas", "Violas", "Va.", "va", [3, 3, 3, 3]),
  ...strings("cellos", "Violoncellos", "Vc.", "vc", [3, 3, 2, 2]),
];
const HARPS: Player[] = [
  {
    id: "hp1",
    instrument: "harp",
    name: "Harp I",
    abbreviation: "Hp. I",
    range: [0, 0],
    grids: [0],
  },
  {
    id: "hp2",
    instrument: "harp",
    name: "Harp II (tuned ¼ tone low)",
    abbreviation: "Hp. II",
    range: [0, 0],
    grids: [1],
  },
];

export function score(v: Values<typeof knobs>) {
  if (v.steps.some((s) => s <= 0 || !Number.isInteger(s * 2)))
    throw new Error("Steps: a step is a positive number of quarter tones (0.5, 1, 1.5 …)");
  const centre = v.centre + 0.25;
  const widest = NARROW + 2 * v.steps.reduce((a, b) => a + b, 0);
  if (centre + widest / 2 > HIGH.hi)
    throw new Error(
      `Steps: an upper voice at ${centre + widest / 2} is above the violins (${HIGH.hi}); lower the Centre or take fewer or smaller steps`,
    );
  if (centre - widest / 2 < LOW.lo)
    throw new Error(
      `Steps: a lower voice at ${centre - widest / 2} is below the violas (${LOW.lo}); raise the Centre or take fewer or smaller steps`,
    );
  if (centre - NARROW / 2 > LOW.hi || centre + NARROW / 2 < HIGH.lo)
    throw new Error("Centre: the birth pair is outside the violins or the violas and cellos");
  const families = familiesOf("Families", v.families);
  // Each ring's steps: the set largest first, from the ring's own start on (shift each time).
  const ladder = drawer([...v.steps].reverse(), "shift each time", 0, "ascending");
  // The drops: the gaps as written in the set (smallest first), shift each time.
  const gap = stream(v.drops, "shift each time", 1);
  const drops = [0];
  while (drops.length < v.count) drops.push(drops.at(-1)! + gap() * TICKS);

  // The rings, tick by tick.
  const rings: Ring[] = [];
  const flying = () => rings.filter((r) => r.left === undefined);
  const rungOf = (r: Ring) => r.stays.at(-1)!.rung;
  const spanOf = (r: Ring) => r.spans[rungOf(r)]!;
  // Room for a ring to widen to `span`: no other ring in the air stands between.
  const room = (r: Ring, span: number) =>
    !flying().some((q) => q !== r && spanOf(q) > spanOf(r) && spanOf(q) <= span);
  const limit = drops.at(-1)! + 200 * TICKS * (v.steps.length + 1);
  for (let t = 0; rings.length < drops.length || flying().length > 0; t++) {
    if (t > limit) throw new Error("Drops: the rings never clear");
    // Rings due now, outermost first: step out if there is room, else wait one period.
    const due = flying()
      .filter((r) => r.due === t)
      .sort((a, b) => spanOf(b) - spanOf(a));
    for (const r of due) {
      const k = rungOf(r);
      if (k === r.spans.length - 1) {
        r.left = t;
        continue;
      }
      if (room(r, r.spans[k + 1]!)) r.stays.push({ at: t, rung: k + 1 });
      r.due = t + r.period;
    }
    // The next drop: born when due, on its family's grid, with the narrowest span free.
    const n = rings.length;
    if (n < drops.length && drops[n]! <= t) {
      const family = families[n % families.length]!;
      if (t % atomOf(family) === 0 && !flying().some((q) => spanOf(q) === NARROW)) {
        const period = v.period * atomOf(family);
        const spans = [NARROW];
        for (const s of ladder()) spans.push(spans.at(-1)! + 2 * s);
        rings.push({
          family,
          period,
          born: t,
          spans,
          stays: [{ at: t, rung: 0 }],
          due: t + period,
        });
      }
    }
  }
  const bar = 4 * TICKS;
  const last = Math.max(...rings.map((r) => r.left!));
  const end = Math.ceil((last + bar) / bar) * bar;

  // Players: each ring keeps the lowest-numbered parts free at its birth.
  for (const r of rings) {
    const busy = (side: "upper" | "lower", j: number) =>
      rings.some((q) => q !== r && q[side] === j && q.born <= r.born && q.left! >= r.born);
    r.upper = UPPER.findIndex((_, j) => !busy("upper", j));
    r.lower = LOWER.findIndex((_, j) => !busy("lower", j));
    if (r.upper < 0 || r.lower < 0)
      throw new Error("Drops: more rings at once than parts (8 on each side)");
  }

  // Loudness is the distance from the centre: p on the narrowest span, ppp on the widest.
  const level = (span: number) => 3 - (2 * (span - NARROW)) / (widest - NARROW);
  const voice = (p: Player, side: "upper" | "lower", sign: -1 | 1, j: number): Part | undefined => {
    const own = rings.filter((r) => r[side] === j);
    if (own.length === 0) return undefined;
    const events: NoteEvent[] = [];
    const points: { at: number; level: number; ramp?: boolean }[] = [{ at: 0, level: 3 }];
    for (const r of own) {
      r.stays.forEach((s, i) => {
        const stop = r.stays[i + 1]?.at ?? r.left!;
        const span = r.spans[s.rung]!;
        events.push(note(s.at, stop - s.at, centre + (sign * span) / 2));
        if (i === 0) points.push({ at: s.at, level: level(span) });
        else
          points.push(
            { at: s.at, level: level(r.spans[s.rung - 1]!), ramp: true },
            { at: s.at + r.period, level: level(span) },
          );
      });
    }
    const out = part(p, events, curve(points));
    const mark: TextEvent = { type: "text", at: time(own[0]!.born), text: "non vib." };
    out.events.unshift(mark);
    return out;
  };
  const upper = UPPER.map((p, j) => voice(p, "upper", 1, j));
  const lower = LOWER.map((p, j) => voice(p, "lower", -1, j));

  // The harps: at a birth, the birth pair's tone on each harp's own grid; in turn, or both.
  const births = rings.map((r) => r.born);
  const together = v.harps === HARP_MODES[1];
  const harps = HARPS.map((h, i) => {
    const tone = [centre - NARROW / 2, centre + NARROW / 2].find((m) => gridOf(m) === h.grids[0])!;
    const mine = births.filter((_, b) => together || b % HARPS.length === i);
    if (mine.length === 0) return undefined;
    const events = mine.map((at, b) =>
      note(at, Math.min(2 * TICKS, (mine[b + 1] ?? end) - at, end - at), tone),
    );
    const out = part(h, events, [{ at: 0, level: 3 }]);
    const mark: TextEvent = { type: "text", at: time(mine[0]!), text: "l.v. sempre" };
    out.events.unshift(mark);
    return out;
  });

  return scoreOf(
    "antara · palette B · rings from a drop",
    end / bar,
    v.tempo,
    [...harps, ...upper, ...lower].filter((x): x is Part => x !== undefined),
  );
}

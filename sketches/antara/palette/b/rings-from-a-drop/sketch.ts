// antara palette, B: rings from a drop.
//
// Uses the A sketch "the centre nobody can play" (../../a/pitch-unplayed-centre), whose logic is
// copied here: halfway between the two semitone grids that make the quarter-tone grid is a point no
// instrument can sound. It is the centre. A pair of voices on a span s sounds the centre minus s/2
// and the centre plus s/2; the centre being off the grid, every span has .5, so every pair has one
// voice on each grid. A pair moves to a free span, both voices at once, in contrary motion by the
// same amount; the centre never moves and never sounds.
//
// Here a pair is a ring, and the A's rule ("to a free span") is kept but turned one way: outward.
// The spans are rungs of a ladder, narrow to wide. A ring is born on the narrowest rung, steps out
// one rung at a time, and after the widest rung it leaves (both voices stop). A ring steps only if
// the next rung out is free; if it is taken, the ring waits one period and tries again. Rings due
// at the same tick move outermost first (the A's order), so a ring may follow into the rung its
// neighbour has just left.
//
// Drops (births) come as a line of time betweens counted in beats, where every family's grid
// meets: 12 three times, 6 four times, 3 three times, so the drops come twice as often at each
// stage. A drop is born only when the narrowest rung is free; otherwise it is born at the first
// tick of its own family's grid on which that rung is free. Ring n counts in family 2, 3, 5 in
// turn, and is due to move every 11 atoms of its family (2 3/4, 3 2/3 or 2 1/5 beats): the rings
// differ in speed only by their family, and a fast ring catches up with a slow one and waits
// behind it. The period is a number of atoms that no family fits a whole number of into a beat
// (not a multiple of 4, 3 or 5), so no ring steps on a steady beat pulse and the three families
// meet every 11 beats, across the 4-beat bar; 11 is the smallest such number at which the drops
// in the last stage find the narrowest rung taken and wait (at 7 they never do).
//
// Loudness is the ring's distance from the centre: p on the narrowest rung, ppp on the widest,
// reached over the period after each step (a waiting ring holds its level). At each birth the two
// harps sound the birth pair, each the one tone on its own grid: harp I (usual grid) and harp II
// (tuned a quarter tone low); with the default centre, harp I has the tone below the centre and
// harp II the tone above. A ring keeps its players for its life: its upper voice takes
// the lowest-numbered free part of Violins I 1-4, Violins II 1-4; its lower voice the
// lowest-numbered free part of Violas 1-4, Cellos 1-4. Strings arco, non vib.
// Card: README.md.

import type { NoteEvent, Part, TextEvent } from "../../../../../src/score/types.ts";
import { betweenSet, number, pitch, text, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familiesOf, setsOf, type Family } from "../../../between.ts";
import { curve, gridOf, note, part, scoreOf, TICKS, time, type Player } from "../../common.ts";

export const knobs = {
  spans: betweenSet({
    group: "Rings",
    label: "Rungs",
    help: "The spans a ring steps through, narrow to wide: the between of its two voices, half below and half above the centre (semitones, each once). Every one has .5: the centre is between the grids. A ring is born on the narrowest and leaves after the widest",
    value: "0.5 2.5 5.5 9.5 14.5 20.5 27.5 35.5",
    min: 0.5,
    max: 48,
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
    help: "A ring is due to step out every this many atoms of its family; when the next rung is taken, it waits one period. A multiple of 4, 3 or 5 puts that family's rings on a steady beat pulse",
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
  drops: text({
    group: "Drops",
    label: "Drops",
    help: "The time from one drop to the next, in beats (where every family's grid meets), in order; the first drop is at the start. The bars only group them. A drop that finds the narrowest rung taken is born when it frees",
    value: "12 12 12 | 6 6 6 6 | 3 3 3",
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

/** One stretch of a ring on one rung. */
interface Stay {
  at: number;
  rung: number;
}

interface Ring {
  family: Family;
  period: number;
  born: number;
  stays: Stay[];
  due: number;
  left?: number;
  upper?: number;
  lower?: number;
}

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
  const spans = [...new Set(v.spans)].sort((a, b) => a - b);
  if (spans.some((s) => Math.abs(s * 2) % 2 !== 1))
    throw new Error("Rungs: a span around a centre between the grids has .5");
  const centre = v.centre + 0.25;
  const half = spans.map((s) => s / 2);
  const top = spans.length - 1;
  for (const h of half) {
    if (centre + h < HIGH.lo || centre + h > HIGH.hi)
      throw new Error(
        `Rungs: an upper voice at ${centre + h} is outside the violins (${HIGH.lo}–${HIGH.hi})`,
      );
    if (centre - h < LOW.lo || centre - h > LOW.hi)
      throw new Error(
        `Rungs: a lower voice at ${centre - h} is outside the violas and cellos (${LOW.lo}–${LOW.hi}); move the Centre or narrow the widest span`,
      );
  }
  const families = familiesOf("Families", v.families);
  const gaps = setsOf("Drops", v.drops).flat();
  if (gaps.some((g) => g <= 0 || !Number.isInteger(g * TICKS)))
    throw new Error("Drops: the time between drops is a positive number of beats");
  const drops = [0];
  for (const g of gaps) drops.push(drops.at(-1)! + g * TICKS);

  // The ladder, tick by tick.
  const rings: Ring[] = [];
  const flying = () => rings.filter((r) => r.left === undefined);
  const rungOf = (r: Ring) => r.stays.at(-1)!.rung;
  const taken = (k: number) => flying().some((r) => rungOf(r) === k);
  const limit = drops.at(-1)! + 200 * TICKS * spans.length;
  for (let t = 0; rings.length < drops.length || flying().length > 0; t++) {
    if (t > limit) throw new Error("Drops: the rings never clear the ladder");
    // Rings due now, outermost first: step out if the next rung is free, else wait one period.
    const due = flying()
      .filter((r) => r.due === t)
      .sort((a, b) => rungOf(b) - rungOf(a));
    for (const r of due) {
      const k = rungOf(r);
      if (k === top) {
        r.left = t;
        continue;
      }
      if (!taken(k + 1)) r.stays.push({ at: t, rung: k + 1 });
      r.due = t + r.period;
    }
    // The next drop: born when due, on its family's grid, with the narrowest rung free.
    const n = rings.length;
    if (n < drops.length && drops[n]! <= t) {
      const family = families[n % families.length]!;
      if (t % atomOf(family) === 0 && !taken(0)) {
        const period = v.period * atomOf(family);
        rings.push({ family, period, born: t, stays: [{ at: t, rung: 0 }], due: t + period });
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

  // Loudness is the distance from the centre: p on the narrowest rung, ppp on the widest.
  const level = (k: number) => (top === 0 ? 3 : 3 - (2 * k) / top);
  const voice = (p: Player, side: "upper" | "lower", sign: -1 | 1, j: number): Part | undefined => {
    const own = rings.filter((r) => r[side] === j);
    if (own.length === 0) return undefined;
    const events: NoteEvent[] = [];
    const points: { at: number; level: number; ramp?: boolean }[] = [{ at: 0, level: level(0) }];
    for (const r of own) {
      r.stays.forEach((s, i) => {
        const stop = r.stays[i + 1]?.at ?? r.left!;
        events.push(note(s.at, stop - s.at, centre + sign * half[s.rung]!));
        if (i === 0) points.push({ at: s.at, level: level(0) });
        else
          points.push(
            { at: s.at, level: level(s.rung - 1), ramp: true },
            { at: s.at + r.period, level: level(s.rung) },
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

  // The harps: at each birth, the birth pair, each tone on the harp that holds its grid.
  const births = rings.map((r) => r.born);
  const harps = HARPS.map((h) => {
    const tone = [centre - half[0]!, centre + half[0]!].find((m) => gridOf(m) === h.grids[0])!;
    const events = births.map((at, i) =>
      note(at, Math.min(2 * TICKS, (births[i + 1] ?? end) - at, end - at), tone),
    );
    const out = part(h, events, [{ at: 0, level: 3 }]);
    const mark: TextEvent = { type: "text", at: time(births[0]!), text: "l.v. sempre" };
    out.events.unshift(mark);
    return out;
  });

  return scoreOf("antara · palette B · rings from a drop", end / bar, v.tempo, [
    ...harps,
    ...[...upper, ...lower].filter((x): x is Part => x !== undefined),
  ]);
}

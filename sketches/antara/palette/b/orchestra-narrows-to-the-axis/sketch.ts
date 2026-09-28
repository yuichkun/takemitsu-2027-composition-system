// antara palette, B: the orchestra narrows to the axis.
//
// Uses the A sketch "the centre nobody can play" (../../a/pitch-unplayed-centre), its rule copied
// here unchanged. The centre is halfway between the two grids (a quarter of a semitone off each), so
// nothing can sound it. Pairs of voices stand around it symmetrically: a pair on a span s sounds the
// centre minus s/2 and the centre plus s/2. There are more spans than pairs; round by round, every
// pair moves once, the widest first, to the free span nearest its own (the narrower one on a tie),
// its two voices at once in contrary motion by the same amount.
//
// Here the A's four pairs of violins become eight pairs of the orchestra, all sounding from the
// first beat (nothing enters later, nothing thickens). After the rounds the pairs leave one at a
// time, always the widest, until one pair is left at the narrowest span: a quarter tone around the
// axis. That is the end of a piece.
//
// Who plays is decided by the structure:
// - The centre is the cut between the orchestra's upper side and lower side, as in the A the cut
//   between Violins I and II was. Each pair is one player above and one below. Because the rule
//   takes a pair to almost any span, a player must hold every pitch its side can reach (the centre
//   to half the widest span). The default centre is the one place where violins I and II and violas
//   hold the whole upper side and cellos the whole lower side.
// - The number of players follows the order of leaving: the first pair to leave is the largest.
//   The lower side has three sections that hold it (cellos, horns, bassoons); they pair, largest
//   with largest, with the three largest of the upper side (violins I, violins II, violas). A
//   section plays twice: its players without the leader form a large pair, its leader a small one,
//   in mirrored places in that order (the section leaving first has its leader leaving last).
//   The two pairs left in the middle are single players (a flute, an oboe; the tuba, the bass
//   trombone); the ones whose range reaches farther beyond the side leave first.
// The order of leaving is known only after the rounds, so the players are handed out afterwards.
// Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

export const knobs = {
  spans: betweenSet({
    group: "Pitch",
    label: "Spans",
    help: "The betweens a pair can stand on, half above and half below the centre (semitones, each once). Every one has .5: the centre is between the grids. At least nine, so that a span is always free for the eight pairs",
    value: "0.5 2.5 5.5 9.5 14.5 20.5 27.5 35.5 44.5 54.5",
    min: 0.5,
    max: 60,
    step: 0.5,
    unit: "st",
  }),
  centre: pitch({
    group: "Pitch",
    label: "Centre",
    help: "The centre is a quarter of a semitone above this pitch, halfway between the two grids: no instrument can sound it, and nothing ever does. Every player must hold its whole side of it",
    value: "D#4",
    min: "C3",
    max: "C6",
    step: 0.5,
  }),
  rounds: number({
    group: "Time",
    label: "Rounds",
    help: "In each round every pair moves once, the widest first, to the free span nearest its own. Then the pairs leave, the widest first",
    value: 3,
    min: 1,
    max: 8,
    step: 1,
  }),
  moves: betweenSet({
    group: "Time",
    label: "Moves",
    help: "The time from one move to the next, in atoms of the family, taken in turn",
    value: "6 8 9",
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time between moves counts in",
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

// Ranges are what both the instrument (src/instruments/catalog.ts) and its playback samples hold:
// a quarter tone is played from the key below it, so the top may be a quarter tone above the
// highest sampled key.
const who = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  range: [number, number],
  players?: number,
): Player => ({
  id,
  instrument,
  name,
  abbreviation,
  range,
  grids: [0, 1],
  ...(players === undefined ? {} : { players }),
});

const VN1: [number, number] = [55, 97.5];
const VN2: [number, number] = [55, 97.5];
const VA: [number, number] = [48, 90.5];
const VC: [number, number] = [36, 82.5];

interface Pair {
  upper: Player;
  lower: Player;
}

// In the order of leaving: the first pair to leave comes first.
const CAST: Pair[] = [
  {
    upper: who("vn1", "violins-1", "Violins I", "Vn. I", VN1, 15),
    lower: who("vc", "cellos", "Violoncellos", "Vc.", VC, 9),
  },
  {
    upper: who("vn2", "violins-2", "Violins II", "Vn. II", VN2, 13),
    lower: who("hn2-4", "horn", "Horns 2–4", "Hn. 2–4", [34, 77], 3),
  },
  {
    upper: who("va", "violas", "Violas", "Va.", VA, 11),
    lower: who("bsn2-3", "bassoon", "Bassoons 2–3", "Bsn. 2–3", [34, 74.5], 2),
  },
  {
    upper: who("fl", "flute", "Flute", "Fl.", [60, 96.5]),
    lower: who("tba", "tuba", "Tuba", "Tba.", [26, 63.5]),
  },
  {
    upper: who("ob", "oboe", "Oboe", "Ob.", [58, 90.5]),
    lower: who("btbn", "bass-trombone", "Bass Trombone", "B. Tbn.", [28, 67]),
  },
  {
    upper: who("va-solo", "violas", "Viola solo", "Va. solo", VA, 1),
    lower: who("bsn1", "bassoon", "Bassoon 1", "Bsn. 1", [34, 74.5]),
  },
  {
    upper: who("vn2-solo", "violins-2", "Violin II solo", "Vn. II solo", VN2, 1),
    lower: who("hn1", "horn", "Horn 1", "Hn. 1", [34, 77]),
  },
  {
    upper: who("vn1-solo", "violins-1", "Violin I solo", "Vn. I solo", VN1, 1),
    lower: who("vc-solo", "cellos", "Violoncello solo", "Vc. solo", VC, 1),
  },
];

// Score order, by part id.
const ORDER = [
  "fl",
  "ob",
  "bsn1",
  "bsn2-3",
  "hn1",
  "hn2-4",
  "btbn",
  "tba",
  "vn1-solo",
  "vn1",
  "vn2-solo",
  "vn2",
  "va-solo",
  "va",
  "vc-solo",
  "vc",
];

interface Stand {
  at: number;
  span: number;
}

export function score(v: Values<typeof knobs>) {
  const spans = [...new Set(v.spans)].sort((a, b) => a - b);
  if (spans.some((s) => Math.abs(s * 2) % 2 !== 1))
    throw new Error("Spans: a span around a centre between the grids has .5");
  const n = CAST.length;
  if (spans.length < n + 1)
    throw new Error(
      `Spans: the ${n} pairs need at least ${n + 1} spans, so that one is always free`,
    );
  const centre = v.centre + 0.25;
  const atom = atomOf(familyOf(v.family));
  const gap = stream(v.moves, "shift each time", 1);
  const beat = TICKS;
  const bar = 4 * TICKS;

  // Pair k stands on now[k]. At the start the pairs take the middle spans; pair 0 is the widest.
  // All of them sound from the first beat.
  const lo = Math.floor((spans.length - n) / 2);
  const now = spans.slice(lo, lo + n).reverse();
  const widestFirst = () => now.map((_, k) => k).sort((a, b) => now[b]! - now[a]!);
  const free = () => spans.filter((s) => !now.includes(s));
  const stands: Stand[][] = now.map((span) => [{ at: 0, span }]);
  const moveTo = (k: number, at: number, span: number) => {
    now[k] = span;
    stands[k]!.push({ at, span });
  };

  // Moves (the A's rule): in each round every pair moves once, the widest first, to the nearest
  // free span (spans are ascending, so on a tie the narrower one is kept).
  let t = 0;
  for (let r = 0; r < v.rounds; r++)
    for (const k of widestFirst()) {
      t += gap() * atom;
      const from = now[k]!;
      const to = free().reduce((a, b) => (Math.abs(b - from) < Math.abs(a - from) ? b : a));
      moveTo(k, t, to);
    }

  // Leaving (the A's): from the widest inward, one pair every 3 beats. The last pair moves to the
  // narrowest span if it is not there yet, and holds to the end.
  const leaving = widestFirst();
  const last = leaving.pop()!;
  const out = new Map<number, number>();
  t += 3 * beat;
  for (const k of leaving) {
    out.set(k, t);
    t += 3 * beat;
  }
  if (now[last] !== spans[0]) moveTo(last, t, spans[0]!);
  const end = Math.ceil((t + 2 * bar) / bar) * bar;
  out.set(last, end);

  // Players by the order of leaving.
  const castOf = new Map([...leaving, last].map((k, i) => [k, CAST[i]!]));

  // Each pair's two voices: the centre minus and plus half its span, inside its players' ranges.
  const pitchesOf = (k: number, side: -1 | 1) =>
    stands[k]!.map((x) => centre + (side * x.span) / 2);
  for (let k = 0; k < n; k++) {
    const c = castOf.get(k)!;
    for (const [p, side] of [
      [c.upper, 1],
      [c.lower, -1],
    ] as const)
      for (const m of pitchesOf(k, side)) {
        if (!Number.isInteger(m * 2)) throw new Error(`Centre: ${m} is off the quarter-tone grid`);
        if (m < p.range[0] || m > p.range[1])
          throw new Error(
            `Spans: ${p.name} would play ${m}, outside ${p.range[0]}–${p.range[1]}; move the Centre or narrow the widest span`,
          );
      }
  }

  const fade = beat;
  const glow = Math.round(1.5 * beat);
  const voice = (p: Player, k: number, side: -1 | 1) => {
    const xs = stands[k]!;
    const stop = out.get(k)!;
    const leaves = k === last ? end : stop + fade;
    const pitches = pitchesOf(k, side);
    const events = xs.map((x, i) => note(x.at, (xs[i + 1]?.at ?? leaves) - x.at, pitches[i]!));
    // pp; a pair that has just moved rises to p for a moment.
    const points = [
      { at: 0, level: 0, ramp: true },
      { at: fade, level: 2 },
    ];
    for (const [i, x] of xs.entries()) {
      if (i === 0) continue;
      const until = Math.min(xs[i + 1]?.at ?? leaves, x.at + glow);
      points.push({ at: x.at, level: 3, ramp: true }, { at: until, level: 2 });
    }
    if (k === last) points.push({ at: end - bar, level: 2, ramp: true }, { at: end, level: 0 });
    else points.push({ at: stop, level: 2, ramp: true }, { at: stop + fade, level: 0 });
    return part(p, events, curve(points));
  };

  const parts = [...castOf.entries()]
    .flatMap(([k, c]) => [voice(c.upper, k, 1), voice(c.lower, k, -1)])
    .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  return scoreOf(
    "antara · palette B · the orchestra narrows to the axis",
    end / bar,
    v.tempo,
    parts,
  );
}

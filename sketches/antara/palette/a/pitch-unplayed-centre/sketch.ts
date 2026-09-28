// antara palette, A (pitch): the centre nobody can play.
//
// The quarter-tone grid is two semitone grids a quarter tone apart. Halfway between them, a quarter
// of a semitone off each, is a place where no term can stand: no instrument sounds it. Here that
// place is the centre. Pairs of voices stand around it symmetrically: a pair on a span s sounds the
// centre minus s/2 and the centre plus s/2. Because the centre is off the grid, every span has .5
// (an odd number of quarter tones), so every pair has one voice on each grid.
//
// There are more spans than pairs, so some spans are always free. The rule: round by round, every
// pair moves once, the widest first, to the free span nearest its own (the narrower one on a tie).
// A move is the pair's two voices at once, in contrary motion by the same amount; every other voice
// holds. The chord changes, but the centre never moves and never sounds: every pitch is named only
// by its distance from a point that is not there.
//
// The upper voices are divided first violins, the lower voices divided second violins, so the cut
// between the two sections is the centre. The pairs enter from the outside in and leave from the
// outside in; the last pair moves to the narrowest span, a quarter tone straddling the centre.
// Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

export const knobs = {
  spans: betweenSet({
    group: "Pitch",
    label: "Spans",
    help: "The betweens a pair can stand on, half above and half below the centre (semitones, each once). Every one has .5: the centre is between the grids",
    value: "0.5 2.5 5.5 9.5 14.5 20.5",
    min: 0.5,
    max: 24,
    step: 0.5,
    unit: "st",
  }),
  centre: pitch({
    group: "Pitch",
    label: "Centre",
    help: "The centre is a quarter of a semitone above this pitch, halfway between the two grids: no instrument can sound it, and nothing ever does",
    value: "F#4",
    min: "C4",
    max: "C6",
    step: 0.5,
  }),
  pairs: number({
    group: "Pitch",
    label: "Pairs",
    help: "How many pairs stand on the spans at once, at most one fewer than the spans so that a span is always free. They start on the middle spans",
    value: 4,
    min: 1,
    max: 6,
    step: 1,
  }),
  rounds: number({
    group: "Time",
    label: "Rounds",
    help: "In each round every pair moves once, the widest first, to the free span nearest its own",
    value: 4,
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
    value: 66,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

const VIOLINS: [number, number] = [55, 103];

/** A section divided into n parts, numbered from the top; the larger shares go to the top. */
function divided(
  instrument: string,
  name: string,
  abbreviation: string,
  id: string,
  size: number,
  n: number,
): Player[] {
  return Array.from({ length: n }, (_, j) => ({
    id: n === 1 ? id : `${id}-${j + 1}`,
    instrument,
    name: n === 1 ? name : `${name} ${j + 1}`,
    abbreviation: n === 1 ? abbreviation : `${abbreviation} ${j + 1}`,
    players: Math.floor(size / n) + (j < size % n ? 1 : 0),
    range: VIOLINS,
    grids: [0, 1],
  }));
}

interface Stand {
  at: number;
  span: number;
}

export function score(v: Values<typeof knobs>) {
  const spans = [...new Set(v.spans)].sort((a, b) => a - b);
  if (spans.some((s) => Math.abs(s * 2) % 2 !== 1))
    throw new Error("Spans: a span around a centre between the grids has .5");
  const n = v.pairs;
  if (n > spans.length - 1)
    throw new Error(
      `Pairs: at most one fewer than the spans (${spans.length - 1}), so that a span is always free`,
    );
  const centre = v.centre + 0.25;
  const atom = atomOf(familyOf(v.family));
  const gap = stream(v.moves, "shift each time", 1);
  const beat = TICKS;
  const bar = 4 * TICKS;

  // Pair k stands on now[k]. At the start the pairs take the middle spans; pair 0 is the widest.
  const lo = Math.floor((spans.length - n) / 2);
  const now = spans.slice(lo, lo + n).reverse();
  const widestFirst = () => now.map((_, k) => k).sort((a, b) => now[b]! - now[a]!);
  const free = () => spans.filter((s) => !now.includes(s));

  // Entry: one pair every 3 beats, from the outside in.
  const stands: Stand[][] = now.map((span, k) => [{ at: 3 * k * beat, span }]);
  const moveTo = (k: number, at: number, span: number) => {
    now[k] = span;
    stands[k]!.push({ at, span });
  };

  // Moves: in each round every pair moves once, the widest first, to the nearest free span (spans
  // are ascending, so on a tie the narrower one is kept).
  let t = stands.at(-1)![0]!.at;
  for (let r = 0; r < v.rounds; r++)
    for (const k of widestFirst()) {
      t += gap() * atom;
      const from = now[k]!;
      const to = free().reduce((a, b) => (Math.abs(b - from) < Math.abs(a - from) ? b : a));
      moveTo(k, t, to);
    }

  // Exit: from the widest inward, one pair every 3 beats. The last pair moves once more, to the
  // narrowest span, and holds to the end.
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

  // Each pair's two voices: the centre minus and plus half its span.
  const pitchesOf = (k: number, side: -1 | 1) =>
    stands[k]!.map((x) => centre + (side * x.span) / 2);
  for (let k = 0; k < n; k++)
    for (const m of [...pitchesOf(k, -1), ...pitchesOf(k, 1)]) {
      if (!Number.isInteger(m * 2)) throw new Error(`Centre: ${m} is off the quarter-tone grid`);
      if (m < VIOLINS[0] || m > VIOLINS[1])
        throw new Error(
          `Spans: a voice at ${m} is outside the violins (${VIOLINS[0]}–${VIOLINS[1]}); move the Centre or narrow the widest span`,
        );
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
      { at: xs[0]!.at, level: 0, ramp: true },
      { at: xs[0]!.at + fade, level: 2 },
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

  // Pair k: its upper voice is always Violins I k + 1, its lower voice Violins II n - k, so at the
  // start the score reads from the top down, and the two sections meet at the centre.
  const upper = divided("violins-1", "Violins I", "Vn. I", "vn1", 16, n);
  const lower = divided("violins-2", "Violins II", "Vn. II", "vn2", 14, n);
  const parts = [
    ...upper.map((p, j) => voice(p, j, 1)),
    ...lower.map((p, j) => voice(p, n - 1 - j, -1)),
  ];
  return scoreOf("antara · palette A · the centre nobody can play", end / bar, v.tempo, parts);
}

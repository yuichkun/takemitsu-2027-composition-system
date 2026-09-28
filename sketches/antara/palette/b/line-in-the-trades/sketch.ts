// antara palette, B: the line in the trades.
//
// Uses the A sketch "the betweens trade places" (../../a/pitch-trade-places, through ../../trade.ts):
// a chord of divided strings is its betweens stacked on a standpoint; two neighbouring betweens
// trade places, and the one voice standing between them moves, by their difference, while every
// other voice holds. The lowest and highest voices never move.
//
// Here the moved voices are taken out as a line. At each trade a solo wind plays the moved voice's
// new pitch with it, legato to the next trade. The trades of one wave (the widest between still out
// of place travelling down, one voice at a time from the top of the chord) make one line, and each
// wave has its own wind. From one moved voice to the next, the line steps by exactly the between
// that the travelling one overtakes next: the chord's vertical betweens become the line's
// horizontal ones. Each wave travels one place less than the one before, so each line is the one
// before without its first step: shorter, and higher.
//
// After a bar of the strings alone, the same trades are undone, last first, grouped by the same
// waves. The moved voices return to their old pitches, rising, and the lines grow again one note at
// a time, until the last one climbs from the bottom of the chord to the top and the chord stands as
// it began.
//
// Each line's wind is the one whose range holds the whole line and whose range's middle is nearest
// the line's middle (the middle of its lowest and highest pitch), never the wind of the line
// before; a tie goes to the wind written first.
// Card: README.md.

import { instrument } from "../../../../../src/instruments/catalog.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, divisi, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";
import { apply, tones, waves, type Trade } from "../../trade.ts";

export const knobs = {
  chord: betweenSet({
    group: "Chord",
    label: "Chord",
    help: "The betweens of the chord (semitones, .5 for a quarter tone), stacked narrow at the bottom. They keep their sizes; only their order changes. Each line steps by the betweens its wave overtakes",
    value: "0.5 1.5 2.5 3.5 6.5 8 9.5 11",
    min: 0,
    max: 12,
    step: 0.5,
    unit: "st",
    anchor: "anchor",
  }),
  anchor: pitch({
    group: "Chord",
    label: "Standpoint",
    help: "The lowest voice. It never moves, and neither does the highest",
    value: "G2",
    min: "C2",
    max: "C4",
    step: 0.5,
  }),
  within: betweenSet({
    group: "Time",
    label: "Within a wave",
    help: "The time from one trade to the next inside a wave (from one note of a line to the next), in atoms of the family, taken in turn, one place later each time round",
    value: "3 4 5",
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  apart: betweenSet({
    group: "Time",
    label: "Between waves",
    help: "The time from the last trade of a wave to the first of the next (from one line to the next), in atoms of the family, taken in turn, one place later each time round",
    value: "9 12",
    min: 1,
    max: 48,
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

const wind = (id: string, name: string): Player => ({
  id,
  instrument: name,
  range: instrument(name).range!,
  grids: [0, 1],
});

// The winds that may take a line, in score order.
const WINDS: Player[] = [
  wind("fl", "flute"),
  wind("ob", "oboe"),
  wind("ca", "cor-anglais"),
  wind("cl", "clarinet"),
  wind("bcl", "bass-clarinet"),
  wind("bsn", "bassoon"),
  wind("hn", "horn"),
];

interface Tone {
  at: number;
  midi: number;
}
interface Sounding extends Tone {
  stop: number;
}
type Point = Parameters<typeof curve>[0][number];

const middle = ([lo, hi]: [number, number]) => (lo + hi) / 2;

/**
 * The wind for a line: those whose range holds the whole line first, the nearest middle first
 * (a tie to the one written first); never `previous`.
 */
function windFor(line: Tone[], previous: Player | undefined): Player {
  const span: [number, number] = [
    Math.min(...line.map((n) => n.midi)),
    Math.max(...line.map((n) => n.midi)),
  ];
  const outside = (p: Player) =>
    Math.max(0, p.range[0] - span[0]) + Math.max(0, span[1] - p.range[1]);
  const ranked = WINDS.map((p, i) => ({ p, i })).sort(
    (a, b) =>
      outside(a.p) - outside(b.p) ||
      Math.abs(middle(a.p.range) - middle(span)) - Math.abs(middle(b.p.range) - middle(span)) ||
      a.i - b.i,
  );
  return (ranked.find(({ p }) => p !== previous) ?? ranked[0]!).p;
}

export function score(v: Values<typeof knobs>) {
  const bar = 4 * TICKS;
  const atom = atomOf(familyOf(v.family));
  const within = stream(v.within, "shift each time", 1);
  const apart = stream(v.apart, "shift each time", 1);

  let order = [...v.chord].sort((a, b) => a - b);
  const forward = waves(order, true);
  // Each voice's pitches, as (tick, midi), from the chord at 0; each wave's moved tones, a line.
  const voices: Tone[][] = tones(v.anchor, order).map((m) => [{ at: 0, midi: m }]);
  const lines: Tone[][] = [];
  const run = (trades: Trade[], from: number) => {
    let t = from;
    let wave = -1;
    for (const trade of trades) {
      if (wave !== -1) t += (trade.wave !== wave ? apart() : within()) * atom;
      if (trade.wave !== wave) lines.push([]);
      wave = trade.wave;
      order = apply(order, trade);
      const now = tones(v.anchor, order);
      for (const pos of trade.pairs) {
        const tone = { at: t, midi: now[pos + 1]! };
        voices[pos + 1]!.push(tone);
        lines.at(-1)!.push(tone);
      }
    }
    return t;
  };

  // Forward after a bar of the chord alone; back (the same trades undone, last first) from the bar
  // line after the last line has ended, plus a bar of the strings alone.
  const longest = 2 * TICKS;
  const turned = run(forward, bar);
  const turn = Math.ceil((turned + longest) / bar) * bar + bar;
  const home = run([...forward].reverse(), turn);
  const end = Math.ceil((home + 6 * TICKS) / bar) * bar;

  // Strings: held pp; a voice that has just moved is p for a beat.
  const ranges = voices.map((xs): [number, number] => [
    Math.min(...xs.map((x) => x.midi)),
    Math.max(...xs.map((x) => x.midi)),
  ]);
  const strings = divisi(ranges);
  const stringParts = voices.map((xs, k) => {
    const events = xs.map((x, i) => note(x.at, (xs[i + 1]?.at ?? end) - x.at, x.midi));
    const points: Point[] = [{ at: 0, level: 2 }];
    for (const [i, x] of xs.entries()) {
      if (i === 0) continue;
      const until = Math.min(xs[i + 1]?.at ?? end, x.at + TICKS, end - bar);
      points.push({ at: x.at, level: 3, ramp: true }, { at: Math.max(until, x.at + 1), level: 2 });
    }
    points.push({ at: end - bar, level: 2, ramp: true }, { at: end, level: 0 });
    return part(strings[k]!, events, curve(points));
  });

  // Winds: one line each, legato; p rising to mp at the middle note and back. The last line rises
  // to its last note, where the chord is home, and fades with the chord.
  const byWind = new Map<Player, { lines: Sounding[][]; points: Point[] }>();
  let previous: Player | undefined;
  lines.forEach((line, l) => {
    const last = l === lines.length - 1;
    const p = windFor(line, previous);
    previous = p;
    const entry = byWind.get(p) ?? byWind.set(p, { lines: [], points: [] }).get(p)!;
    const next = lines[l + 1]?.[0]?.at ?? end;
    const stop = (i: number) =>
      line[i + 1]?.at ?? (last ? end : Math.min(next, line[i]!.at + longest));
    const a = Math.floor((line.length - 1) / 2);
    const b = Math.ceil((line.length - 1) / 2);
    const peak = (line[a]!.at + stop(b)) / 2;
    const start = line[0]!.at;
    if (last)
      entry.points.push(
        { at: start, level: 3, ramp: true },
        { at: line.at(-1)!.at, level: 4.5, ramp: true },
        { at: end - bar, level: 2, ramp: true },
        { at: end, level: 0 },
      );
    else
      entry.points.push(
        { at: start, level: 3, ramp: true },
        { at: peak, level: 4, ramp: true },
        { at: stop(line.length - 1), level: 3 },
      );
    entry.lines.push(line.map((n, i) => ({ ...n, stop: stop(i) })));
  });
  const windParts = WINDS.filter((p) => byWind.has(p)).map((p) => {
    const { lines: played, points } = byWind.get(p)!;
    const events = played.flatMap((line) =>
      line.map((n, i) =>
        note(n.at, n.stop - n.at, n.midi, i < line.length - 1 ? { slur: true } : {}),
      ),
    );
    return part(p, events, curve(points));
  });

  const out = scoreOf("antara · palette B · the line in the trades", end / bar, v.tempo, [
    ...windParts,
    ...stringParts.reverse(),
  ]);
  out.rehearsal = [{ measure: turn / bar + 1, label: "back" }];
  return out;
}

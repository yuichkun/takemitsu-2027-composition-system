// antara palette, B: a chord whose colours are named by its betweens.
//
// Uses the A sketch "the betweens trade places" (../../a/pitch-trade-places): the chord keeps its
// betweens and only their order changes, so one voice moves at a time, and the lowest and highest
// voices never move.
//
// Here each voice's colour is a name given by the between below it: a voice standing a narrow
// between above its neighbour sounds in the strings, a voice standing a wide between above it
// sounds in the brass. When two betweens trade places, the voice between them moves, and the voice
// above it keeps its pitch but now has another between below it, so it may change colour without
// moving. At the start the narrow betweens are at the bottom: a knot of low strings under an open
// chord of brass. Wave by wave the knot is carried up through the brass, one voice at a time, until
// the brass are below and the strings on top. Then the order turns back in fewer, larger steps
// (several pairs trade places at once, counted in another family), until the chord is where it
// began. The standpoint, which has no between below it, stays in the basses throughout.
// Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import {
  curve,
  divisi,
  inOrder,
  note,
  numberFromTop,
  part,
  scoreOf,
  stream,
  TICKS,
  type Player,
} from "../../common.ts";
import { apply, steps, tones, waves } from "../../trade.ts";

export const knobs = {
  chord: betweenSet({
    group: "Chord",
    label: "Chord",
    help: "The betweens of the chord (semitones, .5 for a quarter tone). They start narrow at the bottom; they keep their sizes, only their order changes",
    value: "0.5 1 1.5 2 5.5 6 6.5 7 7.5",
    min: 0,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  strings: number({
    group: "Chord",
    label: "Strings up to",
    help: "A voice whose between below is this or narrower sounds in the strings; wider, in the brass",
    value: 3,
    min: 0,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  anchor: pitch({
    group: "Chord",
    label: "Standpoint",
    help: "The lowest voice, in the basses. It never moves, and neither does the highest",
    value: "D2",
    min: "G1",
    max: "C4",
    step: 0.5,
  }),
  within: betweenSet({
    group: "Up, one voice at a time",
    label: "Within a wave",
    help: "The time between one trade and the next inside a wave, in atoms of the family, taken in turn",
    value: "3 4",
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  apart: betweenSet({
    group: "Up, one voice at a time",
    label: "Between waves",
    help: "The time before a wave begins, in atoms of the family, taken in turn",
    value: "6 9",
    min: 1,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  upFamily: choice({
    group: "Up, one voice at a time",
    label: "Family",
    help: "The atom the way up counts in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  back: betweenSet({
    group: "Back, several at once",
    label: "Between steps",
    help: "The time from one step of the way back to the next, in atoms of the family, taken in turn",
    value: "10 15",
    min: 1,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  backFamily: choice({
    group: "Back, several at once",
    label: "Family",
    help: "The atom the way back counts in (it changes at a bar line, where the families meet)",
    value: FAMILY_OPTIONS[2]!,
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

type Colour = "frame" | "strings" | "brass";
interface Seg {
  at: number;
  midi: number;
  colour: Colour;
  phase: 0 | 1;
}

const brass = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  range: [number, number],
): Player => ({ id, instrument, name, abbreviation, range, grids: [0, 1] });

// Low to high: the order voices take them in.
const BRASS: Player[] = [
  brass("tba", "tuba", "Tuba", "Tba.", [26, 65]),
  brass("btbn", "bass-trombone", "Bass Trombone", "B. Tbn.", [28, 67]),
  brass("tbn2", "trombone", "Trombone 2", "Tbn. 2", [40, 72]),
  brass("tbn1", "trombone", "Trombone 1", "Tbn. 1", [40, 72]),
  brass("hn4", "horn", "Horn 4", "Hn. 4", [34, 77]),
  brass("hn3", "horn", "Horn 3", "Hn. 3", [34, 77]),
  brass("hn2", "horn", "Horn 2", "Hn. 2", [34, 77]),
  brass("hn1", "horn", "Horn 1", "Hn. 1", [34, 77]),
  brass("tpt3", "trumpet", "Trumpet 3", "Tpt. 3", [54, 84]),
  brass("tpt2", "trumpet", "Trumpet 2", "Tpt. 2", [54, 84]),
  brass("tpt1", "trumpet", "Trumpet 1", "Tpt. 1", [54, 84]),
];
const BRASS_ORDER = ["horn", "trumpet", "trombone", "bass-trombone", "tuba"];
const FRAME: Player = {
  id: "cb",
  instrument: "basses",
  name: "Contrabasses",
  abbreviation: "Cb.",
  players: 8,
  range: [28, 67],
  grids: [0, 1],
};

/** Levels: the way up, the way back. */
const LEVEL: Record<Colour, [number, number]> = {
  frame: [4, 5],
  strings: [4, 5],
  brass: [3.5, 4.5],
};

export function score(v: Values<typeof knobs>) {
  const bar = 4 * TICKS;
  const upAtom = atomOf(familyOf(v.upFamily));
  const backAtom = atomOf(familyOf(v.backFamily));
  const within = stream(v.within, "shift each time", 1);
  const apart = stream(v.apart, "shift each time", 1);
  const back = stream(v.back, "shift each time", 1);

  let order = [...v.chord].sort((a, b) => a - b);
  const colourOf = (k: number): Colour =>
    k === 0 ? "frame" : order[k - 1]! <= v.strings ? "strings" : "brass";
  const segs: Seg[][] = tones(v.anchor, order).map((m, k) => [
    { at: 0, midi: m, colour: colourOf(k), phase: 0 },
  ]);
  const record = (at: number, phase: 0 | 1) => {
    tones(v.anchor, order).forEach((m, k) => {
      const last = segs[k]!.at(-1)!;
      const c = colourOf(k);
      if (last.midi !== m || last.colour !== c) segs[k]!.push({ at, midi: m, colour: c, phase });
    });
  };

  // Up: one voice at a time, wave by wave.
  let t = bar;
  let lastWave = -1;
  for (const trade of waves(order, true)) {
    t += (trade.wave !== lastWave ? apart() : within()) * upAtom;
    lastWave = trade.wave;
    order = apply(order, trade);
    record(t, 0);
  }
  // Back: several at once, from a bar line.
  t = Math.ceil((t + apart() * upAtom + TICKS) / bar) * bar;
  const turn = t;
  steps(order, false).forEach((trade, i) => {
    if (i > 0) t += back() * backAtom;
    order = apply(order, trade);
    record(t, 1);
  });
  const end = Math.ceil((t + 2 * bar) / bar) * bar;

  // Each colour of each voice is a lane; a lane's notes, with the colour's entry and exit.
  const fade = TICKS;
  interface Lane {
    notes: { at: number; stop: number; midi: number }[];
    points: { at: number; level: number; ramp?: boolean }[];
  }
  const lanes = segs.map(() => new Map<Colour, Lane>());
  segs.forEach((xs, k) => {
    xs.forEach((x, i) => {
      const prev = xs[i - 1];
      const next = xs[i + 1];
      const lane =
        lanes[k]!.get(x.colour) ??
        lanes[k]!.set(x.colour, { notes: [], points: [] }).get(x.colour)!;
      const level = LEVEL[x.colour][x.phase];
      // Only a colour change on a held pitch overlaps: the two colours cross on the one pitch.
      const crossing = next && next.colour !== x.colour && next.midi === x.midi;
      const stop = next ? next.at + (crossing ? fade : 0) : end;
      lane.notes.push({ at: x.at, stop, midi: x.midi });
      if (!prev) lane.points.push({ at: 0, level: 0, ramp: true }, { at: bar, level });
      else if (prev.midi === x.midi) {
        // A new colour on the same pitch comes in from nothing.
        lane.points.push(
          { at: x.at, level: 0, ramp: true },
          { at: Math.min(x.at + fade, stop), level },
        );
      } else {
        // A voice that has just moved is a little louder for a moment.
        lane.points.push(
          { at: x.at, level: level + 1, ramp: true },
          { at: Math.min(x.at + fade, stop), level },
        );
      }
      if (crossing) lane.points.push({ at: next.at, level, ramp: true }, { at: stop, level: 0 });
      if (!next) lane.points.push({ at: end - bar, level, ramp: true }, { at: end, level: 0 });
    });
  });

  // Players: the frame in the basses; the string lanes divided by register; the brass lanes low to
  // high.
  const rangeOf = (l: Lane): [number, number] => [
    Math.min(...l.notes.map((n) => n.midi)),
    Math.max(...l.notes.map((n) => n.midi)),
  ];
  const withColour = (c: Colour) =>
    lanes.flatMap((m, k) => (m.has(c) ? [{ k, lane: m.get(c)! }] : []));
  const strung = withColour("strings");
  const blown = withColour("brass");
  const stringPlayers = divisi(strung.map((x) => rangeOf(x.lane)));
  const brassPlayers = numberFromTop(
    inOrder(
      blown.map((x) => rangeOf(x.lane)),
      BRASS,
    ),
  );

  const partOf = (p: Player, lane: Lane) => {
    const notes = [...lane.notes].sort((a, b) => a.at - b.at);
    const events = notes.map((n, i) => {
      const stop = Math.min(n.stop, notes[i + 1]?.at ?? n.stop);
      return note(n.at, stop - n.at, n.midi);
    });
    return part(p, events, curve(lane.points));
  };
  const brassParts = blown
    .map((x, i) => partOf(brassPlayers[i]!, x.lane))
    .sort(
      (a, b) =>
        BRASS_ORDER.indexOf(a.instrument) - BRASS_ORDER.indexOf(b.instrument) ||
        a.id.localeCompare(b.id),
    );
  const stringParts = strung.map((x, i) => partOf(stringPlayers[i]!, x.lane)).reverse();
  const frame = partOf(FRAME, lanes[0]!.get("frame")!);

  const out = scoreOf("antara · palette B · colours named by the betweens", end / bar, v.tempo, [
    ...brassParts,
    ...stringParts,
    frame,
  ]);
  out.rehearsal = [{ measure: turn / bar + 1, label: "back" }];
  return out;
}

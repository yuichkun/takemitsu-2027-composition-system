// antara palette, B: the betweens trade places in time.
//
// Uses the A sketch "the betweens trade places" (../../a/pitch-trade-places, with ../../trade.ts),
// moved onto the time axis. A cycle is held like a chord: a head (its standpoint) with six time
// betweens stacked on it, so voice k sounds k betweens after the head, and the next head comes the
// sum of the six later. Cycles follow one another with no gap. When two neighbouring time betweens
// trade places, exactly one onset moves (the one standing between them, by the difference of the
// two); the head and the period never move.
//
// Each onset is one voice of a chord, stacked on the standpoint by five pitch betweens, and one wind
// plays it, staccato, once a cycle. The head is doubled by the harp and the contrabasses (pizz.).
//
// First the time betweens, short first, trade places in waves, one trade a cycle, and every onset
// that moves, moves later: the run of short betweens right after the head is carried, one onset at
// a time, to just before the next head. Then the strings enter, each part holding its voice's tone
// from the voice's onset to its next, and the time betweens trade back in steps (several onsets at
// once, each moving earlier) while the pitch betweens trade places in steps too, from narrow at the
// bottom to wide at the bottom. The rhythm comes back; the chord has turned round. A last head,
// alone, ends it. The dynamics stay at p; a voice that has just moved plays that onset mp.
// Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, divisi, gridOf, note, part, scoreOf, TICKS, type Player } from "../../common.ts";
import { apply, steps, tones, waves } from "../../trade.ts";

export const knobs = {
  time: betweenSet({
    group: "Cycle",
    label: "Time betweens",
    help: "The six time betweens stacked on the head, in atoms of the family; they start short first. Voice k sounds after the first k of them, the next head after all six. They keep their sizes; only their order changes, so the period never does",
    value: "1 2 3 6 7 8",
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Cycle",
    label: "Family",
    help: "The atom the time betweens count in",
    value: FAMILY_OPTIONS[2]!,
    options: FAMILY_OPTIONS,
  }),
  chord: betweenSet({
    group: "Chord",
    label: "Pitch betweens",
    help: "The five pitch betweens stacked on the standpoint (semitones, .5 for a quarter tone), narrow at the bottom to start: one tone for each onset of the cycle. In the second half they trade places too, until the chord is wide at the bottom",
    value: "0.5 2 5.5 6 7.5",
    min: 0,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  anchor: pitch({
    group: "Chord",
    label: "Standpoint",
    help: "The head's pitch, the lowest voice. It never moves, in time or in pitch; the harp is tuned to its grid",
    value: "D3",
    min: "E2",
    max: "C4",
    step: 0.5,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 84,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

const wind = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  range: [number, number],
): Player => ({ id, instrument, name, abbreviation, range, grids: [0, 1] });

// One wind for each voice, from the bottom (voice 0, the head) up.
const WINDS: Player[] = [
  wind("bsn", "bassoon", "Bassoon", "Bsn.", [34, 75]),
  wind("bcl", "bass-clarinet", "Bass Clarinet", "B. Cl.", [34, 77]),
  wind("hn", "horn", "Horn", "Hn.", [34, 77]),
  wind("cl", "clarinet", "Clarinet", "Cl.", [50, 94]),
  wind("ob", "oboe", "Oboe", "Ob.", [58, 93]),
  wind("fl", "flute", "Flute", "Fl.", [59, 98]),
];
// Score order, top down.
const WIND_ORDER = ["fl", "ob", "cl", "bcl", "bsn", "hn"];

/** Levels: a voice holding its place, one that has just moved, the last head, the strings. */
const P = 3;
const MP = 4;
const PP = 2;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Where each voice sounds after the head, in atoms: the time betweens below it, added. */
const offsetsOf = (time: number[]) => tones(0, time.slice(0, -1));

interface Cycle {
  /** Onsets after the head, in atoms, voice 0 (the head) first. */
  offsets: number[];
  /** Pitches, voice 0 first. */
  pitches: number[];
}

export function score(v: Values<typeof knobs>) {
  const voices = WINDS.length;
  if (v.time.length !== voices)
    throw new Error(
      `Time betweens: give six (one onset for each of the six winds); there are ${v.time.length}`,
    );
  if (v.chord.length !== voices - 1)
    throw new Error(
      `Pitch betweens: give five (a chord of six tones, one for each onset); there are ${v.chord.length}`,
    );
  const atom = atomOf(familyOf(v.family));
  let time = [...v.time].sort((a, b) => a - b);
  let chord = [...v.chord].sort((a, b) => a - b);
  const period = sum(time) * atom;

  // The cycles, one after another.
  const cycles: Cycle[] = [];
  const keep = () => cycles.push({ offsets: offsetsOf(time), pitches: tones(v.anchor, chord) });
  keep();
  keep();
  // Out: the wide time betweens travel to the head, one trade a cycle.
  for (const trade of waves(time, true)) {
    time = apply(time, trade);
    keep();
  }
  // The strings enter; nothing trades.
  const enter = cycles.length;
  keep();
  // Back: the time betweens in steps; in the same cycles the pitch betweens, in steps.
  const back = steps(time, false);
  const turn = steps(chord, true);
  for (let i = 0; i < Math.max(back.length, turn.length); i++) {
    if (back[i]) time = apply(time, back[i]!);
    if (turn[i]) chord = apply(chord, turn[i]!);
    keep();
  }
  keep();
  keep();
  // The last head, alone.
  const last = cycles.length * period;
  const bar = 4 * TICKS;
  const bars = Math.ceil((last + TICKS) / bar);

  const onset = (i: number, k: number) => i * period + cycles[i]!.offsets[k]! * atom;
  const moved = (i: number, k: number) =>
    i > 0 &&
    (cycles[i]!.offsets[k] !== cycles[i - 1]!.offsets[k] ||
      cycles[i]!.pitches[k] !== cycles[i - 1]!.pitches[k]);

  // Winds: one staccato onset per cycle each; the head's wind plays the last head too.
  const windParts = WINDS.map((w, k) => {
    const events = cycles.map((c, i) =>
      note(onset(i, k), atom, c.pitches[k]!, { articulations: ["staccato"] }),
    );
    const levels = cycles.map((_, i) => ({ at: onset(i, k), level: moved(i, k) ? MP : P }));
    if (k === 0) {
      events.push(note(last, atom, v.anchor, { articulations: ["staccato"] }));
      levels.push({ at: last, level: PP });
    }
    // A mark only where the level changes.
    const points = levels.filter((x, i) => i === 0 || x.level !== levels[i - 1]!.level);
    return part(w, events, curve(points));
  });

  // The head's doubles: harp (on the standpoint's grid) and contrabasses pizz. an octave below.
  const heads = [...cycles.map((_, i) => i * period), last];
  const headPoints = [
    { at: 0, level: P },
    { at: last, level: PP },
  ];
  const lowered = gridOf(v.anchor) === 1;
  const harp = part(
    {
      id: "hp",
      instrument: "harp",
      name: lowered ? "Harp (tuned ¼ tone low)" : "Harp",
      abbreviation: "Hp.",
      range: [v.anchor, v.anchor],
      grids: [gridOf(v.anchor)],
    },
    heads.map((at) => note(at, atom, v.anchor)),
    curve(headPoints),
  );
  const basses = part(
    {
      id: "cb",
      instrument: "basses",
      name: "Contrabasses",
      abbreviation: "Cb.",
      players: 8,
      range: [v.anchor - 12, v.anchor - 12],
      grids: [0, 1],
    },
    heads.map((at) => note(at, atom, v.anchor - 12, { technique: "pizz" })),
    curve(headPoints),
  );

  // Strings, from the cycle they enter: each part holds its voice's tone from the voice's onset to
  // its next (a new bow at every onset), the last ones to the last head.
  const held = cycles.slice(enter);
  const ranges = Array.from({ length: voices }, (_, k): [number, number] => [
    Math.min(...held.map((c) => c.pitches[k]!)),
    Math.max(...held.map((c) => c.pitches[k]!)),
  ]);
  const players = divisi(ranges);
  const stringParts = players.map((p, k) => {
    const events = held.map((c, j) => {
      const i = enter + j;
      const from = onset(i, k);
      const to = i + 1 < cycles.length ? onset(i + 1, k) : last;
      return note(from, to - from, c.pitches[k]!, { technique: "con-sord" });
    });
    return part(
      p,
      events,
      curve([
        { at: onset(enter, k), level: PP },
        { at: onset(enter + 1, k), level: P },
      ]),
    );
  });

  const byOrder = WIND_ORDER.map((id) => windParts[WINDS.findIndex((w) => w.id === id)]!);
  const out = scoreOf("antara · palette B · the betweens trade places in time", bars, v.tempo, [
    ...byOrder,
    harp,
    ...stringParts.reverse(),
    basses,
  ]);
  // Marks at the bars the strings' first head and the first trade back fall in.
  const strings = Math.floor((enter * period) / bar) + 1;
  const backAt = Math.floor(((enter + 1) * period) / bar) + 1;
  out.rehearsal = [
    { measure: strings, label: "strings" },
    ...(backAt > strings ? [{ measure: backAt, label: "back" }] : []),
  ];
  return out;
}

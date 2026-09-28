// antara palette, B: the cuts fall from pitch to time.
//
// Uses two sketches of "the vertical line and the horizontal line" (../../../ideas/lines):
// "the betweens narrow" (b-narrowing: at every stage every between is one quarter tone narrower,
// until it is 0) and "the time between opens from 0" (a-zero-opens: the time betweens inside one
// strike open from 0, one atom at a time). Here the two are one step.
//
// Two neighbouring voices have two betweens: a pitch between and a time between (from one's onset
// to the other's). A vertical line is a run whose time betweens are 0 (a chord); a horizontal line
// is a run whose pitch betweens are 0 (one pitch). Each neighbour pair keeps one size, q quarter
// tones, and holds it on the two axes at once: at stage j its pitch between is (q − j) quarter
// tones (never below 0) and its time between is min(j, q) atoms. From one stage to the next every
// pair not yet flat gives one quarter tone of pitch and takes one atom of time: the step of "the
// betweens narrow" and the step of "the time between opens" at once, in the same pair. The cut is
// never lost; only the axis it is measured on changes. In every strike the pitch betweens (in
// quarter tones) and the time betweens (in atoms) add up to the same total.
//
// Ten winds and brass, one voice each, strike once per stage; the lowest voice is the standpoint
// and never moves. Stage 0 is a chord struck at once. The narrowest cut turns flat first (its two
// voices on one pitch, one after the other), then the next, until the widest has turned: the last
// strike is one pitch handed from the bottom player to the top one, the waits between them the
// sizes of the cuts. Where the chord starts, the order the cuts fall in, and where it ends are set
// by the sizes alone. Each voice is doubled by a divided string part, con sord., holding with it.
// Dynamics are constant: winds p, strings pp. Card: README.md.

import { instrument } from "../../../../../src/instruments/catalog.ts";
import {
  choice,
  number,
  numbersOf,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, divisi, note, part, scoreOf, TICKS, type Player } from "../../common.ts";

const player = (id: string, kind: string, name: string, abbreviation: string): Player => ({
  id,
  instrument: kind,
  name,
  abbreviation,
  range: instrument(kind).range!,
  grids: [0, 1],
});

// One player per voice, bottom to top. Each reaches from the standpoint up to its tone of the first
// chord; neighbours are woodwind and brass in turn as far as the ranges allow.
const VOICES: Player[] = [
  player("bsn", "bassoon", "Bassoon", "Bsn."),
  player("tbn", "trombone", "Trombone", "Tbn."),
  player("hn2", "horn", "Horn 2", "Hn. 2"),
  player("bcl", "bass-clarinet", "Bass Clarinet", "B. Cl."),
  player("hn1", "horn", "Horn 1", "Hn. 1"),
  player("ci", "cor-anglais", "Cor anglais", "C. ingl."),
  player("tpt", "trumpet", "Trumpet", "Tpt."),
  player("cl", "clarinet", "Clarinet", "Cl."),
  player("ob", "oboe", "Oboe", "Ob."),
  player("fl", "flute", "Flute", "Fl."),
];
// Score order, top down.
const SCORE_ORDER = ["fl", "ob", "ci", "cl", "bcl", "bsn", "hn1", "hn2", "tpt", "tbn"];

const P = 3;
const PP = 2;

export const knobs = {
  sizes: text({
    group: "Cuts",
    label: "Sizes",
    help: "The size of each cut between neighbouring voices, bottom to top, in the order written (semitones, .5 for a quarter tone; nine, for ten voices). At the first strike they are all pitch betweens; at each strike every cut not yet flat gives one quarter tone of pitch to one atom of time. A cut of q quarter tones turns flat at strike q + 1; the sketch ends with the strike in which the widest has turned. The order is what the chord holds, so this reads the numbers as written",
    value: "4.5 0.5 4 1 3.5 1.5 3 2 2.5",
  }),
  start: pitch({
    group: "Cuts",
    label: "Standpoint",
    help: "The lowest voice's pitch, which never moves, and the one pitch the last strike hands from player to player. All ten players must reach it: their shared range is B3 to C5",
    value: 65.5,
    min: "B3",
    max: "C5",
    step: 0.5,
  }),
  gap: number({
    group: "Time",
    label: "Gap",
    help: "Atoms added to the sum of the sizes (in quarter tones) to make the strike period: the next strike comes this many atoms after the latest a last onset can fall",
    value: 5,
    min: 1,
    max: 40,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time betweens and the period count in",
    value: FAMILY_OPTIONS[2]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 72,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

interface Tone {
  at: number;
  midi: number;
}

export function score(v: Values<typeof knobs>) {
  const sizes = numbersOf("Sizes", v.sizes.replaceAll("−", "-"));
  if (sizes.length !== VOICES.length - 1)
    throw new Error(
      `Sizes: give ${VOICES.length - 1} (one cut between each two of the ${VOICES.length} voices); there are ${sizes.length}`,
    );
  if (sizes.some((b) => b < 0.5 || !Number.isInteger(b * 2)))
    throw new Error("Sizes: each is 0.5 or more, on the quarter-tone grid (4.5, 0.5, 4)");

  const atom = atomOf(familyOf(v.family));
  // Each cut in quarter tones: that many steps until it is flat.
  const q = sizes.map((b) => Math.round(b * 2));
  const total = q.reduce((a, b) => a + b, 0);
  const period = (total + v.gap) * atom;
  const stages = Math.max(...q) + 1;

  // strikes[j][k]: voice k in the strike of stage j.
  const strikes: Tone[][] = [];
  for (let j = 0; j < stages; j++) {
    let at = j * period;
    let midi = v.start;
    const strike: Tone[] = [{ at, midi }];
    q.forEach((n) => {
      midi += Math.max(0, n - j) / 2;
      at += Math.min(j, n) * atom;
      strike.push({ at, midi });
    });
    strikes.push(strike);
  }
  const end = stages * period;

  // Each voice holds from its onset to the next head (the last strike, to one period after its
  // head).
  const heldTo = (j: number) => (j + 1) * period;
  const lines = VOICES.map((_, k) => strikes.map((s, j) => ({ ...s[k]!, stop: heldTo(j) })));
  lines.forEach((xs, k) => {
    const lo = Math.min(...xs.map((x) => x.midi));
    const hi = Math.max(...xs.map((x) => x.midi));
    const [a, b] = VOICES[k]!.range;
    if (lo < a || hi > b)
      throw new Error(
        `Sizes / Standpoint: the ${VOICES[k]!.name} (voice ${k + 1} from the bottom) goes from ${lo} to ${hi}, outside its range ${a}–${b}`,
      );
  });

  const winds = VOICES.map((p, k) =>
    part(
      p,
      lines[k]!.map((x) => note(x.at, x.stop - x.at, x.midi)),
      curve([{ at: 0, level: P }]),
    ),
  );
  const ranges = lines.map((xs): [number, number] => [
    Math.min(...xs.map((x) => x.midi)),
    Math.max(...xs.map((x) => x.midi)),
  ]);
  const strings = divisi(ranges).map((p, k) =>
    part(
      p,
      lines[k]!.map((x) => note(x.at, x.stop - x.at, x.midi, { technique: "con-sord" })),
      curve([{ at: 0, level: PP }]),
    ),
  );

  const bar = 4 * TICKS;
  const byOrder = SCORE_ORDER.map((id) => winds[VOICES.findIndex((p) => p.id === id)]!);
  return scoreOf(
    "antara · palette B · the cuts fall from pitch to time",
    Math.ceil(end / bar),
    v.tempo,
    [...byOrder, ...strings.reverse()],
  );
}

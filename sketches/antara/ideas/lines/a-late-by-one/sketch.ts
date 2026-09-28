// antara, the vertical and the horizontal line, A (time): late by one atom.
//
// Ten plucked and struck instruments each hold one tone of a chord and strike it again and again,
// each with a single between (a pulse). The betweens differ by one atom: the lowest tone's is the
// shortest, each higher tone's one atom longer. Nobody changes anything, yet the differences add
// up: struck together at first, the chord rolls, the roll widens, and the tones come one after
// another, low to high, until the chord has become a line in time.
//
// The chord is the Chord set's betweens stacked on the anchor. Its tones go to instruments that can
// sound their grid: glockenspiel, vibraphone, marimba, harp I and celesta hold the usual grid; harp
// II and the piano are tuned a quarter tone low and hold the other; the pizzicato strings take
// either. Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { A_CHORD, assign, note, part, scoreOf, stack, TICKS, type Player } from "../common.ts";

export const knobs = {
  chord: betweenSet({
    group: "Chord",
    label: "Chord",
    help: "The betweens the chord is stacked from, bottom up, again and again (semitones, .5 for a quarter tone)",
    value: A_CHORD,
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  anchor: pitch({
    group: "Chord",
    label: "Anchor",
    help: "The bottom of the stack",
    value: "C3",
    min: "C2",
    max: "C5",
    step: 0.5,
  }),
  period: number({
    group: "Time",
    label: "Between",
    help: "The lowest tone's between, in atoms; each higher tone's is one atom longer",
    value: 40,
    min: 10,
    max: 80,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom: how much later each tone falls behind the one below it, every time round",
    value: FAMILY_OPTIONS[2]!,
    options: FAMILY_OPTIONS,
  }),
  bars: number({
    group: "Form",
    label: "Bars",
    help: "Length in bars of 4/4",
    value: 10,
    min: 2,
    max: 40,
    step: 1,
    unit: "bars",
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 72,
    min: 40,
    max: 140,
    step: 2,
    unit: "bpm",
  }),
};

const PLAYERS: Player[] = [
  { id: "glk", instrument: "glockenspiel", range: [79, 103], grids: [0] },
  { id: "vib", instrument: "vibraphone", range: [53, 89], grids: [0] },
  { id: "mar", instrument: "marimba", range: [45, 84], grids: [0] },
  {
    id: "hp1",
    instrument: "harp",
    name: "Harp I",
    abbreviation: "Hp. I",
    range: [43, 91],
    grids: [0],
  },
  {
    id: "hp2",
    instrument: "harp",
    name: "Harp II (tuned ¼ tone low)",
    abbreviation: "Hp. II",
    range: [43, 91],
    grids: [1],
  },
  { id: "cel", instrument: "celesta", range: [72, 100], grids: [0] },
  {
    id: "pno",
    instrument: "piano",
    name: "Piano (tuned ¼ tone low)",
    abbreviation: "Pno.",
    range: [48, 96],
    grids: [1],
  },
  { id: "vn", instrument: "violins-1", range: [67, 88], grids: [0, 1], technique: "pizz" },
  { id: "va", instrument: "violas", range: [55, 74], grids: [0, 1], technique: "pizz" },
  { id: "vc", instrument: "cellos", range: [40, 60], grids: [0, 1], technique: "pizz" },
];

export function score(v: Values<typeof knobs>) {
  const end = v.bars * 4 * TICKS;
  const atom = atomOf(familyOf(v.family));
  const tones = assign(stack(v.anchor, v.chord, PLAYERS.length), PLAYERS);
  // Low to high: the rank decides how much longer each one's between is.
  const rank = PLAYERS.map((_, i) => i)
    .filter((i) => tones[i] !== undefined)
    .sort((a, b) => tones[a]! - tones[b]!);
  const parts = PLAYERS.map((p, i) => {
    const r = rank.indexOf(i);
    const midi = tones[i];
    const events = [];
    if (midi !== undefined && r >= 0) {
      const between = (v.period + r) * atom;
      for (let t = 0; t < end; t += between)
        events.push(
          note(t, Math.min(2 * atom, end - t), midi, p.technique ? { technique: p.technique } : {}),
        );
    }
    return part(p, events, [{ at: 0, level: 4 }]);
  });
  return scoreOf("antara · A · late by one atom", v.bars, v.tempo, parts);
}

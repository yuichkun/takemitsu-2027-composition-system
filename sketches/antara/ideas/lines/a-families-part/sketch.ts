// antara, the vertical and the horizontal line, A (time): the families come apart.
//
// Ten voices strike a chord on every beat, together, but each counts the beat in its own family: a
// voice of the 5 family counts 5 atoms (quintuplet 16ths), of the 3 family 3 (triplet 8ths), of the
// 2 family 4 (16ths). The beat is where the families meet, so at first the families cannot be
// heard. Then, one voice after another, each moves its between by one atom (one voice one atom
// longer, the next one atom shorter, and so on). From then on it keeps its own speed on its own
// family's grid, and all voices meet only where the grids meet, less and less often. The chord
// comes back only at those meetings, and the voices are left as lines of different speeds.
//
// The chord is the Chord set's betweens stacked on the anchor. Pizzicato strings take either grid;
// harp I, marimba and vibraphone hold the usual one; harp II is tuned a quarter tone low and holds
// the other. Card: README.md.

import { betweenSet, number, pitch, text, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familiesOf, type Family } from "../../../between.ts";
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
  families: text({
    group: "Time",
    label: "Families",
    help: "The family each voice counts in, from the top voice down, again and again (2: 16ths, 3: triplet 8ths, 5: quintuplet 16ths)",
    value: "5 3 2",
  }),
  leave: number({
    group: "Time",
    label: "Leave every",
    help: "Beats between one voice moving its between and the next (the first moves after one bar)",
    value: 3,
    min: 1,
    max: 8,
    step: 1,
    unit: "beats",
  }),
  after: number({
    group: "Form",
    label: "Then",
    help: "Bars after the last voice has moved",
    value: 3,
    min: 0,
    max: 12,
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

// Top down, in score order.
const PLAYERS: Player[] = [
  {
    id: "hp1",
    instrument: "harp",
    name: "Harp I",
    abbreviation: "Hp. I",
    range: [55, 91],
    grids: [0],
  },
  {
    id: "hp2",
    instrument: "harp",
    name: "Harp II (tuned ¼ tone low)",
    abbreviation: "Hp. II",
    range: [55, 91],
    grids: [1],
  },
  { id: "vib", instrument: "vibraphone", range: [53, 89], grids: [0] },
  { id: "mar", instrument: "marimba", range: [45, 84], grids: [0] },
  {
    id: "vn1",
    instrument: "violins-1",
    name: "Violins I",
    range: [67, 91],
    grids: [0, 1],
    technique: "pizz",
  },
  {
    id: "vn2a",
    instrument: "violins-2",
    name: "Violins II 1",
    abbreviation: "Vn. II 1",
    players: 7,
    range: [62, 84],
    grids: [0, 1],
    technique: "pizz",
  },
  {
    id: "vn2b",
    instrument: "violins-2",
    name: "Violins II 2",
    abbreviation: "Vn. II 2",
    players: 7,
    range: [57, 79],
    grids: [0, 1],
    technique: "pizz",
  },
  { id: "va", instrument: "violas", range: [50, 74], grids: [0, 1], technique: "pizz" },
  { id: "vc", instrument: "cellos", range: [40, 62], grids: [0, 1], technique: "pizz" },
  { id: "cb", instrument: "basses", range: [31, 50], grids: [0, 1], technique: "pizz" },
];

/** How many atoms make one beat in each family. */
const PER_BEAT: Record<Family, number> = { 2: 4, 3: 3, 5: 5 };

export function score(v: Values<typeof knobs>) {
  const families = familiesOf("Families", v.families);
  const tones = assign(stack(v.anchor, v.chord, PLAYERS.length), PLAYERS);
  const first = 4; // beats of all together before the first voice moves
  const lastMove = first + (PLAYERS.length - 1) * v.leave;
  const bars = Math.ceil(lastMove / 4) + v.after;
  const end = bars * 4 * TICKS;
  const parts = PLAYERS.map((p, i) => {
    const family = families[i % families.length]!;
    const atom = atomOf(family);
    // Voices move in turn, from the top; one longer, the next shorter, and so on.
    const moveAt = (first + i * v.leave) * TICKS;
    const moved = (PER_BEAT[family] + (i % 2 === 0 ? 1 : -1)) * atom;
    const midi = tones[i];
    const events = [];
    if (midi !== undefined)
      for (let t = 0; t < end; t += t < moveAt ? TICKS : moved)
        events.push(
          note(t, Math.min(atom, end - t), midi, p.technique ? { technique: p.technique } : {}),
        );
    return part(p, events, [{ at: 0, level: 4 }]);
  });
  return scoreOf("antara · A · the families come apart", bars, v.tempo, parts);
}

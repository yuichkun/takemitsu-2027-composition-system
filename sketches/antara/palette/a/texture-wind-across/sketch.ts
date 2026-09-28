// antara palette, A (texture): the wind across the chord.
//
// A chord is its betweens stacked on a standpoint, bottom up, in the order written; each tone is
// held by one brass player. One glissando in the cellos (the wind) sweeps at one constant rate, one
// quarter tone per atom, from just below the chord to just above it, turns at once and sweeps back.
//
// The only rule: a brass tone begins at the moment the sweep reaches its pitch going up, and ends at
// the moment the sweep reaches it again going down. Nothing else sets time; there is no set of time
// betweens. The wait between two entries is the pitch between of the two tones, counted in quarter
// tones, read as that many atoms: the same set heard on both axes. A pitch between with .5 becomes
// an odd number of atoms, one without an even number. On the way down the chord comes apart from
// the top, the same waits in the reverse order.
//
// Each pass counts in one family and starts on a bar line (the Passes knob, "5 | 3"). Only the atom
// differs from pass to pass, so a later pass is the same waits stretched (or squeezed) by the ratio
// of the atoms. Card: README.md.

import { number, numbersOf, pitch, text, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familiesOf } from "../../../between.ts";
import {
  curve,
  inOrder,
  note,
  numberFromTop,
  part,
  scoreOf,
  TICKS,
  type Player,
} from "../../common.ts";

const brass = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  range: [number, number],
): Player => ({ id, instrument, name, abbreviation, range, grids: [0, 1] });

// Low to high: the chord's tones take them in this order, one tone each.
const BRASS: Player[] = [
  brass("tbn2", "trombone", "Trombone 2", "Tbn. 2", [40, 72]),
  brass("tbn1", "trombone", "Trombone 1", "Tbn. 1", [40, 72]),
  brass("hn4", "horn", "Horn 4", "Hn. 4", [34, 77]),
  brass("hn3", "horn", "Horn 3", "Hn. 3", [34, 77]),
  brass("hn2", "horn", "Horn 2", "Hn. 2", [34, 77]),
  brass("hn1", "horn", "Horn 1", "Hn. 1", [34, 77]),
  brass("tpt2", "trumpet", "Trumpet 2", "Tpt. 2", [54, 84]),
  brass("tpt1", "trumpet", "Trumpet 1", "Tpt. 1", [54, 84]),
];
const SCORE_ORDER = ["horn", "trumpet", "trombone"];
const CELLOS: Player = {
  id: "vc",
  instrument: "cellos",
  name: "Violoncellos",
  abbreviation: "Vc.",
  players: 10,
  range: [36, 84],
  grids: [0, 1],
};

export const knobs = {
  chord: text({
    group: "Chord",
    label: "Chord",
    help: "The betweens of the chord, bottom up in the order written (semitones, .5 for a quarter tone). Each one is also a wait: twice its size in atoms between two entries",
    value: "3 2 5.5 1 4.5 2.5 3.5",
  }),
  anchor: pitch({
    group: "Chord",
    label: "Standpoint",
    help: "The lowest tone of the chord. The waits do not depend on it. The range is the standpoints that keep every tone in its player's range and the sweep in the cellos' range; the default is its middle",
    value: 50.5,
    min: 40,
    max: 61,
    step: 0.5,
  }),
  passes: text({
    group: "Sweep",
    label: "Passes",
    help: "One sweep up and back per family written, each from a bar line (2: 16ths, 3: triplet 8ths, 5: quintuplet 16ths). The sweep moves one quarter tone per atom of its pass's family",
    value: "5 | 3",
  }),
  overshoot: number({
    group: "Sweep",
    label: "Overshoot",
    help: "How far the sweep goes past the lowest and the highest tone before it turns",
    value: 1,
    min: 1,
    max: 8,
    step: 1,
    unit: "quarter tones",
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 56,
    min: 30,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

export function score(v: Values<typeof knobs>) {
  const chord = numbersOf("Chord", v.chord.replaceAll("−", "-"));
  if (chord.some((b) => !Number.isInteger(b * 2) || b < 0.5))
    throw new Error("Chord: betweens are 0.5 or more, on the quarter-tone grid (3, 5.5, 1)");
  if (chord.length + 1 > BRASS.length)
    throw new Error(`Chord: at most ${BRASS.length - 1} betweens (one brass player per tone)`);
  const families = familiesOf("Passes", v.passes);

  const tones = [v.anchor];
  for (const b of chord) tones.push(tones.at(-1)! + b);
  const reach = v.overshoot / 2;
  const bottom = tones[0]! - reach;
  const top = tones.at(-1)! + reach;
  if (bottom < CELLOS.range[0] || top > CELLOS.range[1])
    throw new Error(`Standpoint: the sweep (${bottom} to ${top}) leaves the cellos' range`);
  // One quarter tone per atom: a way up (or down) is this many atoms.
  const span = Math.round((top - bottom) * 2);
  const at = (x: number) => Math.round((x - bottom) * 2);

  // Passes, each from a bar line: the way up, the way back, one atom on the lowest pitch.
  const bar = 4 * TICKS;
  let from = 0;
  const passes = families.map((family) => {
    const pass = { start: from, atom: atomOf(family) };
    from = Math.ceil((from + (2 * span + 1) * pass.atom) / bar) * bar;
    return pass;
  });
  const end = from + bar;

  // The wind.
  const sweep = passes.flatMap(({ start, atom }) => [
    note(start, span * atom, bottom, { gliss: true, technique: "sul-tasto" }),
    note(start + span * atom, span * atom, top, { gliss: true, technique: "sul-tasto" }),
    note(start + 2 * span * atom, atom, bottom, { technique: "sul-tasto" }),
  ]);
  const wind = part(CELLOS, sweep, curve([{ at: 0, level: 3 }]));

  // The chord: each tone from where the sweep reaches it going up to where it reaches it coming down;
  // pp, swelling to p at the turn and back to pp at the release.
  const players = numberFromTop(
    inOrder(
      tones.map((t): [number, number] => [t, t]),
      BRASS,
    ),
  );
  const brassParts = tones.map((x, k) => {
    const own = BRASS.find((b) => b.instrument === players[k]!.instrument)!.range;
    if (x < own[0] || x > own[1])
      throw new Error(`Standpoint: ${x} is outside the ${players[k]!.name}'s range`);
    const events = passes.map(({ start, atom }) => {
      const on = start + at(x) * atom;
      const off = start + (2 * span - at(x)) * atom;
      return note(on, off - on, x);
    });
    const points = passes.flatMap(({ start, atom }) => [
      { at: start + at(x) * atom, level: 2, ramp: true },
      { at: start + span * atom, level: 3, ramp: true },
      { at: start + (2 * span - at(x)) * atom, level: 2 },
    ]);
    return part(players[k]!, events, curve(points));
  });
  brassParts.sort(
    (a, b) =>
      SCORE_ORDER.indexOf(a.instrument) - SCORE_ORDER.indexOf(b.instrument) ||
      a.id.localeCompare(b.id),
  );

  return scoreOf("antara · palette A · the wind across the chord", end / bar, v.tempo, [
    ...brassParts,
    wind,
  ]);
}

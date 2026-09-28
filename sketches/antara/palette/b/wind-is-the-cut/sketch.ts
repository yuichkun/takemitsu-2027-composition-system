// antara palette, B: the wind is the cut.
//
// Uses the A sketch "the wind across the chord" (../../a/texture-wind-across): one glissando in the
// cellos (the wind) slides at one constant rate, one quarter tone per atom, and a held tone begins
// or ends at the very moment the wind reaches its pitch. Nothing else sets time: the wait between
// two events is the pitch between of their two tones, counted in quarter tones, read as that many
// atoms.
//
// Here the wind is the way from one chord to the next. Every chord is the same set of betweens
// stacked on the same standpoint, read in the order written but starting one place later for each
// chord (the rule "shift each time"), so every chord has the same lowest and highest tone (the
// frame). In one pass the wind crosses the chord once: a tone of the old chord stops at the moment
// the wind reaches it, and a tone of the new chord begins at the moment the wind reaches it; a
// pitch in both (the frame) is handed from the old player to the new at that one instant. While the
// wind is passing, the side it has crossed holds only the new chord and the side it has not reached
// holds only the old one: the height of the wind is the cut between the two chords. The waits are
// the betweens of the two chords merged into one row of pitches.
//
// Brass and woodwinds take the chords in turn, one tone per player, so the cut is also a cut of
// colour. The passes go up and down in turn: the first builds the first chord from nothing, the
// last takes the last chord into nothing, and each one between changes chord. Each pass counts in
// one family (the Passes knob) and starts on the first bar line after the previous one ends; until
// then the complete chord holds alone and the cellos are silent. The wind stays sul tasto, p, with
// no swell; the chords stay pp. Card: README.md.

import { instrument } from "../../../../../src/instruments/catalog.ts";
import { number, numbersOf, pitch, text, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, familiesOf } from "../../../between.ts";
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
import { tones } from "../../trade.ts";

const player = (id: string, kind: string, name: string, abbreviation: string): Player => ({
  id,
  instrument: kind,
  name,
  abbreviation,
  range: instrument(kind).range!,
  grids: [0, 1],
});

// Each choir low to high: a chord's tones take its players in this order, one tone each.
const BRASS: Player[] = [
  player("tbn3", "trombone", "Trombone 3", "Tbn. 3"),
  player("tbn2", "trombone", "Trombone 2", "Tbn. 2"),
  player("tbn1", "trombone", "Trombone 1", "Tbn. 1"),
  player("hn4", "horn", "Horn 4", "Hn. 4"),
  player("hn3", "horn", "Horn 3", "Hn. 3"),
  player("hn2", "horn", "Horn 2", "Hn. 2"),
  player("hn1", "horn", "Horn 1", "Hn. 1"),
  player("tpt2", "trumpet", "Trumpet 2", "Tpt. 2"),
  player("tpt1", "trumpet", "Trumpet 1", "Tpt. 1"),
];
const WOODWINDS: Player[] = [
  player("bsn3", "bassoon", "Bassoon 3", "Bsn. 3"),
  player("bsn2", "bassoon", "Bassoon 2", "Bsn. 2"),
  player("bsn1", "bassoon", "Bassoon 1", "Bsn. 1"),
  player("cl2", "clarinet", "Clarinet 2", "Cl. 2"),
  player("cl1", "clarinet", "Clarinet 1", "Cl. 1"),
  player("ob2", "oboe", "Oboe 2", "Ob. 2"),
  player("ob1", "oboe", "Oboe 1", "Ob. 1"),
  player("fl2", "flute", "Flute 2", "Fl. 2"),
  player("fl1", "flute", "Flute 1", "Fl. 1"),
];
/** Chord k is played by CHOIRS[k % 2]. */
const CHOIRS = [BRASS, WOODWINDS];
const SCORE_ORDER = ["flute", "oboe", "clarinet", "bassoon", "horn", "trumpet", "trombone"];
const CELLOS: Player = {
  id: "vc",
  instrument: "cellos",
  name: "Violoncellos",
  abbreviation: "Vc.",
  players: 10,
  range: instrument("cellos").range!,
  grids: [0, 1],
};

export const knobs = {
  set: text({
    group: "Chords",
    label: "Set",
    help: "The betweens of every chord, in the order written (semitones, .5 for a quarter tone). Each chord reads them one place later than the one before (shift each time), so every chord has the same lowest and highest tone",
    value: "2 5 2.5 4 3 4.5 3.5 5.5",
  }),
  anchor: pitch({
    group: "Chords",
    label: "Standpoint",
    help: "The lowest tone of every chord. The waits do not depend on it. The range is the standpoints that keep every tone of the default set in its player's range and the wind in the cellos' range",
    value: 45,
    min: 40,
    max: 53.5,
    step: 0.5,
  }),
  passes: text({
    group: "Wind",
    label: "Passes",
    help: "One pass of the wind per family written (2: 16ths, 3: triplet 8ths, 5: quintuplet 16ths), up and down in turn, starting up. The first builds a chord from nothing, the last takes one into nothing, each pass between changes chord. The wind moves one quarter tone per atom of its pass's family",
    value: "5 | 3 | 2 | 5 | 3 | 2",
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 66,
    min: 30,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

interface Pass {
  start: number;
  atom: number;
  up: boolean;
  family: number;
}

export function score(v: Values<typeof knobs>) {
  const set = numbersOf("Set", v.set.replaceAll("−", "-"));
  if (set.some((b) => !Number.isInteger(b * 2) || b < 0.5))
    throw new Error("Set: betweens are 0.5 or more, on the quarter-tone grid (2, 5, 2.5)");
  if (set.length + 1 > BRASS.length)
    throw new Error(
      `Set: at most ${BRASS.length - 1} betweens (one player per tone in each choir)`,
    );
  const families = familiesOf("Passes", v.passes);
  if (families.length < 2)
    throw new Error("Passes: at least two (one builds a chord, one takes it into nothing)");

  // The chords, one fewer than the passes: the set read one place later each time, stacked.
  const draw = drawer(set, "shift each time", 1, "ascending");
  const chords = families.slice(1).map(() => tones(v.anchor, draw()));

  // The wind goes one quarter tone past the frame at each end.
  const bottom = v.anchor - 0.5;
  const top = chords[0]!.at(-1)! + 0.5;
  if (bottom < CELLOS.range[0] || top > CELLOS.range[1])
    throw new Error(`Standpoint: the wind (${bottom} to ${top}) leaves the cellos' range`);
  // One quarter tone per atom: a pass is this many atoms.
  const span = Math.round((top - bottom) * 2);

  // Each pass from the first bar line after the one before ends (its sweep and one atom at the far
  // end).
  const bar = 4 * TICKS;
  let from = 0;
  const passes: Pass[] = families.map((family, j) => {
    const pass = { start: from, atom: atomOf(family), up: j % 2 === 0, family };
    from = Math.ceil((from + (span + 1) * pass.atom) / bar) * bar;
    return pass;
  });
  const end = from;
  /** The moment the wind of a pass reaches a pitch, in ticks. */
  const reaches = (p: Pass, x: number) =>
    p.start + Math.round(Math.abs(x - (p.up ? bottom : top)) * 2) * p.atom;

  // The wind.
  const sweep = passes.flatMap((p) => [
    note(p.start, span * p.atom, p.up ? bottom : top, { gliss: true, technique: "sul-tasto" }),
    note(p.start + span * p.atom, p.atom, p.up ? top : bottom, { technique: "sul-tasto" }),
  ]);
  const wind = part(CELLOS, sweep, curve([{ at: 0, level: 3 }]));

  // The choirs: chord k begins, tone by tone, where pass k reaches each tone, and ends where pass
  // k + 1 reaches it. Brass and woodwinds take the chords in turn.
  const choirParts = CHOIRS.flatMap((pool, c) => {
    const mine = chords.map((chord, k) => ({ chord, k })).filter(({ k }) => k % 2 === c);
    if (mine.length === 0) return [];
    const ranges = mine[0]!.chord.map((_, i): [number, number] => [
      Math.min(...mine.map(({ chord }) => chord[i]!)),
      Math.max(...mine.map(({ chord }) => chord[i]!)),
    ]);
    const players = numberFromTop(inOrder(ranges, pool));
    return players.map((pl, i) => {
      const own = instrument(pl.instrument).range!;
      const events = mine.map(({ chord, k }) => {
        const x = chord[i]!;
        if (x < own[0] || x > own[1])
          throw new Error(`Standpoint: ${x} is outside the ${pl.name}'s range`);
        const on = reaches(passes[k]!, x);
        return note(on, reaches(passes[k + 1]!, x) - on, x);
      });
      return part(pl, events, curve([{ at: 0, level: 2 }]));
    });
  });
  choirParts.sort(
    (a, b) =>
      SCORE_ORDER.indexOf(a.instrument) - SCORE_ORDER.indexOf(b.instrument) ||
      a.id.localeCompare(b.id),
  );

  const out = scoreOf("antara · palette B · the wind is the cut", end / bar, v.tempo, [
    ...choirParts,
    wind,
  ]);
  out.rehearsal = passes.map((p) => ({
    measure: p.start / bar + 1,
    label: `${p.up ? "up" : "down"} ${p.family}`,
  }));
  return out;
}

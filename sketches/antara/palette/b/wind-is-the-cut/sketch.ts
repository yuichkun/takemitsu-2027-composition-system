// antara palette, B: the wind is the cut.
//
// Uses the A sketch "the wind across the chord" (../../a/texture-wind-across): one glissando in the
// cellos (the wind) slides at one constant rate, one quarter tone per atom, and a held tone begins
// or ends at the very moment the wind reaches its pitch. Nothing else sets the moments of the
// tones: the wait between two events is the pitch between of their two tones, counted in quarter
// tones, read as that many atoms.
//
// Here each pass of the wind lays a new chord over what is sounding. A sounding tone stops at the
// moment the wind reaches it, and a tone of the new chord begins at the moment the wind reaches it;
// a pitch in both is handed from the old player to the new at that one instant (within one choir it
// simply goes on). The height of the wind is the cut: the side it has crossed holds the new chord,
// the side it has not reached holds what was there.
//
// Every pass lasts the same time: the fewest whole beats in which a wind in the finest family of the
// Passes crosses its whole path (whole beats, because the next pass may change family only where
// the families' grids meet). A coarser family has fewer atoms in that time, so its wind stops inside
// the chord, and what lies beyond stays: the cut stands there, with two chords on its two sides,
// until a later pass crosses it. The family decides how far the cut goes, not only how fast.
//
// The chords: the set's betweens in the order written, all but one stacked on the standpoint, read
// one place later for each chord (shift each time); so each chord leaves out a different between
// and its top moves. The wind's path is the room of the whole set: from a quarter tone below the
// standpoint to a quarter tone above the standpoint plus the sum of all the betweens.
//
// Brass and woodwinds take the chords in turn, one tone per player. The passes go down and up in
// turn, starting down: the first builds from nothing while the wind falls, the last goes up and
// takes everything into nothing. The wind stays sul tasto, p; the chords stay pp. Card: README.md.

import { instrument } from "../../../../../src/instruments/catalog.ts";
import { number, numbersOf, pitch, text, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, familiesOf, type Family } from "../../../between.ts";
import { curve, note, part, scoreOf, TICKS, type Player } from "../../common.ts";
import { tones } from "../../trade.ts";

const player = (id: string, kind: string, name: string, abbreviation: string): Player => ({
  id,
  instrument: kind,
  name,
  abbreviation,
  range: instrument(kind).range!,
  grids: [0, 1],
});

// Each choir low to high. A tone takes a free player of its choir, keeping the choir's sounding
// tones in the players' order, as near as it can to the player its place in the chord points to.
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
const CHOIR_NAMES = ["brass", "woodwind"];
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
    help: "The betweens, in the order written (semitones, .5 for a quarter tone). Each chord stacks all but one of them on the standpoint, reading one place later than the chord before (shift each time), so each chord leaves out a different one and its top moves",
    value: "2 4.5 3 5 2.5 4 3.5 5.5",
  }),
  anchor: pitch({
    group: "Chords",
    label: "Standpoint",
    help: "The lowest tone of every chord. The waits do not depend on it. The range is the standpoints that keep every tone of the default set in its choir's players' ranges and the wind in the cellos' range",
    value: 45,
    min: 38.5,
    max: 53.5,
    step: 0.5,
  }),
  passes: text({
    group: "Wind",
    label: "Passes",
    help: "One pass of the wind per family written (2: 16ths, 3: triplet 8ths, 5: quintuplet 16ths), down and up in turn, starting down. Every pass lasts the time the finest family written needs to cross the whole path; a coarser family stops inside the chord. The first builds a chord from nothing, the last takes everything into nothing, each pass between lays a new chord",
    value: "2 | 3 | 5 | 2 | 3 | 5",
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

interface Held {
  pitch: number;
  choir: number;
  /** Its place in the chord that laid it, from the bottom. */
  rank: number;
  on: number;
}
interface Sounded extends Held {
  off: number;
}

export function score(v: Values<typeof knobs>) {
  const set = numbersOf("Set", v.set.replaceAll("−", "-"));
  if (set.some((b) => !Number.isInteger(b * 2) || b < 0.5))
    throw new Error("Set: betweens are 0.5 or more, on the quarter-tone grid (2, 5, 2.5)");
  if (set.length < 2) throw new Error("Set: at least two betweens (a chord stacks all but one)");
  if (set.length > BRASS.length)
    throw new Error(`Set: at most ${BRASS.length} betweens (one player per tone in each choir)`);
  const families = familiesOf("Passes", v.passes);
  if (families.length < 2)
    throw new Error("Passes: at least two (one builds a chord, one takes it into nothing)");

  // The chords, one fewer than the passes: the set read one place later each time, all but its
  // last between stacked.
  const draw = drawer(set, "shift each time", 1, "ascending");
  const chords = families.slice(1).map(() => tones(v.anchor, draw().slice(0, -1)));

  // The wind's path: the room of the whole set, a quarter tone past it at each end.
  const bottom = v.anchor - 0.5;
  const top = v.anchor + set.reduce((a, b) => a + b, 0) + 0.5;
  if (bottom < CELLOS.range[0] || top > CELLOS.range[1])
    throw new Error(`Standpoint: the wind (${bottom} to ${top}) leaves the cellos' range`);
  // One quarter tone per atom: the whole path is this many atoms.
  const path = Math.round((top - bottom) * 2);
  // Every pass lasts the fewest whole beats in which the finest family crosses the path and holds
  // its last pitch one atom.
  const perBeat = (family: Family) => TICKS / atomOf(family);
  const length = Math.ceil((path + 1) / Math.max(...families.map(perBeat))) * TICKS;

  // Each pass lays its chord (the last lays nothing) wherever its wind gets to.
  const sounding = new Map<number, Held>();
  const sounded: Sounded[] = [];
  const passes = families.map((family, j) => {
    const atom = atomOf(family);
    const up = j % 2 === 1;
    const start = j * length;
    const from = up ? bottom : top;
    // It moves until it has crossed the path, or until one atom before the pass ends.
    const move = Math.min(path, length / atom - 1);
    const chord = chords[j] ?? [];
    const choir = j % 2;
    const reach = (x: number) => Math.round(Math.abs(x - from) * 2);
    const crossed = [...new Set([...sounding.keys(), ...chord])]
      .filter((x) => reach(x) <= move)
      .sort((a, b) => reach(a) - reach(b));
    for (const x of crossed) {
      const at = start + reach(x) * atom;
      const old = sounding.get(x);
      const rank = chord.indexOf(x);
      // The same pitch in the same choir: it goes on.
      if (old && rank >= 0 && old.choir === choir) continue;
      if (old) {
        sounded.push({ ...old, off: at });
        sounding.delete(x);
      }
      if (rank >= 0) sounding.set(x, { pitch: x, choir, rank, on: at });
    }
    return { start, atom, up, family, from, move };
  });
  const end = families.length * length;
  for (const held of sounding.values()) sounded.push({ ...held, off: end });

  // The wind.
  const sweep = passes.flatMap((p) => {
    const to = p.from + ((p.up ? 1 : -1) * p.move) / 2;
    return [
      note(p.start, p.move * p.atom, p.from, { gliss: true, technique: "sul-tasto" }),
      note(p.start + p.move * p.atom, p.atom, to, { technique: "sul-tasto" }),
    ];
  });
  const wind = part(CELLOS, sweep, curve([{ at: 0, level: 3 }]));

  // The choirs.
  const choirParts = CHOIRS.flatMap((pool, c) => {
    const mine = sounded
      .filter((s) => s.choir === c)
      .sort((a, b) => a.on - b.on || a.pitch - b.pitch);
    const placed: { i: number; s: Sounded }[] = [];
    for (const s of mine) {
      const busy = new Set(placed.filter((q) => q.s.off > s.on).map((q) => q.i));
      const around = placed.filter((q) => q.s.off > s.on);
      const below = Math.max(-1, ...around.filter((q) => q.s.pitch < s.pitch).map((q) => q.i));
      const above = Math.min(
        pool.length,
        ...around.filter((q) => q.s.pitch > s.pitch).map((q) => q.i),
      );
      const free = pool
        .map((_, i) => i)
        .filter((i) => {
          const [lo, hi] = pool[i]!.range;
          return !busy.has(i) && s.pitch >= lo && s.pitch <= hi;
        });
      const kept = free.filter((i) => i > below && i < above);
      const choose = kept.length > 0 ? kept : free;
      if (choose.length === 0)
        throw new Error(`Standpoint: no free ${CHOIR_NAMES[c]} player can take ${s.pitch}`);
      const i = choose.reduce((a, b) => (Math.abs(b - s.rank) < Math.abs(a - s.rank) ? b : a));
      placed.push({ i, s });
    }
    return pool.flatMap((pl, i) => {
      const events = placed
        .filter((q) => q.i === i)
        .map((q) => note(q.s.on, q.s.off - q.s.on, q.s.pitch));
      return events.length > 0 ? [part(pl, events, curve([{ at: 0, level: 2 }]))] : [];
    });
  });
  choirParts.sort(
    (a, b) =>
      SCORE_ORDER.indexOf(a.instrument) - SCORE_ORDER.indexOf(b.instrument) ||
      a.id.localeCompare(b.id),
  );

  const bar = 4 * TICKS;
  const out = scoreOf("antara · palette B · the wind is the cut", Math.ceil(end / bar), v.tempo, [
    ...choirParts,
    wind,
  ]);
  out.rehearsal = passes.map((p) => {
    const beat = (p.start % bar) / TICKS + 1;
    return {
      measure: Math.floor(p.start / bar) + 1,
      label: `${p.up ? "up" : "down"} ${p.family}${beat > 1 ? ` · beat ${beat}` : ""}`,
    };
  });
  return out;
}

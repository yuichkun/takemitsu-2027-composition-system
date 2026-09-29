// antara palette, B: cuts that open from 0 and close to 0.
//
// Uses two A sketches, whose rules are copied here. "Half the chord moves"
// (../../a/pitch-half-moves): a chord of eight voices is every sum of a subset of three betweens
// (a, b, c) added to a standpoint s, so each between is a cut that splits the eight voices into the
// four that add it and the four that do not; when a between changes size, exactly its half moves, all
// by the same amount. "A chord whose leaves open and close" (../../a/texture-leaf-gates): each voice
// sounds (opens) for a number of atoms and rests (closes) for a number of atoms, again and again,
// counted in its own family, so how many voices sound is only where their cycles happen to stand.
//
// Pitch. Each between has three sizes: 0 and two signed sizes, the first the one nearer 0. A between
// of size 0 is a cut that does not divide: its two halves stand on the same pitches. The story of the
// set, one between at a time: the cuts open from 0 in the order a, b, c (1 pitch, then 2, 4, 8); then
// they change between their first and second sizes in the A's order (a b a c a b a c), which visits
// every combination once and comes back; then they close to 0 in the order c, b, a (8 pitches down
// to 1). Fifteen states, fourteen changes.
//
// Time. A change of the set is silent: nothing moves when it happens. A voice reads the set only as
// it opens, and holds the pitch the set gives it then for that whole opening. So a change reaches the
// four voices of its half one at a time, each at its own next opening, and at one moment different
// voices may be sounding different states. Every voice counts the same numbers (open, closed) in the
// family given by how many cuts it adds: one (s+a, s+b, s+c) family 2, two family 3, none or all
// three (s and s+a+b+c, which face each other across every cut) family 5. The voices of a family
// start spread evenly round the cycle. The changes are counted in family 3: the first comes after the
// shortest between of their set, then the set is drawn in turn, starting one later each time round.
// Every between is longer than the longest cycle (family 3), so every voice reads every state. The
// drawing repeats after three rounds, that is after the set's sum in beats; the default sum, 67, is a
// multiple neither of 4 (the bar) nor of 17 (the beats after which every voice's gate is back where
// it was), so no later change finds the voices where an earlier one did. After the last change each
// voice opens once more, on s, and does not open again.
//
// Colour. The eight voices are divided strings, arco, senza vib., pp, each part about a quarter of
// its section, so that every voice weighs about the same. A wind doubles an opening only when its
// pitch differs from that voice's previous opening (the voice arrives at a new pitch), for that
// opening only, p settling to pp: it marks which voices have moved, and when. s never changes pitch
// and has no wind. Card: README.md.

import type { Part, TextEvent } from "../../../../../src/score/types.ts";
import { instrument } from "../../../../../src/instruments/catalog.ts";
import { betweenSet, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, type Family } from "../../../between.ts";
import { curve, divisi, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

const cut = (label: string, help: string, value: string) =>
  betweenSet({
    group: "Cuts",
    label,
    help,
    value,
    min: -24,
    max: 24,
    step: 0.5,
    unit: "st",
    anchor: "anchor",
  });

export const knobs = {
  a: cut(
    "a",
    "The first between's two sizes besides 0 (semitones, .5 for a quarter tone, − for below the standpoint). It opens first, from 0 to the size nearer 0; it changes size most often (4 times); it closes last",
    "3 5.5",
  ),
  b: cut(
    "b",
    "The second between's two sizes besides 0. It opens second, changes size twice, and closes second",
    "-5.5 -8.5",
  ),
  c: cut(
    "c",
    "The third between's two sizes besides 0. It opens last, changes size twice, and closes first",
    "11 17.5",
  ),
  anchor: pitch({
    group: "Cuts",
    label: "Standpoint",
    help: "The voice that adds no between (s). It never moves",
    value: "Bb3",
    min: "C3",
    max: "C5",
    step: 0.5,
  }),
  open: number({
    group: "Gates",
    label: "Open",
    help: "How long a voice sounds each time it opens, in atoms of its own family (the same number for every voice). It reads the set only as it opens",
    value: 12,
    min: 1,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  closed: number({
    group: "Gates",
    label: "Closed",
    help: "How long a voice rests between openings, in atoms of its own family (the same number for every voice)",
    value: 5,
    min: 1,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  changes: betweenSet({
    group: "Changes",
    label: "Between changes",
    help: "The time from one change of the set to the next, in atoms of family 3 (triplet 8ths). The first change comes after the shortest; then the set is drawn in turn, starting one later each time round. Longer than Open + Closed, every voice reads every state",
    value: "20 22 25",
    min: 1,
    max: 60,
    step: 1,
    unit: "atoms",
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

const NAMES = ["a", "b", "c"];
/** The between that changes at each step between its first and second sizes (the A's order). */
const TOGGLE = [0, 1, 0, 2, 0, 1, 0, 2];
/** The family the changes of the set count in. */
const CLOCK: Family = 3;
const MASKS = [0, 1, 2, 3, 4, 5, 6, 7];

/** A voice's name from its subset (bit 0: a, bit 1: b, bit 2: c): "s", "s+a", "s+b+c", … */
const nameOf = (mask: number) => ["s", ...NAMES.filter((_, i) => mask & (1 << i))].join("+");
const cutsOf = (mask: number) => NAMES.filter((_, i) => mask & (1 << i)).length;
/** One cut added: family 2; two: family 3; none or all three: family 5. */
const familyOf = (mask: number): Family => ([5, 2, 3, 5] as const)[cutsOf(mask)]!;

const wind = (id: string, kind: string, n: number): Player => ({
  id,
  instrument: kind,
  name: `${instrument(kind).name} ${n}`,
  abbreviation: `${instrument(kind).abbreviation} ${n}`,
  range: instrument(kind).range!,
  grids: [0, 1],
});
/** The wind that doubles each voice's new pitches (none for s), by the range the voice covers. */
const WINDS: Record<number, Player> = {
  1: wind("ob1", "oboe", 1), // s+a
  4: wind("ob2", "oboe", 2), // s+c
  5: wind("cl1", "clarinet", 1), // s+a+c
  7: wind("cl2", "clarinet", 2), // s+a+b+c
  2: wind("bsn1", "bassoon", 1), // s+b
  3: wind("bsn2", "bassoon", 2), // s+a+b
  6: { ...wind("hn", "horn", 1), name: "Horn", abbreviation: "Hn." }, // s+b+c
};
const WIND_ORDER = ["oboe", "clarinet", "bassoon", "horn"];

const PP = 2;
const P = 3;

interface Opening {
  at: number;
  dur: number;
  midi: number;
}

export function score(v: Values<typeof knobs>) {
  const sizes = [v.a, v.b, v.c].map((xs, i) => {
    if (xs.length !== 2 || xs.includes(0))
      throw new Error(`${NAMES[i]}: write the between's two sizes besides 0 (e.g. 3 5.5)`);
    const [near, far] = [...xs].sort((p, q) => Math.abs(p) - Math.abs(q));
    return [0, near!, far!];
  });
  const bar = 4 * TICKS;
  const cycle = v.open + v.closed;

  // The story of the set: each state is the size (0, first, second) of a, b and c.
  const states: number[][] = [[0, 0, 0]];
  const move = (i: number, to: number) => {
    const s = [...states.at(-1)!];
    s[i] = to;
    states.push(s);
  };
  for (const i of [0, 1, 2]) move(i, 1);
  for (const i of TOGGLE) move(i, 3 - states.at(-1)![i]!);
  for (const i of [2, 1, 0]) move(i, 0);

  // When each state begins: the first change after the shortest between, then the set in turn.
  const clock = atomOf(CLOCK);
  const next = stream(v.changes, "shift each time", 1);
  const begins = [0];
  for (let k = 1; k < states.length; k++)
    begins.push(begins.at(-1)! + (k === 1 ? v.changes[0]! : next()) * clock);
  const lastChange = begins.at(-1)!;
  const stateAt = (t: number) => states[begins.findLastIndex((b) => b <= t)]!;
  const pitchOf = (mask: number, s: number[]) =>
    v.anchor + s.reduce((sum, k, i) => (mask & (1 << i) ? sum + sizes[i]![k]! : sum), 0);

  // Each voice's openings: offset + cycle·m atoms of its family, the voices of a family spread
  // evenly round the cycle. It reads the set as it opens; after the last change it opens once more.
  const openings = MASKS.map((mask): Opening[] => {
    const family = familyOf(mask);
    const atom = atomOf(family);
    const kin = MASKS.filter((m) => familyOf(m) === family);
    const offset = Math.ceil((kin.indexOf(mask) * cycle) / kin.length - 0.5);
    const out: Opening[] = [];
    for (let m = 0; ; m++) {
      const at = (offset + m * cycle) * atom;
      out.push({ at, dur: v.open * atom, midi: pitchOf(mask, stateAt(at)) });
      if (at >= lastChange) break;
    }
    return out;
  });
  const end = Math.max(...openings.flat().map((o) => o.at + o.dur));

  // Strings: the voices by the middle of the range each one covers, divided low to high; each part
  // about a quarter of its section.
  const ranges = openings.map((xs): [number, number] => [
    Math.min(...xs.map((x) => x.midi)),
    Math.max(...xs.map((x) => x.midi)),
  ]);
  const middle = (m: number) => ranges[m]![0] + ranges[m]![1];
  const byRegister = [...MASKS].sort((p, q) => middle(p) - middle(q) || p - q);
  const players = divisi(byRegister.map((m) => ranges[m]!)).map((p) => ({
    ...p,
    players: Math.min(p.players!, Math.ceil(instrument(p.instrument).sectionSize! / 4)),
  }));
  const strings = byRegister.map((mask, k) => {
    const p = players[k]!;
    const events = openings[mask]!.map((o) => note(o.at, o.dur, o.midi));
    const out = part({ ...p, name: `${p.name} · ${nameOf(mask)}` }, events, [{ at: 0, level: PP }]);
    const mark: TextEvent = { type: "text", at: events[0]!.at, text: "senza vib." };
    out.events.unshift(mark);
    return out;
  });

  // Winds: each opening at a new pitch, p settling to pp over a beat.
  const winds: Part[] = MASKS.filter((mask) => WINDS[mask])
    .map((mask) => {
      const xs = openings[mask]!;
      const fresh = xs.filter((o, i) => i > 0 && o.midi !== xs[i - 1]!.midi);
      const p: Player = {
        ...WINDS[mask]!,
        range: [Math.min(...fresh.map((n) => n.midi)), Math.max(...fresh.map((n) => n.midi))],
      };
      const events = fresh.map((n) => note(n.at, n.dur, n.midi));
      const dynamics = curve(
        fresh.flatMap((n) => [
          { at: n.at, level: P, ramp: true },
          { at: n.at + TICKS, level: PP },
        ]),
      );
      return part({ ...p, name: `${p.name} · ${nameOf(mask)}` }, events, dynamics);
    })
    .sort(
      (x, y) =>
        WIND_ORDER.indexOf(x.instrument) - WIND_ORDER.indexOf(y.instrument) ||
        x.id.localeCompare(y.id),
    );

  // Score order: the winds, then the strings high to low.
  return scoreOf(
    "antara · palette B · cuts that open from 0 and close to 0",
    Math.ceil(end / bar),
    v.tempo,
    [...winds, ...strings.reverse()],
  );
}

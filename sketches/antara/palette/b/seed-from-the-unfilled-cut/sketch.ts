// antara palette, B: the next chord starts from the cut the last one left unfilled.
//
// Uses the A sketch "a chord that grows like frost" (../../a/pitch-frost-freeze), whose rule is
// copied here: a chord grows from one pitch, the seed. Every sounding pitch is a standpoint; every
// sounding pitch plus every between of the growth set (signed, + above, − below) is a candidate if
// no term stands there yet: the undefined cuts. A candidate's shell is the fewest betweens of the
// set from the seed (the least shell of the chord's pitches that reach it, plus one). The candidate
// of the lowest shell freezes next (the one nearer the seed, then the lower, on a tie): it starts
// to sound and never moves.
//
// What is new is how one chord hands over to the next. Three groups of eight players (strings,
// woodwinds, brass) take the chords in turn. A chord stops growing when its group cannot hold one
// more pitch (eight players, each within its range), or when no candidate is left. The seed of the
// next chord is the cut the finished one would have filled next had it had room: among its
// leftover candidates the next group can hold, the one the same rule would choose. A pitch once
// frozen is defined for the whole piece and is never frozen again, so each chord grows around what
// the earlier ones have already defined, and its shape differs from theirs.
//
// Time: the wait before a pitch freezes is its shell, counted in beats (three atoms of family 3 per
// shell): the further a cut is from the standpoint, the longer it waits. A seed waits its shell in
// the chord that left it (its old name) and is shell 0 in the chord it begins (its new name), so
// after it the waits start again from one beat.
//
// The old chord leaves while the new one grows: at the new chord's k-th freeze (the seed is the
// first) the old chord's k-th pitch, in the order it froze, stops. If the new chord freezes fewer
// pitches, the rest of the old one leaves one per beat after its last freeze. The piece ends when a
// seed can freeze nothing more (every cut it reaches is defined, or out of its group's reach): the
// old chord leaves one per beat, and the last seed sounds alone for one beat.
//
// The dynamics are flat (strings pp, woodwinds and brass p), with no accents: only which cut is filled, when,
// and in which colour is heard.
// Card: README.md.

import type { Part } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf } from "../../../between.ts";
import { note, part, scoreOf, TICKS, time, type Player } from "../../common.ts";

interface Group {
  name: string;
  /** Low to high by the top of their ranges: the order the greedy check hands pitches in. */
  players: Player[];
  /** Constant dynamic level (2 = pp, 3 = p). */
  level: number;
}

const player = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  range: [number, number],
  players?: number,
): Player => ({
  id,
  instrument,
  name,
  abbreviation,
  range,
  grids: [0, 1],
  ...(players ? { players } : {}),
});

// Each group's players are sorted by the top of their range (then the bottom): the greedy check
// gives each pitch, low to high, the unused player with the lowest top that holds it. Of two
// players with the same range, the lower pitch goes to the one listed first ("2").
const GROUPS: Group[] = [
  {
    name: "strings",
    level: 2,
    players: [
      player("vc2", "cellos", "Violoncellos 2", "Vc. 2", [36, 84], 5),
      player("vc1", "cellos", "Violoncellos 1", "Vc. 1", [36, 84], 5),
      player("va2", "violas", "Violas 2", "Va. 2", [48, 91], 6),
      player("va1", "violas", "Violas 1", "Va. 1", [48, 91], 6),
      player("vn2-2", "violins-2", "Violins II 2", "Vn. II 2", [55, 100], 7),
      player("vn2-1", "violins-2", "Violins II 1", "Vn. II 1", [55, 100], 7),
      player("vn1-2", "violins-1", "Violins I 2", "Vn. I 2", [55, 103], 8),
      player("vn1-1", "violins-1", "Violins I 1", "Vn. I 1", [55, 103], 8),
    ],
  },
  {
    name: "woodwinds",
    level: 3,
    players: [
      player("bsn2", "bassoon", "Bassoon 2", "Bsn. 2", [34, 75]),
      player("bsn1", "bassoon", "Bassoon 1", "Bsn. 1", [34, 75]),
      player("ob2", "oboe", "Oboe 2", "Ob. 2", [58, 93]),
      player("ob1", "oboe", "Oboe 1", "Ob. 1", [58, 93]),
      player("cl2", "clarinet", "Clarinet 2", "Cl. 2", [50, 94]),
      player("cl1", "clarinet", "Clarinet 1", "Cl. 1", [50, 94]),
      player("fl2", "flute", "Flute 2", "Fl. 2", [59, 98]),
      player("fl1", "flute", "Flute 1", "Fl. 1", [59, 98]),
    ],
  },
  {
    name: "brass",
    level: 3,
    players: [
      player("tbn2", "trombone", "Trombone 2", "Tbn. 2", [40, 72]),
      player("tbn1", "trombone", "Trombone 1", "Tbn. 1", [40, 72]),
      player("hn4", "horn", "Horn 4", "Hn. 4", [34, 77]),
      player("hn3", "horn", "Horn 3", "Hn. 3", [34, 77]),
      player("hn2", "horn", "Horn 2", "Hn. 2", [34, 77]),
      player("hn1", "horn", "Horn 1", "Hn. 1", [34, 77]),
      player("tpt2", "trumpet", "Trumpet 2", "Tpt. 2", [54, 84]),
      player("tpt1", "trumpet", "Trumpet 1", "Tpt. 1", [54, 84]),
    ],
  },
].map((g) => ({
  ...g,
  players: [...g.players].sort((a, b) => a.range[1] - b.range[1] || a.range[0] - b.range[0]),
}));

const byName = new Map(GROUPS.map((g) => [g.name, g]));
const ORDERS = [
  ["strings", "woodwinds", "brass"],
  ["strings", "brass", "woodwinds"],
  ["woodwinds", "strings", "brass"],
  ["woodwinds", "brass", "strings"],
  ["brass", "strings", "woodwinds"],
  ["brass", "woodwinds", "strings"],
].map((o) => o.join(", "));

const spanOf = (g: Group): [number, number] => [
  Math.min(...g.players.map((p) => p.range[0])),
  Math.max(...g.players.map((p) => p.range[1])),
];
/** The register every group can hold: the highest of their lows to the lowest of their highs. */
const COMMON: [number, number] = [
  Math.max(...GROUPS.map((g) => spanOf(g)[0])),
  Math.min(...GROUPS.map((g) => spanOf(g)[1])),
];
/** Its middle, on the quarter-tone grid. */
const MIDDLE = Math.round(COMMON[0] + COMMON[1]) / 2;

/** The wait per shell: three atoms of family 3 (one beat). */
const WAIT = 3 * atomOf(3);

// Default values, by structure. The growth set has two betweens up and two down, so a chord grows
// on both sides of its seed; their sizes all differ, and two carry .5, so the frozen pitches stand
// on both grids. In quarter tones (3, 5, 8, 6) they share no divisor, so every quarter-tone point of
// the register can be reached: what shapes a chord is only the order the cuts are filled in and
// what the earlier chords have already defined. The capacity, 8, is the seed, the four pitches of
// shell 1 (as many as the set has betweens) and three more: a chord with nothing defined around it
// always stops inside shell 2, so shell 2 cuts are always left for the next seed. The first seed is
// the middle of the register all three groups can hold.
export const knobs = {
  growth: betweenSet({
    group: "Pitch",
    label: "Growth set",
    help: "How far from a sounding pitch a new one may stand, above (+) or below (−), in semitones (.5 for a quarter tone). Every pitch of the chord plus every between gives a candidate",
    value: "1.5 -2.5 4 -3",
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
    anchor: "seed",
  }),
  seed: pitch({
    group: "Pitch",
    label: "First seed",
    help: "The pitch the first chord grows from. By default the middle of the register all three groups can hold",
    value: MIDDLE,
    min: COMMON[0],
    max: COMMON[1],
    step: 0.5,
  }),
  capacity: number({
    group: "Pitch",
    label: "Capacity",
    help: "How many pitches a chord may hold (at most its group's eight players). A chord stops growing here, or earlier when its group cannot hold one more candidate",
    value: 8,
    min: 2,
    max: 8,
    step: 1,
  }),
  order: choice({
    group: "Colour",
    label: "Group order",
    help: "Which group takes the chords in turn, from the first",
    value: ORDERS[0]!,
    options: ORDERS,
  }),
  tempo: number({
    group: "Time",
    label: "Tempo",
    help: "Quarter notes per minute. The wait before a pitch freezes is its shell, in beats",
    value: 72,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

/**
 * Hands pitches to a group's players, low to high, each to the unused player with the lowest top
 * whose range holds it. Undefined when some pitch finds no player.
 */
export function fit(pitches: number[], players: Player[]): Player[] | undefined {
  const used = new Set<number>();
  const out: Player[] = [];
  for (const m of [...pitches].sort((a, b) => a - b)) {
    const i = players.findIndex((p, k) => !used.has(k) && p.range[0] <= m && m <= p.range[1]);
    if (i < 0) return undefined;
    used.add(i);
    out.push(players[i]!);
  }
  return out;
}

export interface Frozen {
  midi: number;
  /** In this chord: the fewest betweens of the set from its seed. */
  shell: number;
  /** When it starts to sound, in ticks. */
  at: number;
  /** When it stops, in ticks. */
  stop: number;
}

export interface Chord {
  group: Group;
  /** In the order they froze; the seed first. */
  frozen: Frozen[];
  /** The seed's shell in the chord that left it (its old name); none for the first chord. */
  oldShell?: number;
}

/**
 * The undefined cuts around a chord: each pitch plus each between of the set, not defined anywhere
 * in the piece yet, and kept by `keep`. Each with its shell.
 */
function candidates(
  chord: Frozen[],
  set: number[],
  defined: Set<number>,
  keep: (m: number) => boolean,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const f of chord)
    for (const s of set) {
      const m = f.midi + s;
      const known = out.get(m);
      if (defined.has(m) || (known !== undefined && known <= f.shell + 1)) continue;
      if (known === undefined && !keep(m)) continue;
      out.set(m, f.shell + 1);
    }
  return out;
}

/** The rule's choice: the lowest shell, then the nearest the seed, then the lower pitch. */
const choose = (c: Map<number, number>, seed: number): [number, number] =>
  [...c].sort(
    (a, b) => a[1] - b[1] || Math.abs(a[0] - seed) - Math.abs(b[0] - seed) || a[0] - b[0],
  )[0]!;

/** Every chord of the piece, with when each pitch starts and stops. */
export function chords(v: Values<typeof knobs>): Chord[] {
  const order = v.order.split(", ").map((n) => byName.get(n)!);
  const defined = new Set<number>();
  const out: Chord[] = [];
  let seed = v.seed;
  let at = 0;
  let oldShell: number | undefined;
  for (let k = 0; ; k++) {
    const group = order[k % order.length]!;
    const room = Math.min(v.capacity, group.players.length);
    const frozen: Frozen[] = [{ midi: seed, shell: 0, at, stop: 0 }];
    defined.add(seed);
    while (frozen.length < room) {
      const holds = (m: number) =>
        fit([...frozen.map((f) => f.midi), m], group.players) !== undefined;
      const c = candidates(frozen, v.growth, defined, holds);
      if (c.size === 0) break;
      const [midi, shell] = choose(c, seed);
      at += shell * WAIT;
      frozen.push({ midi, shell, at, stop: 0 });
      defined.add(midi);
    }
    out.push({ group, frozen, oldShell });
    if (frozen.length === 1) break;
    // The handover: the cut this chord would have filled next, among those the next group holds.
    const next = order[(k + 1) % order.length]!;
    const reach = (m: number) => next.players.some((p) => p.range[0] <= m && m <= p.range[1]);
    const left = candidates(frozen, v.growth, defined, reach);
    if (left.size === 0) break;
    const [midi, shell] = choose(left, seed);
    at += shell * WAIT;
    seed = midi;
    oldShell = shell;
  }

  // Leaving: the old chord's k-th pitch stops at the new chord's k-th freeze; the rest one per beat.
  for (let k = 1; k < out.length; k++) {
    const old = out[k - 1]!.frozen;
    const now = out[k]!.frozen;
    old.forEach((f, j) => {
      f.stop = j < now.length ? now[j]!.at : now.at(-1)!.at + (j - now.length + 1) * TICKS;
    });
  }
  // The last chord: after the one before it has left, its other pitches leave one per beat in the
  // order they froze, and its seed last.
  const last = out.at(-1)!;
  const before = out.at(-2)?.frozen ?? [];
  let t = Math.max(last.frozen.at(-1)!.at, ...before.map((f) => f.stop));
  for (const f of [...last.frozen.slice(1), last.frozen[0]!]) f.stop = t += TICKS;
  return out;
}

const SCORE_ORDER = [
  "flute",
  "oboe",
  "clarinet",
  "bassoon",
  "horn",
  "trumpet",
  "trombone",
  "violins-1",
  "violins-2",
  "violas",
  "cellos",
];

export function score(v: Values<typeof knobs>) {
  const bar = 4 * TICKS;
  const all = chords(v);
  const notes = new Map<string, { at: number; stop: number; midi: number; seed: boolean }[]>();
  for (const c of all) {
    const players = fit(
      c.frozen.map((f) => f.midi),
      c.group.players,
    )!;
    const low = [...c.frozen].sort((a, b) => a.midi - b.midi);
    low.forEach((f, i) => {
      const id = players[i]!.id;
      const list = notes.get(id) ?? notes.set(id, []).get(id)!;
      list.push({ at: f.at, stop: f.stop, midi: f.midi, seed: f === c.frozen[0] });
    });
  }
  const end = Math.max(...all.flatMap((c) => c.frozen.map((f) => f.stop)));

  const parts: Part[] = [];
  for (const g of GROUPS)
    for (const p of g.players) {
      const list = (notes.get(p.id) ?? []).sort((a, b) => a.at - b.at);
      if (list.length === 0) continue;
      // A player holds one pitch at a time: a note still sounding when the same player's next one
      // starts stops there (the default values never need it).
      const events = list.map((n, i) =>
        note(n.at, Math.min(n.stop, list[i + 1]?.at ?? n.stop) - n.at, n.midi),
      );
      const out = part(p, events, [{ at: 0, level: g.level }]);
      for (const n of list)
        if (n.seed) out.events.push({ type: "text", at: time(n.at), text: "seed" });
      parts.push(out);
    }
  parts.sort(
    (a, b) =>
      SCORE_ORDER.indexOf(a.instrument) - SCORE_ORDER.indexOf(b.instrument) ||
      a.id.localeCompare(b.id),
  );
  return scoreOf(
    "antara · palette B · the next chord starts from the cut the last one left",
    Math.ceil(end / bar),
    v.tempo,
    parts,
  );
}

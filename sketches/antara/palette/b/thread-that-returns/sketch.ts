// antara palette, B: threads that go out and come back, three pairs over the points they are tied to.
//
// Uses the A sketch "the one who goes back and the one who walks on" (../../a/pitch-two-standpoints),
// its logic copied here: one line of drawn groups played by two players at once, on the same
// onsets. Each group is a head and one onset per between. The home voice goes back to the anchor at
// every head; the walker never goes back: at every head it sounds its previous pitch again, then
// adds the same betweens, so its standpoint moves by each group's sum. The vertical between the two
// is the walker's standpoint itself. The rule is combinations: every group of k betweens of the set,
// in dictionary order of the sorted set, each group ascending. When the set sums to 0, one round of
// them brings the walker back to the anchor, whatever k is.
//
// Here three pairs do this, each with its own set, anchor, rhythm and family: two flutes (family 5),
// two clarinets (family 3), two solo cellos (family 2). Each pair begins with groups of one between
// (k = 1) and, after each full round, takes groups one larger, up to the whole set (k = n). The sizes
// come in pairs k and n − k whose groups are each other's rest: the smaller one is played in
// dictionary order, where the groups holding the downward betweens come first, so the walker goes out
// below the home voice (the A's first round); the larger one is played in reverse order (the A's
// second round), which takes, in the same order, the rest of each group of the smaller size, so the
// walker goes out above by the same verticals. A size that is its own pair (k = n / 2) is played both
// ways, as in the A. The last size is one group, the whole set: its sum is 0, so the two players
// sound the same line, from the anchor back to it. So each group is one onset longer than in the
// round before, and the walker goes below, then above, then with the home voice.
// The sets have 5, 4 and 3 betweens, so the three pairs have different numbers of rounds and
// lengths; the cellos, entering last, go through all their sizes while the others are in the middle
// of theirs.
//
// The clarinets enter at the flutes' first return (the end of their k = 1 round), the cellos at the
// clarinets' first return: on the beat, where the families meet (with the values given, the return
// is on the beat). A pair's last note is the end of its whole-set group, both players on the anchor;
// it fades there and the pair rests; the pair that ends last holds it to the end.
//
// The strings hold each pair's anchor, from the moment that pair enters to the end, and nothing
// else: the pitch the home voice goes back to at every head, the point the thread is tied to.
// ppp, non vib., no other rule. All pairs stay at one level; nothing builds up.
// Card: README.md.

import type { Part } from "../../../../../src/score/types.ts";
import { betweenSet, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, type Family } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, time, type Player } from "../../common.ts";

const setKnob = (group: string, value: string, anchor: string) =>
  betweenSet({
    group,
    label: "Set",
    help: "The betweens both players add (semitones, .5 for a quarter tone, − for down). The groups grow from one between to the whole set, one size per round. With a sum of 0 the walker comes back at the end of every round; otherwise it does not, and nothing corrects it",
    value,
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
    anchor,
  });
const rhythmKnob = (group: string, value: string, family: string) =>
  betweenSet({
    group,
    label: "Rhythm",
    help: `The time between one onset and the next, in atoms of family ${family}, taken in turn smallest first across the groups and rounds`,
    value,
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  });
const anchorKnob = (group: string, value: number, min: string, max: string) =>
  pitch({
    group,
    label: "Anchor",
    help: "The standpoint: where both players start, where the home player goes back at every head, where the pair ends (with a set summing to 0), and the pitch the strings hold for this pair",
    value,
    min,
    max,
    step: 0.5,
  });

export const knobs = {
  fluteSet: setKnob("Flutes (enter first)", "-4 -3 0.5 1 5.5", "fluteAnchor"),
  fluteAnchor: anchorKnob("Flutes (enter first)", 79.5, "C5", "C7"),
  fluteRhythm: rhythmKnob("Flutes (enter first)", "3 4 4 4 4 5 5", "5 (quintuplet 16ths)"),
  clarinetSet: setKnob("Clarinets (enter second)", "-5.5 -1 2.5 4", "clarinetAnchor"),
  clarinetAnchor: anchorKnob("Clarinets (enter second)", 65, "E3", "C6"),
  clarinetRhythm: rhythmKnob("Clarinets (enter second)", "3 3 4 5 5", "3 (triplet 8ths)"),
  celloSet: setKnob("Cellos (enter last)", "-4.5 -3.5 8", "celloAnchor"),
  celloAnchor: anchorKnob("Cellos (enter last)", 44, "C2", "C5"),
  celloRhythm: rhythmKnob("Cellos (enter last)", "2 3 4 5 7", "2 (16ths)"),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 60,
    min: 30,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

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
  ...(players === undefined ? {} : { players }),
});

interface Pair {
  name: string;
  family: Family;
  range: [number, number];
  home: Player;
  walker: Player;
  /** The string section that holds this pair's anchor. */
  tie: Player;
}

// Where the soloists play: the instrument's range as far as BBC SO has samples for it.
const FLUTE: [number, number] = [60, 96];
const CLARINET: [number, number] = [50, 88];
const CELLO: [number, number] = [36, 82];

// In the order they enter.
const PAIRS: Pair[] = [
  {
    name: "Flutes",
    family: 5,
    range: FLUTE,
    home: player("fl1", "flute", "Flute 1", "Fl. 1", FLUTE),
    walker: player("fl2", "flute", "Flute 2", "Fl. 2", FLUTE),
    tie: player("vn1", "violins-1", "Violins I", "Vn. I", [55, 103], 16),
  },
  {
    name: "Clarinets",
    family: 3,
    range: CLARINET,
    home: player("cl1", "clarinet", "Clarinet 1", "Cl. 1", CLARINET),
    walker: player("cl2", "clarinet", "Clarinet 2", "Cl. 2", CLARINET),
    tie: player("va", "violas", "Violas", "Va.", [48, 91], 12),
  },
  {
    name: "Cellos",
    family: 2,
    range: CELLO,
    home: player("vcs1", "cellos", "Violoncello solo 1", "Vc. solo 1", CELLO, 1),
    walker: player("vcs2", "cellos", "Violoncello solo 2", "Vc. solo 2", CELLO, 1),
    // The section without its two soloists.
    tie: player("vc", "cellos", "Violoncellos", "Vc.", CELLO, 8),
  },
];

interface Onset {
  at: number;
  home: number;
  walker: number;
}

interface Walk {
  start: number;
  onsets: Onset[];
  /** When each round ends: where the next head falls, the walker back (with a set summing to 0). */
  returns: number[];
  /** The last onset: the end of the whole-set group, both players on the anchor. */
  close: number;
  /** The gap after it, from the pair's own rhythm: how long it fades. */
  after: number;
}

/**
 * The rounds of one pair, sizes 1 to the whole set. The groups of size k and of size n − k are each
 * other's rest: the smaller size is played in dictionary order (the walker goes out below), the
 * larger in reverse order (the same verticals, above), a size equal to its rest both ways (as in
 * the A).
 */
function rounds(set: number[]): number[][][] {
  const n = set.length;
  const key = (g: number[]) => g.join(",");
  const out: number[][][] = [];
  for (let size = 1; size <= n; size++) {
    const draw = drawer(set, "combinations", size, "ascending");
    const round: number[][] = [];
    for (let g = draw(); round.length === 0 || key(g) !== key(round[0]!); g = draw()) round.push(g);
    const back = [...round].reverse();
    if (2 * size < n) out.push(round);
    else if (2 * size === n) out.push(round, back);
    else out.push(back);
  }
  return out;
}

/** One pair: its rounds, each group a head and one onset per between. */
function walk(
  set: number[],
  anchor: number,
  rhythm: number[],
  family: Family,
  start: number,
): Walk {
  const atom = atomOf(family);
  const gap = stream(rhythm, "in order", 1);
  const onsets: Onset[] = [];
  const returns: number[] = [];
  let t = start;
  let walker = anchor;
  for (const round of rounds(set)) {
    for (const group of round) {
      // The head: the home voice back at the anchor, the walker where it is.
      let home = anchor;
      onsets.push({ at: t, home, walker });
      for (const b of group) {
        t += gap() * atom;
        home += b;
        walker += b;
        onsets.push({ at: t, home, walker });
      }
      t += gap() * atom;
    }
    returns.push(t);
  }
  const close = onsets.at(-1)!.at;
  return { start, onsets, returns, close, after: t - close };
}

export function score(v: Values<typeof knobs>) {
  const bar = 4 * TICKS;
  const given = [
    { set: v.fluteSet, anchor: v.fluteAnchor, rhythm: v.fluteRhythm },
    { set: v.clarinetSet, anchor: v.clarinetAnchor, rhythm: v.clarinetRhythm },
    { set: v.celloSet, anchor: v.celloAnchor, rhythm: v.celloRhythm },
  ];

  // Each pair enters at the previous pair's first return, on the beat (where the families meet).
  const walks: Walk[] = [];
  let start = 0;
  PAIRS.forEach((p, i) => {
    const g = given[i]!;
    if (g.set.length < 2)
      throw new Error(
        `${p.name}: the Set needs at least two betweens (groups of one, then larger)`,
      );
    const w = walk(g.set, g.anchor, g.rhythm, p.family, start);
    for (const o of w.onsets)
      for (const m of [o.home, o.walker])
        if (m < p.range[0] || m > p.range[1])
          throw new Error(
            `${p.name}: a player reaches ${m}, outside the range (${p.range[0]}–${p.range[1]}); move the Anchor or change the Set`,
          );
    walks.push(w);
    start = Math.ceil(w.returns[0]! / TICKS) * TICKS;
  });

  // The pair that closes last holds its last note to the end, with the strings.
  const last = Math.max(...walks.map((w) => w.close));
  const end = Math.ceil((last + bar) / bar) * bar;

  const pairParts: Part[] = [];
  const tieParts: Part[] = [];
  PAIRS.forEach((p, i) => {
    const w = walks[i]!;
    const stop = w.close === last ? end : w.close + w.after;
    // mp throughout; the last note fades.
    const dynamics = curve([
      { at: w.start, level: 4 },
      { at: w.close, level: 4, ramp: true },
      { at: stop, level: 0 },
    ]);
    const line = (pl: Player, pick: (o: Onset) => number) =>
      part(
        pl,
        w.onsets.map((o, j) => note(o.at, (w.onsets[j + 1]?.at ?? stop) - o.at, pick(o))),
        dynamics,
      );
    pairParts.push(
      line(p.home, (o) => o.home),
      line(p.walker, (o) => o.walker),
    );

    // The strings: this pair's anchor, from its entrance to the end.
    const anchor = given[i]!.anchor;
    if (anchor < p.tie.range[0] || anchor > p.tie.range[1])
      throw new Error(`${p.name}: the Anchor ${anchor} is outside the ${p.tie.name}`);
    const tie = part(
      p.tie,
      [note(w.start, end - w.start, anchor)],
      curve([
        { at: w.start, level: 1 },
        { at: last, level: 1, ramp: true },
        { at: end, level: 0 },
      ]),
    );
    tie.events.unshift({ type: "text", at: time(w.start), text: "non vib." });
    tieParts.push(tie);
  });

  const [fl1, fl2, cl1, cl2, vcs1, vcs2] = pairParts;
  const [vn1, va, vc] = tieParts;
  return scoreOf("antara · palette B · the thread that returns", end / bar, v.tempo, [
    fl1!,
    fl2!,
    cl1!,
    cl2!,
    vn1!,
    va!,
    vcs1!,
    vcs2!,
    vc!,
  ]);
}

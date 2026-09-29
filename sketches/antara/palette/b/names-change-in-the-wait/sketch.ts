// antara palette, B: the names change in the wait.
//
// Uses the A sketch "a rest is the wait to change family" (../../a/time-wait-to-change), copied
// here: one line in groups of two time betweens (every combination of two of 1 2 3 4 5 atoms, taken
// through the dictionary order with a stride), each group in the next family of a fixed order, each
// note lasting its between. A line may change family only on a beat, where the families' grids
// meet, so after a group that ends off the beat the line waits, silent, for the next beat. The wait
// is the one place where no term stands.
//
// Here the line is played by six brass, two to a family: the family names the instrument (2: horn,
// 3: trumpet, 5: trombone), and a second name, open or muted, picks which of the two plays. The
// name starts open and flips at every wait longer than 0; where the wait is 0 the family (and the
// instrument) still changes, but the name carries on. So the colour phrases are cut only where the
// line had to wait: at a cut, where no term stands, a new name is given.
//
// The strings keep what was left at the cut. The last tone before a wait (the term at the cut) is
// held from the head after the wait until the next wait begins, then replaced; a wait of 0 changes
// nothing. The strings are silent in every wait, like the brass.
//
// Two passes of the same 30 groups (10 pairs, each meeting each family once). Pass 1 goes through
// the families in one order, pass 2 in another (by default reversed), so the same pairs meet the
// families at other places, the waits fall elsewhere, and the colour phrases and the held tones
// change. In pass 1 the violas hold the tone before the cut; in pass 2 the cellos join them with
// the tone after it (the next head), so the cut's two terms are held as one between.
//
// Pitch (the A had none): one line of pitch betweens over both passes, never reset, from a
// standpoint. The rule is the A's own reading, used on the pitch set: every combination of three
// of the betweens (each kept in the order the set is written), walked through with a stride; each
// round of combinations takes the next stride and starts one combination later, so no round comes
// back as a copy of the last. (With the default values a round is 60 notes, the length of a pass:
// without the later start, pass 2 would open with pass 1's first four notes, moved down.) A
// between that would leave the band is taken the other way. The standpoint is the band's middle:
// the betweens of a round add up to 0, so the line stays around it, with as much room above as
// below. (A set with sum 0 read "shift each time" came back to the standpoint every six notes, and
// six notes are one round of the three families: the same family always started on the
// standpoint. Three at a time the pitch rounds do not line up with the groups of two.)
//
// Brass p, tongued, no accents, no slurs; strings con sord., pp. Every head is on a beat; the
// score ends at the bar line after the last wait. Card: README.md.

import type { NoteEvent, Part, TextEvent } from "../../../../../src/score/types.ts";
import {
  choice,
  number,
  numbersOf,
  pitch,
  pitchRange,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, familiesOf, type Family } from "../../../between.ts";
import { note, scoreOf, TICKS, time } from "../../common.ts";

const ORDERS = ["2 3 5", "2 5 3", "3 2 5", "3 5 2", "5 2 3", "5 3 2"];

export const knobs = {
  set: text({
    group: "Pitch",
    label: "Pitch set",
    help: "The pitch betweens of the line (semitones, .5 for a quarter tone, − for down), in the order written. The rule takes every combination of three, each kept in this order, walking through them with a stride; every round takes the next stride and starts one combination later. Written as text to keep the order",
    value: "3.5 -1.5 2 -4.5 5.5 -5",
    hint: "3.5 -1.5 2 -4.5 5.5 -5",
  }),
  anchor: pitch({
    group: "Pitch",
    label: "Standpoint",
    help: "The first tone. It has to be inside the band; by default its middle",
    value: "D#4",
    min: "F#3",
    max: "C5",
    step: 0.5,
  }),
  band: pitchRange({
    group: "Pitch",
    label: "Band",
    help: "Where the line may go: a between that would leave it is taken the other way. It must be at least twice the widest between. Its ends are the range horn, trumpet and trombone share (the trumpet's lowest, the trombone's highest)",
    value: ["F#3", "C5"],
    min: "F#3",
    max: "C5",
    step: 0.5,
  }),
  first: choice({
    group: "Time",
    label: "Pass 1 families",
    help: "The families pass 1 goes through, one group each, round and round (2: 16ths, horns; 3: triplet 8ths, trumpets; 5: quintuplet 16ths, trombones)",
    value: ORDERS[0]!,
    options: ORDERS,
  }),
  second: choice({
    group: "Time",
    label: "Pass 2 families",
    help: "The families pass 2 goes through. The same 30 groups meet the families at other places, so the waits (and the name changes) fall elsewhere",
    value: ORDERS[5]!,
    options: ORDERS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 60,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

/** The A's time set, group size and number of groups (10 pairs × 3 families: each pair meets each family once). */
const TIME_SET = [1, 2, 3, 4, 5];
const GROUP_SIZE = 2;
const GROUPS = 30;
/**
 * How many pitch betweens the pitch rule takes at a time: three, so the pitch rule's pieces (three
 * notes) fall across the time groups (two notes) instead of lining up with them.
 */
const PITCH_SIZE = 3;

type Name = "open" | "muted";
interface Voice {
  id: string;
  instrument: string;
  name: string;
  abbreviation: string;
}
const brass = (id: string, instrument: string, name: string, abbreviation: string): Voice => ({
  id,
  instrument,
  name,
  abbreviation,
});
// The family names the instrument; the name (open or muted) names which of the two plays.
const PLAYERS: Record<Family, Record<Name, Voice>> = {
  2: {
    open: brass("hn1", "horn", "Horn 1", "Hn. 1"),
    muted: brass("hn2", "horn", "Horn 2", "Hn. 2"),
  },
  3: {
    open: brass("tpt1", "trumpet", "Trumpet 1", "Tpt. 1"),
    muted: brass("tpt2", "trumpet", "Trumpet 2", "Tpt. 2"),
  },
  5: {
    open: brass("tbn1", "trombone", "Trombone 1", "Tbn. 1"),
    muted: brass("tbn2", "trombone", "Trombone 2", "Tbn. 2"),
  },
};
// Score order, top down.
const BRASS_ORDER = ["hn1", "hn2", "tpt1", "tpt2", "tbn1", "tbn2"];

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** The smallest stride above 1 that meets every group once a round and is not n - 1 (else 1). */
function strideOf(n: number): number {
  for (let s = 2; s < n - 1; s++) if (gcd(s, n) === 1) return s;
  return 1;
}

/** Every stride above 1 that meets every group once a round and is not n - 1, smallest first. */
function stridesOf(n: number): number[] {
  const out: number[] = [];
  for (let s = 2; s < n - 1; s++) if (gcd(s, n) === 1) out.push(s);
  return out.length > 0 ? out : [1];
}

/** Every time group the rule draws, once each, in dictionary order (the A's reading). */
function timeGroups(): number[][] {
  const draw = drawer(TIME_SET, "combinations", GROUP_SIZE, "ascending");
  const first = draw();
  const out = [first];
  for (let g = draw(); g.join(" ") !== first.join(" "); g = draw()) out.push(g);
  return out;
}

/** Every combination of k of the set, each kept in the order written, in dictionary order of places. */
function combinations(set: number[], k: number): number[][] {
  const out: number[][] = [];
  const pick = (from: number, acc: number[]) => {
    if (acc.length === k) {
      out.push(acc.map((i) => set[i]!));
      return;
    }
    for (let i = from; i < set.length; i++) pick(i + 1, [...acc, i]);
  };
  pick(0, []);
  return out;
}

/** The pitch set as written, in order: semitones on the quarter-tone grid. */
function setOf(value: string): number[] {
  const set = numbersOf("Pitch set", value.replaceAll("−", "-"));
  if (set.length === 0) throw new Error("Pitch set: write at least one between (e.g. 3.5 -1.5 2)");
  if (set.some((b) => !Number.isInteger(b * 2)))
    throw new Error("Pitch set: betweens are semitones on the quarter-tone grid (2, 3.5, -4.5)");
  return set;
}

interface Group {
  pass: number;
  family: Family;
  head: number;
  end: number;
  wait: number;
  notes: { at: number; dur: number; midi: number }[];
}

export function score(v: Values<typeof knobs>) {
  const set = setOf(v.set);
  const [lo, hi] = v.band;
  const widest = Math.max(...set.map(Math.abs));
  if (hi - lo < 2 * widest)
    throw new Error(
      `Band: it must be at least twice the widest between (${2 * widest}), so a between that leaves it can always be taken the other way`,
    );
  if (v.anchor < lo || v.anchor > hi) throw new Error("Standpoint: put it inside the band");

  // Pitch: every combination of three, walked with a stride; each round the next stride, starting
  // one combination later than the round before.
  const combos = combinations(set, Math.min(PITCH_SIZE, set.length));
  const strides = stridesOf(combos.length);
  let drawn = 0;
  let queue: number[] = [];
  const nextBetween = () => {
    if (queue.length === 0) {
      const round = Math.floor(drawn / combos.length);
      const stride = strides[round % strides.length]!;
      queue = [...combos[(round + (drawn % combos.length) * stride) % combos.length]!];
      drawn++;
    }
    return queue.shift()!;
  };
  let current: number | undefined;
  const nextPitch = () => {
    if (current === undefined) current = v.anchor;
    else {
      const b = nextBetween();
      current = current + b >= lo && current + b <= hi ? current + b : current - b;
    }
    return current;
  };

  // Time: the A's groups and waits, two passes of the same 30 groups.
  const list = timeGroups();
  const stride = strideOf(list.length);
  const orders = [familiesOf("Pass 1 families", v.first), familiesOf("Pass 2 families", v.second)];
  const groups: Group[] = [];
  let head = 0;
  orders.forEach((order, pass) => {
    for (let g = 0; g < GROUPS; g++) {
      const family = order[g % order.length]!;
      const atom = atomOf(family);
      const notes: Group["notes"] = [];
      let at = head;
      for (const between of list[(g * stride) % list.length]!) {
        notes.push({ at, dur: between * atom, midi: nextPitch() });
        at += between * atom;
      }
      // The family may change only where the grids meet: the next group waits for the next beat.
      const wait = (TICKS - (at % TICKS)) % TICKS;
      groups.push({ pass, family, head, end: at, wait, notes });
      head = at + wait;
    }
  });

  // Names: open at first, flipped at every wait longer than 0.
  const brassEvents = new Map<string, NoteEvent[]>(BRASS_ORDER.map((id) => [id, []]));
  let name: Name = "open";
  for (const g of groups) {
    const who = PLAYERS[g.family][name];
    for (const n of g.notes)
      brassEvents
        .get(who.id)!
        .push(note(n.at, n.dur, n.midi, name === "muted" ? { technique: "muted" } : {}));
    if (g.wait > 0) name = name === "open" ? "muted" : "open";
  }

  // Residue: at each cut (a wait longer than 0 with a group after it), the term before the cut is
  // held from the next head until the next wait begins; in pass 2 the term after it too.
  const violas: NoteEvent[] = [];
  const cellos: NoteEvent[] = [];
  const cutAfter = groups.map((g, i) => g.wait > 0 && i + 1 < groups.length);
  groups.forEach((g, i) => {
    if (!cutAfter[i]) return;
    const next = groups[i + 1]!;
    let j = i + 1;
    while (j < groups.length - 1 && groups[j]!.wait === 0) j++;
    const from = next.head;
    const until = groups[j]!.end;
    const before = g.notes.at(-1)!.midi;
    const after = next.notes[0]!.midi;
    violas.push(note(from, until - from, before, { technique: "con-sord" }));
    if (next.pass === 1) cellos.push(note(from, until - from, after, { technique: "con-sord" }));
  });

  const bar = 4 * TICKS;
  const end = Math.ceil(head / bar) * bar;
  const pass2 = groups.find((g) => g.pass === 1)!.head;
  const mark: TextEvent = { type: "text", at: time(pass2), text: "pass 2" };

  const voices = new Map(
    Object.values(PLAYERS).flatMap((byName) => Object.values(byName).map((p) => [p.id, p])),
  );
  const brassParts: Part[] = BRASS_ORDER.map((id, k) => {
    const p = voices.get(id)!;
    return {
      ...p,
      dynamics: [{ at: 0, level: 3 }],
      events: k === 0 ? [...brassEvents.get(id)!, mark] : brassEvents.get(id)!,
    };
  });
  const strings: Part[] = [
    {
      id: "va",
      instrument: "violas",
      name: "Violas",
      abbreviation: "Va.",
      players: 12,
      dynamics: [{ at: 0, level: 2 }],
      events: violas,
    },
  ];
  if (cellos.length > 0)
    strings.push({
      id: "vc",
      instrument: "cellos",
      name: "Violoncellos",
      abbreviation: "Vc.",
      players: 10,
      dynamics: [{ at: 0, level: 2 }],
      events: cellos,
    });

  return scoreOf("antara · palette B · the names change in the wait", end / bar, v.tempo, [
    ...brassParts,
    ...strings,
  ]);
}

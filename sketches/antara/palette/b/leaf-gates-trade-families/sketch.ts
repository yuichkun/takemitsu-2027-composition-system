// antara palette, B: the leaves trade families.
//
// Uses the A sketch "a chord whose leaves open and close" (../../a/texture-leaf-gates). Its rule is
// copied here unchanged: a chord (the standpoint with the set's betweens stacked on it, narrowest
// first) never changes pitch; each voice opens (sounds) for a number of atoms and closes (rests) for
// a number of atoms, again and again, counted in its own family; the families are handed round from
// the lowest voice up (2, 3, 5, 2, ...); voice k starts its cycle k staggers in. A voice attacks its
// pitch again each time it opens and simply stops when it closes.
//
// Here the rule runs in three choirs, each holding its own eight-voice chord from the same set: the
// strings (divided, as in the A) on the A's standpoint, the woodwinds the chord's whole span above,
// the brass the span below, so the three chords touch end to end. Each choir takes the A's numbers
// (open : closed : stagger = 4 : 2 : 1) times its own multiplier (11, 13, 17: the A's 11 and the
// next two numbers that neither 2, 3 nor 5 divides) and starts the family round one place further
// on (the strings at 2, the woodwinds at 3, the brass at 5). Read from the bottom, the 22 pitches of
// the three chords are then handed 5, 2, 3, 5, 2, 3, ... without a break, and a pitch two choirs
// share counts in the same family in both.
//
// The choirs enter one after another, each on the beat at which the one before it has run one whole
// cycle in its slowest family. On the beat at which the last has done so too, every voice of every
// choir moves one place on in the family round (2 to 3, 3 to 5, 5 to 2) and starts its cycle again
// from its stagger, as at its entry: the voices open there attack again together. Nothing else
// changes, no pitch and no number of atoms; only the family each voice counts in, and so how long
// its numbers last. Since every choir's numbers stand in the same ratio, a choir's breathing is fixed
// by where its family round starts, and its multiplier only stretches it in time: after the turn the
// strings breathe as the woodwinds did from their entry, the woodwinds as the brass did, the brass
// as the strings did, each at its own speed.
//
// The last bar begins at the first bar line after every choir has run one whole cycle in its new
// slowest family. Nothing opens or closes in it: the voices open at its downbeat hold and fade out
// together, the closed ones stay silent. Everything is pp until that fade. Card: README.md.

import type { NoteEvent, Part, TextEvent } from "../../../../../src/score/types.ts";
import { betweenSet, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, type Family } from "../../../between.ts";
import { curve, divisi, inOrder, note, part, scoreOf, TICKS, type Player } from "../../common.ts";

/** The family round, from the lowest voice of a choir up. */
const FAMILIES: Family[] = [2, 3, 5];

const solo = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  range: [number, number],
): Player => ({ id, instrument, name, abbreviation, range, grids: [0, 1] });

// Low to high: the order the voices take them in.
const WINDS: Player[] = [
  solo("cl3", "clarinet", "Clarinet 3", "Cl. 3", [50, 94]),
  solo("cl2", "clarinet", "Clarinet 2", "Cl. 2", [50, 94]),
  solo("cl1", "clarinet", "Clarinet 1", "Cl. 1", [50, 94]),
  solo("ob2", "oboe", "Oboe 2", "Ob. 2", [58, 93]),
  solo("ob1", "oboe", "Oboe 1", "Ob. 1", [58, 93]),
  solo("fl3", "flute", "Flute 3", "Fl. 3", [59, 98]),
  solo("fl2", "flute", "Flute 2", "Fl. 2", [59, 98]),
  solo("fl1", "flute", "Flute 1", "Fl. 1", [59, 98]),
];
const BRASS: Player[] = [
  solo("tba", "tuba", "Tuba", "Tba.", [26, 65]),
  solo("btbn", "bass-trombone", "Bass Trombone", "B. Tbn.", [28, 67]),
  solo("tbn2", "trombone", "Trombone 2", "Tbn. 2", [40, 72]),
  solo("tbn1", "trombone", "Trombone 1", "Tbn. 1", [40, 72]),
  solo("hn4", "horn", "Horn 4", "Hn. 4", [34, 77]),
  solo("hn3", "horn", "Horn 3", "Hn. 3", [34, 77]),
  solo("hn2", "horn", "Horn 2", "Hn. 2", [34, 77]),
  solo("hn1", "horn", "Horn 1", "Hn. 1", [34, 77]),
];

const MULTIPLIER = "Choirs, in the order they enter";

export const knobs = {
  chord: betweenSet({
    group: "Chord",
    label: "Chord",
    help: "The betweens stacked on each choir's standpoint, narrowest at the bottom (semitones, .5 for a quarter tone). One voice more than betweens in each choir; no pitch ever changes",
    value: "1 1 1.5 2 2.5 3.5 4",
    min: 0,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  anchor: pitch({
    group: "Chord",
    label: "Standpoint",
    help: "The strings' lowest voice. The woodwinds stand the chord's whole span above it, the brass the span below, so the three chords touch",
    value: "G3",
    min: "C2",
    max: "C5",
    step: 0.5,
  }),
  open: number({
    group: "Gates, before each choir's multiplier",
    label: "Open",
    help: "How long a voice sounds each time it opens, in atoms of its own family, before its choir's multiplier (the same for every voice of a choir)",
    value: 4,
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  closed: number({
    group: "Gates, before each choir's multiplier",
    label: "Closed",
    help: "How long a voice rests each time it closes, in atoms of its own family, before its choir's multiplier",
    value: 2,
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  stagger: number({
    group: "Gates, before each choir's multiplier",
    label: "Stagger",
    help: "Voice k (0 the lowest of its choir) starts k times this far into its cycle, at its entry and again at the turn; before its choir's multiplier",
    value: 1,
    min: 0,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  strings: number({
    group: MULTIPLIER,
    label: "Strings ×",
    help: "The strings' multiplier. Their family round starts at 2 and moves on to 3 at the turn",
    value: 11,
    min: 1,
    max: 40,
    step: 1,
  }),
  woodwinds: number({
    group: MULTIPLIER,
    label: "Woodwinds ×",
    help: "The woodwinds' multiplier. Their family round starts at 3 and moves on to 5 at the turn",
    value: 13,
    min: 1,
    max: 40,
    step: 1,
  }),
  brass: number({
    group: MULTIPLIER,
    label: "Brass ×",
    help: "The brass's multiplier. Their family round starts at 5 and moves on to 2 at the turn",
    value: 17,
    min: 1,
    max: 40,
    step: 1,
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

interface Choir {
  players: Player[];
  pitches: number[];
  /** Where the family round starts for the choir's lowest voice, before the turn. */
  offset: number;
  open: number;
  closed: number;
  stagger: number;
}

const familyOf = (k: number, offset: number): Family => FAMILIES[(k + offset) % FAMILIES.length]!;

/**
 * A voice's notes from `from` to `to`, its cycle standing `into` atoms in at `from`. A note still
 * open at `to` stops there; with `hold`, a note open at `to` (or opening on it) holds to `hold`.
 */
function leaf(
  from: number,
  to: number,
  atom: number,
  into: number,
  c: Choir,
  hold?: number,
): { at: number; stop: number }[] {
  const cycle = (c.open + c.closed) * atom;
  const out: { at: number; stop: number }[] = [];
  for (let o = from - into * atom; hold === undefined ? o < to : o <= to; o += cycle) {
    const at = Math.max(from, o);
    const close = o + c.open * atom;
    if (close <= at) continue;
    out.push({ at, stop: close > to ? (hold ?? to) : close });
  }
  return out;
}

export function score(v: Values<typeof knobs>) {
  const bar = 4 * TICKS;
  const onBeat = (t: number) => Math.ceil(t / TICKS) * TICKS;
  const onBar = (t: number) => Math.ceil(t / bar) * bar;
  const span = v.chord.reduce((a, b) => a + b, 0);
  const stackOn = (anchor: number) => {
    const out = [anchor];
    for (const b of v.chord) out.push(out.at(-1)! + b);
    return out;
  };
  const ranges = (ps: number[]) => ps.map((m): [number, number] => [m, m]);

  const choirOf = (anchor: number, offset: number, times: number, pool?: Player[]): Choir => {
    const pitches = stackOn(anchor);
    return {
      players: pool ? inOrder(ranges(pitches), pool) : divisi(ranges(pitches)),
      pitches,
      offset,
      open: v.open * times,
      closed: v.closed * times,
      stagger: v.stagger * times,
    };
  };
  // In the order they enter.
  const choirs: Choir[] = [
    choirOf(v.anchor, 0, v.strings),
    choirOf(v.anchor + span, 1, v.woodwinds, WINDS),
    choirOf(v.anchor - span, 2, v.brass, BRASS),
  ];

  // One whole cycle in the choir's slowest family, in ticks, before (0) or after (1) the turn.
  const slowest = (c: Choir, turn: number) =>
    Math.max(
      ...c.pitches.map((_, k) => (c.open + c.closed) * atomOf(familyOf(k, c.offset + turn))),
    );

  // The entries, the turn, the last bar.
  const starts = [0];
  for (let i = 1; i < choirs.length; i++)
    starts.push(onBeat(starts[i - 1]! + slowest(choirs[i - 1]!, 0)));
  const turn = onBeat(Math.max(...choirs.map((c, i) => starts[i]! + slowest(c, 0))));
  const last = onBar(turn + Math.max(...choirs.map((c) => slowest(c, 1))));
  const end = last + bar;

  const dynamics = curve([
    { at: 0, level: 2 },
    { at: last, level: 2, ramp: true },
    { at: end, level: 0 },
  ]);

  const partsOf = (c: Choir, i: number): Part[] =>
    c.pitches.map((midi, k) => {
      const into = (k * c.stagger) % (c.open + c.closed);
      const before = leaf(starts[i]!, turn, atomOf(familyOf(k, c.offset)), into, c);
      const after = leaf(turn, last, atomOf(familyOf(k, c.offset + 1)), into, c, end);
      const events: NoteEvent[] = [...before, ...after].map((n) => note(n.at, n.stop - n.at, midi));
      const out = part(c.players[k]!, events, dynamics);
      const mark: TextEvent = { type: "text", at: events[0]?.at ?? 0, text: "senza vib." };
      out.events.unshift(mark);
      return out;
    });

  // Score order: woodwinds, brass, strings; each from the top down.
  const [strings, winds, brass] = choirs.map((c, i) => partsOf(c, i).reverse());
  const measureOf = (t: number) => Math.floor(t / bar) + 1;
  const beatOf = (t: number) => (t % bar) / TICKS + 1;
  const mark = (t: number, label: string) => ({
    measure: measureOf(t),
    label: beatOf(t) === 1 ? label : `${label} (beat ${beatOf(t)})`,
  });

  const out = scoreOf("antara · palette B · the leaves trade families", end / bar, v.tempo, [
    ...winds!,
    ...brass!,
    ...strings!,
  ]);
  out.rehearsal = [
    mark(starts[1]!, "woodwinds"),
    mark(starts[2]!, "brass"),
    mark(turn, "families move on"),
  ];
  return out;
}

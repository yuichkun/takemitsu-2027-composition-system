// antara palette, B: the families come apart, and come back displaced.
//
// Uses the lines sketch "the families come apart" (../../../ideas/lines/a-families-part), whose
// logic is copied here: twelve voices strike a chord on every beat, together, but each counts the
// beat in its own family (5 atoms of the 5 family, 3 of the 3 family, 4 of the 2 family). One voice
// after another, from the top, moves its between by one atom (one voice one atom longer, the next
// one atom shorter, and so on) and keeps that speed on its own family's grid, so the voices meet
// less and less often.
//
// Added here: the return. After a pause the voices come back one after another, by default the last
// to have left first. At a voice's first onset at or after its time, its between is one beat again,
// and from then on it strikes once per beat wherever it happens to be. The between comes back; the
// place does not: most voices stay off the beat, so the vertical line (time between 0) returns as a
// chord whose time betweens are not 0.
//
// Each onset's colour is the name the voice's relation to the common beat gives it: a one-beat
// between on the beat, pizzicato strings; its own between, staccato woodwinds; a one-beat between
// off the beat, muted brass, each note held to the next. Every voice has one player in each group,
// handed out low to high by register. The dynamics stay flat; only the last bar fades.
// Card: README.md.

import {
  betweenSet,
  choice,
  number,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familiesOf, type Family } from "../../../between.ts";
import { A_CHORD } from "../../../ideas/lines/common.ts";
import {
  curve,
  divisi,
  inOrder,
  note,
  numberFromTop,
  part,
  scoreOf,
  stack,
  TICKS,
  type Player,
} from "../../common.ts";

const ORDERS = [
  "reverse: the last to leave comes back first",
  "same: the first to leave comes back first",
];

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
    help: "The bottom of the stack of twelve voices",
    value: "C2",
    min: "G1",
    max: "C3",
    step: 0.5,
  }),
  families: text({
    group: "Time",
    label: "Families",
    help: "The family each voice counts the beat in, from the top voice down, again and again (2: 16ths, 3: triplet 8ths, 5: quintuplet 16ths)",
    value: "5 3 2",
  }),
  leave: number({
    group: "Time",
    label: "Leave every",
    help: "Beats from one voice moving its between to the next (the first moves after two bars together); the voices come back at the same distance",
    value: 3,
    min: 1,
    max: 8,
    step: 1,
    unit: "beats",
  }),
  pause: number({
    group: "Return",
    label: "Pause",
    help: "Beats from the last voice moving to the first voice coming back",
    value: 4,
    min: 1,
    max: 16,
    step: 1,
    unit: "beats",
  }),
  order: choice({
    group: "Return",
    label: "Return order",
    help: "Who comes back first. Reverse: each voice stays away a different time. Same: every voice stays away the same time",
    value: ORDERS[0]!,
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

/** How many atoms make one beat in each family. */
const PER_BEAT: Record<Family, number> = { 2: 4, 3: 3, 5: 5 };
/** Beats of all together before the first voice moves (two bars). */
const TOGETHER = 8;
/** Bars after the bar in which the last voice comes back. */
const AFTER = 3;
const VOICES = 12;

type Colour = "strings" | "winds" | "brass";
interface Onset {
  at: number;
  colour: Colour;
}

const player = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  range: [number, number],
): Player => ({ id, instrument, name, abbreviation, range, grids: [0, 1] });

// Low to high: the order voices take them in (numbered from the top afterwards).
const WINDS: Player[] = [
  player("cbsn", "contrabassoon", "Contrabassoon", "Cbsn.", [22, 53]),
  player("bsn", "bassoon", "Bassoon", "Bsn.", [34, 75]),
  player("bsn", "bassoon", "Bassoon", "Bsn.", [34, 75]),
  player("bcl", "bass-clarinet", "Bass Clarinet", "B. Cl.", [34, 77]),
  player("ca", "cor-anglais", "Cor anglais", "C. ingl.", [52, 81]),
  player("cl", "clarinet", "Clarinet", "Cl.", [50, 94]),
  player("cl", "clarinet", "Clarinet", "Cl.", [50, 94]),
  player("ob", "oboe", "Oboe", "Ob.", [58, 93]),
  player("ob", "oboe", "Oboe", "Ob.", [58, 93]),
  player("fl", "flute", "Flute", "Fl.", [59, 98]),
  player("fl", "flute", "Flute", "Fl.", [59, 98]),
  player("picc", "piccolo", "Piccolo", "Picc.", [74, 108]),
];
// Only horns, trumpets, trombones and bass trombones have muted samples, so two bass trombones
// stand at the bottom (no tuba).
const BRASS: Player[] = [
  player("btbn", "bass-trombone", "Bass Trombone", "B. Tbn.", [28, 67]),
  player("btbn", "bass-trombone", "Bass Trombone", "B. Tbn.", [28, 67]),
  player("tbn", "trombone", "Trombone", "Tbn.", [40, 72]),
  player("tbn", "trombone", "Trombone", "Tbn.", [40, 72]),
  player("hn", "horn", "Horn", "Hn.", [34, 77]),
  player("hn", "horn", "Horn", "Hn.", [34, 77]),
  player("hn", "horn", "Horn", "Hn.", [34, 77]),
  player("hn", "horn", "Horn", "Hn.", [34, 77]),
  player("tpt", "trumpet", "Trumpet", "Tpt.", [54, 84]),
  player("tpt", "trumpet", "Trumpet", "Tpt.", [54, 84]),
  player("tpt", "trumpet", "Trumpet", "Tpt.", [54, 84]),
  player("tpt", "trumpet", "Trumpet", "Tpt.", [54, 84]),
];
const SCORE_ORDER = [
  "piccolo",
  "flute",
  "oboe",
  "cor-anglais",
  "clarinet",
  "bass-clarinet",
  "bassoon",
  "contrabassoon",
  "horn",
  "trumpet",
  "trombone",
  "bass-trombone",
];
/** Dynamic level of each colour: p, p, pp. */
const LEVEL: Record<Colour, number> = { strings: 3, winds: 3, brass: 2 };

export function score(v: Values<typeof knobs>) {
  const bar = 4 * TICKS;
  const families = familiesOf("Families", v.families);
  // Top down: voice 0 is the highest.
  const pitches = stack(v.anchor, v.chord, VOICES).reverse();
  const lastMove = TOGETHER + (VOICES - 1) * v.leave;
  const firstBack = lastMove + v.pause;
  const reverse = v.order === ORDERS[0];

  const voices = pitches.map((midi, k) => {
    const family = families[k % families.length]!;
    const atom = atomOf(family);
    // Voices move in turn, from the top; one longer, the next shorter, and so on.
    const moved = (PER_BEAT[family] + (k % 2 === 0 ? 1 : -1)) * atom;
    const moveAt = (TOGETHER + k * v.leave) * TICKS;
    const backAt = (firstBack + (reverse ? VOICES - 1 - k : k) * v.leave) * TICKS;
    const onsets: Onset[] = [];
    let t = 0;
    for (; t < moveAt; t += TICKS) onsets.push({ at: t, colour: "strings" });
    for (; t < backAt; t += moved) onsets.push({ at: t, colour: "winds" });
    // t is now the voice's first onset at or after its time to come back.
    return { midi, family, atom, onsets, back: t };
  });

  const end = (Math.ceil(Math.max(...voices.map((x) => x.back)) / bar) + AFTER) * bar;
  for (const x of voices) {
    // A one-beat between again, from wherever the voice is: on the beat, or off it.
    const colour: Colour = x.back % TICKS === 0 ? "strings" : "brass";
    for (let t = x.back; t < end; t += TICKS) x.onsets.push({ at: t, colour });
  }

  const dynamics = (c: Colour) =>
    curve([
      { at: 0, level: LEVEL[c] },
      { at: end - bar, level: LEVEL[c], ramp: true },
      { at: end, level: 0 },
    ]);
  const eventsOf = (x: (typeof voices)[number], c: Colour) => {
    const all = x.onsets;
    return all.flatMap((o, i) => {
      if (o.colour !== c) return [];
      if (c === "strings") return [note(o.at, x.atom, x.midi, { technique: "pizz" })];
      if (c === "winds") return [note(o.at, x.atom, x.midi, { articulations: ["staccato"] })];
      const next = all[i + 1]?.at ?? end;
      return [note(o.at, next - o.at, x.midi, { technique: "muted" })];
    });
  };

  // Players, handed out low to high: every voice has one in each group.
  const low = [...voices].reverse();
  const ranges = low.map((x): [number, number] => [x.midi, x.midi]);
  const strings = divisi(ranges);
  const winds = numberFromTop(inOrder(ranges, WINDS));
  const brass = numberFromTop(inOrder(ranges, BRASS));

  const partsOf = (players: Player[], c: Colour) =>
    low
      .map((x, i) => ({ p: players[i]!, events: eventsOf(x, c) }))
      .filter(({ events }) => events.length > 0)
      .map(({ p, events }) => part(p, events, dynamics(c)));
  const byScore = (a: { instrument: string; id: string }, b: { instrument: string; id: string }) =>
    SCORE_ORDER.indexOf(a.instrument) - SCORE_ORDER.indexOf(b.instrument) ||
    a.id.localeCompare(b.id);

  const out = scoreOf("antara · palette B · the families come back displaced", end / bar, v.tempo, [
    ...partsOf(winds, "winds").sort(byScore),
    ...partsOf(brass, "brass").sort(byScore),
    ...partsOf(strings, "strings").reverse(),
  ]);
  out.rehearsal = [{ measure: Math.floor(firstBack / 4) + 1, label: "return" }];
  return out;
}

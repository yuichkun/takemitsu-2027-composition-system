// antara palette, B: they leave, family by family.
//
// Uses the lines sketch "one by one, they leave" (../../../ideas/lines/a-peel-off), whose rule is
// copied here unchanged: ten players strike a chord again and again. Each time round one more
// player leaves the chord and sounds after it instead, one lag later than the one who left before,
// the lags drawn from a set in turn; after the last of the line, a rest, and the chord again. So
// the chord thins while the line behind it grows, until the ten sound one after another. Who leaves
// first is a rule: from the outside in, from the top down, or from the bottom up.
//
// Here the rule runs three times, in three choirs: the brass, the woodwinds, the strings
// pizzicato. Each choir counts its lags, rests and notes in the atoms of its own family. The
// numbers are the same in every choir; only the atom differs, so one rule runs at three speeds at
// once, on three grids. The choirs do not start together. The woodwinds start at the bar line of
// the bar where the brass have lost half their players (five of ten), the strings at the bar line
// of the bar where the woodwinds have lost half: each entry is read off the rule's own progress.
// Each choir leaves in its own order (from the outside, from the top, from the bottom: the three
// orders of the lines sketch, one each).
//
// The families are handed out so that each choir that enters counts in a longer atom than the one
// before it (5, then 2, then 3): its chord repeats more slowly than the chord before it did, so no
// entry is quicker than the opening, and the choir that starts last also ends last. All three play
// the same ten pitches: the chord's betweens stacked on the anchor, handed to each choir low to
// high (the lines sketch moved them by octaves into the brass's middle ranges; here they stay as
// stacked, so that the same ten pitches pass from choir to choir). The dynamics stay flat, at mp.
// Card: README.md.

import type { NoteEvent } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { A_CHORD } from "../../../ideas/lines/common.ts";
import {
  divisi,
  fold,
  inOrder,
  note,
  part,
  scoreOf,
  stack,
  stream,
  TICKS,
  type Player,
} from "../../common.ts";

const ORDERS = ["from the outside", "from the top", "from the bottom"];
const FIRST_HELP =
  "from the outside: the top, the bottom, the next from the top, the next from the bottom… · from the top · from the bottom";

export const knobs = {
  chord: betweenSet({
    group: "Chord",
    label: "Chord",
    help: "The betweens the chord is stacked from, bottom up, again and again (semitones, .5 for a quarter tone). The same ten pitches in every choir",
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
    max: "C4",
    step: 0.5,
  }),
  lags: betweenSet({
    group: "Rule (the same in every choir)",
    label: "Lags",
    help: "How far behind the one before it each leaving player sounds, in atoms of the choir's own family, taken in turn",
    value: "2 3 5",
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  rests: betweenSet({
    group: "Rule (the same in every choir)",
    label: "Rests",
    help: "Silence after the last player of each round before the chord comes again, in atoms of the choir's own family, taken in turn",
    value: "6 8",
    min: 1,
    max: 32,
    step: 1,
    unit: "atoms",
  }),
  enter: number({
    group: "Rule (the same in every choir)",
    label: "Next choir enters",
    help: "The next choir starts at the bar line of the bar where the choir before it has lost this many players",
    value: 5,
    min: 1,
    max: 9,
    step: 1,
    unit: "left",
  }),
  brassFamily: choice({
    group: "Brass (first)",
    label: "Family",
    help: "The atom the brass count in",
    value: FAMILY_OPTIONS[2]!,
    options: FAMILY_OPTIONS,
  }),
  brassFirst: choice({
    group: "Brass (first)",
    label: "Who leaves first",
    help: FIRST_HELP,
    value: ORDERS[0]!,
    options: ORDERS,
  }),
  windsFamily: choice({
    group: "Woodwinds (second)",
    label: "Family",
    help: "The atom the woodwinds count in",
    value: FAMILY_OPTIONS[0]!,
    options: FAMILY_OPTIONS,
  }),
  windsFirst: choice({
    group: "Woodwinds (second)",
    label: "Who leaves first",
    help: FIRST_HELP,
    value: ORDERS[1]!,
    options: ORDERS,
  }),
  stringsFamily: choice({
    group: "Strings pizzicato (third)",
    label: "Family",
    help: "The atom the strings count in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  stringsFirst: choice({
    group: "Strings pizzicato (third)",
    label: "Who leaves first",
    help: FIRST_HELP,
    value: ORDERS[2]!,
    options: ORDERS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 66,
    min: 40,
    max: 140,
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
): Player => ({ id, instrument, name, abbreviation, range, grids: [0, 1] });

// Low to high: the order the chord's tones take them in. Score order is the order of the arrays
// reversed within each instrument, then sorted by SCORE_ORDER.
const BRASS: Player[] = [
  player("tbn3", "trombone", "Trombone 3", "Tbn. 3", [40, 72]),
  player("tbn2", "trombone", "Trombone 2", "Tbn. 2", [40, 72]),
  player("tbn1", "trombone", "Trombone 1", "Tbn. 1", [40, 72]),
  player("hn4", "horn", "Horn 4", "Hn. 4", [34, 77]),
  player("hn3", "horn", "Horn 3", "Hn. 3", [34, 77]),
  player("hn2", "horn", "Horn 2", "Hn. 2", [34, 77]),
  player("hn1", "horn", "Horn 1", "Hn. 1", [34, 77]),
  player("tpt3", "trumpet", "Trumpet 3", "Tpt. 3", [54, 84]),
  player("tpt2", "trumpet", "Trumpet 2", "Tpt. 2", [54, 84]),
  player("tpt1", "trumpet", "Trumpet 1", "Tpt. 1", [54, 84]),
];
const WINDS: Player[] = [
  player("bsn2", "bassoon", "Bassoon 2", "Bsn. 2", [34, 75]),
  player("bsn1", "bassoon", "Bassoon 1", "Bsn. 1", [34, 75]),
  player("bcl", "bass-clarinet", "Bass Clarinet", "B. Cl.", [34, 77]),
  player("ca", "cor-anglais", "Cor anglais", "C. ingl.", [52, 81]),
  player("cl2", "clarinet", "Clarinet 2", "Cl. 2", [50, 94]),
  player("cl1", "clarinet", "Clarinet 1", "Cl. 1", [50, 94]),
  player("ob2", "oboe", "Oboe 2", "Ob. 2", [58, 93]),
  player("ob1", "oboe", "Oboe 1", "Ob. 1", [58, 93]),
  player("fl2", "flute", "Flute 2", "Fl. 2", [59, 98]),
  player("fl1", "flute", "Flute 1", "Fl. 1", [59, 98]),
];
const OWN = new Map([...BRASS, ...WINDS].map((p) => [p.id, p.range]));
const SCORE_ORDER = [
  "flute",
  "oboe",
  "cor-anglais",
  "clarinet",
  "bass-clarinet",
  "bassoon",
  "horn",
  "trumpet",
  "trombone",
];

/**
 * The rule of "one by one, they leave", unchanged, from `start` (ticks), counted in `atom`.
 * `tones` are the players' pitches. Returns each player's notes, the time and the number of
 * players gone at the start of every round, and the end (after the last rest).
 */
function peelOff(
  tones: number[],
  first: string,
  lags: number[],
  rests: number[],
  atom: number,
  start: number,
  extra: Partial<NoteEvent>,
) {
  const n = tones.length;
  const low = tones.map((_, i) => i).sort((a, b) => tones[a]! - tones[b]!);
  const leaving =
    first === ORDERS[1]
      ? [...low].reverse()
      : first === ORDERS[2]
        ? low
        : low.map((_, k) => (k % 2 === 0 ? low[n - 1 - k / 2]! : low[(k - 1) / 2]!));
  const lag = stream(lags, "shift each time", 1);
  const rest = stream(rests, "shift each time", 1);
  const gaps: number[] = []; // each leaver's lag, fixed when it leaves
  const events = tones.map(() => [] as NoteEvent[]);
  const rounds: { at: number; gone: number }[] = [];
  let t = start;
  // Round r: r players have left. The last round has everyone in the line; then one more to hear it.
  for (let r = 0; r < n + 1; r++) {
    const gone = leaving.slice(0, Math.min(r, n - 1));
    if (r > 0 && r <= n - 1) gaps.push(lag() * atom);
    rounds.push({ at: t, gone: gone.length });
    for (const i of low)
      if (!gone.includes(i))
        events[i]!.push(note(t, 2 * atom, tones[i]!, { articulations: ["accent"], ...extra }));
    let at = t;
    gone.forEach((i, k) => {
      at += gaps[k]!;
      events[i]!.push(note(at, 2 * atom, tones[i]!, extra));
    });
    t = at + 2 * atom + rest() * atom;
  }
  return { events, rounds, end: t };
}

export function score(v: Values<typeof knobs>) {
  const bar = 4 * TICKS;
  const chord = stack(v.anchor, v.chord, 10);
  const ranges = chord.map((m): [number, number] => [m, m]);
  const strings = divisi(ranges);
  const choirs = [
    { players: inOrder(ranges, BRASS), family: v.brassFamily, first: v.brassFirst, extra: {} },
    { players: inOrder(ranges, WINDS), family: v.windsFamily, first: v.windsFirst, extra: {} },
    {
      players: strings,
      family: v.stringsFamily,
      first: v.stringsFirst,
      extra: { technique: "pizz" },
    },
  ];

  let start = 0;
  const starts: number[] = [];
  const ran = choirs.map((c) => {
    starts.push(start);
    // inOrder and divisi hand back each voice's own pitch as its range, so fold into the player's
    // real range (the string sections chosen by divisi already hold their voice). With the default
    // chord and anchor nothing moves; a higher or lower anchor moves a tone by octaves.
    const tones = chord.map((m, k) => fold(m, OWN.get(c.players[k]!.id) ?? c.players[k]!.range));
    const out = peelOff(
      tones,
      c.first,
      v.lags,
      v.rests,
      atomOf(familyOf(c.family)),
      start,
      c.extra,
    );
    // The next choir: from the bar line of the bar where this one has lost `enter` players.
    const at = out.rounds.find((r) => r.gone === v.enter)?.at ?? out.end;
    start = Math.floor(at / bar) * bar;
    return out;
  });
  const end = Math.max(...ran.map((r) => r.end));
  const bars = Math.ceil(end / bar);

  const partsOf = (c: (typeof choirs)[number], k: number) =>
    c.players.map((p, i) => part(p, ran[k]!.events[i]!, [{ at: 0, level: 4 }]));
  const byScore = (a: { instrument: string }, b: { instrument: string }) =>
    SCORE_ORDER.indexOf(a.instrument) - SCORE_ORDER.indexOf(b.instrument);
  const high = <T>(xs: T[]) => [...xs].reverse();
  const out = scoreOf("antara · palette B · they leave, family by family", bars, v.tempo, [
    ...high(partsOf(choirs[1]!, 1)).sort(byScore),
    ...high(partsOf(choirs[0]!, 0)).sort(byScore),
    ...high(partsOf(choirs[2]!, 2)),
  ]);
  out.rehearsal = [
    { measure: starts[1]! / bar + 1, label: "woodwinds" },
    { measure: starts[2]! / bar + 1, label: "strings" },
  ];
  return out;
}

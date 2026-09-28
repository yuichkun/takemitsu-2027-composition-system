// antara palette, B: the chord nobody plays.
//
// Uses the A sketch "the unsounded origin" (../../a/time-unsounded-origin), whose logic is copied
// here: three lines, one per family (5: quintuplet 16ths, 2: 16ths, 3: triplet 8ths), share an
// origin on a beat, where the three grids meet, and add the same drawn group of time betweens from
// it both ways, after it and before it. Nothing stands on the origin: whoever would land on any
// origin is silenced. The rule draws one group per origin.
//
// Added here: a chord, and colour. Twelve voices are stacked from the anchor by the Chord set,
// bottom up, again and again. The voices are dealt to the three families from the top (5, 3, 2,
// again and again), so each family holds four tones spread over the whole register, and every
// stroke of a family line is its four tones at once (a time between of 0 inside the family). With
// the time set as given, within one origin's wings the three families never strike all at once (two
// of them sometimes meet); the
// one point where all three would is the origin, and it is silent: the twelve tones are never struck
// together. The chord exists only as three four-tone chords gathering round a point nobody plays.
//
// Origins come at spacings written per section, in beats (each number is the time from an origin to
// the next; after the last origin, to the end). From a chosen section on, the chord is stacked again
// at every origin, the set starting one between later: the wing approaching an origin carries the
// chord in force before it, the wing leaving it the next one, so the chord changes at a point nobody
// plays. With the colour rule on, from the second section on, every stroke before its origin is
// doubled by a woodwind and every stroke after it by a brass (the strings play both sides): a tone's
// colour is the name its side of the origin gives it. Where origins are close, the wing leaving one
// and the wing approaching the next share the time between them; a stroke standing after one origin
// and before the next is doubled by both. There, all three lines can land on one beat between the
// two origins, which would strike the whole chord at once: that beat is left unplayed, as an origin
// is (the one rule added to the A's). The rule holds wherever all three lines would meet, so other
// time sets whose own wings bring the three together keep the chord unplayed too.
//
// Strings, divided one part per voice, play every stroke pizzicato. Everything stays at p; the last
// origin is approached and not left, and nothing strikes at the end.
// Card: README.md.

import {
  betweenSet,
  choice,
  number,
  pitch,
  text,
  toggle,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer, setsOf, type Family } from "../../../between.ts";
import {
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

const RULES = ["shift each time", "in order"];

export const knobs = {
  chord: betweenSet({
    group: "Chord",
    label: "Chord",
    help: "The betweens the twelve voices are stacked from, bottom up, again and again (semitones, .5 for a quarter tone). A new stack starts the set one between later",
    value: "2.5 3 4.5 6",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  anchor: pitch({
    group: "Chord",
    label: "Anchor",
    help: "The lowest voice of the chord (it is the same in every stack)",
    value: "C2",
    min: "G1",
    max: "C3",
    step: 0.5,
  }),
  restack: number({
    group: "Chord",
    label: "Restack from section",
    help: "From the first origin of this section on, the chord is stacked again at every origin (the set starting one between later): the wing before an origin carries the old chord, the wing after it the new one. Beyond the last section: one chord throughout",
    value: 3,
    min: 1,
    max: 8,
    step: 1,
  }),
  set: betweenSet({
    group: "Time",
    label: "Set",
    help: "The time betweens every family line adds from the origin, both ways, in atoms of its own family",
    value: "1 2 3",
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  rule: choice({
    group: "Time",
    label: "Rule",
    help: "How each origin draws its group from the set. Shift each time: the set starting one later at every origin; in order: the same group every time",
    value: RULES[0]!,
    options: RULES,
  }),
  spacings: text({
    group: "Form",
    label: "Spacings",
    help: "Beats from each unsounded origin to the next, section by section (sections split by |). After the last origin, its number is the time to the end: that origin is only approached",
    value: "4 4 4 4 | 4 4 4 4 | 2 2 2 2 2 2 2 2 2 2 2 2 | 6 6 6",
    hint: "4 4 4 4 | 2 2 2 2 | 6 6",
  }),
  colour: toggle({
    group: "Colour",
    label: "Colour by side",
    help: "On: from the second section on, every stroke before its origin is doubled by a woodwind and every stroke after it by a brass (the strings play both sides). Off: strings alone",
    value: true,
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

const VOICES = 12;
/** The family of each voice, from the top voice down, again and again. */
const FAMILIES: Family[] = [5, 3, 2];
/** Every part at p, flat. */
const LEVEL = 3;

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

interface Origin {
  at: number;
  section: number;
  /** The group of time betweens drawn for it. */
  group: number[];
  /** The chord in force before it (its approaching wing) and after it (its leaving wing). */
  before: number;
  after: number;
}

/** One stroke of a family line: its four tones at once. */
interface Stroke {
  at: number;
  chord: number;
  /** Distance to the origin whose wing it is (the nearest one decides the chord). */
  dist: number;
  /** Doubled by a woodwind (before its origin) or a brass (after it). */
  winds: boolean;
  brass: boolean;
}

export function score(v: Values<typeof knobs>) {
  const bar = 4 * TICKS;
  const chordSet = [...v.chord];
  const timeSet = [...v.set];
  const sections = setsOf("Spacings", v.spacings);
  for (const s of sections)
    if (s.some((n) => !Number.isInteger(n) || n < 1))
      throw new Error("Spacings: whole beats, 1 or more (origins stand on beats)");

  // The chords: the set stacked from the anchor, starting one between later each time.
  const chords = chordSet.map((_, k) =>
    stack(v.anchor, [...chordSet.slice(k), ...chordSet.slice(0, k)], VOICES),
  );

  // Origins. The first: the first beat with room before it for the whole group in the longest atom.
  const draw = drawer(timeSet, v.rule, timeSet.length, "ascending");
  const reach = timeSet.reduce((a, b) => a + b, 0);
  const widest = Math.max(...FAMILIES.map(atomOf));
  let t = Math.ceil((reach * widest) / TICKS) * TICKS;
  let chord = 0;
  const origins: Origin[] = [];
  sections.forEach((spacings, s) => {
    for (const beats of spacings) {
      const before = chord;
      if (s + 1 >= v.restack) chord = (chord + 1) % chords.length;
      origins.push({ at: t, section: s, group: draw(), before, after: chord });
      t += beats * TICKS;
    }
  });
  const end = Math.ceil(t / bar) * bar;
  const silent = new Set(origins.map((o) => o.at));

  // Each family line's strokes, in ticks. A tick given twice (by neighbouring origins) sounds once,
  // doubled by the colours of both sides.
  const lines = new Map<Family, Map<number, Stroke>>(FAMILIES.map((f) => [f, new Map()]));
  const give = (f: Family, at: number, c: number, dist: number, side: "winds" | "brass" | null) => {
    if (at < 0 || at >= end || silent.has(at)) return;
    const line = lines.get(f)!;
    const had = line.get(at);
    const s = had ?? { at, chord: c, dist, winds: false, brass: false };
    if (had && dist < had.dist) {
      s.chord = c;
      s.dist = dist;
    }
    if (side) s[side] = true;
    line.set(at, s);
  };
  origins.forEach((o, i) => {
    const coloured = v.colour && o.section >= 1;
    const last = i === origins.length - 1;
    let from = 0;
    for (const between of o.group) {
      from += between;
      for (const f of FAMILIES) {
        const d = from * atomOf(f);
        give(f, o.at - d, o.before, d, coloured ? "winds" : null);
        if (!last) give(f, o.at + d, o.after, d, coloured ? "brass" : null);
      }
    }
  });
  // Where the wing leaving one origin and the wing approaching the next overlap, all three lines
  // may land on one beat between them: the whole chord would be struck at once. That beat is
  // treated as the origin is: nobody plays it.
  const [a, ...others] = FAMILIES.map((f) => lines.get(f)!);
  const whole = [...a!.keys()].filter((at) => others.every((line) => line.has(at)));
  for (const at of whole) for (const line of lines.values()) line.delete(at);

  // Voices, bottom up; the families are dealt from the top.
  const voices = Array.from({ length: VOICES }, (_, k) => {
    const family = FAMILIES[(VOICES - 1 - k) % FAMILIES.length]!;
    const strokes = [...lines.get(family)!.values()]
      .sort((a, b) => a.at - b.at)
      .map((s) => ({ ...s, midi: chords[s.chord]![k]! }));
    return { family, atom: atomOf(family), strokes };
  });
  const ranges = voices.map((x, k): [number, number] => {
    const ms = x.strokes.length ? x.strokes.map((s) => s.midi) : [chords[0]![k]!];
    return [Math.min(...ms), Math.max(...ms)];
  });

  // Every voice has a string part, a woodwind and a brass, handed out low to high by register.
  const strings = divisi(ranges);
  const winds = numberFromTop(inOrder(ranges, WINDS));
  const brass = numberFromTop(inOrder(ranges, BRASS));

  type Colour = "strings" | "winds" | "brass";
  const eventsOf = (x: (typeof voices)[number], c: Colour) =>
    x.strokes
      .filter((s) => c === "strings" || s[c])
      .map((s) =>
        c === "strings"
          ? note(s.at, x.atom, s.midi, { technique: "pizz" })
          : note(s.at, x.atom, s.midi, { articulations: ["staccato"] }),
      );
  const partsOf = (players: Player[], c: Colour) =>
    voices
      .map((x, k) => ({ p: players[k]!, events: eventsOf(x, c) }))
      .filter(({ events }) => events.length > 0)
      .map(({ p, events }) => part(p, events, [{ at: 0, level: LEVEL }]));
  const byScore = (a: { instrument: string; id: string }, b: { instrument: string; id: string }) =>
    SCORE_ORDER.indexOf(a.instrument) - SCORE_ORDER.indexOf(b.instrument) ||
    a.id.localeCompare(b.id);

  const out = scoreOf("antara · palette B · the chord nobody plays", end / bar, v.tempo, [
    ...partsOf(winds, "winds").sort(byScore),
    ...partsOf(brass, "brass").sort(byScore),
    ...partsOf(strings, "strings").reverse(),
  ]);

  // A mark where each section begins, saying what begins there.
  out.rehearsal = sections.flatMap((spacings, s) => {
    if (s === 0) return [];
    const o = origins.find((x) => x.section === s)!;
    const what: string[] = [];
    if (v.colour && s === 1) what.push("colour");
    if (s + 1 === v.restack) what.push("restack");
    if (spacings[0] !== sections[s - 1]!.at(-1)) what.push(`every ${spacings[0]}`);
    return what.length ? [{ measure: Math.floor(o.at / bar) + 1, label: what.join(" · ") }] : [];
  });
  return out;
}

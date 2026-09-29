// antara palette, B: the standpoint is the timpani; a crossing is heard as a glide or as two strikes.
//
// Uses the A sketch "the chord turns over across a between" (../../a/pitch-cross-a-between), whose
// rule is copied here: a chord is a standpoint and a set of signed betweens measured from it. At each
// turn the standpoint crosses one between of the set (in the written order, one per turn, twice
// round) to the tone across; from there the same cut is seen from its other side, every between is
// read the other way round, and the chord is turned over about the middle of the between crossed.
// Tones in both the old and the new chord hold; the others, low to high, take the new tones, low to
// high.
//
// Here the standpoint tone is the timpanist's line, on four pedal drums whose reaches are the drums'
// own (a table, not values chosen). A crossing whose two ends both lie in one drum's reach is a
// GLIDE: the timpanist strikes the standpoint at the turn, lets it ring a beat, then pedals across
// the between while the stroke still sounds (a single stroke decays, so the slide starts early and
// takes most of the time between) and arrives on the new standpoint exactly at the next turn,
// where it is struck again. The between is heard as a continuum: the cut itself. A crossing no
// drum can span is a JUMP: the old standpoint rings, and the new one is struck at the next turn on
// another drum. Only the two terms are heard. The same size of between can be either, by where it
// stands.
//
// Eight low winds and brass hold the chord, one tone each, and turn over at every turn (a new tone
// comes in mp and sinks to p within a beat; held tones keep sounding). Eight string voices, con
// sord. and pp, double the chord but turn over only at a glide: at a jump every string keeps its
// pitch, so two chords sound at once (the winds' new one and the strings' last heard one). At the
// next glide the strings catch up, applying the same held/movers rule against their own pitches.
// The strings take the turn only where the cut is heard.
//
// Playback: a glide is one struck key whose tuning slides (BBC SO's Global Tune), and a run of notes
// sliding into one another is played as a single key. So each turn is written in the other voice of
// the timpani staff from the turn before: a glide slides into a short arrival note in its own voice,
// and the stroke on the arrival (the next turn) is a new note in the other voice.
// After the last turn the winds hold their chord and the strings theirs for two time betweens,
// fading over the last one; the timpani's last stroke rings.
// Card: README.md.

import type { NoteEvent } from "../../../../../src/score/types.ts";
import {
  choice,
  number,
  numbersOf,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import {
  curve,
  inOrder,
  note,
  numberFromTop,
  part,
  scoreOf,
  TICKS,
  time,
  type Player,
} from "../../common.ts";

export const knobs = {
  betweens: text({
    group: "Chord",
    label: "Betweens from the standpoint",
    help: "The chord's betweens measured from the standpoint (semitones, − below it, .5 for a quarter tone), in the order the standpoint crosses them: one per turn, twice round. The standpoint itself is always in the chord. With an odd count the chord ends where it began",
    value: "1.5 2 -4.5 -3.5 5 6 7.5",
  }),
  standpoint: pitch({
    group: "Chord",
    label: "Standpoint",
    help: "Where the chord starts standing, and the timpani's first stroke. It moves at every turn, to the tone across the between crossed; it must stay within the drums' reach (D2–A3)",
    value: "Bb2",
    min: "D2",
    max: "A3",
    step: 0.5,
  }),
  between: number({
    group: "Time",
    label: "Time between",
    help: "The one time between of the time set, in atoms of the family: the chord turns over this far after the last turn",
    value: 15,
    min: 2,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  slide: number({
    group: "Time",
    label: "Pedal slide",
    help: "How long the timpani's pedal takes to cross a between one drum can reach, ending at the next turn (atoms of the family). Before it, the stroke rings on its own pitch",
    value: 12,
    min: 1,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time between and the slide count in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
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

/**
 * The four pedal drums' reaches, sounding MIDI: the usual spans of the 32, 29, 26 and 23 inch
 * drums (D2–A2, F2–C3, B♭2–F3, D3–A3). They are the instrument's own, not values chosen.
 */
const DRUMS: [number, number][] = [
  [38, 45],
  [41, 48],
  [46, 53],
  [50, 57],
];
const holds = ([lo, hi]: [number, number], ...ms: number[]) => ms.every((m) => m >= lo && m <= hi);

/** The chord: the standpoint, and the standpoint plus each between read in the given direction. */
const chordOf = (s: number, sign: number, set: number[]) =>
  [s, ...set.map((d) => s + sign * d)].sort((a, b) => a - b);

interface Seg {
  at: number;
  midi: number;
}

/**
 * Turns voices over to a new chord (the A's rule): a voice whose pitch is in the new chord holds it;
 * the others, low to high, take the new chord's free tones, low to high.
 */
function turnOver(voices: Seg[][], next: number[], at: number) {
  const now = voices.map((xs) => xs.at(-1)!.midi);
  const keep = new Set(now.filter((m) => next.includes(m)));
  const free = next.filter((m) => !keep.has(m));
  const movers = voices
    .map((xs, k) => ({ k, m: now[k]! }))
    .filter(({ m }) => !keep.has(m))
    .sort((a, b) => a.m - b.m);
  movers.forEach(({ k }, i) => voices[k]!.push({ at, midi: free[i]! }));
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

// Low to high by each instrument's lowest note: the order the voices take them in, by their own
// lowest notes. One is left over.
const WINDS: Player[] = [
  player("tba", "tuba", "Tuba", "Tba.", [26, 65]),
  player("btbn", "bass-trombone", "Bass Trombone", "B. Tbn.", [28, 67], 1),
  player("bsn2", "bassoon", "Bassoon 2", "Bsn. 2", [34, 75]),
  player("bsn1", "bassoon", "Bassoon 1", "Bsn. 1", [34, 75]),
  player("bcl", "bass-clarinet", "Bass Clarinet", "B. Cl.", [34, 77]),
  player("tbn2", "trombone", "Trombone 2", "Tbn. 2", [40, 72]),
  player("tbn1", "trombone", "Trombone 1", "Tbn. 1", [40, 72]),
  player("hn2", "horn", "Horn 2", "Hn. 2", [34, 77]),
  player("hn1", "horn", "Horn 1", "Hn. 1", [34, 77]),
];
const SCORE_ORDER = [
  "bass-clarinet",
  "bassoon",
  "horn",
  "trombone",
  "bass-trombone",
  "tuba",
  "timpani",
  "cellos",
  "basses",
];

/**
 * Strings: the cellos' lowest note, and the highest the basses' recorded notes reach (the section
 * plays higher; the playback does not). A string voice reaching past both is played by two parts.
 */
const CELLOS_LOW = 36;
const BASSES_TOP = 54;
const BASSES_LOW = 28;

/** Levels: winds, a wind that has just moved, strings, timpani (p, mp, pp, mp). */
const WINDS_LEVEL = 3;
const MOVED_LEVEL = 4;
const STRINGS_LEVEL = 2;
const TIMPANI_LEVEL = 4;

export function score(v: Values<typeof knobs>) {
  // The standpoint (0) is always in; a between written twice is one tone.
  const label = "Betweens from the standpoint";
  const written = numbersOf(label, v.betweens.replaceAll("−", "-"));
  if (written.some((d) => !Number.isInteger(d * 2) || Math.abs(d) > 12))
    throw new Error(`${label}: semitones on the quarter-tone grid, at most 12 each way (1.5, -4)`);
  const set = [...new Set(written.filter((d) => d !== 0))];
  if (set.length === 0) throw new Error(`${label}: give at least one besides 0`);
  if (set.length > WINDS.length - 1)
    throw new Error(`${label}: at most ${WINDS.length - 1} besides 0 (one wind player to a tone)`);
  if (v.slide > v.between)
    throw new Error("Pedal slide: at most the time between (the slide ends at the next turn)");

  const atom = atomOf(familyOf(v.family));
  const gap = v.between * atom;
  const turns = 2 * set.length;
  const bar = 4 * TICKS;

  // The standpoint's path and the chord after each turn.
  const path = [v.standpoint];
  const chords = [chordOf(v.standpoint, 1, set)];
  let sign = 1;
  for (let j = 0; j < turns; j++) {
    const t = path[j]! + sign * set[j % set.length]!;
    sign = -sign;
    path.push(t);
    chords.push(chordOf(t, sign, set));
  }
  const off = path.filter((m) => !DRUMS.some((d) => holds(d, m)));
  if (off.length > 0)
    throw new Error(
      `Standpoint: the standpoint leaves the drums' reach (${DRUMS[0]![0]}–${DRUMS.at(-1)![1]}) at ${off.join(", ")}`,
    );
  // A turn glides when one drum's reach holds both ends of the between crossed.
  const glides = path.slice(0, -1).map((s, j) => DRUMS.some((d) => holds(d, s, path[j + 1]!)));

  // Winds turn over at every turn; strings only at a glide, against their own last pitches.
  const winds: Seg[][] = chords[0]!.map((m) => [{ at: 0, midi: m }]);
  const strings: Seg[][] = chords[0]!.map((m) => [{ at: 0, midi: m }]);
  for (let j = 0; j < turns; j++) {
    const at = (j + 1) * gap;
    turnOver(winds, chords[j + 1]!, at);
    if (glides[j]) turnOver(strings, chords[j + 1]!, at);
  }

  const last = turns * gap;
  const end = Math.ceil((last + 2 * gap) / bar) * bar;
  const fadeFrom = Math.max(last, end - gap);

  const rangeOf = (xs: Seg[]): [number, number] => [
    Math.min(...xs.map((x) => x.midi)),
    Math.max(...xs.map((x) => x.midi)),
  ];

  // Winds: players low to high, handed out by each voice's lowest pitch (the voices cross one
  // another, so their order on the first chord does not say which one reaches lowest).
  const byFloor = winds
    .map((xs, k) => ({ k, r: rangeOf(xs) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1]);
  const handed = inOrder(
    byFloor.map((x) => x.r),
    WINDS,
  );
  const windPlayers = numberFromTop(
    winds.map((_, k) => handed[byFloor.findIndex((x) => x.k === k)]!),
  );
  for (const [k, p] of windPlayers.entries()) {
    const [lo, hi] = rangeOf(winds[k]!);
    const own = WINDS.find((w) => w.instrument === p.instrument)!.range;
    if (lo < own[0] || hi > own[1])
      throw new Error(
        `Standpoint: a wind voice reaches ${lo}–${hi}, outside the ${p.name} (${own[0]}–${own[1]})`,
      );
  }
  const windParts = winds.map((xs, k) => {
    const events = xs.map((x, i) => note(x.at, (xs[i + 1]?.at ?? end) - x.at, x.midi));
    // Held tones p; a tone that has just come in is mp and sinks to p within a beat.
    const points: { at: number; level: number; ramp?: boolean }[] = [{ at: 0, level: WINDS_LEVEL }];
    for (const [i, x] of xs.entries()) {
      if (i === 0) continue;
      const until = Math.min(xs[i + 1]?.at ?? end, x.at + TICKS);
      points.push({ at: x.at, level: MOVED_LEVEL, ramp: true }, { at: until, level: WINDS_LEVEL });
    }
    points.push({ at: fadeFrom, level: WINDS_LEVEL, ramp: true }, { at: end, level: 0 });
    return part(windPlayers[k]!, events, curve(points));
  });

  // Strings: one player to a voice (every voice the same weight), con sord., pp throughout. A voice
  // in the cellos' register is a cello; one reaching below it is a bass; one reaching both below the
  // cellos and above the basses' recorded top is played by two parts, its notes below the cellos in
  // a bass and the others in a cello. Every note handed over is a new tone either way.
  type Lane = { x: Seg; stop: number }[];
  const lanes: Lane[] = strings.flatMap((xs) => {
    const spans: Lane = xs.map((x, i) => ({ x, stop: xs[i + 1]?.at ?? end }));
    const [lo, hi] = rangeOf(xs);
    if (lo < BASSES_LOW)
      throw new Error(`Standpoint: a string voice reaches ${lo}, below the basses (${BASSES_LOW})`);
    if (!(lo < CELLOS_LOW && hi > BASSES_TOP)) return [spans];
    return [
      spans.filter(({ x }) => x.midi < CELLOS_LOW),
      spans.filter(({ x }) => x.midi >= CELLOS_LOW),
    ];
  });
  const laneRange = (l: Lane) => rangeOf(l.map(({ x }) => x));
  lanes.sort((a, b) => {
    const [ra, rb] = [laneRange(a), laneRange(b)];
    return ra[0] - rb[0] || ra[1] - rb[1];
  });
  const stringPlayers = numberFromTop(
    lanes.map((l) => {
      const r = laneRange(l);
      return r[0] < CELLOS_LOW
        ? player("cb", "basses", "Contrabass", "Cb.", r, 1)
        : player("vc", "cellos", "Violoncello", "Vc.", r, 1);
    }),
  );
  const stringParts = lanes.map((l, k) =>
    part(
      stringPlayers[k]!,
      l.map(({ x, stop }) => note(x.at, stop - x.at, x.midi, { technique: "con-sord" })),
      curve([
        { at: 0, level: STRINGS_LEVEL },
        { at: fadeFrom, level: STRINGS_LEVEL, ramp: true },
        { at: end, level: 0 },
      ]),
    ),
  );

  // Timpani: a stroke at every turn, on the standpoint. Turn j is written in voice 1 or 2 by turn, so
  // a glide's arrival (a short note in the glide's voice) and the stroke on it (the next turn, in
  // the other voice) are two notes, and every turn is a new stroke in playback.
  const voiceOf = (j: number) => (j % 2) + 1;
  const timpani: NoteEvent[] = [];
  for (let j = 0; j < turns; j++) {
    const at = j * gap;
    if (glides[j]) {
      timpani.push(
        note(at, gap, path[j]!, {
          voice: voiceOf(j),
          gliss: true,
          glissAfter: time(gap - v.slide * atom),
        }),
        note(at + gap, atom, path[j + 1]!, { voice: voiceOf(j) }),
      );
    } else timpani.push(note(at, gap, path[j]!, { voice: voiceOf(j) }));
  }
  timpani.push(note(last, end - last, path[turns]!, { voice: voiceOf(turns) }));
  const timpaniPart = part(
    player("timp", "timpani", "Timpani", "Timp.", [DRUMS[0]![0], DRUMS.at(-1)![1]]),
    timpani,
    curve([{ at: 0, level: TIMPANI_LEVEL }]),
  );

  // Score order: winds, brass, timpani, strings; within an instrument, from the top.
  const middle = (p: { events: NoteEvent[] | unknown[] }) => {
    const ms = (p.events as NoteEvent[]).map((e) => (e.pitch as { midi: number }).midi);
    return Math.min(...ms) + Math.max(...ms);
  };
  const parts = [...windParts, timpaniPart, ...stringParts].sort(
    (a, b) =>
      SCORE_ORDER.indexOf(a.instrument) - SCORE_ORDER.indexOf(b.instrument) ||
      middle(b) - middle(a),
  );
  return scoreOf("antara · palette B · a glide or two strikes", end / bar, v.tempo, parts);
}

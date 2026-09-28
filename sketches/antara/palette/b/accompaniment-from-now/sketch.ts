// antara palette, B: the accompaniment the melody leaves.
//
// Uses the A sketch "what rings on is seen from now" (../../a/texture-ring-from-now; its rule is
// copied here, not imported): every new tone is a standpoint, and every earlier tone still sounding
// rings on only if its between with the standpoint (the size, either direction) is one of the sizes
// of the set; otherwise it is stopped at that very onset (and the same pitch sounded again ends it
// too).
//
// Here the rule writes an accompaniment. A solo clarinet walks one line: the standpoint plus the
// betweens a rule draws from the set, walking on; a between that would leave the band is taken the
// other way (same size, opposite direction). Each melody tone is taken up at its onset by a divided
// string part on the same pitch, con sordino, and the strings hold it for as long as the rule lets
// it ring. So nobody writes the accompaniment's chords: they are the earlier melody tones that stand
// in relation to where the melody is now. How many tones sound at once comes from the additive
// relations inside the set (a size that is the sum of two others lets three tones ring together).
//
// The set moves in stages of equal numbers of steps, each stage moving one size of the set by a
// quarter tone, and the rule starts again from its first group at each new stage. The size check
// always uses the stage of the new onset. Time: the onsets are added from the time set, drawn in
// order and starting one later each time round, in one family. After the last onset the clarinet's
// last tone and whatever the strings still hold ring on for RING beats and fade to nothing.
//
// A new held tone goes to the free string part that has been free longest, among those whose range
// holds it (ties: in score order).
// Card: README.md.

import {
  betweenSet,
  choice,
  number,
  pitch,
  pitchRange,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS, pitchSetsOf, RULES } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

/** After the last onset, the last tones ring on for RING beats, fading to nothing. */
const RING = 4;
/** Betweens drawn at a time by the combinations rule. */
const GROUP = 2;
/** Levels: the clarinet p, the strings pp. */
const MELODY_LEVEL = 3;
const HELD_LEVEL = 2;

export const knobs = {
  set: text({
    group: "Pitch",
    label: "Set",
    help: "Signed betweens in semitones (.5 for a quarter tone). The clarinet walks by them; their sizes (without sign) decide which earlier tones the strings keep. Stages split by | take turns, each for the same number of steps",
    value: "-7.5 -5 1.5 4 | -7.5 -5.5 1.5 4 | -7 -5.5 1.5 4 | -7 -5 1.5 4",
  }),
  perStage: number({
    group: "Pitch",
    label: "Steps per stage",
    help: "How many steps of the line each stage of the set lasts",
    value: 24,
    min: 1,
    max: 96,
    step: 1,
    unit: "steps",
  }),
  rule: choice({
    group: "Pitch",
    label: "Rule",
    help: "How the line draws from the set, starting again at each stage. combinations: every pair of the set, in dictionary order · shift each time: the set in order, starting one later each time round · in order: the set as written",
    value: "combinations",
    options: [...RULES],
  }),
  anchor: pitch({
    group: "Pitch",
    label: "Standpoint",
    help: "The first tone of the line",
    value: 64,
    min: "D3",
    max: "C7",
    step: 0.5,
  }),
  band: pitchRange({
    group: "Pitch",
    label: "Band",
    help: "A between that would take the line out of it is taken the other way (same size, opposite direction)",
    value: [58, 82],
    min: "G3",
    max: "C7",
    step: 0.5,
  }),
  time: betweenSet({
    group: "Time",
    label: "Time betweens",
    help: "The time from one onset to the next, in atoms of the family, taken in order, starting one later each time round",
    value: "2 4 5",
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time betweens count in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 76,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

const CLARINET: Player = {
  id: "cl",
  instrument: "clarinet",
  name: "Clarinet",
  abbreviation: "Cl.",
  range: [50, 94],
  grids: [0, 1],
};

const divided = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  players: number,
  range: [number, number],
): Player => ({ id, instrument, name, abbreviation, players, range, grids: [0, 1] });

// In score order; a held tone goes to the free part (with the tone in its range) that has been free
// longest, ties in this order.
const STRINGS: Player[] = [
  divided("vn1-1", "violins-1", "Violins I 1", "Vn. I 1", 8, [55, 103]),
  divided("vn1-2", "violins-1", "Violins I 2", "Vn. I 2", 8, [55, 103]),
  divided("vn2-1", "violins-2", "Violins II 1", "Vn. II 1", 7, [55, 100]),
  divided("vn2-2", "violins-2", "Violins II 2", "Vn. II 2", 7, [55, 100]),
  divided("va-1", "violas", "Violas 1", "Va. 1", 6, [48, 91]),
  divided("va-2", "violas", "Violas 2", "Va. 2", 6, [48, 91]),
];

interface Tone {
  at: number;
  midi: number;
  end: number;
  /** The string part holding it. */
  holder: number;
}

/** The line, its onsets, and each held tone with the onset where the rule stops it (or the end). */
function walk(v: Values<typeof knobs>) {
  const sets = pitchSetsOf("Set", v.set);
  const [lo, hi] = v.band;
  if (v.anchor < lo || v.anchor > hi) throw new Error("Standpoint: put it inside the band");
  const steps = v.perStage * sets.length;
  const atom = atomOf(familyOf(v.family));
  const nextTime = stream(v.time, "shift each time", 1);

  const onsets: number[] = [0];
  for (let i = 1; i <= steps; i++) onsets.push(onsets[i - 1]! + nextTime() * atom);

  const line: number[] = [];
  const held: Tone[] = [];
  let sounding: Tone[] = [];
  const freeSince = STRINGS.map(() => -Infinity);
  const busy = STRINGS.map(() => false);
  let stage = -1;
  let draw = () => 0;
  let sizes = new Set<number>();
  let current = v.anchor;
  onsets.forEach((at, i) => {
    const s = i === 0 ? 0 : Math.floor((i - 1) / v.perStage);
    if (s !== stage) {
      stage = s;
      const set = sets[s]!;
      draw = stream(set, v.rule, GROUP);
      sizes = new Set(set.map(Math.abs));
    }
    if (i > 0) {
      const b = draw();
      const next = current + b;
      const back = current - b;
      if (next >= lo && next <= hi) current = next;
      else if (back >= lo && back <= hi) current = back;
      else throw new Error("Band: too narrow for the set");
    }
    line.push(current);
    // The new tone is the standpoint: an earlier tone the strings hold rings on only if its between
    // with it is a size of this stage's set (0 is the melody sounding that pitch again).
    sounding = sounding.filter((q) => {
      const b = Math.abs(current - q.midi);
      if (b !== 0 && sizes.has(b)) return true;
      q.end = at;
      busy[q.holder] = false;
      freeSince[q.holder] = at;
      return false;
    });
    let holder = -1;
    STRINGS.forEach((p, k) => {
      const [bottom, top] = p.range;
      if (busy[k] || current < bottom || current > top) return;
      if (holder < 0 || freeSince[k]! < freeSince[holder]!) holder = k;
    });
    if (holder < 0)
      throw new Error("No free string part can hold this tone (too many at once, or out of range)");
    busy[holder] = true;
    const t: Tone = { at, midi: current, end: 0, holder };
    sounding.push(t);
    held.push(t);
  });
  const last = onsets.at(-1)!;
  const end = last + RING * TICKS;
  for (const q of sounding) q.end = end;
  return { onsets, line, held, last, end };
}

export function score(v: Values<typeof knobs>) {
  const { onsets, line, held, last, end } = walk(v);
  const fade = (level: number) =>
    curve([
      { at: 0, level },
      { at: last, level, ramp: true },
      { at: end, level: 0 },
    ]);

  // The melody: each tone to the next onset, tongued separately; the last one rings on.
  const melody = line.map((m, i) => note(onsets[i]!, (onsets[i + 1] ?? end) - onsets[i]!, m));
  const parts = [part(CLARINET, melody, fade(MELODY_LEVEL))];

  STRINGS.forEach((p, k) => {
    const events = held
      .filter((t) => t.holder === k)
      .map((t) => note(t.at, t.end - t.at, t.midi, { technique: "con-sord" }));
    if (events.length) parts.push(part(p, events, fade(HELD_LEVEL)));
  });

  return scoreOf(
    "antara · palette B · the accompaniment the melody leaves",
    Math.ceil(end / (4 * TICKS)),
    v.tempo,
    parts,
  );
}

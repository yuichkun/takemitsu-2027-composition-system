// antara palette, B: zeros fan out and gather.
//
// Uses "zeros spread through the set" (ideas/lines/b-zeros-spread): the betweens of a line keep
// their sizes, and at every stage one more 0 joins the set, drawn by "shift each time"; at the last
// stage only 0 is left. A 0 is a between too: the same note again. Its logic is copied here, not
// imported.
//
// Here the stages sound at once, as seven voices of one line (a heterophony). The line is its
// standpoint plus the betweens of the Line set, drawn by "shift each time" (a step that would leave
// the band is taken the other way). Every voice plays this one line. Voice k draws its own steps
// from the line's steps plus k zeros (stage k of b-zeros-spread): a step walks on to the next note
// of the line, a 0 stays on the note. So the voices differ only in where they are on the line, and
// the vertical between of two voices is the sum of the line's own betweens from one to the other:
// one line sounding as a chord of its own points.
//
// Four stages, one pulse (a set holding one between) for all:
// - Unison: the seven voices walk the line together, twice through its set.
// - Fan: each voice draws from its own set. A 0 is struck again (the treading of b-zeros-spread),
//   and the voice falls one step behind. Lasts Fan turns of the slowest voice's set.
// - Gather: the leader stays where it is, and here 0 is waiting: the note is held, not struck
//   again. The others walk on, one step of the line a note, down the road the leader took, and join
//   it one by one, each after as many notes as zeros it took in the fan; then they wait too.
// - Only 0: all seven on one pitch, held, to niente.
// The dynamics only fall (p, then pp through the gather, niente at the end); no arrival is
// accented, so the gathering is not a build-up. Colours go by lag, strings and winds in turn.
// The seven voices are one line and differ only in their zeros, so they weigh the same: each is
// two players (the strings a desk each, not the whole section), all on one dynamic curve, and the
// line sits in the middle of the range all seven sound in, so no voice plays at its range's edge.
// Card: README.md.

import type { Part, TextEvent } from "../../../../../src/score/types.ts";
import {
  choice,
  number,
  numbersOf,
  pitch,
  pitchRange,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, time, type Player } from "../../common.ts";

export const knobs = {
  line: text({
    group: "Line",
    label: "Line",
    help: "The betweens of the line, in the order written (semitones, .5 for a quarter tone, minus for down). Drawn by shift each time: the set as written, starting one later each time round. All seven voices walk this one line",
    value: "3.5 -1.5 1 -4 0.5",
  }),
  standpoint: pitch({
    group: "Line",
    label: "Standpoint",
    help: "The first note of the line, where all seven voices start",
    value: "C+5",
    min: "B3",
    max: "C6",
    step: 0.5,
  }),
  band: pitchRange({
    group: "Line",
    label: "Band",
    help: "Where the line may go; every voice plays in it. A step that would leave it is taken the other way (the between's sign turned)",
    value: ["E+4", "A#5"],
    min: "B3",
    max: "C6",
    step: 0.5,
  }),
  fan: number({
    group: "Form",
    label: "Fan",
    help: "How long the voices fan out, in turns of the slowest voice's set (the line's steps and six 0s). The gather then lasts as many notes as the most zeros any voice took",
    value: 6,
    min: 1,
    max: 12,
    step: 1,
    unit: "turns",
  }),
  pulse: number({
    group: "Time",
    label: "Pulse",
    help: "The one time between of every voice, in atoms of the family (a set holding one between)",
    value: 2,
    min: 1,
    max: 8,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the pulse counts in",
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

/** Voice k takes k zeros: seven voices, the stages of b-zeros-spread with none to six 0s. */
const ZEROS = 6;
/** The unison lasts this many turns of the line's set. */
const UNISON_TURNS = 2;
/** Notes of the pulse the last stage (only 0) lasts, counting the last arrival. */
const LAST = 4;
/**
 * Players of every voice. The voices differ only in their zeros, so they weigh the same: a wind
 * voice plays without a rest and needs two to share the breath, and each string voice is two as
 * well (one desk of its section; the rest of the section is silent).
 */
const PLAYERS = 2;

const voice = (id: string, instrument: string, name: string, abbreviation: string): Player => ({
  id,
  instrument,
  name,
  abbreviation,
  players: PLAYERS,
  range: [59, 84],
  grids: [0, 1],
});

/** By lag: voice 0 never stays, voice 6 takes the most zeros. Strings and winds in turn. */
const VOICES: Player[] = [
  voice("vn1", "violins-1", `Violins I (${PLAYERS})`, `Vn. I (${PLAYERS})`),
  voice("fl", "flute", "Flutes 1·2", "Fl. 1·2"),
  voice("vn2", "violins-2", `Violins II (${PLAYERS})`, `Vn. II (${PLAYERS})`),
  voice("ob", "oboe", "Oboes 1·2", "Ob. 1·2"),
  voice("va", "violas", `Violas (${PLAYERS})`, `Va. (${PLAYERS})`),
  voice("cl", "clarinet", "Clarinets 1·2", "Cl. 1·2"),
  voice("vc", "cellos", `Violoncellos (${PLAYERS})`, `Vc. (${PLAYERS})`),
];
/** Score order: winds, then strings. */
const SCORE_ORDER = ["fl", "ob", "cl", "vn1", "vn2", "va", "vc"];

export function score(v: Values<typeof knobs>) {
  const steps = numbersOf("Line", v.line.replaceAll("−", "-"));
  if (steps.some((b) => !Number.isInteger(b * 2)))
    throw new Error("Line: betweens are semitones on the quarter-tone grid (3.5, -1.5, 1)");
  const [lo, hi] = v.band;
  if (v.standpoint < lo || v.standpoint > hi) throw new Error("Standpoint: put it inside the band");

  // Where each voice is on the line, note by note: a step walks on (1), a 0 stays.
  const unison = UNISON_TURNS * steps.length;
  const fan = v.fan * (ZEROS + steps.length);
  const at: number[][] = VOICES.map((_, k) => {
    const own = stream([...Array<number>(k).fill(0), ...steps.map(() => 1)], "shift each time", 1);
    const p = [0];
    for (let j = 0; j < unison; j++) p.push(p.at(-1)! + 1);
    for (let j = 0; j < fan; j++) p.push(p.at(-1)! + own());
    return p;
  });
  // Gather: the leader's place is the goal; those there wait, the others walk on to it.
  const goal = Math.max(...at.map((p) => p.at(-1)!));
  let gather = 0;
  while (at.some((p) => p.at(-1)! < goal)) {
    for (const p of at) p.push(Math.min(goal, p.at(-1)! + 1));
    gather++;
  }
  // Only 0.
  for (let j = 1; j < LAST; j++) for (const p of at) p.push(goal);
  const onsets = at[0]!.length;

  // The line itself, as far as the leader goes.
  const line = [v.standpoint];
  const draw = stream(steps, "shift each time", 1);
  while (line.length <= goal) {
    const here = line.at(-1)!;
    const b = draw();
    let next = here + b;
    if (next < lo || next > hi) next = here - b;
    if (next < lo || next > hi) throw new Error(`Band: too narrow for a between of ${b}`);
    line.push(next);
  }

  const pulse = v.pulse * atomOf(familyOf(v.family));
  const end = onsets * pulse;
  const struckUntil = unison + fan; // up to this note, a 0 is struck again; after it, held
  const gatherAt = (unison + fan) * pulse;
  const lastAt = (unison + fan + gather) * pulse;
  const dynamics = curve([
    { at: 0, level: 3 },
    { at: gatherAt, level: 3, ramp: true },
    { at: lastAt, level: 2, ramp: true },
    { at: end, level: 0 },
  ]);

  const parts: Part[] = VOICES.map((player, k) => {
    const p = at[k]!;
    const struck = p.flatMap((x, j) => (j === 0 || j <= struckUntil || x !== p[j - 1] ? [j] : []));
    const events = struck.map((j, i) =>
      note(j * pulse, ((struck[i + 1] ?? onsets) - j) * pulse, line[p[j]!]!),
    );
    return part({ ...player, range: v.band }, events, dynamics);
  });

  // Where the stages begin, above the top staff.
  const marks: [number, string][] = [
    [0, "unison"],
    [unison * pulse, "fan: a 0 struck again"],
    [gatherAt, "gather: a 0 held, arrivals senza accento"],
    [lastAt, "only 0"],
  ];
  parts.sort((a, b) => SCORE_ORDER.indexOf(a.id) - SCORE_ORDER.indexOf(b.id));
  parts[0]!.events.unshift(
    ...marks.map(([t, text]): TextEvent => ({ type: "text", at: time(t), text })),
  );

  return scoreOf(
    "antara · palette B · zeros fan out and gather",
    Math.ceil(end / (4 * TICKS)),
    v.tempo,
    parts,
  );
}

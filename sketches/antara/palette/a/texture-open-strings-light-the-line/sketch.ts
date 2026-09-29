// antara palette, A (texture): the open strings light the line.
//
// An open string is a standpoint nobody chose: it is where the instrument stands. Measured from
// it, only a few places have a name of their own, the places of its partials (2 to 6: 12, 19, 24,
// 28 and 31 semitones above it, put on the grid). A tone on such a place can be played as a natural
// harmonic; anywhere else it is played ord.
//
// One line (a standpoint, a set of betweens and a rule) is played in unison by four groups of
// strings: the violas and the cellos, each divided in two, one half in the usual tuning and one
// half (the twins) tuned a quarter tone high. The four groups stand on four different sets of open
// strings. The only rule: a tone is lit for a group (written as a natural harmonic) when it stands
// on a partial place of one of that group's open strings. So on one tone the harmonics may sound in
// the violas, in the cellos, in both, or nowhere, and the colour of the unison moves between the
// groups while the line itself is never cut. A tone lit for nobody is not missing anything: it is
// the dark cut between the lit ones.
//
// The twins' places lie a quarter tone off the usual ones, so a tone on the usual semitone grid can
// only be lit in the usual halves, and a tone a quarter tone off only in the twins: no tone is ever
// lit in a usual half and a twin at once, and the unlit halves always play the same pitch as
// everyone.
//
// The line: the set as written, starting one later each time round, until every place has started
// once (6 rounds of 6 for the default). A between that would leave the band is taken the other way.
// Time: the time set in order, again and again, in atoms of one family; each tone lasts to the next
// onset, the last is held two beats and fades. One level throughout, no accents, no slurs; nothing
// else differs between the groups.
//
// Playback bounds the band: the cellos' ord samples end at 82, and the violas' harmonic samples
// start at 72, above two viola places (67, and 67.5 in the twins) the band has to leave out. The
// twins are tuned up, not down, for the same reason: tuned down, the violas' twin C string would
// have a place at 71.5, and the band would shrink to 72-82, too narrow to turn the widest between
// back. Card: README.md.

import {
  betweenSet,
  choice,
  number,
  numbersOf,
  pitch,
  pitchRange,
  text,
  toggle,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

export const knobs = {
  set: text({
    group: "Line",
    label: "Set",
    help: "The betweens of the line (semitones, .5 for a quarter tone, − for down), in the order the rule reads them: as written, starting one later each time round, until every place has started once. Written as text to keep the order",
    value: "3.5 -4 1.5 3 -6.5 3",
    hint: "3.5 -4 1.5 3 -6.5 3",
  }),
  anchor: pitch({
    group: "Line",
    label: "Standpoint",
    help: "The first tone. It has to be inside the band",
    value: "D5",
    min: "G#4",
    max: "A#5",
    step: 0.5,
  }),
  band: pitchRange({
    group: "Line",
    label: "Band",
    help: "Where the line may go: a between that would leave it is taken the other way. It must be at least twice the widest between. Its ends are where every group can sound every tone both ways in playback",
    value: ["G#4", "A#5"],
    min: "G#4",
    max: "A#5",
    step: 0.5,
  }),
  time: betweenSet({
    group: "Time",
    label: "Time set",
    help: "The time betweens (onset to onset), in atoms of the family, taken in order again and again",
    value: "3 4 6",
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
  twins: toggle({
    group: "Players",
    label: "Twins",
    help: "Half of each section tuned a quarter tone high. Off: every half in the usual tuning, and tones a quarter tone off the usual grid are never lit",
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

/**
 * The places above an open string: partials 2 to 6 (12, 19.02, 24, 27.86, 31.02 semitones), put
 * on the grid.
 */
const PLACES = [12, 19, 24, 28, 31];
const VIOLAS = [48, 55, 62, 69];
const CELLOS = [36, 43, 50, 57];

interface Group {
  player: Player;
  open: number[];
}

function groupsOf(twins: boolean): Group[] {
  const lift = twins ? 0.5 : 0;
  const tuned = twins ? " (tuned ¼ tone high)" : "";
  const group = (
    id: string,
    instrument: string,
    name: string,
    abbreviation: string,
    players: number,
    open: number[],
  ): Group => ({
    player: { id, instrument, name, abbreviation, players, range: [0, 127], grids: [0, 1] },
    open,
  });
  return [
    group("va-1", "violas", "Violas 1", "Va. 1", 6, VIOLAS),
    group(
      "va-2",
      "violas",
      `Violas 2${tuned}`,
      "Va. 2",
      6,
      VIOLAS.map((o) => o + lift),
    ),
    group("vc-1", "cellos", "Violoncellos 1", "Vc. 1", 5, CELLOS),
    group(
      "vc-2",
      "cellos",
      `Violoncellos 2${tuned}`,
      "Vc. 2",
      5,
      CELLOS.map((o) => o + lift),
    ),
  ];
}

/** Whether a tone stands on a partial place of one of these open strings. */
const lit = (tone: number, open: number[]) => open.some((o) => PLACES.includes(tone - o));

/** The set as written, in order: semitones on the quarter-tone grid. */
function setOf(value: string): number[] {
  const set = numbersOf("Set", value.replaceAll("−", "-"));
  if (set.some((b) => !Number.isInteger(b * 2)))
    throw new Error("Set: betweens are semitones on the quarter-tone grid (2, 3.5, -4.5)");
  return set;
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

  // The line: the set as written, starting one later each time round, every place once.
  const next = stream(set, "shift each time", 1);
  const tones = [v.anchor];
  for (let i = 0; i < set.length * set.length; i++) {
    const b = next();
    const x = tones.at(-1)!;
    tones.push(x + b >= lo && x + b <= hi ? x + b : x - b);
  }

  // Onsets: the time set in order, again and again.
  const atom = atomOf(familyOf(v.family));
  const between = stream(v.time, "in order", 1);
  const onsets = [0];
  for (let i = 1; i < tones.length; i++) onsets.push(onsets.at(-1)! + between() * atom);
  const bar = 4 * TICKS;
  const last = onsets.at(-1)!;
  const hold = 2 * TICKS;
  const end = Math.ceil((last + hold) / bar) * bar;

  // p throughout; the last tone fades to nothing over its two beats.
  const dynamics = curve([
    { at: 0, level: 3 },
    { at: last, level: 3, ramp: true },
    { at: last + hold, level: 0 },
  ]);
  const parts = groupsOf(v.twins).map(({ player, open }) => {
    const events = tones.map((x, i) =>
      note(
        onsets[i]!,
        (onsets[i + 1] ?? last + hold) - onsets[i]!,
        x,
        lit(x, open) ? { technique: "harmonic" } : {},
      ),
    );
    return part(player, events, dynamics);
  });
  return scoreOf("antara · palette A · the open strings light the line", end / bar, v.tempo, parts);
}

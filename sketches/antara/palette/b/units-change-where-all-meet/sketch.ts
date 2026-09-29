// antara palette, B: the units change only where all meet.
//
// Uses the A sketch "one count, three units" (../../a/pitch-one-count-three-units), its mechanism
// copied here unchanged. A between is held as a count: how many quarter tones (the atom) it is. It
// becomes a size in semitones, a pitch to stand on, only once it is read in a unit: how many
// quarter tones one count is worth. One stream of counts is drawn once (the order written, starting
// one place later each pass) and every line reads the same counts. Each line stands at the
// standpoint plus the partial sum (the counts drawn so far) times its unit, halved into semitones;
// no octave folding. A negative unit turns the shape upside down; a unit of 0 stays on the
// standpoint.
//
// Where the partial sum is 0, every unit names the same pitch, the standpoint: the lines meet
// there, and nothing tells them apart. That is the only place a unit may change, as a line of time
// may change its family only where the families' grids meet. With counts summing to 0 the lines
// meet at the end of every pass (and, with these counts, nowhere inside one).
//
// Four lines, one for each group of instruments (a wind part and a string part, or two brass
// parts, playing the same notes). All units start at 0. At every meeting (the first onset is one)
// one line, in turn, takes the next unit written; after the units written, each line in turn takes
// 0 again, and the sketch ends at the meeting where all four are 0. So units come in one at a time
// and go back to 0 one at a time, and the kind of event changes with them: a thin line over the
// standpoint held, a pair in contrary motion, three and then four lines drawing one shape in
// proportional sizes (the held standpoint gone), the lines going back to it one by one, one large
// line alone, the standpoint.
//
// A line with unit 0 holds the standpoint without striking again (it names nothing new); a line
// with any other unit strikes at every count. A line whose unit goes to 0 arrives on the
// standpoint and holds it. Moving lines play p, holding lines pp; nothing marks a meeting. Time is
// its own set and rule, three time betweens against four counts, so no two passes share a rhythm.
// After the last meeting all four hold the standpoint for two more time betweens and fade.
//
// The counts and the units are written as text, not on a between-set ruler: the ruler keeps its
// betweens sorted by size, and here the order written is the rule.
// Card: README.md.

import {
  betweenSet,
  choice,
  number,
  numbersOf,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

export const knobs = {
  counts: text({
    group: "Pitch",
    label: "Counts",
    help: "The set of betweens as counts of quarter tones (whole numbers, not 0, − for down), in the order written. The rule reads them in this order, starting one place later each pass; all four lines read the same counts. They must sum to 0: where the counts drawn so far sum to 0, all four lines stand on the standpoint (a meeting), the only place a unit may change",
    value: "1 -3 8 -6",
  }),
  units: text({
    group: "Pitch",
    label: "Units",
    help: "The units handed out at the meetings, in this order: whole numbers of quarter tones per count (− turns the shape upside down, 0 holds the standpoint). At each meeting one line, in turn (the violas' group first), takes the next; after these, each line in turn takes 0, and the sketch ends at the meeting where all four are 0",
    value: "1 -2 3 -1 2 -3",
  }),
  anchor: pitch({
    group: "Pitch",
    label: "Standpoint",
    help: "Where all four start and meet. Nothing is folded into range: a line that leaves one of its instruments stops the sketch with an error",
    value: "C4",
    min: "C3",
    max: "C5",
    step: 0.5,
  }),
  time: betweenSet({
    group: "Time",
    label: "Time set",
    help: "The time betweens from one count to the next, in atoms of the family, read in turn, starting one place later each time round. One onset per count",
    value: "7 9 10",
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time betweens count in",
    value: FAMILY_OPTIONS[0]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 54,
    min: 40,
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
  players: number,
  range: [number, number],
): Player => ({ id, instrument, name, abbreviation, players, range, grids: [0, 1] });

/**
 * The four lines, in the order they take units: each a group of parts playing the same notes. The
 * groups were chosen by the range the units they take need (with the values given): 52–68, 48–72,
 * 48–72, 56–64. `range` is the instrument's own range.
 */
const GROUPS: Player[][] = [
  [
    player("cl", "clarinet", "Clarinets 1, 2", "Cl. 1, 2", 2, [50, 94]),
    player("va", "violas", "Violas", "Va.", 6, [48, 91]),
  ],
  [
    player("bsn", "bassoon", "Bassoons 1, 2", "Bsn. 1, 2", 2, [34, 75]),
    player("vc", "cellos", "Violoncellos", "Vc.", 5, [36, 84]),
  ],
  [
    player("hn", "horn", "Horns 3, 4", "Hn. 3, 4", 2, [34, 77]),
    player("tbn", "trombone", "Trombones 1, 2", "Tbn. 1, 2", 2, [40, 72]),
  ],
  [
    player("ca", "cor-anglais", "Cor anglais", "C. ingl.", 1, [52, 81]),
    player("vn2", "violins-2", "Violins II", "Vn. II", 6, [55, 100]),
  ],
];
/** Score order: woodwinds, brass, strings. */
const ORDER = ["ca", "cl", "bsn", "hn", "tbn", "vn2", "va", "vc"];

/** Levels: a moving line (p), a holding line (pp). */
const MOVING = 3;
const HOLDING = 2;
/** Time betweens held after the last meeting, fading. */
const TAIL = 2;
/** Counts drawn before giving up on the handing-out ever finishing. */
const LIMIT = 1000;

export function score(v: Values<typeof knobs>) {
  const counts = numbersOf("Counts", v.counts.replaceAll("−", "-"));
  if (counts.some((c) => !Number.isInteger(c) || c === 0))
    throw new Error("Counts: a count is a whole number of quarter tones, not 0 (1, -3, 8)");
  if (counts.reduce((a, b) => a + b, 0) !== 0)
    throw new Error(
      "Counts: they must sum to 0, or the lines never stand on the standpoint together again (1 -3 8 -6)",
    );
  const written = numbersOf("Units", v.units.replaceAll("−", "-"));
  if (written.some((u) => !Number.isInteger(u)))
    throw new Error("Units: a unit is a whole number of quarter tones per count (1 -2 3)");
  const lines = GROUPS.length;
  // The units handed out at the meetings: those written, then 0 for each line in turn.
  const handed = [...written, ...Array.from({ length: lines }, () => 0)];

  const atom = atomOf(familyOf(v.family));
  const nextCount = stream(counts, "shift each time", 1);
  const nextTime = stream(v.time, "shift each time", 1);

  // Walk the counts. `inForce[i]` holds the units that name the step into onset i (onset 0 has no
  // step before it; it takes the units of the step after it).
  const at = [0];
  const sums = [0];
  const inForce: number[][] = [];
  let units = Array.from({ length: lines }, () => 0);
  let meeting = 0;
  for (let i = 0; ; i++) {
    if (sums[i] === 0) {
      // A meeting: every unit names the standpoint here, so one line may take a new unit.
      units = [...units];
      units[meeting % lines] = handed[meeting]!;
      meeting++;
      if (meeting === handed.length) break;
    }
    if (i >= LIMIT) throw new Error("Units: too many to hand out; write fewer");
    at.push(at[i]! + nextTime() * atom);
    sums.push(sums[i]! + nextCount());
    inForce.push(units);
  }
  inForce.unshift(inForce[0]!);
  const last = at.length - 1;
  let end = at[last]!;
  for (let k = 0; k < TAIL; k++) end += nextTime() * atom;

  // Each line's pitch at every onset: the standpoint plus the partial sum times its unit, halved.
  const pitches = GROUPS.map((_, g) => sums.map((s, i) => v.anchor + (s * inForce[i]![g]!) / 2));
  GROUPS.forEach((group, g) => {
    const xs = pitches[g]!;
    const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
    for (const p of group)
      if (lo < p.range[0] || hi > p.range[1])
        throw new Error(
          `Standpoint: line ${g + 1} walks from ${lo} to ${hi}, outside the ${p.name}'s ${p.range[0]}–${p.range[1]}; move the Standpoint, or take smaller Counts or Units`,
        );
  });

  const parts = GROUPS.flatMap((group, g) => {
    const xs = pitches[g]!;
    const moving = (i: number) => inForce[i]![g]! !== 0;
    // A line strikes at the first onset, and at every onset its unit names.
    const strikes = xs.flatMap((_, i) => (i === 0 || moving(i) ? [i] : []));
    const events = strikes.map((i, k) => {
      const stop = k + 1 < strikes.length ? at[strikes[k + 1]!]! : end;
      return note(at[i]!, stop - at[i]!, xs[i]!);
    });
    const points: { at: number; level: number; ramp?: boolean }[] = [];
    for (const i of strikes) {
      const level = moving(i) ? MOVING : HOLDING;
      if (i < last && level === MOVING && !moving(i + 1)) {
        // Arrived on the standpoint with its unit gone to 0: it stays, falling back to pp.
        points.push({ at: at[i]!, level, ramp: true }, { at: at[i + 1]!, level: HOLDING });
      } else if (points.at(-1)?.level !== level || points.at(-1)?.ramp)
        points.push({ at: at[i]!, level });
    }
    const held = [...points].reverse().find((p) => p.at <= at[last]!)!.level;
    points.push({ at: at[last]!, level: held, ramp: true }, { at: end, level: 0 });
    const dynamics = curve(points);
    return group.map((p) => part(p, events, dynamics));
  });

  parts.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  const bar = 4 * TICKS;
  return scoreOf(
    "antara · palette B · the units change only where all meet",
    Math.ceil(end / bar),
    v.tempo,
    parts,
  );
}

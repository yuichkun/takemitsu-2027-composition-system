// antara palette, A (texture): the names trade at the unison.
//
// Three lines, each a standpoint plus the betweens its own set gives, drawn by one rule (the set in
// the order written, starting one later each time round), walking on. A step that would leave the
// shared band is taken the other way. The three lines differ only in the sizes of their betweens:
// narrow, middle, wide. The lines are computed first, as relations only; who plays them comes
// after, as names.
//
// Three winds of one register and three distinct colours (clarinet, oboe, flute) start on the
// narrow, middle and wide line. All three strike together at every onset, on a pulse (a time set
// holding one between). The one rule of naming: after an onset at which two lines sound the same
// pitch (their vertical between is 0, so nothing tells which line is which), the two instruments
// on those lines trade lines from the next onset on: each goes on with the other's line. Where
// two lines cross without a unison nothing changes; the instruments cross with them. A unison of
// all three turns the three round (none happens with the default values).
// Card: README.md.

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
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

/** The register all three instruments reach: the band has to stay inside it. */
const SHARED: [string, string] = ["B3", "A6"];

// The instruments, in the order of the lines they start on (line 1, 2, 3).
const PLAYERS: Player[] = [
  { id: "cl", instrument: "clarinet", range: [59, 93], grids: [0, 1] },
  { id: "ob", instrument: "oboe", range: [59, 93], grids: [0, 1] },
  { id: "fl", instrument: "flute", range: [59, 93], grids: [0, 1] },
];

const lineHelp = (who: string, which: string) =>
  `The betweens of the line the ${who} starts on (by default the ${which} one), in the order written: semitones, signed, .5 for a quarter tone. The rule reads them in this order, starting one later each time round`;

export const knobs = {
  line1: text({
    group: "Lines",
    label: "Line 1",
    help: lineHelp("clarinet", "narrow"),
    value: "-0.5 1.5 -1 0.5",
  }),
  from1: pitch({
    group: "Lines",
    label: "Line 1 from",
    help: "Line 1's standpoint: its first pitch",
    value: "E4",
    min: SHARED[0],
    max: SHARED[1],
    step: 0.5,
  }),
  line2: text({
    group: "Lines",
    label: "Line 2",
    help: lineHelp("oboe", "middle"),
    value: "-3 1.5 -2.5 3.5",
  }),
  from2: pitch({
    group: "Lines",
    label: "Line 2 from",
    help: "Line 2's standpoint: its first pitch",
    value: "C5",
    min: SHARED[0],
    max: SHARED[1],
    step: 0.5,
  }),
  line3: text({
    group: "Lines",
    label: "Line 3",
    help: lineHelp("flute", "wide"),
    value: "-6 8.5 -6.5 4.5",
  }),
  from3: pitch({
    group: "Lines",
    label: "Line 3 from",
    help: "Line 3's standpoint: its first pitch",
    value: "G#5",
    min: SHARED[0],
    max: SHARED[1],
    step: 0.5,
  }),
  band: pitchRange({
    group: "Lines",
    label: "Band",
    help: "Where every line stays: a step that would leave it is taken the other way. It must be at least twice as wide as the widest between",
    value: ["C4", "D6"],
    min: SHARED[0],
    max: SHARED[1],
    step: 0.5,
  }),
  steps: number({
    group: "Time",
    label: "Steps",
    help: "How many betweens each line takes (there is one onset more)",
    value: 80,
    min: 8,
    max: 200,
    step: 1,
  }),
  pulse: number({
    group: "Time",
    label: "Time between",
    help: "The one time between, in atoms of the family: every onset is this far from the last, and all three lines strike together",
    value: 3,
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the time between counts in",
    value: FAMILY_OPTIONS[0]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Time",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 60,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

function setOf(label: string, value: string): number[] {
  const set = numbersOf(label, value.replaceAll("−", "-"));
  if (set.some((b) => !Number.isInteger(b * 2)))
    throw new Error(`${label}: betweens are semitones on the quarter-tone grid (2, 3.5, -1.5)`);
  return set;
}

/** A line: the standpoint, then each between the rule draws, taken the other way at the band's ends. */
function lineOf(set: number[], from: number, steps: number, [lo, hi]: [number, number]): number[] {
  const next = stream(set, "shift each time", 1);
  const out = [from];
  for (let k = 0; k < steps; k++) {
    const here = out.at(-1)!;
    const b = next();
    out.push(here + b >= lo && here + b <= hi ? here + b : here - b);
  }
  return out;
}

export function score(v: Values<typeof knobs>) {
  const sets = [setOf("Line 1", v.line1), setOf("Line 2", v.line2), setOf("Line 3", v.line3)];
  const froms = [v.from1, v.from2, v.from3];
  const [lo, hi] = v.band;
  const widest = Math.max(...sets.flat().map(Math.abs));
  if (hi - lo < 2 * widest)
    throw new Error(
      `Band: make it at least ${2 * widest} semitones wide (twice the widest between)`,
    );
  froms.forEach((f, k) => {
    if (f < lo || f > hi) throw new Error(`Line ${k + 1} from: put it inside the band`);
  });

  // The relations first: three lines, whoever plays them.
  const lines = sets.map((s, k) => lineOf(s, froms[k]!, v.steps, v.band));

  // Then the names. on[k] is the player on line k.
  let on = [0, 1, 2];
  const plays: number[][] = PLAYERS.map(() => []);
  for (let n = 0; n <= v.steps; n++) {
    const now = lines.map((l) => l[n]!);
    on.forEach((p, k) => plays[p]!.push(now[k]!));
    if (now[0] === now[1] && now[1] === now[2]) on = [on[2]!, on[0]!, on[1]!];
    else {
      for (const [a, b] of [
        [0, 1],
        [0, 2],
        [1, 2],
      ] as const) {
        if (now[a] === now[b]) [on[a], on[b]] = [on[b]!, on[a]!];
      }
    }
  }

  const gap = v.pulse * atomOf(familyOf(v.family));
  const bar = 4 * TICKS;
  const last = v.steps * gap;
  const end = Math.ceil((last + gap) / bar) * bar;
  const dynamics = curve([{ at: 0, level: 4 }]);
  const parts = PLAYERS.map((p, i) =>
    part(
      p,
      plays[i]!.map((m, n) => note(n * gap, n === v.steps ? end - last : gap, m)),
      dynamics,
    ),
  );
  // Score order: flute, oboe, clarinet.
  return scoreOf(
    "antara · palette A · the names trade at the unison",
    end / bar,
    v.tempo,
    parts.reverse(),
  );
}

// antara palette, B: every order at once.
//
// Uses "other orders, the same place" (../../a/pitch-same-sum-meets): voices that read one and the
// same set in different orders meet on one pitch at the end of every pass, since a pass adds up to
// the sum of the set whatever the order. Its logic is written again here, not imported.
//
// Here the set is four slots, each holding a between (0 allowed), and the rules are all 24 orders of
// taking the four slots, played at once by 24 parts. Every part starts a pass on the meeting pitch
// and adds its slots one per step: after k steps it stands on the meeting pitch plus the sum of k
// slots, so the chord at step k is every sum of k slots, and after four steps all 24 stand on one
// pitch again (the new meeting). A step of 0 is a hold: the note is tied, not played again, so a part
// that has taken all its non-zero slots simply waits on the meeting and the meeting is never
// re-attacked.
//
// While slots hold equal values, different orders give the same line: the rules are all there but
// cannot be heard apart. The story is the set coming apart: all four slots start at 0 (34 players
// on one pitch), and at each stage exactly one slot takes a new value, so the lines that can be told
// apart grow 1, 4, 6, 12, 24. A pass whose meeting would leave a band around the first meeting is
// read with every slot turned the other way, all parts together, so the meeting still holds.
//
// Colour by slot: each part's instrument is named by the slot it takes first (horns, clarinets and
// bass clarinets, divided violas, divided cellos), so every pitch of a chord is sounded by exactly
// the colours of the slots it can be made of. Within its colour a part moves to the next order each
// pass, so no part repeats one shape. One time line for everyone: a set of three time betweens,
// shifted each time round, one between per step. The dynamics are flat, pp or p, no accents; after
// the last meeting everyone holds for a bar and fades.
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
import { atomOf, familyOf, FAMILY_OPTIONS, pitchSetsOf } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

export const knobs = {
  stages: text({
    group: "Set",
    label: "Slots, stage by stage",
    help: "The four slots' betweens at each stage, stages separated by | (semitones, − for down, .5 for a quarter tone, 0 for a hold). Slot 1 is the horns' colour, 2 the clarinets', 3 the violas', 4 the cellos'. Where slots hold equal values, different orders give the same line",
    value: "0 0 0 0 | 0 0 0 4.5 | 0 0 4.5 4.5 | 0 0 -5.5 4.5 | 0 -3 -5.5 4.5 | 3.5 -3 -5.5 4.5",
  }),
  passes: text({
    group: "Set",
    label: "Passes per stage",
    help: "How many passes each stage lasts (one number per stage). A pass is four steps: every part takes each slot once and all 24 meet at its end",
    value: "1 2 2 3 3 4",
  }),
  meeting: pitch({
    group: "Meetings",
    label: "First meeting",
    help: "Where all 24 parts stand at the start",
    value: "G4",
    min: "C4",
    max: "C5",
    step: 0.5,
  }),
  band: number({
    group: "Meetings",
    label: "Band",
    help: "How far the meeting may go from the first meeting, up or down. A pass that would end outside is read with every slot turned the other way (all parts together)",
    value: 4,
    min: 0,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  time: betweenSet({
    group: "Time",
    label: "Time set",
    help: "The time betweens, one per step, shifted each time round, in atoms of the family; shared by every part",
    value: "3 4 6",
    min: 1,
    max: 16,
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
    value: 56,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

/** One colour: the six parts whose orders start with one slot. */
interface Colour {
  players: Player[];
  /** Dynamic level, constant. */
  level: number;
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
  ...(players !== undefined ? { players } : {}),
});
const six = [1, 2, 3, 4, 5, 6];

// Slot 1 to slot 4. Within a colour, part j is its own player.
const COLOURS: Colour[] = [
  {
    players: six.map((j) => player(`hn${j}`, "horn", `Horn ${j}`, `Hn. ${j}`, [34, 77])),
    level: 2,
  },
  {
    players: [
      ...[1, 2, 3].map((j) => player(`cl${j}`, "clarinet", `Clarinet ${j}`, `Cl. ${j}`, [50, 94])),
      ...[1, 2, 3].map((j) =>
        player(`bcl${j}`, "bass-clarinet", `Bass Clarinet ${j}`, `B. Cl. ${j}`, [34, 77]),
      ),
    ],
    level: 2,
  },
  {
    players: six.map((j) => player(`va-${j}`, "violas", `Violas ${j}`, `Va. ${j}`, [48, 91], 2)),
    level: 3,
  },
  {
    // Ten cellos in six parts; the larger shares go to the top.
    players: six.map((j) =>
      player(`vc-${j}`, "cellos", `Violoncellos ${j}`, `Vc. ${j}`, [36, 84], j <= 4 ? 2 : 1),
    ),
    level: 3,
  },
];

/** Every order of the four slots (0–3), in dictionary order. */
function orders(): number[][] {
  const out: number[][] = [];
  const walk = (acc: number[]) => {
    if (acc.length === 4) out.push(acc);
    else for (let s = 0; s < 4; s++) if (!acc.includes(s)) walk([...acc, s]);
  };
  walk([]);
  return out;
}

const turned = (x: number) => (x === 0 ? 0 : -x);

export function score(v: Values<typeof knobs>) {
  const stages = pitchSetsOf("Slots, stage by stage", v.stages);
  stages.forEach((s, i) => {
    if (s.length !== 4)
      throw new Error(`Slots, stage by stage: stage ${i + 1} has ${s.length} slots; write four`);
  });
  const passes = numbersOf("Passes per stage", v.passes);
  if (passes.length !== stages.length)
    throw new Error(
      `Passes per stage: write one number for each of the ${stages.length} stages (${passes.length} written)`,
    );
  if (passes.some((n) => !Number.isInteger(n) || n < 1))
    throw new Error("Passes per stage: whole numbers, 1 or more");

  // The 24 parts: colour c holds the six orders that start with slot c. In pass q, its part j
  // reads the (j + q)-th of them, so each part's line changes from pass to pass while the ensemble
  // always holds all 24 orders.
  const all = orders();
  const byColour = [0, 1, 2, 3].map((c) => all.filter((o) => o[0] === c));

  const atom = atomOf(familyOf(v.family));
  const between = stream(v.time, "shift each time", 1);
  const lo = v.meeting - v.band;
  const hi = v.meeting + v.band;

  // Each part's pitch changes, as (tick, midi); a step of 0 adds nothing (the note is held).
  const lines = COLOURS.map((col) => col.players.map(() => [{ at: 0, midi: v.meeting }]));
  let m = v.meeting;
  let t = 0;
  let q = 0;
  stages.forEach((stage, s) => {
    for (let p = 0; p < passes[s]!; p++, q++) {
      const sum = stage.reduce((a, b) => a + b, 0);
      const values = m + sum < lo || m + sum > hi ? stage.map(turned) : stage;
      const times = [0, 1, 2, 3].map(() => (t += between() * atom));
      byColour.forEach((list, c) => {
        list.forEach((_, j) => {
          const order = list[(j + q) % 6]!;
          const xs = lines[c]![j]!;
          let now = m;
          order.forEach((slot, k) => {
            now += values[slot]!;
            if (now !== xs.at(-1)!.midi) xs.push({ at: times[k]!, midi: now });
          });
        });
      });
      m += values.reduce((a, b) => a + b, 0);
    }
  });
  const last = t;
  const bar = 4 * TICKS;
  const end = Math.ceil((last + bar) / bar) * bar;

  const parts = COLOURS.flatMap((col, c) =>
    col.players.map((pl, j) => {
      const xs = lines[c]![j]!;
      const [low, high] = [Math.min(...xs.map((x) => x.midi)), Math.max(...xs.map((x) => x.midi))];
      if (low < pl.range[0] || high > pl.range[1])
        throw new Error(
          `${pl.name} goes from ${low} to ${high}, outside ${pl.range[0]}–${pl.range[1]}; move the First meeting, narrow the Band or change the slots`,
        );
      const events = xs.map((x, i) => note(x.at, (xs[i + 1]?.at ?? end) - x.at, x.midi));
      const dynamics = curve([
        { at: 0, level: col.level },
        { at: last, level: col.level, ramp: true },
        { at: end, level: 0 },
      ]);
      return part(pl, events, dynamics);
    }),
  );

  // Score order: clarinets, bass clarinets, horns, violas, cellos.
  const [horns, clarinets, violas, cellos] = [0, 6, 12, 18].map((k) => parts.slice(k, k + 6));
  return scoreOf("antara · palette B · every order at once", end / bar, v.tempo, [
    ...clarinets!,
    ...horns!,
    ...violas!,
    ...cellos!,
  ]);
}

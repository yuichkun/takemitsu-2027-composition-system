// antara palette, B: the melody is the loudest voice.
//
// Uses the A sketch "loudness is a between" (../../a/dynamics-a-between): loudness on the score's
// scale 0 (niente) to 8 (fff), walked by betweens of whole marks that a rule draws from a set, one
// stroke per level, each level held until the next (steps, never hairpins).
//
// Here a chord of eight tones never moves, and each of its tones is held by two parts, one in the
// brass and one in the divided strings: sixteen parts, each with its own loudness line. All sixteen
// walk the same set by the same rule; only the standpoint (the level a line starts from) differs,
// and, in one stage, the place where the strings start reading the set. At every step the voice
// that stands loudest is a name, "the melody", given by the standpoints alone: voices on one
// standpoint move as one and no voice is named; voices on eight different standpoints pass the name
// from voice to voice, and a melody sounds inside a chord that does not move.
//
// The walk is folded at the ends by the width of the scale (above 8, 8 is taken away; below 0, 8
// is added; a landing on 0 or on 8 stays). The A no longer folds (it refuses a walk that would
// leave the scale). This B keeps the fold its brief asked for: without it, every voice of a choir
// adds the same between at the same step, the differences between voices never change, and the
// loudest voice could never change. With it, eight voices on eight different standpoints stay on
// eight different marks at every step, turned round the scale by each between. Level 0 is niente:
// the part rests for that step.
//
// Five stages of eight steps; at a stage's first step every part jumps to its new standpoint (the
// jump is the cut): 1 all sixteen parts together; 2 the brass spread, the strings together; 3 the
// strings spread, the brass together; 4 both spread, the strings reading the set from another
// place than the brass; 5 all together again. The time from one step to the next is drawn from a
// set of three sizes in atoms of the family of 2 (sixteenths), shifting each time round; the last
// level fades to niente at the end.
// Card: README.md.

import {
  betweenSet,
  number,
  numbersOf,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf } from "../../../between.ts";
import {
  curve,
  divisi,
  note,
  part,
  scoreOf,
  stack,
  stream,
  TICKS,
  type Player,
} from "../../common.ts";

/** The loudness scale: 0 = niente … 8 = fff. */
const LO = 0;
const HI = 8;
/** The fold: a level out of the scale comes back by the scale's width. A landing on 0 or 8 stays. */
const foldLevel = (x: number): number => {
  let y = x;
  while (y > HI) y -= HI - LO;
  while (y < LO) y += HI - LO;
  return y;
};

/** The chord: its betweens bottom up, in this order, on its lowest tone. It never moves. */
const CHORD = [3.5, 2, 4.5, 1.5, 5, 2.5, 3];
const LOWEST = 43;
/** Steps in a stage. */
const STEPS = 8;

export const knobs = {
  set: text({
    group: "Loudness",
    label: "Set",
    help: "The betweens of loudness, in marks (1 mark: one step of the scale, e.g. p to mp), − for down, in the order written. Read shifting each time round (the next round starts one later), from the start in every stage. A walk that leaves 0–8 is folded back by 8. Written as text to keep the order",
    value: "-1 -4 2 3",
  }),
  spread: number({
    group: "Standpoints",
    label: "Spread",
    help: "When a choir is spread, voice k (0 the lowest) starts on 1 + (Spread × k), folded into 1–8. An odd Spread gives the eight voices eight different marks; an even one lets voices share a mark",
    value: 3,
    min: 1,
    max: 7,
    step: 1,
    unit: "marks",
  }),
  together: number({
    group: "Standpoints",
    label: "Together",
    help: "The one standpoint of all sixteen parts in the first and the last stage",
    value: 4,
    min: 1,
    max: 8,
    step: 1,
    unit: "marks",
  }),
  beside: number({
    group: "Standpoints",
    label: "Beside the spread",
    help: "The one standpoint of the choir that is not spread: the strings in the second stage, the brass in the third. With the set as given, from 5 it stays at least 2 marks under the loudest voice of the spread choir at every step",
    value: 5,
    min: 1,
    max: 8,
    step: 1,
    unit: "marks",
  }),
  offset: number({
    group: "Reading",
    label: "Strings read from",
    help: "In the fourth stage both choirs are spread; the brass read the set from its first between, the strings from this place (0 = the same as the brass)",
    value: 2,
    min: 0,
    max: 7,
    step: 1,
  }),
  time: betweenSet({
    group: "Time",
    label: "Between steps",
    help: "The time from one step to the next, in atoms of the family of 2 (sixteenths), read shifting each time round",
    value: "6 9 10",
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
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

const solo = (
  id: string,
  instrument: string,
  name: string,
  abbreviation: string,
  range: [number, number],
): Player => ({ id, instrument, name, abbreviation, players: 1, range, grids: [0, 1] });

/** The brass, low to high: one player for each tone of the chord. */
const BRASS: Player[] = [
  solo("tbn2", "trombone", "Trombone 2", "Tbn. 2", [40, 72]),
  solo("tbn1", "trombone", "Trombone 1", "Tbn. 1", [40, 72]),
  solo("hn4", "horn", "Horn 4", "Hn. 4", [34, 77]),
  solo("hn3", "horn", "Horn 3", "Hn. 3", [34, 77]),
  solo("hn2", "horn", "Horn 2", "Hn. 2", [34, 77]),
  solo("hn1", "horn", "Horn 1", "Hn. 1", [34, 77]),
  solo("tpt2", "trumpet", "Trumpet 2", "Tpt. 2", [54, 84]),
  solo("tpt1", "trumpet", "Trumpet 1", "Tpt. 1", [54, 84]),
];
const BRASS_ORDER = ["horn", "trumpet", "trombone"];
/**
 * Players in each divided string part. The mark alone should decide which voice is loudest, so
 * every voice of a choir has the same weight: one player each in the brass, four each in the
 * strings (the most that three viola parts can have, 12 ÷ 3).
 */
const DESK = 4;

/** How a choir stands in a stage: spread or together, and where it starts reading the set. */
interface Stand {
  spread: boolean;
  from: number;
}

export function score(v: Values<typeof knobs>) {
  const set = numbersOf("Set", v.set.replaceAll("−", "-"));
  if (set.some((b) => !Number.isInteger(b) || Math.abs(b) > HI - LO))
    throw new Error("Set: betweens are whole marks, from -8 to 8 (the atom is one mark)");

  const tones = stack(LOWEST, CHORD, CHORD.length + 1);
  const standpoint = (s: Stand, k: number, one: number) =>
    s.spread ? 1 + ((v.spread * k) % (HI - LO)) : one;

  const stages: { label: string; one: number; brass: Stand; strings: Stand }[] = [
    {
      label: "together",
      one: v.together,
      brass: { spread: false, from: 0 },
      strings: { spread: false, from: 0 },
    },
    {
      label: "brass spread",
      one: v.beside,
      brass: { spread: true, from: 0 },
      strings: { spread: false, from: 0 },
    },
    {
      label: "strings spread",
      one: v.beside,
      brass: { spread: false, from: 0 },
      strings: { spread: true, from: 0 },
    },
    {
      label: "both spread",
      one: v.beside,
      brass: { spread: true, from: 0 },
      strings: { spread: true, from: v.offset },
    },
    {
      label: "together",
      one: v.together,
      brass: { spread: false, from: 0 },
      strings: { spread: false, from: 0 },
    },
  ];

  // Levels: for each choir and voice, one level per step. Each stage starts again from its
  // standpoints and reads the set from its own place, shifting each time round.
  const levels = {
    brass: tones.map((): number[] => []),
    strings: tones.map((): number[] => []),
  };
  for (const stage of stages) {
    for (const choir of ["brass", "strings"] as const) {
      const s = stage[choir];
      const from = ((s.from % set.length) + set.length) % set.length;
      const reading = [...set.slice(from), ...set.slice(0, from)];
      tones.forEach((_, k) => {
        const next = stream(reading, "shift each time", 1);
        let level = standpoint(s, k, stage.one);
        levels[choir][k]!.push(level);
        for (let i = 1; i < STEPS; i++) {
          level = foldLevel(level + next());
          levels[choir][k]!.push(level);
        }
      });
    }
  }

  // Time: one onset per step, the betweens read shifting each time round; the last step is held
  // for one more between.
  const atom = atomOf(2);
  const between = stream(v.time, "shift each time", 1);
  const onsets = [0];
  for (let i = 0; i < stages.length * STEPS; i++) onsets.push(onsets.at(-1)! + between() * atom);
  const last = stages.length * STEPS - 1;
  const stop = onsets.at(-1)!;
  const bar = 4 * TICKS;
  const end = Math.ceil((stop + bar) / bar) * bar;

  // Each step is one stroke at its level, held to the next step; level 0 rests. The last level is
  // held through its step, then fades to niente by the end.
  const partOf = (p: Player, line: number[]) => {
    const events = line.flatMap((l, i) => {
      if (l <= LO) return [];
      const to = i === last ? end : onsets[i + 1]!;
      return [note(onsets[i]!, to - onsets[i]!, p.range[0])];
    });
    const points: { at: number; level: number; ramp?: boolean }[] = line.flatMap((l, i) =>
      l > LO ? [{ at: onsets[i]!, level: l }] : [],
    );
    if (line[last]! > LO)
      points.push({ at: stop, level: line[last]!, ramp: true }, { at: end, level: LO });
    return part(p, events, curve(points));
  };

  const brassPlayers = BRASS.map((p, k) => ({
    ...p,
    range: [tones[k]!, tones[k]!] as [number, number],
  }));
  const stringPlayers = divisi(tones.map((t): [number, number] => [t, t])).map((p) => ({
    ...p,
    players: DESK,
  }));

  const brassParts = brassPlayers
    .map((p, k) => partOf(p, levels.brass[k]!))
    .sort(
      (a, b) =>
        BRASS_ORDER.indexOf(a.instrument) - BRASS_ORDER.indexOf(b.instrument) ||
        a.id.localeCompare(b.id),
    );
  const stringParts = stringPlayers.map((p, k) => partOf(p, levels.strings[k]!)).reverse();

  const out = scoreOf("antara · palette B · the melody is the loudest", end / bar, v.tempo, [
    ...brassParts,
    ...stringParts,
  ]);
  out.rehearsal = stages.map((s, n) => ({
    measure: Math.floor(onsets[n * STEPS]! / bar) + 1,
    label: `${n + 1} ${s.label}`,
  }));
  return out;
}

// antara palette, A (pitch): a chord that grows like frost.
//
// One pitch sounds at the start: the seed, the first standpoint. A set of signed betweens (the
// growth set) says how far from a sounding pitch a new one may stand, above (+) or below (−). Every
// pitch that sounds becomes a standpoint too. At each step the rule adds every between of the set to
// every sounding pitch and keeps what lands inside the register the voices can reach and is not
// sounding yet: the cuts no term stands on yet, the candidates. Each candidate has a shell, the
// fewest betweens of the set it takes to reach it from the seed (the least over the sounding
// pitches it is reached from, plus one). The candidate of the lowest shell is chosen, the lower
// pitch on a tie; it starts to sound and never moves again. One pitch is added per step, on a pulse
// (a time set holding a single between), until every voice sounds or no candidate is left. The
// chord then holds unchanged for two bars, and every voice fades to nothing together over the last
// bar.
//
// What decides the chord is not which between a rule takes next, but which of the undefined cuts
// around the sounding pitches is filled next. The voices are divided strings (divisi() of
// common.ts), all arco, pp, non vibrato, so only the order of the entries and the shape they leave
// are heard. Each voice holds the one pitch it enters on; its staff name says in which order it
// entered. The register is a capacity fact: the cellos' lowest pitch to the first violins' highest,
// the sections divisi() hands the voices to.
// Card: README.md.

import { instrument } from "../../../../../src/instruments/catalog.ts";
import type { TextEvent } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS, pulse } from "../../../between.ts";
import { curve, divisi, note, part, scoreOf, TICKS, time } from "../../common.ts";

/** The sections divisi() hands voices to at or above the cellos' lowest pitch. */
const SECTIONS = ["cellos", "violas", "violins-2", "violins-1"];

/** The register the voices can reach: the sections' ranges taken together. */
export const REGISTER: [number, number] = [
  Math.min(...SECTIONS.map((s) => instrument(s).range![0])),
  Math.max(...SECTIONS.map((s) => instrument(s).range![1])),
];

/** The middle of the register, on the quarter-tone grid: as much room to grow below as above. */
const MIDDLE = Math.round(REGISTER[0] + REGISTER[1]) / 2;

// Default values, by structure. Within a shell the lower candidate comes first, so shell 1 enters
// as the growth set sorted low to high, and the lower part of shell 2 as the same row moved down by
// the set's lowest between: the gaps between neighbouring members of the sorted set are the steps
// from one entry to the next. The set is chosen so those gaps all differ (3, 2.5, 1): with equal
// gaps the entries would climb in one even step and the ear would follow that line rather than
// which cut is filled next. Two betweens go up and two down, so the chord grows on both sides of
// the seed; the two going up carry .5 (each step up moves to the other grid), the two going down do
// not; counted in quarter tones (8, 2, 3, 5) they share no divisor, so every quarter-tone point of
// the register can be reached. The pulse is 12 atoms of family 3, one bar: every entry falls on a
// bar line, where every family's grid meets, so the time side adds nothing, and 4.4 s at tempo 54
// lets a pp string entry speak and be placed inside the chord before the next one.
export const knobs = {
  growth: betweenSet({
    group: "Pitch",
    label: "Growth set",
    help: "How far from a sounding pitch a new one may stand, above (+) or below (−), in semitones (.5 for a quarter tone). Every sounding pitch plus every between gives a candidate",
    value: "-4 -1 1.5 2.5",
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
    anchor: "seed",
  }),
  seed: pitch({
    group: "Pitch",
    label: "Seed",
    help: "The first pitch, the one standpoint the chord grows from. By default the middle of the register the voices can reach (the cellos' lowest to the first violins' highest)",
    value: MIDDLE,
    min: REGISTER[0],
    max: REGISTER[1],
    step: 0.5,
  }),
  voices: number({
    group: "Pitch",
    label: "Voices",
    help: "How many divided string voices there are. The chord stops growing when every voice sounds, or earlier when no candidate is left",
    value: 9,
    min: 1,
    max: 24,
    step: 1,
  }),
  pulse: number({
    group: "Time",
    label: "Pulse",
    help: "The time between one entry and the next, in atoms of the family: a time set holding one between",
    value: 12,
    min: 1,
    max: 48,
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
    group: "Time",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 54,
    min: 30,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

export interface Frozen {
  midi: number;
  /** The fewest betweens of the growth set from the seed. */
  shell: number;
}

/**
 * The chord, in the order its pitches start to sound. At each step every sounding pitch plus every
 * between of the set is a candidate, if it lies in the register and is not sounding yet; a
 * candidate's shell is the least shell of the sounding pitches it is reached from, plus one. The
 * candidate of the lowest shell sounds next, the lower pitch on a tie. It stops at `capacity`
 * pitches, or when no candidate is left.
 */
export function grow(
  seed: number,
  set: number[],
  capacity: number,
  [lo, hi]: [number, number],
): Frozen[] {
  const frozen: Frozen[] = [{ midi: seed, shell: 0 }];
  const sounding = new Set([seed]);
  while (frozen.length < capacity) {
    const candidates = new Map<number, number>();
    for (const f of frozen)
      for (const s of set) {
        const p = f.midi + s;
        if (p < lo || p > hi || sounding.has(p)) continue;
        candidates.set(p, Math.min(candidates.get(p) ?? Infinity, f.shell + 1));
      }
    if (candidates.size === 0) break;
    const [midi, shell] = [...candidates].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0]!;
    frozen.push({ midi, shell });
    sounding.add(midi);
  }
  return frozen;
}

export function score(v: Values<typeof knobs>) {
  const bar = 4 * TICKS;
  const family = familyOf(v.family);
  const frozen = grow(v.seed, v.growth, v.voices, REGISTER);

  // One entry per pulse, from the start.
  const span = (frozen.length * v.pulse * atomOf(family)) / TICKS;
  const onsets = pulse(Math.ceil(span / 4) * 4 + 4, family, v.pulse)
    .slice(0, frozen.length)
    .map((o) => o.at);
  // The complete chord holds for two bars, then fades over the last bar.
  const fade = Math.ceil((onsets.at(-1)! + 2 * bar) / bar) * bar;
  const end = fade + bar;

  // divisi() takes the voices low to high.
  const voices = frozen
    .map((f, k) => ({ ...f, entry: k + 1, at: onsets[k]! }))
    .sort((a, b) => a.midi - b.midi);
  const players = divisi(voices.map((x): [number, number] => [x.midi, x.midi]));
  const parts = voices.map((x, i) => {
    const p = players[i]!;
    const mark: TextEvent = { type: "text", at: time(x.at), text: "non vib." };
    const dynamics = curve([
      { at: x.at, level: 2 },
      { at: fade, level: 2, ramp: true },
      { at: end, level: 0 },
    ]);
    const out = part(
      { ...p, name: `${p.name} (entry ${x.entry})` },
      [note(x.at, end - x.at, x.midi)],
      dynamics,
    );
    out.events.unshift(mark);
    return out;
  });
  // Score order: high to low.
  return scoreOf(
    "antara · palette A · a chord that grows like frost",
    end / bar,
    v.tempo,
    parts.reverse(),
  );
}

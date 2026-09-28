// antara palette, A (pitch): a chord that grows like frost.
//
// One pitch sounds at the start: the seed, the first standpoint. A set of signed betweens (the
// growth set) says how far from a sounding pitch a new one may stand, above (+) or below (−). Every
// pitch that sounds becomes a standpoint too. At each step the rule adds every between of the set to
// every sounding pitch and keeps what lands inside the register the voices can reach and is not
// sounding yet: the cuts no term stands on yet, the candidates. A candidate's support is how many
// sounding pitches reach it: how many relations to what already sounds define that cut. The
// candidate of the most support is chosen. On a tie, the one of the lowest shell (the fewest
// betweens of the set from the seed through sounding pitches), then the lower pitch. The chosen
// pitch starts to sound and its pitch never moves again. One pitch is added per step, on a pulse (a
// time set holding a single between), until every voice sounds or no candidate is left. The chord
// then holds unchanged for two bars, and every voice fades to nothing together over the last bar.
//
// What decides the chord is not which between a rule takes next, but which of the undefined cuts
// around the sounding pitches is defined by the most of them, so the order depends on what sounds,
// not on the distance from the seed. To make that heard, the new pitch and the sounding pitches
// that define it swell together from pp and back over the pulse after the entry, while the rest of
// the chord stays pp: the swell is as thick as the support. The voices are divided strings
// (divisi() of common.ts), all arco, non vibrato, so only the order of the entries, the groups that
// swell, and the shape they leave are heard. Each voice holds the one pitch it enters on; its staff
// name says in which order it entered. The register is a capacity fact: the cellos' lowest pitch to
// the first violins' highest, the sections divisi() hands the voices to.
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

/**
 * The level of the chord (pp), and the top of the swell a defining group rises to (mp, provisional:
 * two steps, so the group stands out of the chord). A swell lasts one pulse, peaking halfway, so
 * only one group swells at a time.
 */
const HELD = 2;
const SWELL = 4;

// Default values, by structure. A cut can be reached from two sounding pitches only when they lie
// apart by the difference of two betweens of the set; the set's six differences (1, 2.5, 3, 3.5,
// 5.5, 6.5) all differ, so two sounding pitches define at most one cut together (with a repeated
// difference one pair would define two cuts at once, which the support could not tell apart). Two
// betweens go up and two down, so the chord grows on both sides of
// the seed; the two going up carry .5 (each step up moves to the other grid), the two going down do
// not; counted in quarter tones (8, 2, 3, 5) they share no divisor, so every quarter-tone point of
// the register can be reached. The tie falls back on the shell because, with the lower pitch alone,
// the lowest candidate is always the lowest pitch minus 4: the chord would run down in one step
// size, away from itself, and no cut would ever be defined by two pitches. Nine voices: from the
// fifth entry on the chord's outer pitches stay where they are and every entry fills a cut inside
// them; the tenth would stand above them. The pulse is 13 atoms of family 3, one atom longer than a
// bar, so the entries do not keep falling on bar lines (only the first does); 4.8 s at tempo 54
// lets a pp string entry speak, swell with its group and be placed inside the chord before the
// next one.
export const knobs = {
  growth: betweenSet({
    group: "Pitch",
    label: "Growth set",
    help: "How far from a sounding pitch a new one may stand, above (+) or below (−), in semitones (.5 for a quarter tone). Every sounding pitch plus every between gives a candidate; the candidate reached from the most sounding pitches sounds next",
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
    help: "The time between one entry and the next, in atoms of the family: a time set holding one between. Each entry's group swells over it",
    value: 13,
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
  /** The fewest betweens of the growth set from the seed, through sounding pitches. */
  shell: number;
  /** The sounding pitches the candidate was reached from when it was chosen: its support. */
  from: number[];
}

/**
 * The chord, in the order its pitches start to sound. At each step every sounding pitch plus every
 * between of the set is a candidate, if it lies in the register and is not sounding yet. A
 * candidate's support is the sounding pitches it is reached from; its shell is the least shell of
 * those, plus one. The candidate of the most support sounds next; on a tie the lowest shell, then
 * the lower pitch. It stops at `capacity` pitches, or when no candidate is left.
 */
export function grow(
  seed: number,
  set: number[],
  capacity: number,
  [lo, hi]: [number, number],
): Frozen[] {
  const frozen: Frozen[] = [{ midi: seed, shell: 0, from: [] }];
  const sounding = new Set([seed]);
  while (frozen.length < capacity) {
    const candidates = new Map<number, Frozen>();
    for (const f of frozen)
      for (const s of set) {
        const p = f.midi + s;
        if (p < lo || p > hi || sounding.has(p)) continue;
        const c = candidates.get(p) ?? { midi: p, shell: Infinity, from: [] };
        c.shell = Math.min(c.shell, f.shell + 1);
        if (!c.from.includes(f.midi)) c.from.push(f.midi);
        candidates.set(p, c);
      }
    if (candidates.size === 0) break;
    const next = [...candidates.values()].sort(
      (a, b) => b.from.length - a.from.length || a.shell - b.shell || a.midi - b.midi,
    )[0]!;
    frozen.push(next);
    sounding.add(next.midi);
  }
  return frozen;
}

export function score(v: Values<typeof knobs>) {
  const bar = 4 * TICKS;
  const family = familyOf(v.family);
  const frozen = grow(v.seed, v.growth, v.voices, REGISTER);
  const beat = v.pulse * atomOf(family);

  // One entry per pulse, from the start.
  const span = (frozen.length * beat) / TICKS;
  const onsets = pulse(Math.ceil(span / 4) * 4 + 4, family, v.pulse)
    .slice(0, frozen.length)
    .map((o) => o.at);
  // The complete chord holds for two bars after the last swell, then fades over the last bar.
  const fade = Math.ceil((onsets.at(-1)! + beat + 2 * bar) / bar) * bar;
  const end = fade + bar;

  // Each entry after the seed swells with the pitches that define it, from its onset to the next.
  const swells = new Map<number, number[]>();
  frozen.forEach((f, k) => {
    if (k === 0) return;
    for (const m of [f.midi, ...f.from]) swells.set(m, [...(swells.get(m) ?? []), onsets[k]!]);
  });

  // divisi() takes the voices low to high.
  const voices = frozen
    .map((f, k) => ({ ...f, entry: k + 1, at: onsets[k]! }))
    .sort((a, b) => a.midi - b.midi);
  const players = divisi(voices.map((x): [number, number] => [x.midi, x.midi]));
  const parts = voices.map((x, i) => {
    const p = players[i]!;
    const mark: TextEvent = { type: "text", at: time(x.at), text: "non vib." };
    const levels = new Map([[x.at, HELD]]);
    for (const t of swells.get(x.midi) ?? [])
      levels
        .set(t, HELD)
        .set(t + beat / 2, SWELL)
        .set(t + beat, HELD);
    levels.set(fade, HELD).set(end, 0);
    // A point ramps to the next one when the level changes on the way.
    const points = [...levels].sort((a, b) => a[0] - b[0]);
    const dynamics = curve(
      points.map(([at, level], j) => ({
        at,
        level,
        ramp: (points[j + 1]?.[1] ?? level) !== level,
      })),
    );
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

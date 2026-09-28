// antara palette, A (pitch): the vertical between and the horizontal between.
//
// Two voices, one above the other, have two kinds of between: the vertical between (the upper
// voice minus the lower, sounding together) and the horizontal between (a voice's step from one
// pitch to its next). Here they come from two separate sets. The vertical set says which verticals
// may sound; the step set says which steps a voice may take. What sounds "right" together is not
// named (consonant, dissonant): it is whatever the vertical set holds.
//
// The voices move in turn, upper, lower, upper, …, and the other holds. At its move a voice lists
// the steps that keep the vertical in the vertical set (and itself in its range) and takes the one
// it has used least so far. On a tie it takes the one that comes first from where its pointer into
// the steps stands; the pointer moves on one place after each of its moves, whichever step was
// taken. If no step fits, the voice plays its own pitch again (a between of 0).
//
// With the defaults, the steps are the differences of neighbouring verticals (2.5, 3.5) and their
// sum (6), up and down, so every step carries the vertical to another member of the set: the
// vertical walks along the set like a line. The set alternates verticals with and without .5, so
// every step with .5 takes the two voices from one grid to the two grids, or back.
// Card: README.md.

import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

export const knobs = {
  vertical: betweenSet({
    group: "Pitch",
    label: "Vertical set",
    help: "The betweens the two voices may stand apart (upper minus lower; semitones, .5 for a quarter tone). The vertical is always one of these, so the voices never meet and never cross",
    value: "1.5 5 7.5 11 13.5",
    min: 0.5,
    max: 24,
    step: 0.5,
    unit: "st",
    anchor: "lower",
  }),
  steps: betweenSet({
    group: "Pitch",
    label: "Steps",
    help: "The betweens a voice may move by (semitones, minus for down). At its move a voice takes, of the steps that keep the vertical in the vertical set, the one it has used least; a step written twice is there twice",
    value: "-6 -3.5 -2.5 2.5 3.5 6",
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  upper: pitch({
    group: "Pitch",
    label: "Upper start",
    help: "The upper voice's first pitch. Upper minus lower must be in the vertical set",
    value: "E4",
    min: "E3",
    max: "E5",
    step: 0.5,
  }),
  lower: pitch({
    group: "Pitch",
    label: "Lower start",
    help: "The lower voice's first pitch",
    value: "B3",
    min: "E2",
    max: "F#4",
    step: 0.5,
  }),
  moves: number({
    group: "Time",
    label: "Moves",
    help: "How many moves, the upper and the lower voice in turn",
    value: 36,
    min: 2,
    max: 96,
    step: 1,
  }),
  rhythm: betweenSet({
    group: "Time",
    label: "Rhythm",
    help: "The time from one move to the next, in atoms of the family, taken in turn",
    value: "4 5 6",
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the rhythm counts in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 66,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

// Two solo cellos: one colour, so that only the verticals are heard.
const VOICES: Player[] = [
  {
    id: "vc1",
    instrument: "cellos",
    name: "Violoncello solo 1",
    abbreviation: "Vc. 1",
    players: 1,
    range: [52, 76],
    grids: [0, 1],
  },
  {
    id: "vc2",
    instrument: "cellos",
    name: "Violoncello solo 2",
    abbreviation: "Vc. 2",
    players: 1,
    range: [40, 66],
    grids: [0, 1],
  },
];

const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

export function score(v: Values<typeof knobs>) {
  const verticals = v.vertical;
  const steps = v.steps;
  if (verticals.some((d) => d <= 0))
    throw new Error("Vertical set: every vertical is above 0, so the voices never meet or cross");
  const inSet = (d: number) => verticals.some((x) => same(x, d));

  // now[0] is the upper voice, now[1] the lower.
  const now = [v.upper, v.lower];
  VOICES.forEach((p, k) => {
    const [lo, hi] = p.range;
    if (now[k]! < lo || now[k]! > hi)
      throw new Error(
        `${k === 0 ? "Upper" : "Lower"} start: outside the voice's range ${lo}–${hi}`,
      );
  });
  if (!inSet(now[0]! - now[1]!))
    throw new Error(
      `Upper start, Lower start: they stand ${now[0]! - now[1]!} apart, which is not in the vertical set`,
    );

  // How often each voice has taken each step (by its place in the set), and each voice's pointer
  // into the steps: the upper voice's starts at the first step, the lower voice's halfway round.
  const n = steps.length;
  const used = [steps.map(() => 0), steps.map(() => 0)];
  const pointer = [0, Math.floor(n / 2)];
  const fromPointer = (k: number, i: number) => (((i - pointer[k]!) % n) + n) % n;

  const atom = atomOf(familyOf(v.family));
  const gap = stream(v.rhythm, "shift each time", 1);
  const lines = now.map((m) => [{ at: 0, midi: m }]);
  let t = 0;
  for (let m = 0; m < v.moves; m++) {
    const k = m % 2;
    t += gap() * atom;
    const [lo, hi] = VOICES[k]!.range;
    const fits = steps
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => {
        const p = now[k]! + h;
        const vertical = k === 0 ? p - now[1]! : now[0]! - p;
        return p >= lo && p <= hi && inSet(vertical);
      });
    let step = 0;
    if (fits.length > 0) {
      const least = Math.min(...fits.map(({ i }) => used[k]![i]!));
      const pick = fits
        .filter(({ i }) => used[k]![i] === least)
        .reduce((a, b) => (fromPointer(k, b.i) < fromPointer(k, a.i) ? b : a));
      used[k]![pick.i]!++;
      step = pick.h;
    }
    pointer[k] = (pointer[k]! + 1) % n;
    now[k] = now[k]! + step;
    lines[k]!.push({ at: t, midi: now[k]! });
  }
  const bar = 4 * TICKS;
  const end = Math.ceil((t + bar) / bar) * bar;

  const parts = lines.map((xs, k) => {
    // Every note lasts until the voice's next move; the other voice holds through it.
    const events = xs.map((x, i) => note(x.at, (xs[i + 1]?.at ?? end) - x.at, x.midi));
    // p; the voice that has just moved is mp for a beat. Both fade over the last bar.
    const points: { at: number; level: number; ramp?: boolean }[] = [{ at: 0, level: 3 }];
    let calm = 0;
    xs.forEach((x, i) => {
      if (i === 0) return;
      calm = Math.min(x.at + TICKS, xs[i + 1]?.at ?? end);
      points.push({ at: x.at, level: 4, ramp: true }, { at: calm, level: 3 });
    });
    points.push({ at: Math.max(end - bar, calm), level: 3, ramp: true }, { at: end, level: 0 });
    return part(VOICES[k]!, events, curve(points));
  });
  return scoreOf(
    "antara · palette A · the vertical between and the horizontal between",
    end / bar,
    v.tempo,
    parts,
  );
}

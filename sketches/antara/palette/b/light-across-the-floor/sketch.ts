// antara palette, B: light across the floor.
//
// Uses the A sketch "colours trade places by crossing" (../../a/texture-braid), whose one operation
// is copied here: the two players standing on two neighbouring pitches of a chord slide at the same
// time, each to the other's pitch, straight through (their vertical between passes 0 halfway), and
// hold there. The chord's pitches never change; only who plays them does.
//
// Here the chord is twelve pitches: a standpoint with a set of betweens stacked on it, smallest
// first, each time round starting one later (so it is not one shape moved up round by round). It
// never changes, from the first sound to the last. Ten divided string parts stand on the ten inner
// pitches (the floor); a clarinet stands on the lowest (light A) and a muted trumpet on the highest
// (light B). Only crossings with a light happen, so the A's rule is narrowed
// to the lights: light A crosses upward with its upper neighbour, again and again, until it stands
// on the highest pitch; light B does the same downward. Every floor player is crossed by each light
// exactly once, moved one position down by light A and one up by light B (or the other way round),
// so at the end it holds its first pitch again.
//
// Time: each light, after each arrival, holds a number of atoms taken in order from one set, then
// crosses (the slide lasts a fixed number of its atoms). Both lights read the same set, each in its
// own family (clarinet 2, trumpet 5), so they differ in speed only by the family. Light A starts at
// the beginning; light B starts its line at the first bar line at or after light A's third arrival.
// When the lights are neighbours, the one due first crosses with the other (they exchange pitches
// and each keeps its direction; if both are due at once, light A first). That crossing is the one
// the other light was due to make, so the other's due is used up and its line goes on as if it had
// crossed then: every crossing a light starts itself stays on its own family's grid. A light whose
// partner is still sliding when it is due waits for the next atom of its own grid.
//
// Each slide is written as its own note (the slide's length) sliding into the next pitch, so a
// player sounds its pitch again as the slide begins. The floor holds pp; a floor player being
// crossed swells to p at the unison and back to pp by the end of the slide. The lights are p. Each
// light, arrived at the far end, holds two beats and fades out over two more; after both have
// finished, the floor fades out over the last bar, standing exactly as it began.
// Card: README.md.

import type { NoteEvent, Part, TextEvent } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import {
  curve,
  divisi,
  note,
  part,
  scoreOf,
  stream,
  TICKS,
  time,
  type Player,
} from "../../common.ts";

/** The chord's pitches: the lights stand on the lowest and the highest, the floor on the rest. */
const TONES = 12;
/** Light B starts its line at the first bar line at or after this arrival of light A. */
const B_AFTER = 3;
/** pp for the floor, p at the unison of a crossing, p for the lights. */
const FLOOR = 2;
const SWELL = 3;
const LIGHT = 3;
/** A light at the far end holds this long, then fades out over this long (ticks). */
const STAY = 2 * TICKS;
const FADE = 2 * TICKS;

const CLARINET: Player = {
  id: "cl",
  instrument: "clarinet",
  name: "Clarinet",
  abbreviation: "Cl.",
  range: [50, 94],
  grids: [0, 1],
};
const TRUMPET: Player = {
  id: "tpt",
  instrument: "trumpet",
  name: "Trumpet",
  abbreviation: "Tpt.",
  range: [54, 84],
  grids: [0, 1],
  technique: "muted",
};

export const knobs = {
  chord: betweenSet({
    group: "Chord",
    label: "Chord",
    help: "The betweens stacked on the standpoint, smallest first, each time round starting one later, up to twelve pitches (semitones, .5 for a quarter tone). The chord never changes; each crossing slides across one of these betweens",
    value: "1.5 2 3 3.5",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
    anchor: "anchor",
  }),
  anchor: pitch({
    group: "Chord",
    label: "Standpoint",
    help: "The lowest pitch of the chord, where the clarinet (light A) starts; the muted trumpet (light B) starts on the highest",
    value: "G3",
    min: "C3",
    max: "C5",
    step: 0.5,
  }),
  holds: betweenSet({
    group: "Time",
    label: "Holds",
    help: "After each arrival a light holds this many atoms of its own family, then crosses again: taken in order, smallest first, again and again. Both lights read the same set",
    value: "12 16 20 24",
    min: 1,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  glide: number({
    group: "Time",
    label: "Slide",
    help: "How long a crossing's slide lasts, in atoms of the family of the light that crosses. The two players meet on one pitch halfway",
    value: 3,
    min: 1,
    max: 12,
    step: 1,
    unit: "atoms",
  }),
  familyA: choice({
    group: "Time",
    label: "Family, clarinet",
    help: "The atom light A (the clarinet, going up) counts its holds and slides in",
    value: FAMILY_OPTIONS[0]!,
    options: FAMILY_OPTIONS,
  }),
  familyB: choice({
    group: "Time",
    label: "Family, trumpet",
    help: "The atom light B (the muted trumpet, going down) counts its holds and slides in",
    value: FAMILY_OPTIONS[2]!,
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

/** One slide of one player, in ticks: from its pitch to its partner's. */
interface Move {
  start: number;
  end: number;
  to: number;
}

interface Light {
  /** The player (and the position it starts on). */
  player: number;
  dir: 1 | -1;
  goal: number;
  atom: number;
  hold: () => number;
  pos: number;
  /** The tick its next crossing is due; undefined before its line starts. */
  due?: number;
  arrivals: number;
  finish?: number;
}

export function score(v: Values<typeof knobs>) {
  if (v.chord.length === 0 || v.chord.some((b) => b <= 0))
    throw new Error("Chord: give at least one between, each above 0");
  if (v.holds.length === 0 || v.holds.some((h) => !Number.isInteger(h) || h < 1))
    throw new Error("Holds: whole numbers of atoms, 1 or more");
  const bar = 4 * TICKS;
  // The chord: the set smallest first, each time round starting one later. Read the same way every
  // round, the twelve pitches would be one shape moved up by the set's sum, again and again, and a
  // light's line through them (paired with the holds, which come round with the same count) would
  // only repeat its shape that much higher each round.
  const next = stream(v.chord, "shift each time", 1);
  const pitches = [v.anchor];
  for (let k = 1; k < TONES; k++) pitches.push(pitches[k - 1]! + next());

  // The relations first: the chord, held. Then the names: on[p] is the player on position p.
  const on = pitches.map((_, k) => k);
  const moves: Move[][] = pitches.map(() => []);
  const busy = pitches.map(() => 0);
  const lightOf = (player: number, dir: 1 | -1, family: string): Light => ({
    player,
    dir,
    goal: TONES - 1 - player,
    atom: atomOf(familyOf(family)),
    hold: stream(v.holds, "in order", 1),
    pos: player,
    arrivals: 0,
  });
  const lights = [lightOf(0, 1, v.familyA), lightOf(TONES - 1, -1, v.familyB)];
  const [a, b] = lights as [Light, Light];
  a.due = a.hold() * a.atom;

  for (let guard = 0; guard < 10 * TONES; guard++) {
    const ready = lights.filter((l) => l.finish === undefined && l.due !== undefined);
    if (ready.length === 0) break;
    // The one due first; light A first when both are due at once.
    const l = ready.reduce((x, y) => (y.due! < x.due! ? y : x));
    const at = l.due!;
    const target = l.pos + l.dir;
    const partner = on[target]!;
    const free = Math.max(busy[l.player]!, busy[partner]!);
    if (free > at) {
      l.due = Math.ceil(free / l.atom) * l.atom;
      continue;
    }
    const end = at + v.glide * l.atom;
    moves[l.player]!.push({ start: at, end, to: pitches[target]! });
    moves[partner]!.push({ start: at, end, to: pitches[l.pos]! });
    busy[l.player] = busy[partner] = end;
    [on[l.pos], on[target]] = [partner, l.player];
    l.pos = target;
    l.arrivals++;
    if (l.pos === l.goal) l.finish = end;
    else l.due = end + l.hold() * l.atom;
    // Crossed by the other light: the crossing it was due to make is done.
    const other = lights.find((o) => o.player === partner);
    if (other) {
      other.pos += other.dir;
      if (other.due !== undefined)
        other.due = other.due + v.glide * other.atom + other.hold() * other.atom;
      if (other.pos === other.goal) other.finish = end;
    }
    if (l === a && a.arrivals === B_AFTER && b.due === undefined)
      b.due = Math.ceil(end / bar) * bar + b.hold() * b.atom;
  }
  if (lights.some((l) => l.finish === undefined))
    throw new Error("The lights did not reach the far ends");
  const gone = Math.max(...lights.map((l) => l.finish! + STAY + FADE));
  const end = Math.ceil(gone / bar) * bar + bar;

  // Each player's notes: held, then each slide as its own note sliding into the next pitch.
  const notesOf = (k: number, stop: number, extra: Partial<NoteEvent> = {}): NoteEvent[] => {
    const out: NoteEvent[] = [];
    let at = 0;
    let midi = pitches[k]!;
    for (const m of moves[k]!) {
      if (m.start > at) out.push(note(at, m.start - at, midi, extra));
      out.push(note(m.start, m.end - m.start, midi, { ...extra, gliss: true }));
      at = m.end;
      midi = m.to;
    }
    out.push(note(at, stop - at, midi, extra));
    return out;
  };

  // The lights: p, and at the far end a hold and a fade.
  const lightPart = (p: Player, l: Light) => {
    const stop = l.finish! + STAY + FADE;
    const extra = p.technique ? { technique: p.technique } : {};
    return part(
      p,
      notesOf(l.player, stop, extra),
      curve([
        { at: 0, level: LIGHT },
        { at: l.finish! + STAY, level: LIGHT, ramp: true },
        { at: stop, level: 0 },
      ]),
    );
  };

  // The floor: pp; a player being crossed swells to p at the unison.
  const floor = pitches.slice(1, -1).map((_, i) => i + 1);
  const ranges = floor.map((k): [number, number] => {
    const all = [pitches[k]!, ...moves[k]!.map((m) => m.to)];
    return [Math.min(...all), Math.max(...all)];
  });
  const strings = divisi(ranges);
  const floorParts = floor.map((k, i) => {
    const points: { at: number; level: number; ramp?: boolean }[] = [{ at: 0, level: FLOOR }];
    for (const m of moves[k]!)
      points.push(
        { at: m.start, level: FLOOR, ramp: true },
        { at: (m.start + m.end) / 2, level: SWELL, ramp: true },
        { at: m.end, level: FLOOR },
      );
    points.push({ at: end - bar, level: FLOOR, ramp: true }, { at: end, level: 0 });
    const out: Part = part(strings[i]!, notesOf(k, end), curve(points));
    const mark: TextEvent = { type: "text", at: time(0), text: "non vib." };
    out.events.unshift(mark);
    return out;
  });

  // Score order: clarinet, trumpet, then the strings from the top.
  return scoreOf("antara · palette B · light across the floor", end / bar, v.tempo, [
    lightPart(CLARINET, a),
    lightPart(TRUMPET, b),
    ...floorParts.reverse(),
  ]);
}

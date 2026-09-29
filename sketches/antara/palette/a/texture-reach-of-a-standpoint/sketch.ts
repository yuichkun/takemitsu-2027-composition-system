// antara palette, A (texture): the reach of a standpoint places the cuts.
//
// One continuous line is read by three players in unison: a start, then betweens drawn from a set,
// each target held for a while and reached by a glissando at one quarter tone per atom, so every
// pitch of the quarter-tone grid is passed on an atom.
//
// A tenor trombone reads the line from a standpoint: one partial of its harmonic series (the 3rd to
// the 8th over B-flat 1, sounding 53, 58, 62, 65, 67.5, 70 on the quarter-tone grid). On one partial
// the slide reaches six semitones down from the open pitch (first to seventh position) and no
// further. While the line stays inside that reach, the trombone keeps its partial and its glissando
// goes on unbroken. Where the line stands on the edge of the reach and the next grid pitch lies
// outside it, the trombone must change partial: its glissando stops on the edge for one atom, and
// the next grid pitch is tongued anew (an accent) on a new partial, exactly when the line reaches
// it. The two trombones differ only in how they take the new partial: Trombone 1 the lowest partial
// that reaches the next pitch, Trombone 2 the highest. The cello reads the same line on one string,
// whose reach holds the whole line, and never plays a new attack. The cuts are not in the line;
// each standpoint gives them.
//
// Why the edge is held for one atom: a run of glissandi plays back as one held key, so a new attack
// can only begin after the old glissando's last note. The old glissando ends on the edge (the last
// pitch its partial reaches) and holds it until the line reaches the next grid pitch. On every atom
// all three players stand on the same pitch; inside that one atom a trombone lags the line by less
// than a quarter tone.
//
// The walk: the set is held in order of size. Each round reads it with a step, going round it from
// the first (step 1: in order; step 2: every other one; …), and the step changes from round to round,
// taken from both ends in turn (1, 4, 2, 3 for five betweens). So each round orders the betweens
// differently and no two betweens follow each other the same way twice. With a set summing to 0
// every round starts and ends on the start. A between that would leave the trombones' band (the
// union of the reaches, 47 to 70) is taken the other way.
// Card: README.md.

import type { NoteEvent, Part, TextEvent } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, scoreOf, TICKS, time } from "../../common.ts";

/**
 * The tenor trombone's partials 3 to 8 over B-flat 1 (MIDI 34), sounding, on the quarter-tone grid:
 * 53.02, 58, 61.86, 65.02, 67.69, 70. The instrument's own pitches, not chosen.
 */
export const PARTIALS: Record<number, number> = { 3: 53, 4: 58, 5: 62, 6: 65, 7: 67.5, 8: 70 };
/** How far the slide reaches below a partial's open pitch: first to seventh position. */
export const REACH = 6;
const NUMBERS = Object.keys(PARTIALS).map(Number);
const reaches = (n: number, x: number) => x >= PARTIALS[n]! - REACH && x <= PARTIALS[n]!;
/** The band the line stays in: every pitch some partial reaches. */
export const BAND: [number, number] = [
  Math.min(...NUMBERS.map((n) => PARTIALS[n]! - REACH)),
  Math.max(...NUMBERS.map((n) => PARTIALS[n]!)),
];

/** The partial a trombone takes for a pitch: the lowest or the highest that reaches it. */
export type Take = "lowest" | "highest";
export const take = (x: number, how: Take): number => {
  const ok = NUMBERS.filter((n) => reaches(n, x));
  if (ok.length === 0) throw new Error(`No partial reaches ${x}`);
  return how === "lowest" ? Math.min(...ok) : Math.max(...ok);
};

/** The cello's open strings: it plays the line on the highest one at or below the line's lowest pitch. */
const STRINGS: [string, number][] = [
  ["A", 57],
  ["D", 50],
  ["G", 43],
  ["C", 36],
];

export const knobs = {
  walk: betweenSet({
    group: "Line",
    label: "Walk",
    help: "The betweens the line walks by (semitones, .5 for a quarter tone). Held in order of size; each round reads them with its own step (1, 4, 2, 3 for five), going round the set; with a sum of 0 every round returns to the start",
    value: "-8 -4.5 1 5 6.5",
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  start: pitch({
    group: "Line",
    label: "Start",
    help: "The line's first pitch. Trombone 1 takes the lowest partial that reaches it, Trombone 2 the highest",
    value: 65.5,
    min: BAND[0],
    max: BAND[1],
    step: 0.5,
  }),
  rounds: number({
    group: "Line",
    label: "Rounds",
    help: "How many times the set is read (each round with another step)",
    value: 4,
    min: 1,
    max: 8,
    step: 1,
  }),
  holds: betweenSet({
    group: "Time",
    label: "Holds",
    help: "How long the line holds each target before it slides on, in atoms, taken in turn (the start takes the first)",
    value: "2 3 4",
    min: 1,
    max: 24,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom: the line slides one quarter tone per atom and holds for whole atoms",
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

type V = Values<typeof knobs>;

/** A round with step k reads the set every k-th between, going round it; one already read is passed over. */
export function readRound(set: number[], k: number): number[] {
  const n = set.length;
  const taken = set.map(() => false);
  const out: number[] = [];
  let pos = 0;
  for (let i = 0; i < n; i++) {
    while (taken[pos]) pos = (pos + 1) % n;
    taken[pos] = true;
    out.push(set[pos]!);
    pos = (pos + k) % n;
  }
  return out;
}

/**
 * The step of each round: 1, n−1, 2, n−2, … (the smallest and the largest step not yet used, in
 * turn), then again. For five betweens: 1, 4, 2, 3.
 */
export function strides(n: number): number[] {
  const out: number[] = [];
  for (let lo = 1, hi = n - 1; lo <= hi; lo++, hi--) out.push(...(lo === hi ? [lo] : [lo, hi]));
  return out.length ? out : [1];
}

/** The start and every target, in order. */
export function targets(v: V): number[] {
  const steps = strides(v.walk.length);
  const out = [v.start];
  let at = v.start;
  for (let r = 0; r < v.rounds; r++) {
    for (const w of readRound(v.walk, steps[r % steps.length]!)) {
      let next = at + w;
      if (next < BAND[0] || next > BAND[1]) next = at - w;
      if (next < BAND[0] || next > BAND[1])
        throw new Error(`Walk: ${w} leaves the band ${BAND[0]}–${BAND[1]} both ways from ${at}`);
      out.push(next);
      at = next;
    }
  }
  return out;
}

/**
 * A point where a player's glissando line turns: from `at` (atoms) it holds `midi` for `hold` atoms,
 * then slides to the next node's pitch. A node that `ends` a glissando is held to the next node,
 * which is tongued anew (`accent`).
 */
export interface Node {
  at: number;
  midi: number;
  hold: number;
  accent: boolean;
  ends: boolean;
  /** The trombone's partial from this node on. */
  partial?: number;
}

/**
 * A player's reading of the line: the line's own nodes (the targets), plus, for a trombone, a cut
 * wherever the next grid pitch lies outside its partial's reach.
 */
export function read(line: number[], holds: number[], how?: Take): Node[] {
  let partial = how ? take(line[0]!, how) : undefined;
  const nodes: Node[] = [{ at: 0, midi: line[0]!, hold: 0, accent: false, ends: false, partial }];
  const last = () => nodes[nodes.length - 1]!;
  let t = 0;
  for (let i = 0; i < line.length; i++) {
    last().hold += holds[i]!;
    t += holds[i]!;
    if (i + 1 === line.length) break;
    const from = line[i]!;
    const to = line[i + 1]!;
    const d = to > from ? 0.5 : -0.5;
    const steps = Math.round(Math.abs(to - from) * 2);
    for (let s = 0; s < steps; s++) {
      const x = from + d * s;
      const y = x + d;
      if (!how || reaches(partial!, y)) continue;
      // The edge: the glissando stops on x for one atom; y is tongued anew on another partial.
      const here = last();
      if (here.midi === x && here.at + here.hold === t + s) {
        here.hold += 1;
        here.ends = true;
      } else nodes.push({ at: t + s, midi: x, hold: 1, accent: false, ends: true, partial });
      partial = take(y, how);
      nodes.push({ at: t + s + 1, midi: y, hold: 0, accent: true, ends: false, partial });
    }
    t += steps;
    const here = last();
    if (!(here.at === t && here.midi === to))
      nodes.push({ at: t, midi: to, hold: 0, accent: false, ends: false, partial });
  }
  return nodes;
}

const TROMBONES: { id: string; name: string; abbreviation: string; how: Take }[] = [
  { id: "tbn1", name: "Trombone 1", abbreviation: "Tbn. 1", how: "lowest" },
  { id: "tbn2", name: "Trombone 2", abbreviation: "Tbn. 2", how: "highest" },
];
/**
 * Trombones mp, cello mf: one cello reads the line that two trombones read at the same pitch,
 * and its unbroken reading has to be heard through every cut (where both trombones cut, they hold
 * the edge and only the cello slides on), so it stands a level above them, not below.
 */
const LEVEL = { trombone: 4, cello: 5 };

export function score(v: V) {
  const atom = atomOf(familyOf(v.family));
  const line = targets(v);
  const last = 2 * TICKS; // the last target is held two beats, then fades over two
  const fade = 2 * TICKS;
  const holds = line.map((_, i) =>
    i + 1 === line.length ? last / atom : v.holds[i % v.holds.length]!,
  );

  // Notes from nodes: each slides into the next unless it ends a glissando.
  const events = (nodes: Node[], marks: (n: Node, i: number) => TextEvent[]) => {
    const out: (NoteEvent | TextEvent)[] = [];
    nodes.forEach((n, i) => {
      const next = nodes[i + 1];
      const at = n.at * atom;
      const dur = next ? (next.at - n.at) * atom : last + fade;
      const extra: Partial<NoteEvent> = {};
      if (next && !n.ends) {
        extra.gliss = true;
        if (n.hold > 0) extra.glissAfter = time(n.hold * atom);
      }
      if (n.accent) extra.articulations = ["accent"];
      out.push(...marks(n, i), note(at, dur, n.midi, extra));
    });
    return out;
  };

  const nodesEnd = (nodes: Node[]) => nodes.at(-1)!.at * atom + last + fade;
  const end = Math.ceil(nodesEnd(read(line, holds)) / (4 * TICKS)) * 4 * TICKS;
  const dynamics = (level: number, stop: number) =>
    curve([
      { at: 0, level },
      { at: stop - fade, level, ramp: true },
      { at: stop, level: 0 },
    ]);

  const parts: Part[] = TROMBONES.map((tb) => {
    const nodes = read(line, holds, tb.how);
    const marks = (n: Node, i: number): TextEvent[] => {
      if (i > 0 && !n.accent) return [];
      const words = `partial ${n.partial}`;
      const text = i === 0 ? `legato, tongue only at > · ${words}` : words;
      return [{ type: "text", at: time(n.at * atom), text }];
    };
    return {
      id: tb.id,
      instrument: "trombone",
      name: tb.name,
      abbreviation: tb.abbreviation,
      players: 1,
      dynamics: dynamics(LEVEL.trombone, nodesEnd(nodes)),
      events: events(nodes, marks),
    };
  });

  const low = Math.min(...line);
  const string = STRINGS.find(([, open]) => open <= low) ?? STRINGS.at(-1)!;
  const cello = read(line, holds);
  parts.push({
    id: "vc",
    instrument: "cellos",
    name: "Violoncello solo",
    abbreviation: "Vc.",
    players: 1,
    dynamics: dynamics(LEVEL.cello, nodesEnd(cello)),
    events: events(cello, (_, i) =>
      i === 0 ? [{ type: "text", at: 0, text: `sul ${string[0]}, legato` }] : [],
    ),
  });

  return scoreOf(
    "antara · palette A · the reach of a standpoint places the cuts",
    end / (4 * TICKS),
    v.tempo,
    parts,
  );
}

// antara palette, A (pitch): the holes become the chord.
//
// A field fills the quarter-tone grid without a gap: the standpoint with a quarter tone added again
// and again, one violin to each pitch. Every between from a quarter tone up to the field's span is
// present at once, so no between is told apart from another (the pitch axis's case of a set that
// holds a single between, stacked). The field is cut by one set of betweens, the widths, added from
// the standpoint: the cuts are the running sums, and the widths add up to the field's span, so they
// fill it exactly. The bands between neighbouring cuts are named in turn from the bottom: walls,
// holes, walls, holes.
//
// Each reading of the set goes through three states: the full field; the walls alone (the holes
// fall silent); then the names turn over: at one tick every wall stops and every hole starts. No
// cut moves; the band that did not sound is now the chord. Only which pitches sound changes: one
// colour (violins, sul tasto, senza vib.), one level (pp), plain entries and exits. A player who
// keeps sounding from one state into the next holds one note.
//
// The next reading starts one width later, so the same widths cut the field at other places. The
// rest of its order is the first, in dictionary order, whose two chords are shapes not heard before
// (neither moved nor turned upside down) and whose cuts all differ from the last reading's. Only
// rotating the order would turn the field round like a ring (the widths fill it exactly): each
// reading's holes would come back as the next reading's walls, moved down.
//
// The states' lengths are counted in atoms of one family, taken from a set in turn, starting one
// later each time round. After the last state the holes stop: no last full field, no fade.
// Card: README.md.

import type { NoteEvent, TextEvent } from "../../../../../src/score/types.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, note, part, scoreOf, stream, TICKS, type Player } from "../../common.ts";

/** The violin sections, and the range a part may use. */
const VIOLINS = [
  { id: "vn1", instrument: "violins-1", name: "Violins I", abbreviation: "Vn. I", size: 16 },
  { id: "vn2", instrument: "violins-2", name: "Violins II", abbreviation: "Vn. II", size: 14 },
] as const;
const RANGE: [number, number] = [55, 103];

export const knobs = {
  widths: betweenSet({
    group: "Cuts",
    label: "Widths",
    help: "The betweens that cut the field, added from its bottom (semitones, .5 for a quarter tone). Their sum is the field's span, one player to each quarter tone of it. Each reading starts one later in the set",
    value: "1.5 2.5 3 4",
    min: 0.5,
    max: 8,
    step: 0.5,
    unit: "st",
  }),
  standpoint: pitch({
    group: "Cuts",
    label: "Standpoint",
    help: "The lowest pitch of the field, where every reading starts adding",
    value: "C4",
    min: "G3",
    max: "C5",
    step: 0.5,
  }),
  lengths: betweenSet({
    group: "Time",
    label: "State lengths",
    help: "How long each state lasts (full field, walls, holes), in atoms of the family, taken in turn and starting one later each time round",
    value: "8 11 16",
    min: 1,
    max: 48,
    step: 1,
    unit: "atoms",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the state lengths count in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
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

/** The cuts of a reading, above the standpoint: its running sums, without the last (the top). */
const cutsOf = (order: number[]): number[] => {
  let sum = 0;
  return order.slice(0, -1).map((w) => (sum += w));
};

/**
 * The shapes of a reading's two chords, as the widths from each chord's first band to its last
 * (its bands and the gaps between them): the walls from the bottom band, the holes from the second.
 */
function shapesOf(order: number[]): number[][] {
  const n = order.length;
  const lastWall = (n - 1) % 2 === 0 ? n - 1 : n - 2;
  const lastHole = (n - 1) % 2 === 1 ? n - 1 : n - 2;
  return [order.slice(0, lastWall + 1), order.slice(1, lastHole + 1)];
}

/** The same shape: the same widths, or the same widths upside down. */
const same = (a: number[], b: number[]) =>
  a.join() === b.join() || a.join() === [...b].reverse().join();

/** The orders of some widths, in dictionary order (the widths come sorted), each once. */
function* orders(xs: number[]): Generator<number[]> {
  if (xs.length <= 1) {
    yield [...xs];
    return;
  }
  const seen = new Set<number>();
  for (let i = 0; i < xs.length; i++) {
    if (seen.has(xs[i]!)) continue;
    seen.add(xs[i]!);
    for (const rest of orders([...xs.slice(0, i), ...xs.slice(i + 1)])) yield [xs[i]!, ...rest];
  }
}

/**
 * The readings: one per width, each starting one later in the set. The rest of each order is the
 * first, in dictionary order, whose chords are new shapes and whose cuts all move. When no order
 * passes, the cuts may stay; when still none, the set is read rotated.
 */
function readingsOf(widths: number[]): number[][] {
  const out: number[][] = [];
  const heard: number[][] = [];
  for (let k = 0; k < widths.length; k++) {
    const rest = [...widths.slice(0, k), ...widths.slice(k + 1)];
    const was = out.length > 0 ? cutsOf(out.at(-1)!) : [];
    const passes = (order: number[], cutsMove: boolean) => {
      const shapes = shapesOf(order);
      if (same(shapes[0]!, shapes[1]!)) return false;
      if (shapes.some((s) => heard.some((h) => same(s, h)))) return false;
      return !cutsMove || cutsOf(order).every((c) => !was.includes(c));
    };
    let pick: number[] | undefined;
    for (const cutsMove of [true, false]) {
      let tries = 0;
      for (const r of orders(rest)) {
        if (++tries > 5000) break;
        const order = [widths[k]!, ...r];
        if (passes(order, cutsMove)) {
          pick = order;
          break;
        }
      }
      if (pick) break;
    }
    pick ??= [...widths.slice(k), ...widths.slice(0, k)];
    out.push(pick);
    heard.push(...shapesOf(pick));
  }
  return out;
}

type Kind = "full" | "walls" | "holes";
interface State {
  kind: Kind;
  at: number;
  /** Per field position, low to high: sounding in this state. */
  sounding: boolean[];
}

export function score(v: Values<typeof knobs>) {
  const widths = v.widths;
  if (widths.length < 2) throw new Error("Widths: give at least two, so there is a cut");
  const span = widths.reduce((a, b) => a + b, 0);
  const count = Math.round(span * 2);
  const upper = Math.ceil(count / 2);
  const lower = count - upper;
  if (upper > VIOLINS[0].size || lower > VIOLINS[1].size)
    throw new Error(
      `Widths: their sum ${span} makes a field of ${count} players; the violins have ${VIOLINS[0].size} + ${VIOLINS[1].size}, taking one pitch in two each`,
    );
  const top = v.standpoint + span - 0.5;
  if (v.standpoint < RANGE[0] || top > RANGE[1])
    throw new Error(`Standpoint: the field ${v.standpoint}–${top} leaves the violins' range`);
  const field = Array.from({ length: count }, (_, j) => v.standpoint + 0.5 * j);

  // The states: per reading, the full field, the walls, the holes.
  const atom = atomOf(familyOf(v.family));
  const lengthOf = stream(v.lengths, "shift each time", 1);
  const states: State[] = [];
  let t = 0;
  for (const order of readingsOf(widths)) {
    const cuts = cutsOf(order);
    // A position's band is how many cuts lie at or below it; even bands are walls.
    const walls = field.map((_, j) => cuts.filter((c) => c <= 0.5 * j).length % 2 === 0);
    for (const kind of ["full", "walls", "holes"] as const) {
      const sounding =
        kind === "full" ? walls.map(() => true) : kind === "walls" ? walls : walls.map((w) => !w);
      states.push({ kind, at: t, sounding });
      t += lengthOf() * atom;
    }
  }
  const last = t;
  const bar = 4 * TICKS;
  const end = Math.ceil(last / bar) * bar;

  // One player to each pitch: the lowest in Violins I, the next in Violins II, and so on up, so the
  // sections alternate a quarter tone apart. Numbered from the top in each section.
  const parts = field.map((midi, j) => {
    const s = VIOLINS[j % 2]!;
    const k = (j % 2 === 0 ? upper : lower) - Math.floor(j / 2);
    const player: Player = {
      id: `${s.id}-${k}`,
      instrument: s.instrument,
      name: `${s.name} ${k}`,
      abbreviation: `${s.abbreviation} ${k}`,
      players: 1,
      range: [midi, midi],
      grids: [0, 1],
    };
    // A run of states in which the player sounds is one held note.
    const events: NoteEvent[] = [];
    let from: number | undefined;
    states.forEach((st, i) => {
      if (!st.sounding[j]) return;
      from ??= st.at;
      const next = states[i + 1];
      if (next?.sounding[j]) return;
      events.push(note(from, (next?.at ?? last) - from, midi, { technique: "sul-tasto" }));
      from = undefined;
    });
    const out = part(player, events, curve([{ at: 0, level: 2 }]));
    const mark: TextEvent = { type: "text", at: events[0]!.at, text: "senza vib." };
    out.events.unshift(mark);
    return { section: j % 2, k, out };
  });

  // Score order: Violins I then Violins II, each from the top.
  const ordered = parts.sort((a, b) => a.section - b.section || a.k - b.k).map((p) => p.out);
  return scoreOf("antara · palette A · the holes become the chord", end / bar, v.tempo, ordered);
}

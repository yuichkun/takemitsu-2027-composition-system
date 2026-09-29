// antara, the opening: where the first relations are made, and where the piece's pulse is born.
// Card: README.md.
//
// A long, low rumble: basses in four desks entering one by one on the lowest string's E, the bass
// drum's roll in stretches, the tam-tam now and then swelling out of nothing. Only when the ear has
// settled into it, the celesta: one note, struck, far apart. Its betweens move, time round after
// time round, half way towards one between (a beat), while the basses begin to heave in glissando
// waves and the low winds join in breaths.
//
// As the betweens close in, the orchestra is drawn into them. A stroke leaves rings (winds and the
// cellos' artificial harmonics, starting exactly with it and fading into nothing) over the first
// half of the between after it; rises swell out of nothing over the last three fifths of the
// between before a stroke (cymbal and tam-tam rolls, the violins, the timpani, muted trumpets, then
// horns, bassoons, trombones and the bass clarinet in the ground's register). Harp 1, harp 2 with
// it a quarter tone off (the first interval), the piano, the vibraphone and the violas' pizzicato
// join the strokes now and then, closing in on every stroke by the same law as the celesta's
// betweens. Voices come in one or two a stroke, so the strokes gather colour as they come closer,
// and the silence between them fills: when the betweens are one (the pulse, the first in the
// piece), the rings of a stroke hand over to the rises into the next, and each between is a wave.
//
// Then the ground is drawn in: the basses, desk by desk, stop heaving and swell into every stroke;
// the piano strikes the ground's E with the stroke; the low winds' breaths and the bass drum's roll
// swell with the strokes. At the end the whole orchestra makes one wave a beat, louder to the last
// stroke, and the next section may start on the stroke after it. Each string section keeps one
// role (none is divided between layers), so every layer has its own colour. "Out of nothing" and
// "into nothing" are niente (written as the circle on the hairpin).

import { ensemble } from "../../../../pieces/antara/ensemble.ts";
import type {
  DynamicPoint,
  Event,
  NoteEvent,
  Part,
  Pitch,
  Score,
} from "../../../../src/score/types.ts";
import type { Seam } from "../../../../src/sketch/nest.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../src/sketch/knobs.ts";
import { atomOf, drawer, TICKS, time } from "../../between.ts";

const BAR = 4 * TICKS;
const FAMILIES = ["2 · 16ths", "3 · triplet 8ths", "5 · quintuplet 16ths"];
/** How much of a between a ring takes (after its stroke) and a rise (before its stroke). */
const RING = 0.5;
const RISE = 0.6;
/** Ticks a voice needs after a note before the next: a breath, a new bow, a new stick. */
const REST = TICKS / 3;

/**
 * Where the voices come in, in strokes from the pulse (its first stroke is 0; before it,
 * negative): one or two a stroke while the betweens close in (the rings and rises with their own
 * `enter` below), then, on the pulse, the ground drawn into the wave. Harp 2 comes with harp 1's
 * `second`-th time.
 */
const ENTER = {
  harp: -19,
  piano: -12,
  vibes: -6,
  pizz: -4,
  /** The tam-tam's player leaves for the vibraphone. */
  tamUntil: -6,
  /** The bass trombone joins the low winds' breaths. */
  bassTrombone: -8,
  /** The basses are drawn in from here, desk by desk, every two strokes. */
  basses: 0,
  /** The piano strikes the ground's E with the stroke. */
  pianoLow: 0,
  /** The contrabassoon is drawn in; the tuba a stroke later, the bass trombone two. */
  winds: 8,
  drum: 11,
};

interface Voice {
  id: string;
  /** In strokes from the pulse (see ENTER). */
  enter: number;
  technique?: string;
  /** Text over its first note. */
  text?: string;
  /**
   * Its note: the stroke's; "second", harp 2's at harp 2's strokes (the stroke's at the others);
   * "two", harp 2's; a MIDI number, a pitch of its own. None: unpitched.
   */
  note?: "stroke" | "second" | "two" | number;
  /** A rise's strokes: harp 1's, harp 2's, the piano's or every one. */
  aim?: "one" | "two" | "piano" | "all";
}

/** Rings: start exactly with a stroke and fade into nothing. Neighbours in the order differ in colour. */
const RINGS: Voice[] = [
  { id: "fl1", enter: -22, note: "stroke" },
  { id: "cl1", enter: -20, note: "stroke" },
  { id: "vct", enter: -18, note: "second", technique: "artificial-harmonic" },
  { id: "ob1", enter: -15, note: "stroke" },
  { id: "picc", enter: -13, note: "stroke" },
  { id: "fl2", enter: -11, note: "second" },
  { id: "cl2", enter: -9, note: "second" },
  { id: "ob2", enter: -7, note: "stroke" },
  { id: "eh", enter: -5, note: "second" },
];

/**
 * Rises: swell out of nothing into a stroke and end with it. High on the stroke's note (or harp
 * 2's); low in the ground's register, its E1 to G1 an octave up (the timpani on E2, horns on the
 * basses' quarter tones, bassoons, trombones and the bass clarinet on the low winds').
 */
const soft = { technique: "roll", text: "soft mallets" };
const RISES: Voice[] = [
  { id: "scym", enter: -17, aim: "one", ...soft },
  { id: "tam", enter: -14, aim: "one", ...soft },
  { id: "vn2t", enter: -12, aim: "one", note: "second" },
  { id: "timp", enter: -10, aim: "two", note: 40, technique: "roll+soft" },
  { id: "vn1t", enter: -8, aim: "all", note: "stroke", technique: "tremolo+sul-pont" },
  { id: "tp1", enter: -6, aim: "one", note: "stroke", technique: "muted" },
  { id: "tp2", enter: -5, aim: "two", note: "two", technique: "muted" },
  { id: "hn4", enter: -4, aim: "all", note: 40 },
  { id: "tp3", enter: -3, aim: "piano", note: "stroke", technique: "muted" },
  { id: "hn2", enter: -2, aim: "all", note: 41 },
  { id: "bn2", enter: -1, aim: "all", note: 42.5 },
  { id: "hn3", enter: 0, aim: "all", note: 40.5 },
  { id: "bn1", enter: 1, aim: "all", note: 42 },
  { id: "hn1", enter: 2, aim: "all", note: 41.5 },
  { id: "tb2", enter: 4, aim: "all", note: 42.5 },
  { id: "bcl", enter: 5, aim: "all", note: 42 },
  { id: "tb1", enter: 6, aim: "all", note: 43 },
];

export const knobs = {
  alone: number({
    group: "Ground",
    label: "Alone",
    help: "Bars of the rumble alone before the celesta (its first stroke comes a little after, so that the pulse starts on a bar line)",
    value: 8,
    min: 2,
    max: 16,
    step: 1,
    unit: "bars",
  }),
  winds: number({
    group: "Ground",
    label: "Low winds from",
    help: "The bar the contrabassoon and the tuba join the rumble: a new layer once the ear has settled into the celesta",
    value: 16,
    min: 1,
    max: 40,
    step: 1,
    unit: "bar",
  }),
  family: choice({
    group: "Celesta",
    label: "Family",
    help: "The atom the celesta's betweens are counted in (Set, Period): a 16th, a triplet 8th or a quintuplet 16th. Everything on the strokes (rings, rises) follows it. A beat is 4, 3 or 5 of them",
    value: FAMILIES[2]!,
    options: FAMILIES,
  }),
  set: betweenSet({
    group: "Celesta",
    label: "Set",
    help: "The betweens (atoms of the Family) of the celesta's first time round, widest first. After each time round every between moves half way (at least one atom) towards the period, until all are the period",
    value: "58 50 43 36",
    min: 1,
    max: 96,
    step: 1,
    unit: "atoms",
  }),
  period: number({
    group: "Celesta",
    label: "Period",
    help: "The between (atoms of the Family) the celesta settles on: the pulse. A beat (5 quintuplet 16ths) puts it on the beat, at 60 one a second",
    value: 5,
    min: 2,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  pulse: number({
    group: "Celesta",
    label: "Pulse",
    help: "Strokes at the period: the ground and the low brass are drawn in, then the whole orchestra makes one wave a stroke",
    value: 32,
    min: 16,
    max: 64,
    step: 1,
    unit: "strokes",
  }),
  pitch: pitch({
    group: "Celesta",
    label: "Note",
    help: "The celesta's note, and harp 1's (harp 2 plays the same string, a quarter tone lower)",
    value: "F#5",
    min: "C5",
    max: "C7",
    step: 1,
  }),
  harps: betweenSet({
    group: "Harps",
    label: "Harp 1",
    help: "Strokes between harp 1's entries at first. After each time round they move half way towards 1, until harp 1 is on every stroke",
    value: "2 3 4",
    min: 1,
    max: 12,
    step: 1,
    unit: "strokes",
  }),
  second: number({
    group: "Harps",
    label: "Harp 2 from",
    help: "From harp 1's n-th time on, harp 2 plays with it (the first interval)",
    value: 2,
    min: 1,
    max: 8,
    step: 1,
  }),
  side: choice({
    group: "Harps",
    label: "Harp 2",
    help: "the same string (a quarter tone below) or the string above (a quarter tone above)",
    value: "the same string",
    options: ["the same string", "the string above"],
  }),
  tempo: number({
    group: "Sound",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 60,
    min: 40,
    max: 72,
    step: 2,
    unit: "bpm",
  }),
};

type V = Values<typeof knobs>;

const player = (id: string) => {
  const p = ensemble.find((x) => x.id === id);
  if (!p) throw new Error(`${id} is not in antara's orchestra`);
  return p;
};

function partOf(id: string, events: Event[], dynamics: DynamicPoint[]): Part {
  const p = player(id);
  const out: Part = { id: p.id, instrument: p.instrument, name: p.name, dynamics, events };
  if (p.players !== undefined) out.players = p.players;
  if (p.player !== undefined) out.player = p.player;
  if (p.tuning !== undefined) out.tuning = p.tuning;
  return out;
}

/** A set's members one at a time, the set shifted by one each time round. */
function cycle(set: number[], offset = 0): () => number {
  const draw = drawer(set, "shift each time", 1, "ascending");
  let queue: number[] = [];
  const next = () => {
    if (queue.length === 0) queue = [...draw()];
    return queue.shift()!;
  };
  for (let k = 0; k < offset; k++) next();
  return next;
}

/** Moves each member half way (at least one) towards `goal`: the section's law. */
const closer = (set: number[], goal: number) =>
  set.map(
    (m) =>
      m + Math.sign(goal - m) * (m === goal ? 0 : Math.max(1, Math.round(Math.abs(goal - m) / 2))),
  );

/**
 * Stroke indices from `from` (included) to `until`, spaced by the set's members in turn (shifted
 * each time round); after each time round the members move half way towards 1, so the layer
 * closes in on every stroke.
 */
function converging(set: number[], from: number, until: number): number[] {
  let cur = [...set];
  const out: number[] = [];
  let k = from;
  for (let round = 0; k < until; round++) {
    const s = round % cur.length;
    for (const m of [...cur.slice(s), ...cur.slice(0, s)]) {
      if (k >= until) break;
      out.push(k);
      k += m;
    }
    cur = closer(cur, 1);
  }
  return out;
}

/**
 * A level that swells into each stroke (up to `peak` of it) and dips by `dip` at `trough` ticks
 * after it: one wave a between. Points up to `end`.
 */
function waves(
  strokes: number[],
  end: number,
  peak: (t: number) => number,
  dip: number,
  trough: number,
): DynamicPoint[] {
  const out: DynamicPoint[] = [];
  for (const s of strokes) {
    out.push({ at: time(s), level: peak(s), to: "linear" });
    if (s + trough < end) out.push({ at: time(s + trough), level: peak(s) - dip, to: "linear" });
  }
  return out;
}

//==============================================================================
// The celesta

/** Betweens (atoms): time rounds moving towards the period, then the pulse. */
function celesta(v: V): { gaps: number[]; settled: number } {
  // Widest first: the first silence after the first stroke is the longest.
  let cur = [...v.set].sort((a, b) => b - a);
  const gaps: number[] = [];
  for (let round = 0; cur.some((b) => b !== v.period) && round < 64; round++) {
    const s = round % cur.length;
    gaps.push(...cur.slice(s), ...cur.slice(0, s));
    cur = closer(cur, v.period);
  }
  const settled = gaps.length;
  for (let k = 1; k < v.pulse; k++) gaps.push(v.period);
  return { gaps, settled };
}

//==============================================================================
// The ground

/**
 * The ground, 0 to `end`. `grow(t)`: how far the build has come at t (0 at the first stroke, 1 at
 * the last).
 *
 * - Basses, four desks: one by one on the lowest string's E, at one level; from `glides` on, one
 *   desk after another heaves in glissando waves (up to a quarter tone or three and back, each
 *   desk its own lengths and heights). Drawn in (desk by desk), each holds where it is, ord., and
 *   swells into every stroke.
 * - Contrabassoon and tuba from `winds`, bass trombone from `bassTrombone`: breaths out of nothing
 *   and back, handing over to each other; their peaks grow. Drawn in, each breath runs from a
 *   wave's lowest point to another and swells into every stroke in it.
 * - Bass drum: the roll in stretches, each at its own level, the levels growing. Drawn in, out of
 *   nothing into a stroke, then one roll to the end, a wave a stroke.
 * - Tam-tam: see `tamSwells` (its player rises into strokes, then goes to the vibraphone).
 */
function ground(o: {
  end: number;
  winds: number;
  bassTrombone: number;
  glides: [number, number];
  drawn: { basses: number[]; winds: number[]; drum: number };
  /** The strokes of the pulse. */
  strokes: number[];
  grow: (t: number) => number;
  /** Ticks after a stroke where a wave is lowest (where the rises into the next begin). */
  trough: number;
}): Part[] {
  const parts: Part[] = [];
  const [g0, g1] = o.glides;
  const beat = (t: number) => Math.round(t / TICKS) * TICKS;
  const peak = (t: number) => 2 + 2.5 * o.grow(t);
  ["cb-4-4", "cb-4-3", "cb-4-2", "cb-4-1"].forEach((id, k) => {
    const enter = k * 3 * TICKS;
    const drawn = o.drawn.basses[k]!;
    // Where this desk starts to move; then waves: up to a height, back down to E1, each slide's
    // length and each height drawn in turn, from the desk's own place in the sets.
    const start = beat(g0 + (g1 - g0) * [0.6, 0.1, 0.35, 0.85][k]!);
    const slides = cycle([5, 7, 6, 9], k);
    const heights = cycle([1, 0.5, 1.5], k);
    const holds = cycle([1, 2], k);
    const events: NoteEvent[] = [];
    let at = enter;
    let hold = start - enter;
    let midi = 28;
    let up = true;
    while (true) {
      const slide = slides() * TICKS;
      if (at + hold + slide + 2 * TICKS > drawn) break;
      events.push({
        at: time(at),
        dur: time(hold + slide),
        pitch: { midi },
        technique: "sul-tasto",
        gliss: true,
        glissAfter: time(hold),
      });
      at += hold + slide;
      midi = up ? 28 + heights() : 28;
      up = !up;
      hold = holds() * TICKS;
    }
    // Drawn in: holds where it is, a new bow, ord.
    if (drawn > at)
      events.push({ at: time(at), dur: time(drawn - at), pitch: { midi }, technique: "sul-tasto" });
    events.push({ at: time(drawn), dur: time(o.end - drawn), pitch: { midi } });
    const into = drawn - (TICKS - o.trough);
    parts.push(
      partOf(id, events, [
        { at: time(enter), level: 0, to: "linear" },
        { at: time(enter + 2 * TICKS), level: 2 },
        { at: time(into), level: 2, to: "linear" },
        ...waves(
          o.strokes.filter((s) => s >= drawn),
          o.end,
          peak,
          1.5,
          o.trough,
        ),
      ]),
    );
  });
  // Low winds and brass: breaths of a few seconds (at most 8 beats), out of nothing and back,
  // handing over to each other so the low wind is seldom gone and never one breath too long.
  const breaths: [string, number, number, number[], number[]][] = [
    ["cbn", 30, o.winds, [6, 8, 7], [4, 3, 5]],
    ["tba", 30.5, o.winds + 5 * TICKS, [7, 6, 8], [3, 5, 4]],
    ["btb", 31, o.bassTrombone, [6, 7, 5], [3, 4, 2]],
  ];
  breaths.forEach(([id, midi, from, play, rest], k) => {
    const drawn = o.drawn.winds[k]!;
    const nextPlay = cycle(play);
    const nextRest = cycle(rest);
    const events: NoteEvent[] = [];
    const dynamics: DynamicPoint[] = [];
    let at = from;
    for (;;) {
      // On the pulse, a breath runs from a wave's lowest point to another.
      const waving = at >= drawn;
      const begin = waving ? at + o.trough : at;
      const len = Math.min(nextPlay() * TICKS, o.end - begin);
      if (len < 3 * TICKS) break;
      events.push({ at: time(begin), dur: time(len), pitch: { midi } });
      dynamics.push({ at: time(begin), level: 0, to: "linear" });
      if (waving)
        dynamics.push(
          ...waves(
            o.strokes.filter((s) => s > begin && s < begin + len),
            begin + len,
            peak,
            1.5,
            o.trough,
          ),
        );
      else {
        const top = begin + Math.round((len * (k % 2 ? 0.4 : 0.6)) / TICKS) * TICKS;
        dynamics.push({ at: time(top), level: peak(top), to: "linear" });
      }
      dynamics.push({ at: time(begin + len), level: 0 });
      at += len + nextRest() * TICKS;
    }
    parts.push(partOf(id, events, dynamics));
  });
  // Bass drum: the roll in stretches, each at its own level (a roll holds one level), growing;
  // drawn in, out of nothing into a stroke, then one roll to the end, a wave a stroke.
  {
    const lengths = cycle([10, 14, 8, 12]);
    const gaps = cycle([3, 5, 2]);
    const levels = cycle([1, 1.6, 1.3]);
    const events: NoteEvent[] = [];
    const dynamics: DynamicPoint[] = [];
    const into = o.drawn.drum - (TICKS - o.trough);
    const stop = into - TICKS;
    let at = 0;
    while (at + 2 * TICKS < stop) {
      const len = Math.min(lengths() * TICKS, stop - at);
      events.push({ at: time(at), dur: time(len), technique: "roll+soft" });
      dynamics.push({ at: time(at), level: levels() + 2 * o.grow(at) });
      at += len + gaps() * TICKS;
    }
    events.push({ at: time(into), dur: time(o.end - into), technique: "roll+soft" });
    dynamics.push(
      { at: time(into), level: 0, to: "linear" },
      ...waves(
        o.strokes.filter((s) => s >= o.drawn.drum),
        o.end,
        (t) => 2 + 2 * o.grow(t),
        1.5,
        o.trough,
      ),
    );
    parts.push(partOf("bd", events, dynamics));
  }
  return parts;
}

/** Tam-tam swells out of nothing, now and then, before it rises into strokes: where each starts (ticks). */
function tamSwells(until: number): number[] {
  const apart = cycle([17, 23, 19]);
  const out: number[] = [];
  for (let at = 9 * TICKS; at + 6 * TICKS < until; at += apart() * TICKS) out.push(at);
  return out;
}

//==============================================================================
// Rings and rises

/** Collects notes and dynamics for parts, and knows when each is free. */
class Parts {
  private readonly notes = new Map<string, Event[]>();
  private readonly levels = new Map<string, DynamicPoint[]>();
  private readonly busy = new Map<string, number>();
  private readonly texts = new Set<string>();

  free(id: string, at: number): boolean {
    return (this.busy.get(id) ?? -Infinity) <= at;
  }

  add(v: Voice, e: NoteEvent, curve: DynamicPoint[], until: number): void {
    const list = this.notes.get(v.id) ?? [];
    if (v.text && !this.texts.has(v.id)) {
      list.push({ type: "text", at: e.at, text: v.text, placement: "above" });
      this.texts.add(v.id);
    }
    if (v.technique) e.technique = v.technique;
    list.push(e);
    this.notes.set(v.id, list);
    this.levels.set(v.id, [...(this.levels.get(v.id) ?? []), ...curve]);
    this.busy.set(v.id, until + REST);
  }

  parts(): Part[] {
    return [...this.notes].map(([id, events]) => partOf(id, events, this.levels.get(id)!));
  }
}

//==============================================================================
// The score

export function score(v: V): Score {
  // The atom of the Family: the unit of the celesta's betweens and of everything on the strokes.
  const A = atomOf(Number(v.family.split(" ")[0]) as 2 | 3 | 5);
  const { gaps, settled } = celesta(v);
  // The pulse starts on a bar line: the first stroke comes after `alone` bars, as much later as
  // that needs (less than a bar).
  const before = gaps.slice(0, settled).reduce((a, b) => a + b, 0) * A;
  const times = [Math.ceil((v.alone * BAR + before) / BAR) * BAR - before];
  for (const g of gaps) times.push(times.at(-1)! + g * A);
  const final = times.length - 1;
  const period = v.period * A;
  // One between more after the last stroke: the next section may start on the stroke after it.
  const end = times[final]! + period;
  const p = (n: number) => Math.max(0, Math.min(final, settled + n)); // n strokes from the pulse
  // How far the build has come at t: 0 at the first stroke, 1 at the last, counted in strokes (so
  // it quickens with them).
  const grow = (t: number) => {
    if (t <= times[0]!) return 0;
    if (t >= times[final]!) return 1;
    let k = 0;
    while (times[k + 1]! <= t) k++;
    return (k + (t - times[k]!) / (times[k + 1]! - times[k]!)) / final;
  };
  const x = v.pitch;
  const q = v.pitch + (v.side === "the same string" ? -0.5 : 0.5);
  const ringLen = (between: number) => Math.max(1, Math.round((RING * between) / A)) * A;
  const riseLen = (between: number) => Math.max(1, Math.round((RISE * between) / A)) * A;
  // On the pulse: where the rises into the next stroke begin, the wave's lowest point.
  const trough = period - riseLen(period);

  // Who strikes where. Harp 1, the piano and the vibraphone close in on every stroke; harp 2
  // plays with harp 1 from its `second`-th time; the violas' pizzicato with harp 2 from `pizz`.
  const all = times.map((_, k) => k);
  const one = converging(v.harps, p(ENTER.harp), times.length);
  const two = one.slice(v.second - 1);
  const piano = converging([2, 3], p(ENTER.piano), times.length);
  const vibes = converging([1, 2], p(ENTER.vibes), times.length);
  const pizz = two.filter((k) => k >= p(ENTER.pizz));
  const isTwo = new Set(two);
  const aims = { one, two, piano, all };
  const noteOf = (voice: Voice, k: number): number | undefined => {
    if (voice.note === undefined || typeof voice.note === "number") return voice.note;
    if (voice.note === "two" || (voice.note === "second" && isTwo.has(k))) return q;
    return x;
  };

  // A struck note: written to the next beat at most (it rings on, l.v.), or longer (the piano,
  // pedalled, to its next stroke, three beats at most). Tenuto (not for a pizzicato); an accent on
  // the first and the last. Louder stroke by stroke, from level[0] to level[1].
  const struck = (
    id: string,
    ks: number[],
    pitchAt: (k: number) => Pitch | Pitch[],
    text: string,
    level: [number, number],
    opts: { technique?: string; long?: boolean; plain?: boolean } = {},
  ): Part => {
    const events: Event[] = [];
    const dynamics: DynamicPoint[] = [];
    ks.forEach((k, n) => {
      const at = times[k]!;
      if (n === 0) events.push({ type: "text", at: time(at), text, placement: "above" });
      const next = ks[n + 1] !== undefined ? times[ks[n + 1]!]! : end;
      const dur = opts.long
        ? Math.min(3 * TICKS, next - at)
        : Math.min(TICKS - (at % TICKS), next - at);
      const e: NoteEvent = { at: time(at), dur: time(dur), pitch: pitchAt(k) };
      const marks: ("accent" | "tenuto")[] = opts.plain ? [] : ["tenuto"];
      if (n === 0 || k === final) marks.unshift("accent");
      if (marks.length) e.articulations = marks;
      if (opts.technique) e.technique = opts.technique;
      events.push(e);
      dynamics.push({ at: time(at), level: level[0] + (level[1] - level[0]) * grow(at) });
    });
    return partOf(id, events, dynamics);
  };

  const parts: Part[] = [
    // The celesta: every stroke, mp growing to f, leant on, let ring.
    struck("cel", all, () => ({ midi: x }), "espr., l.v.", [4, 6]),
    struck("hp1", one, () => ({ midi: x }), "l.v.", [3.5, 6]),
    struck("hp2", two, () => ({ midi: q }), "l.v.", [3.5, 6]),
    // The piano: from the pulse, the ground's E with the stroke.
    struck(
      "pno",
      piano,
      (k) => (k >= p(ENTER.pianoLow) ? [{ midi: 28 }, { midi: x }] : { midi: x }),
      "con Ped., l.v.",
      [3, 6],
      { long: true },
    ),
  ];
  if (pizz.length)
    parts.push(
      struck("vat", pizz, () => ({ midi: q }), "pizz.", [3, 5.5], {
        technique: "pizz",
        plain: true,
      }),
    );

  const players = new Parts();
  // The tam-tam's player: swells now and then, until its first rise.
  const tam = RISES.find((r) => r.id === "tam")!;
  const tamFirst = one.find((k) => k > 0 && k >= p(tam.enter));
  const tamFrom =
    tamFirst !== undefined
      ? times[tamFirst]! - riseLen(times[tamFirst]! - times[tamFirst - 1]!)
      : end;
  for (const at of tamSwells(tamFrom - REST))
    players.add(
      { id: "tam", enter: 0, technique: "crescendo", text: "soft mallets" },
      { at: time(at), dur: time(6 * TICKS) },
      [
        { at: time(at), level: 0, to: "linear" },
        { at: time(at + 5 * TICKS), level: 2 },
      ],
      at + 6 * TICKS,
    );

  // Rises: out of nothing into each stroke a voice aims at, ending exactly with it, over the
  // last three fifths of the between before it, when the voice is free for it.
  for (const voice of RISES) {
    const until = voice.id === "tam" ? p(ENTER.tamUntil) : final + 1;
    const low = typeof voice.note === "number";
    for (const k of aims[voice.aim!]) {
      if (k === 0 || k < p(voice.enter) || k >= until) continue;
      const at = times[k]!;
      const len = riseLen(at - times[k - 1]!);
      const begin = at - len;
      if (!players.free(voice.id, begin)) continue;
      const e: NoteEvent = { at: time(begin), dur: time(len) };
      const midi = noteOf(voice, k);
      if (midi !== undefined) e.pitch = { midi };
      players.add(
        voice,
        e,
        [
          { at: time(begin), level: 0, to: "linear" },
          { at: time(at), level: low ? 1.5 + 3 * grow(at) : 2 + 3.5 * grow(at) },
        ],
        at,
      );
    }
  }

  // Rings: from its entry, every stroke leaves a ring in each voice free for it, over the first
  // half of the between after it (eight beats at most), fading into nothing.
  for (const voice of RINGS)
    for (let k = p(voice.enter); k <= final; k++) {
      const at = times[k]!;
      if (!players.free(voice.id, at)) continue;
      const len = Math.min(8 * TICKS, ringLen((k < final ? times[k + 1]! : end) - at));
      players.add(
        voice,
        { at: time(at), dur: time(len), pitch: { midi: noteOf(voice, k)! } },
        [
          { at: time(at), level: 1.2 + 3 * grow(at), to: "linear" },
          { at: time(at + len), level: 0 },
        ],
        at + len,
      );
    }

  // The vibraphone, after the tam-tam: motor off, pedalled.
  const vib = vibes.filter((k) => players.free("tam", times[k]! - 2 * TICKS));
  if (vib.length)
    parts.push(struck("vib", vib, () => ({ midi: x }), "motor off, soft mallets, l.v.", [3, 5.5]));

  parts.push(
    ...players.parts(),
    ...ground({
      end,
      winds: (v.winds - 1) * BAR,
      bassTrombone: Math.ceil(times[p(ENTER.bassTrombone)]! / TICKS) * TICKS,
      glides: [times[0]!, times[0]! + 13 * BAR],
      drawn: {
        basses: [0, 1, 2, 3].map((d) => times[p(ENTER.basses + 2 * d)]!),
        winds: [0, 1, 2].map((d) => times[p(ENTER.winds + d)]!),
        drum: times[p(ENTER.drum)]!,
      },
      strokes: times.slice(settled),
      grow,
      trough,
    }),
  );
  const rank = (id: string) => ensemble.findIndex((pl) => pl.id === id);
  parts.sort((a, b) => rank(a.id) - rank(b.id));
  const bar = (t: number) => Math.floor(t / BAR) + 1;
  const letters = [
    times[0]!,
    times[one[0]!]!,
    times[two[0]!]!,
    times[piano[0]!]!,
    times[p(0)]!,
    times[p(ENTER.drum + 1)]!,
  ];
  return {
    title: "antara · the opening",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: Math.ceil(end / BAR),
    rehearsal: [...new Set(letters.map(bar))].map((measure, n) => ({
      measure,
      label: String.fromCharCode(65 + n),
    })),
    // Every player on a staff of their own (docs/decisions/0025).
    pairs: false,
    parts,
  };
}

/** Where a section made of this sketch may stop or start: held notes while they hold, strokes at their onsets. */
export function seams(score: Score): Record<string, Seam[]> {
  const q = (t: NoteEvent["at"]) => (typeof t === "number" ? t : t[0] / t[1]);
  const out: Record<string, Seam[]> = {};
  for (const p of score.parts) {
    const notes = p.events.filter((e): e is NoteEvent => e.type !== "text");
    out[p.id] = notes.map((n): Seam => (q(n.dur) >= 4 ? [q(n.at), q(n.at) + q(n.dur)] : q(n.at)));
  }
  return out;
}

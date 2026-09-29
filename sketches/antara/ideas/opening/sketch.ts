// antara, the opening: where the first relations are made, and from where the piece builds.
// Card: README.md.
//
// A long, low rumble: basses in four desks entering one by one on the lowest string's E, the bass
// drum's roll in stretches, the tam-tam now and then swelling out of nothing. Only when the ear has
// settled into it, the celesta: one note, struck, far apart. Its betweens move, time round after
// time round, towards one between (the period), until the same note comes back at the same period:
// the piece's first pulse. Meanwhile the basses begin to heave in glissando waves, and the
// contrabassoon and the tuba join in breaths.
//
// From the pulse on, the section only grows (like Boléro). Layers enter one after another, each a
// new way of relating to the same stroke: harp 1 on it now and then (colour); rings that start
// exactly with a stroke and fade into nothing (flutes, clarinets, oboe, piccolo, the cellos'
// artificial harmonics); rises that swell out of nothing into a stroke (a stroke on the pulse can
// be foreseen, so something can arrive with it: cymbal and tam-tam rolls, then the second
// violins, the timpani, the first violins' tremolo, muted trumpets); harp 2 with harp 1 on the same
// string, a quarter tone off (the first interval); the piano, the vibraphone, the violas'
// pizzicato on harp 2's note. Each string section keeps one role (none is divided between
// layers), so every layer has its own colour. "Out of nothing" and "into nothing" are niente
// (written as the circle on the hairpin). Every layer that plays now and then follows the
// section's own law one level up: the strokes between its entries, drawn from a set, move half way
// towards one after each time round, as the celesta's betweens moved towards the period. So each
// layer closes in on every stroke, and at the end the whole orchestra is on the pulse, louder and
// thicker from the first stroke of the pulse to the last.

import { ensemble } from "../../../../pieces/antara/ensemble.ts";
import type { DynamicPoint, Event, NoteEvent, Part, Score } from "../../../../src/score/types.ts";
import type { Seam } from "../../../../src/sketch/nest.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../src/sketch/knobs.ts";
import { atomOf, drawer, TICKS, time } from "../../between.ts";

const BAR = 4 * TICKS;
const A = atomOf(2); // a 16th

/**
 * Where each layer comes in, in strokes of the pulse (0: the first stroke at the period). One new
 * layer every three strokes or so: harp 1, the rings, the rises, the piano, the strings' rises
 * with the timpani, the vibraphone, the violas' pizzicato, the bright rises (violins' tremolo,
 * muted trumpets), the low brass. Harp 2 comes with harp 1's `second`-th time.
 */
const ENTER = {
  harp: 4,
  rings: 7,
  rises: 10,
  piano: 16,
  strings: 22,
  tamUntil: 22,
  vibes: 25,
  pizz: 28,
  bright: 31,
  low: 34,
};

export const knobs = {
  alone: number({
    group: "Ground",
    label: "Alone",
    help: "Bars of the rumble alone before the celesta",
    value: 7,
    min: 2,
    max: 16,
    step: 1,
    unit: "bars",
  }),
  winds: number({
    group: "Ground",
    label: "Low winds from",
    help: "The bar the contrabassoon and the tuba join the rumble: a new layer once the ear has settled into the celesta",
    value: 14,
    min: 1,
    max: 30,
    step: 1,
    unit: "bar",
  }),
  set: betweenSet({
    group: "Celesta",
    label: "Set",
    help: "The betweens (16ths) of the celesta's first time round. After each time round every between moves half way (at least one 16th) towards the period, until all are the period",
    value: "22 29 18",
    min: 1,
    max: 64,
    step: 1,
    unit: "16ths",
  }),
  period: number({
    group: "Celesta",
    label: "Period",
    help: "The between the celesta settles on: the pulse. 6 16ths is 1.73 s at 52, just inside the longest between still heard as one (about 1.8 s)",
    value: 6,
    min: 2,
    max: 16,
    step: 1,
    unit: "16ths",
  }),
  pulse: number({
    group: "Celesta",
    label: "Pulse",
    help: "Strokes at the period once it is reached: the build",
    value: 42,
    min: 36,
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
    value: "3 4 5",
    min: 1,
    max: 12,
    step: 1,
    unit: "strokes",
  }),
  second: number({
    group: "Harps",
    label: "Harp 2 from",
    help: "From harp 1's n-th time on, harp 2 plays with it",
    value: 3,
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
    value: 52,
    min: 40,
    max: 66,
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

//==============================================================================
// The celesta

/** Betweens (16ths): time rounds moving towards the period, then the pulse. */
function celesta(v: V): { gaps: number[]; settled: number } {
  // Longest first: the first silence after the first stroke is the widest.
  let cur = [...v.set].sort((a, b) => b - a);
  const gaps: number[] = [];
  for (let round = 0; cur.some((b) => b !== v.period) && round < 64; round++) {
    const s = round % cur.length;
    gaps.push(...cur.slice(s), ...cur.slice(0, s));
    cur = closer(cur, v.period);
  }
  const settled = gaps.length;
  for (let k = 0; k < v.pulse; k++) gaps.push(v.period);
  return { gaps, settled };
}

//==============================================================================
// The ground

/**
 * The ground, 0 to `end`. `grow(t)`: how far the build has come at t (0 before the pulse, 1 at
 * the last stroke); the ground gets louder with it.
 *
 * - Basses, four desks: one by one on the lowest string's E, at one level; from `glides` on, one
 *   desk after another heaves in glissando waves (up to a quarter tone or three and back, each
 *   desk its own lengths and heights). From the pulse on, pp to mp.
 * - Contrabassoon and tuba from `winds`, bass trombone from `low`: breaths out of nothing and
 *   back, handing over to each other; their peaks grow. The last breath of each swells into the
 *   last stroke (`final`) and holds a beat past it.
 * - Bass drum: the roll in stretches, each at its own level, the levels growing.
 * - Tam-tam: before the pulse, a swell out of nothing now and then (after, it rises into strokes,
 *   and its player goes to the vibraphone).
 */
function ground(
  end: number,
  winds: number,
  low: number,
  glides: [number, number],
  pulse: number,
  final: number,
  grow: (t: number) => number,
): Part[] {
  const parts: Part[] = [];
  const [g0, g1] = glides;
  const beat = (t: number) => Math.round(t / TICKS) * TICKS;
  ["cb-4-4", "cb-4-3", "cb-4-2", "cb-4-1"].forEach((id, k) => {
    const enter = k * 3 * TICKS;
    const dynamics: DynamicPoint[] = [
      { at: time(enter), level: 0, to: "linear" },
      { at: time(enter + 2 * TICKS), level: 2 },
      { at: time(Math.max(pulse, enter + 3 * TICKS)), level: 2, to: "linear" },
      { at: time(end), level: 4.5 },
    ];
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
      if (at + hold + slide + 2 * TICKS > end) break;
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
    events.push({ at: time(at), dur: time(end - at), pitch: { midi }, technique: "sul-tasto" });
    parts.push(partOf(id, events, dynamics));
  });
  // Low winds and brass: breaths of a few seconds (at most 8 beats), out of nothing and back,
  // handing over to each other so the low wind is seldom gone and never one breath too long.
  const breaths: [string, number, number, number[], number[]][] = [
    ["cbn", 30, winds, [6, 8, 7], [4, 3, 5]],
    ["tba", 30.5, winds + 5 * TICKS, [7, 6, 8], [3, 5, 4]],
    ["btb", 31, low, [6, 7, 5], [3, 4, 2]],
  ];
  breaths.forEach(([id, midi, from, play, rest], k) => {
    const nextPlay = cycle(play);
    const nextRest = cycle(rest);
    const events: NoteEvent[] = [];
    const dynamics: DynamicPoint[] = [];
    let at = from;
    const lastBreath = final - 6 * TICKS;
    while (at + 4 * TICKS < lastBreath) {
      const len = Math.min(nextPlay() * TICKS, lastBreath - at);
      events.push({ at: time(at), dur: time(len), pitch: { midi } });
      const peak = at + Math.round((len * (k % 2 ? 0.4 : 0.6)) / TICKS) * TICKS;
      dynamics.push(
        { at: time(at), level: 0, to: "linear" },
        { at: time(peak), level: 2 + 2.5 * grow(peak), to: "linear" },
        { at: time(at + len), level: 0 },
      );
      at += len + nextRest() * TICKS;
    }
    const begin = Math.max(at, lastBreath);
    const stop = Math.min(end, final + TICKS);
    events.push({ at: time(begin), dur: time(stop - begin), pitch: { midi } });
    dynamics.push(
      { at: time(begin), level: 0, to: "linear" },
      { at: time(final), level: 4.5, to: "linear" },
      { at: time(stop), level: 3 },
    );
    parts.push(partOf(id, events, dynamics));
  });
  // Bass drum: the roll in stretches, each at its own level (a roll holds one level), growing.
  {
    const lengths = cycle([10, 14, 8, 12]);
    const gaps = cycle([3, 5, 2]);
    const levels = cycle([1, 1.6, 1.3]);
    const events: NoteEvent[] = [];
    const dynamics: DynamicPoint[] = [];
    let at = 0;
    while (at + 2 * TICKS < end) {
      const len = Math.min(lengths() * TICKS, end - at);
      events.push({ at: time(at), dur: time(len), technique: "roll+soft" });
      dynamics.push({ at: time(at), level: levels() + 2 * grow(at) });
      at += len + gaps() * TICKS;
    }
    parts.push(partOf("bd", events, dynamics));
  }
  return parts;
}

/** Tam-tam swells out of nothing, now and then, before the pulse: where each starts (ticks). */
function tamSwells(until: number): number[] {
  const apart = cycle([17, 23, 19]);
  const out: number[] = [];
  for (let at = 9 * TICKS; at + 6 * TICKS < until; at += apart() * TICKS) out.push(at);
  return out;
}

//==============================================================================
// Rises and rings

interface Voice {
  id: string;
  technique?: string;
  /** Text over its first note. */
  text?: string;
  /** A fixed pitch (the timpani); otherwise the stroke's note. */
  midi?: number;
  /** Plays harp 2's note (a quarter tone off) rather than the stroke's: always, or at the strokes it says. */
  second?: boolean | ((k: number) => boolean);
  /** Ticks it needs after a note before the next (a breath, a new bow, a new stick). */
  rest: number;
}

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
    this.busy.set(v.id, until + v.rest);
  }

  parts(): Part[] {
    return [...this.notes].map(([id, events]) => partOf(id, events, this.levels.get(id)!));
  }
}

//==============================================================================
// The score

export function score(v: V): Score {
  const start = v.alone * BAR;
  const { gaps, settled } = celesta(v);
  const times = [start];
  for (const g of gaps) times.push(times.at(-1)! + g * A);
  const last = times.at(-1)!;
  const end = (Math.floor(last / BAR) + 2) * BAR;
  const period = v.period * A;
  const pulse = times[settled]!;
  const grow = (t: number) => Math.max(0, Math.min(1, (t - pulse) / (last - pulse)));
  const p = (n: number) => settled + n; // the n-th stroke of the pulse
  const x = v.pitch;
  const q = v.pitch + (v.side === "the same string" ? -0.5 : 0.5);
  // The last stroke: the whole orchestra on it, every rise arriving with it.
  const final = times.length - 1;

  // Who strikes where. Harp 1, the piano and the vibraphone close in on every stroke; harp 2
  // plays with harp 1 from its `second`-th time; the violas' pizzicato with harp 2 from `pizz`.
  const all = times.map((_, k) => k);
  const withFinal = (ks: number[]) => (ks.includes(final) ? ks : [...ks, final]);
  const one = withFinal(converging(v.harps, p(ENTER.harp), times.length));
  const two = one.slice(v.second - 1);
  const piano = withFinal(converging([3, 4, 5], p(ENTER.piano), times.length));
  const vibes = withFinal(converging([2, 3, 4], p(ENTER.vibes), times.length));
  const pizz = two.filter((k) => k >= p(ENTER.pizz));
  const isOne = new Set(one);
  const isTwo = new Set(two);

  // A struck note: written to the next beat at most (it rings on, l.v.), or longer (the piano,
  // pedalled, to its next stroke, three beats at most). Tenuto (not for a pizzicato); an accent
  // on the first, on the last, and where `accent` says.
  const struck = (
    id: string,
    ks: number[],
    midi: number,
    text: string,
    level: [number, number],
    opts: {
      technique?: string;
      long?: boolean;
      plain?: boolean;
      accent?: (k: number) => boolean;
    } = {},
  ): Part => {
    const events: Event[] = [];
    ks.forEach((k, n) => {
      const at = times[k]!;
      if (n === 0) events.push({ type: "text", at: time(at), text, placement: "above" });
      const next = ks[n + 1] !== undefined ? times[ks[n + 1]!]! : end;
      const dur = opts.long
        ? Math.min(3 * TICKS, next - at)
        : Math.min(TICKS - (at % TICKS), next - at);
      const e: NoteEvent = { at: time(at), dur: time(dur), pitch: { midi } };
      const marks: ("accent" | "tenuto")[] = opts.plain ? [] : ["tenuto"];
      if (n === 0 || k === final || opts.accent?.(k)) marks.unshift("accent");
      if (marks.length) e.articulations = marks;
      if (opts.technique) e.technique = opts.technique;
      events.push(e);
    });
    return partOf(id, events, [
      { at: time(times[ks[0]!]!), level: level[0], to: "linear" },
      { at: time(Math.max(pulse, times[ks[0]!]!) + 1), level: level[0], to: "linear" },
      { at: time(last), level: level[1] },
    ]);
  };

  const parts: Part[] = [
    // The celesta: every stroke, mp growing to f, leant on, let ring; the first and the last
    // accented too.
    struck("cel", all, x, "espr., l.v.", [4, 6]),
    struck("hp1", one, x, "l.v.", [3.5, 6]),
    struck("hp2", two, q, "l.v.", [3.5, 6]),
    struck("pno", piano, x, "con Ped., l.v.", [3, 6], { long: true }),
  ];
  if (pizz.length)
    parts.push(struck("vat", pizz, q, "pizz.", [3, 5.5], { technique: "pizz", plain: true }));

  const players = new Parts();
  // The tam-tam's player: swells before the pulse, rises until `tamUntil`, then the vibraphone.
  for (const at of tamSwells(pulse))
    players.add(
      { id: "tam", technique: "crescendo", rest: 0 },
      { at: time(at), dur: time(6 * TICKS) },
      [
        { at: time(at), level: 0, to: "linear" },
        { at: time(at + 5 * TICKS), level: 2 },
      ],
      at + 6 * TICKS,
    );
  const vibeStart = times[p(ENTER.vibes)]!;

  // Rises: out of nothing into a stroke, ending exactly with it. Each voice aims at the strokes it
  // is given (harp 1's, harp 2's, or any), the rise three periods long at first and one at the end,
  // and takes each it is free for; its last rise, two periods long, arrives with the last stroke
  // (the earlier ones end before that one begins).
  const lastRise = times[final]! - 2 * period;
  const rise = (voice: Voice, targets: number[], from: number, until = final) => {
    const aims = targets.filter((k) => k >= from && k < until && k !== final);
    if (until >= final) aims.push(final);
    for (const k of aims) {
      const at = times[k]!;
      const len = k === final ? 2 * period : Math.max(1, Math.round(3 - 2 * grow(at))) * period;
      const begin = at - len;
      if (k !== final && at + voice.rest > lastRise) continue;
      if (begin < pulse || !players.free(voice.id, begin)) continue;
      const e: NoteEvent = { at: time(begin), dur: time(len) };
      if (
        voice.midi !== undefined ||
        !["suspended-cymbal", "tam-tam"].includes(player(voice.id).instrument)
      )
        e.pitch = {
          midi:
            voice.midi ??
            ((typeof voice.second === "function" ? voice.second(k) : voice.second) ? q : x),
        };
      players.add(
        voice,
        e,
        [
          { at: time(begin), level: 0, to: "linear" },
          { at: time(at), level: 2 + 3.5 * grow(at) },
        ],
        at,
      );
    }
  };
  const soft = { technique: "roll", text: "soft sticks", rest: TICKS / 2 };
  rise({ id: "scym", ...soft }, one, p(ENTER.rises));
  rise({ id: "tam", ...soft }, one, p(ENTER.rises), p(ENTER.tamUntil));
  // Violins II: harp 2's note into harp 2's strokes, the stroke's note into harp 1's others.
  rise({ id: "vn2t", second: (k) => isTwo.has(k), rest: TICKS / 2 }, one, p(ENTER.strings));
  rise({ id: "timp", technique: "roll+soft", midi: 40, rest: TICKS / 2 }, two, p(ENTER.strings));
  rise({ id: "vn1t", technique: "tremolo+sul-pont", rest: TICKS / 2 }, all, p(ENTER.bright));
  rise({ id: "tp1", technique: "muted", rest: TICKS }, one, p(ENTER.bright));
  rise({ id: "tp2", technique: "muted", second: true, rest: TICKS }, two, p(ENTER.bright));

  // The vibraphone, after the tam-tam: motor off, pedalled.
  const vib = vibes.filter(
    (k) => times[k]! >= vibeStart && players.free("tam", times[k]! - 2 * TICKS),
  );
  if (vib.length) parts.push(struck("vib", vib, x, "motor off, soft mallets, l.v.", [3, 5.5]));

  // Rings: start exactly with a stroke and fade into nothing. From `rings` on, every stroke leaves
  // a ring in one voice that is free; each time harp 1 plays, one more voice may take them, and
  // harp 1's strokes ring in more voices at once, longer each time; harp 2's note rings too,
  // first in the cellos' artificial harmonics. The last stroke rings in every voice that is free.
  const ringers: Voice[] = [
    { id: "fl1", rest: TICKS },
    { id: "cl1", rest: TICKS },
    { id: "vct", technique: "artificial-harmonic", rest: TICKS / 2 },
    { id: "ob1", rest: TICKS },
    { id: "picc", rest: TICKS },
    { id: "fl2", rest: TICKS },
    { id: "cl2", rest: TICKS },
  ];
  let turn = 0;
  const take = (open: Voice[], at: number, count: number) => {
    const free = open.filter((r) => players.free(r.id, at));
    const out: Voice[] = [];
    for (let n = 0; n < free.length && out.length < count; n++)
      out.push(free[(turn + n) % free.length]!);
    turn++;
    return out;
  };
  const ring = (who: Voice[], at: number, len: number, midi: number, level: number) => {
    const stop = Math.min(end, at + len);
    for (const r of who)
      players.add(
        r,
        { at: time(at), dur: time(stop - at), pitch: { midi } },
        [
          { at: time(at), level, to: "linear" },
          { at: time(stop), level: 0 },
        ],
        stop,
      );
  };
  let heard = 0;
  for (let k = p(ENTER.rings); k < times.length; k++) {
    const at = times[k]!;
    if (isOne.has(k)) heard++;
    const open = ringers.slice(0, Math.min(ringers.length, 1 + heard));
    const level = 1.2 + 2 * grow(at);
    // Near the end, the voices keep free for the last stroke.
    if (k !== final && at + 6 * TICKS > times[final]! - TICKS) continue;
    if (!isOne.has(k)) {
      // A little longer than the period, growing; whole 16ths.
      ring(take(open, at, 1), at, Math.round(((1.75 + grow(at)) * TICKS) / A) * A, x, level);
      continue;
    }
    const len = k === final ? 4 * TICKS : Math.min(6, 2 + heard) * TICKS;
    if (isTwo.has(k)) {
      const harmonics = open.filter((r) => r.technique === "artificial-harmonic");
      const got = take(harmonics, at, k === final ? 2 : 1);
      ring(got.length ? got : take(open, at, 1), at, len, q, level);
    }
    ring(
      take(open, at, k === final ? open.length : Math.min(open.length, heard)),
      at,
      len,
      x,
      level,
    );
  }

  parts.push(
    ...players.parts(),
    ...ground(
      end,
      (v.winds - 1) * BAR,
      times[p(ENTER.low)]!,
      [start, pulse],
      pulse,
      times[final]!,
      grow,
    ),
  );
  const rank = (id: string) => ensemble.findIndex((pl) => pl.id === id);
  parts.sort((a, b) => rank(a.id) - rank(b.id));
  const bar = (t: number) => Math.floor(t / BAR) + 1;
  const letters = [
    start,
    pulse,
    times[two[0]!]!,
    times[piano[0]!]!,
    times[p(ENTER.strings)]!,
    times[p(ENTER.bright)]!,
  ];
  return {
    title: "antara · the opening",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: end / BAR,
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

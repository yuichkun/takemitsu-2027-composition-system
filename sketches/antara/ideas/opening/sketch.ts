// antara, the opening: where the first relations are made. Card: README.md.
//
// A long, low rumble moves by itself: basses in four desks a quarter tone apart, swelling each on
// its own time; the bass drum's roll in stretches; the tam-tam now and then swelling out of
// nothing. Once the ear has settled into the celesta, a new layer: the contrabassoon and the tuba,
// in breaths that hand over to each other. Only when the ear has
// settled into it, the celesta: one note, struck, far apart. Its betweens are drawn from a set that
// moves, time round after time round, towards one between (the period): until every between is
// the period, and the same note comes back at the same period. That is where the piece first has
// a pulse; from there the between is kept, no longer shortened. On the pulse, harp 1 now and then
// plays the same note (a relation of colour); from its third time on, harp 2 plays with it on the
// same string, a quarter tone off, being tuned so (the first interval).

import { ensemble } from "../../../../pieces/antara/ensemble.ts";
import type { DynamicPoint, Event, NoteEvent, Part, Score } from "../../../../src/score/types.ts";
import type { Seam } from "../../../../src/sketch/nest.ts";
import { betweenSet, choice, number, pitch, type Values } from "../../../../src/sketch/knobs.ts";
import { atomOf, drawer, TICKS, time } from "../../between.ts";

const BAR = 4 * TICKS;
const A = atomOf(2); // a 16th

export const knobs = {
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
    help: "Strokes at the period once it is reached",
    value: 22,
    min: 4,
    max: 48,
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
    label: "Now and then",
    help: "Strokes between harp 1's entries on the pulse, drawn in turn (shift each time)",
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

//==============================================================================
// The celesta

/** Betweens (16ths): time rounds moving towards the period, then the pulse. */
function celesta(v: V): { gaps: number[]; settled: number } {
  // Longest first: the first silence after the first stroke is the widest.
  const cur = [...v.set].sort((a, b) => b - a);
  const gaps: number[] = [];
  for (let round = 0; cur.some((b) => b !== v.period) && round < 64; round++) {
    const s = round % cur.length;
    gaps.push(...cur.slice(s), ...cur.slice(0, s));
    for (let k = 0; k < cur.length; k++) {
      const d = v.period - cur[k]!;
      if (d !== 0) cur[k] = cur[k]! + Math.sign(d) * Math.max(1, Math.round(Math.abs(d) / 2));
    }
  }
  const settled = gaps.length;
  for (let k = 0; k < v.pulse; k++) gaps.push(v.period);
  return { gaps, settled };
}

//==============================================================================
// The ground

/**
 * The ground. The basses come in one desk at a time, all on the lowest string's E (a canon of
 * entries on one note), at one level throughout. Later, one desk after another, each starts to
 * rise and fall from it by glissando, in waves of its own lengths and heights (quarter tones), so
 * the waves pass between the four desks and the low note heaves. `glides`: the span (ticks) over
 * which the desks start.
 */
function ground(end: number, winds: number, glides: [number, number]): Part[] {
  const parts: Part[] = [];
  const [g0, g1] = glides;
  const beat = (t: number) => Math.round(t / TICKS) * TICKS;
  ["cb-4-4", "cb-4-3", "cb-4-2", "cb-4-1"].forEach((id, k) => {
    const enter = k * 3 * TICKS;
    const dynamics: DynamicPoint[] = [
      { at: time(enter), level: 0.5, to: "linear" },
      { at: time(enter + 2 * TICKS), level: 2 },
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
  // Contrabassoon and tuba: breaths of a few seconds, out of nothing and back, handing over to
  // each other so the low wind is seldom gone and never one breath too long.
  const breaths: [string, number, number[], number[]][] = [
    ["cbn", 30, [6, 8, 7], [4, 3, 5]],
    ["tba", 30.5, [7, 6, 8], [3, 5, 4]],
  ];
  breaths.forEach(([id, midi, play, rest], k) => {
    const nextPlay = cycle(play);
    const nextRest = cycle(rest);
    const events: NoteEvent[] = [];
    const dynamics: DynamicPoint[] = [];
    let at = winds + k * 5 * TICKS;
    while (at + 4 * TICKS < end) {
      const len = Math.min(nextPlay() * TICKS, end - at);
      events.push({ at: time(at), dur: time(len), pitch: { midi } });
      const peak = at + Math.round((len * (k ? 0.4 : 0.6)) / TICKS) * TICKS;
      dynamics.push(
        { at: time(at), level: 0.5, to: "linear" },
        { at: time(peak), level: 2, to: "linear" },
        { at: time(at + len), level: 0.5 },
      );
      at += len + nextRest() * TICKS;
    }
    parts.push(partOf(id, events, dynamics));
  });
  // Bass drum: the roll in stretches, each at its own level (a roll holds one level).
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
      dynamics.push({ at: time(at), level: levels() });
      at += len + gaps() * TICKS;
    }
    parts.push(partOf("bd", events, dynamics));
  }
  // Tam-tam: now and then, a swell out of nothing.
  {
    const apart = cycle([17, 23, 19]);
    const events: NoteEvent[] = [];
    const dynamics: DynamicPoint[] = [];
    for (let at = 9 * TICKS; at + 6 * TICKS < end; at += apart() * TICKS) {
      events.push({ at: time(at), dur: time(6 * TICKS), technique: "crescendo" });
      dynamics.push(
        { at: time(at), level: 0.5, to: "linear" },
        { at: time(at + 5 * TICKS), level: 2 },
      );
    }
    parts.push(partOf("tam", events, dynamics));
  }
  return parts;
}

//==============================================================================
// The ring

/**
 * The ring of the struck notes, played by instruments whose sound suits a ring: very soft, each
 * starting exactly with a stroke and fading into nothing. From harp 1's first time on, every stroke
 * leaves a ring in one of them; each time harp 1 plays, one more of them may take rings (flute,
 * clarinet, cello harmonic, second flute, second clarinet), and the harp's own stroke rings in more
 * of them at once, and longer, each time. Where harp 2 plays, its note rings too. A player rests a
 * beat after each ring (a breath).
 */
const RINGERS: { id: string; technique?: string }[] = [
  { id: "fl1" },
  { id: "cl1" },
  { id: "vcs", technique: "harmonic" },
  { id: "fl2" },
  { id: "cl2" },
];

function ring(
  times: number[],
  one: number[],
  two: number[],
  notes: [number, number],
  end: number,
): Part[] {
  const busy = new Map<string, number>();
  const played = new Map<string, NoteEvent[]>();
  const levels = new Map<string, DynamicPoint[]>();
  let turn = 0;
  const take = (open: typeof RINGERS, at: number, count: number) => {
    const free = open.filter((r) => (busy.get(r.id) ?? 0) <= at);
    const out = free.slice(0, 0);
    for (let n = 0; n < free.length && out.length < count; n++)
      out.push(free[(turn + n) % free.length]!);
    turn++;
    return out;
  };
  const sound = (who: typeof RINGERS, at: number, len: number, midi: number) => {
    const stop = Math.min(end, at + len);
    for (const r of who) {
      busy.set(r.id, stop + TICKS);
      const e: NoteEvent = { at: time(at), dur: time(stop - at), pitch: { midi } };
      if (r.technique) e.technique = r.technique;
      played.set(r.id, [...(played.get(r.id) ?? []), e]);
      levels.set(r.id, [
        ...(levels.get(r.id) ?? []),
        { at: time(at), level: 1.2, to: "linear" },
        { at: time(stop), level: 0.5 },
      ]);
    }
  };
  const harps = new Map(one.map((k, n) => [k, n]));
  for (let k = one[0] ?? times.length; k < times.length; k++) {
    const at = times[k]!;
    const heard = one.filter((h) => h <= k).length;
    const open = RINGERS.slice(0, Math.min(RINGERS.length, heard));
    const n = harps.get(k);
    if (n === undefined) {
      // A plain stroke: one of them, a little longer than the stroke's period.
      sound(take(open, at, 1), at, Math.round(1.75 * TICKS), notes[0]);
      continue;
    }
    // A harp's stroke: more of them, longer, each time; harp 2's note first.
    const len = Math.min(6, 2 + n) * TICKS;
    if (two.includes(k)) sound(take(open, at, 1 + two.indexOf(k)), at, len, notes[1]);
    sound(take(open, at, 1 + n), at, len, notes[0]);
  }
  return [...played].map(([id, events]) => partOf(id, events, levels.get(id)!));
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

  // Harp 1 now and then on the pulse, from the third stroke at the period; harp 2 with it from
  // its `second`-th time.
  const next = cycle(v.harps);
  const one: number[] = [];
  for (let k = settled + 3; k < times.length; k += next()) one.push(k);
  if (one.at(-1) !== times.length - 1) one.push(times.length - 1);
  const two = one.slice(v.second - 1);

  const struck = (ks: number[], midi: number, marks: string): Event[] => {
    const out: Event[] = [];
    ks.forEach((k, n) => {
      const at = times[k]!;
      if (n === 0) out.push({ type: "text", at: time(at), text: marks, placement: "above" });
      out.push({
        at: time(at),
        // To the next beat at most (it rings on, l.v.), so no stroke is tied over a beat.
        dur: time(Math.min(TICKS - (at % TICKS), (times[k + 1] ?? end) - at)),
        pitch: { midi },
        articulations: n === 0 ? ["accent", "tenuto"] : ["tenuto"],
      });
    });
    return out;
  };
  const all = times.map((_, k) => k);
  const h2 = v.pitch + (v.side === "the same string" ? -0.5 : 0.5);
  const parts = [
    // The celesta: mp, each stroke leant on, let ring; the first accented too.
    partOf("cel", struck(all, v.pitch, "espr., l.v."), [{ at: time(start), level: 4 }]),
    partOf("hp1", struck(one, v.pitch, "l.v."), [{ at: 0, level: 3.5 }]),
    partOf("hp2", struck(two, h2, "l.v."), [{ at: 0, level: 3.5 }]),
    ...ground(end, (v.winds - 1) * BAR, [start, times[settled]!]),
    ...ring(times, one, two, [v.pitch, h2], end),
  ];
  const rank = (id: string) => ensemble.findIndex((p) => p.id === id);
  parts.sort((a, b) => rank(a.id) - rank(b.id));
  const bar = (t: number) => Math.floor(t / BAR) + 1;
  return {
    title: "antara · the opening",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: end / BAR,
    rehearsal: [
      { measure: bar(start), label: "A" },
      { measure: bar(times[settled]!), label: "B" },
      ...(bar(times[two[0]!]!) > bar(times[settled]!)
        ? [{ measure: bar(times[two[0]!]!), label: "C" }]
        : []),
    ],
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

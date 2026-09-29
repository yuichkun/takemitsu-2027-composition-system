// antara, the opening: where the first relations are made. Card: README.md.
//
// A long, low rumble moves by itself: basses in four desks a quarter tone apart, swelling each on
// its own time; the contrabassoon and the tuba in breaths that hand over to each other; the bass
// drum's roll in stretches; the tam-tam now and then swelling out of nothing. Only when the ear has
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
    value: 16,
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

/** One swelling voice's dynamics between `from` and `to`, each swell's length and peak drawn in turn. */
function swells(
  from: number,
  to: number,
  lengths: () => number,
  peaks: () => number,
): DynamicPoint[] {
  const out: DynamicPoint[] = [{ at: time(from), level: 0.5, to: "linear" }];
  let at = from;
  let low = true;
  while (at < to - 4 * TICKS) {
    const len = lengths() * TICKS;
    at = Math.min(at + len / 2, to - 2 * TICKS);
    out.push({ at: time(at), level: low ? peaks() : 1, to: "linear" });
    low = !low;
  }
  out.push({ at: time(to), level: 0.5 });
  return out;
}

function ground(end: number): Part[] {
  const parts: Part[] = [];
  // Basses: four desks a quarter tone apart from the lowest string, each swelling on its own time.
  ["cb-4-4", "cb-4-3", "cb-4-2", "cb-4-1"].forEach((id, k) => {
    const enter = k * 3 * TICKS;
    const lengths = cycle([7, 11, 9, 13], k);
    const peaks = cycle([1.8, 2.6, 2.2], k);
    parts.push(
      partOf(
        id,
        [
          {
            at: time(enter),
            dur: time(end - enter),
            pitch: { midi: 28 + k * 0.5 },
            technique: "sul-tasto",
          },
        ],
        swells(enter, end, lengths, peaks),
      ),
    );
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
    let at = (4 + k * 5) * TICKS;
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
    ...ground(end),
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

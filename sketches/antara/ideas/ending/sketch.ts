// antara, the ending: out of the glass (two-grids), a solo violin rises and a solo cello falls,
// each on its own time, until the cello has gone to the ground and the violin alone goes into the
// height and is gone. Card: README.md.
//
// Both begin on one note, the opening's note two octaves down (F♯4), and part by a quarter tone:
// the piece's first relations (the same note, then the smallest between). Then they read one set of
// betweens mirrored, the violin adding, the cello taking away, each step held and then slid into
// (as the voices of two-grids turned away from their tones, only these do not come back). The
// violin counts on quintuplet 16ths, the cello on triplet 8ths, their holds growing towards four
// beats by the section's law (half way each time round). Some way before the edge of its range
// each goes on by halves instead: half the way that is left, at least a quarter tone, so the steps
// grow smaller up to the last, a quarter tone. The cello's edge (its open C) is nearer than the
// violin's (F♯7, the opening's note two octaves up), so the cello ends first; under its last notes
// the ground of the opening comes back (the basses' E1, the bass drum's roll) and goes with it.
// The violin, alone, turns to harmonics, arrives, holds, and slides a quarter tone up into nothing.
//
// Around them: violins II and violas hold, very softly, the notes the soloists are going to reach,
// and let each go as a soloist arrives, so the space between the two empties; now and then an
// arrival is lit once by the instrument of its grid (harp 1, celesta, crotales and piano on the
// semitones, harp 2 a quarter tone off), and at first a flute, a clarinet or the bass clarinet
// rings it into nothing. The light comes more and more seldom.

import { ensemble } from "../../../../pieces/antara/ensemble.ts";
import type { DynamicPoint, Event, NoteEvent, Part, Score } from "../../../../src/score/types.ts";
import type { Seam } from "../../../../src/sketch/nest.ts";
import { betweenSet, number, pitch, type Values } from "../../../../src/sketch/knobs.ts";
import { atomOf, TICKS, time } from "../../between.ts";

const BAR = 4 * TICKS;
const A3 = atomOf(3);
const A5 = atomOf(5);

export const knobs = {
  start: pitch({
    group: "Lines",
    label: "Start",
    help: "The note both soloists begin on (the opening's F♯, two octaves below the celesta's)",
    value: "F#4",
    min: "C4",
    max: "C5",
    step: 1,
  }),
  top: pitch({
    group: "Lines",
    label: "Top",
    help: "Where the violin arrives before it slides a quarter tone up into nothing (the opening's note two octaves up)",
    value: "F#7",
    min: "C7",
    max: "G7",
    step: 1,
  }),
  bottom: pitch({
    group: "Lines",
    label: "Bottom",
    help: "Where the cello arrives and dies away (its open C string)",
    value: "C2",
    min: "C2",
    max: "C3",
    step: 1,
  }),
  steps: betweenSet({
    group: "Lines",
    label: "Steps",
    help: "The betweens both read, the violin up, the cello down (a negative one turns back a little). Taken in turn, one later each time round",
    value: "-1.5 2.5 3.5 4",
    min: -8,
    max: 8,
    step: 0.5,
    unit: "st",
  }),
  reserve: number({
    group: "Lines",
    label: "By halves",
    help: "How far before its edge a line stops reading the set and goes on by halves (half the way left, at least a quarter tone)",
    value: 6,
    min: 2,
    max: 14,
    step: 1,
    unit: "st",
  }),
  holds: number({
    group: "Time",
    label: "Longest hold",
    help: "The beats each note is held grow towards this, half way each time round",
    value: 4,
    min: 2,
    max: 8,
    step: 0.5,
    unit: "beats",
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

/** Moves each member half way (at least one) towards `goal`: the section's law. */
const closer = (set: number[], goal: number) =>
  set.map(
    (m) =>
      m + Math.sign(goal - m) * (m === goal ? 0 : Math.max(1, Math.round(Math.abs(goal - m) / 2))),
  );

/** Half the way left to `goal`, on the quarter-tone grid, at least a quarter tone. */
const byHalf = (p: number, goal: number) => {
  const left = goal - p;
  const step = Math.max(0.5, Math.round(Math.abs(left)) / 2);
  return p + Math.sign(left) * Math.min(Math.abs(left), Math.round(step * 2) / 2);
};

//==============================================================================
// The two lines

interface Note {
  at: number;
  dur: number;
  midi: number;
  /** Held this long, then slid into the next note. */
  slideAfter?: number;
}

/**
 * The notes of a line going `dir` from the start to `edge`: the start, a quarter tone off it, the
 * set's betweens in turn (one later each time round) while they keep `reserve` from the edge, then
 * by halves to the edge. Returns the pitches and where going by halves began.
 */
function pitchesOf(v: V, dir: 1 | -1, edge: number): { pitches: number[]; halves: number } {
  const set = [...v.steps].sort((a, b) => a - b);
  const up = Math.max(
    0,
    set.findIndex((x) => x > 0),
  );
  const order = [...set.slice(up), ...set.slice(0, up)];
  const out = [v.start, v.start + dir * 0.5];
  let p = out.at(-1)!;
  const inside = (x: number) => (dir > 0 ? x <= edge - v.reserve : x >= edge + v.reserve);
  reading: for (let round = 0; round < 64; round++) {
    const s = round % order.length;
    for (const m of [...order.slice(s), ...order.slice(0, s)]) {
      if (!inside(p + dir * m)) break reading;
      p += dir * m;
      out.push(p);
    }
  }
  const halves = out.length;
  while (p !== edge) {
    p = byHalf(p, edge);
    out.push(p);
  }
  return { pitches: out, halves };
}

/** Times for a line's pitches on one family: each note held, then slid into the next. */
function timed(
  pitches: number[],
  atom: number,
  holds: number[],
  goal: number,
  slide: number,
): Note[] {
  let cur = [...holds];
  const out: Note[] = [];
  let t = 0;
  for (let round = 0; out.length < pitches.length; round++) {
    const s = round % cur.length;
    for (const h of [...cur.slice(s), ...cur.slice(0, s)]) {
      const k = out.length;
      if (k >= pitches.length) break;
      const last = k === pitches.length - 1;
      const hold = h * atom;
      const n: Note = { at: t, dur: hold + (last ? 0 : slide * atom), midi: pitches[k]! };
      if (!last) n.slideAfter = hold;
      out.push(n);
      t += n.dur;
    }
    cur = closer(cur, goal);
  }
  return out;
}

const onSemitones = (midi: number) => Number.isInteger(midi);

//==============================================================================
// The score

export function score(v: V): Score {
  const goal5 = Math.round(v.holds * 5);
  const goal3 = Math.round(v.holds * 3);
  const vp = pitchesOf(v, 1, v.top);
  const cp = pitchesOf(v, -1, v.bottom);
  const violin = timed(vp.pitches, A5, [7, 9, 8], goal5, 3);
  const cello = timed(cp.pitches, A3, [4, 6, 5], goal3, 2);
  // The cello's last note: held and let die; the violin's: held, then a quarter tone up into nothing.
  const cLast = cello.at(-1)!;
  cLast.dur = ceilTo(4 * TICKS, A3);
  const cEnd = cLast.at + cLast.dur;
  const vLast = violin.at(-1)!;
  vLast.dur = 7 * TICKS;
  vLast.slideAfter = 5 * TICKS;
  violin.push({ at: vLast.at + vLast.dur, dur: TICKS, midi: v.top + 0.5 });
  const end = violin.at(-1)!.at + violin.at(-1)!.dur;
  // Alone, the violin plays harmonics (no more slides between them, but the last).
  const alone = violin.findIndex((n) => n.at >= cEnd);
  // From the first note very high up (or once alone), the violin plays artificial harmonics.
  const firstHigh = violin.findIndex((n) => n.midi >= 91);
  const harmonicAt = (k: number) =>
    (firstHigh >= 0 && k >= firstHigh) || (alone >= 0 && k >= alone);
  const parts: Part[] = [];

  // The soloists.
  {
    const n = violin.length;
    const events: Event[] = [];
    const levels: DynamicPoint[] = [{ at: 0, level: 0, to: "linear" }];
    violin.forEach((note, k) => {
      const harmonic = harmonicAt(k);
      const nextHarmonic = k + 1 < n && harmonicAt(k + 1);
      const e: NoteEvent = { at: time(note.at), dur: time(note.dur), pitch: { midi: note.midi } };
      e.technique = harmonic ? "artificial-harmonic" : "sul-tasto";
      // Stopped notes slide into the next (not into the first harmonic); harmonics do not, but the
      // last, a quarter tone up into nothing.
      const slides = note.slideAfter !== undefined && (harmonic ? k === n - 2 : !nextHarmonic);
      if (slides) {
        e.gliss = true;
        e.glissAfter = time(note.slideAfter!);
      }
      events.push(e);
      if (k > 0) levels.push({ at: time(note.at), level: 2.5 - 1.5 * (k / (n - 1)) });
      else levels.push({ at: time(Math.min(note.dur, 2 * TICKS)), level: 2.5 });
    });
    const fall = violin.at(-2)!;
    levels.push(
      { at: time(fall.at + fall.slideAfter!), level: 1, to: "linear" },
      { at: time(end), level: 0 },
    );
    parts.push(
      partOf(
        "vn1s",
        events,
        levels.sort((a, b) => num(a.at) - num(b.at)),
      ),
    );
  }
  {
    const n = cello.length;
    const events: Event[] = cello.map((note, k): NoteEvent => {
      const e: NoteEvent = { at: time(note.at), dur: time(note.dur), pitch: { midi: note.midi } };
      if (k < n - 1) e.technique = "sul-tasto";
      if (note.slideAfter !== undefined) {
        e.gliss = true;
        e.glissAfter = time(note.slideAfter);
      }
      return e;
    });
    const levels: DynamicPoint[] = [
      { at: 0, level: 0, to: "linear" },
      { at: time(Math.min(cello[0]!.dur, 2 * TICKS)), level: 2.5 },
      ...cello
        .slice(1, -1)
        .map((note, k) => ({ at: time(note.at), level: 2.5 - (k + 1) / (n - 1) })),
      { at: time(cLast.at), level: 1.5, to: "linear" },
      { at: time(cEnd), level: 0 },
    ];
    parts.push(partOf("vcs", events, levels));
  }

  // Violins II and violas hold, very softly, the notes the soloists will reach, and let each go as
  // the soloist arrives there: the space between the two empties.
  const holders = (
    line: Note[],
    ids: string[],
    from: number,
    atom: number,
    playable: (midi: number) => boolean,
  ) =>
    ids.forEach((id, i) => {
      const target = line[from + 2 * i];
      if (!target || !playable(target.midi)) return;
      const enter = ceilTo(i * TICKS, atom);
      const release = target.at + 2 * TICKS;
      parts.push(
        partOf(
          id,
          [
            {
              at: time(enter),
              dur: time(release - enter),
              pitch: { midi: target.midi },
              technique: "sul-tasto",
            },
          ],
          [
            { at: time(enter), level: 0, to: "linear" },
            { at: time(enter + 4 * TICKS), level: 1.2 },
            { at: time(target.at), level: 1.2, to: "linear" },
            { at: time(release), level: 0 },
          ],
        ),
      );
    });
  holders(
    violin,
    Array.from({ length: 7 }, (_, i) => `vn2-7-${7 - i}`),
    2,
    A5,
    (m) => m <= 88,
  );
  holders(
    cello,
    Array.from({ length: 6 }, (_, i) => `va-6-${i + 1}`),
    2,
    A3,
    (m) => m >= 48,
  );

  // Light: now and then an arrival is sounded once by an instrument of its grid, a little later
  // after each time (the spaces between the lit arrivals grow by the section's law); at first a
  // wind rings it into nothing too.
  const lit = new Map<string, { events: Event[]; levels: DynamicPoint[] }>();
  const light = (id: string, at: number, midi: number, level: number, dur: number) => {
    const x = lit.get(id) ?? { events: [], levels: [] };
    x.events.push({ at: time(at), dur: time(dur), pitch: { midi } });
    x.levels.push({ at: time(at), level });
    lit.set(id, x);
  };
  const rings = new Map<string, { events: Event[]; levels: DynamicPoint[] }>();
  const ring = (id: string, at: number, midi: number, len: number) => {
    const x = rings.get(id) ?? { events: [], levels: [] };
    x.events.push({ at: time(at), dur: time(len), pitch: { midi } });
    x.levels.push({ at: time(at), level: 1.5, to: "linear" }, { at: time(at + len), level: 0 });
    rings.set(id, x);
  };
  // Each grid's arrivals are lit with spaces that grow by the section's law, so the light comes
  // more and more seldom: harp 1, the celesta and the crotales (an octave up) for the violin's
  // semitones, the piano and harp 1 for the cello's, harp 2 for the quarter tones of both.
  const RANGE: Record<string, [number, number]> = {
    hp1: [24, 103],
    hp2: [23.5, 102.5],
    cel: [60, 108],
    crot: [84, 108],
    pno: [21, 108],
  };
  const place = (id: string, midi: number, up: number) => {
    const [lo, hi] = RANGE[id]!;
    return [midi + up, midi].find((m) => m >= lo && m <= hi);
  };
  const thinned = (ks: number[]) => {
    const first = [1, 1, 2];
    let cur = [...first];
    const out: number[] = [];
    for (let i = 0; i < ks.length;) {
      for (const s of cur) {
        if (i >= ks.length) break;
        out.push(ks[i]!);
        i += s;
      }
      cur = closer(cur, 4).map((x, j) => Math.max(x, first[j]!));
    }
    return out;
  };
  const half = end / 2;
  const lightLine = (line: Note[], upper: boolean, stopBefore: number) => {
    const ks = line.map((_, k) => k).filter((k) => k > 0 && k < line.length - stopBefore);
    const semis = thinned(ks.filter((k) => onSemitones(line[k]!.midi)));
    const others = thinned(ks.filter((k) => !onSemitones(line[k]!.midi)));
    const semiIds = upper ? ["hp1", "cel", "crot"] : ["pno", "hp1"];
    const chosen: [number, string][] = [
      ...semis.map((k, i): [number, string] => [k, semiIds[i % semiIds.length]!]),
      ...others.map((k): [number, string] => [k, "hp2"]),
    ];
    for (const [k, id] of chosen) {
      const note = line[k]!;
      const midi = place(id, note.midi, upper ? 12 : 0);
      if (midi === undefined) continue;
      const dur = Math.min(TICKS - (note.at % TICKS) || TICKS, 2 * TICKS);
      light(id, note.at, midi, 2 - note.at / end, dur);
      if (note.at < half)
        ring(upper ? (k % 2 ? "cl1" : "fl1") : "bcl", note.at, note.midi, 2 * TICKS);
    }
  };
  lightLine(violin, true, 4);
  lightLine(cello, false, 1);
  const byTime = <T extends { at: NoteEvent["at"] }>(xs: T[]) =>
    xs.sort((a, b) => num(a.at) - num(b.at));
  for (const [id, x] of lit) {
    byTime(x.events);
    byTime(x.levels);
    const text = id === "pno" ? "con Ped., l.v." : "l.v.";
    parts.push(
      partOf(
        id,
        [{ type: "text", at: x.events[0]!.at, text, placement: "above" }, ...x.events],
        x.levels,
      ),
    );
  }
  for (const [id, x] of rings) parts.push(partOf(id, byTime(x.events), byTime(x.levels)));

  // The ground comes back under the cello's last notes and goes with it.
  {
    const from = floorTo(cello[cp.halves]!.at - 2 * TICKS, TICKS);
    const to = ceilTo(cEnd + 2 * TICKS, TICKS);
    const swell: DynamicPoint[] = [
      { at: time(from), level: 0, to: "linear" },
      { at: time(from + 4 * TICKS), level: 1.2 },
      { at: time(cEnd - 2 * TICKS), level: 1.2, to: "linear" },
      { at: time(to), level: 0 },
    ];
    parts.push(
      partOf(
        "cb-4-1",
        [{ at: time(from), dur: time(to - from), pitch: { midi: 28 }, technique: "sul-tasto" }],
        swell,
      ),
      partOf("bd", [{ at: time(from), dur: time(to - from), technique: "roll+soft" }], swell),
    );
  }

  const rank = (id: string) => ensemble.findIndex((pl) => pl.id === id);
  parts.sort((a, b) => rank(a.id) - rank(b.id));
  const bar = (t: number) => Math.floor(t / BAR) + 1;
  const letters = [0, cello[cp.halves]!.at, cEnd];
  return {
    title: "antara · the ending",
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

const floorTo = (t: number, grid: number) => Math.floor(t / grid) * grid;
const ceilTo = (t: number, grid: number) => Math.ceil(t / grid) * grid;
const num = (t: NoteEvent["at"]) => (typeof t === "number" ? t : t[0] / t[1]);

/** Where a section made of this sketch may stop or start: held notes while they hold, strokes at their onsets. */
export function seams(score: Score): Record<string, Seam[]> {
  const out: Record<string, Seam[]> = {};
  for (const p of score.parts) {
    const notes = p.events.filter((e): e is NoteEvent => e.type !== "text");
    out[p.id] = notes.map((n): Seam =>
      num(n.dur) >= 4 ? [num(n.at), num(n.at) + num(n.dur)] : num(n.at),
    );
  }
  return out;
}

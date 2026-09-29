// antara palette, B: percussion takes the line at 0.
//
// Uses the idea sketch "one note handed on" (../../../ideas/lines/b-hand-off), which closes its
// betweens the way "the betweens narrow" does (../../../ideas/lines/b-narrowing): a rising line is
// handed from instrument to instrument, one note each; at every stage every between of its set is
// one quarter tone narrower, until the line is one pitch; who plays next keeps turning round by a
// rule of its own, so at the end the line goes on in colour alone.
//
// Here that handing on is the way in for unpitched percussion. An unpitched instrument is one whose
// set of pitch betweens can hold only 0. While the line's set holds any between other than 0, only
// twelve pitched colours take turns. Where every between of the set has closed to 0, nothing tells
// a pitched instrument from an unpitched one, so seven colours of 0 (six unpitched percussion and
// the second violins col legno on the standpoint) join the turn, spread among the twelve as evenly
// as seven go into nineteen (two or three places apart within a round, no block of strokes): a
// stroke without pitch sounds in the same row as a held standpoint, one line. Then the set opens again,
// stage by stage, in the reverse order of the closing. The colours of 0 cannot follow a between
// other than 0, so from the first stage that opens they leave the turn and keep a line of their own
// at 0, in a time of its own: the rhythm's set drawn by the same rule, each pair it draws added into
// one between, counted in quintuplet 16ths (in triplet 8ths one round of the set would be exactly
// two bars), from the first beat on (where the two grids meet). That line holds on while the set
// still holds a 0 and stops at the stage where none is left. One line has become two, a line of
// pitch betweens and a line of colours, each on its own grid.
//
// A stage is the standpoint and then the set's betweens added in order, so the line comes back to
// the standpoint at every stage and stays in one band that every pitched colour can sound. The hand
// off: the next note goes to the next colour of the turn, and each round of the turn starts one
// colour later. The tubular bells and the vibraphone hold only the usual grid, so a note a quarter
// tone off skips them and goes to the next colour. When the turn changes (at the 0, and where the
// line opens) it goes on from the colour that would have come next. Everything at p.
// Card: README.md.

import type { NoteEvent, Part, TextEvent } from "../../../../../src/score/types.ts";
import { betweenSet, number, pitch, text, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, drawer } from "../../../between.ts";
import { curve, gridOf, note, scoreOf, stream, TICKS, time } from "../../common.ts";

interface Colour {
  id: string;
  instrument: string;
  name: string;
  abbreviation: string;
  players?: number;
  /** Pitched colours: the grids it can sound, and where its notes can go (sounding, sampled). */
  grids?: number[];
  range?: [number, number];
  technique?: string;
  /** Rings on after the stroke. */
  lv?: boolean;
  /** Colours of 0 that still play a pitch (col legno): they play the standpoint. */
  onStandpoint?: boolean;
}

const PITCHED: Record<string, Colour> = {
  bcl: {
    id: "bcl",
    instrument: "bass-clarinet",
    name: "Bass Clarinet",
    abbreviation: "B. Cl.",
    grids: [0, 1],
    range: [34, 76],
  },
  vc: {
    id: "vc",
    instrument: "cellos",
    name: "Cello (solo)",
    abbreviation: "Vc.",
    players: 1,
    grids: [0, 1],
    range: [36, 82],
  },
  hn: {
    id: "hn",
    instrument: "horn",
    name: "Horn",
    abbreviation: "Hn.",
    grids: [0, 1],
    range: [34, 77],
  },
  bells: {
    id: "bells",
    instrument: "tubular-bells",
    name: "Tubular Bells",
    abbreviation: "T. Bells",
    grids: [0],
    range: [61, 77],
    lv: true,
  },
  ob: {
    id: "ob",
    instrument: "oboe",
    name: "Oboe",
    abbreviation: "Ob.",
    grids: [0, 1],
    range: [58, 90],
  },
  tbn: {
    id: "tbn",
    instrument: "trombone",
    name: "Trombone",
    abbreviation: "Tbn.",
    grids: [0, 1],
    range: [40, 72],
  },
  vib: {
    id: "vib",
    instrument: "vibraphone",
    name: "Vibraphone",
    abbreviation: "Vib.",
    grids: [0],
    range: [53, 89],
    lv: true,
  },
  fl: {
    id: "fl",
    instrument: "flute",
    name: "Flute",
    abbreviation: "Fl.",
    grids: [0, 1],
    range: [60, 96],
  },
  va: {
    id: "va",
    instrument: "violas",
    name: "Viola (solo)",
    abbreviation: "Va.",
    players: 1,
    grids: [0, 1],
    range: [48, 90],
  },
  tpt: {
    id: "tpt",
    instrument: "trumpet",
    name: "Trumpet",
    abbreviation: "Tpt.",
    grids: [0, 1],
    range: [54, 84],
    technique: "muted",
  },
  cl: {
    id: "cl",
    instrument: "clarinet",
    name: "Clarinet",
    abbreviation: "Cl.",
    grids: [0, 1],
    range: [50, 88],
  },
  bsn: {
    id: "bsn",
    instrument: "bassoon",
    name: "Bassoon",
    abbreviation: "Bsn.",
    grids: [0, 1],
    range: [34, 74],
  },
};

const ZEROS: Record<string, Colour> = {
  vn2: {
    id: "vn2",
    instrument: "violins-2",
    name: "Violins II",
    abbreviation: "Vn. II",
    technique: "col-legno",
    onStandpoint: true,
  },
  bd: { id: "bd", instrument: "bass-drum", name: "Bass Drum", abbreviation: "B. D." },
  trgl: { id: "trgl", instrument: "triangle", name: "Triangle", abbreviation: "Trgl." },
  tt: { id: "tt", instrument: "tam-tam", name: "Tam-tam", abbreviation: "T.-t." },
  wb: {
    id: "wb",
    instrument: "woodblock-medium",
    name: "Woodblock",
    abbreviation: "W. B.",
  },
  cym: {
    id: "cym",
    instrument: "suspended-cymbal",
    name: "Suspended Cymbal",
    abbreviation: "Sus. Cym.",
  },
  td: { id: "td", instrument: "tenor-drum", name: "Tenor Drum", abbreviation: "T. D." },
};

const COLOURS: Record<string, Colour> = { ...PITCHED, ...ZEROS };
// Score order: woodwinds, brass, pitched percussion, unpitched percussion, strings.
const SCORE_ORDER = "fl ob cl bcl bsn hn tpt tbn bells vib trgl wb cym tt td bd vn2 va vc".split(
  " ",
);

export const knobs = {
  // Default: two betweens with .5 and two without; the widest, 4, closes in 8 stages; the sum, 11,
  // fills the band every colour can sound. The smallest is one atom, so it closes first: in stages
  // 1 to 5 three betweens are left, so from stage 1 to stage 6 the top of each stage moves by three
  // quarter tones, from one grid to the other (while four are left it moves by four, on one grid).
  set: betweenSet({
    group: "Pitch",
    label: "Rising set",
    help: "The betweens the line climbs by at the first stage, added in order from the standpoint (semitones, .5 for a quarter tone). At each stage all of them one quarter tone narrower, to 0; then they open again the same way back",
    value: "0.5 3 3.5 4",
    min: 0.5,
    max: 12,
    step: 0.5,
    unit: "st",
    anchor: "standpoint",
  }),
  standpoint: pitch({
    group: "Pitch",
    label: "Standpoint",
    help: "Where every stage starts, and the one pitch the line closes to (the col legno strokes play it too)",
    value: "C#4",
    min: "G3",
    max: "C5",
    step: 0.5,
  }),
  zero: number({
    group: "Pitch",
    label: "Zero notes",
    help: "How many notes the line stays at the standpoint with every between 0 (the colours of 0 are in the turn for exactly these notes)",
    value: 24,
    min: 1,
    max: 76,
    step: 1,
  }),
  rhythm: betweenSet({
    group: "Time",
    label: "Rhythm",
    help: "The time betweens of the one time line, in 16ths, drawn by combinations two at a time. Once the line opens, the line of the colours of 0 adds each pair into one between, in quintuplet 16ths",
    value: "2 3 3 4",
    min: 1,
    max: 16,
    step: 1,
    unit: "atoms",
  }),
  pitched: text({
    group: "Colours",
    label: "Pitched order",
    help: "The turn of the pitched colours, as written: bcl vc hn bells ob tbn vib fl va tpt cl bsn (each once, any of them)",
    value: "bcl vc hn bells ob tbn vib fl va tpt cl bsn",
  }),
  zeros: text({
    group: "Colours",
    label: "Colours of 0",
    help: "The turn of the colours of 0, as written: vn2 (col legno) bd trgl tt wb cym td (each once, any of them)",
    value: "vn2 bd trgl tt wb cym td",
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

/** Keys of a turn written as text, each one of `from`, each once. */
function turnOf(label: string, value: string, from: Record<string, Colour>): string[] {
  const keys = value.split(/[\s,、]+/).filter(Boolean);
  const unknown = keys.filter((k) => !(k in from));
  if (unknown.length > 0)
    throw new Error(`${label}: ${unknown.join(", ")} not known (${Object.keys(from).join(" ")})`);
  if (new Set(keys).size !== keys.length) throw new Error(`${label}: each colour once`);
  if (keys.length < 3) throw new Error(`${label}: at least three colours`);
  return keys;
}

/** A turn: each round plays the list in order, and the next round starts one colour later. */
interface Turn {
  list: string[];
  start: number;
  k: number;
}
const turnFrom = (list: string[], first: string): Turn => ({
  list,
  start: Math.max(0, list.indexOf(first)),
  k: 0,
});
function take(t: Turn): string {
  const c = t.list[(t.start + t.k) % t.list.length]!;
  if (++t.k === t.list.length) {
    t.k = 0;
    t.start = (t.start + 1) % t.list.length;
  }
  return c;
}
/** The first colour to come that passes a test, without taking any turn. */
function upcoming(t: Turn, ok: (c: string) => boolean): string {
  const copy = { ...t };
  for (let i = 0; i < 2 * t.list.length; i++) {
    const c = take(copy);
    if (ok(c)) return c;
  }
  throw new Error("No colour of the turn fits");
}

/**
 * Two turns as one: the colours of `b` spread among those of `a` as evenly as they go (of the n
 * places, place p goes to `b` where floor((p + 1) · b / n) passes floor(p · b / n)), each keeping
 * its written order.
 */
function mixed(a: string[], b: string[]): string[] {
  const n = a.length + b.length;
  const out: string[] = [];
  let i = 0;
  let j = 0;
  for (let p = 0; p < n; p++) {
    const fromB = Math.floor(((p + 1) * b.length) / n) > Math.floor((p * b.length) / n);
    out.push(fromB ? b[j++]! : a[i++]!);
  }
  return out;
}

const sounds = (c: Colour, midi: number) =>
  (c.grids ?? [0]).includes(gridOf(midi)) &&
  (!c.range || (midi >= c.range[0] && midi <= c.range[1]));

type Phase = "closing" | "zero" | "opening";

export function score(v: Values<typeof knobs>) {
  const pitched = turnOf("Pitched order", v.pitched, PITCHED);
  const zeros = turnOf("Colours of 0", v.zeros, ZEROS);
  const s = v.standpoint;
  const set = [...v.set];

  // The line: closing stages (every between 0.5 k narrower, until all are 0), the zero, and the
  // same stages opening again in reverse.
  const stages = Math.round(Math.max(...set) / 0.5);
  const tonesOf = (k: number) => {
    const out = [s];
    for (const b of set) out.push(out.at(-1)! + Math.max(0, b - 0.5 * k));
    return out;
  };
  // Whether the set of stage k still holds a between of 0.
  const holdsZero = (k: number) => set.some((b) => b - 0.5 * k <= 0);
  const line: { midi: number; phase: Phase; stage: number }[] = [];
  for (let k = 0; k < stages; k++)
    for (const midi of tonesOf(k)) line.push({ midi, phase: "closing", stage: k });
  for (let i = 0; i < v.zero; i++) line.push({ midi: s, phase: "zero", stage: stages });
  for (let k = stages - 1; k >= 0; k--)
    for (const midi of tonesOf(k)) line.push({ midi, phase: "opening", stage: k });

  // One time line: the pitched line throughout, and the colours of 0 while they are in the turn.
  const atom = atomOf(2);
  const rhythm = stream(v.rhythm, "combinations", 2);
  const onsets = [0];
  for (let i = 1; i < line.length; i++) onsets.push(onsets.at(-1)! + rhythm() * atom);
  const last = onsets.at(-1)!;
  const fade = 4 * TICKS;
  const bar = 4 * TICKS;
  const end = Math.ceil((last + fade) / bar) * bar;

  // The hand-off.
  const played = new Map<string, { at: number; stop: number; midi?: number }[]>();
  const play = (c: string, at: number, stop: number, midi?: number) =>
    played.set(c, [...(played.get(c) ?? []), { at, stop, midi }]);
  const isPitched = (c: string) => c in PITCHED;
  let turn = turnFrom(pitched, pitched[0]!);
  // The turn of the colours of 0 once they leave the one line (set where the line opens).
  const zeroLine: { turn?: Turn } = {};
  line.forEach((x, i) => {
    const prev = line[i - 1]?.phase;
    if (x.phase === "zero" && prev !== "zero")
      turn = turnFrom(
        mixed(pitched, zeros),
        upcoming(turn, () => true),
      );
    if (x.phase === "opening" && prev === "zero") {
      zeroLine.turn = turnFrom(
        zeros,
        upcoming(turn, (c) => !isPitched(c)),
      );
      turn = turnFrom(pitched, upcoming(turn, isPitched));
    }
    const at = onsets[i]!;
    const next = onsets[i + 1] ?? last + fade;
    // The next colour of the turn that can sound the note: a colour of 0 sounds only the 0.
    let c = take(turn);
    for (let tries = 0; !(isPitched(c) ? sounds(COLOURS[c]!, x.midi) : x.midi === s); tries++) {
      if (tries > 2 * turn.list.length)
        throw new Error("Pitched order: no colour can sound the line");
      c = take(turn);
    }
    const colour = COLOURS[c]!;
    if (!isPitched(c)) play(c, at, at + atom, colour.onStandpoint ? s : undefined);
    else if (colour.lv) play(c, at, Math.min(at + 2 * TICKS, end), x.midi);
    else play(c, at, next, x.midi);
  });

  // Opening: the colours of 0 keep a line of their own at 0, in its own time. The rhythm's set by
  // the same rule, each pair added into one between, counted in quintuplet 16ths; it starts on the
  // first beat at or after the split (where the grids of the 16ths and the quintuplets meet) and
  // stops at the first stage whose set holds no 0.
  const split = line.findIndex((x) => x.phase === "opening");
  const zeroTurn = zeroLine.turn;
  if (zeroTurn && split >= 0) {
    const gone = line.findIndex((x, i) => i >= split && !holdsZero(x.stage));
    const stop = gone >= 0 ? onsets[gone]! : last;
    const quint = atomOf(5);
    const pairs = drawer(v.rhythm, "combinations", 2, "ascending");
    for (let at = Math.ceil(onsets[split]! / TICKS) * TICKS; at < stop;) {
      const z = take(zeroTurn);
      play(z, at, at + quint, COLOURS[z]!.onStandpoint ? s : undefined);
      at += pairs().reduce((a, b) => a + b, 0) * quint;
    }
  }

  const lastColour = [...played].find(([c, xs]) => isPitched(c) && xs.at(-1)!.at === last)?.[0];
  const parts: Part[] = SCORE_ORDER.filter((c) => pitched.includes(c) || zeros.includes(c)).map(
    (c) => {
      const colour = COLOURS[c]!;
      const xs = played.get(c) ?? [];
      const events: (NoteEvent | TextEvent)[] = xs.map((x, j) => {
        // A ringing colour is written to its own next note at most.
        const stop = colour.lv ? Math.min(x.stop, xs[j + 1]?.at ?? x.stop) : x.stop;
        const extra: Partial<NoteEvent> = colour.technique ? { technique: colour.technique } : {};
        return x.midi === undefined
          ? { at: time(x.at), dur: time(stop - x.at), ...extra }
          : note(x.at, stop - x.at, x.midi, extra);
      });
      if (colour.lv && xs.length > 0)
        events.unshift({ type: "text", at: time(xs[0]!.at), text: "l.v." });
      // p throughout; the last note of the line fades to nothing.
      const points: { at: number; level: number; ramp?: boolean }[] = [{ at: 0, level: 3 }];
      if (c === lastColour)
        points.push({ at: last, level: 3, ramp: true }, { at: last + fade, level: 0 });
      const out: Part = {
        id: colour.id,
        instrument: colour.instrument,
        name: colour.name,
        abbreviation: colour.abbreviation,
        dynamics: curve(points),
        events,
      };
      if (colour.players !== undefined) out.players = colour.players;
      return out;
    },
  );

  return scoreOf("antara · palette B · percussion takes the line at 0", end / bar, v.tempo, parts);
}

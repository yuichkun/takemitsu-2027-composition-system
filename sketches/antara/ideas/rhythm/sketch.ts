// antara, rhythm: the opening's pulse becomes rhythm. Card: README.md.
//
// The opening ends with the whole orchestra on every beat (♩ = 60): a time set with one between.
// Here three choirs, one for each family, take that pulse over (the low choir and the celesta
// first, the celesta keeping the opening's note for two bars) and their time sets grow. First each
// splits the beat into two of its own atoms, so every beat is still struck by all, and between the
// beats the families part (2 against 3 against 5). Then each gains a between that does not add up
// to a beat, and the choirs drift apart: they meet only where their sums happen to fall together,
// and there the woodblocks sound (where all three meet, a short chord of the horns and trombones).
// Then the rule turns fluid (every combination of two, in dictionary order) and more players take
// each stroke. At the end the middle choir, all together, strikes every second triplet 8th: the
// beat of the next section (♩ = 90), while the others stop.
//
// Each choir keeps to a few pitches of its register (the opening's F♯ and E, a quarter tone below,
// a whole tone above), and its strokes go round its players, so the colour changes from stroke to
// stroke. The pitches are colours; the rhythm is the matter.

import { ensemble } from "../../../../pieces/antara/ensemble.ts";
import type { DynamicPoint, Event, NoteEvent, Part, Score } from "../../../../src/score/types.ts";
import type { Seam } from "../../../../src/sketch/nest.ts";
import { betweenSet, number, type Values } from "../../../../src/sketch/knobs.ts";
import { atomOf, drawer, TICKS, time } from "../../between.ts";

const BAR = 4 * TICKS;
const A2 = atomOf(2);
const A3 = atomOf(3);
const A5 = atomOf(5);

/** Bars where each stage begins: the pulse, the split beat, the drift, the fluid rule, the handover; and the end. */
const STAGES = { pulse: 0, split: 4, drift: 12, fluid: 20, handover: 26, end: 28 };

type Colour = "any" | "semitones" | "quarter tones";
interface Player {
  id: string;
  colour: Colour;
  /** Sounding range. */
  range: [number, number];
  technique?: string;
  staccato?: boolean;
}
interface Choir {
  name: string;
  atom: number;
  /** The anchor of its pitches: it, a quarter tone below, a whole tone above. */
  anchor: number;
  /** The bar it comes in. */
  enter: number;
  players: Player[];
}

const wind = (id: string, range: [number, number]): Player => ({
  id,
  colour: "any",
  range,
  staccato: true,
});
const CHOIRS: Choir[] = [
  {
    name: "high",
    atom: A5,
    anchor: 78,
    enter: 2,
    players: [
      { id: "glk", colour: "semitones", range: [79, 108] },
      wind("picc", [74, 100]),
      { id: "vn1t", colour: "any", range: [55, 96], technique: "pizz" },
      { id: "hp1", colour: "semitones", range: [24, 100], technique: "damped" },
      wind("fl1", [62, 96]),
      wind("fl2", [62, 96]),
    ],
  },
  {
    name: "middle",
    atom: A3,
    anchor: 66,
    enter: 1,
    players: [
      { id: "vib", colour: "semitones", range: [53, 89] },
      wind("ob1", [60, 88]),
      { id: "vn2t", colour: "any", range: [55, 90], technique: "pizz" },
      { id: "hp2", colour: "quarter tones", range: [24, 100], technique: "damped" },
      wind("cl1", [52, 88]),
      wind("eh", [53, 78]),
      { id: "vat", colour: "any", range: [48, 80], technique: "col-legno" },
      wind("ob2", [60, 88]),
      wind("cl2", [52, 88]),
    ],
  },
  {
    name: "low",
    atom: A2,
    anchor: 40,
    enter: 0,
    players: [
      { id: "timp", colour: "any", range: [38, 55] },
      wind("bn1", [34, 64]),
      { id: "vct", colour: "any", range: [36, 64], technique: "pizz" },
      { id: "pno", colour: "semitones", range: [28, 96], staccato: true },
      wind("bcl", [34, 64]),
      { id: "cbt", colour: "any", range: [28, 55], technique: "pizz" },
      wind("bn2", [34, 64]),
      wind("cbn", [24, 50]),
    ],
  },
];

export const knobs = {
  high: betweenSet({
    group: "High (quintuplet 16ths)",
    label: "Split",
    help: "The high choir's set once it splits the beat: quintuplet 16ths adding up to a beat (5)",
    value: "2 3",
    min: 1,
    max: 10,
    step: 1,
    unit: "atoms",
  }),
  highDrift: betweenSet({
    group: "High (quintuplet 16ths)",
    label: "Drift",
    help: "Its set once the choirs drift: one between more, so a time round no longer adds up to whole beats",
    value: "2 3 4",
    min: 1,
    max: 10,
    step: 1,
    unit: "atoms",
  }),
  middle: betweenSet({
    group: "Middle (triplet 8ths)",
    label: "Split",
    help: "The middle choir's set once it splits the beat: triplet 8ths adding up to a beat (3)",
    value: "1 2",
    min: 1,
    max: 6,
    step: 1,
    unit: "atoms",
  }),
  middleDrift: betweenSet({
    group: "Middle (triplet 8ths)",
    label: "Drift",
    help: "Its set once the choirs drift",
    value: "1 2 2",
    min: 1,
    max: 6,
    step: 1,
    unit: "atoms",
  }),
  low: betweenSet({
    group: "Low (16ths)",
    label: "Split",
    help: "The low choir's set once it splits the beat: 16ths adding up to a beat (4)",
    value: "1 3",
    min: 1,
    max: 8,
    step: 1,
    unit: "atoms",
  }),
  lowDrift: betweenSet({
    group: "Low (16ths)",
    label: "Drift",
    help: "Its set once the choirs drift",
    value: "1 2 3",
    min: 1,
    max: 8,
    step: 1,
    unit: "atoms",
  }),
  tempo: number({
    group: "Sound",
    label: "Tempo",
    help: "Quarter notes per minute: the opening's pulse",
    value: 60,
    min: 48,
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

/** Onsets from `from` to `to` (ticks), adding the betweens a rule draws from a set, in `atom`s. */
function onsets(from: number, to: number, set: number[], rule: string, atom: number): number[] {
  const draw = drawer(set, rule, 2, "ascending");
  const out: number[] = [];
  let t = from;
  while (t < to) {
    for (const b of draw()) {
      if (t >= to) break;
      out.push(t);
      t += b * atom;
    }
  }
  return out;
}

/** A choir's pitches: its anchor, a quarter tone below, a whole tone above. */
const pitchesOf = (c: Choir) => [c.anchor, c.anchor - 0.5, c.anchor + 2];

/** The pitch a player takes in its choir: the first of its colour that it can play (an octave off if need be). */
function pitchFor(c: Choir, p: Player, k: number): number {
  const all = pitchesOf(c).filter((m) =>
    p.colour === "semitones"
      ? Number.isInteger(m)
      : p.colour === "quarter tones"
        ? !Number.isInteger(m)
        : true,
  );
  const m = all[k % all.length]!;
  for (const o of [0, 12, -12, 24, -24])
    if (m + o >= p.range[0] && m + o <= p.range[1]) return m + o;
  return m;
}

export function score(v: V): Score {
  const bar = (b: number) => b * BAR;
  const splits: Record<string, [number[], number[]]> = {
    high: [v.high, v.highDrift],
    middle: [v.middle, v.middleDrift],
    low: [v.low, v.lowDrift],
  };
  const beat: Record<number, number> = { [A5]: 5, [A3]: 3, [A2]: 4 };
  const notes = new Map<string, Event[]>();
  const levels = new Map<string, DynamicPoint[]>();
  const add = (id: string, e: NoteEvent, level: number) => {
    notes.set(id, [...(notes.get(id) ?? []), e]);
    levels.set(id, [...(levels.get(id) ?? []), { at: e.at, level }]);
  };
  // How many players take a stroke, and how loud, stage by stage.
  const stage = (t: number) =>
    t < bar(STAGES.split)
      ? { players: 1, level: 3.5 }
      : t < bar(STAGES.drift)
        ? { players: 1, level: 4.5 }
        : t < bar(STAGES.fluid)
          ? { players: 2, level: 5 }
          : t < bar(STAGES.handover)
            ? { players: 3, level: 6 }
            : { players: 9, level: 6.5 };

  // Every choir's onsets, stage by stage.
  const strokes = new Map<string, number[]>();
  for (const c of CHOIRS) {
    const [split, drift] = splits[c.name]!;
    const pulse = [beat[c.atom]!];
    const ts = [
      ...onsets(bar(c.enter), bar(STAGES.split), pulse, "in order", c.atom),
      ...onsets(bar(STAGES.split), bar(STAGES.drift), split, "shift each time", c.atom),
      ...onsets(bar(STAGES.drift), bar(STAGES.fluid), drift, "shift each time", c.atom),
      ...onsets(bar(STAGES.fluid), bar(STAGES.handover), drift, "combinations", c.atom),
    ];
    // The handover: only the middle choir, every second triplet 8th (the next section's beat).
    if (c.name === "middle")
      ts.push(...onsets(bar(STAGES.handover), bar(STAGES.end), [2], "in order", c.atom));
    strokes.set(c.name, ts);
    // Each stroke goes round the choir's players (more of them as the stages go on).
    let turn = 0;
    ts.forEach((t, k) => {
      const next = ts[k + 1] ?? t + c.atom;
      const { players, level } = stage(t);
      const take = Math.min(players, c.players.length);
      for (let n = 0; n < take; n++) {
        const p = c.players[(turn + n) % c.players.length]!;
        const e: NoteEvent = {
          at: time(t),
          dur: time(Math.min(c.atom, next - t)),
          pitch: { midi: pitchFor(c, p, turn + n) },
        };
        if (p.technique) e.technique = p.technique;
        const marks: ("staccato" | "accent")[] = p.staccato ? ["staccato"] : [];
        if (t >= bar(STAGES.handover)) marks.push("accent");
        if (marks.length) e.articulations = marks;
        add(p.id, e, level);
      }
      turn += take;
    });
  }

  // The celesta keeps the opening's note on the beat for two bars, softly.
  for (let t = 0; t < bar(2); t += TICKS)
    add("cel", { at: time(t), dur: time(TICKS / 2), pitch: { midi: 78 } }, 3 - t / bar(2));

  // Where the choirs' strokes fall together (once they drift): the woodblocks (high where two meet,
  // low where all three do), and where all three meet, a short chord of horns and trombones.
  const count = new Map<number, number>();
  for (const [name, ts] of strokes) {
    if (name === "middle") {
      for (const t of ts) if (t < bar(STAGES.handover)) count.set(t, (count.get(t) ?? 0) + 1);
    } else for (const t of ts) count.set(t, (count.get(t) ?? 0) + 1);
  }
  const BRASS: [string, number][] = [
    ["hn1", 68],
    ["hn2", 66],
    ["hn3", 65.5],
    ["hn4", 64],
    ["tb1", 54],
    ["tb2", 52],
  ];
  for (const [t, n] of [...count].sort((a, b) => a[0] - b[0])) {
    if (n < 2 || t < bar(STAGES.drift) || t >= bar(STAGES.handover)) continue;
    const { level } = stage(t);
    add(n === 3 ? "wbl" : "wbh", { at: time(t), dur: time(A5), articulations: ["accent"] }, level);
    if (n === 3)
      for (const [id, midi] of BRASS)
        add(
          id,
          {
            at: time(t),
            dur: time(TICKS / 4),
            pitch: { midi },
            articulations: ["accent", "staccato"],
          },
          level + 0.5,
        );
  }
  // The handover's beat on the low woodblock too.
  for (let t = bar(STAGES.handover); t < bar(STAGES.end); t += 2 * A3)
    add("wbl", { at: time(t), dur: time(A3), articulations: ["accent"] }, 6.5);

  const parts: Part[] = [...notes].map(([id, events]) =>
    partOf(
      id,
      events.sort((a, b) => num(a.at) - num(b.at)),
      levels.get(id)!.sort((a, b) => num(a.at) - num(b.at)),
    ),
  );
  // The next section begins on marimba: prepare the change before the final woodblock strokes.
  const woodblock = parts.find((p) => p.id === "wbl");
  if (woodblock)
    woodblock.events.push({
      type: "text",
      at: Math.max(0, STAGES.end * 4 - 8),
      text: "prepare marimba",
      placement: "above",
    });
  const rank = (id: string) => ensemble.findIndex((pl) => pl.id === id);
  parts.sort((a, b) => rank(a.id) - rank(b.id));
  return {
    title: "antara · rhythm",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: STAGES.end,
    rehearsal: [STAGES.split, STAGES.drift, STAGES.fluid, STAGES.handover].map((b, n) => ({
      measure: b + 1,
      label: String.fromCharCode(65 + n),
    })),
    // Every player on a staff of their own (docs/decisions/0025).
    pairs: false,
    parts,
  };
}

const num = (t: NoteEvent["at"]) => (typeof t === "number" ? t : t[0] / t[1]);

/** Where a section made of this sketch may stop or start: strokes at their onsets. */
export function seams(score: Score): Record<string, Seam[]> {
  const out: Record<string, Seam[]> = {};
  for (const p of score.parts) {
    const ns = p.events.filter((e): e is NoteEvent => e.type !== "text");
    out[p.id] = ns.map((n): Seam => num(n.at));
  }
  return out;
}

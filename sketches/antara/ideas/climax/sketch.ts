// antara, the climax: the piece's highest point. A huge bell tolls again and again, until it is cut
// off with a vibraslap and only an afterglow is left, out of which the next section comes.
// Card: README.md.
//
// The bell is a chord of the winds (palette a/pitch-half-moves): the standpoint, the note the low
// strings hold in octaves, plus the sum of every choice from a set of whole betweens (16 notes, the
// first bell), and the same again a .5 between higher, on the other grid (16 more, the second
// bell). The piano and the celesta strike with the first bell. The harps sweep fixed pedal
// settings drawn from the pitch classes common to every state of their respective bells. Each
// toll changes the size of one of the smaller betweens, in turn: half of the bell moves, half stays.
//
// First the whole bell (both halves) tolls, slowly. Then it splits: the two bells toll in turn, the
// first on triplet 8ths, the second on quintuplet 16ths. The first bell's betweens close in by the
// section's law (half way each time round), and the second comes half way after it, then a
// quarter, then an eighth, until both strike at once: the whole bell's last stroke, the vibraslap,
// and everything stops. Under the tolls the upper strings run through the first bell's notes (each
// section on its own family, stepping to the next note of the bell up or down) and the low strings
// hold the standpoint in tremolo; the suspended cymbal and the timpani roll up into the strokes.
// After the cut the harps damp, the tam-tam rings on, and falling figures in the winds, celesta,
// glockenspiel and vibraphone drift down through the bell's notes.

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
import {
  betweenSet,
  number,
  numbersOf,
  pitch,
  text,
  type Values,
} from "../../../../src/sketch/knobs.ts";
import { atomOf, TICKS, time } from "../../between.ts";

const BAR = 4 * TICKS;
const A2 = atomOf(2);
const A3 = atomOf(3);
const A5 = atomOf(5);
/** The first bell's betweens once it has split close in on this (triplet 8ths): 3 beats. */
const GOAL = 9;

/** Where each wind is at home at fff (sounding MIDI numbers): a voice of the bell must stay inside. */
const RANGE: Record<string, [number, number]> = {
  picc: [76, 100],
  fl1: [62, 94],
  fl2: [62, 94],
  ob1: [60, 88],
  ob2: [60, 88],
  eh: [53, 78],
  cl1: [52, 88],
  cl2: [52, 88],
  bcl: [34, 70],
  bn1: [34, 70],
  bn2: [34, 70],
  cbn: [24, 50],
  hn1: [41, 72],
  hn2: [38, 70],
  hn3: [41, 72],
  hn4: [36, 68],
  tp1: [55, 80],
  tp2: [55, 80],
  tp3: [55, 78],
  tb1: [40, 68],
  tb2: [40, 66],
  btb: [30, 60],
  tba: [28, 58],
};
/** The winds of each bell, low to high: each group spans the whole register. */
const WINDS = [
  ["tba", "bcl", "bn1", "tb1", "hn3", "hn1", "tp1", "cl1", "ob1", "fl1", "picc"],
  ["cbn", "btb", "bn2", "tb2", "hn4", "hn2", "eh", "tp2", "tp3", "cl2", "ob2", "fl2"],
];
const BRASS = new Set([
  "hn1",
  "hn2",
  "hn3",
  "hn4",
  "tp1",
  "tp2",
  "tp3",
  "tb1",
  "tb2",
  "btb",
  "tba",
]);

/** The upper strings: each runs on its own family, in its own band, turning after runs of these lengths. */
const RUNNERS = [
  { id: "vn1t", atom: A5, band: [67, 93] as [number, number], runs: [4, 3, 5, 2] },
  { id: "vn2t", atom: A3, band: [55, 81] as [number, number], runs: [3, 5, 2, 4] },
  { id: "vat", atom: A2, band: [48, 74] as [number, number], runs: [5, 2, 4, 3] },
];

/** The afterglow's falling figures: which wind, from which bell, on which family. */
const FALLING: [string, 0 | 1, number][] = [
  ["picc", 0, A5],
  ["fl1", 0, A3],
  ["fl2", 1, A3],
  ["ob1", 0, A2],
  ["cl2", 1, A5],
  ["ob2", 1, A2],
  ["cl1", 0, A5],
  ["eh", 1, A3],
];

export const knobs = {
  standpoint: pitch({
    group: "Bell",
    label: "Standpoint",
    help: "The note the low strings hold in octaves (tremolo); the bell is counted up from it",
    value: "E1",
    min: "C1",
    max: "C2",
    step: 1,
  }),
  bell: betweenSet({
    group: "Bell",
    label: "Betweens",
    help: "The first bell: the standpoint plus the sum of every choice of these whole betweens (2 × 2 × 2 × 2 = 16 notes). The largest stays; the others change, one a toll",
    value: "6 9 13 32",
    min: 1,
    max: 40,
    step: 1,
    unit: "st",
  }),
  changes: text({
    group: "Bell",
    label: "Changes",
    help: "How much each of the smaller betweens changes (smallest first). One changes a toll, the smallest most often: the half of the bell that holds it moves by that much, the other half stays",
    value: "1 2 -3",
  }),
  second: number({
    group: "Bell",
    label: "Second bell",
    help: "How far above the first bell the second one is: this many semitones and a quarter tone (2: 2.5), so it is the same shape on the other grid",
    value: 2,
    min: 0,
    max: 11,
    step: 1,
    unit: "st + ¼",
  }),
  toll: number({
    group: "Time",
    label: "Toll",
    help: "Beats between the strokes of the whole bell, before it splits",
    value: 13,
    min: 6,
    max: 20,
    step: 1,
    unit: "beats",
  }),
  tolls: number({
    group: "Time",
    label: "Tolls",
    help: "Strokes of the whole bell before it splits",
    value: 4,
    min: 2,
    max: 8,
    step: 1,
  }),
  dialogue: betweenSet({
    group: "Time",
    label: "Dialogue",
    help: "Once split, the first bell's betweens (triplet 8ths), widest first. After each time round every one moves half way towards 9 (3 beats)",
    value: "21 24 27",
    min: 3,
    max: 60,
    step: 1,
    unit: "atoms",
  }),
  rounds: number({
    group: "Time",
    label: "Rounds",
    help: "Time rounds of the dialogue. In each the second bell comes 1/2, then 1/4, 1/8 … of the between after the first; after the last, both strike at once",
    value: 3,
    min: 1,
    max: 6,
    step: 1,
  }),
  afterglow: number({
    group: "Time",
    label: "Afterglow",
    help: "Beats after the last stroke",
    value: 12,
    min: 4,
    max: 24,
    step: 1,
    unit: "beats",
  }),
  tempo: number({
    group: "Sound",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 120,
    min: 80,
    max: 144,
    step: 4,
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

/** Moves each member half way (at least one) towards `goal`: the law the opening used. */
const closer = (set: number[], goal: number) =>
  set.map(
    (m) =>
      m + Math.sign(goal - m) * (m === goal ? 0 : Math.max(1, Math.round(Math.abs(goal - m) / 2))),
  );

const floorTo = (t: number, grid: number) => Math.floor(t / grid) * grid;
const ceilTo = (t: number, grid: number) => Math.ceil(t / grid) * grid;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

//==============================================================================
// The bell

/** One stroke: when, which bells (0 the first, 1 the second), the sizes it uses (a Gray code step). */
interface Toll {
  at: number;
  bells: (0 | 1)[];
  state: number;
  final?: boolean;
  /** In the dialogue: the time round that sets how soon the second bell follows this stroke. */
  round?: number;
}

/** The whole bell's strokes, then the dialogue, then both at once. */
function tollsOf(v: V): Toll[] {
  const out: Toll[] = [];
  for (let i = 0; i < v.tolls; i++) out.push({ at: i * v.toll * TICKS, bells: [0, 1], state: i });
  // The dialogue: the first bell's betweens in time rounds, closing in on GOAL.
  let cur = [...v.dialogue].sort((a, b) => b - a);
  const gaps: number[] = [];
  const round: number[] = [];
  for (let r = 0; r < v.rounds; r++) {
    const s = r % cur.length;
    for (const g of [...cur.slice(s), ...cur.slice(0, s)]) {
      gaps.push(g);
      round.push(r);
    }
    cur = closer(cur, GOAL);
  }
  // The last stroke on a beat, where the two families meet.
  const total = gaps.reduce((a, b) => a + b, 0);
  gaps[gaps.length - 1] = gaps.at(-1)! + ((3 - (total % 3)) % 3);
  let t = out.at(-1)!.at;
  const firsts = gaps.map((g) => (t += g * A3));
  firsts.forEach((at, j) => {
    const final = j === firsts.length - 1;
    out.push({ at, bells: final ? [0, 1] : [0], state: v.tolls + j, final, round: round[j + 1] });
    if (final) return;
    // The second bell: 1/2, 1/4, 1/8 … of the between after the first, on its own grid.
    const next = firsts[j + 1]!;
    const phi = 0.5 / 2 ** round[j + 1]!;
    const at2 = Math.min(
      next - A5,
      Math.max(ceilTo(at + 1, A5), Math.round((at + phi * (next - at)) / A5) * A5),
    );
    out.push({ at: at2, bells: [1], state: v.tolls + j });
  });
  return out.sort((a, b) => a.at - b.at);
}

/** The bell's betweens at a toll: the smaller ones change in a Gray code, one a step. */
function sizesAt(v: V, state: number): number[] {
  const base = [...v.bell].sort((a, b) => a - b);
  const changing = Math.min(3, base.length - 1);
  const ch = numbersOf("Changes", v.changes);
  const g = (state ^ (state >> 1)) % 2 ** changing;
  return base.map((x, i) => (i < changing && (g >> i) & 1 ? x + (ch[i] ?? 0) : x));
}

/** A voice of the bell: the betweens it adds (a bit each), and which bell. */
const pitchOf = (v: V, state: number, mask: number, bell: 0 | 1) =>
  v.standpoint +
  sizesAt(v, state).reduce((sum, x, i) => ((mask >> i) & 1 ? sum + x : sum), 0) +
  (bell ? v.second + 0.5 : 0);

/** Every note of a bell at a toll, low to high. */
const bellAt = (v: V, state: number, bell: 0 | 1) =>
  Array.from({ length: 2 ** v.bell.length }, (_, m) => pitchOf(v, state, m, bell)).sort(
    (a, b) => a - b,
  );

/**
 * Gives each wind of a bell one voice (the same betweens all through), spread over the bell from
 * low to high, one that stays in the wind's range whatever the sizes.
 */
function voicesFor(v: V, bell: 0 | 1, states: number[]): Map<string, number> {
  const cands = Array.from({ length: 2 ** v.bell.length }, (_, mask) => {
    const ps = states.map((s) => pitchOf(v, s, mask, bell));
    return { mask, lo: Math.min(...ps), hi: Math.max(...ps), at: ps[0]! };
  }).sort((a, b) => a.at - b.at);
  const winds = WINDS[bell]!;
  const used = new Set<number>();
  const out = new Map<string, number>();
  winds.forEach((w, k) => {
    const [lo, hi] = RANGE[w]!;
    const target = Math.round((k * (cands.length - 1)) / Math.max(1, winds.length - 1));
    for (let d = 0; d < cands.length; d++) {
      const i = [target + d, target - d].find((j) => {
        const c = cands[j];
        return c && !used.has(j) && c.lo >= lo && c.hi <= hi;
      });
      if (i !== undefined) {
        used.add(i);
        out.set(w, cands[i]!.mask);
        return;
      }
    }
  });
  return out;
}

/** Fixed pedals drawn only from pitch classes present in every state of this bell. */
function harpSwirls(v: V, states: number[], bell: 0 | 1, cut: number): Part {
  const tuning = bell ? -0.5 : 0;
  const pc = (m: number) => ((Math.round(m - tuning) % 12) + 12) % 12;
  const fields = states.map((state) => new Set(bellAt(v, state, bell).map(pc)));
  const common = [...fields[0]!].filter((n) => fields.every((field) => field.has(n)));
  const steps = ["C", "D", "E", "F", "G", "A", "B"] as const;
  const natural = [0, 2, 4, 5, 7, 9, 11];
  let pedals: number[] | undefined;
  let best = -Infinity;
  const search = (chosen: number[]) => {
    if (chosen.length === 7) {
      const distinct = new Set(chosen.map((a, i) => (natural[i]! + a + 12) % 12)).size;
      const merit = distinct * 10 - chosen.reduce((n, a) => n + Math.abs(a), 0);
      if (merit > best) {
        best = merit;
        pedals = [...chosen];
      }
      return;
    }
    const i = chosen.length;
    for (const alter of [0, -1, 1])
      if (common.includes((natural[i]! + alter + 12) % 12)) search([...chosen, alter]);
  };
  search([]);
  if (!pedals)
    throw new Error(`Harp ${bell + 1}: these bell states have no common fixed pedal setting`);
  const setting = pedals;
  const offset = bell ? v.second + 0.5 : 0;
  const strings = Array.from({ length: 6 }, (_, o) => o + 2)
    .flatMap((octave) =>
      steps.map((step, i) => ({
        pitch: { step, alter: setting[i]! + tuning, octave },
        midi: 12 * (octave + 1) + natural[i]! + setting[i]! + tuning,
      })),
    )
    .filter((n) => n.midi >= 48 + offset && n.midi <= 84 + offset)
    .sort((a, b) => a.midi - b.midi);
  if (strings.length < 2) throw new Error("The harp glissando needs at least two strings");
  const pedalName = (i: number) => steps[i]! + ({ [-1]: "b", 0: "", 1: "#" }[setting[i]!] ?? "");
  const label = [1, 0, 6].map(pedalName).join(" ") + " | " + [2, 3, 4, 5].map(pedalName).join(" ");
  const events: Event[] = [
    {
      type: "text",
      at: 0,
      text: `Pedals: ${label}; unchanged${bell ? " (all strings tuned 1/4 tone low)" : ""}`,
      placement: "above",
    },
  ];
  // Eight beats of preparation after the section starts; the second harp enters one beat later
  // in the opposite direction. Each sweep takes two beats, except the last if the cut interrupts it.
  let at = 8 * TICKS + bell * TICKS;
  let up = bell === 0;
  let last: Pitch | undefined;
  while (at < cut) {
    const route = up ? strings : [...strings].reverse();
    const dur = Math.min(2 * TICKS, cut - at);
    events.push({
      at: time(at),
      dur: time(dur),
      pitch: route[0]!.pitch,
      staff: 1,
      gliss: true,
      glissPitches: route.map((n) => n.pitch),
    });
    last = route.at(-1)!.pitch;
    at += dur;
    up = !up;
  }
  if (last) {
    events.push({
      at: time(cut),
      dur: time(TICKS / 2),
      pitch: last,
      staff: 1,
      articulations: ["accent"],
    });
    events.push({
      type: "text",
      at: time(cut + TICKS / 2),
      text: "damp all strings",
      placement: "above",
    });
  }
  return partOf(`hp${bell + 1}`, events, [
    { at: 0, level: 7 },
    { at: time(cut - 2 * BAR), level: 7, to: "linear" },
    { at: time(cut), level: 8 },
    { at: time(cut + TICKS / 2), level: 0 },
  ]);
}

//==============================================================================
// The score

export function score(v: V): Score {
  const tolls = tollsOf(v);
  const final = tolls.find((t) => t.final)!;
  const end = final.at + v.afterglow * TICKS;
  const states = [...new Set(tolls.map((t) => t.state))];
  const of = (bell: 0 | 1) => tolls.filter((t) => t.bells.includes(bell));
  const stateAt = (t: number) => tolls.filter((x) => x.at <= t).at(-1)?.state ?? 0;
  const s = v.standpoint;
  const parts: Part[] = [];

  // The winds: each holds its voice of its bell at every stroke of that bell, struck (fff) and
  // dying away into nothing, the high voices sooner than the low ones (a big bell's ring); at most
  // 8 beats, and room to breathe before the next stroke. The last stroke is short: the cut.
  ([0, 1] as const).forEach((bell) => {
    const atom = bell ? A5 : A3;
    const rest = bell ? 2 * A5 : A3;
    const mine = of(bell);
    for (const [w, mask] of voicesFor(v, bell, states)) {
      const events: Event[] = [];
      const dynamics: DynamicPoint[] = [];
      mine.forEach((toll, k) => {
        const midi = pitchOf(v, toll.state, mask, bell);
        const next = mine[k + 1]?.at ?? end;
        const e: NoteEvent = { at: time(toll.at), dur: time(TICKS / 2), pitch: { midi } };
        e.articulations = ["accent"];
        if (BRASS.has(w)) e.technique = "sfz";
        if (toll.final) {
          events.push(e);
          dynamics.push({ at: time(toll.at), level: 8 });
          return;
        }
        const ring = (8 - 5 * clamp01((midi - 36) / 48)) * TICKS;
        // The whole bell strikes on beats: its rings are whole beats (fewer ties).
        const unit = toll.bells.length === 2 ? TICKS : atom;
        const len = floorTo(Math.min(ring, next - toll.at - rest), unit);
        if (len < atom) return;
        e.dur = time(len);
        events.push(e);
        dynamics.push(
          { at: time(toll.at), level: 8, to: "linear" },
          { at: time(toll.at + Math.min(TICKS, len / 2)), level: 6, to: "linear" },
          { at: time(toll.at + len), level: 0 },
        );
      });
      parts.push(partOf(w, events, dynamics));
    }
  });

  // Piano and celesta strike the first bell; the harps sweep its two grids on fixed pedals.
  const struck = (
    id: string,
    bell: 0 | 1,
    chord: (notes: number[]) => number[],
    text: string,
    long: boolean,
  ) => {
    const events: Event[] = [{ type: "text", at: 0, text, placement: "above" }];
    const dynamics: DynamicPoint[] = [];
    const mine = of(bell);
    mine.forEach((toll, k) => {
      const notes = chord(bellAt(v, toll.state, bell));
      if (!notes.length) return;
      const next = mine[k + 1]?.at ?? end;
      const dur = toll.final
        ? TICKS / 2
        : long
          ? Math.min(3 * TICKS, floorTo(next - toll.at, bell ? A5 : A3))
          : Math.min(TICKS - (toll.at % TICKS), next - toll.at);
      events.push({
        at: time(toll.at),
        dur: time(dur),
        pitch: notes.map((midi): Pitch => ({ midi })),
        articulations: ["accent"],
      });
      dynamics.push({ at: time(toll.at), level: 8 });
    });
    return { events, dynamics };
  };
  const within =
    (lo: number, hi: number, most: number, top = false) =>
    (notes: number[]) => {
      const inside = notes.filter((n) => n >= lo && n <= hi);
      const from = top ? inside.at(-1)! - 12 : inside[0]!;
      const hand = inside.filter((n) => (top ? n >= from : n <= from + 12));
      return top ? hand.slice(-most) : hand.slice(0, most);
    };
  {
    const low = within(s, s + 14, 3);
    const high = within(60, 96, 4, true);
    const p = struck("pno", 0, (n) => [...low(n), ...high(n)], "con Ped., l.v.", true);
    parts.push(partOf("pno", p.events, p.dynamics));
    const c = struck("cel", 0, (n) => within(60, 98, 4, true)(n), "l.v.", false);
    parts.push(partOf("cel", c.events, c.dynamics));
    parts.push(harpSwirls(v, states, 0, final.at), harpSwirls(v, states, 1, final.at));
  }

  // The low strings: the standpoint in octaves, tremolo, all through; a last stroke with the cut.
  {
    const bass = s < 28 ? s + 12 : s;
    const grounds: [string, number][] = [
      ["cb-2-2", bass],
      ["cb-2-1", bass + 12],
      ["vc-2-2", bass + 12],
      ["vc-2-1", bass + 24],
    ];
    for (const [id, midi] of grounds)
      parts.push(
        partOf(
          id,
          [
            { at: 0, dur: time(final.at), pitch: { midi }, technique: "tremolo" },
            {
              at: time(final.at),
              dur: time(TICKS / 2),
              pitch: { midi },
              articulations: ["accent", "staccato"],
            },
          ],
          [
            { at: 0, level: 7 },
            { at: time(final.at - 2 * BAR), level: 7, to: "linear" },
            { at: time(final.at), level: 8 },
          ],
        ),
      );
  }

  // The upper strings run through the first bell's notes, stepping to the next note of the bell up
  // or down, turning after runs of their lengths or at the edge of their band. When a stroke
  // changes the bell, the run goes on from the nearest note of the new one.
  for (const r of RUNNERS) {
    const events: Event[] = [];
    let dir = 1;
    let run = 0;
    let left = r.runs[0]!;
    let midi = (r.band[0] + r.band[1]) / 2;
    for (let t = 0; t < final.at; t += r.atom) {
      const field = bellAt(v, stateAt(t), 0).filter((n) => n >= r.band[0] && n <= r.band[1]);
      let i = field.reduce(
        (best, n, j) => (Math.abs(n - midi) < Math.abs(field[best]! - midi) ? j : best),
        0,
      );
      if (t > 0) {
        if (i + dir < 0 || i + dir >= field.length) dir = -dir;
        i += dir;
        if (--left === 0) {
          dir = -dir;
          left = r.runs[++run % r.runs.length]!;
        }
      }
      midi = field[i]!;
      events.push({ at: time(t), dur: time(r.atom), pitch: { midi } });
    }
    events.push({
      at: time(final.at),
      dur: time(TICKS / 2),
      pitch: { midi },
      articulations: ["accent", "staccato"],
    });
    parts.push(
      partOf(r.id, events, [
        { at: 0, level: 7 },
        { at: time(final.at - 2 * BAR), level: 7, to: "linear" },
        { at: time(final.at), level: 8 },
      ]),
    );
  }

  // Percussion. The first bell and the whole bell: the timpani strike (the standpoint's octave)
  // and roll up into the next stroke, the suspended cymbal rolls up into every stroke. The second
  // bell and the whole bell: the tam-tam, let ring, and the bass drum. The bass drum's player
  // takes up the vibraslap for the last stroke; the tam-tam rings on into the afterglow.
  {
    const first = of(0);
    const timp: Event[] = [];
    const timpLevels: DynamicPoint[] = [];
    const cym: Event[] = [
      { type: "text", at: 0, text: "soft mallets; glockenspiel mallets ready", placement: "above" },
      {
        type: "text",
        at: time(Math.max(0, final.at - 2 * BAR)),
        text: "prepare glockenspiel",
        placement: "above",
      },
    ];
    const cymLevels: DynamicPoint[] = [];
    const tmidi = Math.max(38, Math.min(55, s + 12));
    first.forEach((toll, k) => {
      const next = first[k + 1];
      const stroke = toll.final ? TICKS / 2 : TICKS;
      timp.push({
        at: time(toll.at),
        dur: time(stroke),
        pitch: { midi: tmidi },
        articulations: ["accent"],
      });
      timpLevels.push({ at: time(toll.at), level: 8 });
      if (!next) return;
      const rise = floorTo(0.6 * (next.at - toll.at), A3);
      const begin = Math.max(toll.at + stroke + A3, next.at - rise);
      if (begin < next.at) {
        timp.push({
          at: time(begin),
          dur: time(next.at - begin),
          pitch: { midi: tmidi },
          technique: "roll",
        });
        timpLevels.push(
          { at: time(begin), level: 0, to: "linear" },
          { at: time(next.at), level: next.final ? 8 : 7 },
        );
        cym.push({ at: time(begin), dur: time(next.at - begin), technique: "roll" });
        cymLevels.push(
          { at: time(begin), level: 0, to: "linear" },
          { at: time(next.at), level: next.final ? 8 : 7 },
        );
      }
    });
    parts.push(partOf("timp", timp, timpLevels), partOf("scym", cym, cymLevels));

    const second = of(1);
    const tam: Event[] = [
      { type: "text", at: 0, text: "l.v.; vibraphone mallets ready", placement: "above" },
      {
        type: "text",
        at: time(Math.max(0, final.at - 2 * BAR)),
        text: "prepare vibraphone",
        placement: "above",
      },
    ];
    const tamLevels: DynamicPoint[] = [];
    const bd: Event[] = [];
    const bdLevels: DynamicPoint[] = [];
    second.forEach((toll, k) => {
      const next = second[k + 1]?.at ?? end;
      tam.push({ at: time(toll.at), dur: time(toll.final ? end - toll.at : next - toll.at) });
      tamLevels.push({ at: time(toll.at), level: toll.bells.length === 2 ? 8 : 7 });
      if (toll.final || toll.at > final.at - 4 * TICKS) return;
      bd.push({
        at: time(toll.at),
        dur: time(Math.min(TICKS, next - toll.at)),
        articulations: ["accent"],
      });
      bdLevels.push({ at: time(toll.at), level: 8 });
    });
    parts.push(partOf("tam", tam, tamLevels), partOf("bd", bd, bdLevels));
    parts.push(
      partOf(
        "vslap",
        [{ at: time(final.at), dur: time(TICKS), articulations: ["accent"] }],
        [{ at: time(final.at), level: 8 }],
      ),
    );
  }

  // The afterglow: after a beat of the cut, the winds' figures fall through their bell's notes
  // (each from its own last note, on its own family, slowing down), and the celesta,
  // the glockenspiel and the vibraphone let a few notes of the bell fall, softly.
  {
    const glowStart = final.at + TICKS;
    const betweens = [2, 2, 3, 3, 4, 5, 6];
    FALLING.forEach(([w, bell, atom], k) => {
      const part = parts.find((p) => p.id === w);
      const mask = voicesFor(v, bell, states).get(w);
      if (!part || mask === undefined) return;
      const [lo, hi] = RANGE[w]!;
      const field = bellAt(v, final.state, bell).filter((n) => n >= lo && n <= hi);
      let i = field.indexOf(pitchOf(v, final.state, mask, bell));
      let t = ceilTo(glowStart + k * 20, atom);
      const first = t;
      const figure: NoteEvent[] = [];
      for (let n = 0; n < betweens.length && i >= 0 && t < end - atom; n++, i--) {
        const d = Math.min(betweens[n]! * atom, floorTo(end - t, atom));
        figure.push({ at: time(t), dur: time(d), pitch: { midi: field[i]! }, slur: true });
        t += d;
      }
      if (!figure.length) return;
      delete figure.at(-1)!.slur;
      part.events.push(...figure);
      part.dynamics!.push({ at: time(first), level: 3, to: "linear" }, { at: time(t), level: 0 });
    });
    const sprinkle = (
      id: string,
      bell: 0 | 1,
      lo: number,
      hi: number,
      beats: number[],
      text?: string,
    ) => {
      const notes = bellAt(v, final.state, bell)
        .filter((n) => n >= lo && n <= hi)
        .reverse();
      const events: Event[] = text
        ? [{ type: "text", at: time(final.at + beats[0]! * TICKS), text, placement: "above" }]
        : [];
      const dynamics: DynamicPoint[] = [];
      beats.forEach((b, n) => {
        const at = final.at + b * TICKS;
        const midi = notes[n * 2];
        if (midi === undefined || at >= end) return;
        events.push({
          at: time(at),
          dur: time(Math.min(TICKS - (at % TICKS) || TICKS, end - at)),
          pitch: { midi },
        });
        dynamics.push({ at: time(at), level: 3 - n * 0.5 });
      });
      return { events, dynamics };
    };
    const add = (id: string, x: { events: Event[]; dynamics: DynamicPoint[] }) => {
      const part = parts.find((p) => p.id === id);
      if (part) {
        part.events.push(...x.events);
        part.dynamics!.push(...x.dynamics);
      } else parts.push(partOf(id, x.events, x.dynamics));
    };
    add("cel", sprinkle("cel", 0, 72, 98, [1.5, 4.5]));
    add("glk", sprinkle("glk", 0, 79, 100, [2.5, 4, 6.5], "l.v."));
    add("vib", sprinkle("vib", 0, 53, 89, [3, 5, 7.5], "motor off, l.v."));
  }

  const rank = (id: string) => ensemble.findIndex((pl) => pl.id === id);
  parts.sort((a, b) => rank(a.id) - rank(b.id));
  const bar = (t: number) => Math.floor(t / BAR) + 1;
  // Letters: the start, the split, each time round of the dialogue after the first, the cut.
  const rounds = Array.from(
    { length: v.rounds },
    (_, r) => tolls.find((t) => t.round === r && !t.final)?.at,
  ).filter((t): t is number => t !== undefined);
  const letters = [0, ...rounds, final.at];
  return {
    title: "antara · the climax",
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

// antara, series: the interval series sings. Card: README.md.
//
// ♩ = 90: the rhythm's triplet 8ths are this section's 8ths, two of them its beat. The horns sing
// phrases drawn from a set of betweens: a phrase starts on the anchor and adds the set's betweens
// in some order, so, whatever the order, it ends on the anchor plus the set's sum. Other winds sing
// the same phrase in other orders, each counting on its own family, and all of them arrive on that
// note together (palette a/pitch-same-sum-meets): the lines part and meet again, and between the
// meetings their notes make chords no one chose. At each meeting the brass hold the set as a chord
// (every between of the set, largest first, stacked from two octaves below the meeting note), the
// harps and the keyboards strike it, the timpani and the glockenspiel mark it.
//
// The set grows one move at a time from the opening's quarter tone to running's set: {0.5 2},
// {0.5 2 5}, {−1.5 0.5 2 5}, {−1.5 2 5}, and the anchor steps down a whole tone at a time from the
// opening's F♯ to running's D (F♯ E D D). The phrase's goal (the sum) is then a whole tone and a
// quarter, a fifth and a quarter, a tritone, a fourth and a quarter: a sense of key
// comes and goes as the set changes. More voices join with each set, and it grows louder.
// Underneath, the marimba and the pizzicato cellos and basses keep the rhythm's last beat on the
// anchor, thinly, and it gains betweens (2 3 3 16ths). The piano's running figure begins under the
// last meeting (ff), survives its cut, and leads into running at the same note speed.

import { fileURLToPath } from "node:url";

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
import { number, pitch, text, resolveValues, type Values } from "../../../../src/sketch/knobs.ts";
import { atomOf, TICKS, time } from "../../between.ts";
import { readStored } from "../../../../src/sketch/run.ts";
import { knobs as runningKnobs, pianoLeadIn } from "../running-orchestra/sketch.ts";

const BAR = 4 * TICKS;
const A2 = atomOf(2);
const A3 = atomOf(3);
const A5 = atomOf(5);

/** A line of the phrases: who sings it, on which family, how far from the horns, from which set on. */
interface Voice {
  ids: string[];
  atom: number;
  octave: number;
  from: number;
}
const VOICES: Voice[] = [
  { ids: ["hn1", "hn3"], atom: A2, octave: 0, from: 0 },
  { ids: ["ob1"], atom: A3, octave: 0, from: 0 },
  { ids: ["cl1"], atom: A5, octave: 0, from: 1 },
  { ids: ["bn1"], atom: A3, octave: -12, from: 1 },
  { ids: ["fl1"], atom: A5, octave: 12, from: 2 },
  { ids: ["eh"], atom: A2, octave: 0, from: 2 },
  { ids: ["hn2", "hn4"], atom: A3, octave: 0, from: 2 },
  { ids: ["fl2", "ob2"], atom: A3, octave: 12, from: 3 },
  { ids: ["cl2"], atom: A5, octave: 0, from: 3 },
  { ids: ["bcl", "bn2"], atom: A2, octave: -12, from: 3 },
];
/** The brass that hold the chord at a meeting, low to high, and from which set on. */
const CHORALE: [string, number][] = [
  ["tba", 1],
  ["btb", 1],
  ["tb2", 1],
  ["tb1", 1],
  ["tp3", 2],
  ["tp2", 2],
  ["tp1", 2],
];

export const knobs = {
  pianoOverlap: number({
    group: "Transition",
    label: "Piano overlap",
    value: 0.5,
    min: 0,
    max: 1,
    step: 0.25,
    unit: "beats",
    help: "Start the running piano figure this many beats before the final chord releases",
  }),
  sets: text({
    group: "Sets",
    label: "Sets",
    help: "The sets the phrases draw from, one after another, separated by |. Each should be one move from the last",
    value: "0.5 2 | 0.5 2 5 | -1.5 0.5 2 5 | -1.5 2 5",
  }),
  anchor: pitch({
    group: "Sets",
    label: "First anchor",
    help: "Where the first set's phrases start (the opening's F♯); each next set starts a whole tone nearer the last anchor",
    value: "F#4",
    min: "C4",
    max: "C5",
    step: 1,
  }),
  last: pitch({
    group: "Sets",
    label: "Last anchor",
    help: "Where the anchor stops (running's D, an octave up). The cellos run from it an octave down at the end",
    value: "D4",
    min: "C4",
    max: "C5",
    step: 1,
  }),
  phrases: number({
    group: "Time",
    label: "Phrases",
    help: "Phrases on each set",
    value: 4,
    min: 2,
    max: 8,
    step: 1,
  }),
  lengths: text({
    group: "Time",
    label: "Lengths",
    help: "Beats of a phrase on each set (the last two hold the meeting), then the beats of rest after it, as length/rest",
    value: "6/2 8/2 8/1 6/1",
  }),
  under: text({
    group: "Time",
    label: "Underneath",
    help: "The marimba's and the pizzicato's time set on each set, in 16ths, separated by |: first the beat the rhythm hands over (4), then more betweens",
    value: "4 | 2 3 3",
  }),
  tempo: number({
    group: "Sound",
    label: "Tempo",
    help: "Quarter notes per minute: two of the rhythm's triplet 8ths at 60",
    value: 90,
    min: 72,
    max: 108,
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

const numbers = (s: string) => s.replaceAll("−", "-").split(/\s+/).filter(Boolean).map(Number);

/** Strings (C D … B) that can sound each pitch class on a pedal harp. */
const STRINGS = [
  [0, 6],
  [0, 1],
  [1],
  [1, 2],
  [2, 3],
  [3, 2],
  [3, 4],
  [4],
  [4, 5],
  [5],
  [5, 6],
  [6, 0],
];
function pedalsFit(pcs: number[]): boolean {
  const distinct = [...new Set(pcs)];
  const taken = new Set<number>();
  const go = (i: number): boolean => {
    if (i === distinct.length) return true;
    for (const s of STRINGS[distinct[i]!]!) {
      if (taken.has(s)) continue;
      taken.add(s);
      if (go(i + 1)) return true;
      taken.delete(s);
    }
    return false;
  };
  return go(0);
}
function harpChord(notes: number[], tuning: number): number[] {
  const out: number[] = [];
  for (const n of notes) {
    if (out.length === 6) break;
    const pcs = [...out, n].map((x) => ((Math.round(x - tuning) % 12) + 12) % 12);
    if (pedalsFit(pcs)) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

interface Phrase {
  at: number;
  /** Where the lines meet (the last two beats). */
  meet: number;
  end: number;
  rest: number;
  set: number[];
  anchor: number;
  stage: number;
  index: number;
}

export function score(v: V): Score {
  const sets = v.sets.split("|").map((s) => numbers(s));
  const lengths = v.lengths.split(/\s+/).map((x) => x.split("/").map(Number) as [number, number]);
  const levelOf = [5, 5.5, 6, 7];
  const toward = (a: number, b: number, d: number) =>
    a + Math.sign(b - a) * Math.min(Math.abs(b - a), d);
  // The phrases, set after set.
  const phrases: Phrase[] = [];
  let t = 0;
  sets.forEach((set, stage) => {
    const [len, rest] = lengths[Math.min(stage, lengths.length - 1)]!;
    for (let i = 0; i < v.phrases; i++) {
      phrases.push({
        at: t,
        meet: t + (len - 2) * TICKS,
        end: t + len * TICKS,
        rest: rest * TICKS,
        set,
        anchor: toward(v.anchor, v.last, 2 * stage),
        stage,
        index: phrases.length,
      });
      t += (len + rest) * TICKS;
    }
  });
  const last = phrases.at(-1)!;
  const cut = last.meet + TICKS;
  const end = Math.ceil((cut + 2 * BAR) / BAR) * BAR;

  const notes = new Map<string, Event[]>();
  const levels = new Map<string, DynamicPoint[]>();
  const add = (id: string, e: NoteEvent, curve: DynamicPoint[]) => {
    notes.set(id, [...(notes.get(id) ?? []), e]);
    levels.set(id, [...(levels.get(id) ?? []), ...curve]);
  };

  // The lines: every voice reads the phrase's set in its own order from the anchor, its steps
  // spaced on its own family (in proportions that differ from voice to voice), and all arrive on
  // the anchor plus the sum at the meeting, held to the end of the phrase (the last is cut short).
  const WEIGHTS = [3, 2, 4, 1, 5, 2];
  VOICES.forEach((voice, vi) => {
    for (const ph of phrases) {
      if (ph.stage < voice.from) continue;
      const n = ph.set.length;
      const s = (vi + ph.index) % n;
      let order = [...ph.set.slice(s), ...ph.set.slice(0, s)];
      if (vi % 2) order = order.reverse();
      const weights = Array.from({ length: n }, (_, k) => WEIGHTS[(vi + k) % WEIGHTS.length]!);
      const total = weights.reduce((a, b) => a + b, 0);
      let at = ph.at;
      let midi = ph.anchor + voice.octave;
      let sum = 0;
      const level = levelOf[ph.stage]!;
      for (let k = 0; k <= n; k++) {
        const next =
          k === n
            ? ph.meet
            : k === n - 1
              ? ph.meet
              : ph.at +
                Math.round(
                  ((ph.meet - ph.at) * weights.slice(0, k + 1).reduce((a, b) => a + b, 0)) /
                    total /
                    voice.atom,
                ) *
                  voice.atom;
        const stop = k === n ? (ph === last ? cut : ph.end) : Math.max(next, at + voice.atom);
        for (const id of voice.ids)
          add(
            id,
            {
              at: time(at),
              dur: time(stop - at),
              pitch: { midi },
              ...(k === n ? { articulations: ["accent"] as "accent"[] } : {}),
            },
            k === 0
              ? [{ at: time(at), level: level - 1, to: "linear" }]
              : k === n
                ? [
                    { at: time(at), level: level, to: "linear" },
                    { at: time(stop), level: ph === last ? level : level - 1.5 },
                  ]
                : [],
          );
        if (k === n) break;
        sum += order[k]!;
        at = Math.max(next, at + voice.atom);
        midi = ph.anchor + voice.octave + sum;
      }
    }
  });

  // At each meeting (from the second set on): the brass hold the set as a chord, its betweens
  // stacked (largest first, again and again) from two octaves below the meeting note, into the next
  // phrase; the harps and the keyboards strike it; the timpani and the glockenspiel mark it.
  for (const ph of phrases) {
    if (ph.stage < 1) continue;
    const meetNote = ph.anchor + ph.set.reduce((a, b) => a + b, 0);
    const steps = [...new Set(ph.set.map(Math.abs))].sort((a, b) => b - a);
    const chord: number[] = [meetNote - 24];
    for (let k = 0; chord.length < CHORALE.length; k++)
      chord.push(chord.at(-1)! + steps[k % steps.length]!);
    const hold =
      ph === last ? cut - ph.meet : Math.min(6 * TICKS, ph.end - ph.meet + ph.rest + TICKS);
    const level = levelOf[ph.stage]!;
    CHORALE.forEach(([id, from], k) => {
      if (ph.stage < from) return;
      add(
        id,
        {
          at: time(ph.meet),
          dur: time(hold),
          pitch: { midi: chord[k]! },
          articulations: ["accent"],
        },
        [
          { at: time(ph.meet), level: level, to: "linear" },
          { at: time(ph.meet + hold), level: ph === last ? level : level - 1.5 },
        ],
      );
    });
    const semis = chord.filter((m) => Number.isInteger(m));
    const quarters = chord.filter((m) => !Number.isInteger(m));
    const strike = (id: string, pitches: number[]) => {
      if (!pitches.length) return;
      add(
        id,
        {
          at: time(ph.meet),
          dur: time(TICKS),
          pitch: pitches.map((midi): Pitch => ({ midi })),
          articulations: ["accent"],
        },
        [{ at: time(ph.meet), level: level }],
      );
    };
    strike(
      "hp1",
      harpChord(
        semis.map((m) => m + 12),
        0,
      ),
    );
    strike(
      "hp2",
      harpChord(
        quarters.map((m) => m + 12),
        -0.5,
      ),
    );
    if (ph !== last) strike("pno", semis);
    // The celesta: the top three semitone notes two octaves up; the glockenspiel: the top one in its range.
    strike(
      "cel",
      semis.slice(-3).map((m) => m + 24),
    );
    const top = semis.at(-1)!;
    strike("glk", [top + 24 >= 79 ? top + 24 : top + 36]);
    const timp = chord[0]! >= 38 ? chord[0]! : chord[0]! + 12;
    strike("timp", [timp <= 55 ? timp : timp - 12]);
  }

  // Underneath: the marimba and the pizzicato cellos and basses keep the rhythm's last beat on the
  // anchor, thinly, and it gains betweens (its time set on each set, in 16ths, round and round),
  // until the last phrase. The pizzicato takes every other stroke.
  {
    const under = v.under.split("|").map((x) => numbers(x));
    let k = 0;
    for (let at = 0; at < last.at; k++) {
      const ph = [...phrases].reverse().find((p) => p.at <= at)!;
      const set = under[Math.min(ph.stage, under.length - 1)]!;
      const level = levelOf[ph.stage]! - 2;
      add("mar", { at: time(at), dur: time(A2), pitch: { midi: ph.anchor } }, [
        { at: time(at), level },
      ]);
      if (k % 2 === 0)
        for (const [id, o] of [
          ["vct", -12],
          ["cbt", -24],
        ] as const)
          add(
            id,
            { at: time(at), dur: time(A2), pitch: { midi: ph.anchor + o }, technique: "pizz" },
            [{ at: time(at), level }],
          );
      at += set[k % set.length]! * A2;
    }
  }

  // Piano takes the foreground under the other instruments' final chord; it does not double
  // that chord. Its phrase and lead level come from running's current settings.
  {
    const dir = fileURLToPath(new URL("../running-orchestra", import.meta.url));
    const running = resolveValues(runningKnobs, readStored(dir).values) as Values<
      typeof runningKnobs
    >;
    const begin = cut - Math.round(v.pianoOverlap * TICKS);
    const steps = Math.round((end - begin) / A2);
    const level = running.pianoLeadLevel;
    for (const n of pianoLeadIn(running, steps)) {
      const at = begin + n.step * A2;
      add(
        "pno",
        {
          at: time(at),
          dur: time(A2),
          pitch: { midi: n.midi },
          ...(n.head ? { articulations: ["accent"] as "accent"[] } : {}),
        },
        [{ at: time(at), level }],
      );
    }
  }

  const parts: Part[] = [...notes].map(([id, events]) =>
    partOf(
      id,
      events.sort((a, b) => num(a.at) - num(b.at)),
      levels.get(id)!.sort((a, b) => num(a.at) - num(b.at)),
    ),
  );
  parts
    .find((p) => p.id === "pno")
    ?.events.push({
      type: "text",
      at: time(cut - Math.round(v.pianoOverlap * TICKS)),
      text: "in rilievo",
      placement: "above",
    });
  const rank = (id: string) => ensemble.findIndex((pl) => pl.id === id);
  parts.sort((a, b) => rank(a.id) - rank(b.id));
  const bar = (x: number) => Math.floor(x / BAR) + 1;
  const letters = [
    ...sets.map((_, s) => phrases.find((p) => p.stage === s)!.at),
    cut - Math.round(v.pianoOverlap * TICKS),
  ];
  return {
    title: "antara · series",
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

const num = (t: NoteEvent["at"]) => (typeof t === "number" ? t : t[0] / t[1]);

/** Where a section made of this sketch may stop or start: held notes while they hold, strokes at their onsets. */
export function seams(score: Score): Record<string, Seam[]> {
  const out: Record<string, Seam[]> = {};
  for (const p of score.parts) {
    const ns = p.events.filter((e): e is NoteEvent => e.type !== "text");
    out[p.id] = ns.map((n): Seam =>
      num(n.dur) >= 4 ? [num(n.at), num(n.at) + num(n.dur)] : num(n.at),
    );
  }
  return out;
}

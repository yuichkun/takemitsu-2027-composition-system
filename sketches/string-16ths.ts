// Sketch: strings only, fast 16ths with a bow change on every note, short and biting.
// The four sections hand the figure to each other with a little overlap, pile up like the
// stretto of a fugue, and run up together to the end. Card: string-16ths.md.
//
//   vp node sketches/string-16ths.ts   → string-16ths-stacc.json, string-16ths-spicc.json
//
// Every value marked 仮 is a stand-in chosen by Claude, not by 余湖さん.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Articulation, NoteEvent, Part, Score } from "../src/score/types.ts";

const here = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------------------------
// Values

const bpm = 144; // 仮
const bar = 16; // sixteenths in a 4/4 bar

/** Sections, in the order they enter, and the pitch each one's figure stands on (MIDI). 仮 */
const voices = [
  { id: "vc", instrument: "cellos", base: 50 }, // D3
  { id: "va", instrument: "violas", base: 57 }, // A3
  { id: "vn2", instrument: "violins-2", base: 62 }, // D4
  { id: "vn1", instrument: "violins-1", base: 69 }, // A4
];

/** Octatonic scale (semitone, tone, …) from the base. The figures and the final run use it. 仮 */
const scale = [0, 1, 3, 4, 6, 7, 9, 10];
const step = (k: number) => scale[((k % 8) + 8) % 8]! + 12 * Math.floor(k / 8);

/**
 * The figures, one bar each, as semitones above the base. 仮
 * wedge: the base on every other note, the scale climbing between (a string crossing).
 * hammer: repeated notes with a neighbour.
 */
const figures = {
  wedge: [0, 1, 0, 3, 0, 4, 0, 6, 0, 7, 0, 9, 0, 10, 0, 12],
  hammer: [0, 0, 1, 0, 0, 0, 1, 0, 3, 3, 1, 0, 4, 3, 1, 0],
};

interface Entry {
  voice: number;
  /** Start and length in sixteenths. */
  at: number;
  length: number;
  figure: keyof typeof figures;
  /** Semitones added to the voice's base. */
  lift: number;
}

/** When each section plays. 仮 */
function plan(): Entry[] {
  const out: Entry[] = [];
  // Bars 1–8: one entry a bar, 1½ bars long, so neighbours overlap by half a bar.
  for (let i = 0; i < 8; i++)
    out.push({
      voice: i % 4,
      at: i * bar,
      length: 24,
      figure: i < 4 ? "wedge" : "hammer",
      lift: 0,
    });
  // Bars 9–14: one entry every half bar, still 1½ bars long: three sections at a time, a
  // minor third higher.
  for (let j = 0; j < 12; j++)
    out.push({
      voice: j % 4,
      at: 8 * bar + j * 8,
      length: 24,
      figure: j % 2 ? "hammer" : "wedge",
      lift: 3,
    });
  // Bars 15–18: all four, entering an eighth apart, a tritone higher, until the run.
  for (let v = 0; v < 4; v++)
    out.push({ voice: v, at: 14 * bar + 2 * v, length: 4 * bar - 2 * v, figure: "wedge", lift: 6 });
  return out;
}

/** Dynamic curve shared by every section: 0 niente … 8 fff. 仮 */
const dynamics = [
  { at: 0, level: 3, to: "linear" as const }, // p
  { at: 8 * 4, level: 4.5, to: "linear" as const },
  { at: 14 * 4, level: 6, to: "linear" as const },
  { at: 18 * 4, level: 7, to: "linear" as const },
  { at: 19 * 4, level: 8 }, // fff at the last note
];

// ---------------------------------------------------------------------------------------------
// Making the score

function part(v: number, variant: "stacc" | "spicc"): Part {
  const voice = voices[v]!;
  const entries = plan()
    .filter((e) => e.voice === v)
    .sort((a, b) => a.at - b.at);
  const technique = variant === "spicc" ? "spiccato" : undefined;
  const events: NoteEvent[] = [];
  const note = (at: number, midi: number, articulations: Articulation[]): void => {
    events.push({ at: at / 4, dur: 0.25, pitch: { midi }, articulations, technique });
  };

  entries.forEach((e, k) => {
    // A later entry of the same section cuts the one before it.
    const end = Math.min(e.at + e.length, entries[k + 1]?.at ?? Infinity, 18 * bar);
    const figure = figures[e.figure];
    for (let s = e.at; s < end; s++) {
      const first = s === e.at;
      note(
        s,
        voice.base + e.lift + figure[(s - e.at) % 16]!,
        first ? ["staccato", "accent"] : ["staccato"],
      );
    }
  });

  // Bar 19: every section runs up two octaves of the scale from its base, accent on each beat.
  for (let s = 0; s < bar; s++)
    note(18 * bar + s, voice.base + step(s), s % 4 === 0 ? ["staccato", "accent"] : ["staccato"]);
  // Bar 20: the top, short and accented.
  events.push({
    at: 19 * 4,
    dur: 0.5,
    pitch: { midi: voice.base + 24 },
    articulations: ["staccato", "accent"],
  });

  return { id: voice.id, instrument: voice.instrument, dynamics, events };
}

for (const variant of ["stacc", "spicc"] as const) {
  const score: Score = {
    title: `弦の16分（${variant === "stacc" ? "staccato" : "spiccato"}）`,
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm }],
    measures: 20,
    rehearsal: [
      { measure: 1, label: "A" },
      { measure: 9, label: "B" },
      { measure: 15, label: "C" },
      { measure: 19, label: "D" },
    ],
    parts: [3, 2, 1, 0].map((v) => part(v, variant)), // score order: vn1, vn2, va, vc
  };
  writeFileSync(join(here, `string-16ths-${variant}.json`), JSON.stringify(score, null, 1) + "\n");
}

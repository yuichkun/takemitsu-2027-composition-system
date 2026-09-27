// Test: a meter that changes every bar (2/16, 3/16, 5/16, 7/8 …), with accented stabs on the
// groups, in the manner of Le Sacre. Can it be written, beamed and played?
// The music is only there to test; nothing here is a proposal for the piece.

import type { Articulation, NoteEvent, Part, Score } from "../../../src/score/types.ts";
import { number, text, toggle, type Values } from "../../../src/sketch/knobs.ts";
import { defaultGroups } from "../../../src/score/timeline.ts";

export const knobs = {
  meters: text({
    group: "Meter",
    label: "Meters",
    help: "One meter per bar, in order, repeated to fill the length. A group split can follow in brackets: 7/8(3+2+2)",
    value: "2/16 3/16 2/16 5/16(3+2) 2/8 3/16 3/16 5/16 2/16 7/8(2+2+3) 3/16 2/16",
    hint: "2/16 3/16 5/16(3+2) 7/8(2+2+3)",
  }),
  bars: number({
    group: "Meter",
    label: "Length",
    help: "How many bars",
    value: 24,
    min: 4,
    max: 96,
    step: 1,
    unit: "bars",
  }),
  tempo: number({
    group: "Meter",
    label: "Tempo",
    help: "Eighth notes per minute (the pulse is the eighth)",
    value: 252,
    min: 120,
    max: 400,
    step: 4,
    unit: "♪/min",
  }),
  chord: text({
    group: "Sound",
    label: "Chord",
    help: "The stabbed chord, low to high, shared out among the strings",
    value: "D2 A2 E3 F3 C4 E4 A4 B4",
  }),
  everySixteenth: toggle({
    group: "Sound",
    label: "Every 16th",
    help: "On: the strings play every 16th, accenting each group's start. Off: they play only the group starts",
    value: true,
  }),
  drums: toggle({
    group: "Sound",
    label: "Drums on groups",
    help: "Timpani and bass drum on each group's first note",
    value: true,
  }),
};

/** "5/16(3+2)" → { beats, beatType, groups }. */
function meterOf(word: string): { beats: number; beatType: number; groups?: number[] } {
  const m = word.match(/^(\d+)\/(\d+)(?:\(([\d+]+)\))?$/);
  if (!m) throw new Error(`Meters: cannot read "${word}" (e.g. 5/16 or 7/8(2+2+3))`);
  const groups = m[3]?.split("+").map(Number);
  return { beats: Number(m[1]), beatType: Number(m[2]), groups };
}

export function score(v: Values<typeof knobs>): Score {
  const cycle = v.meters.trim().split(/\s+/).filter(Boolean).map(meterOf);
  if (cycle.length === 0) throw new Error("Meters: give at least one");
  const chord = v.chord
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => ({ name: p }));
  const sections = [
    { id: "cb", instrument: "basses", take: [0, 1] },
    { id: "vc", instrument: "cellos", take: [1, 2] },
    { id: "va", instrument: "violas", take: [3, 4] },
    { id: "vn2", instrument: "violins-2", take: [5, 6] },
    { id: "vn1", instrument: "violins-1", take: [6, 7] },
  ];
  const meter: Score["meter"] = [];
  const strings = new Map<string, NoteEvent[]>(sections.map((s) => [s.id, []]));
  const timp: NoteEvent[] = [];
  const bd: NoteEvent[] = [];
  let at = 0;
  for (let bar = 0; bar < v.bars; bar++) {
    const m = cycle[bar % cycle.length]!;
    meter.push({ measure: bar + 1, ...m });
    const unit = 4 / m.beatType; // quarters per beat unit
    const groups = m.groups ?? defaultGroups(m.beats, m.beatType);
    let g0 = at;
    for (const g of groups) {
      // Within a group: 16ths, the first accented.
      const len = g * unit;
      for (let t = 0; t < len - 1e-9; t += 0.25) {
        const first = t === 0;
        if (!first && !v.everySixteenth) continue;
        const articulations: Articulation[] = first ? ["accent", "staccato"] : ["staccato"];
        for (const s of sections) {
          const pitches = s.take.map((i) => chord[Math.min(i, chord.length - 1)]!.name);
          strings
            .get(s.id)!
            .push({ at: g0 + t, dur: 0.25, pitch: [...new Set(pitches)], articulations });
        }
      }
      if (v.drums) {
        timp.push({ at: g0, dur: 0.25, pitch: "D2", articulations: ["accent"] });
        bd.push({ at: g0, dur: 0.25, articulations: ["accent"] });
      }
      g0 += len;
    }
    at += (m.beats * 4) / m.beatType;
  }
  // Only the bars where the meter changes need saying.
  const changes = meter.filter(
    (m, i) =>
      i === 0 ||
      m.beats !== meter[i - 1]!.beats ||
      m.beatType !== meter[i - 1]!.beatType ||
      JSON.stringify(m.groups) !== JSON.stringify(meter[i - 1]!.groups),
  );
  const parts: Part[] = [
    ...(v.drums
      ? [
          { id: "timp", instrument: "timpani", events: timp, dynamics: [{ at: 0, level: 6 }] },
          { id: "bd", instrument: "bass-drum", events: bd, dynamics: [{ at: 0, level: 6 }] },
        ]
      : []),
    ...[...sections].reverse().map((s) => ({
      id: s.id,
      instrument: s.instrument,
      events: strings.get(s.id)!,
      dynamics: [{ at: 0, level: 6 }],
    })),
  ];
  return {
    title: "Test: changing meters",
    meter: changes,
    tempo: [{ at: 0, bpm: v.tempo, beat: 0.5 }],
    measures: v.bars,
    parts,
  };
}

// Test: quarter tones used throughout. Three passages in a row:
// A: unisons a quarter tone apart (beating), B: a line on a quarter-tone scale, C: quarter-tone
// clusters that swell. Can they be written (quarter-tone accidentals) and heard (BBC SO retuned)?
// The music is only there to test; nothing here is a proposal for the piece.

import type { NoteEvent, Part, Score } from "../../../src/score/types.ts";
import { number, pitch, pitchSet, type Values } from "../../../src/sketch/knobs.ts";

export const knobs = {
  unison: pitch({
    group: "A: beating unisons",
    label: "Pitch",
    help: "The pitch the strings hold, half of them a quarter tone above",
    value: "A4",
    min: "C3",
    max: "C6",
    step: 0.5,
  }),
  scale: pitchSet({
    group: "B: quarter-tone line",
    label: "Scale",
    help: "The pitches the line moves through within an octave (24 steps of a quarter tone)",
    value: [0, 1.5, 3.5, 5, 7, 8.5, 10.5],
    divisions: 24,
  }),
  lineFrom: pitch({
    group: "B: quarter-tone line",
    label: "From",
    help: "Where the line starts",
    value: "D4",
    min: "C3",
    max: "C6",
    step: 0.5,
  }),
  centre: pitch({
    group: "C: clusters",
    label: "Centre",
    help: "The middle of the cluster",
    value: "E4",
    min: "C3",
    max: "C6",
    step: 0.5,
  }),
  width: number({
    group: "C: clusters",
    label: "Width",
    help: "How many quarter tones the cluster spans",
    value: 6,
    min: 2,
    max: 16,
    step: 1,
    unit: "¼ tones",
  }),
  tempo: number({
    group: "Time",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 60,
    min: 30,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

export function score(v: Values<typeof knobs>): Score {
  const vn1: NoteEvent[] = [];
  const vn2: NoteEvent[] = [];
  const va: NoteEvent[] = [];
  const vc: NoteEvent[] = [];
  const fl: NoteEvent[] = [];
  const cl: NoteEvent[] = [];
  // A (bars 1–4): one section holds the pitch, the other a quarter tone above; then the lower
  // strings the same an octave down.
  vn1.push({ at: 0, dur: 8, pitch: { midi: v.unison } });
  vn2.push({ at: 0, dur: 8, pitch: { midi: v.unison + 0.5 } });
  va.push({ at: 8, dur: 8, pitch: { midi: v.unison - 12 } });
  vc.push({ at: 8, dur: 8, pitch: { midi: v.unison - 11.5 } });
  // B (bars 5–8): the line climbs the scale for an octave and comes back, flute and clarinet
  // a beat apart (a canon at the unison).
  const steps = [...new Set(v.scale.map((p) => Math.round((((p % 12) + 12) % 12) * 2) / 2))].sort(
    (a, b) => a - b,
  );
  const upDown = [...steps, 12, ...[...steps].reverse()];
  upDown.forEach((s, i) => {
    const at = 16 + i * 0.5;
    fl.push({ at, dur: 0.5, pitch: { midi: v.lineFrom + 12 + s }, slur: i < upDown.length - 1 });
    cl.push({ at: at + 1, dur: 0.5, pitch: { midi: v.lineFrom + s }, slur: i < upDown.length - 1 });
  });
  // C (bars 9–12): a cluster of quarter tones, spread over the four string sections, swelling.
  const cluster = Array.from({ length: v.width + 1 }, (_, i) => v.centre - v.width / 4 + i / 2);
  const share = (k: number) => cluster.filter((_, i) => i % 4 === k).map((midi) => ({ midi }));
  const cAt = 32;
  for (const [k, list] of [vn1, vn2, va, vc].entries()) {
    const pitches = share(k);
    if (pitches.length) list.push({ at: cAt, dur: 16, pitch: pitches });
  }
  const swell = [
    { at: 0, level: 3 },
    { at: cAt, level: 1, to: "linear" as const },
    { at: cAt + 10, level: 6, to: "linear" as const },
    { at: cAt + 16, level: 0 },
  ];
  const parts: Part[] = [
    { id: "fl", instrument: "flute", events: fl, dynamics: [{ at: 0, level: 4 }] },
    { id: "cl", instrument: "clarinet", events: cl, dynamics: [{ at: 0, level: 4 }] },
    { id: "vn1", instrument: "violins-1", events: vn1, dynamics: swell },
    { id: "vn2", instrument: "violins-2", events: vn2, dynamics: swell },
    { id: "va", instrument: "violas", events: va, dynamics: swell },
    { id: "vc", instrument: "cellos", events: vc, dynamics: swell },
  ];
  return {
    title: "Test: quarter tones",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: 12,
    rehearsal: [
      { measure: 1, label: "A" },
      { measure: 5, label: "B" },
      { measure: 9, label: "C" },
    ],
    parts,
  };
}

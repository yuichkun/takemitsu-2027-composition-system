// Percussion: drums in procession. A slow tread (bass drum, tenor drum), a leading voice that
// changes over time (timpani, military drum, snare, tenor drum), and snare-roll crescendos into
// timpani strokes at the ends of phrases.
// A sketch of BBC SO's drums, not a proposal for the piece.

import type { NoteEvent, Part, Score } from "../../../src/score/types.ts";
import { lanes, laneAt, number, pitch, type Values } from "../../../src/sketch/knobs.ts";

const bars = 16;

export const knobs = {
  leader: lanes({
    group: "Leading voice",
    label: "Who leads",
    help: "Which drum plays the running figure, over time",
    value: [
      [0, "timpani"],
      [4, "military"],
      [8, "snare"],
      [12, "tenor"],
    ],
    options: ["timpani", "military", "snare", "tenor", "none"],
    length: bars,
    unit: "bars",
  }),
  phrase: number({
    group: "Tread",
    label: "Phrase",
    help: "Bars per phrase: each phrase ends with a snare roll into a timpani stroke",
    value: 4,
    min: 1,
    max: 8,
    step: 1,
    unit: "bars",
  }),
  roll: number({
    group: "Tread",
    label: "Roll",
    help: "How long the roll into each phrase end lasts",
    value: 3,
    min: 1,
    max: 8,
    step: 0.5,
    unit: "beats",
  }),
  low: pitch({
    group: "Timpani",
    label: "Low drum",
    help: "The lower timpani pitch",
    value: "D2",
    min: "D2",
    max: "A2",
  }),
  high: pitch({
    group: "Timpani",
    label: "High drum",
    help: "The upper timpani pitch",
    value: "A2",
    min: "A2",
    max: "C3",
  }),
  tempo: number({
    group: "Tread",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 54,
    min: 30,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

export function score(v: Values<typeof knobs>): Score {
  const total = bars * 4;
  const ev: Record<string, NoteEvent[]> = { bd: [], td: [], md: [], sd: [], timp: [] };
  // The tread: bass drum on 1, tenor drum on 3.
  for (let b = 0; b < bars; b++) {
    ev.bd!.push({ at: b * 4, dur: 1 });
    ev.td!.push({ at: b * 4 + 2, dur: 1, dynamic: 3, voice: 2 });
  }
  // The leading figure: a dotted rhythm on each beat (16th-dotted 8th), by whoever leads.
  for (let beat = 0; beat < total; beat++) {
    const who = laneAt(v.leader, beat / 4);
    const hits: [number, number][] = [
      [0, 0.25],
      [0.25, 0.75],
    ];
    for (const [o, d] of hits) {
      const at = beat + o;
      const accent = o === 0 && beat % 4 === 0 ? (["accent"] as const) : undefined;
      if (who === "timpani")
        ev.timp!.push({
          at,
          dur: d,
          pitch: { midi: beat % 2 ? v.high : v.low },
          technique: "hotrods",
          articulations: accent && [...accent],
        });
      else if (who === "military")
        ev.md!.push({ at, dur: d, articulations: accent && [...accent] });
      else if (who === "snare")
        ev.sd!.push({
          at,
          dur: d,
          technique: o === 0 ? "rimshot" : undefined,
          articulations: accent && [...accent],
        });
      else if (who === "tenor") ev.td!.push({ at, dur: d, articulations: accent && [...accent] });
    }
  }
  // Phrase ends: a snare roll crescendo, then a timpani stroke on the next downbeat.
  for (let end = v.phrase * 4; end <= total; end += v.phrase * 4) {
    // In a second voice, so they can sound with the leading figure.
    ev.sd!.push({ at: end - v.roll, dur: v.roll, technique: "roll", voice: 2 });
    if (end < total)
      ev.timp!.push({
        at: end,
        dur: 2,
        pitch: { midi: v.low },
        articulations: ["marcato"],
        voice: 2,
      });
  }
  const parts: Part[] = [
    { id: "timp", instrument: "timpani", events: ev.timp!, dynamics: [{ at: 0, level: 5 }] },
    { id: "sd", instrument: "snare-drum", events: ev.sd!, dynamics: [{ at: 0, level: 4 }] },
    { id: "md", instrument: "military-drum", events: ev.md!, dynamics: [{ at: 0, level: 4 }] },
    { id: "td", instrument: "tenor-drum", events: ev.td!, dynamics: [{ at: 0, level: 4 }] },
    { id: "bd", instrument: "bass-drum", events: ev.bd!, dynamics: [{ at: 0, level: 5 }] },
  ];
  return {
    title: "Percussion: drums",
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: bars,
    parts: parts.filter((p) => p.events.length),
  };
}

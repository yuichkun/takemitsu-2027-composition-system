// The notation of a score, made in a worker thread of the dev server (docs/decisions/0019, 0020):
// for a save, the strip's documents are made here while the server plans the audio.
//
// A request is the score file's text; the answer is what the page needs to lay out and follow the
// score, and the documents the engraver draws (engraver.ts).

import { parentPort } from "node:worker_threads";

import { staffCount, stripMeasures, type NoteFlag } from "../notation/musicxml.ts";
import { sampledRange } from "../performance/plan.ts";
import { normalize } from "../score/normalize.ts";
import { secondsAt, type TempoSegment } from "../score/timeline.ts";
import type { Score } from "../score/types.ts";
import type { StripDocs } from "./engraver.ts";

export interface NotationRequest {
  id: number;
  text: string;
  hiddenParts?: string[];
}

export interface MeasureInfo {
  number: number;
  /** Start and length in quarters. */
  quarters: number;
  length: number;
  seconds: number;
  endSeconds: number;
  beats: number;
  beatType: number;
  /** Rehearsal mark at its start. */
  rehearsal?: string;
  /** Tempo marked in it. */
  tempo?: string;
}

export interface NotationView {
  title: string;
  measures: MeasureInfo[];
  /** For turning seconds into quarters on the page (src/score/timeline.ts, quartersAt). */
  tempo: TempoSegment[];
  warnings: string[];
  parts: { id: string; name: string; instrument: string; group: string; players: number }[];
  /** Only the notation uses this subset; parts above always lists every audio channel. */
  visibleParts: string[];
}

export type NotationAnswer = { id: number } & (
  | { view: NotationView; strip: StripDocs }
  | { error: string }
);

/** Colours for notes out of range: the same red as the playhead, and amber (--play, --prov). */
export const outOfRange = { instrument: "#E5484D", samples: "#D97706" };

/**
 * Notes out of range, coloured: red when the instrument cannot play them (the catalog's range),
 * amber when it can but BBC SO has no samples there (the note plays silent or wrong).
 */
const rangeFlag: NoteFlag = (part, midi) => {
  const r = part.instrument.range;
  if (r && (midi < r[0] || midi > r[1])) return outOfRange.instrument;
  const s = sampledRange(part);
  const key = Math.floor(midi);
  if (s && (key < s[0] || key > s[1])) return outOfRange.samples;
  return undefined;
};

export function notation(
  text: string,
  hiddenParts: string[] = [],
): { view: NotationView; strip: StripDocs } {
  const score = normalize(JSON.parse(text) as Score);
  const hidden = new Set(hiddenParts);
  const visible = {
    ...score,
    parts: score.parts.filter((p) => !hidden.has(p.id)),
    ...(hidden.size ? { notationContext: score } : {}),
  };
  const { measures, margins, warnings } = visible.parts.length
    ? stripMeasures(visible, rangeFlag)
    : { measures: [], margins: [], warnings: score.warnings };
  const rehearsal = new Map(score.rehearsal.map((r) => [r.measure, r.label]));
  const view: NotationView = {
    title: score.title,
    measures: score.measures.map((m) => {
      const end = m.start.add(m.length);
      const marks = score.tempoMarks.filter((t) => t.at.gte(m.start) && t.at.lt(end));
      return {
        number: m.number,
        quarters: m.start.value,
        length: m.length.value,
        seconds: secondsAt(score.tempo, m.start.value),
        endSeconds: secondsAt(score.tempo, end.value),
        beats: m.beats,
        beatType: m.beatType,
        rehearsal: rehearsal.get(m.number),
        tempo: marks.length
          ? marks
              .map(
                (t) => `${t.text ? `${t.text} ` : ""}♩=${t.bpm}${t.change ? ` ${t.change}` : ""}`,
              )
              .join(", ")
          : undefined,
      };
    }),
    tempo: score.tempo,
    warnings,
    parts: score.parts.map((p) => ({
      id: p.id,
      name: p.name,
      instrument: p.instrument.id,
      group: p.instrument.name,
      players: p.players,
    })),
    visibleParts: visible.parts.map((p) => p.id),
  };
  const staves = visible.parts.length ? staffCount(visible) : 0;
  return { view, strip: { measures, margins, staves } };
}

parentPort?.on("message", (request: NotationRequest) => {
  let answer: NotationAnswer;
  try {
    answer = { id: request.id, ...notation(request.text, request.hiddenParts) };
  } catch (e) {
    answer = { id: request.id, error: e instanceof Error ? e.message : String(e) };
  }
  parentPort!.postMessage(answer);
});

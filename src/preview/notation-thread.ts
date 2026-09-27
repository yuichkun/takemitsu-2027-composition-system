// The notation of a score, made in a worker thread of the dev server (docs/decisions/0019): for a
// save, the MusicXML windows are made here while the server plans the audio.
//
// A request is the score file's text; the answer is everything the page needs to draw it.

import { createHash } from "node:crypto";
import { parentPort } from "node:worker_threads";

import { musicXmlWindows } from "../notation/musicxml.ts";
import { normalize } from "../score/normalize.ts";
import { secondsAt } from "../score/timeline.ts";
import type { Score } from "../score/types.ts";

export interface NotationRequest {
  id: number;
  text: string;
}

export interface NotationView {
  title: string;
  windows: { from: number; to: number; hash: string; musicxml: string }[];
  warnings: string[];
  measures: { number: number; quarters: number; seconds: number; endSeconds: number }[];
  parts: { id: string; name: string }[];
}

export type NotationAnswer = { id: number } & ({ view: NotationView } | { error: string });

function notation(text: string): NotationView {
  const score = normalize(JSON.parse(text) as Score);
  const { windows, warnings } = musicXmlWindows(score);
  return {
    title: score.title,
    windows: windows.map((w) => ({
      from: w.from,
      to: w.to,
      hash: createHash("sha256").update(w.musicxml).digest("hex").slice(0, 32),
      musicxml: w.musicxml,
    })),
    warnings,
    measures: score.measures.map((m) => ({
      number: m.number,
      quarters: m.start.value,
      seconds: secondsAt(score.tempo, m.start.value),
      endSeconds: secondsAt(score.tempo, m.start.add(m.length).value),
    })),
    parts: score.parts.map((p) => ({ id: p.id, name: p.name })),
  };
}

parentPort?.on("message", (request: NotationRequest) => {
  let answer: NotationAnswer;
  try {
    answer = { id: request.id, view: notation(request.text) };
  } catch (e) {
    answer = { id: request.id, error: e instanceof Error ? e.message : String(e) };
  }
  parentPort!.postMessage(answer);
});

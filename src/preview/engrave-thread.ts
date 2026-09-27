// A worker thread of the dev server that draws strip measures with Verovio (engrave.ts), one at a
// time, for the engraver (engraver.ts). It reports the size of Verovio's memory with each answer:
// WASM memory never shrinks, so the engraver replaces a thread that has grown too large.

import { parentPort } from "node:worker_threads";

import createVerovioModule from "verovio/wasm";
import { enableLog, LOG_OFF, VerovioToolkit } from "verovio/esm";

import { engrave, engraveOptions, type EngraveRequest, type Engraving } from "./engrave.ts";

export interface EngraveJob {
  id: number;
  request: EngraveRequest;
}

export type EngraveAnswer = { id: number; heap: number } & (
  | { engraving: Engraving }
  | { error: string }
);

const module = (await createVerovioModule()) as { HEAPU8?: { length: number } };
enableLog(LOG_OFF, module);
const toolkit = new VerovioToolkit(module);
toolkit.setOptions(engraveOptions);

parentPort!.on("message", (job: EngraveJob) => {
  let answer: EngraveAnswer;
  try {
    answer = {
      id: job.id,
      heap: module.HEAPU8?.length ?? 0,
      engraving: engrave(toolkit, job.request),
    };
  } catch (e) {
    answer = {
      id: job.id,
      heap: module.HEAPU8?.length ?? 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
  parentPort!.postMessage(answer);
});
parentPort!.postMessage({ ready: true, version: toolkit.getVersion() });

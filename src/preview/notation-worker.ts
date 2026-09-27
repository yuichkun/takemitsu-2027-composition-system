// Draws one notation window (a short MusicXML document) with Verovio, off the page's main
// thread. Replies with the SVG and when each note sounds (milliseconds from the window's start).

import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";

export interface DrawRequest {
  id: number;
  musicxml: string;
  /** Width to lay out for, in CSS pixels. */
  width: number;
}

export interface DrawResult {
  id: number;
  svg: string;
  /** [note id, onset ms, release ms] */
  notes: [string, number, number][];
  error?: string;
}

// Set the handler at once (messages may arrive while the module loads) and wait inside it.
const ready = createVerovioModule().then((module) => new VerovioToolkit(module));
/** Verovio's scale in percent: the SVG is drawn at this size. */
const scale = 35;

self.onmessage = async (event: MessageEvent<DrawRequest>) => {
  const { id, musicxml, width } = event.data;
  const toolkit = await ready;
  try {
    toolkit.setOptions({
      pageWidth: Math.round((width * 100) / scale),
      pageHeight: 60000,
      adjustPageHeight: true,
      scale,
      breaks: "auto",
      font: "Bravura",
      svgAdditionalAttribute: ["measure@n"],
      svgHtml5: true,
      // Hide staves with nothing to play in a system, as a full score does.
      condense: "auto",
      condenseFirstPage: true,
    });
    toolkit.loadData(musicxml);
    let svg = "";
    for (let p = 1; p <= toolkit.getPageCount(); p++) svg += toolkit.renderToSVG(p);
    const on = new Map<string, number>();
    const notes: [string, number, number][] = [];
    for (const entry of toolkit.renderToTimemap()) {
      for (const n of entry.on ?? []) on.set(n, entry.tstamp);
      for (const n of entry.off ?? []) {
        const start = on.get(n);
        if (start !== undefined) notes.push([n, start, entry.tstamp]);
        on.delete(n);
      }
    }
    self.postMessage({ id, svg, notes } satisfies DrawResult);
  } catch (e) {
    self.postMessage({ id, svg: "", notes: [], error: String(e) } satisfies DrawResult);
  }
};

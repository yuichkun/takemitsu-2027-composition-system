// Draws one measure of the preview's strip (src/notation/musicxml.ts, stripMeasures), or its left
// margin, with Verovio (docs/decisions/0020). Used by the engraver's worker threads
// (engrave-thread.ts) and by tools/notation-check.ts.
//
// MusicXML → MEI, where three things are written in:
// - the least space above each staff (staffDef@spacing), the same in every measure, so that
//   measures drawn one by one line up (src/preview/engraver.ts chooses it);
// - ties and slurs crossing the barlines, drawn from and to the barline (tstamp 0 and tstamp2);
// - octave lines that come in or run on: from the barline, and with no closing hook.
// Then the drawing is touched up: the line and brackets Verovio draws at the left edge of a system
// go (the strip's margin draws brackets once), octave lines coming in lose their number, cut
// hairpins get the openings they have at the cut, and the drawing reaches `bleed` units left of
// the barline, so that what Verovio puts just before a first note (an "8va", a dynamic, a tempo)
// is not cut off. There, it lies over the end of the measure before, which is transparent.
//
// Besides the SVG it reports where the staves are, how much space each staff got above it (so
// the engraver can find the space that fits every measure), and where each beat is.

import type { VerovioToolkit } from "verovio/esm";

import type { Seam } from "../notation/musicxml.ts";

export const engraveOptions = {
  breaks: "none",
  adjustPageWidth: true,
  adjustPageHeight: true,
  condense: "none",
  header: "none",
  footer: "none",
  pageMarginLeft: 0,
  pageMarginRight: 0,
  pageMarginTop: 0,
  pageMarginBottom: 0,
  font: "Bravura",
  svgViewBox: true,
  svgHtml5: false,
  scale: 100,
};

export interface EngraveRequest {
  musicxml: string;
  /** Marks crossing the measure's barlines. */
  seam?: Seam;
  /** The strip's left margin: drawn as it is, with its names, brackets and system line. */
  margin?: boolean;
  /** Least space above each staff in MEI units (staffDef@spacing), by staff number from 1. */
  spacing: number[];
}

/** How far each drawing reaches left of its first barline, in its own units. */
export const bleed = 1000;

export interface Engraving {
  svg: string;
  /** The drawing's size, in its own units (the inner viewBox), from its first barline: it also
   * reaches `bleed` units to the left of it. */
  width: number;
  height: number;
  /** Top line of each staff and bottom line, from staff 1 down. */
  staves: [number, number][];
  /** Space each staff got above it, in MEI units (index 0: none). */
  gaps: number[];
  /** End of the staff lines: the closing barline, where the next measure joins. */
  right: number;
  /** [quarters from the measure's start, x], left to right: where each beat is drawn. */
  anchors: [number, number][];
}

/** Draws one document. The toolkit must have `engraveOptions` set. */
export function engrave(tk: VerovioToolkit, request: EngraveRequest): Engraving {
  tk.loadData(request.musicxml);
  tk.loadData(annotate(tk.getMEI(), request));
  let svg = tk.renderToSVG(1);
  const timemap = tk.renderToTimemap({ includeRests: true });
  if (!request.margin) svg = dropSystemStart(svg);
  if (request.seam) svg = reshapeHairpins(svg, request.seam);
  // An octave line coming in from the measure before shows no number.
  svg = svg.replace(
    /(<g id="octave-in-\d+" class="octave">)([\s\S]*?)<\/g>/g,
    (_, head, inner) => `${head}${inner.replace(/<use [^>]*\/>|<text[\s\S]*?<\/text>/g, "")}</g>`,
  );
  const geometry = measure(svg, timemap);
  return { svg: request.margin ? svg : widen(svg), ...geometry };
}

//==============================================================================
// MEI

function annotate(mei: string, { seam, spacing }: EngraveRequest): string {
  mei = mei.replace(/<staffDef ([^>]*?)n="(\d+)"/g, (whole, attrs: string, n: string) => {
    const space = spacing[Number(n)];
    if (space === undefined || n === "1") return whole;
    return `<staffDef ${attrs.replace(/spacing="[^"]*" ?/, "")}n="${n}" spacing="${space}"`;
  });
  // Measure numbers are shown by the page, not in each measure.
  mei = mei.replace(/<scoreDef /, '<scoreDef mnum.visible="false" ');
  if (!seam) return mei;
  const events: string[] = [];
  let k = 0;
  const id = () => `seam-${k++}`;
  const end = `0m+${seam.barline}`;
  for (const [kind, ends, into] of [
    ["tie", seam.tiesIn, true],
    ["tie", seam.tiesOut, false],
    ["slur", seam.slursIn, true],
    ["slur", seam.slursOut, false],
  ] as const) {
    for (const e of ends)
      events.push(
        into
          ? `<${kind} xml:id="${id()}" staff="${e.staff}" tstamp="0" endid="#${e.note}"/>`
          : `<${kind} xml:id="${id()}" staff="${e.staff}" startid="#${e.note}" tstamp2="${end}"/>`,
      );
  }
  if (events.length) mei = mei.replace("</measure>", `${events.join("")}</measure>`);
  // Octave lines, matched to the seam's in order within each staff.
  const pending = new Map<number, Seam["octaves"]>();
  for (const o of seam.octaves) pending.set(o.staff, [...(pending.get(o.staff) ?? []), o]);
  return mei.replace(/<octave ([^>]*?)(\/?)>/g, (whole, attrs: string, close: string) => {
    const staff = Number(attrs.match(/staff="(\d+)"/)?.[1]);
    const o = pending.get(staff)?.shift();
    if (!o) return whole;
    let a = attrs;
    if (o.in)
      a = a
        .replace(/startid="[^"]*"/, 'tstamp="0"')
        .replace(/xml:id="[^"]*"/, `xml:id="octave-in-${k++}"`);
    if (o.out) a = a.replace(/endid="[^"]*"/, `tstamp2="${end}" lendsym="none"`);
    return `<octave ${a}${close}>`;
  });
}

//==============================================================================
// SVG

/** The line down the left edge of a system, and its brackets, would show at every join. */
function dropSystemStart(svg: string): string {
  return svg
    .replace(/(<g id="[^"]+" class="system">\s*)<path d="M[^"]*"[^>]*\/>/, "$1")
    .replace(/<g id="[^"]+" class="grpSym">[\s\S]*?<\/g>/g, "");
}

/**
 * Lets the drawing reach `bleed` units left of its first barline. The root viewBox is in tenths
 * of the inner units; the inner drawing keeps its place and size, and may draw outside it.
 */
function widen(svg: string): string {
  let size = "";
  return svg
    .replace(/<svg viewBox="0 0 ([\d.]+) ([\d.]+)"/, (_, w: string, h: string) => {
      size = `width="${w}" height="${h}"`;
      return `<svg viewBox="${-bleed / 10} 0 ${Number(w) + bleed / 10} ${h}"`;
    })
    .replace(
      '<svg class="definition-scale"',
      () => `<svg class="definition-scale" ${size} overflow="visible"`,
    );
}

/**
 * A hairpin cut at a barline is drawn by Verovio as a whole one (closed at one end). Redraw it
 * with the openings it has at the cut, reaching the barline, so the pieces join.
 */
function reshapeHairpins(svg: string, seam: Seam): string {
  const right = staffLineEnd(svg);
  for (const h of seam.hairpins) {
    const re = new RegExp(
      `(<g id="${h.id}" class="hairpin">\\s*)<polyline ([^>]*?)points="([^"]+)"\\s*/>`,
    );
    svg = svg.replace(re, (whole, head: string, attrs: string, points: string) => {
      const p = points
        .trim()
        .split(/\s+/)
        .map((xy) => xy.split(",").map(Number));
      if (p.length !== 3) return whole;
      const [a, vertex, b] = p as [number[], number[], number[]];
      const full = Math.abs(a[1]! - b[1]!);
      const mid = vertex[1]!;
      let xs = Math.min(vertex[0]!, a[0]!);
      let xe = Math.max(vertex[0]!, a[0]!);
      if (h.in) xs = 0;
      if (h.out) xe = right;
      const os = (full * h.start) / 2;
      const oe = (full * h.end) / 2;
      const d = `M${xs} ${mid - os} L${xe} ${mid - oe} M${xs} ${mid + os} L${xe} ${mid + oe}`;
      return `${head}<path ${attrs.replace(/fill="[^"]*" ?/, "")}fill="none" d="${d}"/>`;
    });
  }
  return svg;
}

const staffLineEnd = (svg: string) =>
  Number(svg.match(/class="staff">\s*<path d="M-?\d+ -?\d+ L(-?\d+)/)?.[1] ?? 0);

//==============================================================================
// Geometry

interface TimemapEntry {
  qstamp: number;
  on?: string[];
  restsOn?: string[];
}

function measure(svg: string, timemap: TimemapEntry[]): Omit<Engraving, "svg"> {
  const box = svg.match(/class="definition-scale"[^>]*viewBox="0 0 (\d+) (\d+)"/);
  const width = Number(box?.[1] ?? 0);
  const height = Number(box?.[2] ?? 0);
  // Staff lines of each staff (the document has one measure, so staves come once, in order).
  const staves: [number, number][] = [];
  for (const m of svg.matchAll(
    /class="staff">((?:\s*<path d="M-?\d+ -?\d+ L-?\d+ -?\d+"[^>]*\/>)+)/g,
  )) {
    const ys = [...m[1]!.matchAll(/M-?\d+ (-?\d+)/g)].map((x) => Number(x[1]));
    staves.push([ys[0]!, ys.at(-1)!]);
  }
  // A five-line staff is 8 MEI units tall.
  const five = staves.find(([t, b]) => b > t);
  const unit = five ? (five[1] - five[0]) / 8 : 1;
  const gaps = staves.map((s, i) => (i === 0 ? 0 : (s[0] - staves[i - 1]![1]) / unit));
  const right = staffLineEnd(svg);
  // x of each note and rest head.
  const xOf = new Map<string, number>();
  for (const m of svg.matchAll(
    /<g id="([^"]+)" class="(?:note|rest)">[\s\S]*?translate\((-?\d+),/g,
  ))
    xOf.set(m[1]!, Number(m[2]));
  const anchors: [number, number][] = [];
  for (const e of timemap) {
    const xs = [...(e.on ?? []), ...(e.restsOn ?? [])]
      .map((id) => xOf.get(id))
      .filter((x): x is number => x !== undefined);
    if (!xs.length) continue;
    const x = Math.min(...xs);
    // Keep beats left to right; a measure rest (drawn in the middle) would go back.
    if (anchors.length && x <= anchors.at(-1)![1]) continue;
    anchors.push([e.qstamp, x]);
  }
  return { width, height, staves, gaps, right, anchors };
}

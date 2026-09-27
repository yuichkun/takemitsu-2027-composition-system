// Score → MusicXML 4.0 (partwise). The same file feeds the Verovio preview and Sibelius.
// Quarter tones are written as fractional <alter> (docs/decisions/0011-quarter-tone-notation.md);
// <accidental> is computed here because Verovio draws only what it is given.

import type { Instrument } from "../instruments/catalog.ts";
import { techniqueOf } from "../instruments/techniques.ts";
import { normalize, type Note, type NormalPart, type NormalScore } from "../score/normalize.ts";
import { accidentalName, type Spelled } from "../score/pitch.ts";
import { lcm, Rational } from "../score/rational.ts";
import type { Measure } from "../score/timeline.ts";
import type { Score } from "../score/types.ts";
import { registersOf, type Ottava, type StaffRegisters } from "./registers.ts";
import { layoutMeasure, type Piece } from "./rhythm.ts";

export interface NotationResult {
  musicxml: string;
  warnings: string[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

//==============================================================================
// Dynamics: continuous levels → marks and hairpins

const markNames = ["n", "ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "ffff"];
const markFor = (level: number) =>
  markNames[Math.max(0, Math.min(markNames.length - 1, Math.round(level)))]!;

interface Mark {
  at: Rational;
  mark: string;
}
interface Wedge {
  start: Rational;
  end: Rational;
  type: "crescendo" | "diminuendo";
  nienteStart: boolean;
  nienteEnd: boolean;
}

export function dynamicMarks(part: NormalPart): { marks: Mark[]; wedges: Wedge[] } {
  const marks: Mark[] = [];
  const wedges: Wedge[] = [];
  const points = part.dynamics;
  let last = "";
  const show = (at: Rational, level: number, force = false) => {
    const mark = markFor(level);
    if (mark === last && !force) return;
    marks.push({ at, mark });
    last = mark;
  };
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const next = points[i + 1];
    const cameByWedge =
      i > 0 && points[i - 1]!.to === "linear" && Math.abs(p.level - points[i - 1]!.level) >= 0.5;
    if (!cameByWedge && !(p.to === "linear" && next && p.level < 0.5)) show(p.at, p.level);
    if (p.to === "linear" && next && Math.abs(next.level - p.level) >= 0.5) {
      wedges.push({
        start: p.at,
        end: next.at,
        type: next.level > p.level ? "crescendo" : "diminuendo",
        nienteStart: p.level < 0.5,
        nienteEnd: next.level < 0.5,
      });
      if (next.level >= 0.5) show(next.at, next.level, true);
      else last = "n";
    }
  }
  // A part without dynamics shows nothing (the default level is only for playback).
  return { marks, wedges };
}

//==============================================================================
// Technique texts

const hasMark = (t: string[], mark: string) => t.some((id) => techniqueOf(id)?.mark === mark);

function techniqueChanges(part: NormalPart): { at: Rational; text: string }[] {
  const out: { at: Rational; text: string }[] = [];
  let active = new Set<string>();
  const starts = [...new Map(part.notes.map((n) => [n.at.toString(), n])).values()].sort((a, b) =>
    a.at.cmp(b.at),
  );
  for (const n of starts) {
    // Techniques written only as marks on the note do not start or end text.
    const now = new Set(
      n.technique
        .map((t) => techniqueOf(t)?.implies ?? t)
        .filter((t) => techniqueOf(t)?.text !== "" || techniqueOf(t)?.cancel !== ""),
    );
    const texts: string[] = [];
    for (const t of active) if (!now.has(t)) texts.push(techniqueOf(t)?.cancel ?? "ord.");
    for (const t of now) if (!active.has(t)) texts.push(techniqueOf(t)?.text ?? t);
    const unique = [...new Set(texts.filter(Boolean))];
    // "ord." next to a new technique is redundant.
    const shown = unique.length > 1 ? unique.filter((t) => t !== "ord.") : unique;
    if (shown.length) out.push({ at: n.at, text: shown.join(" ") });
    active = now;
  }
  return out;
}

//==============================================================================
// Notes

/** The pitch as written: sounding pitch moved by the instrument's octave (piccolo down, basses up). */
export function written(p: Spelled, inst: Instrument): Spelled {
  const shift = inst.writtenOctave ?? 0;
  return { ...p, octave: p.octave + shift, midi: p.midi + 12 * shift };
}

class AccidentalState {
  private seen = new Map<string, number>();
  reset(): void {
    this.seen.clear();
  }
  /** Returns the accidental to print, or undefined if the current state already implies it. */
  next(p: Spelled, tied: boolean): string | undefined {
    // No key signature: a step starts the measure natural.
    const key = `${p.step}${p.octave}`;
    const previous = this.seen.get(key) ?? 0;
    this.seen.set(key, p.alter);
    if (tied || previous === p.alter) return undefined;
    return accidentalName(p.alter);
  }
}

function noteXml(
  piece: Piece,
  pitch: Spelled | undefined,
  chord: boolean,
  voice: number,
  staff: number,
  staves: number,
  divisions: number,
  inst: Instrument,
  accidentals: AccidentalState,
  slur: { open: boolean },
  /** Octaves an octave line draws the note lower (8va 1, 8vb −1). */
  lowered: number,
): string {
  const n = piece.note;
  const out: string[] = ["<note>"];
  if (chord) out.push("<chord/>");
  if (!n) {
    out.push(piece.measureRest ? '<rest measure="yes"/>' : "<rest/>");
  } else if (inst.unpitched) {
    out.push(
      "<unpitched><display-step>B</display-step><display-octave>4</display-octave></unpitched>",
    );
  } else {
    const w = written(pitch!, inst);
    out.push(
      `<pitch><step>${w.step}</step>${w.alter ? `<alter>${w.alter}</alter>` : ""}<octave>${w.octave}</octave></pitch>`,
    );
  }
  out.push(`<duration>${piece.dur.mul(new Rational(divisions)).value}</duration>`);
  if (piece.tieFromPrevious) out.push('<tie type="stop"/>');
  if (piece.tieToNext) out.push('<tie type="start"/>');
  out.push(`<voice>${voice}</voice>`);
  if (!piece.measureRest) out.push(`<type>${piece.type}</type>`);
  for (let i = 0; i < piece.dots; i++) out.push("<dot/>");
  if (n && pitch && !inst.unpitched) {
    const w = written(pitch, inst);
    const acc = accidentals.next({ ...w, octave: w.octave - lowered }, piece.tieFromPrevious);
    if (acc) out.push(`<accidental>${acc}</accidental>`);
  }
  if (piece.tuplet) {
    out.push(
      `<time-modification><actual-notes>${piece.tuplet.actual}</actual-notes><normal-notes>${piece.tuplet.normal}</normal-notes></time-modification>`,
    );
  }
  if (staves > 1) out.push(`<staff>${staff}</staff>`);
  if (!chord) piece.beams.forEach((b, i) => b && out.push(`<beam number="${i + 1}">${b}</beam>`));

  const notations: string[] = [];
  if (piece.tieFromPrevious) notations.push('<tied type="stop"/>');
  if (piece.tieToNext) notations.push('<tied type="start"/>');
  if (!chord && piece.tuplet?.first) notations.push('<tuplet type="start" bracket="yes"/>');
  if (!chord && piece.tuplet?.last) notations.push('<tuplet type="stop"/>');
  if (n && !chord) {
    const firstPiece = !piece.tieFromPrevious;
    const lastPiece = !piece.tieToNext;
    if (slur.open && firstPiece) {
      notations.push('<slur type="stop" number="1"/>');
      slur.open = false;
    }
    if (n.slur && lastPiece) {
      notations.push('<slur type="start" number="1"/>');
      slur.open = true;
    }
    const ornaments: string[] = [];
    if (hasMark(n.technique, "tremolo")) ornaments.push('<tremolo type="single">3</tremolo>');
    if (n.trill && firstPiece) ornaments.push("<trill-mark/>");
    if (ornaments.length) notations.push(`<ornaments>${ornaments.join("")}</ornaments>`);
    const technical: string[] = [];
    if (hasMark(n.technique, "harmonic")) technical.push("<harmonic><natural/></harmonic>");
    if (hasMark(n.technique, "snap-pizzicato") && firstPiece) technical.push("<snap-pizzicato/>");
    if (technical.length) notations.push(`<technical>${technical.join("")}</technical>`);
    if (firstPiece && n.articulations.length) {
      const tags: Record<string, string> = {
        staccato: "staccato",
        staccatissimo: "staccatissimo",
        tenuto: "tenuto",
        accent: "accent",
        marcato: "strong-accent",
      };
      notations.push(
        `<articulations>${n.articulations.map((a) => `<${tags[a]}/>`).join("")}</articulations>`,
      );
    }
  }
  if (notations.length) out.push(`<notations>${notations.join("")}</notations>`);
  out.push("</note>");
  return out.join("");
}

//==============================================================================
// Directions

interface Direction {
  at: Rational;
  staff: number;
  xml: string;
  placement: "above" | "below";
  /** Playback attributes, e.g. tempo="72". */
  sound?: string;
}

function direction(d: Direction, offset: Rational, divisions: number, staves: number): string {
  const off = offset.gt(Rational.zero)
    ? `<offset>${offset.mul(new Rational(divisions)).value}</offset>`
    : "";
  const staff = staves > 1 ? `<staff>${d.staff}</staff>` : "";
  const sound = d.sound ? `<sound ${d.sound}/>` : "";
  return `<direction placement="${d.placement}"><direction-type>${d.xml}</direction-type>${off}${staff}${sound}</direction>`;
}

function beatUnit(beat: Rational): string {
  const units: Record<string, [string, boolean]> = {
    "4": ["whole", false],
    "3": ["half", true],
    "2": ["half", false],
    "3/2": ["quarter", true],
    "1": ["quarter", false],
    "3/4": ["eighth", true],
    "1/2": ["eighth", false],
  };
  const [unit, dot] = units[beat.toString()] ?? ["quarter", false];
  return `<beat-unit>${unit}</beat-unit>${dot ? "<beat-unit-dot/>" : ""}`;
}

//==============================================================================

function clefXml(c: Instrument["clefs"][number], number: number, staves: number): string {
  const n = staves > 1 ? ` number="${number}"` : "";
  if (c.sign === "percussion") return `<clef${n}><sign>percussion</sign></clef>`;
  return `<clef${n}><sign>${c.sign}</sign><line>${c.line}</line></clef>`;
}

/**
 * Start or end of an octave line on a staff. The staff is always named: without it, Verovio 5.7
 * moves the notes only in the first part.
 */
function octaveShiftXml(o: Ottava, type: "start" | "stop", staff: number): string {
  const size = Math.abs(o.octaves) === 2 ? 15 : 8;
  // MusicXML names the way the notes are drawn: 8va draws them lower ("down").
  const kind = type === "stop" ? "stop" : o.octaves > 0 ? "down" : "up";
  return `<direction placement="${o.octaves > 0 ? "above" : "below"}"><direction-type><octave-shift type="${kind}" size="${size}" number="${staff}"/></direction-type><staff>${staff}</staff></direction>`;
}

const registerCache = new WeakMap<NormalPart, StaffRegisters[]>();
/** Clefs and octave lines of a part's staves, worked out once for the whole score. */
function registersFor(part: NormalPart, score: NormalScore): StaffRegisters[] {
  let r = registerCache.get(part);
  if (!r) {
    r = registersOf(part, score.measures, written);
    registerCache.set(part, r);
  }
  return r;
}

/** What a part's documents share, worked out once per part (a long score has many documents). */
interface PartFacts {
  marks: Mark[];
  wedges: Wedge[];
  changes: { at: Rational; text: string }[];
  voicesByStaff: Map<number, Set<number>>;
  /** Longest note, to find notes sounding into a span without scanning them all. */
  longest: number;
}
const facts = new WeakMap<NormalPart, PartFacts>();
function factsOf(part: NormalPart): PartFacts {
  let f = facts.get(part);
  if (!f) {
    const voicesByStaff = new Map<number, Set<number>>();
    for (const n of part.notes) {
      if (!voicesByStaff.has(n.staff)) voicesByStaff.set(n.staff, new Set());
      voicesByStaff.get(n.staff)!.add(n.voice);
    }
    for (let s = 1; s <= part.instrument.clefs.length; s++)
      if (!voicesByStaff.has(s)) voicesByStaff.set(s, new Set([1]));
    f = {
      ...dynamicMarks(part),
      changes: techniqueChanges(part),
      voicesByStaff,
      longest: Math.max(0, ...part.notes.map((n) => n.dur.value)),
    };
    facts.set(part, f);
  }
  return f;
}

/** Notes sounding in [start, end): part.notes is sorted by onset. */
function notesBetween(part: NormalPart, start: Rational, end: Rational): NormalPart["notes"] {
  const notes = part.notes;
  const from = start.value - factsOf(part).longest;
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid]!.at.value < from) lo = mid + 1;
    else hi = mid;
  }
  const out: NormalPart["notes"] = [];
  for (let i = lo; i < notes.length && notes[i]!.at.lt(end); i++)
    if (notes[i]!.end.gt(start)) out.push(notes[i]!);
  return out;
}

/** Measures (indices, inclusive) written into one MusicXML document. */
interface Span {
  first: number;
  last: number;
}

function partXml(
  part: NormalPart,
  index: number,
  score: NormalScore,
  warnings: string[],
  span: Span,
): string {
  const inst = part.instrument;
  const measures = score.measures.slice(span.first, span.last + 1);
  const spanStart = measures[0]!.start;
  const spanEnd = measures.at(-1)!.start.add(measures.at(-1)!.length);
  const whole = span.first === 0 && span.last === score.measures.length - 1;
  const inSpan = (at: Rational) => at.gte(spanStart) && at.lt(spanEnd);
  const notesInSpan = notesBetween(part, spanStart, spanEnd);
  const staves = inst.clefs.length;
  const known = factsOf(part);
  const voicesByStaff = known.voicesByStaff;
  const registers = registersFor(part, score);
  // Octave lines over this document's notes: each starts before its first note here and stops
  // after its last note, if that ends here (otherwise the line runs on to the document's end).
  const lineStarts = new Map<Note, { line: Ottava; staff: number }>();
  const lineStops = new Map<Note, { line: Ottava; staff: number }>();
  const lowered = new Map<Note, number>();
  registers.forEach((r, i) => {
    for (const line of r.ottavas) {
      const here = line.notes.filter((n) => n.at.lt(spanEnd) && n.end.gt(spanStart));
      if (!here.length) continue;
      for (const n of here) lowered.set(n, line.octaves);
      lineStarts.set(here[0]!, { line, staff: i + 1 });
      const last = here.at(-1)!;
      if (last === line.notes.at(-1) && last.end.lte(spanEnd))
        lineStops.set(last, { line, staff: i + 1 });
    }
  });
  const started = new Set<Ottava>();

  // Lay out every measure first so divisions can cover all durations.
  const layouts = measures.map((m) => {
    const groups: { staff: number; voice: number; pieces: Piece[] }[] = [];
    for (const [staff, voices] of [...voicesByStaff.entries()].sort((a, b) => a[0] - b[0])) {
      for (const voice of [...voices].sort((a, b) => a - b)) {
        const notes = notesInSpan.filter(
          (n) =>
            n.staff === staff &&
            n.voice === voice &&
            n.at.lt(m.start.add(m.length)) &&
            n.end.gt(m.start),
        );
        const pieces = layoutMeasure(notes, m, voice === Math.min(...voices));
        if (pieces.length) groups.push({ staff, voice: (staff - 1) * 4 + voice, pieces });
      }
    }
    return groups;
  });
  let divisions = 1;
  for (const groups of layouts)
    for (const g of groups)
      for (const p of g.pieces) divisions = lcm(divisions, lcm(p.dur.d, p.start.d));

  // Directions. A document that starts mid-piece repeats what is in force at its start
  // (dynamic, technique, tempo), and hairpins crossing its edges are cut at them.
  const directions: Direction[] = [];
  const marks = [...known.marks];
  const wedges = known.wedges;
  const firstNote = notesInSpan.find((n) => n.at.gte(spanStart));
  const inWedge = (at: Rational) => wedges.some((w) => w.start.lt(at) && w.end.gt(at));
  if (!whole && firstNote && !marks.some((m) => m.at.eq(spanStart)) && !inWedge(spanStart)) {
    const before = marks.filter((m) => m.at.lt(spanStart)).at(-1);
    if (before) marks.push({ at: firstNote.at, mark: before.mark });
  }
  for (const m of marks) {
    if (!inSpan(m.at)) continue;
    const inner = m.mark === "n" ? "<other-dynamics>n</other-dynamics>" : `<${m.mark}/>`;
    directions.push({
      at: m.at,
      staff: 1,
      placement: "below",
      xml: `<dynamics>${inner}</dynamics>`,
    });
  }
  for (const w of wedges) {
    if (w.end.lte(spanStart) || w.start.gte(spanEnd)) continue;
    const start = w.start.lt(spanStart) ? spanStart : w.start;
    // A hairpin running past the end stops at the last barline (see isLast below).
    const end = w.end.gt(spanEnd) ? spanEnd : w.end;
    directions.push({
      at: start,
      staff: 1,
      placement: "below",
      xml: `<wedge type="${w.type}"${w.nienteStart && start === w.start ? ' niente="yes"' : ""}/>`,
    });
    directions.push({
      at: end,
      staff: 1,
      placement: "below",
      xml: `<wedge type="stop"${w.nienteEnd && end === w.end ? ' niente="yes"' : ""}/>`,
    });
  }
  const changes = [...known.changes];
  if (!whole && firstNote && !changes.some((c) => c.at.eq(firstNote.at))) {
    const before = changes.filter((c) => c.at.lt(spanStart)).at(-1);
    const cancel = (t: string) => t === "ord." || t === "arco" || t.startsWith("senza");
    if (before && !cancel(before.text) && firstNote.technique.length)
      changes.push({ at: firstNote.at, text: before.text });
  }
  for (const t of changes)
    if (inSpan(t.at))
      directions.push({
        at: t.at,
        staff: 1,
        placement: "above",
        xml: `<words>${esc(t.text)}</words>`,
      });
  for (const t of part.texts)
    if (inSpan(t.at))
      directions.push({
        at: t.at,
        staff: 1,
        placement: t.placement,
        xml: `<words>${esc(t.text)}</words>`,
      });
  if (index === 0) {
    const tempos = score.tempoMarks.filter((t) => inSpan(t.at));
    // Verovio times the notes from the tempo in the document, so it must know it at the start.
    if (!tempos.some((t) => t.at.eq(spanStart))) {
      const before = score.tempoMarks.filter((t) => t.at.lt(spanStart)).at(-1);
      if (before) tempos.unshift({ ...before, at: spanStart });
    }
    for (const t of tempos) {
      directions.push({
        sound: `tempo="${(t.bpm * t.beat.value).toFixed(2)}"`,
        at: t.at,
        staff: 1,
        placement: "above",
        xml: `${t.text ? `<words font-weight="bold">${esc(t.text)} </words></direction-type><direction-type>` : ""}<metronome>${beatUnit(t.beat)}<per-minute>${t.bpm}</per-minute></metronome>`,
      });
    }
  }

  const out: string[] = [`<part id="P${index + 1}">`];
  const slur = { open: false };
  let previousMeter = "";
  measures.forEach((m: Measure, mi) => {
    out.push(`<measure number="${m.number}">`);
    const meter = `${m.beats}/${m.beatType}`;
    const attrs: string[] = [];
    if (mi === 0) attrs.push(`<divisions>${divisions}</divisions><key><fifths>0</fifths></key>`);
    if (meter !== previousMeter)
      attrs.push(`<time><beats>${m.beats}</beats><beat-type>${m.beatType}</beat-type></time>`);
    const at = span.first + mi;
    if (mi === 0 && staves > 1) attrs.push(`<staves>${staves}</staves>`);
    registers.forEach((r, i) => {
      // Every document states its clefs; later measures only where the clef changes.
      if (mi === 0 || r.clefs[at] !== r.clefs[at - 1])
        attrs.push(clefXml(r.clefs[at]!, i + 1, staves));
    });
    if (mi === 0 && inst.unpitched)
      attrs.push("<staff-details><staff-lines>1</staff-lines></staff-details>");
    previousMeter = meter;
    if (attrs.length) out.push(`<attributes>${attrs.join("")}</attributes>`);

    if (index === 0) {
      for (const r of score.rehearsal.filter((r) => r.measure === m.number)) {
        out.push(
          `<direction placement="above"><direction-type><rehearsal enclosure="square">${esc(r.label)}</rehearsal></direction-type></direction>`,
        );
      }
    }

    const mEnd = m.start.add(m.length);
    const isLast = mi === measures.length - 1;
    // Directions at the final barline (a hairpin ending with the piece) go on the last note.
    const here = directions
      .filter((d) => d.at.gte(m.start) && (d.at.lt(mEnd) || isLast))
      .sort((a, b) => a.at.cmp(b.at));
    const groups = layouts[mi]!;
    const accidentals = new Map<number, AccidentalState>();
    groups.forEach((g, gi) => {
      if (gi > 0)
        out.push(
          `<backup><duration>${m.length.mul(new Rational(divisions)).value}</duration></backup>`,
        );
      const acc = accidentals.get(g.staff) ?? new AccidentalState();
      accidentals.set(g.staff, acc);
      const carriesDirections = gi === groups.findIndex((x) => x.staff === 1);
      for (const piece of g.pieces) {
        if (carriesDirections) {
          const pieceEnd = piece.start.add(piece.dur);
          const lastPiece = piece === g.pieces.at(-1);
          for (const d of here.filter(
            (d) => d.at.gte(piece.start) && (d.at.lt(pieceEnd) || (isLast && lastPiece)),
          )) {
            const offset = d.at.gt(pieceEnd) ? piece.dur : d.at.sub(piece.start);
            out.push(direction(d, offset, divisions, staves));
          }
        }
        const note = piece.note;
        const start = note && lineStarts.get(note);
        if (start && !started.has(start.line)) {
          out.push(octaveShiftXml(start.line, "start", start.staff));
          started.add(start.line);
        }
        const pitches: (Spelled | undefined)[] =
          note && !inst.unpitched ? note.pitches : [undefined];
        const down = (note && lowered.get(note)) ?? 0;
        pitches.forEach((p, pi) =>
          out.push(
            noteXml(piece, p, pi > 0, g.voice, g.staff, staves, divisions, inst, acc, slur, down),
          ),
        );
        const stop = note && !piece.tieToNext && lineStops.get(note);
        if (stop) out.push(octaveShiftXml(stop.line, "stop", stop.staff));
      }
    });
    out.push("</measure>");
  });
  out.push("</part>");
  if (slur.open && span.last === score.measures.length - 1)
    warnings.push(`part "${part.id}": a slur runs past the last note`);
  return out.join("\n");
}

function partList(score: NormalScore): string {
  const out: string[] = ["<part-list>"];
  let group = 0;
  score.parts.forEach((p, i) => {
    const prev = score.parts[i - 1];
    const next = score.parts[i + 1];
    const family = p.instrument.family;
    if (prev?.instrument.family !== family && next?.instrument.family === family) {
      group++;
      out.push(
        `<part-group type="start" number="${group}"><group-symbol>bracket</group-symbol><group-barline>yes</group-barline></part-group>`,
      );
    }
    out.push(
      `<score-part id="P${i + 1}"><part-name>${esc(p.name)}</part-name><part-abbreviation>${esc(p.abbreviation)}</part-abbreviation></score-part>`,
    );
    if (prev?.instrument.family === family && next?.instrument.family !== family) {
      out.push(`<part-group type="stop" number="${group}"/>`);
    }
  });
  out.push("</part-list>");
  return out.join("\n");
}

export function toMusicXml(input: Score): NotationResult {
  return musicXmlOf(normalize(input));
}

export function musicXmlOf(
  score: NormalScore,
  span: Span = { first: 0, last: score.measures.length - 1 },
): NotationResult {
  const warnings = [...score.warnings];
  const parts = score.parts.map((p, i) => partXml(p, i, score, warnings, span));
  const musicxml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    // Only the first document carries the title (a long score is drawn as many).
    ...(span.first === 0 ? [`<work><work-title>${esc(score.title)}</work-title></work>`] : []),
    partList(score),
    ...parts,
    "</score-partwise>",
  ].join("\n");
  return { musicxml, warnings };
}

/** A stretch of measures written as its own MusicXML document, for drawing a long score in pieces. */
export interface NotationWindow {
  /** Measure numbers (1-based, inclusive). */
  from: number;
  to: number;
  musicxml: string;
}

/**
 * The score as short documents of up to `size` measures, and fewer where the music is dense
 * (a document stays under about `notes` notes, so none takes long to draw). Documents restart at
 * every rehearsal mark and meter change, so an edit moves as few boundaries as possible. Each one
 * repeats what is in force at its start (dynamics, technique, tempo).
 */
export function musicXmlWindows(
  score: NormalScore,
  size = 4,
  notes = 600,
): { windows: NotationWindow[]; warnings: string[] } {
  const breaks = new Set<number>(score.rehearsal.map((r) => r.measure));
  score.measures.forEach((m, i) => {
    const prev = score.measures[i - 1];
    if (prev && (prev.beats !== m.beats || prev.beatType !== m.beatType)) breaks.add(m.number);
  });
  // Notes starting in each measure, over all parts.
  const starts = score.measures.map((m) => m.start.value);
  const count = Array.from({ length: score.measures.length }, () => 0);
  for (const p of score.parts)
    for (const n of p.notes) {
      let i = starts.length - 1;
      while (i > 0 && starts[i]! > n.at.value) i--;
      count[i]! += Math.max(1, n.pitches.length);
    }
  const spans: Span[] = [];
  let first = 0;
  let inWindow = count[0] ?? 0;
  for (let i = 1; i <= score.measures.length; i++) {
    const m = score.measures[i];
    if (!m || i - first >= size || breaks.has(m.number) || inWindow + count[i]! > notes) {
      spans.push({ first, last: i - 1 });
      first = i;
      inWindow = 0;
    }
    inWindow += count[i] ?? 0;
  }
  const warnings = new Set<string>();
  const windows = spans.map((span) => {
    const { musicxml, warnings: w } = musicXmlOf(score, span);
    for (const x of w) warnings.add(x);
    return {
      from: score.measures[span.first]!.number,
      to: score.measures[span.last]!.number,
      musicxml,
    };
  });
  return { windows, warnings: [...warnings] };
}

// Score → MusicXML 4.0 (partwise). The same file feeds the Verovio preview and Sibelius.
// Quarter tones are written as fractional <alter> (docs/decisions/0011-quarter-tone-notation.md);
// <accidental> is computed here because Verovio draws only what it is given.

import type { Instrument } from "../instruments/catalog.ts";
import { techniqueOf } from "../instruments/techniques.ts";
import { normalize, type Note, type NormalPart, type NormalScore } from "../score/normalize.ts";
import { accidentalName, spell, type Spelled } from "../score/pitch.ts";
import { lcm, Rational } from "../score/rational.ts";
import type { Measure } from "../score/timeline.ts";
import type { Score } from "../score/types.ts";
import { layoutOf, type Layout, type Staff } from "./layout.ts";
import { registersOf, type Ottava, type StaffRegisters } from "./registers.ts";
import { layoutMeasure, type Piece } from "./rhythm.ts";

const writtenCache = new WeakMap<NormalScore, NormalScore>();
/**
 * The score as it is written: an artificial harmonic (technique "artificial-harmonic", its pitch
 * the one that sounds) becomes the stopped note two octaves below and the touched note a perfect
 * fourth above that, whose node sounds the fourth partial. Worked out once per score.
 */
function writtenHarmonics(score: NormalScore): NormalScore {
  let w = writtenCache.get(score);
  if (!w) {
    let changed = false;
    const parts = score.parts.map((p) => {
      if (!p.notes.some((n) => n.technique.includes("artificial-harmonic"))) return p;
      changed = true;
      return {
        ...p,
        notes: p.notes.map((n) =>
          n.technique.includes("artificial-harmonic") && n.pitches.length === 1
            ? {
                ...n,
                pitches: [spell(n.pitches[0]!.midi - 24), spell(n.pitches[0]!.midi - 19)],
                touching: true,
              }
            : n,
        ),
      };
    });
    w = changed ? { ...score, parts } : score;
    writtenCache.set(score, w);
    writtenCache.set(w, w);
  }
  return w;
}

const layoutCache = new WeakMap<NormalScore, Layout>();
/** The score's staves (src/notation/layout.ts), worked out once per score. */
export function layoutFor(score: NormalScore): Layout {
  let l = layoutCache.get(score);
  if (!l) {
    l = layoutOf(score);
    layoutCache.set(score, l);
  }
  return l;
}

/** Staves of the full score, grand staves counting two. */
export const staffCount = (score: NormalScore) =>
  layoutFor(score).staves.reduce((n, s) => n + s.instrument.clefs.length, 0);

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
  // A hairpin that repeats the last one of its kind (the same marks at both ends, niente
  // included) within half a bar of it is written without its marks: a pattern once written is
  // played on, as engravers leave it (a mark comes back when it changes, or after a rest). Not
  // when the level it starts from was left elsewhere (a subito change keeps its mark).
  const lastOfKind: Partial<Record<Wedge["type"], { from: string; to: string; end: Rational }>> =
    {};
  const named = (level: number) => (level < 0.5 ? "n" : markFor(level));
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const next = points[i + 1];
    const cameByWedge =
      i > 0 && points[i - 1]!.to === "linear" && Math.abs(p.level - points[i - 1]!.level) >= 0.5;
    const wedge = p.to === "linear" && next && Math.abs(next.level - p.level) >= 0.5 ? next : null;
    const type = wedge && wedge.level > p.level ? "crescendo" : "diminuendo";
    const from = named(p.level);
    const to = wedge ? named(wedge.level) : "";
    const before = lastOfKind[type];
    const again =
      wedge !== null &&
      before !== undefined &&
      before.from === from &&
      before.to === to &&
      p.at.sub(before.end).value <= 2 &&
      (from === "n" || last === "n" || last === from || cameByWedge);
    if (!cameByWedge && !(p.to === "linear" && next && p.level < 0.5)) {
      if (again) last = from;
      else show(p.at, p.level);
    }
    if (wedge) {
      wedges.push({
        start: p.at,
        end: wedge.at,
        type,
        nienteStart: p.level < 0.5,
        nienteEnd: wedge.level < 0.5,
      });
      if (wedge.level < 0.5) last = "n";
      else if (again) last = to;
      else show(wedge.at, wedge.level, true);
      lastOfKind[type] = { from, to, end: wedge.at };
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
/** A note's staff position (diatonic steps, first pitch) as written, under any octave line. */
function stepOf(n: Note, inst: Instrument, lowered: number): number {
  const w = written(n.pitches[0]!, inst);
  return (w.octave - lowered) * 7 + "CDEFGAB".indexOf(w.step);
}

export function written(p: Spelled, inst: Instrument): Spelled {
  const shift = inst.writtenOctave ?? 0;
  return { ...p, octave: p.octave + shift, midi: p.midi + 12 * shift };
}

class AccidentalState {
  private seen = new Map<string, number>();
  /** "note": every note shows its accidental, naturals too; "bar": the usual rule (Score.accidentals). */
  private readonly rule: "note" | "bar";
  constructor(rule: "note" | "bar" = "bar") {
    this.rule = rule;
  }
  reset(): void {
    this.seen.clear();
  }
  /**
   * Returns the accidental to print, or undefined if none is needed: a tied note, a note repeating
   * the one before it in its voice ("note"), or one the measure's state already implies ("bar").
   */
  next(p: Spelled, tied: boolean, repeated = false): string | undefined {
    // No key signature: a step starts the measure natural.
    const key = `${p.step}${p.octave}`;
    const previous = this.seen.get(key) ?? 0;
    this.seen.set(key, p.alter);
    if (tied) return undefined;
    if (this.rule === "note") return repeated ? undefined : accidentalName(p.alter);
    if (previous === p.alter) return undefined;
    return accidentalName(p.alter);
  }
}

/** What partXml decided for one note element, besides its piece. */
interface NoteMarks {
  /** The element's id (strip documents name their notes, so seams can point at them). */
  id?: string;
  slurStart: boolean;
  slurStop: boolean;
  /** A glissando line starts here, or ends here (both within this document). */
  glissStart?: boolean;
  glissStop?: boolean;
  /** Ties over the document's first or last barline, left to the seam (see Seam). */
  cutTieIn: boolean;
  cutTieOut: boolean;
  /** Octaves an octave line draws the note lower (8va 1, 8vb −1). */
  lowered: number;
  /** A colour for the whole note (preview only: see NoteFlag). */
  color?: string;
  /** Two players on one staff, both playing in the measure: the first stems up, the second down. */
  stem?: "up" | "down";
  /** A rest not printed (the silent player's, on a staff where only the other plays). */
  hidden?: boolean;
  /** The note repeats the one before it in its voice (no accidental under the "note" rule). */
  repeated?: boolean;
  /** An artificial harmonic's stopped note (base) or touched note (touch: a diamond head; no circle). */
  harmonic?: "base" | "touch";
  /** A fermata over the note or rest (Score.fermatas). */
  fermata?: boolean;
}

/**
 * A colour for a note the preview should point out (a pitch out of range, say), or none.
 * Only strip documents use it: what goes to Sibelius is never coloured.
 */
export type NoteFlag = (part: NormalPart, midi: number) => string | undefined;

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
  marks: NoteMarks,
): string {
  const n = piece.note;
  const tieStop = piece.tieFromPrevious && !marks.cutTieIn;
  const tieStart = piece.tieToNext && !marks.cutTieOut;
  const attrs = `${marks.id ? ` id="${marks.id}"` : ""}${marks.color ? ` color="${marks.color}"` : ""}${marks.hidden && !n ? ' print-object="no"' : ""}`;
  const out: string[] = [`<note${attrs}>`];
  if (chord) out.push("<chord/>");
  if (!n) {
    out.push(piece.measureRest ? '<rest measure="yes"/>' : "<rest/>");
  } else if (inst.unpitched) {
    // A one-line staff's line is E4 for both Verovio and Sibelius (Sibelius drew B4 two spaces
    // above it: docs/research/score-layout/import-test.md).
    const [step, octave] = ["E", 4];
    out.push(
      `<unpitched><display-step>${step}</display-step><display-octave>${octave}</display-octave></unpitched>`,
    );
  } else {
    const w = written(pitch!, inst);
    out.push(
      `<pitch><step>${w.step}</step>${w.alter ? `<alter>${w.alter}</alter>` : ""}<octave>${w.octave}</octave></pitch>`,
    );
  }
  out.push(`<duration>${piece.dur.mul(new Rational(divisions)).value}</duration>`);
  if (tieStop) out.push('<tie type="stop"/>');
  if (tieStart) out.push('<tie type="start"/>');
  out.push(`<voice>${voice}</voice>`);
  if (!piece.measureRest) out.push(`<type>${piece.type}</type>`);
  for (let i = 0; i < piece.dots; i++) out.push("<dot/>");
  if (n && pitch && !inst.unpitched) {
    const w = written(pitch, inst);
    const acc = accidentals.next(
      { ...w, octave: w.octave - marks.lowered },
      piece.tieFromPrevious,
      marks.repeated,
    );
    if (acc) out.push(`<accidental>${acc}</accidental>`);
  }
  if (piece.tuplet) {
    out.push(
      `<time-modification><actual-notes>${piece.tuplet.actual}</actual-notes><normal-notes>${piece.tuplet.normal}</normal-notes></time-modification>`,
    );
  }
  if (n && marks.stem) out.push(`<stem>${marks.stem}</stem>`);
  if (n && marks.harmonic === "touch") out.push("<notehead>diamond</notehead>");
  if (staves > 1) out.push(`<staff>${staff}</staff>`);
  // A feathered group's first beam carries the fan (accel: the beams spread out to the right).
  const fan = n?.feather?.first && !piece.tieFromPrevious ? ` fan="${n.feather.kind}"` : "";
  if (!chord)
    piece.beams.forEach(
      (b, i) =>
        b && out.push(`<beam number="${i + 1}"${i === 0 && b === "begin" ? fan : ""}>${b}</beam>`),
    );

  const notations: string[] = [];
  if (tieStop) notations.push('<tied type="stop"/>');
  if (tieStart) notations.push('<tied type="start"/>');
  if (!chord && piece.tuplet?.first) notations.push('<tuplet type="start" bracket="yes"/>');
  if (!chord && piece.tuplet?.last) notations.push('<tuplet type="stop"/>');
  if (!chord && marks.fermata && !marks.hidden) notations.push('<fermata type="upright"/>');
  if (n && !chord) {
    const firstPiece = !piece.tieFromPrevious;
    if (marks.slurStop) notations.push('<slur type="stop" number="1"/>');
    if (marks.slurStart) notations.push('<slur type="start" number="1"/>');
    if (marks.glissStop) notations.push('<glissando type="stop" number="1"/>');
    if (marks.glissStart) notations.push('<glissando type="start" number="1" line-type="solid"/>');
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
  /** Dynamics written above the staff (Staff.dynamicsAbove). */
  above: { marks: Mark[]; wedges: Wedge[] };
  changes: { at: Rational; text: string }[];
  voicesByStaff: Map<number, Set<number>>;
  /** Longest note, to find notes sounding into a span without scanning them all. */
  longest: number;
  /** The next note of the same staff and voice: a slur from a note ends there. */
  next: Map<Note, Note>;
  /** The note before, in the same staff and voice. */
  previous: Map<Note, Note>;
  /** The notes of each staff and voice (key (staff − 1) × 4 + voice), by onset. */
  byVoice: Map<number, Note[]>;
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
    const byVoice = new Map<number, Note[]>();
    for (const n of part.notes) {
      const key = (n.staff - 1) * 4 + n.voice;
      if (!byVoice.has(key)) byVoice.set(key, []);
      byVoice.get(key)!.push(n);
    }
    const next = new Map<Note, Note>();
    const previous = new Map<Note, Note>();
    for (const notes of byVoice.values())
      for (let i = 0; i + 1 < notes.length; i++) {
        next.set(notes[i]!, notes[i + 1]!);
        previous.set(notes[i + 1]!, notes[i]!);
      }
    const above = (part as Partial<Staff>).dynamicsAbove;
    f = {
      ...dynamicMarks(part),
      above: above?.length ? dynamicMarks({ ...part, dynamics: above }) : { marks: [], wedges: [] },
      changes: techniqueChanges(part),
      voicesByStaff,
      longest: Math.max(0, ...part.notes.map((n) => n.dur.value)),
      next,
      previous,
      byVoice,
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

/** A note at one end of a tie or slur that crosses a strip document's barline. */
export interface SeamEnd {
  /** The note element's id in the document. */
  note: string;
  /** Staff in the whole score, from 1 (as Verovio numbers them). */
  staff: number;
}

/** A glissando crossing the barline: its note here, and how many staff steps the other end is above it. */
export interface SeamGliss extends SeamEnd {
  steps: number;
}

/**
 * Marks that cross the barlines of a strip document (see stripMeasures). MusicXML cannot draw a
 * tie or slur whose other end is in another document, so they are left out of it and listed
 * here; the engraver draws them from the barline (src/preview/engrave-thread.ts).
 */
export interface Seam {
  /** MEI time stamp of the closing barline: beats + 1. */
  barline: number;
  tiesIn: SeamEnd[];
  tiesOut: SeamEnd[];
  slursIn: SeamEnd[];
  slursOut: SeamEnd[];
  glissIn: SeamGliss[];
  glissOut: SeamGliss[];
  /** Octave lines of each staff, in order: whether each comes in from before or runs on after. */
  octaves: { staff: number; in: boolean; out: boolean }[];
  /** Hairpins cut at a barline: how open each end is here, as a share of the full opening. */
  hairpins: { id: string; start: number; end: number; in: boolean; out: boolean }[];
}

const emptySeam = (barline: number): Seam => ({
  barline,
  tiesIn: [],
  tiesOut: [],
  slursIn: [],
  slursOut: [],
  glissIn: [],
  glissOut: [],
  octaves: [],
  hairpins: [],
});

function partXml(
  part: Staff,
  index: number,
  score: NormalScore,
  warnings: string[],
  span: Span,
  /** A strip document (see stripMeasures): what crosses its barlines goes here, not into the XML. */
  seam?: Seam,
  /** Staves of the parts before this one, to number staves in the whole score. */
  staffOffset = 0,
  flag?: NoteFlag,
): string {
  const strip = seam !== undefined;
  const inst = part.instrument;
  const fermataAt = (t: Rational) => score.fermatas.some((f) => f.eq(t));
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
  // A strip document always closes them (a line left open is not drawn) and tells the seam.
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
      const endsHere = last === line.notes.at(-1) && last.end.lte(spanEnd);
      if (endsHere || strip) lineStops.set(last, { line, staff: i + 1 });
      seam?.octaves.push({
        staff: staffOffset + i + 1,
        in: here[0] !== line.notes[0] || here[0]!.at.lt(spanStart),
        out: !endsHere,
      });
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
  // (dynamic, technique, tempo), and hairpins crossing its edges are cut at them. A strip
  // document repeats nothing: it is read after the one before it.
  const restate = !whole && !strip;
  const directions: Direction[] = [];
  const firstNote = notesInSpan.find((n) => n.at.gte(spanStart));
  // Dynamics below the staff, and a second row above it (Staff.dynamicsAbove: the first of two
  // players on one staff, where their dynamics differ). Each row's hairpins get their own number.
  const rows = [
    { ...known, placement: "below" as const, prefix: "h", number: 1 },
    { ...known.above, placement: "above" as const, prefix: "ha", number: 2 },
  ];
  for (const row of rows) {
    const marks = [...row.marks];
    const wedges = row.wedges;
    const inWedge = (at: Rational) => wedges.some((w) => w.start.lt(at) && w.end.gt(at));
    if (restate && firstNote && !marks.some((m) => m.at.eq(spanStart)) && !inWedge(spanStart)) {
      const before = marks.filter((m) => m.at.lt(spanStart)).at(-1);
      if (before) marks.push({ at: firstNote.at, mark: before.mark });
    }
    for (const m of marks) {
      if (!inSpan(m.at)) continue;
      const inner = m.mark === "n" ? "<other-dynamics>n</other-dynamics>" : `<${m.mark}/>`;
      directions.push({
        at: m.at,
        staff: 1,
        placement: row.placement,
        xml: `<dynamics>${inner}</dynamics>`,
      });
    }
    wedges.forEach((w, k) => {
      if (w.end.lte(spanStart) || w.start.gte(spanEnd)) return;
      const start = w.start.lt(spanStart) ? spanStart : w.start;
      // A hairpin running past the end stops at the last barline (see isLast below).
      const end = w.end.gt(spanEnd) ? spanEnd : w.end;
      const cut = start !== w.start || end !== w.end;
      const name = `${row.prefix}${index + 1}-${k}`;
      const id = strip && cut ? ` id="${name}"` : "";
      if (strip && cut) {
        const share = (t: Rational) => t.sub(w.start).value / w.end.sub(w.start).value;
        const open = (f: number) => (w.type === "crescendo" ? f : 1 - f);
        seam!.hairpins.push({
          id: name,
          start: open(share(start)),
          end: open(share(end)),
          in: start !== w.start,
          out: end !== w.end,
        });
      }
      const number = row.number > 1 ? ` number="${row.number}"` : "";
      directions.push({
        at: start,
        staff: 1,
        placement: row.placement,
        xml: `<wedge type="${w.type}"${number}${id}${w.nienteStart && start === w.start ? ' niente="yes"' : ""}/>`,
      });
      directions.push({
        at: end,
        staff: 1,
        placement: row.placement,
        xml: `<wedge type="stop"${number}${w.nienteEnd && end === w.end ? ' niente="yes"' : ""}/>`,
      });
    });
  }
  const changes = [...known.changes];
  if (restate && firstNote && !changes.some((c) => c.at.eq(firstNote.at))) {
    const before = changes.filter((c) => c.at.lt(spanStart)).at(-1);
    const cancel = (t: string) => t === "ord." || t === "arco" || t.startsWith("senza");
    if (before && !cancel(before.text) && firstNote.technique.length)
      changes.push({ at: firstNote.at, text: before.text });
  }
  // Texts above the staff at one moment go into one: a player label and a technique
  // ("1. senza vib.") would otherwise print on top of each other.
  const words = new Map<string, { at: Rational; placement: "above" | "below"; texts: string[] }>();
  const say = (at: Rational, placement: "above" | "below", text: string) => {
    const key = `${at.toString()} ${placement}`;
    const w = words.get(key) ?? { at, placement, texts: [] };
    // A player or divisi label leads ("1. senza vib.", "div. pizz.").
    const label = /^(a \d|\d\.|div\.( a \d+)?|unis\.)$/.test(text);
    if (!w.texts.includes(text)) w.texts[label ? "unshift" : "push"](text);
    words.set(key, w);
  };
  for (const t of part.texts) if (inSpan(t.at)) say(t.at, t.placement, t.text);
  for (const t of changes) if (inSpan(t.at)) say(t.at, "above", t.text);
  for (const w of words.values())
    directions.push({
      at: w.at,
      staff: 1,
      placement: w.placement,
      xml: `<words>${esc(w.texts.join(" "))}</words>`,
    });
  if (index === 0) {
    const tempos = score.tempoMarks.filter((t) => inSpan(t.at));
    // Verovio times the notes from the tempo in the document, so it must know it at the start.
    // (The strip times notes in quarters, not by Verovio's clock.)
    if (!strip && !tempos.some((t) => t.at.eq(spanStart))) {
      const before = score.tempoMarks.filter((t) => t.at.lt(spanStart)).at(-1);
      if (before) tempos.unshift({ ...before, at: spanStart });
    }
    for (const t of tempos) {
      directions.push({
        sound: `tempo="${(t.bpm * t.beat.value).toFixed(2)}"`,
        at: t.at,
        staff: 1,
        placement: "above",
        xml: `${t.text ? `<words font-weight="bold">${esc(t.text)} </words></direction-type><direction-type>` : ""}<metronome>${beatUnit(t.beat)}<per-minute>${t.bpm}</per-minute></metronome>${t.change ? `</direction-type><direction-type><words font-style="italic"> ${t.change}</words>` : ""}`,
      });
    }
  }

  // Slurs, per staff and voice: a note's slur runs to the next note of its voice. In a strip
  // document, one that came in over the first barline, or goes out over the last, is the seam's.
  const slurOpen = new Map<number, boolean>();
  const slurCameIn = new Set<number>();
  if (strip)
    for (const [key, notes] of known.byVoice) {
      let before: Note | undefined;
      for (const n of notes) {
        if (n.at.gte(spanStart)) break;
        before = n;
      }
      const next = before && known.next.get(before);
      if (before?.slur && before.end.lte(spanStart) && next && inSpan(next.at)) {
        slurOpen.set(key, true);
        slurCameIn.add(key);
      }
    }

  const out: string[] = [`<part id="P${index + 1}">`];
  let previousMeter = "";
  measures.forEach((m: Measure, mi) => {
    const at = span.first + mi;
    // A strip document is numbered from 1, so it reads the same wherever the measure is.
    out.push(`<measure number="${strip ? mi + 1 : m.number}">`);
    const meter = `${m.beats}/${m.beatType}`;
    const attrs: string[] = [];
    // An empty key is the only one Sibelius reads as open (no key signature even when transposed).
    if (mi === 0) attrs.push(`<divisions>${divisions}</divisions><key/>`);
    if (meter !== previousMeter) {
      // A strip shows a time signature only where the meter changes.
      const before = score.measures[at - 1];
      const hidden = strip && mi === 0 && before && `${before.beats}/${before.beatType}` === meter;
      attrs.push(
        `<time${hidden ? ' print-object="no"' : ""}><beats>${m.beats}</beats><beat-type>${m.beatType}</beat-type></time>`,
      );
    }
    if (mi === 0 && staves > 1) attrs.push(`<staves>${staves}</staves>`);
    registers.forEach((r, i) => {
      // Every document states its clefs; later measures only where the clef changes. A strip
      // shows them only where they change (its left margin shows the clefs in force).
      const changed = at > 0 && r.clefs[at] !== r.clefs[at - 1];
      if (mi === 0 || changed) {
        const xml = clefXml(r.clefs[at]!, i + 1, staves);
        attrs.push(strip && !changed ? xml.replace("<clef", '<clef print-object="no"') : xml);
      }
    });
    if (mi === 0 && inst.unpitched)
      attrs.push("<staff-details><staff-lines>1</staff-lines></staff-details>");
    // A score in C still writes some instruments an octave or two off (docs/decisions/0017):
    // MusicXML says so, or Sibelius takes the written pitch for the sounding one.
    if (mi === 0 && inst.writtenOctave)
      attrs.push(
        `<transpose><diatonic>0</diatonic><chromatic>0</chromatic><octave-change>${-inst.writtenOctave}</octave-change></transpose>`,
      );
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
    // Two players on one staff (Staff.stems): where both play in the measure, stems show who is
    // who; where only the second plays, the first's measure rest is not printed.
    const plays = (voice: number) =>
      groups.some((x) => x.staff === 1 && x.voice === voice && x.pieces.some((p) => p.note));
    const both = part.stems && plays(1) && plays(2);
    const secondAlone = part.stems && !plays(1) && plays(2);
    // Where both players rest at once, one rest says so: the second's is not printed.
    const firstRests = both
      ? groups
          .find((x) => x.staff === 1 && x.voice === 1)!
          .pieces.filter((p) => !p.note)
          .map((p) => [p.start, p.start.add(p.dur)] as const)
      : [];
    const bothRest = (piece: Piece) => {
      let t = piece.start;
      const end = piece.start.add(piece.dur);
      for (const [a, b] of firstRests) if (a.lte(t) && b.gt(t)) t = b;
      return t.gte(end);
    };
    groups.forEach((g, gi) => {
      if (gi > 0)
        out.push(
          `<backup><duration>${m.length.mul(new Rational(divisions)).value}</duration></backup>`,
        );
      const acc = accidentals.get(g.staff) ?? new AccidentalState(score.accidentals);
      accidentals.set(g.staff, acc);
      const carriesDirections = gi === groups.findIndex((x) => x.staff === 1);
      const staffNumber = staffOffset + g.staff;
      g.pieces.forEach((piece, k) => {
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
        const id = (pi: number) =>
          strip ? `n${index + 1}-${mi + 1}-${g.voice}-${k}-${pi}` : undefined;
        const cutTieIn = strip && piece.tieFromPrevious && piece.start.eq(spanStart);
        const cutTieOut = strip && piece.tieToNext && piece.start.add(piece.dur).eq(spanEnd);
        // Slur ends: only on notes (not rests), and on the first element of a chord.
        let slurStop = false;
        let slurStart = false;
        if (note && !piece.tieFromPrevious && slurOpen.get(g.voice)) {
          if (slurCameIn.has(g.voice)) seam!.slursIn.push({ note: id(0)!, staff: staffNumber });
          else slurStop = true;
          slurOpen.set(g.voice, false);
          slurCameIn.delete(g.voice);
        }
        if (note?.slur && !piece.tieToNext) {
          const next = known.next.get(note);
          if (strip && !(next && next.at.lt(spanEnd)))
            seam!.slursOut.push({ note: id(0)!, staff: staffNumber });
          else slurStart = true;
          slurOpen.set(g.voice, true);
        }
        // Glissandi: from a note's last piece to the next note's first. One that crosses this
        // document's barline is the seam's, with the distance to its other end in staff steps.
        const down = (note && lowered.get(note)) ?? 0;
        const steps = (from: Note, to: Note) =>
          stepOf(to, inst, lowered.get(to) ?? 0) - stepOf(from, inst, lowered.get(from) ?? 0);
        let glissStart = false;
        let glissStop = false;
        const target = note?.gliss && !inst.unpitched ? known.next.get(note) : undefined;
        if (note && target && !piece.tieToNext) {
          if (strip && !target.at.lt(spanEnd))
            seam!.glissOut.push({ note: id(0)!, staff: staffNumber, steps: steps(note, target) });
          else glissStart = true;
        }
        const source = note && !inst.unpitched ? known.previous.get(note) : undefined;
        if (note && source?.gliss && !piece.tieFromPrevious) {
          if (strip && source.end.lte(spanStart))
            seam!.glissIn.push({ note: id(0)!, staff: staffNumber, steps: steps(note, source) });
          else glissStop = true;
        }
        const pitches: (Spelled | undefined)[] =
          note && !inst.unpitched ? note.pitches : [undefined];
        // A note repeating the one just before it in its voice needs no accidental ("note" rule).
        const before = g.pieces[k - 1]?.note;
        const repeated =
          note !== undefined &&
          before !== undefined &&
          before !== note &&
          before.pitches.length === note.pitches.length &&
          before.pitches.every(
            (q, i) =>
              q.step === note.pitches[i]!.step &&
              q.alter === note.pitches[i]!.alter &&
              q.octave === note.pitches[i]!.octave,
          );
        pitches.forEach((p, pi) => {
          if (note && cutTieIn) seam!.tiesIn.push({ note: id(pi)!, staff: staffNumber });
          if (note && cutTieOut) seam!.tiesOut.push({ note: id(pi)!, staff: staffNumber });
          out.push(
            noteXml(piece, p, pi > 0, g.voice, g.staff, staves, divisions, inst, acc, {
              id: note ? id(pi) : undefined,
              stem:
                both && g.staff === 1 && g.voice <= 2 ? (g.voice === 1 ? "up" : "down") : undefined,
              hidden:
                (secondAlone && g.voice === 1 && piece.measureRest) ||
                (both && g.staff === 1 && g.voice === 2 && !note && bothRest(piece)),
              repeated,
              slurStart: pi === 0 && slurStart,
              slurStop: pi === 0 && slurStop,
              glissStart: pi === 0 && glissStart,
              glissStop: pi === 0 && glissStop,
              cutTieIn,
              cutTieOut,
              lowered: down,
              color: p && flag ? flag(part, p.midi) : undefined,
              harmonic: note?.touching ? (pi === 0 ? "base" : "touch") : undefined,
              fermata: pi === 0 && !piece.tieFromPrevious && fermataAt(piece.start),
            }),
          );
        });
        // A line stops after the last piece of its last note here; a strip document stops it at
        // the barline even when that note is tied on past it.
        const lastHere = !piece.tieToNext || (strip && piece.start.add(piece.dur).eq(spanEnd));
        const stop = note && lastHere ? lineStops.get(note) : undefined;
        if (stop) {
          out.push(octaveShiftXml(stop.line, "stop", stop.staff));
          lineStops.delete(note!);
        }
      });
    });
    out.push("</measure>");
  });
  out.push("</part>");
  if (!strip && [...slurOpen.values()].some(Boolean) && span.last === score.measures.length - 1)
    warnings.push(`part "${part.id}": a slur runs past the last note`);
  return out.join("\n");
}

/**
 * A staff name as MusicXML carries it: plain ASCII in the name ("Clarinet in Bb"), and, when it has
 * a ♭ or ♯, a display form that draws the sign in the music font (the form Sibelius imports).
 */
function nameXml(tag: "part-name" | "part-abbreviation", name: string, hide: string): string {
  const signs: Record<string, [string, string]> = { "♭": ["b", "flat"], "♯": ["#", "sharp"] };
  const plain = name.replace(/[♭♯]/g, (s) => signs[s]![0]);
  const out = `<${tag}${hide}>${esc(plain)}</${tag}>`;
  if (plain === name) return out;
  const display = name
    .split(/([♭♯])/)
    .filter(Boolean)
    .map((piece) =>
      signs[piece]
        ? `<accidental-text>${signs[piece]![1]}</accidental-text>`
        : `<display-text>${esc(piece)}</display-text>`,
    )
    .join("");
  return `${out}<${tag}-display>${display}</${tag}-display>`;
}

function partList(layout: Layout, strip: boolean): string {
  const out: string[] = ["<part-list>"];
  // The strip's names are drawn once, in its left margin.
  const hide = strip ? ' print-object="no"' : "";
  // Families take group numbers 1, 2 …; their sub-brackets nest inside with the next number.
  const numbers = new Map<(typeof layout.groups)[number], number>();
  layout.staves.forEach((p, i) => {
    for (const g of layout.groups.filter((x) => x.first === i)) {
      const number = 1 + layout.groups.filter((x) => numbers.has(x) && x.last >= i).length;
      numbers.set(g, number);
      out.push(
        `<part-group type="start" number="${number}"><group-symbol>${g.symbol}</group-symbol><group-barline>${g.barline ? "yes" : "no"}</group-barline></part-group>`,
      );
    }
    const identity = p.instrument.sibelius;
    const instrument = identity
      ? `<score-instrument id="P${i + 1}-I1"><instrument-name>${esc(identity.name)}</instrument-name><instrument-sound>${identity.sound}</instrument-sound></score-instrument>`
      : "";
    out.push(
      `<score-part id="P${i + 1}">${nameXml("part-name", p.name, hide)}${nameXml("part-abbreviation", p.abbreviation, hide)}${instrument}</score-part>`,
    );
    const closing = layout.groups.filter((x) => x.last === i).sort((a, b) => b.first - a.first);
    for (const g of closing) {
      out.push(`<part-group type="stop" number="${numbers.get(g)}"/>`);
      numbers.delete(g);
    }
  });
  out.push("</part-list>");
  return out.join("\n");
}

/**
 * The page for Sibelius (docs/decisions/0021): A2 portrait, 6 mm staves, 30 mm margins. Printed on
 * A3 it shrinks to 71% (4.2 mm staves, 21 mm margins) with the same systems and pages.
 */
const staffMm = 6;
const tenths = (mm: number) => Math.round((mm * 40) / staffMm);
const page =
  `<defaults><scaling><millimeters>${staffMm}</millimeters><tenths>40</tenths></scaling>` +
  `<page-layout><page-height>${tenths(594)}</page-height><page-width>${tenths(420)}</page-width>` +
  `<page-margins type="both"><left-margin>${tenths(30)}</left-margin><right-margin>${tenths(30)}</right-margin>` +
  `<top-margin>${tenths(30)}</top-margin><bottom-margin>${tenths(30)}</bottom-margin></page-margins></page-layout></defaults>` +
  `<credit page="1"><credit-words default-x="${tenths(30)}" default-y="${tenths(594 - 22)}" font-size="10" valign="top">Score in C</credit-words></credit>`;

/** The whole score as MusicXML for Sibelius: its staves, and the page (see `page`). */
export function toMusicXml(input: Score): NotationResult {
  const result = musicXmlOf(normalize(input));
  return { ...result, musicxml: result.musicxml.replace("<part-list>", `${page}\n<part-list>`) };
}

export function musicXmlOf(
  score: NormalScore,
  span: Span = { first: 0, last: score.measures.length - 1 },
  /** Write a strip document (see stripMeasures) and collect what crosses its barlines here. */
  seam?: Seam,
  /** Colours for notes to point out (strip documents only). */
  flag?: NoteFlag,
): NotationResult {
  score = writtenHarmonics(score);
  const warnings = [...score.warnings];
  const layout = layoutFor(score);
  let offset = 0;
  const parts = layout.staves.map((p, i) => {
    const xml = partXml(p, i, score, warnings, span, seam, offset, seam ? flag : undefined);
    offset += p.instrument.clefs.length;
    return xml;
  });
  const musicxml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    // Only the first document carries the title (a long score is drawn as many).
    ...(span.first === 0 && !seam
      ? [`<work><work-title>${esc(score.title)}</work-title></work>`]
      : []),
    partList(layout, seam !== undefined),
    ...parts,
    "</score-partwise>",
  ].join("\n");
  return { musicxml, warnings };
}

/** One measure of the score as its own MusicXML document, to be drawn as a piece of the strip. */
export interface StripMeasure {
  musicxml: string;
  seam: Seam;
  /** The margin in force at this measure (an index into the margins), for its clefs. */
  margin: number;
}

/**
 * The score as one document per measure, for the preview's strip (docs/decisions/0020): drawn one
 * by one and laid side by side, with nothing between them.
 *
 * - A document reads the same wherever its measure is: it is numbered 1, and states only what the
 *   measure itself holds. Clefs and the time signature are hidden unless they change at its first
 *   barline; names are hidden (the strip's margin shows names and clefs). Dynamics, techniques
 *   and tempo are not repeated.
 * - What crosses a barline is listed in its Seam instead: ties and slurs, octave lines (closed
 *   here, but marked as coming in or running on), and hairpins (how open they are at the cut).
 */
export function stripMeasures(
  score: NormalScore,
  /** Notes to colour in the preview (see NoteFlag). */
  flag?: NoteFlag,
): {
  measures: StripMeasure[];
  /** Left margins: one for each set of clefs in force somewhere in the score. */
  margins: string[];
  warnings: string[];
} {
  const warnings = new Set<string>(score.warnings);
  const margins: string[] = [];
  const marginOf = new Map<string, number>();
  const measures = score.measures.map((m, i) => {
    const seam = emptySeam(m.beats + 1);
    const { musicxml, warnings: w } = musicXmlOf(score, { first: i, last: i }, seam, flag);
    for (const x of w) warnings.add(x);
    const clefs = JSON.stringify(clefsAt(score, i));
    if (!marginOf.has(clefs)) {
      marginOf.set(clefs, margins.length);
      margins.push(stripMargin(score, i));
    }
    return { musicxml, seam, margin: marginOf.get(clefs)! };
  });
  return { measures, margins, warnings: [...warnings] };
}

/** The clefs in force at a measure, over all staves of the score (from the top). */
export function clefsAt(score: NormalScore, index: number): Instrument["clefs"] {
  score = writtenHarmonics(score);
  return layoutFor(score).staves.flatMap((p) => registersFor(p, score).map((r) => r.clefs[index]!));
}

/**
 * The strip's left margin for the clefs in force at a measure: names, brackets and clefs over an
 * empty measure, drawn with the same staff spacing as the measures so its staves meet theirs.
 */
export function stripMargin(score: NormalScore, index: number): string {
  score = writtenHarmonics(score);
  const m = score.measures[index]!;
  const duration = m.length.mul(new Rational(4)).value; // in 16ths: divisions 4
  const layout = layoutFor(score);
  const parts = layout.staves.map((p, i) => {
    const regs = registersFor(p, score);
    const staves = p.instrument.clefs.length;
    const attrs = [
      "<divisions>4</divisions><key/>",
      `<time print-object="no"><beats>${m.beats}</beats><beat-type>${m.beatType}</beat-type></time>`,
      staves > 1 ? `<staves>${staves}</staves>` : "",
      ...regs.map((r, s) => clefXml(r.clefs[index]!, s + 1, staves)),
      p.instrument.unpitched ? "<staff-details><staff-lines>1</staff-lines></staff-details>" : "",
    ];
    const rests = regs.map(
      (_, s) =>
        `${s > 0 ? `<backup><duration>${duration}</duration></backup>` : ""}<note print-object="no"><rest/><duration>${duration}</duration><voice>${s * 4 + 1}</voice>${staves > 1 ? `<staff>${s + 1}</staff>` : ""}</note>`,
    );
    return `<part id="P${i + 1}"><measure number="1"><attributes>${attrs.join("")}</attributes>${rests.join("")}</measure></part>`;
  });
  // The margin shows the short names.
  const named = { ...layout, staves: layout.staves.map((p) => ({ ...p, name: p.abbreviation })) };
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<score-partwise version="4.0">',
    partList(named, false),
    ...parts,
    "</score-partwise>",
  ].join("\n");
}

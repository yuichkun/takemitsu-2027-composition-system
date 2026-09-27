// Score → MusicXML 4.0 (partwise). The same file feeds the Verovio preview and Sibelius.
// Quarter tones are written as fractional <alter> (docs/decisions/0011-quarter-tone-notation.md);
// <accidental> is computed here because Verovio draws only what it is given.

import type { Instrument } from "../instruments/catalog.ts";
import { normalize, type NormalPart, type NormalScore } from "../score/normalize.ts";
import { accidentalName, type Spelled } from "../score/pitch.ts";
import { lcm, Rational } from "../score/rational.ts";
import type { Measure } from "../score/timeline.ts";
import type { Score } from "../score/types.ts";
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

const techniqueText: Record<string, [string, string]> = {
  // technique: [text when it starts, text when it ends]
  pizz: ["pizz.", "arco"],
  "col-legno": ["col legno batt.", "ord."],
  "sul-pont": ["sul pont.", "ord."],
  "sul-tasto": ["sul tasto", "ord."],
  flautando: ["flautando", "ord."],
  "con-sord": ["con sord.", "senza sord."],
  muted: ["con sord.", "senza sord."],
  cuivre: ["cuivré", "ord."],
  flutter: ["flz.", "ord."],
  multitongue: ["multitongue", "ord."],
  damped: ["damp", "l.v."],
  soft: ["soft sticks", "ord."],
  hotrods: ["hot rods", "ord."],
  "hard-sticks": ["hard sticks", "ord."],
  superball: ["superball", "ord."],
  bowed: ["bowed", "ord."],
  rimshot: ["rim shot", "ord."],
  "side-stick": ["side stick", "ord."],
  choke: ["choke", "l.v."],
  shake: ["shake", "ord."],
  crescendo: ["", ""],
  bisbigliando: ["bisb.", "ord."],
  gliss: ["gliss.", ""],
  long: ["long scrape", "ord."],
  sfz: ["", ""],
};
/** Techniques drawn on the note itself rather than as text. */
const tremoloTechniques = new Set(["tremolo", "roll", "flutter", "multitongue", "bisbigliando"]);

function techniqueChanges(part: NormalPart): { at: Rational; text: string }[] {
  const out: { at: Rational; text: string }[] = [];
  let active = new Set<string>();
  const starts = [...new Map(part.notes.map((n) => [n.at.toString(), n])).values()].sort((a, b) =>
    a.at.cmp(b.at),
  );
  for (const n of starts) {
    // Drawn on the note, not as text. Bartók pizz. still counts as pizz. (no "arco" before it).
    const now = new Set(
      n.technique
        .map((t) => (t === "bartok-pizz" ? "pizz" : t))
        .filter((t) => t !== "tremolo" && t !== "roll" && t !== "harmonic"),
    );
    const texts: string[] = [];
    for (const t of active) if (!now.has(t)) texts.push(techniqueText[t]?.[1] ?? "ord.");
    for (const t of now) if (!active.has(t)) texts.push(techniqueText[t]?.[0] ?? t);
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

function written(p: Spelled, inst: Instrument): Spelled {
  const shift = inst.writtenOctave ?? 0;
  return { ...p, octave: p.octave - shift, midi: p.midi - 12 * shift };
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
    const acc = accidentals.next(written(pitch, inst), piece.tieFromPrevious);
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
    if (n.technique.some((t) => tremoloTechniques.has(t)))
      ornaments.push('<tremolo type="single">3</tremolo>');
    if (n.trill && firstPiece) ornaments.push("<trill-mark/>");
    if (ornaments.length) notations.push(`<ornaments>${ornaments.join("")}</ornaments>`);
    const technical: string[] = [];
    if (n.technique.includes("harmonic")) technical.push("<harmonic><natural/></harmonic>");
    if (n.technique.includes("bartok-pizz") && firstPiece) technical.push("<snap-pizzicato/>");
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

function partXml(part: NormalPart, index: number, score: NormalScore, warnings: string[]): string {
  const inst = part.instrument;
  const staves = inst.clefs.length;
  const voicesByStaff = new Map<number, Set<number>>();
  for (const n of part.notes) {
    if (!voicesByStaff.has(n.staff)) voicesByStaff.set(n.staff, new Set());
    voicesByStaff.get(n.staff)!.add(n.voice);
  }
  for (let s = 1; s <= staves; s++) if (!voicesByStaff.has(s)) voicesByStaff.set(s, new Set([1]));

  // Lay out every measure first so divisions can cover all durations.
  const layouts = score.measures.map((m) => {
    const groups: { staff: number; voice: number; pieces: Piece[] }[] = [];
    for (const [staff, voices] of [...voicesByStaff.entries()].sort((a, b) => a[0] - b[0])) {
      for (const voice of [...voices].sort((a, b) => a - b)) {
        const notes = part.notes.filter(
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

  // Directions
  const directions: Direction[] = [];
  const { marks, wedges } = dynamicMarks(part);
  for (const m of marks) {
    const inner = m.mark === "n" ? "<other-dynamics>n</other-dynamics>" : `<${m.mark}/>`;
    directions.push({
      at: m.at,
      staff: 1,
      placement: "below",
      xml: `<dynamics>${inner}</dynamics>`,
    });
  }
  for (const w of wedges) {
    directions.push({
      at: w.start,
      staff: 1,
      placement: "below",
      xml: `<wedge type="${w.type}"${w.nienteStart ? ' niente="yes"' : ""}/>`,
    });
    directions.push({
      at: w.end,
      staff: 1,
      placement: "below",
      xml: `<wedge type="stop"${w.nienteEnd ? ' niente="yes"' : ""}/>`,
    });
  }
  for (const t of techniqueChanges(part))
    directions.push({
      at: t.at,
      staff: 1,
      placement: "above",
      xml: `<words>${esc(t.text)}</words>`,
    });
  for (const t of part.texts)
    directions.push({
      at: t.at,
      staff: 1,
      placement: t.placement,
      xml: `<words>${esc(t.text)}</words>`,
    });
  if (index === 0) {
    for (const t of score.tempoMarks) {
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
  score.measures.forEach((m: Measure, mi) => {
    out.push(`<measure number="${m.number}">`);
    const meter = `${m.beats}/${m.beatType}`;
    const attrs: string[] = [];
    if (mi === 0) attrs.push(`<divisions>${divisions}</divisions><key><fifths>0</fifths></key>`);
    if (meter !== previousMeter)
      attrs.push(`<time><beats>${m.beats}</beats><beat-type>${m.beatType}</beat-type></time>`);
    if (mi === 0) {
      if (staves > 1) attrs.push(`<staves>${staves}</staves>`);
      inst.clefs.forEach((c, i) => attrs.push(clefXml(c, i + 1, staves)));
      if (inst.unpitched) attrs.push("<staff-details><staff-lines>1</staff-lines></staff-details>");
    }
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
    const isLast = mi === score.measures.length - 1;
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
        const pitches: (Spelled | undefined)[] =
          piece.note && !inst.unpitched ? piece.note.pitches : [undefined];
        pitches.forEach((p, pi) =>
          out.push(noteXml(piece, p, pi > 0, g.voice, g.staff, staves, divisions, inst, acc, slur)),
        );
      }
    });
    out.push("</measure>");
  });
  out.push("</part>");
  if (slur.open) warnings.push(`part "${part.id}": a slur runs past the last note`);
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

export function musicXmlOf(score: NormalScore): NotationResult {
  const warnings = [...score.warnings];
  const parts = score.parts.map((p, i) => partXml(p, i, score, warnings));
  const musicxml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    `<work><work-title>${esc(score.title)}</work-title></work>`,
    partList(score),
    ...parts,
    "</score-partwise>",
  ].join("\n");
  return { musicxml, warnings };
}

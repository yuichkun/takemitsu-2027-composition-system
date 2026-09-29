// Test files for Sibelius's import of score layout (README.md in this folder). Each file asks
// one question about how Sibelius 24.3.1 reads a way of writing the full score in MusicXML, so
// the exporter (src/notation/musicxml.ts) can write what Sibelius keeps. Hand-built on purpose:
// they do not depend on the exporter, and each holds only what its question needs.
//
//   vp node verification/sibelius-layout/make.ts

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { toMusicXml } from "../../src/notation/musicxml.ts";
import type { Score } from "../../src/score/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "fixtures");

/** Divisions per quarter: 16ths (15), triplet 8ths (20) and quintuplet 16ths (12) are whole. */
const Q = 60;
const W = 4 * Q;
const types: Record<number, [string, boolean]> = {
  [W]: ["whole", false],
  [3 * Q]: ["half", true],
  [2 * Q]: ["half", false],
  [Q]: ["quarter", false],
  [Q / 2]: ["eighth", false],
  [Q / 4]: ["16th", false],
  [Q / 3]: ["eighth", false], // triplet eighth
  [Q / 5]: ["16th", false], // quintuplet sixteenth
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** "C5", "F#4", "Bb3", "C+5" (quarter sharp), "D-5" (quarter flat), "F#+4", "Bb-3". */
function pitchXml(p: string): string {
  const m = /^([A-G])(#\+|b-|#|b|\+|-)?(-?\d)$/.exec(p);
  if (!m) throw new Error(`bad pitch ${p}`);
  const alter = { "#+": 1.5, "b-": -1.5, "#": 1, b: -1, "+": 0.5, "-": -0.5 }[m[2] ?? ""] ?? 0;
  return `<pitch><step>${m[1]}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${m[3]}</octave></pitch>`;
}

interface NoteOptions {
  voice?: number;
  staff?: number;
  chord?: boolean;
  stem?: "up" | "down";
  /** An explicit <accidental>, e.g. "natural", and attributes for it, e.g. 'cautionary="yes"'. */
  accidental?: string;
  accidentalAttrs?: string;
  tuplet?: { actual: number; normal: number; start?: boolean; stop?: boolean };
  /** A rest that is there but not printed. */
  hidden?: boolean;
}

/** A note ("C5"), a chord (["C5", "E5"]) or a rest (undefined), `dur` in divisions. */
function note(pitch: string | string[] | undefined, dur: number, o: NoteOptions = {}): string {
  const pitches = Array.isArray(pitch) ? pitch : [pitch];
  return pitches
    .map((p, i) => {
      const [type, dot] = types[dur] ?? ["quarter", false];
      const parts = [`<note${o.hidden && !p ? ' print-object="no"' : ""}>`];
      if (i > 0 || o.chord) parts.push("<chord/>");
      parts.push(p ? pitchXml(p) : "<rest/>");
      parts.push(`<duration>${dur}</duration><voice>${o.voice ?? 1}</voice><type>${type}</type>`);
      if (dot) parts.push("<dot/>");
      if (p && o.accidental && i === 0)
        parts.push(
          `<accidental${o.accidentalAttrs ? ` ${o.accidentalAttrs}` : ""}>${o.accidental}</accidental>`,
        );
      if (o.tuplet)
        parts.push(
          `<time-modification><actual-notes>${o.tuplet.actual}</actual-notes><normal-notes>${o.tuplet.normal}</normal-notes></time-modification>`,
        );
      if (p && o.stem) parts.push(`<stem>${o.stem}</stem>`);
      if (o.staff) parts.push(`<staff>${o.staff}</staff>`);
      const notations: string[] = [];
      if (o.tuplet?.start && i === 0) notations.push('<tuplet type="start" bracket="yes"/>');
      if (o.tuplet?.stop && i === 0) notations.push('<tuplet type="stop"/>');
      if (notations.length) parts.push(`<notations>${notations.join("")}</notations>`);
      parts.push("</note>");
      return parts.join("");
    })
    .join("");
}

const wholeRest = (voice = 1, staff?: number) =>
  `<note><rest measure="yes"/><duration>${W}</duration><voice>${voice}</voice>${staff ? `<staff>${staff}</staff>` : ""}</note>`;
const backup = (dur = W) => `<backup><duration>${dur}</duration></backup>`;
const words = (text: string, placement: "above" | "below" = "above", staff?: number) =>
  `<direction placement="${placement}"><direction-type><words>${esc(text)}</words></direction-type>${staff ? `<staff>${staff}</staff>` : ""}</direction>`;
const dynamic = (mark: string, staff?: number) =>
  `<direction placement="below"><direction-type><dynamics><${mark}/></dynamics></direction-type>${staff ? `<staff>${staff}</staff>` : ""}</direction>`;
const quarters = (ps: string[], o: NoteOptions = {}) => ps.map((p) => note(p, Q, o)).join("");

interface PartSpec {
  name: string;
  abbreviation: string;
  /** Extra display forms (a ♭ drawn in the music font), written as MusicXML. */
  nameDisplay?: string;
  abbreviationDisplay?: string;
  /** Sibelius's name for its instrument type, and the MusicXML standard sound. */
  instrument?: [string, string];
  /** Clef per staff: "G2", "F4", "C3", "C4", "percussion". */
  clefs: string[];
  /** octave-change of <transpose> (sounding = written + this many octaves). */
  octave?: number;
  /** "C" writes <fifths>0</fifths>; "open" writes an empty <key/>; "none" writes no <key>. */
  key?: "C" | "open" | "none";
  staffLines?: number;
  /** Extra attributes for the first measure (e.g. harp pedals go in directions instead). */
  measures: string[];
}

type ListItem =
  | { part: PartSpec }
  | { group: "start"; number: number; symbol: string; barline?: string; name?: string }
  | { group: "stop"; number: number };

function clefXml(c: string, number: number, staves: number): string {
  const n = staves > 1 ? ` number="${number}"` : "";
  if (c === "percussion") return `<clef${n}><sign>percussion</sign></clef>`;
  return `<clef${n}><sign>${c[0]}</sign><line>${c[1]}</line></clef>`;
}

function score(
  title: string,
  list: ListItem[],
  o: { defaults?: string; breaks?: number[] } = {},
): string {
  const parts = list.flatMap((x) => ("part" in x ? [x.part] : []));
  const partList = list
    .map((x) => {
      if ("group" in x) {
        if (x.group === "stop") return `<part-group type="stop" number="${x.number}"/>`;
        return `<part-group type="start" number="${x.number}">${x.name ? `<group-name>${esc(x.name)}</group-name>` : ""}<group-symbol>${x.symbol}</group-symbol>${x.barline ? `<group-barline>${x.barline}</group-barline>` : ""}</part-group>`;
      }
      const p = x.part;
      const k = parts.indexOf(p) + 1;
      const instrument = p.instrument
        ? `<score-instrument id="P${k}-I1"><instrument-name>${esc(p.instrument[0])}</instrument-name><instrument-sound>${p.instrument[1]}</instrument-sound></score-instrument>`
        : "";
      return `<score-part id="P${k}"><part-name>${esc(p.name)}</part-name>${p.nameDisplay ? `<part-name-display>${p.nameDisplay}</part-name-display>` : ""}<part-abbreviation>${esc(p.abbreviation)}</part-abbreviation>${p.abbreviationDisplay ? `<part-abbreviation-display>${p.abbreviationDisplay}</part-abbreviation-display>` : ""}${instrument}</score-part>`;
    })
    .join("\n");
  const body = parts.map((p, i) => {
    const staves = p.clefs.length;
    const measures = p.measures.map((content, m) => {
      const attrs: string[] = [];
      if (m === 0) {
        attrs.push(`<divisions>${Q}</divisions>`);
        const key = p.key ?? "C";
        if (key === "C") attrs.push("<key><fifths>0</fifths></key>");
        if (key === "open") attrs.push("<key/>");
        attrs.push("<time><beats>4</beats><beat-type>4</beat-type></time>");
        if (staves > 1) attrs.push(`<staves>${staves}</staves>`);
        p.clefs.forEach((c, s) => attrs.push(clefXml(c, s + 1, staves)));
        if (p.staffLines)
          attrs.push(`<staff-details><staff-lines>${p.staffLines}</staff-lines></staff-details>`);
        if (p.octave)
          attrs.push(
            `<transpose><diatonic>0</diatonic><chromatic>0</chromatic><octave-change>${p.octave}</octave-change></transpose>`,
          );
      }
      const brk = o.breaks?.includes(m + 1) ? '<print new-system="yes"/>' : "";
      return `<measure number="${m + 1}">${brk}${attrs.length ? `<attributes>${attrs.join("")}</attributes>` : ""}${content}</measure>`;
    });
    return `<part id="P${i + 1}">\n${measures.join("\n")}\n</part>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    `<work><work-title>${esc(title)}</work-title></work>`,
    o.defaults ?? "",
    `<part-list>\n${partList}\n</part-list>`,
    ...body,
    "</score-partwise>",
    "",
  ].join("\n");
}

const bars = (n: number, content: (bar: number) => string) =>
  Array.from({ length: n }, (_, i) => content(i + 1));
const restBars = (n: number) => bars(n, () => wholeRest());

//==============================================================================
// 01: octave-notated instruments, with and without <transpose>

function octaveParts(withTranspose: boolean): ListItem[] {
  const t = (o: number) => (withTranspose ? o : undefined);
  const one = (
    name: string,
    abbreviation: string,
    instrument: [string, string],
    clef: string,
    octave: number | undefined,
    ps: string[],
  ): ListItem => ({
    part: {
      name,
      abbreviation,
      instrument,
      clefs: [clef],
      octave,
      measures: [quarters(ps), wholeRest()],
    },
  });
  return [
    one("Piccolo", "Picc.", ["Piccolo", "wind.flutes.flute.piccolo"], "G2", t(1), [
      "C5",
      "D5",
      "E5",
      "F5",
    ]),
    one(
      "Bass Clarinet in B♭ (A)",
      "B. Cl. (A)",
      ["Bass Clarinet in Bb [score sounds 8vb]", "wind.reed.clarinet.bass"],
      "G2",
      t(-1),
      ["D5", "E5", "F5", "G5"],
    ),
    one(
      "Bass Clarinet in B♭ (B)",
      "B. Cl. (B)",
      ["Bass Clarinet in Bb", "wind.reed.clarinet.bass"],
      "F4",
      undefined,
      ["D3", "E3", "F3", "G3"],
    ),
    one("Contrabassoon", "Cbsn.", ["Contrabassoon", "wind.reed.contrabassoon"], "F4", t(-1), [
      "C3",
      "D3",
      "E3",
      "F3",
    ]),
    one("Glockenspiel", "Glock.", ["Glockenspiel", "pitched-percussion.glockenspiel"], "G2", t(2), [
      "G4",
      "A4",
      "B4",
      "C5",
    ]),
    one("Crotales", "Crot.", ["Crotales", "metal.crotales"], "G2", t(2), ["C5", "D5", "E5", "F5"]),
    one("Xylophone", "Xyl.", ["Xylophone", "pitched-percussion.xylophone"], "G2", t(1), [
      "C5",
      "D5",
      "E5",
      "F5",
    ]),
    {
      part: {
        name: "Celesta",
        abbreviation: "Cel.",
        instrument: ["Celesta", "keyboard.celesta"],
        clefs: ["G2", "F4"],
        octave: t(1),
        measures: [
          quarters(["C5", "D5", "E5", "F5"], { staff: 1 }) +
            backup() +
            note("C3", 2 * Q, { voice: 5, staff: 2 }) +
            note("G3", 2 * Q, { voice: 5, staff: 2 }),
          wholeRest(1, 1) + backup() + wholeRest(5, 2),
        ],
      },
    },
    one("Double Bass", "Db.", ["Contrabass", "strings.contrabass"], "F4", t(-1), [
      "C3",
      "D3",
      "E3",
      "F3",
    ]),
  ];
}

//==============================================================================
// 02: which Sibelius instrument each part becomes

const ensemble: [string, string, [string, string], string, number?][] = [
  ["Piccolo", "Picc.", ["Piccolo", "wind.flutes.flute.piccolo"], "G2", 1],
  ["Flute 1", "Fl. 1", ["Flute", "wind.flutes.flute"], "G2"],
  ["Alto Flute", "A. Fl.", ["Alto Flute", "wind.flutes.flute.alto"], "G2"],
  ["Oboe 1", "Ob. 1", ["Oboe", "wind.reed.oboe"], "G2"],
  ["Cor anglais", "C. a.", ["Cor Anglais", "wind.reed.english-horn"], "G2"],
  ["Clarinet 1 in B♭", "Cl. 1", ["Clarinet in Bb", "wind.reed.clarinet.bflat"], "G2"],
  ["Clarinet in E♭", "E♭ Cl.", ["Clarinet in Eb", "wind.reed.clarinet.eflat"], "G2"],
  ["Bass Clarinet in B♭", "B. Cl.", ["Bass Clarinet in Bb", "wind.reed.clarinet.bass"], "F4"],
  ["Bassoon 1", "Bsn. 1", ["Bassoon", "wind.reed.bassoon"], "F4"],
  ["Contrabassoon", "Cbsn.", ["Contrabassoon", "wind.reed.contrabassoon"], "F4", -1],
  ["Horn 1 in F", "Hn. 1", ["Horn in F", "brass.french-horn"], "G2"],
  ["Trumpet 1 in B♭", "Tpt. 1 (B♭)", ["Trumpet in Bb", "brass.trumpet.bflat"], "G2"],
  ["Trombone 1", "Tbn. 1", ["Trombone", "brass.trombone"], "F4"],
  ["Bass Trombone", "B. Tbn.", ["Bass Trombone", "brass.trombone.bass"], "F4"],
  ["Tuba", "Tba.", ["Tuba", "brass.tuba"], "F4"],
  ["Timpani", "Timp.", ["Timpani [no key]", "drum.timpani"], "F4"],
  ["Glockenspiel", "Glock.", ["Glockenspiel", "pitched-percussion.glockenspiel"], "G2", 2],
  ["Xylophone", "Xyl.", ["Xylophone", "pitched-percussion.xylophone"], "G2", 1],
  ["Vibraphone", "Vib.", ["Vibraphone", "pitched-percussion.vibraphone"], "G2"],
  ["Crotales", "Crot.", ["Crotales", "metal.crotales"], "G2", 2],
  ["Tubular Bells", "Tub. B.", ["Tubular Bells", "pitched-percussion.tubular-bells"], "G2"],
  ["Snare Drum", "S. D.", ["Snare Drum", "drum.snare-drum"], "percussion"],
  ["Bass Drum", "B. D.", ["Bass Drum", "drum.bass-drum"], "percussion"],
  ["Suspended Cymbal", "Sus. Cym.", ["Cymbals", "metal.cymbal.suspended"], "percussion"],
  ["Tam-tam", "T.-t.", ["Tam-tam", "metal.tamtam"], "percussion"],
  ["Triangle", "Tri.", ["Triangle", "metal.triangle"], "percussion"],
  ["Wood Block", "W. B.", ["Wood Block [1 line]", "wood.wood-block"], "percussion"],
  ["Violin I", "Vln. I", ["Violin I", "strings.violin"], "G2"],
  ["Violin II", "Vln. II", ["Violin II", "strings.violin"], "G2"],
  ["Viola", "Vla.", ["Viola", "strings.viola"], "C3"],
  ["Violoncello", "Vc.", ["Violoncello", "strings.cello"], "F4"],
  ["Double Bass", "Db.", ["Contrabass", "strings.contrabass"], "F4", -1],
];
const grand: [string, string, [string, string], number?][] = [
  ["Marimba", "Mar.", ["Marimba [grand staff]", "pitched-percussion.marimba"]],
  ["Harp 1", "Hp. 1", ["Harp", "pluck.harp"]],
  ["Celesta", "Cel.", ["Celesta", "keyboard.celesta"], 1],
  ["Piano", "Pno.", ["Piano", "keyboard.piano"]],
];

function identityParts(withInstrument: boolean): ListItem[] {
  const single = ensemble.map(([name, abbreviation, instrument, clef, octave]): ListItem => {
    const unpitched = clef === "percussion";
    const first = unpitched
      ? `<note><unpitched><display-step>B</display-step><display-octave>4</display-octave></unpitched><duration>${W}</duration><voice>1</voice><type>whole</type></note>`
      : note(clef === "F4" ? "C3" : clef === "C3" ? "C4" : "C5", W);
    return {
      part: {
        name,
        abbreviation,
        instrument: withInstrument ? instrument : undefined,
        clefs: [clef],
        octave: octave,
        staffLines: unpitched ? 1 : undefined,
        measures: [first],
      },
    };
  });
  const both = grand.map(([name, abbreviation, instrument, octave]): ListItem => ({
    part: {
      name,
      abbreviation,
      instrument: withInstrument ? instrument : undefined,
      clefs: ["G2", "F4"],
      octave,
      measures: [note("C5", W, { staff: 1 }) + backup() + note("C3", W, { voice: 5, staff: 2 })],
    },
  }));
  // Score order: grand staves go between the percussion and the strings.
  return [...single.slice(0, 27), ...both, ...single.slice(27)];
}

//==============================================================================
// 03: brackets, sub-brackets, braces and barline joins

function bracketParts(withGroups: boolean): ListItem[] {
  const p = (name: string, abbreviation: string, clef: string, pitch: string): ListItem => ({
    part: { name, abbreviation, clefs: [clef], measures: [note(pitch, W), wholeRest()] },
  });
  const g = (x: ListItem): ListItem[] => (withGroups ? [x] : []);
  const grandPart = (name: string, abbreviation: string): ListItem => ({
    part: {
      name,
      abbreviation,
      clefs: ["G2", "F4"],
      measures: [
        note("C5", W, { staff: 1 }) + backup() + note("C3", W, { voice: 5, staff: 2 }),
        wholeRest(1, 1) + backup() + wholeRest(5, 2),
      ],
    },
  });
  return [
    ...g({ group: "start", number: 1, symbol: "bracket", barline: "yes" }),
    ...g({ group: "start", number: 2, symbol: "square" }),
    p("Flute 1", "Fl. 1", "G2", "C5"),
    p("Flute 2", "Fl. 2", "G2", "A4"),
    ...g({ group: "stop", number: 2 }),
    ...g({ group: "start", number: 3, symbol: "bracket" }),
    p("Oboe 1", "Ob. 1", "G2", "C5"),
    p("Oboe 2", "Ob. 2", "G2", "A4"),
    ...g({ group: "stop", number: 3 }),
    ...g({ group: "stop", number: 1 }),
    ...g({ group: "start", number: 4, symbol: "bracket", barline: "yes" }),
    p("Horn 1", "Hn. 1", "G2", "C5"),
    p("Horn 2", "Hn. 2", "G2", "A4"),
    p("Horn 3", "Hn. 3", "G2", "F4"),
    p("Horn 4", "Hn. 4", "G2", "D4"),
    ...g({ group: "stop", number: 4 }),
    ...g({ group: "start", number: 5, symbol: "none", barline: "yes" }),
    p("Timpani", "Timp.", "F4", "C3"),
    p("Vibraphone", "Vib.", "G2", "C5"),
    ...g({ group: "stop", number: 5 }),
    grandPart("Harp 1", "Hp. 1"),
    grandPart("Harp 2", "Hp. 2"),
    grandPart("Piano", "Pno."),
    ...g({ group: "start", number: 6, symbol: "bracket", barline: "yes" }),
    ...g({ group: "start", number: 7, symbol: "square" }),
    p("Violin I", "Vln. I", "G2", "C5"),
    p("Violin II", "Vln. II", "G2", "A4"),
    ...g({ group: "stop", number: 7 }),
    p("Viola", "Vla.", "C3", "C4"),
    p("Violoncello", "Vc.", "F4", "C3"),
    p("Double Bass", "Db.", "F4", "C3"),
    ...g({ group: "stop", number: 6 }),
  ];
}

//==============================================================================
// 04: names on the first system and after, with a flat in the music font

const flatDisplay = (before: string, after = "") =>
  `<display-text>${esc(before)}</display-text><accidental-text>flat</accidental-text>${after ? `<display-text>${esc(after)}</display-text>` : ""}`;

function nameParts(): ListItem[] {
  const twelve = (pitch: string) => bars(12, (b) => (b % 2 ? note(pitch, W) : wholeRest()));
  return [
    {
      part: { name: "Flutes 1.2", abbreviation: "Fl. 1.2", clefs: ["G2"], measures: twelve("C5") },
    },
    {
      part: {
        name: "Clarinets 1.2 in Bb",
        nameDisplay: flatDisplay("Clarinets 1.2 in B"),
        abbreviation: "Cl. 1.2 (Bb)",
        abbreviationDisplay: flatDisplay("Cl. 1.2 (B", ")"),
        clefs: ["G2"],
        measures: twelve("C5"),
      },
    },
    {
      part: {
        name: "Clarinet in E♭",
        abbreviation: "E♭ Cl.",
        clefs: ["G2"],
        measures: twelve("C5"),
      },
    },
    { part: { name: "Horns 1.2", abbreviation: "Hn. 1.2", clefs: ["G2"], measures: twelve("C4") } },
    {
      part: {
        name: "Trumpet 1 in Bb",
        nameDisplay: flatDisplay("Trumpet 1 in B"),
        abbreviation: "Tpt. 1 (Bb)",
        abbreviationDisplay: flatDisplay("Tpt. 1 (B", ")"),
        clefs: ["G2"],
        measures: twelve("C5"),
      },
    },
    { part: { name: "Violin I", abbreviation: "Vln. I", clefs: ["G2"], measures: twelve("C5") } },
  ];
}

//==============================================================================
// 05: an open key (no key signature even in a transposing view)

function keyParts(): ListItem[] {
  const cl = (name: string, key: PartSpec["key"]): ListItem => ({
    part: {
      name,
      abbreviation: name,
      instrument: ["Clarinet in Bb", "wind.reed.clarinet.bflat"],
      clefs: ["G2"],
      key,
      measures: [quarters(["C5", "D5", "E5", "F#5"]), note("G5", W)],
    },
  });
  return [
    cl("Clarinet A (fifths 0)", "C"),
    cl("Clarinet B (empty key)", "open"),
    cl("Clarinet C (no key)", "none"),
  ];
}

//==============================================================================
// 06: two players on one staff

function sharedStaff(): ListItem[] {
  // Unison, labelled a 2; then the same rhythm on shared stems.
  const m1 = words("a 2") + quarters(["C5", "D5", "E5", "F5"]);
  const m2 = ["C5", "D5", "E5", "F5"]
    .map((p, i) => note([p, ["A4", "B4", "C5", "D5"][i]!], Q))
    .join("");
  const m3 =
    words("1.", "above") +
    note("C5", 2 * Q, { stem: "up" }) +
    note("D5", 2 * Q, { stem: "up" }) +
    backup() +
    words("2.", "below") +
    quarters(["G4", "A4", "B4", "A4"], { voice: 2, stem: "down" });
  const m4 =
    words("1.") +
    quarters(["E5", "D5", "C5", "D5"], { stem: "up" }) +
    backup() +
    note(undefined, W, { voice: 2, hidden: true });
  const m5 =
    note(undefined, W, { voice: 1, hidden: true }) +
    backup() +
    words("2.", "below") +
    quarters(["A4", "G4", "F4", "G4"], { voice: 2, stem: "down" });
  const trip = (ps: string[]) =>
    ps
      .map((p, i) =>
        note(p, Q / 3, {
          stem: "up",
          tuplet: { actual: 3, normal: 2, start: i % 3 === 0, stop: i % 3 === 2 },
        }),
      )
      .join("");
  const quint = (ps: string[]) =>
    ps
      .map((p, i) =>
        note(p, Q / 5, {
          voice: 2,
          stem: "down",
          tuplet: { actual: 5, normal: 4, start: i % 5 === 0, stop: i % 5 === 4 },
        }),
      )
      .join("");
  const m6 =
    words("1.") +
    trip(["C5", "D5", "E5", "D5", "C5", "B4", "C5", "D+5", "E5", "F5", "E5", "D5"]) +
    backup() +
    words("2.", "below") +
    quint([
      "G4",
      "A4",
      "B4",
      "A4",
      "G4",
      "F4",
      "G4",
      "A-4",
      "B4",
      "C5",
      "B4",
      "A4",
      "G4",
      "F4",
      "E4",
      "F4",
      "G4",
      "A4",
      "G4",
      "F4",
    ]);
  const m7 = wholeRest();
  return [
    {
      part: {
        name: "Flutes 1.2",
        abbreviation: "Fl. 1.2",
        instrument: ["Flute", "wind.flutes.flute"],
        clefs: ["G2"],
        measures: [m1, m2, m3, m4, m5, m6, m7],
      },
    },
  ];
}

//==============================================================================
// 07: string divisi — on the section staff, on extra staves, and as a two-staff part

function divisiParts(): ListItem[] {
  const section: ListItem = {
    part: {
      name: "Violin I",
      abbreviation: "Vln. I",
      instrument: ["Violin I", "strings.violin"],
      clefs: ["G2"],
      measures: [
        quarters(["C5", "D5", "E5", "F5"]),
        words("div.") +
          quarters(["E5", "F5", "G5", "A5"], { stem: "up" }) +
          backup() +
          quarters(["C5", "D5", "E5", "D5"], { voice: 2, stem: "down" }),
        words("unis.") + note("C5", W),
        wholeRest(),
        wholeRest(),
        words("unis.") + note("C5", W),
      ],
    },
  };
  const extra = (name: string, abbreviation: string, ps: string[]): ListItem => ({
    part: {
      name,
      abbreviation,
      instrument: ["Violin I", "strings.violin"],
      clefs: ["G2"],
      measures: [
        wholeRest(),
        wholeRest(),
        wholeRest(),
        quarters(ps),
        quarters(ps.slice().reverse()),
        wholeRest(),
      ],
    },
  });
  const twoStaff: ListItem = {
    part: {
      name: "Violin II",
      abbreviation: "Vln. II",
      instrument: ["Violin II", "strings.violin"],
      clefs: ["G2", "G2"],
      measures: [
        note("C5", W, { staff: 1 }) + backup() + wholeRest(5, 2),
        words("div.", "above", 1) +
          note("E5", W, { staff: 1 }) +
          backup() +
          note("C5", W, { voice: 5, staff: 2 }),
        words("unis.", "above", 1) + note("C5", W, { staff: 1 }) + backup() + wholeRest(5, 2),
        wholeRest(1, 1) + backup() + wholeRest(5, 2),
        wholeRest(1, 1) + backup() + wholeRest(5, 2),
        wholeRest(1, 1) + backup() + wholeRest(5, 2),
      ],
    },
  };
  return [
    { group: "start", number: 1, symbol: "bracket", barline: "yes" },
    { group: "start", number: 2, symbol: "square" },
    section,
    extra("Violin I 1–8", "Vln. I 1–8", ["A5", "B5", "C6", "B5"]),
    extra("Violin I 9–16", "Vln. I 9–16", ["E5", "F5", "G5", "F5"]),
    { group: "stop", number: 2 },
    twoStaff,
    { group: "stop", number: 1 },
  ];
}

//==============================================================================
// 08: percussion players

function percussionParts(): ListItem[] {
  const hit = (dur: number) =>
    `<note><unpitched><display-step>B</display-step><display-octave>4</display-octave></unpitched><duration>${dur}</duration><voice>1</voice><type>${types[dur]![0]}</type></note>`;
  const unpitched = (
    name: string,
    abbreviation: string,
    instrument: [string, string],
    measures: string[],
  ): ListItem => ({
    part: { name, abbreviation, instrument, clefs: ["percussion"], staffLines: 1, measures },
  });
  return [
    {
      part: {
        name: "Timpani",
        abbreviation: "Timp.",
        instrument: ["Timpani [no key]", "drum.timpani"],
        clefs: ["F4"],
        measures: [words("C, G") + quarters(["C3", "G2", "C3", "G2"]), wholeRest(), wholeRest()],
      },
    },
    { group: "start", number: 1, symbol: "bracket", barline: "yes" },
    {
      part: {
        name: "Percussion 1",
        abbreviation: "Perc. 1",
        instrument: ["Vibraphone", "pitched-percussion.vibraphone"],
        clefs: ["G2"],
        measures: [
          words("Vibraphone") + quarters(["C5", "E5", "G5", "E5"]),
          wholeRest(),
          wholeRest(),
        ],
      },
    },
    unpitched(
      "Percussion 1: Snare Drum",
      "Perc. 1: S. D.",
      ["Snare Drum", "drum.snare-drum"],
      [wholeRest(), words("Snare Drum") + hit(Q) + hit(Q) + hit(Q) + hit(Q), wholeRest()],
    ),
    unpitched(
      "Percussion 2: Suspended Cymbal",
      "Perc. 2: Sus. Cym.",
      ["Cymbals", "metal.cymbal.suspended"],
      [hit(W), wholeRest(), wholeRest()],
    ),
    unpitched(
      "Percussion 2: Bass Drum",
      "Perc. 2: B. D.",
      ["Bass Drum", "drum.bass-drum"],
      [wholeRest(), wholeRest(), hit(2 * Q) + hit(2 * Q)],
    ),
    { group: "stop", number: 1 },
  ];
}

//==============================================================================
// 09: harp and piano — grand staff, notes on both staves, dynamics between, harp pedals

function grandParts(): ListItem[] {
  const pedals =
    '<direction placement="above"><direction-type><harp-pedals>' +
    [
      ["D", 0],
      ["C", 0],
      ["B", -1],
      ["E", -1],
      ["F", 0],
      ["G", 0],
      ["A", 0],
    ]
      .map(
        ([s, a]) =>
          `<pedal-tuning><pedal-step>${s}</pedal-step><pedal-alter>${a}</pedal-alter></pedal-tuning>`,
      )
      .join("") +
    "</harp-pedals></direction-type><staff>1</staff></direction>";
  const harp: ListItem = {
    part: {
      name: "Harp 1",
      abbreviation: "Hp. 1",
      instrument: ["Harp", "pluck.harp"],
      clefs: ["G2", "F4"],
      measures: [
        pedals +
          dynamic("mp", 1) +
          quarters(["C5", "E5", "G5", "E5"], { staff: 1 }) +
          backup() +
          quarters(["C3", "G3", "C4", "G3"], { voice: 5, staff: 2 }),
        quarters(["C6", "E6", "G6", "E6"], { staff: 1 }) +
          backup() +
          `<attributes><clef number="2"><sign>G</sign><line>2</line></clef></attributes>` +
          quarters(["C5", "E5", "G5", "E5"], { voice: 5, staff: 2 }),
        wholeRest(1, 1) +
          backup() +
          `<attributes><clef number="2"><sign>F</sign><line>4</line></clef></attributes>` +
          wholeRest(5, 2),
      ],
    },
  };
  const piano: ListItem = {
    part: {
      name: "Piano",
      abbreviation: "Pno.",
      instrument: ["Piano", "keyboard.piano"],
      clefs: ["G2", "F4"],
      measures: [
        dynamic("p", 1) +
          note(["C5", "E5", "G5"], W, { staff: 1 }) +
          backup() +
          note(["C3", "G3"], W, { voice: 5, staff: 2 }),
        note(["D5", "F5", "A5"], W, { staff: 1 }) +
          backup() +
          note(["D3", "A3"], W, { voice: 5, staff: 2 }),
        wholeRest(1, 1) + backup() + wholeRest(5, 2),
      ],
    },
  };
  return [harp, piano];
}

//==============================================================================
// 10: page and staff size from <defaults>: A2 portrait, 6 mm staves, 30 mm margins (decision 0021;
// at 6 mm a tenth is 0.15 mm)

const a2Defaults =
  "<defaults><scaling><millimeters>6</millimeters><tenths>40</tenths></scaling>" +
  "<page-layout><page-height>3960</page-height><page-width>2800</page-width>" +
  '<page-margins type="both"><left-margin>200</left-margin><right-margin>200</right-margin><top-margin>200</top-margin><bottom-margin>200</bottom-margin></page-margins>' +
  "</page-layout></defaults>";

//==============================================================================
// 11: explicit accidentals (naturals on every note, cautionary, repeated quarter tones)

function accidentalParts(): ListItem[] {
  const m1 =
    note("C5", Q) +
    note("C5", Q, { accidental: "natural" }) +
    note("C#5", Q, { accidental: "sharp" }) +
    note("C5", Q, { accidental: "natural", accidentalAttrs: 'cautionary="yes"' });
  const m2 =
    note("C+5", Q, { accidental: "quarter-sharp" }) +
    note("C+5", Q, { accidental: "quarter-sharp" }) +
    note("D5", Q, { accidental: "natural" }) +
    note("D5", Q);
  const m3 =
    note("E-5", Q, { accidental: "quarter-flat" }) +
    note("E5", Q, { accidental: "natural" }) +
    note("Eb-5", Q, { accidental: "three-quarters-flat" }) +
    note("E5", Q, { accidental: "natural" });
  const m4 = note("C5", Q) + note("D5", Q) + note("E5", Q) + note("F5", Q);
  return [
    {
      part: {
        name: "Violin I",
        abbreviation: "Vln. I",
        instrument: ["Violin I", "strings.violin"],
        clefs: ["G2"],
        measures: [m1, m2, m3, m4],
      },
    },
  ];
}

//==============================================================================
// 12: players moving between staves: "Flutes 1.2", "Flute 1", "Flute 2", with system breaks

function movingParts(): ListItem[] {
  const shared = bars(12, (b) =>
    b <= 4 || b >= 9
      ? (b === 1 || b === 9 ? words("a 2") : "") + quarters(["C5", "D5", "E5", "D5"])
      : wholeRest(),
  );
  const single = (ps: string[]) => bars(12, (b) => (b >= 5 && b <= 8 ? quarters(ps) : wholeRest()));
  return [
    { group: "start", number: 1, symbol: "bracket", barline: "yes" },
    {
      part: {
        name: "Flutes 1.2",
        abbreviation: "Fl. 1.2",
        instrument: ["Flute", "wind.flutes.flute"],
        clefs: ["G2"],
        measures: shared,
      },
    },
    {
      part: {
        name: "Flute 1",
        abbreviation: "Fl. 1",
        instrument: ["Flute", "wind.flutes.flute"],
        clefs: ["G2"],
        measures: single(["E5", "F5", "G5", "F5"]),
      },
    },
    {
      part: {
        name: "Flute 2",
        abbreviation: "Fl. 2",
        instrument: ["Flute", "wind.flutes.flute"],
        clefs: ["G2"],
        measures: single(["C5", "B4", "A4", "B4"]),
      },
    },
    {
      part: {
        name: "Oboe 1",
        abbreviation: "Ob. 1",
        instrument: ["Oboe", "wind.reed.oboe"],
        clefs: ["G2"],
        measures: bars(12, () => note("A4", W)),
      },
    },
    { group: "stop", number: 1 },
  ];
}

//==============================================================================

const files: Record<string, string> = {
  "01a-octave-with-transpose": score("01a octave instruments, with transpose", octaveParts(true)),
  "01b-octave-without-transpose": score(
    "01b octave instruments, without transpose",
    octaveParts(false),
  ),
  "02a-identity-with-instrument": score(
    "02a instrument identity, with score-instrument",
    identityParts(true),
  ),
  "02b-identity-names-only": score("02b instrument identity, names only", identityParts(false)),
  "03a-brackets": score("03a brackets and barlines", bracketParts(true)),
  "03b-no-groups": score("03b no part groups", bracketParts(false)),
  "04-names": score("04 names", nameParts(), { breaks: [5, 9] }),
  "05-open-key": score("05 open key", keyParts()),
  "06-shared-staff": score("06 two players on one staff", sharedStaff()),
  "07-divisi": score("07 string divisi", divisiParts()),
  "08-percussion": score("08 percussion players", percussionParts()),
  "09-harp-piano": score("09 harp and piano", grandParts()),
  "10-page-setup": score(
    "10 page and staff size",
    [{ part: { name: "Flute", abbreviation: "Fl.", clefs: ["G2"], measures: restBars(4) } }],
    { defaults: a2Defaults },
  ),
  "11-accidentals": score("11 explicit accidentals", accidentalParts()),
  "12-moving-players": score("12 players moving between staves", movingParts(), { breaks: [5, 9] }),
  // 14: which height sits on a one-line percussion staff (Sibelius drew B4 above the line in 08).
  "14-percussion-line": score("14 one-line staff", [
    {
      part: {
        name: "Snare Drum",
        abbreviation: "S. D.",
        instrument: ["Snare Drum", "drum.snare-drum"],
        clefs: ["percussion"],
        staffLines: 1,
        measures: [
          (["E", "G", "B", "D"] as const)
            .map(
              (step, i) =>
                words(`${step}${i === 3 ? 5 : 4}`) +
                `<note><unpitched><display-step>${step}</display-step><display-octave>${i === 3 ? 5 : 4}</display-octave></unpitched><duration>${Q}</duration><voice>1</voice><type>quarter</type></note>`,
            )
            .join(""),
        ],
      },
    },
  ]),
  // 13: the exporter's own output for a palette sketch (winds in pairs, divided strings, brackets).
  "13-real-export": toMusicXml(
    JSON.parse(
      readFileSync(
        join(
          here,
          "../../sketches/antara/palette/b/leaf-gates-trade-families/leaf-gates-trade-families.json",
        ),
        "utf8",
      ),
    ) as Score,
  ).musicxml,
};

mkdirSync(out, { recursive: true });
for (const [name, xml] of Object.entries(files)) writeFileSync(join(out, `${name}.musicxml`), xml);
console.log(`${Object.keys(files).length} files in ${out}`);

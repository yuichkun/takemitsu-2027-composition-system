// Generates the MusicXML fixtures for the Sibelius import test.
// Zero dependencies. Run: node verification/sibelius-import/generate.mjs
// Output: verification/sibelius-import/fixtures/*.musicxml
//
// One file per category, one measure per case. Every measure starts with a
// bold label ("ID: expected result") so a screenshot documents itself.
// Default dialect mirrors what Sibelius 24.3.1 itself exports (MusicXML 3.0,
// partwise DOCTYPE, divisions 256, quarter tones carried by <accidental> with
// <alter> truncated toward zero).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
mkdirSync(OUT, { recursive: true });

const DIV = 256; // divisions per quarter
const Q = DIV, H = 2 * DIV, W = 4 * DIV, E = DIV / 2, S = DIV / 4;

// ---------------------------------------------------------------- helpers

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attrs = (a = {}) => Object.entries(a).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => ` ${k}="${esc(v)}"`).join("");

/** Sibelius-style alter: truncate the semitone value toward zero. */
const truncAlter = (x) => (x < 0 ? Math.ceil(x) : Math.floor(x));

const TYPE = { [W]: "whole", [H]: "half", [Q]: "quarter", [E]: "eighth", [S]: "16th" };

/**
 * note({step, oct, alter, acc, accAttrs, dur, type, rest, unpitched:{step,oct},
 *       notehead, noteheadAttrs, chord, tie:'start'|'stop', tied, staff, voice,
 *       instrument, beams:[{n, v, fan}], notations:[xml], stem, grace, cue, tm:{actual,normal}, dots})
 * `alter` may be omitted entirely (no <alter> element) by passing alter: null.
 */
function note(o) {
  const dur = o.dur ?? Q;
  const type = o.type ?? TYPE[dur];
  let x = "<note>";
  if (o.grace) x += `<grace${attrs(o.grace === true ? { slash: "yes" } : o.grace)}/>`;
  if (o.cue) x += "<cue/>";
  if (o.chord) x += "<chord/>";
  if (o.rest) x += o.rest === "measure" ? '<rest measure="yes"/>' : "<rest/>";
  else if (o.unpitched) x += `<unpitched><display-step>${o.unpitched.step}</display-step><display-octave>${o.unpitched.oct}</display-octave></unpitched>`;
  else {
    x += `<pitch><step>${o.step}</step>`;
    if (o.alter !== null && o.alter !== undefined) x += `<alter>${o.alter}</alter>`;
    x += `<octave>${o.oct}</octave></pitch>`;
  }
  if (!o.grace) x += `<duration>${dur}</duration>`;
  if (o.tie) for (const t of [].concat(o.tie)) x += `<tie type="${t}"/>`;
  if (o.instrument) x += `<instrument id="${o.instrument}"/>`;
  x += `<voice>${o.voice ?? 1}</voice>`;
  if (type) x += `<type${attrs(o.cue ? { size: "cue" } : {})}>${type}</type>`;
  for (let i = 0; i < (o.dots ?? 0); i++) x += "<dot/>";
  if (o.acc) x += `<accidental${attrs(o.accAttrs)}>${o.acc}</accidental>`;
  if (o.tm) x += `<time-modification><actual-notes>${o.tm.actual}</actual-notes><normal-notes>${o.tm.normal}</normal-notes></time-modification>`;
  if (o.stem) x += `<stem>${o.stem}</stem>`;
  if (o.notehead) x += `<notehead${attrs(o.noteheadAttrs)}>${o.notehead}</notehead>`;
  x += `<staff>${o.staff ?? 1}</staff>`;
  for (const b of o.beams ?? []) x += `<beam number="${b.n ?? 1}"${attrs({ fan: b.fan })}>${b.v}</beam>`;
  const nots = [];
  if (o.tied) for (const t of [].concat(o.tied)) nots.push(typeof t === "string" ? `<tied type="${t}"/>` : `<tied${attrs(t)}/>`);
  nots.push(...(o.notations ?? []));
  if (nots.length) x += `<notations>${nots.join("")}</notations>`;
  return x + "</note>";
}

const rest = (dur = Q, extra = {}) => note({ rest: true, dur, ...extra });
const backup = (dur) => `<backup><duration>${dur}</duration></backup>`;

/** A quarter-tone note in the Sibelius export dialect: accidental carries it, alter truncated.
 *  Run 1 showed the importer ignores <accidental> and reads <alter>, so this encoding LOSES the quarter tone.
 *  Kept for the negative-control fixtures (qt-01, qt-05, meth-*). */
function qt(step, oct, semis, accValue, extra = {}) {
  return note({ step, oct, alter: truncAlter(semis), acc: accValue, ...extra });
}
/** A quarter-tone note in the encoding that actually imports: fractional alter + accidental. */
function qtf(step, oct, semis, accValue, extra = {}) {
  return note({ step, oct, alter: semis, acc: accValue, ...extra });
}

/** direction(inner | [inner, inner...], opts). Each array item becomes its own <direction-type>. */
const direction = (inner, o = {}) =>
  `<direction${attrs({ placement: o.placement })}>${[].concat(inner).map((i) => `<direction-type>${i}</direction-type>`).join("")}${o.offset !== undefined ? `<offset>${o.offset}</offset>` : ""}${o.staff ? `<staff>${o.staff}</staff>` : ""}</direction>`;
const words = (text, a = {}) => `<words${attrs(a)}>${esc(text)}</words>`;
const label = (id, expected) => direction(words(`${id}: ${expected}`, { "font-size": "8", "font-weight": "bold" }), { placement: "above" });

// -------------------------------------------------------------- document

const INSTRUMENTS = {
  flute: { name: "Flute", abbr: "Fl.", sound: "wind.flutes.flute", clef: ["G", 2] },
  clarinet: { name: "Clarinet in Bb", abbr: "Cl.", sound: "wind.reed.clarinet", clef: ["G", 2], transpose: { diatonic: -1, chromatic: -2 } },
  horn: { name: "Horn in F", abbr: "Hn.", sound: "brass.french-horn", clef: ["G", 2], transpose: { diatonic: -4, chromatic: -7 } },
  timpani: { name: "Timpani", abbr: "Timp.", sound: "drum.timpani", clef: ["F", 4] },
  violin: { name: "Violin", abbr: "Vln.", sound: "strings.violin", clef: ["G", 2] },
  piano: { name: "Piano", abbr: "Pno.", sound: "keyboard.piano.grand", clef: ["G", 2], clef2: ["F", 4], staves: 2 },
  perc1: { name: "Percussion", abbr: "Perc.", clef: ["percussion", 2], staffLines: 1 },
  perc5: { name: "Percussion", abbr: "Perc.", clef: ["percussion", 2], staffLines: 5 },
};

/**
 * score(id, title, parts, opts)
 * parts: [{ key, id, inst: INSTRUMENTS.x, extraInstruments:[{id,name,sound}], measures: [xml...] }]
 * opts: { version:'3.0'|'3.1'|'4.0', doctype:boolean, supports:boolean, fifths, beats, beatType }
 */
function score(id, title, parts, opts = {}) {
  const version = opts.version ?? "3.0";
  const doctype = opts.doctype ?? version === "3.0";
  const supports = opts.supports ?? true;
  const nMeasures = Math.max(...parts.map((p) => p.measures.length));
  let x = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
  if (doctype) x += `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML ${version} Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n`;
  x += `<score-partwise version="${version}">\n`;
  x += `<work><work-title>${esc(title)}</work-title></work>\n`;
  x += `<identification><encoding><software>takemitsu-2027 fixture generator</software><encoding-description>${esc(id)}</encoding-description>`;
  if (supports) x += `<supports element="print" type="yes" value="yes" attribute="new-system"/><supports element="print" type="yes" value="yes" attribute="new-page"/><supports element="accidental" type="yes"/><supports element="beam" type="yes"/><supports element="stem" type="yes"/>`;
  x += `</encoding></identification>\n`;
  x += `<part-list>`;
  for (const p of parts) {
    const inst = p.inst;
    x += `<score-part id="${p.id}"><part-name>${esc(inst.name)}</part-name><part-abbreviation>${esc(inst.abbr)}</part-abbreviation>`;
    x += `<score-instrument id="${p.id}-I1"><instrument-name>${esc(inst.name)}</instrument-name>${inst.sound ? `<instrument-sound>${inst.sound}</instrument-sound>` : ""}</score-instrument>`;
    for (const ei of p.extraInstruments ?? []) x += `<score-instrument id="${ei.id}"><instrument-name>${esc(ei.name)}</instrument-name>${ei.sound ? `<instrument-sound>${ei.sound}</instrument-sound>` : ""}</score-instrument>`;
    x += `</score-part>`;
  }
  x += `</part-list>\n`;
  for (const p of parts) {
    const inst = p.inst;
    x += `<part id="${p.id}">\n`;
    for (let m = 0; m < nMeasures; m++) {
      x += `<measure number="${m + 1}">`;
      if (m === 0) {
        x += `<attributes><divisions>${DIV}</divisions><key><fifths>${opts.fifths ?? 0}</fifths><mode>major</mode></key><time><beats>${opts.beats ?? 4}</beats><beat-type>${opts.beatType ?? 4}</beat-type></time>`;
        if (inst.staves) x += `<staves>${inst.staves}</staves>`;
        x += `<clef number="1"><sign>${inst.clef[0]}</sign><line>${inst.clef[1]}</line></clef>`;
        if (inst.clef2) x += `<clef number="2"><sign>${inst.clef2[0]}</sign><line>${inst.clef2[1]}</line></clef>`;
        if (inst.staffLines) x += `<staff-details number="1"><staff-lines>${inst.staffLines}</staff-lines></staff-details>`;
        if (inst.transpose) x += `<transpose><diatonic>${inst.transpose.diatonic}</diatonic><chromatic>${inst.transpose.chromatic}</chromatic>${inst.transpose.octaveChange ? `<octave-change>${inst.transpose.octaveChange}</octave-change>` : ""}</transpose>`;
        x += `</attributes>`;
      }
      x += p.measures[m] ?? (inst.staves === 2 ? pianoEmpty() : wholeRest());
      x += `</measure>\n`;
    }
    x += `</part>\n`;
  }
  x += `</score-partwise>\n`;
  const file = join(OUT, `${id}.musicxml`);
  writeFileSync(file, x);
  return file;
}

/** Measure with three quarter notes C D F (or given steps) sharing one accidental spec, plus a quarter rest. */
function trio(idLabel, expected, mk) {
  return label(idLabel, expected) + ["C", "D", "F"].map(mk).join("") + rest(Q);
}

const wholeRest = (staff = 1) => note({ rest: "measure", dur: W, staff });
const pianoEmpty = () => wholeRest(1) + backup(W) + wholeRest(2);

// ================================================================ fixtures

const files = [];

// ---- QT-01: Sibelius dialect (accidental carries the quarter tone, alter truncated)
{
  const acc = [
    ["quarter-sharp", 0.5], ["quarter-flat", -0.5], ["three-quarters-sharp", 1.5], ["three-quarters-flat", -1.5],
  ];
  const ms = [trio("QT-01-1", "control: C D F natural", (s) => note({ step: s, oct: 5, alter: 0 }))];
  acc.forEach(([a, semis], i) => ms.push(trio(`QT-01-${i + 2}`, `${a}, alter ${truncAlter(semis)}`, (s) => qt(s, 5, semis, a))));
  ms.push(trio("QT-01-6", "control: C D F natural again", (s) => note({ step: s, oct: 5, alter: 0 })));
  files.push(score("qt-01-sibelius-dialect", "QT-01 quarter tones, Sibelius dialect", [{ id: "P1", inst: INSTRUMENTS.flute, measures: ms }]));
}

// ---- QT-02: fractional alter + accidental
{
  const acc = [["quarter-sharp", 0.5], ["quarter-flat", -0.5], ["three-quarters-sharp", 1.5], ["three-quarters-flat", -1.5]];
  const ms = [trio("QT-02-1", "control: natural", (s) => note({ step: s, oct: 5, alter: 0 }))];
  acc.forEach(([a, semis], i) => ms.push(trio(`QT-02-${i + 2}`, `${a}, alter ${semis}`, (s) => note({ step: s, oct: 5, alter: semis, acc: a }))));
  files.push(score("qt-02-alter-half-plus-accidental", "QT-02 quarter tones, alter 0.5 + accidental", [{ id: "P1", inst: INSTRUMENTS.flute, measures: ms }]));
}

// ---- QT-03: fractional alter only, no accidental element
{
  const ms = [trio("QT-03-1", "control: natural", (s) => note({ step: s, oct: 5, alter: 0 }))];
  [0.5, -0.5, 1.5, -1.5].forEach((semis, i) => ms.push(trio(`QT-03-${i + 2}`, `alter ${semis}, no accidental element`, (s) => note({ step: s, oct: 5, alter: semis }))));
  files.push(score("qt-03-alter-only", "QT-03 quarter tones, alter only", [{ id: "P1", inst: INSTRUMENTS.flute, measures: ms }]));
}

// ---- QT-04: accidental only, no alter element (diagnostic)
{
  const ms = [trio("QT-04-1", "control: natural", (s) => note({ step: s, oct: 5, alter: 0 }))];
  ["quarter-sharp", "quarter-flat", "three-quarters-sharp", "three-quarters-flat"].forEach((a, i) => ms.push(trio(`QT-04-${i + 2}`, `${a}, no alter element`, (s) => note({ step: s, oct: 5, alter: null, acc: a }))));
  ms.push(trio("QT-04-6", "mismatch: alter 0 + accidental sharp", (s) => note({ step: s, oct: 5, alter: 0, acc: "sharp" })));
  ms.push(trio("QT-04-7", "mismatch: alter 1 + accidental quarter-sharp", (s) => note({ step: s, oct: 5, alter: 1, acc: "quarter-sharp" })));
  files.push(score("qt-04-accidental-only-and-mismatch", "QT-04 accidental without alter, mismatches", [{ id: "P1", inst: INSTRUMENTS.flute, measures: ms }]));
}

// ---- QT-05: arrow-style accidentals (Sibelius-style truncated alter)
{
  const acc = [["natural-up", 0.5], ["natural-down", -0.5], ["sharp-up", 1.5], ["sharp-down", 0.5], ["flat-up", -0.5], ["flat-down", -1.5], ["arrow-up", 0.5], ["arrow-down", -0.5]];
  const ms = [trio("QT-05-1", "control: natural", (s) => note({ step: s, oct: 5, alter: 0 }))];
  acc.forEach(([a, semis], i) => ms.push(trio(`QT-05-${i + 2}`, `${a}, alter ${truncAlter(semis)}`, (s) => qt(s, 5, semis, a))));
  files.push(score("qt-05-arrow-accidentals", "QT-05 arrow accidentals", [{ id: "P1", inst: INSTRUMENTS.flute, measures: ms }]));
}

// ---- QT-06: transposing instruments and timpani (written pitch + <transpose>)
{
  const fl = [trio("QT-06-1", "Fl control", (s) => note({ step: s, oct: 5, alter: 0 })), trio("QT-06-2", "Fl C D F quarter-sharp", (s) => qt(s, 5, 0.5, "quarter-sharp")), wholeRest(), wholeRest()];
  // clarinet written D E G = sounding C D F
  const cl = [trio("QT-06-1", "Cl written D E G natural", (s) => note({ step: { C: "D", D: "E", F: "G" }[s], oct: 5, alter: 0 })),
    trio("QT-06-2", "Cl written D E G quarter-sharp = sounding C D F quarter-sharp", (s) => qt({ C: "D", D: "E", F: "G" }[s], 5, 0.5, "quarter-sharp")),
    trio("QT-06-3", "Cl written D E G three-quarters-flat", (s) => qt({ C: "D", D: "E", F: "G" }[s], 5, -1.5, "three-quarters-flat")), wholeRest()];
  // horn written G A C = sounding C D F
  const hn = [wholeRest(), trio("QT-06-2", "Hn written G A C quarter-sharp = sounding C D F quarter-sharp", (s) => qt({ C: "G", D: "A", F: "C" }[s], s === "F" ? 6 : 5, 0.5, "quarter-sharp")), wholeRest(), wholeRest()];
  const timp = [wholeRest(), wholeRest(), wholeRest(), label("QT-06-4", "Timp C3 quarter-sharp, D3 quarter-flat") + qt("C", 3, 0.5, "quarter-sharp") + qt("D", 3, -0.5, "quarter-flat") + rest(H)];
  files.push(score("qt-06-transposing", "QT-06 quarter tones on transposing instruments", [
    { id: "P1", inst: INSTRUMENTS.flute, measures: fl },
    { id: "P2", inst: INSTRUMENTS.clarinet, measures: cl },
    { id: "P3", inst: INSTRUMENTS.horn, measures: hn },
    { id: "P4", inst: INSTRUMENTS.timpani, measures: timp },
  ]));
}

// ---- QT-07: accidental rules, ties, chords, cautionary
{
  const ms = [
    label("QT-07-1", "C quarter-sharp x4, accidental only on first") + qt("C", 5, 0.5, "quarter-sharp") + note({ step: "C", oct: 5, alter: 0 }) + note({ step: "C", oct: 5, alter: 0 }) + note({ step: "C", oct: 5, alter: 0 }),
    label("QT-07-2", "C quarter-sharp x4, accidental on every note") + [1, 2, 3, 4].map(() => qt("C", 5, 0.5, "quarter-sharp")).join(""),
    label("QT-07-3", "alter 0 / 0.5 / 1 / 0.5 in one bar") + note({ step: "C", oct: 5, alter: 0, acc: "natural" }) + qt("C", 5, 0.5, "quarter-sharp") + note({ step: "C", oct: 5, alter: 1, acc: "sharp" }) + qt("C", 5, 0.5, "quarter-sharp"),
    label("QT-07-4", "tie across barline, C quarter-sharp whole") + qt("C", 5, 0.5, "quarter-sharp", { dur: W, tie: "start", tied: "start" }),
    label("QT-07-5", "tie end, no accidental element") + note({ step: "C", oct: 5, alter: 0, dur: W, tie: "stop", tied: "stop" }),
    label("QT-07-6", "chord C quarter-sharp + E + G quarter-flat") + qt("C", 5, 0.5, "quarter-sharp", { dur: W }) + note({ step: "E", oct: 5, alter: 0, dur: W, chord: true }) + qt("G", 5, -0.5, "quarter-flat", { dur: W, chord: true }),
    label("QT-07-7", "cautionary quarter-sharp in parentheses") + qt("C", 5, 0.5, "quarter-sharp", { accAttrs: { parentheses: "yes", cautionary: "yes" } }) + rest(Q) + rest(H),
    label("QT-07-8", "same 24-EDO pitch spelled C q-sharp then D 3q-flat") + qt("C", 5, 0.5, "quarter-sharp", { dur: H }) + qt("D", 5, -1.5, "three-quarters-flat", { dur: H }),
  ];
  files.push(score("qt-07-accidental-rules", "QT-07 accidental rules, ties, chords", [{ id: "P1", inst: INSTRUMENTS.flute, measures: ms }]));
}

// ---- TECH-01: <technical> children (Reference says: not imported)
{
  const tech = (inner) => `<technical>${inner}</technical>`;
  const ms = [
    label("TECH-01-1", "open-string circle (Sibelius exports harmonic/open as this)") + note({ step: "C", oct: 5, alter: 0, dur: W, notations: [tech("<open-string/>")] }),
    label("TECH-01-2", "harmonic natural, no notehead") + note({ step: "C", oct: 5, alter: 0, dur: W, notations: [tech("<harmonic><natural/></harmonic>")] }),
    label("TECH-01-3", "harmonic natural + diamond notehead") + note({ step: "C", oct: 5, alter: 0, dur: W, notehead: "diamond", noteheadAttrs: { filled: "no" }, notations: [tech("<harmonic><natural/><touching-pitch/></harmonic>")] }),
    label("TECH-01-4", "artificial: C normal + F diamond touching") + note({ step: "C", oct: 5, alter: 0, dur: W, notations: [tech("<harmonic><artificial/><base-pitch/></harmonic>")] }) + note({ step: "F", oct: 5, alter: 0, dur: W, chord: true, notehead: "diamond", noteheadAttrs: { filled: "no" }, notations: [tech("<harmonic><artificial/><touching-pitch/></harmonic>")] }),
    label("TECH-01-5", "snap-pizzicato (Bartok)") + note({ step: "C", oct: 5, alter: 0, notations: [tech("<snap-pizzicato/>")] }) + rest(Q) + rest(H),
    label("TECH-01-6", "up-bow, down-bow") + note({ step: "C", oct: 5, alter: 0, dur: H, notations: [tech("<up-bow/>")] }) + note({ step: "C", oct: 5, alter: 0, dur: H, notations: [tech("<down-bow/>")] }),
    label("TECH-01-7", "stopped (+)") + note({ step: "C", oct: 5, alter: 0, dur: W, notations: [tech("<stopped/>")] }),
    label("TECH-01-8", "string 4 + fingering 1") + note({ step: "C", oct: 5, alter: 0, dur: W, notations: [tech("<fingering>1</fingering><string>4</string>")] }),
    label("TECH-01-9", "thumb-position") + note({ step: "C", oct: 5, alter: 0, dur: W, notations: [tech("<thumb-position/>")] }),
  ];
  files.push(score("tech-01-technical", "TECH-01 technical elements", [{ id: "P1", inst: INSTRUMENTS.violin, measures: ms }]));
}

// ---- ORN-01: <ornaments> children (Reference: trills, mordents, turns imported; others maybe not)
{
  const orn = (inner) => `<ornaments>${inner}</ornaments>`;
  const ms = [
    label("ORN-01-1", "tremolo single 3 on half notes") + note({ step: "C", oct: 5, alter: 0, dur: H, notations: [orn('<tremolo type="single">3</tremolo>')] }) + note({ step: "C", oct: 5, alter: 0, dur: H, notations: [orn('<tremolo type="single">1</tremolo>')] }),
    label("ORN-01-2", "two-note tremolo start/stop, Sibelius dialect (type whole, dur half)") + note({ step: "C", oct: 5, alter: 0, dur: H, type: "whole", notations: [orn('<tremolo type="start">3</tremolo>')] }) + note({ step: "G", oct: 4, alter: 0, dur: H, type: "whole", notations: [orn('<tremolo type="stop">3</tremolo>')] }),
    label("ORN-01-3", "two-note tremolo per spec: type half, duration quarter, time-modification 2:1, then half rest") + note({ step: "C", oct: 5, alter: 0, dur: Q, type: "half", tm: { actual: 2, normal: 1 }, notations: [orn('<tremolo type="start">3</tremolo>')] }) + note({ step: "G", oct: 4, alter: 0, dur: Q, type: "half", tm: { actual: 2, normal: 1 }, notations: [orn('<tremolo type="stop">3</tremolo>')] }) + rest(H),
    label("ORN-01-4", "trill-mark") + note({ step: "C", oct: 5, alter: 0, dur: W, notations: [orn("<trill-mark/>")] }),
    label("ORN-01-5", "trill-mark + accidental-mark quarter-sharp") + note({ step: "C", oct: 5, alter: 0, dur: W, notations: [orn('<trill-mark/><accidental-mark placement="above">quarter-sharp</accidental-mark>')] }),
    label("ORN-01-6", "mordent, turn") + note({ step: "C", oct: 5, alter: 0, dur: H, notations: [orn("<mordent/>")] }) + note({ step: "C", oct: 5, alter: 0, dur: H, notations: [orn("<turn/>")] }),
    label("ORN-01-7", "trill with wavy-line to next bar") + note({ step: "C", oct: 5, alter: 0, dur: W, notations: [orn('<trill-mark/><wavy-line type="start" number="1"/>')] }),
    label("ORN-01-8", "wavy-line stop") + note({ step: "C", oct: 5, alter: 0, dur: W, notations: [orn('<wavy-line type="stop" number="1"/>')] }),
  ];
  files.push(score("orn-01-ornaments", "ORN-01 ornaments and tremolos", [{ id: "P1", inst: INSTRUMENTS.violin, measures: ms }]));
}

// ---- ART-01: articulations and fermatas
{
  const art = (inner) => `<articulations>${inner}</articulations>`;
  const one = (id, name, inner) => label(id, name) + note({ step: "C", oct: 5, alter: 0, dur: W, notations: [inner] });
  const ms = [
    label("ART-01-1", "accent, staccato, tenuto, strong-accent") + note({ step: "C", oct: 5, alter: 0, notations: [art("<accent/>")] }) + note({ step: "C", oct: 5, alter: 0, notations: [art("<staccato/>")] }) + note({ step: "C", oct: 5, alter: 0, notations: [art("<tenuto/>")] }) + note({ step: "C", oct: 5, alter: 0, notations: [art('<strong-accent type="up"/>')] }),
    label("ART-01-2", "staccatissimo, detached-legato, spiccato, stacked accent+staccato") + note({ step: "C", oct: 5, alter: 0, notations: [art("<staccatissimo/>")] }) + note({ step: "C", oct: 5, alter: 0, notations: [art("<detached-legato/>")] }) + note({ step: "C", oct: 5, alter: 0, notations: [art("<spiccato/>")] }) + note({ step: "C", oct: 5, alter: 0, notations: [art("<accent/><staccato/>")] }),
    label("ART-01-3", "breath-mark comma, caesura") + note({ step: "C", oct: 5, alter: 0, dur: H, notations: [art("<breath-mark>comma</breath-mark>")] }) + note({ step: "C", oct: 5, alter: 0, dur: H, notations: [art("<caesura/>")] }),
    one("ART-01-4", "fermata normal", '<fermata type="upright">normal</fermata>'),
    one("ART-01-5", "fermata square", '<fermata type="upright">square</fermata>'),
    label("ART-01-6", "scoop, plop, doit, falloff") + note({ step: "C", oct: 5, alter: 0, notations: [art("<scoop/>")] }) + note({ step: "C", oct: 5, alter: 0, notations: [art("<plop/>")] }) + note({ step: "C", oct: 5, alter: 0, notations: [art("<doit/>")] }) + note({ step: "C", oct: 5, alter: 0, notations: [art("<falloff/>")] }),
  ];
  files.push(score("art-01-articulations", "ART-01 articulations and fermatas", [{ id: "P1", inst: INSTRUMENTS.violin, measures: ms }]));
}

// ---- NH-01: noteheads on a pitched staff
{
  const heads = ["normal", "x", "cross", "circle-x", "diamond", "triangle", "inverted triangle", "slash", "slashed", "back slashed", "none", "cluster", "square", "arrow up", "arrow down", "circle dot"];
  const ms = [];
  for (let i = 0; i < heads.length; i += 4) {
    const group = heads.slice(i, i + 4);
    ms.push(label(`NH-01-${i / 4 + 1}`, group.join(" / ")) + group.map((h) => note({ step: "C", oct: 5, alter: 0, notehead: h })).join(""));
  }
  ms.push(label("NH-01-5", "diamond filled=no on quarter, diamond filled=yes on whole") + note({ step: "C", oct: 5, alter: 0, notehead: "diamond", noteheadAttrs: { filled: "no" } }) + rest(Q) + rest(H));
  ms.push(label("NH-01-6", "diamond filled=yes whole; parentheses=yes normal") + note({ step: "C", oct: 5, alter: 0, dur: H, notehead: "diamond", noteheadAttrs: { filled: "yes" } }) + note({ step: "C", oct: 5, alter: 0, dur: H, notehead: "normal", noteheadAttrs: { parentheses: "yes" } }));
  files.push(score("nh-01-noteheads", "NH-01 noteheads", [{ id: "P1", inst: INSTRUMENTS.violin, measures: ms }]));
}

// ---- PERC-01: 1-line unpitched, Sibelius dialect; l.v. as dangling tie
{
  const u = (extra = {}) => note({ unpitched: { step: "E", oct: 4 }, instrument: "P1-I1", ...extra });
  const ms = [
    label("PERC-01-1", "1-line staff, E4 normal head x4") + u() + u() + u() + u(),
    label("PERC-01-2", "x notehead, then normal") + u({ notehead: "x" }) + u({ notehead: "x" }) + u() + u(),
    label("PERC-01-3", "l.v.: tie start on note, no stop (Sibelius dialect)") + u({ tie: "start", tied: { type: "start", orientation: "under" } }) + rest(Q) + rest(H),
    label("PERC-01-4", "roll: tremolo single 3 on half") + u({ dur: H, notations: ['<ornaments><tremolo type="single">3</tremolo></ornaments>'] }) + rest(H),
    label("PERC-01-5", "display-step B4 (above line) and C4 (below)") + note({ unpitched: { step: "B", oct: 4 }, instrument: "P1-I1" }) + note({ unpitched: { step: "C", oct: 4 }, instrument: "P1-I1" }) + rest(H),
  ];
  files.push(score("perc-01-one-line", "PERC-01 one-line unpitched percussion", [{ id: "P1", inst: INSTRUMENTS.perc1, measures: ms }]));
}

// ---- PERC-02: 5-line percussion, two instruments in one part
{
  const bd = (extra = {}) => note({ unpitched: { step: "F", oct: 4 }, instrument: "P1-I1", ...extra });
  const cym = (extra = {}) => note({ unpitched: { step: "G", oct: 5 }, instrument: "P1-I2", notehead: "x", ...extra });
  const ms = [
    label("PERC-02-1", "Bass Drum on F4 (space 1), Susp. Cymbal x on G5 (above)") + bd() + cym() + bd() + cym(),
    label("PERC-02-2", "chord: bass drum + cymbal together") + bd({ dur: H }) + cym({ dur: H, chord: true }) + rest(H),
    label("PERC-02-3", "two voices: bd voice 1 stem down, cym voice 2 stem up") + bd({ dur: H, stem: "down" }) + bd({ dur: H, stem: "down" }) + backup(W) + cym({ voice: 2, stem: "up" }) + cym({ voice: 2, stem: "up" }) + cym({ voice: 2, stem: "up" }) + cym({ voice: 2, stem: "up" }),
  ];
  files.push(score("perc-02-five-line-two-instruments", "PERC-02 five-line percussion, two instruments", [{ id: "P1", inst: INSTRUMENTS.perc5, extraInstruments: [{ id: "P1-I2", name: "Suspended Cymbal", sound: "metal.cymbal.suspended" }], measures: ms }]));
}

// ---- LINE-01: hairpins incl. niente, dashes, octave-shift, glissando, slide, bracket
{
  const c = (extra = {}) => note({ step: "C", oct: 5, alter: 0, ...extra });
  const fl = [
    label("LINE-01-1", "crescendo hairpin, plain") + direction('<wedge type="crescendo" number="1"/>', { placement: "below" }) + direction('<wedge type="stop" number="1"/>', { placement: "below", offset: W - 1 }) + c({ dur: W }),
    label("LINE-01-2", "crescendo from niente (niente=yes on start)") + direction('<wedge type="crescendo" number="1" niente="yes"/>', { placement: "below" }) + direction('<wedge type="stop" number="1"/>', { placement: "below", offset: W - 1 }) + c({ dur: W }),
    label("LINE-01-3", "diminuendo to niente (niente=yes on stop)") + direction('<wedge type="diminuendo" number="1"/>', { placement: "below" }) + direction('<wedge type="stop" number="1" niente="yes"/>', { placement: "below", offset: W - 1 }) + c({ dur: W }),
    label("LINE-01-4", "cresc. poco a poco + dashes") + direction(['<words font-style="italic">cresc. poco a poco</words>', '<dashes type="start" number="1"/>'], { placement: "below" }) + c({ dur: W }),
    label("LINE-01-5", "dashes stop") + direction('<dashes type="stop" number="1"/>', { placement: "below", offset: W - 1 }) + c({ dur: W }),
    label("LINE-01-6", "glissando wavy C5 to G5") + c({ dur: H, notations: ['<glissando type="start" line-type="wavy" number="1">gliss.</glissando>'] }) + note({ step: "G", oct: 5, alter: 0, dur: H, notations: ['<glissando type="stop" number="1"/>'] }),
    label("LINE-01-7", "slide solid C5 to G5") + c({ dur: H, notations: ['<slide type="start" line-type="solid" number="1"/>'] }) + note({ step: "G", oct: 5, alter: 0, dur: H, notations: ['<slide type="stop" number="1"/>'] }),
    label("LINE-01-8", "bracket line, solid, arrow end: sul pont. -> ord.") + direction(["<words>sul pont.</words>", '<bracket type="start" number="1" line-end="none" line-type="solid"/>'], { placement: "above" }) + c({ dur: W }),
    label("LINE-01-9", "bracket stop with arrow + ord.") + direction(['<bracket type="stop" number="1" line-end="arrow"/>', "<words>ord.</words>"], { placement: "above", offset: W - 1 }) + c({ dur: W }),
  ];
  const pno = [
    pianoEmpty(), pianoEmpty(), pianoEmpty(), pianoEmpty(), pianoEmpty(), pianoEmpty(), pianoEmpty(),
    label("LINE-01-8p", "8va: octave-shift down size 8, pitches written C6 (display C5)") + direction('<octave-shift type="down" size="8" number="1"/>', { placement: "above", staff: 1 }) + note({ step: "C", oct: 6, alter: 0 }) + note({ step: "C", oct: 6, alter: 0 }) + note({ step: "C", oct: 6, alter: 0 }) + note({ step: "C", oct: 6, alter: 0 }) + direction('<octave-shift type="stop" size="8" number="1"/>', { placement: "above", staff: 1 }) + backup(W) + wholeRest(2),
    label("LINE-01-9p", "8vb on lower staff: octave-shift up size 8, pitches C2 (display C3)") + wholeRest(1) + backup(W) + direction('<octave-shift type="up" size="8" number="2"/>', { placement: "below", staff: 2 }) + note({ step: "C", oct: 2, alter: 0, staff: 2 }) + note({ step: "C", oct: 2, alter: 0, staff: 2 }) + note({ step: "C", oct: 2, alter: 0, staff: 2 }) + note({ step: "C", oct: 2, alter: 0, staff: 2 }) + direction('<octave-shift type="stop" size="8" number="2"/>', { placement: "below", staff: 2 }),
  ];
  files.push(score("line-01-lines", "LINE-01 hairpins, dashes, glissando, octave shifts", [
    { id: "P1", inst: INSTRUMENTS.flute, measures: fl },
    { id: "P2", inst: INSTRUMENTS.piano, measures: pno },
  ]));
}

// ---- BEAM-01: feathered beams, sub-beams, beam over rest
{
  const c16 = (beams, extra = {}) => note({ step: "C", oct: 5, alter: 0, dur: S, beams, ...extra });
  const run = (fan) => {
    let x = "";
    for (let i = 0; i < 16; i++) {
      const v = i === 0 ? "begin" : i === 15 ? "end" : "continue";
      x += c16([{ n: 1, v, fan: i === 0 ? fan : undefined }, { n: 2, v }]);
    }
    return x;
  };
  const fl = [
    label("BEAM-01-1", "16 sixteenths, fan=accel on first beam") + run("accel"),
    label("BEAM-01-2", "16 sixteenths, fan=rit") + run("rit"),
    label("BEAM-01-3", "sub-beams: dotted-8th + 16th x2 with hooks, then 4 sixteenths") +
      note({ step: "C", oct: 5, alter: 0, dur: E + S, type: "eighth", dots: 1, beams: [{ n: 1, v: "begin" }] }) + c16([{ n: 1, v: "end" }, { n: 2, v: "backward hook" }]) +
      note({ step: "C", oct: 5, alter: 0, dur: E + S, type: "eighth", dots: 1, beams: [{ n: 1, v: "begin" }] }) + c16([{ n: 1, v: "end" }, { n: 2, v: "backward hook" }]) +
      c16([{ n: 1, v: "begin" }, { n: 2, v: "begin" }]) + c16([{ n: 1, v: "continue" }, { n: 2, v: "continue" }]) + c16([{ n: 1, v: "continue" }, { n: 2, v: "continue" }]) + c16([{ n: 1, v: "end" }, { n: 2, v: "end" }]) +
      rest(Q),
    label("BEAM-01-4", "beam across a rest: 8th, 8th rest, 8th under one beam") + note({ step: "C", oct: 5, alter: 0, dur: E, beams: [{ n: 1, v: "begin" }] }) + rest(E) + note({ step: "C", oct: 5, alter: 0, dur: E, beams: [{ n: 1, v: "end" }] }) + rest(E) + rest(H),
  ];
  files.push(score("beam-01-beams", "BEAM-01 feathered beams and sub-beams", [{ id: "P1", inst: INSTRUMENTS.flute, measures: fl }]));
}

// ---- TEXT-01: words, dynamics, tempo, rehearsal, marker strings
{
  const c = (extra = {}) => note({ step: "C", oct: 5, alter: 0, dur: W, ...extra });
  const ms = [
    label("TEXT-01-1", "words above, upright: sul pont.") + direction(words("sul pont.", { "font-style": "normal" }), { placement: "above" }) + c(),
    label("TEXT-01-2", "words below, italic: espress.") + direction(words("espress.", { "font-style": "italic" }), { placement: "below" }) + c(),
    label("TEXT-01-3", "dynamics p / f / n (niente)") + direction("<dynamics><p/></dynamics>", { placement: "below" }) + note({ step: "C", oct: 5, alter: 0, dur: H }) + direction("<dynamics><f/></dynamics>", { placement: "below" }) + note({ step: "C", oct: 5, alter: 0 }) + direction("<dynamics><n/></dynamics>", { placement: "below" }) + note({ step: "C", oct: 5, alter: 0 }),
    label("TEXT-01-4", "sub. p as words + dynamics in one direction") + `<direction placement="below"><direction-type><words font-style="italic">sub.</words></direction-type><direction-type><dynamics><p/></dynamics></direction-type></direction>` + c(),
    label("TEXT-01-5", "metronome quarter = 60 and tempo word Adagio") + `<direction placement="above"><direction-type><words font-weight="bold">Adagio</words></direction-type><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>60</per-minute></metronome></direction-type></direction>` + c(),
    label("TEXT-01-6", "rehearsal mark A, boxed") + direction('<rehearsal enclosure="rectangle">A</rehearsal>', { placement: "above" }) + c(),
    label("TEXT-01-7", "marker strings for plugin: §q+ §h §tr3") + direction(words("§q+"), { placement: "above" }) + note({ step: "C", oct: 5, alter: 0 }) + direction(words("§h"), { placement: "above" }) + note({ step: "C", oct: 5, alter: 0 }) + direction(words("§tr3"), { placement: "above" }) + note({ step: "C", oct: 5, alter: 0, dur: H }),
    label("TEXT-01-8", "words with enclosure rectangle, font-size 14") + direction(words("BOXED", { enclosure: "rectangle", "font-size": "14" }), { placement: "above" }) + c(),
  ];
  files.push(score("text-01-text", "TEXT-01 text, dynamics, tempo, markers", [{ id: "P1", inst: INSTRUMENTS.flute, measures: ms }]));
}

// ---- INST-01: instrument change Flute -> Piccolo, Sibelius dialect
{
  const fl = [
    label("INST-01-1", "Flute C5 whole") + note({ step: "C", oct: 5, alter: 0, dur: W, instrument: "P1-I1" }),
    label("INST-01-2", "To Picc. as words; instrument still flute") + direction(words("To Picc."), { placement: "above" }) + note({ step: "C", oct: 5, alter: 0, dur: W, instrument: "P1-I1" }),
    `<print><part-name-display><display-text>Piccolo</display-text></part-name-display><part-abbreviation-display><display-text>Picc.</display-text></part-abbreviation-display></print>` +
      `<attributes><transpose><diatonic>0</diatonic><chromatic>0</chromatic><octave-change>1</octave-change></transpose></attributes>` +
      label("INST-01-3", "Piccolo: instrument P1-I2, transpose octave-change 1, written C5") + note({ step: "C", oct: 5, alter: 0, instrument: "P1-I2" }) + note({ step: "D", oct: 5, alter: 0, instrument: "P1-I2" }) + note({ step: "F", oct: 5, alter: 0, instrument: "P1-I2" }) + rest(Q, { instrument: "P1-I2" }),
    label("INST-01-4", "Piccolo quarter-sharp") + qt("C", 5, 0.5, "quarter-sharp", { instrument: "P1-I2", dur: W }),
  ];
  files.push(score("inst-01-instrument-change", "INST-01 instrument change Flute to Piccolo", [{ id: "P1", inst: INSTRUMENTS.flute, extraInstruments: [{ id: "P1-I2", name: "Piccolo", sound: "wind.flutes.flute.piccolo" }], measures: fl }]));
}

// ---- METH-01/02/03: same content as QT-01, varying supports / version
{
  const acc = [["quarter-sharp", 0.5], ["quarter-flat", -0.5], ["three-quarters-sharp", 1.5], ["three-quarters-flat", -1.5]];
  const mk = (prefix) => {
    const ms = [trio(`${prefix}-1`, "control: natural", (s) => note({ step: s, oct: 5, alter: 0 }))];
    acc.forEach(([a, semis], i) => ms.push(trio(`${prefix}-${i + 2}`, `${a}, alter ${truncAlter(semis)}`, (s) => qt(s, 5, semis, a))));
    return ms;
  };
  files.push(score("meth-01-no-supports", "METH-01 QT-01 content without supports", [{ id: "P1", inst: INSTRUMENTS.flute, measures: mk("METH-01") }], { supports: false }));
  files.push(score("meth-02-version-3.1", "METH-02 QT-01 content declared 3.1, no DOCTYPE", [{ id: "P1", inst: INSTRUMENTS.flute, measures: mk("METH-02") }], { version: "3.1", doctype: false }));
  files.push(score("meth-03-version-4.0", "METH-03 QT-01 content declared 4.0, no DOCTYPE", [{ id: "P1", inst: INSTRUMENTS.flute, measures: mk("METH-03") }], { version: "4.0", doctype: false }));
}

// ================================================================ run 2 (fractional alter)

// ---- QT-06b: transposing instruments and timpani, fractional alter
{
  const fl = [trio("QT-06b-1", "Fl control", (s) => note({ step: s, oct: 5, alter: 0 })), trio("QT-06b-2", "Fl C D F quarter-sharp, alter 0.5", (s) => qtf(s, 5, 0.5, "quarter-sharp")), wholeRest(), wholeRest()];
  const cl = [trio("QT-06b-1", "Cl written D E G natural", (s) => note({ step: { C: "D", D: "E", F: "G" }[s], oct: 5, alter: 0 })),
    trio("QT-06b-2", "Cl written D E G quarter-sharp = sounding C D F quarter-sharp", (s) => qtf({ C: "D", D: "E", F: "G" }[s], 5, 0.5, "quarter-sharp")),
    trio("QT-06b-3", "Cl written D E G three-quarters-flat, alter -1.5", (s) => qtf({ C: "D", D: "E", F: "G" }[s], 5, -1.5, "three-quarters-flat")), wholeRest()];
  const hn = [wholeRest(), trio("QT-06b-2", "Hn written G A C quarter-sharp = sounding C D F quarter-sharp", (s) => qtf({ C: "G", D: "A", F: "C" }[s], s === "F" ? 6 : 5, 0.5, "quarter-sharp")), wholeRest(), wholeRest()];
  const timp = [wholeRest(), wholeRest(), wholeRest(), label("QT-06b-4", "Timp C3 quarter-sharp, D3 quarter-flat, alter 0.5 / -0.5") + qtf("C", 3, 0.5, "quarter-sharp") + qtf("D", 3, -0.5, "quarter-flat") + rest(H)];
  files.push(score("qt-06b-transposing-alter-half", "QT-06b quarter tones on transposing instruments, fractional alter", [
    { id: "P1", inst: INSTRUMENTS.flute, measures: fl },
    { id: "P2", inst: INSTRUMENTS.clarinet, measures: cl },
    { id: "P3", inst: INSTRUMENTS.horn, measures: hn },
    { id: "P4", inst: INSTRUMENTS.timpani, measures: timp },
  ]));
}

// ---- QT-07b: accidental rules, ties, chords, cautionary, fractional alter
{
  const ms = [
    label("QT-07b-1", "C quarter-sharp x4 (alter 0.5 on all), accidental element only on first") + qtf("C", 5, 0.5, "quarter-sharp") + note({ step: "C", oct: 5, alter: 0.5 }) + note({ step: "C", oct: 5, alter: 0.5 }) + note({ step: "C", oct: 5, alter: 0.5 }),
    label("QT-07b-2", "C quarter-sharp x4, accidental element on every note") + [1, 2, 3, 4].map(() => qtf("C", 5, 0.5, "quarter-sharp")).join(""),
    label("QT-07b-3", "alter 0 / 0.5 / 1 / 0.5 in one bar") + note({ step: "C", oct: 5, alter: 0, acc: "natural" }) + qtf("C", 5, 0.5, "quarter-sharp") + note({ step: "C", oct: 5, alter: 1, acc: "sharp" }) + qtf("C", 5, 0.5, "quarter-sharp"),
    label("QT-07b-4", "tie across barline, C quarter-sharp whole") + qtf("C", 5, 0.5, "quarter-sharp", { dur: W, tie: "start", tied: "start" }),
    label("QT-07b-5", "tie end: alter 0.5, no accidental element") + note({ step: "C", oct: 5, alter: 0.5, dur: W, tie: "stop", tied: "stop" }),
    label("QT-07b-6", "chord C quarter-sharp + E + G quarter-flat") + qtf("C", 5, 0.5, "quarter-sharp", { dur: W }) + note({ step: "E", oct: 5, alter: 0, dur: W, chord: true }) + qtf("G", 5, -0.5, "quarter-flat", { dur: W, chord: true }),
    label("QT-07b-7", "cautionary quarter-sharp in parentheses") + qtf("C", 5, 0.5, "quarter-sharp", { accAttrs: { parentheses: "yes", cautionary: "yes" } }) + rest(Q) + rest(H),
    label("QT-07b-8", "same 24-EDO pitch spelled C q-sharp then D 3q-flat") + qtf("C", 5, 0.5, "quarter-sharp", { dur: H }) + qtf("D", 5, -1.5, "three-quarters-flat", { dur: H }),
    label("QT-07b-9", "octave leak: C5 quarter-sharp then C4 (alter 0), C6 (alter 0)") + qtf("C", 5, 0.5, "quarter-sharp") + note({ step: "C", oct: 4, alter: 0 }) + note({ step: "C", oct: 6, alter: 0 }) + rest(Q),
    label("QT-07b-10", "two voices: v1 C5 q-sharp, v2 C5 alter 0 same beat") + qtf("C", 5, 0.5, "quarter-sharp", { dur: W, voice: 1, stem: "up" }) + backup(W) + note({ step: "C", oct: 5, alter: 0, dur: W, voice: 2, stem: "down" }),
  ];
  files.push(score("qt-07b-accidental-rules-alter-half", "QT-07b accidental rules, ties, chords, fractional alter", [{ id: "P1", inst: INSTRUMENTS.flute, measures: ms }]));
}

// ---- INST-02: instrument change variants
{
  // (a) marker text only, plugin would add the change; no instrument switch, no transpose
  const a = [
    label("INST-02a-1", "Flute C5 whole") + note({ step: "C", oct: 5, alter: 0, dur: W }),
    label("INST-02a-2", "To Picc. + marker §inst:Piccolo; no instrument switch in XML") + direction(words("To Picc."), { placement: "above" }) + direction(words("§inst:Piccolo"), { placement: "above" }) + note({ step: "C", oct: 5, alter: 0, dur: W }),
    label("INST-02a-3", "still flute in XML: written C5 quarter-sharp") + qtf("C", 5, 0.5, "quarter-sharp", { dur: W }),
    wholeRest(),
  ];
  // (b) instrument switch by <instrument id> only, no transpose change
  const b = [
    label("INST-02b-1", "Flute C5 whole, instrument P2-I1") + note({ step: "C", oct: 5, alter: 0, dur: W, instrument: "P2-I1" }),
    label("INST-02b-2", "To Picc.; next bar switches instrument id only") + direction(words("To Picc."), { placement: "above" }) + note({ step: "C", oct: 5, alter: 0, dur: W, instrument: "P2-I1" }),
    `<print><part-name-display><display-text>Piccolo</display-text></part-name-display></print>` + label("INST-02b-3", "instrument P2-I2 (Piccolo), no transpose element, C5 quarter-sharp") + qtf("C", 5, 0.5, "quarter-sharp", { dur: W, instrument: "P2-I2" }),
    label("INST-02b-4", "still P2-I2: C D F") + note({ step: "C", oct: 5, alter: 0, instrument: "P2-I2" }) + note({ step: "D", oct: 5, alter: 0, instrument: "P2-I2" }) + note({ step: "F", oct: 5, alter: 0, instrument: "P2-I2" }) + rest(Q, { instrument: "P2-I2" }),
  ];
  // (c) Piccolo as its own part from the start
  const c = [
    label("INST-02c-1", "separate Piccolo part, octave-change 1: written C5") + note({ step: "C", oct: 5, alter: 0, dur: W }),
    label("INST-02c-2", "Piccolo C5 quarter-sharp") + qtf("C", 5, 0.5, "quarter-sharp", { dur: W }),
    wholeRest(), wholeRest(),
  ];
  const piccolo = { name: "Piccolo", abbr: "Picc.", sound: "wind.flutes.flute.piccolo", clef: ["G", 2], transpose: { diatonic: 0, chromatic: 0, octaveChange: 1 } };
  files.push(score("inst-02-instrument-change-variants", "INST-02 instrument change variants", [
    { id: "P1", inst: INSTRUMENTS.flute, measures: a },
    { id: "P2", inst: INSTRUMENTS.flute, extraInstruments: [{ id: "P2-I2", name: "Piccolo", sound: "wind.flutes.flute.piccolo" }], measures: b },
    { id: "P3", inst: piccolo, measures: c },
  ]));
}

// ---- FIX-01: markers for the TakemitsuFix plugin (run the plugin after import, then compare)
{
  const c = (extra = {}) => note({ step: "C", oct: 5, alter: 0, ...extra });
  const mk = (text) => direction(words(text), { placement: "above" });
  const vln = [
    label("FIX-01-1", "§h -> harmonic circle on whole note") + mk("§h") + c({ dur: W }),
    label("FIX-01-2", "§plus -> + on whole note") + mk("§plus") + c({ dur: W }),
    label("FIX-01-3", "§sym:Snap 2 -> Bartok pizz symbol") + mk("§sym:Snap 2") + c() + rest(Q) + rest(H),
    label("FIX-01-4", "§nfrom -> crescendo from niente") + mk("§nfrom") + direction('<wedge type="crescendo" number="1"/>', { placement: "below" }) + direction('<wedge type="stop" number="1"/>', { placement: "below", offset: W - 1 }) + c({ dur: W }),
    label("FIX-01-5", "§nto -> diminuendo to niente") + mk("§nto") + direction('<wedge type="diminuendo" number="1"/>', { placement: "below" }) + direction('<wedge type="stop" number="1"/>', { placement: "below", offset: W - 1 }) + c({ dur: W }),
    label("FIX-01-6", "cresc. poco a poco + §line:line.staff.dashed:1024") + direction(words("cresc. poco a poco", { "font-style": "italic" }), { placement: "below" }) + mk("§line:line.staff.dashed:1024") + c({ dur: W }),
    label("FIX-01-7", "sul pont. + §line:line.staff.arrow.black.right:1024 -> arrow to next bar") + direction(words("sul pont."), { placement: "above" }) + mk("§line:line.staff.arrow.black.right:1024") + c({ dur: W }),
    label("FIX-01-8", "§text:text.staff.technique:ord.") + mk("§text:text.staff.technique:ord.") + c({ dur: W }),
    label("FIX-01-9", "trill + §sym:Quarter sharp:40 + §line:line.staff.trill:768") + mk("§sym:Quarter sharp:40") + mk("§line:line.staff.trill:768") + c({ dur: W, notations: ["<ornaments><trill-mark/></ornaments>"] }),
    label("FIX-01-10", "§nh:2 -> diamond heads on chord; §trem:3") + mk("§nh:2") + c({ dur: H }) + note({ step: "E", oct: 5, alter: 0, dur: H, chord: true }) + mk("§trem:3") + c({ dur: H }),
    label("FIX-01-11", "two voices: §h on voice 2 only") + c({ dur: W, voice: 1, stem: "up" }) + backup(W) + mk("§h") + note({ step: "E", oct: 4, alter: 0, dur: W, voice: 2, stem: "down" }),
    label("FIX-01-12", "unknown marker §zzz stays (logged as FAIL)") + mk("§zzz") + c({ dur: W }),
  ];
  const fl = [
    wholeRest(), wholeRest(), wholeRest(), wholeRest(), wholeRest(), wholeRest(), wholeRest(), wholeRest(), wholeRest(), wholeRest(), wholeRest(),
    label("FIX-01-12f", "§inst:instrument.wind.piccolo:Piccolo -> instrument change") + mk("§inst:instrument.wind.piccolo:Piccolo") + c({ dur: W }),
  ];
  files.push(score("fix-01-markers", "FIX-01 markers for the Takemitsu fix plugin", [
    { id: "P1", inst: INSTRUMENTS.violin, measures: vln },
    { id: "P2", inst: INSTRUMENTS.flute, measures: fl },
  ]));
}

// ---- X31-01: MusicXML 3.1-only constructs (let-ring, smufl accidental, soft-accent)
{
  const ms = [
    label("X31-01-1", "tied let-ring (3.1)") + note({ step: "C", oct: 5, alter: 0, dur: W, tied: { type: "let-ring" } }),
    label("X31-01-2", "accidental smufl=accidentalQuarterToneSharpStein value quarter-sharp") + qt("C", 5, 0.5, "quarter-sharp", { dur: W, accAttrs: { smufl: "accidentalQuarterToneSharpStein" } }),
    label("X31-01-3", "accidental other + smufl accidentalQuarterToneFlatArrowUp") + note({ step: "C", oct: 5, alter: -0.5, acc: "other", accAttrs: { smufl: "accidentalQuarterToneFlatArrowUp" }, dur: W }),
    label("X31-01-4", "soft-accent (3.1), tremolo unmeasured (3.1)") + note({ step: "C", oct: 5, alter: 0, dur: H, notations: ["<articulations><soft-accent/></articulations>"] }) + note({ step: "C", oct: 5, alter: 0, dur: H, notations: ['<ornaments><tremolo type="unmeasured">3</tremolo></ornaments>'] }),
  ];
  files.push(score("x31-01-musicxml-3.1-features", "X31-01 MusicXML 3.1-only constructs", [{ id: "P1", inst: INSTRUMENTS.violin, measures: ms }], { version: "3.1", doctype: false }));
}

for (const f of files) console.log(f);

// Instruments as they appear on paper: names, clefs, written octave, range.
// Independent of any sound library; playback maps live in src/libraries/.
//
// Adding an instrument while composing:
// 1. Add a line here (unpitched percussion: one `perc(…)` line).
// 2. Sound: put audio files in samples/<id>/ (docs/decisions/0012), or map it to a BBC SO patch
//    in src/libraries/bbcso/map.ts. Without either, it is written in the score and plays silent
//    with a warning.
// Techniques are listed in src/instruments/techniques.ts, shared by all instruments.

export type Family = "woodwind" | "brass" | "percussion" | "keyboard" | "harp" | "strings";

export interface Clef {
  sign: "G" | "F" | "C" | "percussion";
  line: number;
}

/** How a staff may leave its own clef when the notes go far from it (src/notation/registers.ts). */
export interface Register {
  /** Other clefs the staff may change to, e.g. tenor and treble for cellos. */
  clefs?: Clef[];
  /** Octave lines the staff may use: 8va and 15ma above ("up"), 8vb and 15mb below ("down"). */
  ottava?: "up" | "down" | "both";
}

export interface Instrument {
  id: string;
  name: string;
  abbreviation: string;
  family: Family;
  /** Clef per staff (two entries for piano, harp …): the staff's own clef. */
  clefs: Clef[];
  /** Per staff: where the staff may change clef or use octave lines. */
  registers?: Register[];
  /**
   * Written this many octaves above sounding pitch, even in a score in C: piccolo −1,
   * glockenspiel −2, contrabasses +1.
   */
  writtenOctave?: number;
  /** Players in the full section; parts default to this for strings (docs/decisions/0015). */
  sectionSize?: number;
  /** Unpitched percussion: one-line staff. */
  unpitched?: boolean;
  /** Sounding range in MIDI numbers, for warnings. */
  range?: [number, number];
}

const treble: Clef = { sign: "G", line: 2 };
const bass: Clef = { sign: "F", line: 4 };
const alto: Clef = { sign: "C", line: 3 };
const tenor: Clef = { sign: "C", line: 4 };

const up: Register = { ottava: "up" };
const down: Register = { ottava: "down" };
/** Piano, harp …: each staff may take the other's clef, and octave lines both ways. */
const keyboard: Register[] = [
  { clefs: [bass], ottava: "both" },
  { clefs: [treble], ottava: "both" },
];

type Extra = Partial<Omit<Instrument, "id" | "name" | "abbreviation" | "family">>;

const woodwind = (
  id: string,
  name: string,
  abbreviation: string,
  range: [number, number],
  extra: Extra = {},
): Instrument => ({
  id,
  name,
  abbreviation,
  family: "woodwind",
  clefs: [treble],
  range,
  ...extra,
});
const brass = (
  id: string,
  name: string,
  abbreviation: string,
  range: [number, number],
  extra: Extra = {},
): Instrument => ({
  id,
  name,
  abbreviation,
  family: "brass",
  clefs: [bass],
  range,
  ...extra,
});
const pitchedPerc = (
  id: string,
  name: string,
  abbreviation: string,
  range: [number, number],
  extra: Extra = {},
): Instrument => ({
  id,
  name,
  abbreviation,
  family: "percussion",
  clefs: [treble],
  range,
  ...extra,
});
const perc = (id: string, name: string, abbreviation: string): Instrument => ({
  id,
  name,
  abbreviation,
  family: "percussion",
  clefs: [{ sign: "percussion", line: 2 }],
  unpitched: true,
});
const strings = (
  id: string,
  name: string,
  abbreviation: string,
  clef: Clef,
  sectionSize: number,
  range: [number, number],
  extra: Extra = {},
): Instrument => ({
  id,
  name,
  abbreviation,
  family: "strings",
  clefs: [clef],
  sectionSize,
  range,
  ...extra,
});

const list: Instrument[] = [
  woodwind("piccolo", "Piccolo", "Picc.", [74, 108], { writtenOctave: -1, registers: [up] }),
  woodwind("flute", "Flute", "Fl.", [59, 98], { registers: [up] }),
  woodwind("alto-flute", "Alto Flute", "A. Fl.", [55, 91], { registers: [up] }),
  woodwind("bass-flute", "Bass Flute", "B. Fl.", [48, 84], { writtenOctave: 1 }),
  woodwind("oboe", "Oboe", "Ob.", [58, 93]),
  woodwind("cor-anglais", "Cor anglais", "C. ingl.", [52, 81]),
  woodwind("clarinet", "Clarinet", "Cl.", [50, 94]),
  woodwind("eb-clarinet", "Clarinet in E♭", "E♭ Cl.", [55, 98]),
  woodwind("bass-clarinet", "Bass Clarinet", "B. Cl.", [34, 77], { writtenOctave: 1 }),
  woodwind("contrabass-clarinet", "Contrabass Clarinet", "Cb. Cl.", [22, 65], {
    writtenOctave: 2,
  }),
  woodwind("bassoon", "Bassoon", "Bsn.", [34, 75], {
    clefs: [bass],
    registers: [{ clefs: [tenor] }],
  }),
  woodwind("contrabassoon", "Contrabassoon", "Cbsn.", [22, 53], {
    clefs: [bass],
    writtenOctave: 1,
  }),

  brass("horn", "Horn", "Hn.", [34, 77], { clefs: [treble], registers: [{ clefs: [bass] }] }),
  brass("trumpet", "Trumpet", "Tpt.", [54, 84], { clefs: [treble] }),
  brass("trombone", "Trombone", "Tbn.", [40, 72], { registers: [{ clefs: [tenor] }] }),
  brass("bass-trombone", "Bass Trombone", "B. Tbn.", [28, 67]),
  brass("contrabass-trombone", "Contrabass Trombone", "Cb. Tbn.", [23, 60], { registers: [down] }),
  brass("cimbasso", "Cimbasso", "Cimb.", [23, 58], { registers: [down] }),
  brass("tuba", "Tuba", "Tba.", [26, 65], { registers: [down] }),
  brass("contrabass-tuba", "Contrabass Tuba", "Cb. Tba.", [21, 58], { registers: [down] }),

  pitchedPerc("timpani", "Timpani", "Timp.", [38, 60], { clefs: [bass] }),
  pitchedPerc("glockenspiel", "Glockenspiel", "Glk.", [79, 108], { writtenOctave: -2 }),
  pitchedPerc("xylophone", "Xylophone", "Xyl.", [65, 108], {
    writtenOctave: -1,
    registers: [up],
  }),
  pitchedPerc("marimba", "Marimba", "Mar.", [45, 96], {
    clefs: [treble, bass],
    registers: keyboard,
  }),
  pitchedPerc("vibraphone", "Vibraphone", "Vib.", [53, 89], { registers: [up] }),
  pitchedPerc("crotales", "Crotales", "Crot.", [84, 108], { writtenOctave: -2 }),
  pitchedPerc("tubular-bells", "Tubular Bells", "T. Bells", [60, 77]),
  {
    id: "celesta",
    name: "Celesta",
    abbreviation: "Cel.",
    family: "keyboard",
    clefs: [treble, bass],
    registers: keyboard,
    writtenOctave: -1,
    range: [60, 108],
  },
  {
    id: "piano",
    name: "Piano",
    abbreviation: "Pno.",
    family: "keyboard",
    clefs: [treble, bass],
    registers: keyboard,
    range: [21, 108],
  },
  {
    id: "harp",
    name: "Harp",
    abbreviation: "Hp.",
    family: "harp",
    clefs: [treble, bass],
    registers: keyboard,
    range: [23, 104],
  },

  perc("snare-drum", "Snare Drum", "S. D."),
  perc("military-drum", "Military Drum", "Mil. Dr."),
  perc("tenor-drum", "Tenor Drum", "T. D."),
  perc("bass-drum", "Bass Drum", "B. D."),
  perc("suspended-cymbal", "Suspended Cymbal", "Sus. Cym."),
  perc("clash-cymbals", "Clash Cymbals", "Cym."),
  perc("tam-tam", "Tam-tam", "T.-t."),
  perc("triangle", "Triangle", "Trgl."),
  perc("tambourine", "Tambourine", "Tamb."),
  perc("anvil", "Anvil", "Anv."),
  perc("castanets", "Castanets", "Cast."),
  perc("woodblock-high", "Woodblock (high)", "W. B. h."),
  perc("woodblock-medium", "Woodblock (medium)", "W. B. m."),
  perc("woodblock-low", "Woodblock (low)", "W. B. l."),
  perc("vibraslap", "Vibraslap", "Vibrasl."),
  perc("cowbell", "Cowbell", "Cowb."),
  perc("sleigh-bells", "Sleigh Bells", "Sl. B."),
  perc("guiro", "Guiro", "Guiro"),
  perc("ratchet", "Ratchet", "Ratch."),

  strings("violins-1", "Violins I", "Vn. I", treble, 16, [55, 103], { registers: [up] }),
  strings("violins-2", "Violins II", "Vn. II", treble, 14, [55, 100], { registers: [up] }),
  strings("violas", "Violas", "Va.", alto, 12, [48, 91], { registers: [{ clefs: [treble] }] }),
  strings("cellos", "Violoncellos", "Vc.", bass, 10, [36, 84], {
    registers: [{ clefs: [tenor, treble] }],
  }),
  strings("basses", "Contrabasses", "Cb.", bass, 8, [28, 67], {
    writtenOctave: 1,
    registers: [{ clefs: [tenor, treble] }],
  }),
];

export const catalog: ReadonlyMap<string, Instrument> = new Map(list.map((i) => [i.id, i]));

export function instrument(id: string): Instrument {
  const found = catalog.get(id);
  if (!found)
    throw new Error(`Unknown instrument "${id}". Known: ${[...catalog.keys()].join(", ")}`);
  return found;
}

/** Players a part stands for: explicit, or the whole section for strings, or 1. */
export function playersOf(part: { instrument: string; players?: number }): number {
  return part.players ?? instrument(part.instrument).sectionSize ?? 1;
}

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
  /** Ledger lines a note may need before it takes an octave line (default 3). */
  far?: number;
  /**
   * What a measure in one of `clefs` costs, against ledger lines (default 0.5). Higher for a clef
   * the players rarely see, so the staff takes it only for a long, deep passage.
   */
  away?: number;
}

export interface Instrument {
  id: string;
  /** Names as the full score prints them (English, docs/decisions/0021). */
  name: string;
  abbreviation: string;
  /** Name for a staff of several players ("Flutes 1.2"), when it differs. */
  plural?: string;
  /** Key of a transposing instrument, printed in its name even in a score in C ("in B♭"). */
  key?: string;
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
  /** Pitch fixed by keys, bars or strings: plays no quarter tones (docs/antara/sound.md). */
  fixedPitch?: boolean;
  /** Sounding range in MIDI numbers, for warnings. */
  range?: [number, number];
  /**
   * What tells Sibelius which of its instruments this is, written into the MusicXML's
   * score-instrument: the name of its own instrument type, and the MusicXML standard sound
   * (the table in `sibelius` below).
   */
  sibelius?: { name: string; sound: string };
}

const treble: Clef = { sign: "G", line: 2 };
const bass: Clef = { sign: "F", line: 4 };
const alto: Clef = { sign: "C", line: 3 };
const tenor: Clef = { sign: "C", line: 4 };

const up: Register = { ottava: "up" };
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
  woodwind("piccolo", "Piccolo", "Picc.", [74, 108], { writtenOctave: -1 }),
  woodwind("flute", "Flute", "Fl.", [59, 98], { plural: "Flutes" }),
  woodwind("alto-flute", "Alto Flute", "A. Fl.", [55, 91]),
  woodwind("bass-flute", "Bass Flute", "B. Fl.", [48, 84], { writtenOctave: 1 }),
  woodwind("oboe", "Oboe", "Ob.", [58, 93], { plural: "Oboes" }),
  woodwind("cor-anglais", "English Horn", "E. H.", [52, 81]),
  // Clarinettists read treble: in the score in C, bass clef only for a long passage deep in the
  // chalumeau, not for one that hovers a few ledger lines below the staff.
  woodwind("clarinet", "Clarinet", "Cl.", [50, 94], {
    plural: "Clarinets",
    key: "B♭",
    registers: [{ clefs: [bass], away: 6 }],
  }),
  woodwind("eb-clarinet", "Clarinet in E♭", "E♭ Cl.", [55, 98]),
  // In a score in C, at sounding pitch in bass clef (treble up high), not an octave up in treble.
  woodwind("bass-clarinet", "Bass Clarinet", "B. Cl.", [34, 77], {
    key: "B♭",
    clefs: [bass],
    registers: [{ clefs: [treble] }],
  }),
  woodwind("contrabass-clarinet", "Contrabass Clarinet", "Cb. Cl.", [22, 65], {
    key: "B♭",
    writtenOctave: 2,
  }),
  woodwind("bassoon", "Bassoon", "Bsn.", [34, 75], {
    plural: "Bassoons",
    clefs: [bass],
    registers: [{ clefs: [tenor] }],
  }),
  woodwind("contrabassoon", "Contrabassoon", "Cbsn.", [22, 53], {
    clefs: [bass],
    writtenOctave: 1,
  }),

  brass("horn", "Horn", "Hn.", [34, 77], {
    plural: "Horns",
    key: "F",
    clefs: [treble],
    registers: [{ clefs: [bass] }],
  }),
  brass("trumpet", "Trumpet", "Tpt.", [52, 84], { plural: "Trumpets", key: "B♭", clefs: [treble] }),
  brass("trombone", "Trombone", "Tbn.", [40, 72], {
    plural: "Trombones",
    registers: [{ clefs: [tenor] }],
  }),
  brass("bass-trombone", "Bass Trombone", "B. Tbn.", [28, 67]),
  brass("contrabass-trombone", "Contrabass Trombone", "Cb. Tbn.", [23, 60]),
  brass("cimbasso", "Cimbasso", "Cimb.", [23, 58]),
  brass("tuba", "Tuba", "Tba.", [26, 65]),
  brass("contrabass-tuba", "Contrabass Tuba", "Cb. Tba.", [21, 58]),

  pitchedPerc("timpani", "Timpani", "Timp.", [38, 60], { clefs: [bass] }),
  pitchedPerc("glockenspiel", "Glockenspiel", "Glock.", [79, 108], {
    writtenOctave: -2,
    fixedPitch: true,
  }),
  pitchedPerc("xylophone", "Xylophone", "Xyl.", [65, 108], {
    writtenOctave: -1,
    registers: [up],
    fixedPitch: true,
  }),
  pitchedPerc("marimba", "Marimba", "Mar.", [45, 96], {
    clefs: [treble, bass],
    registers: keyboard,
    fixedPitch: true,
  }),
  pitchedPerc("vibraphone", "Vibraphone", "Vib.", [53, 89], { registers: [up], fixedPitch: true }),
  pitchedPerc("crotales", "Crotales", "Crot.", [84, 108], { writtenOctave: -2, fixedPitch: true }),
  pitchedPerc("tubular-bells", "Tubular Bells", "Tub. B.", [60, 77], { fixedPitch: true }),
  {
    id: "celesta",
    name: "Celesta",
    abbreviation: "Cel.",
    family: "keyboard",
    clefs: [treble, bass],
    registers: keyboard,
    writtenOctave: -1,
    range: [60, 108],
    fixedPitch: true,
  },
  {
    id: "piano",
    name: "Piano",
    abbreviation: "Pno.",
    family: "keyboard",
    clefs: [treble, bass],
    registers: keyboard,
    range: [21, 108],
    fixedPitch: true,
  },
  {
    id: "harp",
    name: "Harp",
    abbreviation: "Hp.",
    plural: "Harps",
    family: "harp",
    clefs: [treble, bass],
    registers: keyboard,
    range: [23, 104],
    fixedPitch: true,
  },

  perc("snare-drum", "Snare Drum", "S. D."),
  perc("military-drum", "Military Drum", "Mil. Dr."),
  perc("tenor-drum", "Tenor Drum", "T. D."),
  perc("bass-drum", "Bass Drum", "B. D."),
  perc("suspended-cymbal", "Suspended Cymbal", "Sus. Cym."),
  perc("clash-cymbals", "Clash Cymbals", "Cym."),
  perc("tam-tam", "Tam-tam", "T.-t."),
  perc("triangle", "Triangle", "Tri."),
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
  perc("shaker", "Shaker", "Shak."),
  perc("thunder-sheet", "Thunder Sheet", "Th. Sh."),

  // Violins take an octave line only for extreme heights (MOLA: avoid 8va).
  strings("violins-1", "Violin I", "Vln. I", treble, 16, [55, 103], {
    registers: [{ ottava: "up", far: 5 }],
  }),
  strings("violins-2", "Violin II", "Vln. II", treble, 14, [55, 100], {
    registers: [{ ottava: "up", far: 5 }],
  }),
  strings("violas", "Viola", "Vla.", alto, 12, [48, 91], { registers: [{ clefs: [treble] }] }),
  strings("cellos", "Violoncello", "Vc.", bass, 10, [36, 84], {
    registers: [{ clefs: [tenor, treble] }],
  }),
  strings("basses", "Double Bass", "D. B.", bass, 8, [28, 67], {
    writtenOctave: 1,
    registers: [{ clefs: [tenor, treble] }],
  }),
];

/**
 * Each instrument as Sibelius names its own type (the ManuScript guide's "Instrument Types"), and
 * its MusicXML standard sound (sounds.xml, bundled with Sibelius). How the importer matches them
 * is not documented; giving both, with the octave in <transpose>, is the best signal a file has.
 */
const sibelius: Record<string, [string, string]> = {
  piccolo: ["Piccolo", "wind.flutes.flute.piccolo"],
  flute: ["Flute", "wind.flutes.flute"],
  "alto-flute": ["Alto Flute", "wind.flutes.flute.alto"],
  "bass-flute": ["Bass Flute", "wind.flutes.flute.bass"],
  oboe: ["Oboe", "wind.reed.oboe"],
  "cor-anglais": ["Cor Anglais", "wind.reed.english-horn"],
  clarinet: ["Clarinet in Bb", "wind.reed.clarinet.bflat"],
  "eb-clarinet": ["Clarinet in Eb", "wind.reed.clarinet.eflat"],
  "bass-clarinet": ["Bass Clarinet in Bb", "wind.reed.clarinet.bass"],
  "contrabass-clarinet": [
    "Contrabass Clarinet in Bb [score sounds 15mb]",
    "wind.reed.clarinet.contrabass",
  ],
  bassoon: ["Bassoon", "wind.reed.bassoon"],
  contrabassoon: ["Contrabassoon", "wind.reed.contrabassoon"],
  horn: ["Horn in F", "brass.french-horn"],
  trumpet: ["Trumpet in Bb", "brass.trumpet.bflat"],
  trombone: ["Trombone", "brass.trombone"],
  "bass-trombone": ["Bass Trombone", "brass.trombone.bass"],
  "contrabass-trombone": ["Contrabass Trombone", "brass.trombone.contrabass"],
  cimbasso: ["Cimbasso in F", "brass.cimbasso"],
  tuba: ["Tuba", "brass.tuba"],
  "contrabass-tuba": ["Tuba", "brass.tuba"],
  timpani: ["Timpani [no key]", "drum.timpani"],
  glockenspiel: ["Glockenspiel", "pitched-percussion.glockenspiel"],
  xylophone: ["Xylophone", "pitched-percussion.xylophone"],
  marimba: ["Marimba [grand staff]", "pitched-percussion.marimba"],
  vibraphone: ["Vibraphone", "pitched-percussion.vibraphone"],
  crotales: ["Crotales", "metal.crotales"],
  "tubular-bells": ["Tubular Bells", "pitched-percussion.tubular-bells"],
  celesta: ["Celesta", "keyboard.celesta"],
  piano: ["Piano", "keyboard.piano"],
  harp: ["Harp", "pluck.harp"],
  "snare-drum": ["Snare Drum", "drum.snare-drum"],
  "military-drum": ["Side Drum", "drum.snare-drum"],
  "tenor-drum": ["Tenor Drum", "drum.tenor-drum"],
  "bass-drum": ["Bass Drum", "drum.bass-drum"],
  "suspended-cymbal": ["Cymbals", "metal.cymbal.suspended"],
  "clash-cymbals": ["Cymbals", "metal.cymbal.clash"],
  "tam-tam": ["Tam-tam", "metal.tamtam"],
  triangle: ["Triangle", "metal.triangle"],
  tambourine: ["Tambourine", "drum.tambourine"],
  anvil: ["Anvil", "metal.anvil"],
  castanets: ["Castanets", "wood.castanets"],
  "woodblock-high": ["Wood Block [1 line]", "wood.wood-block"],
  "woodblock-medium": ["Wood Block [1 line]", "wood.wood-block"],
  "woodblock-low": ["Wood Block [1 line]", "wood.wood-block"],
  vibraslap: ["Percussion [1 line]", "rattle.vibraslap"],
  cowbell: ["Percussion [1 line]", "metal.bells.cowbell"],
  "sleigh-bells": ["Sleigh Bells", "metal.bells.sleigh-bells"],
  guiro: ["Guiro (Medium) [1 line]", "wood.guiro"],
  ratchet: ["Percussion [1 line]", "rattle.ratchet"],
  shaker: ["Percussion [1 line]", "rattle.shaker"],
  "thunder-sheet": ["Percussion [1 line]", "metal.thundersheet"],
  "violins-1": ["Violin I", "strings.violin"],
  "violins-2": ["Violin II", "strings.violin"],
  violas: ["Viola", "strings.viola"],
  cellos: ["Violoncello", "strings.cello"],
  basses: ["Contrabass", "strings.contrabass"],
};

export const catalog: ReadonlyMap<string, Instrument> = new Map(
  list.map((i) => {
    const s = sibelius[i.id];
    return [i.id, s ? { ...i, sibelius: { name: s[0], sound: s[1] } } : i];
  }),
);

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

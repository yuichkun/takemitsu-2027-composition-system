// Instruments as they appear on paper: names, clefs, written octave, and the techniques a score may use.
// Independent of any sound library; playback maps live in src/libraries/.

export type Family = "woodwind" | "brass" | "percussion" | "keyboard" | "harp" | "strings";

export interface Clef {
  sign: "G" | "F" | "C" | "percussion";
  line: number;
  /** Octave shift of the clef itself (treble 8va for piccolo etc. is not used; see `writtenOctave`). */
  octaveChange?: number;
}

export interface Instrument {
  id: string;
  name: string;
  abbreviation: string;
  family: Family;
  /** Default clef per staff (one entry per staff). */
  clefs: Clef[];
  /** Written an octave (or two) away from sounding pitch, even in a score in C: +1 = written an octave lower than sounding (piccolo). */
  writtenOctave?: number;
  /** Players in the full section; parts default to this for strings (docs/decisions/0015). */
  sectionSize?: number;
  /** Unpitched percussion: one-line staff. */
  unpitched?: boolean;
  /** Sounding range in MIDI numbers, for warnings. */
  range?: [number, number];
  /** Techniques the score may name for this instrument (besides "ord"). */
  techniques: string[];
}

const treble: Clef = { sign: "G", line: 2 };
const bass: Clef = { sign: "F", line: 4 };
const alto: Clef = { sign: "C", line: 3 };
const perc: Clef = { sign: "percussion", line: 2 };

const stringTechniques = [
  "pizz",
  "bartok-pizz",
  "col-legno",
  "sul-pont",
  "sul-tasto",
  "flautando",
  "harmonic",
  "tremolo",
  "tremolo+sul-pont",
  "con-sord",
  "tremolo+con-sord",
];
const woodwindTechniques = ["flutter", "multitongue"];
const brassTechniques = ["muted", "cuivre", "flutter", "multitongue", "sfz"];

const list: Instrument[] = [
  // Woodwinds
  {
    id: "piccolo",
    name: "Piccolo",
    abbreviation: "Picc.",
    family: "woodwind",
    clefs: [treble],
    writtenOctave: 1,
    range: [74, 108],
    techniques: woodwindTechniques,
  },
  {
    id: "flute",
    name: "Flute",
    abbreviation: "Fl.",
    family: "woodwind",
    clefs: [treble],
    range: [59, 98],
    techniques: woodwindTechniques,
  },
  {
    id: "alto-flute",
    name: "Alto Flute",
    abbreviation: "A. Fl.",
    family: "woodwind",
    clefs: [treble],
    range: [55, 91],
    techniques: woodwindTechniques,
  },
  {
    id: "bass-flute",
    name: "Bass Flute",
    abbreviation: "B. Fl.",
    family: "woodwind",
    clefs: [treble],
    writtenOctave: 1,
    range: [48, 84],
    techniques: woodwindTechniques,
  },
  {
    id: "oboe",
    name: "Oboe",
    abbreviation: "Ob.",
    family: "woodwind",
    clefs: [treble],
    range: [58, 93],
    techniques: woodwindTechniques,
  },
  {
    id: "cor-anglais",
    name: "Cor anglais",
    abbreviation: "C. ingl.",
    family: "woodwind",
    clefs: [treble],
    range: [52, 81],
    techniques: woodwindTechniques,
  },
  {
    id: "clarinet",
    name: "Clarinet",
    abbreviation: "Cl.",
    family: "woodwind",
    clefs: [treble],
    range: [50, 94],
    techniques: woodwindTechniques,
  },
  {
    id: "eb-clarinet",
    name: "Clarinet in E♭",
    abbreviation: "E♭ Cl.",
    family: "woodwind",
    clefs: [treble],
    range: [55, 98],
    techniques: woodwindTechniques,
  },
  {
    id: "bass-clarinet",
    name: "Bass Clarinet",
    abbreviation: "B. Cl.",
    family: "woodwind",
    clefs: [treble],
    writtenOctave: 1,
    range: [34, 77],
    techniques: woodwindTechniques,
  },
  {
    id: "contrabass-clarinet",
    name: "Contrabass Clarinet",
    abbreviation: "Cb. Cl.",
    family: "woodwind",
    clefs: [treble],
    writtenOctave: 2,
    range: [22, 65],
    techniques: woodwindTechniques,
  },
  {
    id: "bassoon",
    name: "Bassoon",
    abbreviation: "Bsn.",
    family: "woodwind",
    clefs: [bass],
    range: [34, 75],
    techniques: woodwindTechniques,
  },
  {
    id: "contrabassoon",
    name: "Contrabassoon",
    abbreviation: "Cbsn.",
    family: "woodwind",
    clefs: [bass],
    writtenOctave: 1,
    range: [22, 53],
    techniques: woodwindTechniques,
  },
  // Brass
  {
    id: "horn",
    name: "Horn",
    abbreviation: "Hn.",
    family: "brass",
    clefs: [treble],
    range: [34, 77],
    techniques: brassTechniques,
  },
  {
    id: "trumpet",
    name: "Trumpet",
    abbreviation: "Tpt.",
    family: "brass",
    clefs: [treble],
    range: [54, 84],
    techniques: brassTechniques,
  },
  {
    id: "trombone",
    name: "Trombone",
    abbreviation: "Tbn.",
    family: "brass",
    clefs: [bass],
    range: [40, 72],
    techniques: brassTechniques,
  },
  {
    id: "bass-trombone",
    name: "Bass Trombone",
    abbreviation: "B. Tbn.",
    family: "brass",
    clefs: [bass],
    range: [28, 67],
    techniques: brassTechniques,
  },
  {
    id: "contrabass-trombone",
    name: "Contrabass Trombone",
    abbreviation: "Cb. Tbn.",
    family: "brass",
    clefs: [bass],
    range: [23, 60],
    techniques: brassTechniques,
  },
  {
    id: "cimbasso",
    name: "Cimbasso",
    abbreviation: "Cimb.",
    family: "brass",
    clefs: [bass],
    range: [23, 58],
    techniques: brassTechniques,
  },
  {
    id: "tuba",
    name: "Tuba",
    abbreviation: "Tba.",
    family: "brass",
    clefs: [bass],
    range: [26, 65],
    techniques: brassTechniques,
  },
  {
    id: "contrabass-tuba",
    name: "Contrabass Tuba",
    abbreviation: "Cb. Tba.",
    family: "brass",
    clefs: [bass],
    range: [21, 58],
    techniques: brassTechniques,
  },
  // Pitched percussion and keyboards
  {
    id: "timpani",
    name: "Timpani",
    abbreviation: "Timp.",
    family: "percussion",
    clefs: [bass],
    range: [38, 60],
    techniques: ["roll", "damped", "soft", "hotrods"],
  },
  {
    id: "glockenspiel",
    name: "Glockenspiel",
    abbreviation: "Glk.",
    family: "percussion",
    clefs: [treble],
    writtenOctave: 2,
    range: [79, 108],
    techniques: ["roll"],
  },
  {
    id: "xylophone",
    name: "Xylophone",
    abbreviation: "Xyl.",
    family: "percussion",
    clefs: [treble],
    writtenOctave: 1,
    range: [65, 108],
    techniques: ["roll"],
  },
  {
    id: "marimba",
    name: "Marimba",
    abbreviation: "Mar.",
    family: "percussion",
    clefs: [treble, bass],
    range: [45, 96],
    techniques: ["roll"],
  },
  {
    id: "vibraphone",
    name: "Vibraphone",
    abbreviation: "Vib.",
    family: "percussion",
    clefs: [treble],
    range: [53, 89],
    techniques: ["roll", "bowed"],
  },
  {
    id: "crotales",
    name: "Crotales",
    abbreviation: "Crot.",
    family: "percussion",
    clefs: [treble],
    writtenOctave: 2,
    range: [84, 108],
    techniques: ["bowed"],
  },
  {
    id: "tubular-bells",
    name: "Tubular Bells",
    abbreviation: "T. Bells",
    family: "percussion",
    clefs: [treble],
    range: [60, 77],
    techniques: ["roll", "damped"],
  },
  {
    id: "celesta",
    name: "Celesta",
    abbreviation: "Cel.",
    family: "keyboard",
    clefs: [treble, bass],
    writtenOctave: 1,
    range: [60, 108],
    techniques: ["damped"],
  },
  {
    id: "piano",
    name: "Piano",
    abbreviation: "Pno.",
    family: "keyboard",
    clefs: [treble, bass],
    range: [21, 108],
    techniques: [],
  },
  {
    id: "harp",
    name: "Harp",
    abbreviation: "Hp.",
    family: "harp",
    clefs: [treble, bass],
    range: [23, 104],
    techniques: ["damped", "bisbigliando", "gliss"],
  },
  // Unpitched percussion
  {
    id: "snare-drum",
    name: "Snare Drum",
    abbreviation: "S. D.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: ["rimshot", "side-stick", "roll"],
  },
  {
    id: "military-drum",
    name: "Military Drum",
    abbreviation: "Mil. Dr.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: ["rimshot", "side-stick", "roll"],
  },
  {
    id: "tenor-drum",
    name: "Tenor Drum",
    abbreviation: "T. D.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: ["rimshot", "side-stick", "roll"],
  },
  {
    id: "bass-drum",
    name: "Bass Drum",
    abbreviation: "B. D.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: ["damped", "muted", "roll", "superball", "hard-sticks"],
  },
  {
    id: "suspended-cymbal",
    name: "Suspended Cymbal",
    abbreviation: "Sus. Cym.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: ["muted", "hard-sticks", "hard-sticks+muted", "roll", "bowed"],
  },
  {
    id: "clash-cymbals",
    name: "Clash Cymbals",
    abbreviation: "Cym.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: ["choke", "roll"],
  },
  {
    id: "tam-tam",
    name: "Tam-tam",
    abbreviation: "T.-t.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: ["damped", "roll", "bowed", "crescendo"],
  },
  {
    id: "triangle",
    name: "Triangle",
    abbreviation: "Trgl.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: ["muted", "roll"],
  },
  {
    id: "tambourine",
    name: "Tambourine",
    abbreviation: "Tamb.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: ["shake", "roll"],
  },
  {
    id: "anvil",
    name: "Anvil",
    abbreviation: "Anv.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: ["choke"],
  },
  {
    id: "castanets",
    name: "Castanets",
    abbreviation: "Cast.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: [],
  },
  {
    id: "woodblock-high",
    name: "Woodblock (high)",
    abbreviation: "W. B. h.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: [],
  },
  {
    id: "woodblock-medium",
    name: "Woodblock (medium)",
    abbreviation: "W. B. m.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: [],
  },
  {
    id: "woodblock-low",
    name: "Woodblock (low)",
    abbreviation: "W. B. l.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: [],
  },
  {
    id: "vibraslap",
    name: "Vibraslap",
    abbreviation: "Vibrasl.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: [],
  },
  {
    id: "cowbell",
    name: "Cowbell",
    abbreviation: "Cowb.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: [],
  },
  {
    id: "sleigh-bells",
    name: "Sleigh Bells",
    abbreviation: "Sl. B.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: [],
  },
  {
    id: "guiro",
    name: "Guiro",
    abbreviation: "Guiro",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: ["long"],
  },
  {
    id: "ratchet",
    name: "Ratchet",
    abbreviation: "Ratch.",
    family: "percussion",
    clefs: [perc],
    unpitched: true,
    techniques: [],
  },
  // Strings
  {
    id: "violins-1",
    name: "Violins I",
    abbreviation: "Vn. I",
    family: "strings",
    clefs: [treble],
    sectionSize: 16,
    range: [55, 103],
    techniques: stringTechniques,
  },
  {
    id: "violins-2",
    name: "Violins II",
    abbreviation: "Vn. II",
    family: "strings",
    clefs: [treble],
    sectionSize: 14,
    range: [55, 100],
    techniques: stringTechniques,
  },
  {
    id: "violas",
    name: "Violas",
    abbreviation: "Va.",
    family: "strings",
    clefs: [alto],
    sectionSize: 12,
    range: [48, 91],
    techniques: stringTechniques,
  },
  {
    id: "cellos",
    name: "Violoncellos",
    abbreviation: "Vc.",
    family: "strings",
    clefs: [bass],
    sectionSize: 10,
    range: [36, 84],
    techniques: stringTechniques,
  },
  {
    id: "basses",
    name: "Contrabasses",
    abbreviation: "Cb.",
    family: "strings",
    clefs: [bass],
    writtenOctave: 1,
    sectionSize: 8,
    range: [28, 67],
    techniques: stringTechniques,
  },
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

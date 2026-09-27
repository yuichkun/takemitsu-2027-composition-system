// Playing techniques: how each one is written in the score. The one place to add a technique.
//
// Adding a technique while composing:
// 1. Add a line here (the text printed where it starts, and where it ends).
// 2. Sound: put audio files in samples/<instrument>/<technique>/ (docs/decisions/0012), or teach
//    src/libraries/bbcso/map.ts which BBC SO articulation to use. Without either, it plays as the
//    nearest BBC SO articulation and the preview shows a warning.
// A technique that is not listed still works: its id is printed as text, with a warning.

export interface Technique {
  /** Text above the staff where the technique starts. Empty for none. */
  text: string;
  /** Text where the music returns to ord. Default "ord.". Empty for none. */
  cancel?: string;
  /** Drawn on the note instead of (or besides) text. */
  mark?: "tremolo" | "harmonic" | "snap-pizzicato";
  /** Counts as another technique when deciding text (Bartók pizz. is still pizz., so no "arco" before it). */
  implies?: string;
}

export const techniques: Record<string, Technique> = {
  // Strings
  pizz: { text: "pizz.", cancel: "arco" },
  "bartok-pizz": { text: "", mark: "snap-pizzicato", implies: "pizz" },
  "col-legno": { text: "col legno batt." },
  "sul-pont": { text: "sul pont." },
  "sul-tasto": { text: "sul tasto" },
  flautando: { text: "flautando" },
  harmonic: { text: "", cancel: "", mark: "harmonic" },
  tremolo: { text: "", cancel: "", mark: "tremolo" },
  "con-sord": { text: "con sord.", cancel: "senza sord." },
  // Winds and brass
  flutter: { text: "flz.", mark: "tremolo" },
  multitongue: { text: "multitongue", mark: "tremolo" },
  muted: { text: "con sord.", cancel: "senza sord." },
  cuivre: { text: "cuivré" },
  sfz: { text: "", cancel: "" },
  // Percussion and keyboards
  roll: { text: "", cancel: "", mark: "tremolo" },
  damped: { text: "damp", cancel: "l.v." },
  soft: { text: "soft sticks" },
  hotrods: { text: "hot rods" },
  "hard-sticks": { text: "hard sticks" },
  superball: { text: "superball" },
  bowed: { text: "bowed" },
  rimshot: { text: "rim shot" },
  "side-stick": { text: "side stick" },
  choke: { text: "choke", cancel: "l.v." },
  shake: { text: "shake" },
  crescendo: { text: "", cancel: "" },
  bisbigliando: { text: "bisb.", mark: "tremolo" },
  gliss: { text: "gliss.", cancel: "" },
  long: { text: "long scrape" },
};

export const techniqueOf = (id: string): Technique | undefined => techniques[id];

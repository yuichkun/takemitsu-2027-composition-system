// antara palette, B: the standpoint calls both sides.
//
// Uses the A sketch "the standpoint names the side" (../../a/texture-side-of-the-standpoint), its
// rule copied here unchanged: divided strings hold one chord and never change pitch; the standpoint
// is the contrabasses, below the chord, walking by the steps of the Walk, one step per hold. A chord
// tone whose between to the standpoint is a whole number of semitones stands on the standpoint's
// side; one whose between ends in .5 stands on the other side. Each tone's colour is the name of its
// side (sul tasto on the standpoint's side, sul ponticello on the other, or the other way round).
// A step with .5 puts every tone on the other side at once, and all the parts take the other bow
// position on the same pitch, together; a step without .5 changes nothing in the strings.
//
// Here the chord has sixteen parts, and the same sign (does the step carry .5 or not) also calls one
// of two answering choirs, silent until the first step. A step with .5 calls five muted trumpets:
// they hold the tones now on the other side, the highest five of them (all of them when there are
// five or fewer), each moved by octaves into the trumpets' range if it lies outside. A step without
// .5 calls five horns: they hold the tones on the standpoint's side, the lowest five, moved into the
// horns' range the same way. A choir holds until the next step. A step of the same kind keeps it
// sounding, on the tones its side holds now (a player re-enters only where its pitch changes); a step
// of the other kind stops it at the instant the other choir comes in, so the two never sound at once.
// Five players cannot hold a side of eleven tones: the high choir takes the top of its side and the
// low choir the bottom because of where each can play. That is a choice of register, not a name
// (bright, dark) given to the sides.
//
// After the last hold, the strings, the basses and whichever choir is sounding fade to nothing
// together, over at least a bar.
// Card: README.md.

import type { NoteEvent } from "../../../../../src/score/types.ts";
import {
  choice,
  number,
  numbersOf,
  pitch,
  text,
  type Values,
} from "../../../../../src/sketch/knobs.ts";
import { atomOf, familyOf, FAMILY_OPTIONS } from "../../../between.ts";
import { curve, divisi, fold, note, part, scoreOf, TICKS, type Player } from "../../common.ts";

const SIDES = ["tasto | pont", "pont | tasto"];
/**
 * The chord's lowest tone: the cellos' lowest string. Sixteen tones with fifteen different betweens
 * need the room from here to the top of the violins.
 */
const CHORD_FROM = 36;
const BASSES: [number, number] = [28, 67];
/** Players in each answering choir. */
const SIZE = 5;

interface Choir {
  id: string;
  instrument: string;
  name: string;
  abbreviation: string;
  /** Where its tones are moved by octaves into (the instrument's range). */
  range: [number, number];
  technique?: string;
  /** Which side it answers with: 1 the other side (steps with .5), 0 the standpoint's side. */
  side: 0 | 1;
}

const HIGH: Choir = {
  id: "tpt",
  instrument: "trumpet",
  name: "Trumpet",
  abbreviation: "Tpt.",
  range: [54, 84],
  technique: "muted",
  side: 1,
};
const LOW: Choir = {
  id: "hn",
  instrument: "horn",
  name: "Horn",
  abbreviation: "Hn.",
  range: [34, 77],
  side: 0,
};

export const knobs = {
  chord: text({
    group: "Chord",
    label: "Chord",
    help: "The betweens of the chord, bottom up in the order written (semitones, .5 for a quarter tone), stacked from C2. No tone of the chord ever changes pitch",
    value: "2 3.5 5 2.5 3 1 1.5 0.5 4 4.5 5.5 6 7 8 6.5",
  }),
  sides: choice({
    group: "Chord",
    label: "Sides",
    help: "The colours of the two sides: the standpoint's side | the other side",
    value: SIDES[0]!,
    options: SIDES,
  }),
  start: pitch({
    group: "Standpoint",
    label: "Standpoint",
    help: "Where the contrabasses start",
    value: 31.5,
    min: "E1",
    max: "C3",
    step: 0.5,
  }),
  walk: text({
    group: "Standpoint",
    label: "Walk",
    help: "The standpoint's steps, in the order written (semitones, signed, .5 for a quarter tone). A step with .5 puts every tone of the chord on the other side and calls the trumpets; a step without .5 changes nothing in the strings and calls the horns",
    value: "2 -1.5 0.5 -1 -3 3.5 1.5 2 -3 -1 0.5",
  }),
  holds: text({
    group: "Time",
    label: "Holds",
    help: "How long each standpoint lasts, in atoms of the family, in the order written (again from the first if the walk is longer)",
    value: "15 11 18 13 16 12 17",
  }),
  family: choice({
    group: "Time",
    label: "Family",
    help: "The atom the holds count in",
    value: FAMILY_OPTIONS[1]!,
    options: FAMILY_OPTIONS,
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 46,
    min: 30,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

const numbers = (label: string, value: string) => numbersOf(label, value.replaceAll("−", "-"));
const onQuarterTones = (label: string, xs: number[]) => {
  if (xs.some((x) => !Number.isInteger(x * 2)))
    throw new Error(`${label}: betweens are semitones on the quarter-tone grid (2, 3.5, -1.5)`);
  return xs;
};

/** 0 when a tone stands on the standpoint's side (a whole number of semitones away), 1 when not. */
const sideOf = (tone: number, standpoint: number) =>
  Math.abs(Math.round((tone - standpoint) * 2)) % 2;

export function score(v: Values<typeof knobs>) {
  const chord = onQuarterTones("Chord", numbers("Chord", v.chord));
  if (chord.some((b) => b < 0)) throw new Error("Chord: the betweens go up (0 or more)");
  const walk = onQuarterTones("Walk", numbers("Walk", v.walk));
  const holds = numbers("Holds", v.holds);
  if (holds.some((h) => !Number.isInteger(h) || h < 1))
    throw new Error("Holds: whole numbers of atoms, 1 or more");
  const atom = atomOf(familyOf(v.family));
  const [near, far] = v.sides === SIDES[0] ? ["sul-tasto", "sul-pont"] : ["sul-pont", "sul-tasto"];

  const tones = [CHORD_FROM];
  for (const b of chord) tones.push(tones.at(-1)! + b);

  // The standpoints, each from where it begins.
  const stands: { at: number; midi: number }[] = [];
  let at = 0;
  let here = v.start;
  for (let i = 0; i <= walk.length; i++) {
    if (i > 0) here += walk[i - 1]!;
    if (here < BASSES[0] || here > BASSES[1])
      throw new Error(`Walk: the standpoint leaves the contrabasses (${here})`);
    stands.push({ at, midi: here });
    at += holds[i % holds.length]! * atom;
  }
  // The last hold ends here; then everything fades together to the first bar line a bar or more on.
  const sound = at;
  const bar = 4 * TICKS;
  const end = Math.ceil((sound + bar) / bar) * bar;
  const fading = (level: number) => [
    { at: sound, level, ramp: true },
    { at: end, level: 0 },
  ];

  // Each chord part keeps its pitch; it starts a new note only where its side changes.
  const players = divisi(tones.map((t): [number, number] => [t, t]));
  const chordParts = tones.map((x, k) => {
    const runs: { at: number; side: number }[] = [];
    for (const s of stands) {
      const side = sideOf(x, s.midi);
      if (runs.at(-1)?.side !== side) runs.push({ at: s.at, side });
    }
    const events = runs.map((r, i) =>
      note(r.at, (runs[i + 1]?.at ?? end) - r.at, x, { technique: r.side === 0 ? near : far }),
    );
    // From nothing to pp, held, and gone after the last hold.
    const dynamics = curve([
      { at: 0, level: 0, ramp: true },
      { at: Math.min(4 * TICKS, sound), level: 2 },
      ...fading(2),
    ]);
    return part(players[k]!, events, dynamics);
  });

  // The answer at each standpoint after the first: the choir the step calls, and its pitches from
  // the top (its first player takes the highest).
  const answers = stands.map((s, i) => {
    if (i === 0) return undefined;
    const choir = Number.isInteger(walk[i - 1]!) ? LOW : HIGH;
    const side = tones.filter((t) => sideOf(t, s.midi) === choir.side);
    const taken = choir === HIGH ? side.slice(-SIZE) : side.slice(0, SIZE);
    return { choir, pitches: taken.map((t) => fold(t, choir.range)).sort((a, b) => b - a) };
  });
  const choirParts = [LOW, HIGH].flatMap((c) =>
    Array.from({ length: SIZE }, (_, j) => {
      const events: NoteEvent[] = [];
      let open: { at: number; midi: number } | undefined;
      const close = (t: number) => {
        if (open) events.push(note(open.at, t - open.at, open.midi, { technique: c.technique }));
        open = undefined;
      };
      stands.forEach((s, i) => {
        const a = answers[i];
        const midi = a?.choir === c ? a.pitches[j] : undefined;
        if (open && open.midi === midi) return;
        close(s.at);
        if (midi !== undefined) open = { at: s.at, midi };
      });
      close(end);
      const player: Player = {
        id: `${c.id}${j + 1}`,
        instrument: c.instrument,
        name: `${c.name} ${j + 1}`,
        abbreviation: `${c.abbreviation} ${j + 1}`,
        range: c.range,
        grids: [0, 1],
      };
      // p whenever it sounds, gone with the rest after the last hold.
      return part(player, events, curve([{ at: 0, level: 3 }, ...fading(3)]));
    }).filter((p) => p.events.length > 0),
  );

  // The standpoint: a new note at every step, p, fading with the rest.
  const midis = stands.map((s) => s.midi);
  const basses: Player = {
    id: "cb",
    instrument: "basses",
    name: "Contrabasses",
    abbreviation: "Cb.",
    players: 8,
    range: [Math.min(...midis), Math.max(...midis)],
    grids: [0, 1],
  };
  const bassEvents = stands.map((s, i) =>
    note(s.at, (stands[i + 1]?.at ?? end) - s.at, s.midi, { articulations: ["tenuto"] }),
  );
  const bassDynamics = curve([{ at: 0, level: 3 }, ...fading(3)]);

  // Score order: horns, trumpets, then the strings high to low.
  return scoreOf("antara · palette B · the standpoint calls both sides", end / bar, v.tempo, [
    ...choirParts,
    ...chordParts.reverse(),
    part(basses, bassEvents, bassDynamics),
  ]);
}

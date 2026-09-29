// The full score's staves (docs/decisions/0021-full-score-layout.md): which of the score's parts go
// on which staff, in what order, under which brackets, with what names and player labels. The
// score's parts are what plays; the staves are what the conductor reads.
//
// - Winds and brass: a pair (Flutes 1.2, Oboes 1.2, …, Horns 1.2 and 3.4) shares one staff for the
//   whole piece when it writes cleanly on one (see shareable), else each player has a staff (always,
//   when the score says pairs: false). On a
//   shared staff the texture is decided stretch by stretch: the same notes → one line, "a 2"; the
//   same rhythm → chords; else two voices, the first player stems up ("1."), the second down ("2.").
//   A player alone is labelled "1." or "2." and the other's rests are hidden.
// - Strings: each section's staff. When the section divides into two halves that write cleanly on
//   one staff, they go on it ("div." … "unis."); otherwise each divided part has its own staff,
//   named by its players (Vln. I 1–8), with "div." or "div. a N" where the division starts.
// - Percussion: timpani, then each player's instruments together (Part.player).
// - Piano, harp, celesta, marimba: notes the score puts on no staff go up or down by register.
//
// Order and brackets follow MOLA's model score (docs/research/score-layout/): woodwind, brass,
// timpani and percussion, harps, piano, celesta, strings; a bracket over each family with barlines
// through it, and a sub-bracket over staves of one kind.

import { catalog, type Instrument } from "../instruments/catalog.ts";
import {
  levelAt,
  type Dynamic,
  type NormalPart,
  type NormalScore,
  type Note,
} from "../score/normalize.ts";
import { lcm, Rational } from "../score/rational.ts";
import type { Measure } from "../score/timeline.ts";
import { beatSpans } from "./rhythm.ts";

/** One staff (or grand staff) of the full score, written as one MusicXML part. */
export interface Staff extends NormalPart {
  /** The score's parts written on it. */
  members: NormalPart[];
  /**
   * Dynamics written above the staff: the first player's, where two players on one staff play at
   * once with different dynamics (the second player's are the staff's own, below).
   */
  dynamicsAbove: Dynamic[];
  /** Two players on one staff: where both play in a measure, voice 1 stems up and voice 2 down. */
  stems: boolean;
}

export interface Group {
  /** First and last staff it spans (indices into Layout.staves). */
  first: number;
  last: number;
  symbol: "bracket" | "square";
  /** Barlines drawn through the whole group. */
  barline: boolean;
}

export interface Layout {
  staves: Staff[];
  groups: Group[];
}

//==============================================================================
// Order

/** Score order within the families, high to low (MOLA). Unpitched percussion follows the pitched. */
const ORDER = [
  "piccolo",
  "flute",
  "alto-flute",
  "bass-flute",
  "oboe",
  "cor-anglais",
  "eb-clarinet",
  "clarinet",
  "bass-clarinet",
  "contrabass-clarinet",
  "bassoon",
  "contrabassoon",
  "horn",
  "trumpet",
  "trombone",
  "bass-trombone",
  "contrabass-trombone",
  "cimbasso",
  "tuba",
  "contrabass-tuba",
  "timpani",
  "glockenspiel",
  "crotales",
  "xylophone",
  "vibraphone",
  "marimba",
  "tubular-bells",
  "harp",
  "piano",
  "celesta",
  "violins-1",
  "violins-2",
  "violas",
  "cellos",
  "basses",
];
const catalogOrder = [...catalog.keys()];
/** Where an instrument goes in the score. */
function rank(inst: Instrument): number {
  const i = ORDER.indexOf(inst.id);
  if (i >= 0) return i;
  // Unpitched percussion: after the pitched, in the catalog's order.
  return ORDER.indexOf("tubular-bells") + (1 + catalogOrder.indexOf(inst.id)) / 1000;
}

/** Staves of one kind, joined by a sub-bracket inside their family's bracket. */
const KIN: Record<string, string> = {
  piccolo: "flutes",
  flute: "flutes",
  "alto-flute": "flutes",
  "bass-flute": "flutes",
  oboe: "oboes",
  "cor-anglais": "oboes",
  "eb-clarinet": "clarinets",
  clarinet: "clarinets",
  "bass-clarinet": "clarinets",
  "contrabass-clarinet": "clarinets",
  bassoon: "bassoons",
  contrabassoon: "bassoons",
  horn: "horns",
  trumpet: "trumpets",
  trombone: "trombones",
  "bass-trombone": "trombones",
  "contrabass-trombone": "trombones",
  cimbasso: "tubas",
  tuba: "tubas",
  "contrabass-tuba": "tubas",
};

//==============================================================================
// Names

/** "Flutes 1.2" / "Fl. 1.2", "Clarinet 3 in B♭" / "Cl. 3 (B♭)", "Horns 1.2 in F" / "Hn. 1.2 (F)". */
function playerNames(inst: Instrument, numbers: number[], numbered: boolean): [string, string] {
  const shown = numbered ? ` ${numbers.join(".")}` : "";
  const name = numbers.length > 1 ? (inst.plural ?? inst.name) : inst.name;
  return [
    `${name}${shown}${inst.key ? ` in ${inst.key}` : ""}`,
    `${inst.abbreviation}${shown}${inst.key ? ` (${inst.key})` : ""}`,
  ];
}

//==============================================================================
// Grand staves: notes the score put on no staff go up or down by register

/** The lowest pitch of the upper staff: middle C. Single notes near it stay where the line is. */
const split = 60;
const near: [number, number] = [55, 65];

function hands(part: NormalPart): NormalPart {
  if (part.instrument.clefs.length !== 2 || part.notes.every((n) => n.staffGiven)) return part;
  const notes: Note[] = [];
  const last = new Map<number, number>();
  for (const n of part.notes) {
    if (n.staffGiven || !n.pitches.length) {
      notes.push(n);
      continue;
    }
    const upper = n.pitches.filter((p) => p.midi >= split);
    const lower = n.pitches.filter((p) => p.midi < split);
    if (n.pitches.length === 1) {
      const midi = n.pitches[0]!.midi;
      const before = last.get(n.voice);
      const staff =
        before !== undefined && midi >= near[0] && midi < near[1] ? before : midi >= split ? 1 : 2;
      last.set(n.voice, staff);
      notes.push({ ...n, staff });
    } else if (!lower.length || !upper.length) {
      const staff = upper.length ? 1 : 2;
      last.set(n.voice, staff);
      notes.push({ ...n, staff });
    } else {
      // A chord across both staves: each hand its own notes. Lines and slurs stay with the upper.
      notes.push({ ...n, staff: 1, pitches: upper });
      notes.push({ ...n, staff: 2, pitches: lower, slur: false, gliss: false });
    }
  }
  notes.sort((a, b) => a.at.cmp(b.at) || a.staff - b.staff || a.voice - b.voice);
  return { ...part, notes };
}

//==============================================================================
// Can two players share a staff?

/** Beats of the score, with the measure each is in. */
function beatsOf(measures: Measure[]): [Rational, Rational][] {
  return measures.flatMap((m) => beatSpans(m));
}

/** The odd part of the finest subdivision each part's onsets and ends need inside a beat. */
function divisions(part: NormalPart, beats: [Rational, Rational][]): Map<number, number> {
  const out = new Map<number, number>();
  let b = 0;
  for (const n of part.notes) {
    for (const t of [n.at, n.end]) {
      while (b > 0 && beats[b]![0].gt(t)) b--;
      while (b < beats.length - 1 && beats[b]![1].lte(t)) b++;
      const [start, end] = beats[b]!;
      if (!(t.gt(start) && t.lt(end))) continue;
      let d = t.sub(start).d;
      while (d % 2 === 0) d /= 2;
      out.set(b, lcm(out.get(b) ?? 1, d));
    }
  }
  return out;
}

const single = (p: NormalPart) =>
  p.notes.every((n) => n.voice === 1 && n.staff === 1 && n.pitches.length <= 1 && !n.feather);

/**
 * Whether two players can share a staff for the whole piece (docs/research/score-layout/sharing.md):
 * each plays one line; in no beat do their tuplets differ (triplets against quintuplets or
 * sixteenths); they never play different techniques at once; the lower player rises above the
 * upper at most twice.
 */
function shareable(a: NormalPart, b: NormalPart, beats: [Rational, Rational][]): boolean {
  if (!single(a) || !single(b)) return false;
  const da = divisions(a, beats);
  const db = divisions(b, beats);
  for (const [beat, d] of da) {
    const e = db.get(beat);
    if (e !== undefined && e !== d) return false;
  }
  let crossings = 0;
  let j = 0;
  for (const x of a.notes) {
    while (j < b.notes.length && b.notes[j]!.end.lte(x.at)) j++;
    for (let k = j; k < b.notes.length && b.notes[k]!.at.lt(x.end); k++) {
      const y = b.notes[k]!;
      if (x.technique.join("+") !== y.technique.join("+")) return false;
      if (x.pitches[0] && y.pitches[0] && y.pitches[0].midi > x.pitches[0].midi) crossings++;
    }
  }
  return crossings <= 2;
}

//==============================================================================
// Writing several parts on one staff

type Texture = "tutti" | "unison" | "chords" | "upper" | "lower" | "both";

interface Members {
  /** The whole section (strings), taking turns with the two halves. */
  tutti?: NormalPart;
  upper: NormalPart;
  lower: NormalPart;
  /** Wind players ("1.", "2.", "a 2") or a string section's halves ("div.", "unis."). */
  kind: "players" | "divisi";
  /** The two players' numbers in their section, for their labels (horns 3.4 are "3." and "4."). */
  numbers?: [number, number];
}

/**
 * Stretches of measures no note of these parts crosses into: the texture may change between
 * them without a tie or a held note changing voice.
 */
function stretches(parts: NormalPart[], measures: Measure[]): { start: Rational; end: Rational }[] {
  const held = new Set<number>();
  const starts = measures.map((m) => m.start);
  const firstAfter = (t: Rational) => {
    let lo = 0;
    let hi = starts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (starts[mid]!.lte(t)) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  for (const p of parts)
    for (const n of p.notes)
      for (let k = firstAfter(n.at); k < starts.length && starts[k]!.lt(n.end); k++) held.add(k);
  const out: { start: Rational; end: Rational }[] = [];
  measures.forEach((m, k) => {
    const end = m.start.add(m.length);
    if (k > 0 && held.has(k)) out[out.length - 1]!.end = end;
    else out.push({ start: m.start, end });
  });
  return out;
}

const within = (notes: Note[], s: { start: Rational; end: Rational }) =>
  notes.filter((n) => n.at.gte(s.start) && n.at.lt(s.end));

const samePitches = (x: Note, y: Note) =>
  x.pitches.length === y.pitches.length &&
  x.pitches.every((p, i) => p.midi === y.pitches[i]!.midi && p.step === y.pitches[i]!.step);

/** How two players' notes in one stretch go on one staff. */
function textureOf(a: Note[], b: Note[]): Texture {
  if (!a.length && !b.length) return "both";
  if (!b.length) return "upper";
  if (!a.length) return "lower";
  if (a.length !== b.length) return "both";
  let unison = true;
  let chords = true;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (!x.at.eq(y.at) || !x.dur.eq(y.dur)) return "both";
    if (
      x.technique.join() !== y.technique.join() ||
      x.articulations.join() !== y.articulations.join() ||
      x.slur !== y.slur ||
      x.gliss !== y.gliss ||
      x.trill !== y.trill
    )
      return "both";
    if (!samePitches(x, y)) unison = false;
    const top = y.pitches.at(-1)?.midi ?? 0;
    const bottom = x.pitches[0]?.midi ?? 0;
    // Shared stems only without crossing and within a ninth (LilyPond's part combiner).
    if (top > bottom || bottom - top > 14) chords = false;
  }
  return unison ? "unison" : chords ? "chords" : "both";
}

const labels: Record<Members["kind"], Partial<Record<Texture, [string, "above" | "below"][]>>> = {
  players: {
    unison: [["a 2", "above"]],
    upper: [["1.", "above"]],
    lower: [["2.", "below"]],
    both: [
      ["1.", "above"],
      ["2.", "below"],
    ],
  },
  divisi: {
    tutti: [["unis.", "above"]],
    unison: [["unis.", "above"]],
    chords: [["div.", "above"]],
    upper: [["div.", "above"]],
    lower: [["div.", "above"]],
    both: [["div.", "above"]],
  },
};

/** Points of a curve inside [start, end), starting with its level at `start` when asked. */
function pointsIn(d: Dynamic[], start: Rational, end: Rational, carry: boolean): Dynamic[] {
  const inside = d.filter((p) => p.at.gte(start) && p.at.lt(end));
  if (carry && d.length && !inside.some((p) => p.at.eq(start))) {
    const before = d.filter((p) => p.at.lt(start)).at(-1);
    // A hairpin already under way goes on from here.
    if (before) inside.unshift({ at: start, level: levelAt(d, start), to: before.to });
  }
  return inside;
}

/**
 * A part's dynamics where it plays: points in stretches where it has notes, its level restated
 * where it comes back in. A mark over a staff's rests says nothing the entry does not.
 */
function audible(part: NormalPart, measures: Measure[]): Dynamic[] {
  const out: Dynamic[] = [];
  let playing = false;
  for (const s of stretches([part], measures)) {
    const here = within(part.notes, s).length > 0;
    if (here) out.push(...pointsIn(part.dynamics, s.start, s.end, !playing));
    playing = here;
  }
  return dedupe(out);
}

/** Texts once each (two parts on one staff often carry the same). */
const distinct = (texts: NormalPart["texts"]) => {
  const seen = new Set<string>();
  return texts.filter((t) => {
    const key = `${t.at.toString()} ${t.placement} ${t.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const sameCurve = (x: Dynamic[], y: Dynamic[]) =>
  x.length === y.length &&
  x.every((p, i) => p.at.eq(y[i]!.at) && p.level === y[i]!.level && p.to === y[i]!.to);

/** Several parts written on one staff, stretch by stretch; undefined if they cannot be. */
function combine(m: Members, measures: Measure[], name: [string, string]): Staff | undefined {
  const parts = [m.tutti, m.upper, m.lower].filter((p): p is NormalPart => p !== undefined);
  const notes: Note[] = [];
  const texts: NormalPart["texts"] = parts.flatMap((p) => p.texts);
  const below: Dynamic[] = [];
  const above: Dynamic[] = [];
  // Which part fed each dynamics row in the stretch before (a new one restates its level).
  let belowFrom: NormalPart | undefined;
  let aboveFrom: NormalPart | undefined;
  let previous: Texture | undefined;
  for (const s of stretches(parts, measures)) {
    const t = m.tutti ? within(m.tutti.notes, s) : [];
    const a = within(m.upper.notes, s);
    const b = within(m.lower.notes, s);
    if (!t.length && !a.length && !b.length) {
      // Silence: whoever comes in next restates their level.
      belowFrom = aboveFrom = undefined;
      continue;
    }
    // The whole section and a half at once cannot share the section's staff.
    if (t.length && (a.length || b.length)) return undefined;
    const texture: Texture = t.length ? "tutti" : textureOf(a, b);
    const copy = (n: Note, voice: number, pitches = n.pitches): Note => ({
      ...n,
      voice,
      staff: 1,
      pitches,
    });
    if (texture === "tutti") notes.push(...t.map((n) => copy(n, 1)));
    else if (texture === "unison" || texture === "upper") notes.push(...a.map((n) => copy(n, 1)));
    else if (texture === "lower") notes.push(...b.map((n) => copy(n, 2)));
    else if (texture === "chords")
      a.forEach((x, i) => {
        const y = b[i]!;
        const pitches = [
          ...y.pitches,
          ...x.pitches.filter((p) => !y.pitches.some((q) => q.midi === p.midi)),
        ];
        notes.push(
          copy(
            x,
            1,
            pitches.sort((p, q) => p.midi - q.midi),
          ),
        );
      });
    else notes.push(...a.map((n) => copy(n, 1)), ...b.map((n) => copy(n, 2)));

    // Labels where the texture changes (the section's first entry needs none).
    const first = previous === undefined;
    const changed =
      texture !== previous && !(first && (texture === "tutti" || texture === "chords"));
    const unisonAgain = m.kind === "divisi" && texture === "unison" && previous === "tutti";
    if (changed && !unisonAgain) {
      const at = [...t, ...a, ...b].reduce((x, n) => (n.at.lt(x) ? n.at : x), s.end);
      const named = (text: string) =>
        m.numbers && text === "1."
          ? `${m.numbers[0]}.`
          : m.numbers && text === "2."
            ? `${m.numbers[1]}.`
            : text;
      for (const [text, placement] of labels[m.kind][texture] ?? [])
        texts.push({ at, text: named(text), placement });
    }
    previous = texture === "unison" && m.kind === "divisi" ? "tutti" : texture;

    // Dynamics: one player alone, or both with the same curve, below; both with different curves,
    // the first above and the second below.
    const feed = (row: Dynamic[], from: NormalPart, was: NormalPart | undefined) =>
      row.push(...pointsIn(from.dynamics, s.start, s.end, from !== was));
    let fedBelow: NormalPart | undefined;
    let fedAbove: NormalPart | undefined;
    if (texture === "tutti") fedBelow = m.tutti!;
    else if (texture === "lower") fedBelow = m.lower;
    else if (
      texture === "upper" ||
      sameCurve(
        pointsIn(m.upper.dynamics, s.start, s.end, true),
        pointsIn(m.lower.dynamics, s.start, s.end, true),
      )
    )
      fedBelow = m.upper;
    else {
      fedAbove = m.upper;
      fedBelow = m.lower;
    }
    if (fedBelow) feed(below, fedBelow, belowFrom);
    if (fedAbove) feed(above, fedAbove, aboveFrom);
    belowFrom = fedBelow;
    aboveFrom = fedAbove;
  }
  notes.sort((x, y) => x.at.cmp(y.at) || x.voice - y.voice);
  return {
    ...m.upper,
    id: parts.map((p) => p.id).join("+"),
    name: name[0],
    abbreviation: name[1],
    players: parts.reduce((n, p) => Math.max(n, p.players), 0),
    notes,
    texts: distinct(texts),
    dynamics: dedupe(below),
    dynamicsAbove: dedupe(above),
    members: parts,
    stems: true,
  };
}

/** A curve with one point per time (the later wins). */
function dedupe(d: Dynamic[]): Dynamic[] {
  const out: Dynamic[] = [];
  for (const p of [...d].sort((x, y) => x.at.cmp(y.at))) {
    if (out.length && out.at(-1)!.at.eq(p.at)) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}

const staffOf = (
  part: NormalPart,
  name: [string, string],
  measures: Measure[],
  extra: NormalPart["texts"] = [],
): Staff => ({
  ...part,
  name: name[0],
  abbreviation: name[1],
  texts: [...part.texts, ...extra],
  dynamics: audible(part, measures),
  members: [part],
  dynamicsAbove: [],
  stems: false,
});

//==============================================================================
// Families

/** Pairs that may share a staff, by the players' order in their section (0 = the first). */
const pairsOf = (id: string): [number, number][] =>
  id === "horn"
    ? [
        [0, 1],
        [2, 3],
      ]
    : ["flute", "oboe", "clarinet", "bassoon", "trumpet", "trombone"].includes(id)
      ? [[0, 1]]
      : [];

function winds(
  parts: NormalPart[],
  measures: Measure[],
  beats: [Rational, Rational][],
  share = true,
): Staff[] {
  const out: Staff[] = [];
  const ids = [...new Set(parts.map((p) => p.instrument.id))].sort(
    (x, y) => rank(catalog.get(x)!) - rank(catalog.get(y)!),
  );
  for (const id of ids) {
    const own = parts.filter((p) => p.instrument.id === id);
    const inst = own[0]!.instrument;
    let n = 0;
    const numbered = own.map((p) => {
      const numbers = Array.from({ length: p.players }, (_, i) => n + i + 1);
      n += p.players;
      return { part: p, numbers };
    });
    const multiple = n > 1;
    const pairs = share ? pairsOf(id) : [];
    for (let i = 0; i < numbered.length; i++) {
      const { part, numbers } = numbered[i]!;
      const next = numbered[i + 1];
      const pair =
        next &&
        part.players === 1 &&
        next.part.players === 1 &&
        pairs.some(([x, y]) => numbers[0] === x + 1 && next.numbers[0] === y + 1);
      if (pair && shareable(part, next.part, beats)) {
        const staff = combine(
          {
            upper: part,
            lower: next.part,
            kind: "players",
            numbers: [numbers[0]!, next.numbers[0]!],
          },
          measures,
          playerNames(inst, [...numbers, ...next.numbers], true),
        );
        if (staff) {
          out.push(staff);
          i++;
          continue;
        }
      }
      // A part for two or more players in unison ("Clarinets 1.2" playing one line).
      const first = part.notes[0];
      const a2 =
        part.players > 1 && first
          ? [{ at: first.at, text: `a ${part.players}`, placement: "above" as const }]
          : [];
      out.push(staffOf(part, playerNames(inst, numbers, multiple), measures, a2));
    }
  }
  return out;
}

function percussion(parts: NormalPart[], measures: Measure[]): Staff[] {
  const byRank = (x: NormalPart, y: NormalPart) => rank(x.instrument) - rank(y.instrument);
  const timpani = parts.filter((p) => p.instrument.id === "timpani");
  const others = parts.filter((p) => p.instrument.id !== "timpani");
  const players = new Map<string, NormalPart[]>();
  for (const p of others) {
    const key = p.player ?? "";
    players.set(key, [...(players.get(key) ?? []), p]);
  }
  const named = [...players.entries()]
    .filter(([key]) => key !== "")
    .map(([key, own]) => ({ key, own: own.sort(byRank) }))
    .sort((x, y) => byRank(x.own[0]!, y.own[0]!));
  const out: Staff[] = timpani.map((p, i) =>
    staffOf(
      p,
      timpani.length > 1 ? [`Timpani ${i + 1}`, `Timp. ${i + 1}`] : ["Timpani", "Timp."],
      measures,
    ),
  );
  named.forEach(({ own }, k) => {
    for (const p of own)
      out.push(
        staffOf(
          p,
          [
            `Percussion ${k + 1}: ${p.instrument.name}`,
            `Perc. ${k + 1}: ${p.instrument.abbreviation}`,
          ],
          measures,
        ),
      );
  });
  for (const p of (players.get("") ?? []).sort(byRank))
    out.push(staffOf(p, [p.instrument.name, p.instrument.abbreviation], measures));
  return out;
}

/** Harps, pianos, celestas: numbered when there are several. */
function numberedSingles(parts: NormalPart[], measures: Measure[]): Staff[] {
  return parts.map((p, i) =>
    staffOf(
      p,
      parts.length > 1
        ? [`${p.instrument.name} ${i + 1}`, `${p.instrument.abbreviation} ${i + 1}`]
        : [p.instrument.name, p.instrument.abbreviation],
      measures,
    ),
  );
}

/** Mean pitch of a part, to order divided staves from the highest. */
const height = (p: NormalPart) => {
  const ps = p.notes.flatMap((n) => n.pitches.map((x) => x.midi));
  return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0;
};

/**
 * Seats of the section each divided part takes (1-based, inclusive): parts that sound during the
 * same span take different seats; parts that never meet may take the same. Undefined when the
 * players do not fit.
 */
function seats(parts: NormalPart[], size: number): Map<NormalPart, [number, number] | undefined> {
  const span = (p: NormalPart): [number, number] => [
    p.notes[0]?.at.value ?? 0,
    Math.max(0, ...p.notes.map((n) => n.end.value)),
  ];
  const taken: { from: number; to: number; span: [number, number] }[] = [];
  const out = new Map<NormalPart, [number, number] | undefined>();
  for (const p of parts) {
    const s = span(p);
    const meets = taken.filter((t) => t.span[0] < s[1] && s[0] < t.span[1]);
    let seat = 1;
    for (;;) {
      const clash = meets.find((t) => t.from <= seat + p.players - 1 && seat <= t.to);
      if (!clash) break;
      seat = clash.to + 1;
    }
    if (seat + p.players - 1 > size) out.set(p, undefined);
    else {
      out.set(p, [seat, seat + p.players - 1]);
      taken.push({ from: seat, to: seat + p.players - 1, span: s });
    }
  }
  return out;
}

function strings(
  parts: NormalPart[],
  measures: Measure[],
  beats: [Rational, Rational][],
): { staves: Staff[]; sections: Staff[][] } {
  const sections: Staff[][] = [];
  const ids = [...new Set(parts.map((p) => p.instrument.id))].sort(
    (x, y) => rank(catalog.get(x)!) - rank(catalog.get(y)!),
  );
  for (const id of ids) {
    const own = parts.filter((p) => p.instrument.id === id);
    const inst = own[0]!.instrument;
    const size = inst.sectionSize ?? 1;
    const tutti = own.filter((p) => p.players >= size);
    const divided = own.filter((p) => p.players < size).sort((x, y) => height(y) - height(x));
    const section: Staff[] = [];
    const full: [string, string] = [inst.name, inst.abbreviation];
    // Two halves on the section's staff, when they write cleanly on one.
    const meet = (x: NormalPart, y: NormalPart) =>
      x.notes.some((n) => y.notes.some((o) => o.at.lt(n.end) && n.at.lt(o.end)));
    if (divided.length === 2 && tutti.length <= 1 && meet(divided[0]!, divided[1]!)) {
      const [upper, lower] = divided as [NormalPart, NormalPart];
      const staff =
        shareable(upper, lower, beats) &&
        combine({ tutti: tutti[0], upper, lower, kind: "divisi" }, measures, full);
      if (staff) {
        sections.push([staff]);
        continue;
      }
    }
    for (const p of tutti) section.push(staffOf(p, full, measures));
    const where = seats(divided, size);
    const staves = divided.map((p) => {
      const s = where.get(p);
      const who = s ? (s[0] === s[1] ? `${s[0]}` : `${s[0]}–${s[1]}`) : `(${p.players})`;
      return staffOf(p, [`${inst.name} ${who}`, `${inst.abbreviation} ${who}`], measures);
    });
    // "div." (into two) or "div. a N" where the section divides; "unis." where it comes together.
    const runs = divisionRuns(divided, measures);
    for (const run of runs) {
      const within = (st: Staff) => st.notes.filter((n) => n.at.gte(run.start) && n.at.lt(run.end));
      const playing = staves.filter((st) => within(st).length);
      // How many divisions sound at once at most: a run may hand one division over to another.
      const together = Math.max(
        0,
        ...playing.flatMap((st) =>
          within(st).map(
            (n) =>
              playing.filter((o) => o.notes.some((m) => m.at.lte(n.at) && n.at.lt(m.end))).length,
          ),
        ),
      );
      const top = playing[0];
      // One divided staff alone says who plays in its name; "div." needs two or more.
      if (!top || together < 2) continue;
      // Where the section divides, above its top staff, even if that staff comes in later.
      top.texts.push({
        at: run.start,
        text: together === 2 ? "div." : `div. a ${together}`,
        placement: "above",
      });
      for (const t of section) {
        const back = t.notes.find((n) => n.at.gte(run.end));
        if (back) t.texts.push({ at: back.at, text: "unis.", placement: "above" });
      }
    }
    section.push(...staves);
    sections.push(section);
  }
  return { staves: sections.flat(), sections };
}

/** Spans where a section is divided: from where its divided parts start to where they all rest. */
function divisionRuns(
  parts: NormalPart[],
  measures: Measure[],
): { start: Rational; end: Rational }[] {
  const bar = measures[0]?.length ?? new Rational(4);
  const spans = parts
    .flatMap((p) => p.notes.map((n) => ({ start: n.at, end: n.end })))
    .sort((x, y) => x.start.cmp(y.start));
  const out: { start: Rational; end: Rational }[] = [];
  for (const s of spans) {
    const last = out.at(-1);
    // Rests shorter than a bar do not end a division.
    if (last && s.start.lte(last.end.add(bar))) {
      if (s.end.gt(last.end)) last.end = s.end;
    } else out.push({ ...s });
  }
  return out;
}

//==============================================================================

export function layoutOf(score: NormalScore): Layout {
  const beats = beatsOf(score.measures);
  const parts = score.parts.map(hands);
  const of = (family: Instrument["family"]) => parts.filter((p) => p.instrument.family === family);
  const woodwind = winds(of("woodwind"), score.measures, beats, score.pairs);
  const brass = winds(of("brass"), score.measures, beats, score.pairs);
  const perc = percussion(of("percussion"), score.measures);
  const harps = numberedSingles(of("harp"), score.measures);
  const keyboards = [
    ...numberedSingles(
      parts.filter((p) => p.instrument.id === "piano"),
      score.measures,
    ),
    ...numberedSingles(
      parts.filter((p) => p.instrument.family === "keyboard" && p.instrument.id !== "piano"),
      score.measures,
    ),
  ];
  const { staves: str, sections } = strings(of("strings"), score.measures, beats);
  const staves = [...woodwind, ...brass, ...perc, ...harps, ...keyboards, ...str];

  const groups: Group[] = [];
  const index = (s: Staff) => staves.indexOf(s);
  const family = (list: Staff[], subs: Staff[][]) => {
    if (list.length < 2) return;
    groups.push({
      first: index(list[0]!),
      last: index(list.at(-1)!),
      symbol: "bracket",
      barline: true,
    });
    for (const sub of subs)
      if (sub.length > 1)
        groups.push({
          first: index(sub[0]!),
          last: index(sub.at(-1)!),
          symbol: "square",
          barline: true,
        });
  };
  const kin = (list: Staff[], key: (s: Staff) => string) => {
    const runs: Staff[][] = [];
    for (const s of list) {
      const last = runs.at(-1);
      if (last && key(last[0]!) === key(s)) last.push(s);
      else runs.push([s]);
    }
    return runs;
  };
  family(
    woodwind,
    kin(woodwind, (s) => KIN[s.instrument.id] ?? s.instrument.id),
  );
  family(
    brass,
    kin(brass, (s) => KIN[s.instrument.id] ?? s.instrument.id),
  );
  family(
    perc,
    kin(perc, (s) => (s.instrument.id === "timpani" ? "timpani" : (s.player ?? s.id))),
  );
  // Strings: each divided section under a sub-bracket; with no division, Violin I and II together.
  const divided = sections.filter((s) => s.length > 1);
  const violins = str.filter(
    (s) => s.instrument.id === "violins-1" || s.instrument.id === "violins-2",
  );
  family(str, divided.length ? divided : [violins]);
  groups.sort((x, y) => x.first - y.first || y.last - x.last);
  return { staves, groups };
}

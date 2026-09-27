// A long, heavy score for measuring the preview and the renders. Random material, not music:
// it exists to load the system the way a 15–20 minute orchestral piece would.
//
//   vp node tools/stress-score.ts [--minutes 20] [--seed 1] [--out .local/stress/stress-20min.json]
//
// The full competition orchestra (docs/competition.md): 24 winds, 2 harps, piano, celesta,
// percussion, and the strings both as sections and divided down to one player per part
// (107 parts). Sections cycle through textures that stress different things:
// - micro: every string player on its own fast line (parts and notes)
// - spectral: long quarter-tone chords under slow dynamic curves (tuned lanes, long notes, CC)
// - cloud: pizzicato, staccato and percussion scattered at random (many short notes)
// - sparse: a few long notes and long rests (silence)
// - climax: everything at once, with tempo and meter changes between sections

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { instrument } from "../src/instruments/catalog.ts";
import type { DynamicPoint, NoteEvent, Part, Score } from "../src/score/types.ts";

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1]! : fallback;
};
const minutes = Number(option("--minutes", "20"));
const seed = Number(option("--seed", "1"));
const out = resolve(option("--out", join(".local/stress", `stress-${minutes}min.json`)));

// mulberry32: small, seedable, good enough for test material.
let state = seed >>> 0;
function random(): number {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a: number, b: number) => a + random() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const choose = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!;
const chance = (p: number) => random() < p;

// Times on a grid of twelfths of a quarter (sixteenths and triplets), written as fractions.
const G = 12;
const time = (twelfths: number): [number, number] => [twelfths, G];

//==============================================================================
// Orchestra

interface Player {
  part: Part;
  range: [number, number];
  group: "wind" | "brass" | "keys" | "pitched-perc" | "perc" | "tutti" | "divisi";
  section?: string;
  /** Last dynamic level written, to keep curves continuous. */
  level: number;
}

const players: Player[] = [];
function add(
  id: string,
  instrumentId: string,
  group: Player["group"],
  extra: Partial<Part> = {},
  section?: string,
): void {
  const inst = instrument(instrumentId);
  const range = inst.range ?? [60, 60];
  // Stay inside a comfortable middle of the range.
  const span = range[1] - range[0];
  players.push({
    part: { id, instrument: instrumentId, events: [], dynamics: [], ...extra },
    range: [Math.round(range[0] + span * 0.1), Math.round(range[1] - span * 0.15)],
    group,
    section,
    level: 0,
  });
}

for (const [prefix, inst, n] of [
  ["fl", "flute", 2],
  ["ob", "oboe", 2],
  ["cl", "clarinet", 2],
  ["bsn", "bassoon", 2],
] as const)
  for (let i = 1; i <= n; i++) add(`${prefix}${i}`, inst, "wind");
add("picc", "piccolo", "wind");
add("ca", "cor-anglais", "wind");
add("bcl", "bass-clarinet", "wind");
add("cbsn", "contrabassoon", "wind");
add("cbcl", "contrabass-clarinet", "wind");
for (let i = 1; i <= 4; i++) add(`hn${i}`, "horn", "brass");
for (let i = 1; i <= 3; i++) add(`tpt${i}`, "trumpet", "brass");
for (let i = 1; i <= 2; i++) add(`tbn${i}`, "trombone", "brass");
add("btbn", "bass-trombone", "brass");
add("tba", "tuba", "brass");
add("hp1", "harp", "keys", { name: "Harp I" });
add("hp2", "harp", "keys", { name: "Harp II" });
add("pno", "piano", "keys");
add("cel", "celesta", "keys");
add("timp", "timpani", "pitched-perc");
for (const inst of [
  "glockenspiel",
  "vibraphone",
  "marimba",
  "xylophone",
  "crotales",
  "tubular-bells",
])
  add(inst, inst, "pitched-perc");
for (const inst of [
  "snare-drum",
  "bass-drum",
  "suspended-cymbal",
  "tam-tam",
  "triangle",
  "woodblock-medium",
  "tambourine",
])
  add(inst, inst, "perc");
for (const [prefix, inst, size] of [
  ["vn1", "violins-1", 16],
  ["vn2", "violins-2", 14],
  ["va", "violas", 12],
  ["vc", "cellos", 10],
  ["cb", "basses", 8],
] as const) {
  add(prefix, inst, "tutti", {}, prefix);
  for (let i = 1; i <= size; i++)
    add(
      `${prefix}-${i}`,
      inst,
      "divisi",
      { players: 1, name: `${instrument(inst).name} ${i}` },
      prefix,
    );
}

const byGroup = (...groups: Player["group"][]) => players.filter((p) => groups.includes(p.group));

//==============================================================================
// Writing helpers

function note(
  p: Player,
  at: number,
  dur: number,
  pitch: number | number[] | undefined,
  extra: Partial<NoteEvent> = {},
): void {
  const e: NoteEvent = { at: time(at), dur: time(dur), ...extra };
  if (pitch !== undefined)
    e.pitch = Array.isArray(pitch) ? pitch.map((m) => ({ midi: m })) : { midi: pitch };
  if (
    p.part.instrument === "piano" ||
    p.part.instrument === "harp" ||
    p.part.instrument === "celesta"
  ) {
    const low = Array.isArray(pitch) ? Math.max(...pitch) : pitch;
    if (low !== undefined && low < 60) e.staff = 2;
  }
  p.part.events.push(e);
}

function dynamic(p: Player, at: number, level: number, to?: "linear"): void {
  const d = p.part.dynamics as DynamicPoint[];
  const point: DynamicPoint = { at: time(at), level: Math.round(level * 10) / 10 };
  if (to) point.to = to;
  d.push(point);
  p.level = level;
}

const clamp = (p: Player, m: number) => Math.max(p.range[0], Math.min(p.range[1], m));
const quarterTone = (m: number, p = 0.3) => (chance(p) ? m + 0.5 : m);

//==============================================================================
// Textures. Each writes into [start, end) in twelfths; `beat` is twelfths per second's worth.

type Texture = "micro" | "spectral" | "cloud" | "sparse" | "climax";

function micro(start: number, end: number, winds = true): void {
  // Every divided string player on a fast line in a narrow band that drifts.
  const center = int(62, 76);
  for (const p of byGroup("divisi")) {
    dynamic(p, start, 1, "linear");
    dynamic(p, Math.round((start + end) / 2), between(3, 5), "linear");
    dynamic(p, end, 1);
    let t = start + int(0, 6);
    let pitch = clamp(p, center + int(-6, 6));
    const tech = choose(["ord", "ord", "sul-tasto", "sul-pont", "con-sord"]);
    while (t < end - 3) {
      const dur = choose([3, 3, 4, 4, 6]);
      pitch = clamp(p, pitch + choose([-2, -1, -1, 1, 1, 2]));
      note(p, t, Math.min(dur, end - t), quarterTone(pitch, 0.2), {
        slur: chance(0.7),
        ...(tech !== "ord" ? { technique: tech } : {}),
      });
      t += dur;
    }
  }
  for (const p of winds ? byGroup("wind").slice(0, 6) : []) {
    dynamic(p, start, 2);
    let t = start + int(0, 24);
    while (t < end - 12) {
      const dur = int(12, 48);
      note(
        p,
        t,
        Math.min(dur, end - t),
        clamp(p, center + int(-4, 8)),
        chance(0.3) ? { trill: 1 } : {},
      );
      t += dur + int(12, 36);
    }
  }
}

function spectral(start: number, end: number): void {
  // A harmonic spectrum over a low fundamental, rounded to quarter tones, spread over the orchestra.
  const fundamental = int(28, 36);
  const partials = Array.from({ length: 24 }, (_, i) => {
    const m = fundamental + 12 * Math.log2(i + 1);
    return Math.round(m * 2) / 2;
  });
  const voices = [
    ...byGroup("tutti"),
    ...byGroup("wind"),
    ...byGroup("brass"),
    ...byGroup("keys").filter((p) => p.part.instrument === "harp"),
  ];
  for (const p of voices) {
    const usable = partials.filter((m) => m >= p.range[0] && m <= p.range[1]);
    if (!usable.length) continue;
    let t = start + int(0, 24);
    dynamic(p, start, 0, "linear");
    while (t < end - 24) {
      const dur = Math.min(int(48, 240), end - t);
      const pitch = choose(usable);
      const tech =
        p.group === "tutti"
          ? choose(["ord", "sul-tasto", "sul-pont", "tremolo+sul-pont", "harmonic", "flautando"])
          : p.part.instrument === "harp"
            ? choose(["ord", "bisbigliando"])
            : p.group === "brass"
              ? choose(["ord", "ord", "muted"])
              : choose(["ord", "ord", "flutter"]);
      if (p.group === "tutti" && chance(0.5)) {
        // Divisi a2 inside a section part: a chord.
        const second = choose(usable);
        note(
          p,
          t,
          dur,
          second === pitch ? pitch : [pitch, second].sort((a, b) => a - b),
          tech === "ord" ? {} : { technique: tech },
        );
      } else note(p, t, dur, pitch, tech === "ord" ? {} : { technique: tech });
      // Slow swells: up and back down within the note.
      dynamic(p, t, between(0.5, 2), "linear");
      dynamic(p, t + Math.round(dur * between(0.3, 0.7)), between(3, 6.5), "linear");
      dynamic(p, t + dur, between(0, 1.5), "linear");
      t += dur + int(0, 24);
    }
  }
}

function cloud(start: number, end: number): void {
  const pizz = byGroup("tutti");
  const staccato = [...byGroup("wind"), ...byGroup("brass")];
  const hits = [...byGroup("perc"), ...byGroup("pitched-perc"), ...byGroup("keys")];
  const span = end - start;
  const density = (t: number) => Math.sin((Math.PI * (t - start)) / span); // swells in and out
  for (const p of [...pizz, ...staccato, ...hits]) {
    dynamic(p, start, between(2, 5));
    let t = start + int(0, 12);
    while (t < end - 12) {
      const rate = 0.05 + 0.6 * density(t); // chance of an onset per sixteenth, roughly ×4
      if (!chance(rate / 4)) {
        t += 3;
        continue;
      }
      const roll = p.group === "perc" && chance(0.15);
      const d = roll ? 12 : choose([3, 3, 6]);
      if (p.group === "perc")
        note(
          p,
          t,
          d,
          undefined,
          roll ? { technique: "roll" } : chance(0.2) ? { articulations: ["accent"] } : {},
        );
      else if (p.group === "tutti")
        note(p, t, d, clamp(p, int(p.range[0], p.range[1])), {
          technique: choose(["pizz", "pizz", "pizz", "bartok-pizz", "col-legno"]),
        });
      else
        note(
          p,
          t,
          d,
          quarterTone(clamp(p, int(p.range[0], p.range[1])), 0.1),
          p.group === "pitched-perc" || p.group === "keys"
            ? {}
            : { articulations: [choose(["staccato", "staccatissimo", "accent"] as const)] },
        );
      t += d;
    }
  }
}

function sparse(start: number, end: number): void {
  const pool = [
    ...byGroup("wind"),
    ...byGroup("divisi"),
    ...byGroup("pitched-perc"),
    ...byGroup("keys"),
  ];
  const chosen = Array.from({ length: int(3, 6) }, () => choose(pool));
  for (const p of new Set(chosen)) {
    dynamic(p, start, between(1, 3));
    let t = start + int(12, 96);
    while (t < end - 48) {
      const dur = int(24, 96);
      note(p, t, Math.min(dur, end - t), quarterTone(clamp(p, int(p.range[0], p.range[1])), 0.4));
      t += dur + int(48, 192);
    }
  }
}

function climax(start: number, end: number): void {
  micro(start, end, false);
  for (const p of [...byGroup("wind"), ...byGroup("brass")]) {
    dynamic(p, start, 3, "linear");
    dynamic(p, end - 24, 7.5);
    let t = start;
    while (t < end - 12) {
      const dur = Math.min(int(24, 72), end - t);
      note(
        p,
        t,
        dur,
        quarterTone(clamp(p, int(p.range[0], p.range[1])), 0.2),
        p.group === "brass" && chance(0.3) ? { technique: "flutter" } : {},
      );
      t += dur;
    }
  }
  for (const p of byGroup("perc")) {
    dynamic(p, start, 4, "linear");
    dynamic(p, end - 12, 7.5);
    let t = start;
    while (t < end - 12) {
      const dur = int(12, 48);
      note(p, t, Math.min(dur, end - t), undefined, { technique: "roll" });
      t += dur + int(0, 24);
    }
  }
  for (const p of [...byGroup("pitched-perc"), ...byGroup("keys")]) {
    dynamic(p, start, 6);
    for (let t = start; t < end - 6; t += int(6, 24))
      note(
        p,
        t,
        6,
        Array.from({ length: int(1, 4) }, () => clamp(p, int(p.range[0], p.range[1])))
          .filter((m, i, a) => a.indexOf(m) === i)
          .sort((a, b) => a - b),
      );
  }
}

const textures: Record<Texture, (start: number, end: number) => void> = {
  micro,
  spectral,
  cloud,
  sparse,
  climax,
};

//==============================================================================
// Form

const meters = [
  [4, 4],
  [3, 4],
  [5, 8],
  [7, 8],
  [2, 4],
  [6, 8],
] as const;
const plan: Texture[] = [
  "sparse",
  "spectral",
  "micro",
  "cloud",
  "spectral",
  "climax",
  "sparse",
  "micro",
  "cloud",
  "spectral",
  "micro",
  "climax",
  "cloud",
  "sparse",
];

const score: Score = {
  title: `Stress test (${minutes} min, seed ${seed})`,
  meter: [],
  tempo: [],
  rehearsal: [],
  parts: [],
};

let measure = 1;
let at = 0; // twelfths
let seconds = 0;
const target = minutes * 60;
for (let i = 0; seconds < target; i++) {
  const texture = plan[i % plan.length]!;
  const [beats, beatType] = choose(meters);
  const bpm = texture === "micro" ? int(56, 72) : texture === "cloud" ? int(84, 132) : int(44, 80);
  const measureTwelfths = (beats * 4 * G) / beatType;
  const secondsPerMeasure = ((measureTwelfths / G) * 60) / bpm;
  const remaining = target - seconds;
  const count = Math.max(
    2,
    Math.min(
      Math.round(between(60, 120) / secondsPerMeasure),
      Math.round(remaining / secondsPerMeasure),
    ),
  );
  score.meter.push({ measure, beats, beatType });
  score.tempo!.push({ at: time(at), bpm });
  score.rehearsal!.push({ measure, label: String.fromCharCode(65 + (i % 26)) });
  const end = at + count * measureTwelfths;
  textures[texture](at, end);
  measure += count;
  at = end;
  seconds += count * secondsPerMeasure;
}
score.measures = measure - 1;

// Dynamics must be in time order per part; textures may write overlapping points, so keep the
// last point written at each time and sort.
for (const p of players) {
  const points = new Map<string, DynamicPoint>();
  for (const d of p.part.dynamics ?? []) points.set(JSON.stringify(d.at), d);
  const sorted = [...points.values()].sort((a, b) => {
    const v = (t: DynamicPoint["at"]) => (Array.isArray(t) ? t[0] / t[1] : t);
    return v(a.at) - v(b.at);
  });
  p.part.dynamics = sorted.length ? sorted : [{ at: 0, level: 4 }];
  p.part.events.sort((a, b) => {
    const v = (t: NoteEvent["at"]) => (Array.isArray(t) ? t[0] / t[1] : t);
    return v(a.at) - v(b.at);
  });
  score.parts.push(p.part);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(score));
const notes = score.parts.reduce((n, p) => n + p.events.length, 0);
console.log(
  `${out}: ${score.parts.length} parts, ${score.measures} measures, ${Math.round(seconds)} s, ${notes} notes`,
);

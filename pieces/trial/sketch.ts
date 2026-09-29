// Trial piece ("Where No Term Stands", working title): a piece of about fifteen minutes for the
// largest orchestra the Takemitsu award allows, written on antara's premise to try the system at
// full size and to see a whole piece made of the palette's ways (pieces/trial/README.md).
//
// The form is made from its cuts first. A cut says, for every player, when that player crosses to
// the other side; a section is the name given to what lies between two cuts, so sections overlap
// wherever a cut travels through the orchestra. Every line walks one set of pitch betweens from
// its group's standpoint (the home chord) and adds time betweens in atoms of a family:
//
//   birth        two slides cross, and a wind names the pitch where they meet
//   standpoints  each named pitch becomes a line's standpoint; the same set heard from four places
//   toward       the lines' times draw together until they come home at the same moment
//   (later: the dance on the shared home, the home drifting, the cut, both sides)

import { betweenSet, number, pitch, seed, text, type Values } from "../../src/sketch/knobs.ts";
import { Motif } from "../../src/sketch/motif.ts";
import type { Context, Placed } from "../../src/sketch/nest.ts";
import type { Score } from "../../src/score/types.ts";
import type { Birth } from "./birth/sketch.ts";
import { TICKS } from "./engine.ts";
import { ensemble, optional } from "./ensemble.ts";
import { driftPositions, homeOf, type Group, type Trial } from "./material.ts";
import type { Standpoint } from "./standpoints/sketch.ts";
import type { Holder, TowardLine } from "./toward/sketch.ts";
import type { DanceLine, Phrase, Stage } from "./home/sketch.ts";
import type { Chorale, DriftLine } from "./drift/sketch.ts";
import type { Pair } from "./cut/sketch.ts";
import type { Ring } from "./both-sides/sketch.ts";

export const knobs = {
  set: betweenSet({
    group: "Material",
    label: "Set",
    help: "The pitch betweens every line walks, one of each per cycle. Their sum is 0, so each cycle ends where it started: the line's home",
    value: "-4.5 -3 0.5 1.5 5.5",
    min: -12,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  bass: pitch({
    group: "Material",
    label: "Home bass",
    help: "The lowest group's standpoint: the bottom of the home chord",
    value: "Bb2",
  }),
  home: text({
    group: "Material",
    label: "Home betweens",
    help: "Betweens of the home chord from the bottom, one per group above the lowest. Whole semitones, so the harps, keyboards and mallets can sound it",
    value: "13 14 11",
  }),
  seed: seed({
    group: "Material",
    label: "Seed",
    help: "Which orders the lines take the set in",
    value: 7,
  }),
  tempo: number({
    group: "Time",
    label: "Tempo",
    help: "Quarter notes per minute from the start to the meeting",
    value: 60,
    min: 40,
    max: 80,
    step: 1,
    unit: "bpm",
  }),
  dance2: number({
    group: "Time",
    label: "Dance tempo",
    help: "Quarter notes per minute from the meeting (a bar of 5/4 then lasts as long as one shared cycle before it)",
    value: 90,
    min: 60,
    max: 120,
    step: 1,
    unit: "bpm",
  }),
  last: number({
    group: "Time",
    label: "Last tempo",
    help: "Quarter notes per minute for the last section, from the first bar line after the cut",
    value: 54,
    min: 40,
    max: 80,
    step: 1,
    unit: "bpm",
  }),
  approach: number({
    group: "Form",
    label: "Approach",
    help: "Beats from the end of the drift to the bar of silence (at least): the time the pairs have to open, hold wide and close",
    value: 64,
    min: 24,
    max: 100,
    step: 1,
    unit: "beats",
  }),
  dance: number({
    group: "Form",
    label: "Dance bars",
    help: "Bars of the dance, from the meeting to where the home starts to move",
    value: 48,
    min: 16,
    max: 60,
    step: 1,
    unit: "bars",
  }),
  meet: number({
    group: "Form",
    label: "Meeting bar",
    help: "The bar where every line comes home at once (bars of 4/4 before it)",
    value: 67,
    min: 50,
    max: 100,
    step: 1,
    unit: "bar",
  }),
};

const numbers = (label: string, s: string) =>
  s
    .replaceAll("−", "-")
    .trim()
    .split(/\s+/)
    .map((x) => {
      const n = Number(x);
      if (!Number.isFinite(n)) throw new Error(`${label}: "${x}" is not a number`);
      return n;
    });

/** Runs a child and reads the times it says each player left at ("out:<player>"), in piece ticks. */
function outs(placed: Placed): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of placed.fragment.marks)
    if (m.label.startsWith("out:")) out[m.label.slice(4)] = Math.round((placed.at + m.at) * TICKS);
  return out;
}

export function score(v: Values<typeof knobs>, ctx: Context): Score {
  const set = [...v.set];
  if (Math.abs(set.reduce((a, b) => a + b, 0)) > 1e-9)
    throw new Error("Set: the betweens must add up to 0 (the line comes home)");
  const drift = [6.5, -5.5, 4.5, -3.5, 2.5, -1.5, 0.5];
  const positions = driftPositions(drift);
  const trial: Trial = {
    set,
    home: homeOf(v.bass, numbers("Home betweens", v.home)),
    drift,
    axis: (positions[positions.length - 1]! + positions[positions.length - 2]!) / 2,
    seed: v.seed,
    meet: (v.meet - 1) * 4 * TICKS,
  };
  const meetBeats = trial.meet / TICKS;
  const total = meetBeats + 8;
  const piece = ctx.with({
    ensemble,
    material: { motif: new Motif([{ at: 0, dur: 1, midi: 60 }]), trial },
    flows: {},
    length: total,
  });

  const b = (beats: number) => Math.round(beats * TICKS);
  // The births: where each group's standpoint is named, middle first, then outward.
  const births: Birth[] = [
    { group: "ML", at: b(6), span: b(10), up: "vcs", down: "vas" },
    { group: "MH", at: b(16), span: b(8), up: "vas", down: "vn2s" },
    { group: "L", at: b(25), span: b(12), up: "cbs", down: "vcs" },
    { group: "H", at: b(33), span: b(6), up: "vn2s", down: "vn1s" },
  ];
  // Each namer takes its first step when the next standpoint is named. The cut out of the
  // standpoints travels down from the highest group.
  const leave: Record<Group, number> = { H: b(132), MH: b(138), ML: b(144), L: b(150) };
  const lines: Standpoint[] = [
    {
      player: "cl1",
      group: "ML",
      family: 2,
      time: [3, 5, 2, 6, 3],
      born: b(6),
      release: b(16),
      leave: leave.ML,
    },
    {
      player: "ob1",
      group: "MH",
      family: 5,
      time: [4, 7, 3, 6, 2],
      born: b(16),
      release: b(25),
      leave: leave.MH,
    },
    {
      player: "bn1",
      group: "L",
      family: 3,
      time: [2, 3, 1, 4, 3],
      born: b(25),
      release: b(33),
      leave: leave.L,
    },
    {
      player: "fl1",
      group: "H",
      family: 3,
      time: [3, 1, 2, 4, 5],
      born: b(33),
      release: b(40),
      leave: leave.H,
    },
    { player: "vas", group: "ML", family: 3, time: [2, 4, 1, 3, 3], after: b(70), leave: leave.ML },
    {
      player: "vn2s",
      group: "MH",
      family: 2,
      time: [4, 2, 6, 4, 5],
      after: b(78),
      leave: leave.MH,
    },
    { player: "vcs", group: "L", family: 5, time: [6, 3, 8, 4, 5], after: b(86), leave: leave.L },
    { player: "vn1s", group: "H", family: 5, time: [3, 7, 5, 4, 8], after: b(94), leave: leave.H },
  ];

  const placed: Placed[] = [];
  const birth = piece.child("birth", { at: 0, length: 48, params: { births } });
  placed.push(birth);
  const standpoints = piece.child("standpoints", {
    at: 0,
    length: meetBeats,
    params: { lines },
  });
  placed.push(standpoints);
  // Toward the meeting: the lines go on from their last arrival; more join; each locks into the
  // shared cycle (the cut into the dance travels up from the lowest group, the last lock one
  // cycle before the meeting).
  const arrived = outs(standpoints);
  const lock: Record<string, number> = {
    bn1: 170,
    vcs: 177,
    bn2: 184,
    bcl: 191,
    cl1: 198,
    vas: 205,
    cl2: 212,
    hn1: 219,
    ob1: 226,
    vn2s: 232,
    ob2: 238,
    eh: 243,
    fl1: 248,
    vn1s: 253,
    fl2: 258,
  };
  const towardLines: TowardLine[] = [
    ...lines.map((l) => ({
      player: l.player,
      group: l.group,
      family: l.family,
      time: l.time,
      from: arrived[l.player],
      lock: b(lock[l.player]!),
    })),
    {
      player: "bn2",
      group: "L",
      family: 2,
      time: [4, 6, 3, 5, 4],
      after: b(150),
      lock: b(lock.bn2!),
    },
    {
      player: "cl2",
      group: "ML",
      family: 5,
      time: [5, 4, 7, 3, 6],
      after: b(158),
      lock: b(lock.cl2!),
    },
    {
      player: "ob2",
      group: "MH",
      family: 3,
      time: [3, 2, 4, 1, 4],
      after: b(166),
      lock: b(lock.ob2!),
    },
    {
      player: "fl2",
      group: "H",
      family: 5,
      time: [2, 6, 4, 7, 3],
      after: b(174),
      lock: b(lock.fl2!),
    },
    {
      player: "hn1",
      group: "ML",
      family: 3,
      time: [4, 2, 3, 5, 2],
      after: b(182),
      lock: b(lock.hn1!),
    },
    {
      player: "eh",
      group: "MH",
      family: 2,
      time: [5, 3, 4, 7, 2],
      after: b(190),
      lock: b(lock.eh!),
    },
    {
      player: "bcl",
      group: "L",
      family: 5,
      time: [7, 4, 6, 3, 5],
      after: b(160),
      lock: b(lock.bcl!),
    },
  ];
  const holders: Holder[] = [
    { player: "vcr", group: "L" },
    { player: "var", group: "ML" },
    { player: "vn2r", group: "MH" },
    { player: "vn1r", group: "H" },
  ];
  const toward = piece.child("toward", {
    at: 120,
    length: total - 120,
    params: {
      lines: towardLines.filter((l) => l.from !== undefined || l.after !== undefined),
      holders,
      shared: [1, 2, 2, 3, 2],
      sharedFamily: 3,
    },
  });
  placed.push(toward);

  // The dance: from the meeting, a bar of 5/4 at the faster tempo lasts as long as one shared
  // cycle did before it (the same time betweens, renamed).
  const bar = 5 * TICKS;
  const danceBars = v.dance;
  const leaveDance = trial.meet + danceBars * bar;
  const toHome = outs(toward);
  const danceLines: DanceLine[] = [
    ...(["bn1", "bn2", "bcl", "cl1", "cl2", "hn1", "ob1", "ob2", "eh", "fl1", "fl2"] as const)
      .filter((p) => toHome[p] === trial.meet)
      .map((p) => ({
        player: p,
        group: towardLines.find((l) => l.player === p)!.group,
        kind: "wind" as const,
        from: trial.meet,
      })),
    ...(
      [
        ["cbt", "L"],
        ["vca", "L"],
        ["vcb", "L"],
        ["vaa", "ML"],
        ["vab", "ML"],
        ["vn2a", "MH"],
        ["vn2b", "MH"],
        ["vn1a", "H"],
        ["vn1b", "H"],
      ] as [string, Group][]
    ).map(([player, group]) => ({ player, group, kind: "pizz" as const, from: trial.meet })),
    ...(
      [
        ["hn3", "L"],
        ["hn2", "ML"],
        ["tp1", "MH"],
        ["tp2", "MH"],
      ] as [string, Group][]
    ).map(([player, group], i) => ({
      player,
      group,
      kind: "brass" as const,
      from: trial.meet + (18 + i) * bar,
    })),
  ];
  const stages: Stage[] = [
    { family: 2, time: [2, 4, 4, 6, 4], bars: { L: 0, ML: 0, MH: 0, H: 0 }, length: 0.9 },
    { family: 2, time: [3, 5, 2, 6, 4], bars: { L: 8, ML: 9, MH: 10, H: 11 }, length: 0.8 },
    {
      family: 3,
      time: [3, 2, 4, 3, 3],
      bars: { L: 18, ML: 19, MH: 20, H: 21 },
      length: 0.5,
      articulation: "staccato",
    },
    { family: 5, time: [4, 6, 5, 3, 7], bars: { H: 32, MH: 33, ML: 34, L: 35 }, length: 0.7 },
  ];
  // The dance breathes by whole groups, four bars or so at a time: the high alone, the middle,
  // the low, the two ends with the middle empty, everyone; lighter and heavier in turn.
  const all: Group[] = ["L", "ML", "MH", "H"];
  const phrases: Phrase[] = [
    { from: 0, groups: all, level: 1 },
    { from: 1, groups: ["H"], level: 0.8 },
    { from: 4, groups: ["H", "MH"], level: 0.85 },
    { from: 8, groups: ["MH", "ML"], level: 0.9 },
    { from: 12, groups: ["ML", "L"], level: 0.9 },
    { from: 16, groups: ["L", "H"], level: 0.95 },
    { from: 20, groups: all, level: 1.05 },
    { from: 24, groups: ["MH"], level: 0.8 },
    { from: 26, groups: ["MH", "H"], level: 0.9 },
    { from: 30, groups: ["L", "ML"], level: 0.95 },
    { from: 34, groups: all, level: 1.05 },
    { from: 38, groups: ["H", "L"], level: 1 },
    { from: 41, groups: ["ML", "MH"], level: 1 },
    { from: 44, groups: all, level: 1.15 },
  ];
  const home = piece.child("home", {
    at: meetBeats,
    length: danceBars * 5 + 5,
    params: { lines: danceLines, stages, bar, leave: leaveDance, phrases },
  });
  placed.push(home);

  // The drift: from the dance's last bar line the home moves, in cycles of two bars.
  const toDrift = outs(home);
  const driftLines: DriftLine[] = danceLines
    .filter((l) => l.kind !== "brass" && l.player !== "hn1" && toDrift[l.player] === leaveDance)
    .map((l) => ({
      player: l.player,
      group: l.group,
      kind: l.kind === "pizz" ? ("arco" as const) : ("wind" as const),
      from: leaveDance,
    }));
  const chorale: Chorale[] = [
    { player: "tba", group: "L" },
    { player: "btb", group: "L" },
    { player: "tb1", group: "ML" },
    { player: "tb2", group: "ML" },
    { player: "hn1", group: "ML" },
    { player: "hn2", group: "ML" },
    { player: "hn3", group: "ML" },
    { player: "hn4", group: "ML" },
    { player: "tp1", group: "MH" },
    { player: "tp2", group: "MH" },
    { player: "tp3", group: "MH" },
  ];
  const driftCycle = 2 * bar;
  const drifting = piece.child("drift", {
    at: leaveDance / TICKS,
    length: 40 * 5,
    params: {
      lines: driftLines,
      chorale,
      family: 3,
      time: [4, 8, 5, 7, 6],
      start: leaveDance,
      cycle: driftCycle,
      dance: { family: stages.at(-1)!.family, time: stages.at(-1)!.time },
    },
  });
  placed.push(drifting);
  const driftEnd = Math.max(...Object.values(outs(drifting)), leaveDance);

  // The cut: every group divides into pairs mirrored around its axis, open, close to the quarter
  // tone around it, and meet in a bar of silence; on the other side each is where the other was.
  const barAfter = (t: number) => trial.meet + Math.ceil((t - trial.meet) / bar - 1e-9) * bar;
  const hole = barAfter(driftEnd + v.approach * TICKS);
  const pairs: Pair[] = [
    // The highest group opens first, the lowest last (the cut travels down again).
    { upper: "vn1a", lower: "fl1", group: "H", family: 3, delay: b(0) },
    { upper: "picc", lower: "fl2", group: "H", family: 3, delay: b(1) },
    { upper: "vn2a", lower: "ob1", group: "MH", family: 5, delay: b(2) },
    { upper: "vn2b", lower: "ob2", group: "MH", family: 5, delay: b(3) },
    { upper: "tp1", lower: "tp2", group: "MH", family: 5, delay: b(4) },
    { upper: "vaa", lower: "cl1", group: "ML", family: 2, delay: b(5) },
    { upper: "vab", lower: "cl2", group: "ML", family: 2, delay: b(6) },
    { upper: "hn1", lower: "tb1", group: "ML", family: 2, delay: b(7) },
    { upper: "hn3", lower: "tb2", group: "ML", family: 2, delay: b(8) },
    { upper: "vca", lower: "bn1", group: "L", family: 3, delay: b(9) },
    { upper: "bcl", lower: "bn2", group: "L", family: 3, delay: b(10) },
    { upper: "btb", lower: "tba", group: "L", family: 3, delay: b(11) },
  ];
  const cutting = piece.child("cut", {
    at: driftEnd / TICKS,
    length: (hole - driftEnd) / TICKS + 40,
    params: { pairs, start: driftEnd, hole, holeLength: bar },
  });
  placed.push(cutting);

  // Both sides: the first ring comes out of the burst, on the middle group's axis, while the burst
  // is still fading (players the cut left free); the tempo slows and the bar turns to 4/4 at the
  // next bar line.
  const burst = hole + bar;
  const sides = burst + bar;
  const rings: Ring[] = [
    {
      upper: "vn1s",
      lower: "vcs",
      group: "ML",
      family: 3,
      time: [18, 24, 21, 27, 30],
      enter: burst + b(3),
      breath: "eh",
      handover: { player: "cbs", below: 40 },
    },
    {
      upper: "vcq1",
      lower: "cbq1",
      group: "L",
      family: 5,
      time: [25, 30, 35, 40, 45],
      enter: sides + b(12),
      breath: "bn1",
    },
    {
      upper: "vn2q1",
      lower: "vaq1",
      group: "MH",
      family: 2,
      time: [20, 24, 28, 32, 36],
      enter: sides + b(22),
      breath: "ob1",
    },
    {
      upper: "vn1q1",
      lower: "vn2q2",
      group: "H",
      family: 3,
      time: [15, 18, 21, 24],
      enter: sides + b(32),
      breath: "fl1",
    },
  ];
  const both = piece.child("both-sides", {
    at: burst / TICKS,
    length: 400,
    params: { rings },
  });
  placed.push(both);
  const endMark = both.fragment.marks.find((m) => m.label === "end");
  const finish = Math.round((both.at + (endMark?.at ?? 0)) * TICKS);
  const end = finish / TICKS;

  const merged = piece.merge(placed);
  const beforeMeet = v.meet - 1;
  const barOf = (t: number) => beforeMeet + Math.round((t - trial.meet) / bar) + 1;
  const sidesBar = barOf(sides);
  const out = piece.score(merged, {
    title: "Where No Term Stands",
    length: end,
    meter: [
      { measure: 1, beats: 4, beatType: 4 },
      { measure: v.meet, beats: 5, beatType: 4 },
      { measure: sidesBar, beats: 4, beatType: 4 },
    ],
    tempo: [
      { at: 0, bpm: v.tempo },
      { at: meetBeats, bpm: v.dance2 },
      { at: sides / TICKS, bpm: v.last },
    ],
    rehearsal: [
      { measure: 35, label: "A" },
      { measure: v.meet, label: "B" },
      { measure: barOf(leaveDance), label: "C" },
      { measure: barOf(driftEnd), label: "D" },
      { measure: barOf(hole), label: "E" },
      { measure: sidesBar, label: "F" },
    ],
    measures: sidesBar - 1 + Math.ceil((finish - sides) / (4 * TICKS)),
  });
  return { ...out, parts: out.parts.filter((p) => p.events.length || !optional.has(p.id)) };
}

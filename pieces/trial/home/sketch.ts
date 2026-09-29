// Home: the dance on the shared home.
//
// From the meeting on, every line takes the same time betweens (in an order of its own) and its
// cycle lasts a bar: all the lines come home at every bar line, and the bar line is heard as a
// downbeat because they meet there. The home chord, which was only four standpoints until now,
// is the chord of those downbeats. The instruments whose pitches are fixed (harps, piano,
// celesta, mallets) can sound it, since every note of it is on their grid: they name the groups
// that arrive home at each bar line, and only those.
//
// Inside the bar the lines interlock: different orders of the same betweens. The family of the
// time betweens changes twice, group by group (a cut that travels through the orchestra): the bar
// is first filled in 16ths, then in triplet eighths, then in quintuplet 16ths, so the same
// downbeats are reached through three different subdivisions. Lines rest whole bars when enough
// of the others are playing, so the texture breathes.
//
// Every line stops before its arrival at the bar where the next section begins, and says so.

import { number, type Values } from "../../../src/sketch/knobs.ts";
import type { Context } from "../../../src/sketch/nest.ts";
import type { Articulation } from "../../../src/score/types.ts";
import {
  distanceDynamics,
  inOrder,
  Orders,
  Out,
  PLAYABLE,
  random,
  soundingAt,
  Walker,
  walkTogether,
  writeNotes,
  type Cycle,
  type Family,
} from "../engine.ts";
import { GROUPS, type Group, type Trial } from "../material.ts";

export interface DanceLine {
  player: string;
  group: Group;
  kind: "wind" | "pizz" | "brass";
  /** Ticks: it enters on the home here (a bar line), or at the meeting. */
  from: number;
}

/** A stage of the dance: its time betweens (one bar), from which bar each group takes it. */
export interface Stage {
  family: Family;
  time: number[];
  /** Bar (0 = the meeting) where each group takes this stage. */
  bars: Record<Group, number>;
  /** Share of each between a note sounds, and its articulation, for winds and brass. */
  length: number;
  articulation?: Articulation;
}

export interface Phrase {
  /** Bar from the meeting (0) where the phrase starts. */
  from: number;
  groups: Group[];
  /** A factor on the levels. */
  level: number;
}

export const knobs = {
  company: number({
    group: "Lines",
    label: "Company",
    help: "A line rests a bar when this many other lines are playing",
    value: 9,
    min: 2,
    max: 20,
    step: 1,
  }),
  level: number({
    group: "Lines",
    label: "Level at home",
    help: "How loud the lines are on their home (the furthest notes of each bar are louder)",
    value: 4.5,
    min: 2,
    max: 6,
    step: 0.5,
  }),
  arrival: number({
    group: "Lines",
    label: "Arrival",
    help: "How much louder the bar of the meeting is than the dance after it (a factor on the levels)",
    value: 1.4,
    min: 1,
    max: 2,
    step: 0.05,
  }),
  bells: number({
    group: "Bells",
    label: "Bells",
    help: "How loud the fixed-pitch instruments name the downbeats",
    value: 4.5,
    min: 2,
    max: 7,
    step: 0.5,
  }),
};

/** Who names each group's home at a downbeat: two instruments per group, taking turns. */
const namers: Record<Group, string[][]> = {
  L: [
    ["pno", "hp2"],
    ["timp", "hp2"],
    ["pno", "timp"],
  ],
  ML: [
    ["hp1", "mar"],
    ["mar", "pno"],
    ["hp1", "vib"],
  ],
  MH: [
    ["vib", "cel"],
    ["cel", "hp1"],
    ["vib", "hp2"],
  ],
  H: [
    ["glk", "cel"],
    ["cel", "hp1"],
    ["glk", "hp2"],
  ],
};

export function score(v: Values<typeof knobs>, ctx: Context) {
  const trial = ctx.material.trial as Trial;
  const lines = (ctx.params.lines ?? []) as DanceLine[];
  const stages = (ctx.params.stages ?? []) as Stage[];
  const bar = ctx.params.bar as number;
  const leave = ctx.params.leave as number;
  const w = ctx.writer();
  const out = new Out(w, Math.round(ctx.start * 60));
  const meet = trial.meet;
  const k = trial.set.length;
  const orders = new Orders(k, trial.seed * 307 + 5);
  const times = new Orders(k, trial.seed * 307 + 6);
  const stageAt = (g: Group, b: number) => {
    let s = stages[0]!;
    for (const x of stages) if (b >= x.bars[g]) s = x;
    return s;
  };
  // Which groups dance in each phrase (bars from the meeting), and how loud: the orchestra
  // breathes by whole groups, so the register and the weight change phrase by phrase.
  const phrases = (ctx.params.phrases ?? [
    { from: 0, groups: ["L", "ML", "MH", "H"], level: 1 },
  ]) as Phrase[];
  const phraseAt = (b: number) => {
    let p = phrases[0]!;
    for (const x of phrases) if (b >= x.from) p = x;
    return p;
  };

  const walkers: Walker[] = [];
  const specs: DanceLine[] = [];
  for (const s of lines) {
    const rand = random(trial.seed * 97 + s.player.charCodeAt(0) * 13 + s.player.length * 7);
    let lastSilent = false;
    const range = PLAYABLE[ctx.player(s.player).instrument]!;
    specs.push(s);
    walkers.push(
      new Walker({
        anchor: trial.home[s.group],
        start: s.from,
        until: leave,
        first: true,
        cycle: (c, at, from, self) => {
          const b = Math.round((at - meet) / bar);
          const stage = stageAt(s.group, b);
          const time = inOrder(stage.time, times.next(s.player));
          const fitted = orders.fit(s.player, trial.set, from, range);
          const pitch = inOrder(trial.set, fitted ?? orders.next(s.player));
          const dancing = phraseAt(b).groups.includes(s.group);
          const crowded = soundingAt(walkers, at + 1, self) >= v.company;
          const silent =
            !fitted || !dancing || (c >= 1 && !lastSilent && (crowded || rand() < 0.1));
          lastSilent = silent && dancing;
          const cycle: Cycle = { pitch, time, family: stage.family, silent };
          if (s.kind === "pizz") return { ...cycle, technique: "pizz", length: 0.35 };
          return {
            ...cycle,
            length: stage.length,
            ...(stage.articulation ? { articulation: stage.articulation } : {}),
          };
        },
      }),
    );
  }
  walkTogether(walkers);

  const homesAt = new Map<number, Set<Group>>();
  walkers.forEach((walker, i) => {
    const s = specs[i]!;
    const walked = walker.result();
    const anchor = trial.home[s.group];
    // Homes on the bar line carry the downbeat.
    const notes = walked.notes.map((n) =>
      n.step === 0 && n.sounded && (n.at - meet) % bar === 0
        ? { ...n, articulation: "accent" as const }
        : n,
    );
    writeNotes(out, s.player, notes);
    const lift = s.kind === "pizz" ? 0.5 : s.kind === "brass" ? -1 : 0;
    // The bar of the meeting is the arrival the whole first part led to: louder, then the dance.
    const scale = (t: number) =>
      t < meet + bar ? v.arrival : phraseAt(Math.floor((t - meet) / bar)).level;
    distanceDynamics(out, s.player, notes, () => anchor, {
      home: v.level + lift,
      slope: 0.2,
      top: 7,
      scale,
    });
    for (const n of notes)
      if (n.step === 0 && n.sounded && (n.at - meet) % bar === 0) {
        const set = homesAt.get(n.at) ?? new Set<Group>();
        set.add(s.group);
        homesAt.set(n.at, set);
      }
    out.mark(walked.end.at, `out:${s.player}`);
  });

  // The bells name the homes that are arrived at, each bar line: one chord per instrument.
  let turn = 0;
  for (const [t, groups] of [...homesAt.entries()].sort((a, b) => a[0] - b[0])) {
    const b = Math.round((t - meet) / bar);
    const chords = new Map<string, number[]>();
    for (const g of GROUPS) {
      if (!groups.has(g)) continue;
      for (const player of namers[g][(b + turn) % namers[g].length]!)
        chords.set(player, [...(chords.get(player) ?? []), trial.home[g]]);
    }
    for (const [player, pitches] of chords) {
      out.note(
        player,
        t,
        player === "timp" ? 60 : 45,
        pitches.sort((x, y) => x - y),
      );
      out.dyn(player, t, v.bells + (b === 0 ? 1.5 : 0));
    }
    turn += groups.size;
  }
  return w.done();
}

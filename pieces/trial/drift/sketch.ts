// Drift: the home moves.
//
// The set changes: its smallest between (the atom, a quarter tone) grows, so the betweens no
// longer add up to 0 and every line comes back a little away from where it started. All lines take
// the same set, so the whole home chord moves by the set's sum, and every line takes the moving
// between at its own place in its cycle: the move passes through the lines and they arrive at the
// new home together. The sums swing to and fro and shrink (+6.5 −5.5 +4.5 −3.5 +2.5 −1.5 +0.5), so
// the home swings about a point it closes in on, between two positions a quarter tone apart:
// halfway between them, where no instrument can stand. Between two moves the set adds up to 0
// again for a while, fewer cycles each time.
//
// Every move is by an odd number of quarter tones, so the home changes grid every time. When it
// arrives on the grid of the fixed-pitch instruments (harps, piano, celesta, mallets), they sound
// it; when it arrives on the other grid, they are silent. The brass hold the home chord from one
// arrival to the next, and the timpani follow the lowest group's home by pedal.
//
// The levels fall as the swings shrink, from the jolt of the first move to almost nothing.

import { number, type Values } from "../../../src/sketch/knobs.ts";
import type { Context } from "../../../src/sketch/nest.ts";
import {
  distanceDynamics,
  gridOf,
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
import type { Group, Trial } from "../material.ts";

export interface DriftLine {
  player: string;
  group: Group;
  kind: "wind" | "arco";
  from: number;
}

export interface Chorale {
  player: string;
  group: Group;
}

export const knobs = {
  rests: number({
    group: "Form",
    label: "Rests between moves",
    help: "Cycles the home stays after the first move; one fewer after every second move",
    value: 3,
    min: 0,
    max: 4,
    step: 1,
  }),
  jolt: number({
    group: "Levels",
    label: "Jolt",
    help: "Level of the first move (the levels fall from here to the end of the drift)",
    value: 7,
    min: 4,
    max: 8,
    step: 0.5,
  }),
  last: number({
    group: "Levels",
    label: "Last",
    help: "Level at the end of the drift",
    value: 2,
    min: 0.5,
    max: 5,
    step: 0.5,
  }),
  company: number({
    group: "Lines",
    label: "Company",
    help: "Between the moves, a line rests a cycle when this many others are playing",
    value: 3,
    min: 2,
    max: 20,
    step: 1,
  }),
};

export function score(v: Values<typeof knobs>, ctx: Context) {
  const trial = ctx.material.trial as Trial;
  const lines = (ctx.params.lines ?? []) as DriftLine[];
  const chorale = (ctx.params.chorale ?? []) as Chorale[];
  const family = (ctx.params.family ?? 3) as Family;
  const time = ctx.params.time as number[];
  const start = ctx.params.start as number;
  const cycleTicks = ctx.params.cycle as number;
  const dance = ctx.params.dance as { family: Family; time: number[] };
  const w = ctx.writer();
  const out = new Out(w, Math.round(ctx.start * 60));
  const k = trial.set.length;
  // The between that carries the moves: the set's smallest.
  const atomIndex = trial.set.reduce(
    (best, b, i) => (Math.abs(b) < Math.abs(trial.set[best]!) ? i : best),
    0,
  );

  // The plan of cycles: a move, then rests (sum 0), fewer as it goes on.
  const plan: number[] = [];
  trial.drift.forEach((s, i) => {
    plan.push(s);
    const rests = Math.max(0, v.rests - Math.floor(i / 2));
    if (i < trial.drift.length - 1) for (let r = 0; r < rests; r++) plan.push(0);
  });
  const end = start + plan.length * cycleTicks;
  const setFor = (c: number) => {
    const s = plan[c] ?? 0;
    const set = [...trial.set];
    set[atomIndex] = set[atomIndex]! + s;
    return set;
  };
  const level = (t: number) =>
    v.jolt + (v.last - v.jolt) * Math.min(1, Math.max(0, (t - start) / (end - start)));

  const orders = new Orders(k, trial.seed * 401 + 7);
  const times = new Orders(k, trial.seed * 401 + 8);
  const walkers: Walker[] = [];
  lines.forEach((s) => {
    const rand = random(trial.seed * 53 + s.player.charCodeAt(0) * 29 + s.player.length);
    const range = PLAYABLE[ctx.player(s.player).instrument]!;
    walkers.push(
      new Walker({
        anchor: trial.home[s.group],
        start: s.from,
        until: end,
        first: true,
        cycle: (c, at, from, self) => {
          const cycle = Math.floor((at - start) / cycleTicks);
          if (cycle >= plan.length) return "stop";
          // Under the first move the strings go on dancing, in cycles of one bar: they take the
          // move in the first bar and come round in the second, so they reach the new home with
          // the others; the winds broaden above them.
          const half = (at - start) % cycleTicks !== 0;
          if (s.kind === "arco" && cycle === 0) {
            const set = half ? trial.set : setFor(0);
            const fitted = orders.fit(s.player, set, from, range);
            const pitch = inOrder(set, fitted ?? orders.next(s.player));
            return {
              pitch,
              time: inOrder(dance.time, times.next(s.player)),
              family: dance.family,
              technique: "pizz",
              length: 0.35,
              silent: !fitted,
            };
          }
          const set = setFor(cycle);
          const fitted = orders.fit(s.player, set, from, range);
          const pitch = inOrder(set, fitted ?? orders.next(s.player));
          const t = inOrder(time, times.next(s.player));
          // Every line takes the moves it can. Between the moves only a few go on: the brass hold
          // the home, and the orchestra breathes until the next move.
          const moving = (plan[cycle] ?? 0) !== 0;
          const silent =
            !fitted ||
            (!moving && (soundingAt(walkers, at + 1, self) >= v.company || rand() < 0.35));
          const spec: Cycle = { pitch, time: t, family, silent };
          return s.kind === "arco" ? { ...spec, technique: "ord" } : spec;
        },
      }),
    );
  });
  walkTogether(walkers);
  walkers.forEach((walker, i) => {
    const s = lines[i]!;
    const walked = walker.result();
    const home = (n: { at: number }) => {
      // The home the line is circling at that time: its anchor plus the moves made so far.
      const cycle = Math.floor((n.at - start) / cycleTicks);
      let pos = 0;
      for (let c = 0; c < Math.min(cycle, plan.length); c++) pos += plan[c]!;
      return trial.home[s.group] + pos;
    };
    writeNotes(out, s.player, walked.notes);
    distanceDynamics(out, s.player, walked.notes, home, {
      home: 1,
      slope: 0.02,
      top: 7,
      scale: (t) => level(t) * (s.kind === "arco" ? 0.9 : 0.8),
    });
    out.mark(walked.end.at, `out:${s.player}`);
  });

  // The homes arrived at, one per cycle end: the brass hold each until the next, the bells sound
  // those on their grid, the timpani glide to the lowest group's.
  let pos = 0;
  const arrivals: { at: number; pos: number; moved: boolean }[] = [
    { at: start, pos: 0, moved: true },
  ];
  plan.forEach((s, c) => {
    pos += s;
    arrivals.push({ at: start + (c + 1) * cycleTicks, pos, moved: s !== 0 });
  });
  const moves = arrivals.filter((a) => a.moved);
  moves.forEach((a, i) => {
    const next = moves[i + 1]?.at ?? end;
    const lvl = level(a.at);
    for (const c of chorale) {
      const pitch = trial.home[c.group] + a.pos;
      if (i === 0) continue;
      out.note(
        c.player,
        a.at,
        next - a.at,
        pitch,
        c.player.startsWith("tp") ? { technique: "muted" } : {},
      );
      out.dyn(c.player, a.at, lvl);
      out.dyn(c.player, a.at + 30, lvl * 0.7, true);
      out.dyn(c.player, next - 30, lvl * 0.6);
    }
    if (i > 0 && gridOf(trial.home.L + a.pos) === 0) {
      const bells: [string, Group][] = [
        ["pno", "L"],
        ["hp2", "ML"],
        ["hp1", "MH"],
        ["cel", "H"],
        ["vib", "MH"],
        ["glk", "H"],
        ["mar", "ML"],
      ];
      for (const [player, g] of bells) {
        out.note(player, a.at, 90, trial.home[g] + a.pos);
        out.dyn(player, a.at, Math.min(7, lvl + 0.5));
      }
    }
  });
  // Timpani: the lowest group's home, gliding by pedal to each new place.
  for (let i = 1; i < moves.length; i++) {
    const a = moves[i]!;
    const prev = moves[i - 1]!;
    const from = trial.home.L + prev.pos;
    const to = trial.home.L + a.pos;
    const glideFrom = a.at - 120;
    out.note("timp", glideFrom, 120, from, { gliss: true, technique: "roll" });
    out.note("timp", a.at, 60, to);
    out.dyn("timp", glideFrom, level(glideFrom) * 0.6, true);
    out.dyn("timp", a.at, level(a.at));
  }
  return w.done();
}

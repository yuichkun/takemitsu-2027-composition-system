// Toward: the lines' times draw together until they come home at the same moment.
//
// The lines go on walking the set from their standpoints as before, each in its own times. More
// join, each coming in on its group's home, in unison with a line arriving there. Then, one by
// one (a cut that travels up through the orchestra), each line locks into a shared cycle: it
// waits on its home for the next point of a common grid, then takes the shared time betweens (in
// an order of its own) so that its cycles end on that grid. Lines that have locked arrive home
// together: first within a group (a unison), then across groups (part of the home chord). The
// last line locks one cycle before the meeting, so the whole home chord is first heard there,
// where the next section begins and sounds it.
//
// The grid's cycle lasts as long as a bar of the next section (its tempo is faster, so the same
// time betweens have other names there). Where locked lines arrive, the string sections take the
// home over and hold it, and the harps sound the groups that arrive together.

import { number, type Values } from "../../../src/sketch/knobs.ts";
import type { Context } from "../../../src/sketch/nest.ts";
import {
  ATOM,
  distanceDynamics,
  inOrder,
  nextBeat,
  Orders,
  Out,
  PLAYABLE,
  random,
  soundingAt,
  soundingIn,
  Walker,
  walkTogether,
  writeNotes,
  type Cycle,
  type Family,
  type Walk,
} from "../engine.ts";
import { GROUPS, type Group, type Trial } from "../material.ts";

export interface TowardLine {
  player: string;
  group: Group;
  family: Family;
  time: number[];
  /** Ticks: a line going on from the section before starts here, on its home (it sounds it). */
  from?: number;
  /** Ticks: a joining line comes in on its group's first sounded arrival at or after this. */
  after?: number;
  /** Ticks: it locks into the shared cycle at the first grid point after this. */
  lock: number;
}

export interface Holder {
  player: string;
  group: Group;
}

export const knobs = {
  company: number({
    group: "Lines",
    label: "Company",
    help: "Before it locks, a line rests a cycle when this many other lines are sounding",
    value: 4,
    min: 1,
    max: 10,
    step: 1,
  }),
  rests: number({
    group: "Lines",
    label: "Rests",
    help: "Share of free cycles a line lets pass unsounded anyway",
    value: 0.12,
    min: 0,
    max: 0.6,
    step: 0.02,
  }),
  home: number({
    group: "Lines",
    label: "Level at home",
    help: "How loud a line is on its standpoint at the start of the section (it grows toward the meeting)",
    value: 3,
    min: 1,
    max: 5,
    step: 0.5,
  }),
  growth: number({
    group: "Lines",
    label: "Growth to the meeting",
    help: "How much louder everything is at the meeting than at the start (a factor on the levels)",
    value: 1.35,
    min: 1,
    max: 2,
    step: 0.05,
  }),
  holdLevel: number({
    group: "Holders",
    label: "Holders",
    help: "Level the strings hold the home at when they take it (they grow with the rest)",
    value: 2,
    min: 1,
    max: 4,
    step: 0.5,
  }),
};

export function score(v: Values<typeof knobs>, ctx: Context) {
  const trial = ctx.material.trial as Trial;
  const lines = (ctx.params.lines ?? []) as TowardLine[];
  const holders = (ctx.params.holders ?? []) as Holder[];
  const shared = ctx.params.shared as number[];
  const sharedFamily = (ctx.params.sharedFamily ?? 3) as Family;
  const w = ctx.writer();
  const offset = Math.round(ctx.start * 60);
  const out = new Out(w, offset);
  const meet = trial.meet;
  const k = trial.set.length;
  const cycleTicks = shared.reduce((a, b) => a + b, 0) * ATOM[sharedFamily];
  /** The grid point of the shared cycle at or after t. */
  const gridAfter = (t: number) => meet - Math.floor((meet - t) / cycleTicks) * cycleTicks;
  const orders = new Orders(k, trial.seed * 211 + 3);
  const times = new Orders(k, trial.seed * 211 + 4);
  const start = Math.min(...lines.map((l) => l.from ?? l.after ?? meet));
  const scale = (t: number) =>
    1 + (v.growth - 1) * Math.min(1, Math.max(0, (t - start) / (meet - start)));

  const locked = new Map<string, number>();
  const cycles = (s: TowardLine, crowded: (at: number, self: Walker) => boolean) => {
    const rand = random(trial.seed * 131 + s.player.charCodeAt(0) * 17 + s.player.length);
    let lastSilent = false;
    const range = PLAYABLE[ctx.player(s.player).instrument]!;
    return (c: number, at: number, from: number, self: Walker): Cycle | "stop" => {
      const fitted = orders.fit(s.player, trial.set, from, range);
      const pitch = inOrder(trial.set, fitted ?? orders.next(s.player));
      const lockAt = locked.get(s.player);
      if (lockAt !== undefined || at >= s.lock) {
        const time = inOrder(shared, times.next(s.player));
        if (lockAt === undefined) {
          // Wait on the home for the grid (past the next beat, where the family may change),
          // then take the shared cycle.
          const g = gridAfter(nextBeat(at));
          locked.set(s.player, g);
          return { pitch, time, family: sharedFamily, wait: g - at, hold: true };
        }
        return { pitch, time, family: sharedFamily };
      }
      const time = inOrder(s.time, times.next(s.player));
      const breath = s.time[(c * 2) % k]!;
      const silent = !fitted || (c >= 1 && !lastSilent && (crowded(at, self) || rand() < v.rests));
      lastSilent = silent;
      return { pitch, time, family: s.family, breath, silent };
    };
  };

  const walks = new Map<string, Walk>();
  const write = (s: TowardLine, walked: Walk) => {
    const anchor = trial.home[s.group];
    writeNotes(out, s.player, walked.notes);
    distanceDynamics(out, s.player, walked.notes, () => anchor, {
      home: v.home,
      slope: 0.2,
      top: 5.5,
      scale,
    });
    out.mark(walked.end.at, `out:${s.player}`);
    walks.set(s.player, walked);
  };

  // The lines that go on from before, side by side.
  const going = lines.filter((l) => l.from !== undefined);
  const goingWalkers: Walker[] = [];
  going.forEach((s) => {
    goingWalkers.push(
      new Walker({
        anchor: trial.home[s.group],
        start: s.from!,
        until: meet,
        first: true,
        cycle: cycles(s, (at, self) => soundingAt(goingWalkers, at, self) >= v.company),
      }),
    );
  });
  walkTogether(goingWalkers);
  going.forEach((s, i) => write(s, goingWalkers[i]!.result()));

  // The lines that join, each on a home its group arrives at.
  const before = [...walks.values()];
  const joining: { s: TowardLine; walker: Walker }[] = [];
  const joinWalkers: Walker[] = [];
  for (const s of lines.filter((l) => l.after !== undefined)) {
    const mates = going.filter((l) => l.group === s.group).map((l) => walks.get(l.player)!);
    const meeting = mates
      .flatMap((m) => m.notes.filter((n) => n.step === 0 && n.sounded && n.at >= s.after!))
      .sort((a, b) => a.at - b.at)[0];
    if (!meeting) continue;
    const walker = new Walker({
      anchor: trial.home[s.group],
      start: meeting.at,
      until: meet,
      first: true,
      cycle: cycles(
        s,
        (at, self) => soundingIn(before, at) + soundingAt(joinWalkers, at, self) >= v.company + 2,
      ),
    });
    joinWalkers.push(walker);
    joining.push({ s, walker });
  }
  walkTogether(joinWalkers);
  for (const j of joining) write(j.s, j.walker.result());

  // Where locked lines arrive home together: the holders take each group's home, and the harps
  // sound the groups that arrive at the same grid point.
  const arrivalsAt = new Map<number, Set<Group>>();
  for (const s of lines) {
    const g = locked.get(s.player);
    const walked = walks.get(s.player);
    if (g === undefined || !walked) continue;
    for (const n of walked.notes)
      if (n.step === 0 && n.sounded && n.at > g && (meet - n.at) % cycleTicks === 0) {
        const set = arrivalsAt.get(n.at) ?? new Set<Group>();
        set.add(s.group);
        arrivalsAt.set(n.at, set);
      }
  }
  // The holders give the home back at the meeting, where the sections start to dance.
  for (const h of holders) {
    const first = [...arrivalsAt.entries()]
      .filter(([, gs]) => gs.has(h.group))
      .map(([t]) => t)
      .sort((a, b) => a - b)[0];
    if (first === undefined) continue;
    out.note(h.player, first, meet - first, trial.home[h.group], { technique: "sul-tasto" });
    out.dyn(h.player, first, 0);
    out.dyn(h.player, first + 1, 0, true);
    out.dyn(h.player, first + 120, v.holdLevel, true);
    out.dyn(h.player, meet - 30, v.holdLevel * v.growth + 1);
  }
  let harp = 0;
  for (const [t, gs] of [...arrivalsAt.entries()].sort((a, b) => a[0] - b[0])) {
    if (gs.size < 2 || t >= meet) continue;
    const pitches = GROUPS.filter((g) => gs.has(g)).map((g) => trial.home[g]);
    const player = harp++ % 2 === 0 ? "hp1" : "hp2";
    out.note(player, t, 80, pitches);
    out.dyn(player, t, 2 + gs.size * 0.5);
  }
  return w.done();
}

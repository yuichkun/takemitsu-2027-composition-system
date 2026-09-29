// Standpoints: the same relations heard from four places.
//
// Each wind that named a pitch at the birth holds it, then starts to walk the piece's set from it:
// one cycle takes every between of the set once, in an order of its own, and ends back on the
// named pitch (the set adds up to 0). The four lines have the same pitch betweens but stand on
// different pitches (the home chord's four notes), so the same shapes sound as four different
// homes. Their time betweens come from different families (2, 3, 5) and add up to different
// lengths, so their cycles never line up by themselves.
//
// Between cycles a line breathes (an unsounded between from its own time set), and now and then
// it lets a whole cycle pass unsounded, so two or three lines are heard at a time. It is louder
// the further it is from its standpoint.
//
// Later the principal strings join, one per group: each comes in on a wind's arrival, in unison
// with it (the two meet on the standpoint), and walks its own times from there.
//
// Every line stops before its first arrival after the time the piece asks it to leave, and says
// when that is ("out:<player>"): the next section sounds that arrival.

import { number, type Values } from "../../../src/sketch/knobs.ts";
import type { Context } from "../../../src/sketch/nest.ts";
import {
  ATOM,
  distanceDynamics,
  inOrder,
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
import type { Group, Trial } from "../material.ts";

export interface Standpoint {
  player: string;
  group: Group;
  family: Family;
  /** Time betweens in atoms, one per pitch between. */
  time: number[];
  /** Ticks: a first line enters here (the birth) … */
  born?: number;
  /** … and takes its first step here. */
  release?: number;
  /** Ticks: a second line enters on its group's first sounded arrival at or after this. */
  after?: number;
  /** Ticks: it stops before its first arrival at or after this. */
  leave: number;
}

export const knobs = {
  company: number({
    group: "Lines",
    label: "Company",
    help: "A wind rests a cycle when this many other winds are sounding (a string when one more is: all the lines count)",
    value: 2,
    min: 1,
    max: 4,
    step: 1,
  }),
  rests: number({
    group: "Lines",
    label: "Rests",
    help: "Share of cycles a line lets pass unsounded anyway (never its first two, never two running)",
    value: 0.15,
    min: 0,
    max: 0.7,
    step: 0.05,
  }),
  home: number({
    group: "Lines",
    label: "Level at home",
    help: "How loud a line is on its standpoint (it grows with the distance from it)",
    value: 3,
    min: 1,
    max: 5,
    step: 0.5,
  }),
  slope: number({
    group: "Lines",
    label: "Growth",
    help: "Level added for every semitone a line is from its standpoint",
    value: 0.28,
    min: 0,
    max: 0.6,
    step: 0.02,
  }),
};

export function score(v: Values<typeof knobs>, ctx: Context) {
  const trial = ctx.material.trial as Trial;
  const lines = (ctx.params.lines ?? []) as Standpoint[];
  const w = ctx.writer();
  const out = new Out(w, Math.round(ctx.start * 60));
  const k = trial.set.length;
  const orders = new Orders(k, trial.seed * 101 + 1);
  const times = new Orders(k, trial.seed * 101 + 2);
  const walks = new Map<string, Walk>();

  const cycles = (
    s: Standpoint,
    first: boolean,
    crowded: (at: number, self: Walker) => boolean,
  ) => {
    const rand = random(trial.seed * 7919 + s.player.length * 31 + s.player.charCodeAt(0));
    const atom = ATOM[s.family];
    let lastSilent = false;
    const range = PLAYABLE[ctx.player(s.player).instrument]!;
    return (c: number, at: number, from: number, self: Walker): Cycle | "stop" => {
      const fitted = orders.fit(s.player, trial.set, from, range);
      const pitch = inOrder(trial.set, fitted ?? orders.next(s.player));
      const time = inOrder(s.time, times.next(s.player));
      const breath = s.time[(c * 2) % k]!;
      // Rest when enough others sound, or now and then anyway; never two rests running.
      const silent = !fitted || (c >= 2 && !lastSilent && (crowded(at, self) || rand() < v.rests));
      lastSilent = silent;
      if (c === 0 && first && s.release !== undefined) {
        // The named pitch is held from the birth until the first step.
        const wait = Math.max(0, s.release - at - time[0]! * atom);
        return { pitch, time, family: s.family, wait, hold: true };
      }
      return { pitch, time, family: s.family, breath, silent };
    };
  };

  const write = (s: Standpoint, walked: Walk, entry: number) => {
    const anchor = trial.home[s.group];
    writeNotes(out, s.player, walked.notes);
    // The first note comes out of nothing.
    out.dyn(s.player, entry, 0);
    out.dyn(s.player, entry + 1, 0, true);
    distanceDynamics(out, s.player, walked.notes.slice(1), () => anchor, {
      home: v.home,
      slope: v.slope,
      top: 5.5,
    });
    const first = walked.notes[0];
    if (first) out.dyn(s.player, Math.min(first.at + first.dur, entry + 150), v.home, true);
    out.mark(walked.end.at, `out:${s.player}`);
    walks.set(s.player, walked);
  };

  // The winds first, side by side, each resting a cycle when enough of the others sound.
  const firsts = lines.filter((l) => l.born !== undefined);
  const windWalkers: Walker[] = [];
  firsts.forEach((s) => {
    windWalkers.push(
      new Walker({
        anchor: trial.home[s.group],
        start: s.born!,
        until: s.leave,
        first: true,
        cycle: cycles(s, true, (at, self) => soundingAt(windWalkers, at, self) >= v.company),
      }),
    );
  });
  walkTogether(windWalkers);
  firsts.forEach((s, i) => write(s, windWalkers[i]!.result(), s.born!));

  // Then the strings, each coming in on its group's wind as it arrives home, in unison with it.
  const winds = [...walks.values()];
  const seconds = lines.filter((l) => l.after !== undefined);
  const stringWalkers: Walker[] = [];
  const entries: { s: Standpoint; at: number; walker: Walker }[] = [];
  for (const s of seconds) {
    const partner = firsts.find((l) => l.group === s.group);
    const theirs = partner ? walks.get(partner.player) : undefined;
    const meeting = theirs?.notes.find((n) => n.step === 0 && n.sounded && n.at >= s.after!);
    if (!meeting) continue;
    const walker = new Walker({
      anchor: trial.home[s.group],
      start: meeting.at,
      until: s.leave,
      first: true,
      cycle: cycles(
        s,
        false,
        (at, self) => soundingIn(winds, at) + soundingAt(stringWalkers, at, self) >= v.company + 1,
      ),
    });
    stringWalkers.push(walker);
    entries.push({ s, at: meeting.at, walker });
  }
  walkTogether(stringWalkers);
  for (const e of entries) write(e.s, e.walker.result(), e.at);
  return w.done();
}

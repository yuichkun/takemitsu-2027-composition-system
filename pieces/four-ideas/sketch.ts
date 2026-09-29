// Four ideas, joined: a test of joining sections written as separate code (src/sketch/join.ts).
//
// The four are ideas Yogo likes for now, none of them decided for antara: the palette's breaths
// walking a chord, the chord of glass between the two grids, the running strings (his values), and
// the trial piece's last section. Each is rendered as it is, from its own code. This node only
// places them, hands the players over from one to the next, sets some of the next one's knobs from
// what the one before played ("carry"), and gives every voice a part of one orchestra. How each of
// the three joins goes is a knob here. Card: README.md.

import { choice, number, toggle, type Values } from "../../src/sketch/knobs.ts";
import { Motif } from "../../src/sketch/motif.ts";
import type { Context } from "../../src/sketch/nest.ts";
import type { Score } from "../../src/score/types.ts";
import { HOWS, isString, Joiner, type JoinSpec } from "../../src/sketch/join.ts";
import type { Ring } from "../trial/both-sides/sketch.ts";
import { PLAYABLE } from "../trial/engine.ts";
import { ensemble, optional } from "../trial/ensemble.ts";
import { driftPositions, homeOf, type Group, type Trial } from "../trial/material.ts";

const JOINS = ["breaths → glass", "glass → running", "running → rings"] as const;

/** The knobs of one join, with what that join does unless they are moved. */
function joinKnobs(
  i: 1 | 2 | 3,
  d: {
    how: JoinSpec["how"];
    lead: number;
    spread: number;
    order: JoinSpec["order"];
    others: JoinSpec["others"];
  },
) {
  const group = `${i} · ${JOINS[i - 1]}`;
  return {
    [`how${i}`]: choice({
      group,
      label: "How",
      help: "end to end: the next starts where this one ends · rest: a silence between · at once: everything changes at one moment · by players: the players change over one group at a time",
      value: d.how,
      options: [...HOWS],
    }),
    [`carry${i}`]: toggle({
      group,
      label: "Carry",
      help: "Set some of the next section's knobs from what this one played (off: the next plays with its own values)",
      value: true,
    }),
    [`lead${i}`]: number({
      group,
      label: "Lead",
      help: "at once, by players: how many quarters before its end this section gives way (counted in its own quarters)",
      value: d.lead,
      min: 0,
      max: 48,
      step: 1,
      unit: "beats",
    }),
    [`spread${i}`]: number({
      group,
      label: "Spread",
      help: "by players: quarters (of the next section) from the first group's change to the last",
      value: d.spread,
      min: 0,
      max: 48,
      step: 1,
      unit: "beats",
    }),
    [`order${i}`]: choice({
      group,
      label: "Order",
      help: "by players: which register changes first",
      value: d.order,
      options: ["low first", "high first"],
    }),
    [`others${i}`]: choice({
      group,
      label: "The others",
      help: "by players: this section's players the next one does not take: play on to its end, or stop with the last change",
      value: d.others,
      options: ["play on", "stop"],
    }),
    [`rest${i}`]: number({
      group,
      label: "Rest",
      help: "rest: quarters of silence between",
      value: 4,
      min: 0,
      max: 32,
      step: 1,
      unit: "beats",
    }),
  };
}

export const knobs = {
  ...joinKnobs(1, {
    how: "by players",
    lead: 12,
    spread: 8,
    order: "low first",
    others: "play on",
  }),
  ...joinKnobs(2, { how: "by players", lead: 9, spread: 18, order: "low first", others: "stop" }),
  ...joinKnobs(3, { how: "at once", lead: 3, spread: 0, order: "low first", others: "play on" }),
};

type V = Values<typeof knobs>;

const specOf = (v: V, i: 1 | 2 | 3): JoinSpec => {
  const x = v as unknown as Record<string, unknown>;
  return {
    how: x[`how${i}`] as JoinSpec["how"],
    lead: x[`lead${i}`] as number,
    spread: x[`spread${i}`] as number,
    order: x[`order${i}`] as JoinSpec["order"],
    others: x[`others${i}`] as JoinSpec["others"],
    rest: x[`rest${i}`] as number,
  };
};
const carries = (v: V, i: 1 | 2 | 3) =>
  (v as unknown as Record<string, unknown>)[`carry${i}`] === true;

// The trial piece's material and rings for its last section (pieces/trial/sketch.ts), the rings'
// entries counted from the first.
const DRIFT = [6.5, -5.5, 4.5, -3.5, 2.5, -1.5, 0.5];
const POSITIONS = driftPositions(DRIFT);
const TRIAL: Trial = {
  set: [-4.5, -3, 0.5, 1.5, 5.5],
  home: homeOf(46, [13, 14, 11]),
  drift: DRIFT,
  axis: (POSITIONS[POSITIONS.length - 1]! + POSITIONS[POSITIONS.length - 2]!) / 2,
  seed: 7,
  meet: 0,
};
const RINGS: Ring[] = [
  {
    upper: "vn1s",
    lower: "vcs",
    group: "ML",
    family: 3,
    time: [18, 24, 21, 27, 30],
    enter: 0,
    breath: "eh",
    handover: { player: "cbs", below: 40 },
  },
  {
    upper: "vcq1",
    lower: "cbq1",
    group: "L",
    family: 5,
    time: [25, 30, 35, 40, 45],
    enter: 14 * 60,
    breath: "bn1",
  },
  {
    upper: "vn2q1",
    lower: "vaq1",
    group: "MH",
    family: 2,
    time: [20, 24, 28, 32, 36],
    enter: 24 * 60,
    breath: "ob1",
  },
  {
    upper: "vn1q1",
    lower: "vn2q2",
    group: "H",
    family: 3,
    time: [15, 18, 21, 24],
    enter: 34 * 60,
    breath: "fl1",
  },
];
/** The tempo the trial piece's last section is played at there. */
const RINGS_BPM = 54;

export function score(v: V, ctx: Context): Score {
  const motif = new Motif([{ at: 0, dur: 1, midi: 60 }]);
  const piece = ctx.with({ ensemble, material: { motif }, flows: {} });
  const J = new Joiner(piece);
  const rest = J.section("rest", { values: { beats: 64 } });

  // 1. The breaths walk the chord, as it is.
  const breaths = J.section("breaths");
  const a = J.place(breaths, { at: 0, label: "breaths" });

  // 2. The chord of glass. Carried: the upper twelve tones the strings hold where it comes in, as its
  // chord (the lowest of them and the betweens above it), at the same tempo.
  const s1 = specOf(v, 1);
  const held = J.before(a, J.startOf(a, s1)).filter((t) => isString(t.instrument));
  const upper = held.slice(-12);
  const glassValues =
    carries(v, 1) && upper.length === 12
      ? {
          anchor: upper[0]!.midi,
          chord: upper.slice(1, 5).map((t, k) => t.midi - upper[k]!.midi),
          tempo: breaths.bpm,
        }
      : undefined;
  const glass = J.section("glass", glassValues ? { values: glassValues } : {});
  // Harp II and the piano were tuned a quarter tone low for the other grid; neither is used any
  // more (docs/antara/sound.md), so the flute and the clarinet catch that grid's light.
  const glassParts = {
    hp2: { part: "fl3", technique: null },
    pno: { part: "cl3", technique: null, fold: [72, 88] as [number, number] },
  };
  const b = J.next(a, glass, s1, { label: "glass", parts: glassParts }, rest);

  // 3. The running strings. Carried: the anchor is the lowest tone the glass sounds where they come in.
  const s2 = specOf(v, 2);
  const low = J.before(b, J.startOf(b, s2)).find((t) => isString(t.instrument));
  const running = J.section(
    "running",
    carries(v, 2) && low ? { values: { anchor: low.midi } } : {},
  );
  const c = J.next(b, running, s2, { label: "running" }, rest);

  // 4. The trial piece's last section. Carried: each ring opens around a tone the running ended on,
  // low to high (the ring on the quarter tone above it), instead of the trial piece's home chord;
  // moved by octaves to where both of the ring's players can start.
  const s3 = specOf(v, 3);
  const ending = J.last(c);
  const groups: Group[] = ["L", "ML", "MH", "H"];
  const startable = (g: Group): [number, number] => {
    const r = RINGS.find((x) => x.group === g)!;
    const up = PLAYABLE[ensemble.find((p) => p.id === r.upper)!.instrument]!;
    const down = PLAYABLE[ensemble.find((p) => p.id === r.lower)!.instrument]!;
    return [up[0], down[1] - 0.5];
  };
  const into = (m: number, [lo, hi]: [number, number]) => {
    let x = m;
    while (x > hi) x -= 12;
    while (x < lo) x += 12;
    return x;
  };
  const trial: Trial =
    carries(v, 3) && ending.length >= 4
      ? {
          ...TRIAL,
          home: Object.fromEntries(
            groups.map((g, k) => [g, into(ending[k]!.midi, startable(g))]),
          ) as Record<Group, number>,
          axis: 0.25,
        }
      : TRIAL;
  const rings = J.section("rings", {
    bpm: RINGS_BPM,
    material: { motif, trial },
    params: { rings: RINGS },
  });
  J.next(c, rings, s3, { label: "rings" }, rest);

  const out = J.score({ title: "antara · four ideas, joined" });
  return { ...out, parts: out.parts.filter((p) => p.events.length || !optional.has(p.id)) };
}

// Sketch: strings only, fast 16ths with a bow change on every note, short and biting.
// The four sections hand the figure to each other with a little overlap, pile up like the
// stretto of a fugue, and run up together to the end. Card: README.md.
//
// Every knob's value is a stand-in chosen by Claude until 余湖さん changes it (marked 仮 in the
// preview).

import type { Articulation, NoteEvent, Part, Score } from "../../src/score/types.ts";
import { choice, number, numbersOf, pitchOf, text, type Values } from "../../src/sketch/knobs.ts";

export const knobs = {
  tempo: number({ label: "テンポ", value: 144, min: 80, max: 200, step: 2, unit: "♩=" }),
  articulation: choice({
    label: "奏法",
    value: "staccato",
    options: ["staccato", "spiccato"],
  }),
  vn1: text({ label: "Vn I の基音", value: "A4", hint: "例: A4、E+4" }),
  vn2: text({ label: "Vn II の基音", value: "D4" }),
  va: text({ label: "Va の基音", value: "A3" }),
  vc: text({ label: "Vc の基音", value: "D3" }),
  wedge: text({
    label: "音型「楔」（基音からの半音、1 小節分）",
    value: "0 1 0 3 0 4 0 6 0 7 0 9 0 10 0 12",
    hint: "0.5 刻みで四分音",
  }),
  hammer: text({
    label: "音型「槌」（基音からの半音、1 小節分）",
    value: "0 0 1 0 0 0 1 0 3 3 1 0 4 3 1 0",
  }),
  scale: text({
    label: "駆け上がりの音階（1 オクターブ分、半音）",
    value: "0 1 3 4 6 7 9 10",
  }),
  barsA: number({ label: "A: 受け渡しの小節数", value: 8, min: 0, max: 24, step: 1 }),
  gapA: number({ label: "A: 入りの間隔", value: 16, min: 1, max: 32, step: 1, unit: "16分" }),
  barsB: number({ label: "B: 3 声の小節数", value: 6, min: 0, max: 24, step: 1 }),
  gapB: number({ label: "B: 入りの間隔", value: 8, min: 1, max: 32, step: 1, unit: "16分" }),
  length: number({
    label: "A・B: 1 回に弾く長さ",
    value: 24,
    min: 1,
    max: 64,
    step: 1,
    unit: "16分",
  }),
  liftB: number({ label: "B: 移調", value: 3, min: -12, max: 12, step: 0.5, unit: "半音" }),
  barsC: number({ label: "C: 全員の小節数", value: 4, min: 0, max: 24, step: 1 }),
  liftC: number({ label: "C: 移調", value: 6, min: -12, max: 12, step: 0.5, unit: "半音" }),
  startLevel: number({
    label: "最初の強弱",
    value: 3,
    min: 0,
    max: 8,
    step: 0.5,
    unit: "0=niente 3=p 8=fff",
  }),
  endLevel: number({ label: "最後の強弱", value: 8, min: 0, max: 8, step: 0.5 }),
};

const bar = 16; // sixteenths in a 4/4 bar

export function score(v: Values<typeof knobs>): Score {
  const sections = [
    { id: "vc", instrument: "cellos", base: pitchOf("Vc の基音", v.vc) },
    { id: "va", instrument: "violas", base: pitchOf("Va の基音", v.va) },
    { id: "vn2", instrument: "violins-2", base: pitchOf("Vn II の基音", v.vn2) },
    { id: "vn1", instrument: "violins-1", base: pitchOf("Vn I の基音", v.vn1) },
  ];
  const figures = {
    wedge: numbersOf("楔", v.wedge),
    hammer: numbersOf("槌", v.hammer),
  };
  const scale = numbersOf("駆け上がりの音階", v.scale);
  const step = (k: number) =>
    scale[((k % scale.length) + scale.length) % scale.length]! + 12 * Math.floor(k / scale.length);

  // When each section plays: A hands the figure round, B keeps three going, C has all four.
  const [a, b, c] = [v.barsA, v.barsB, v.barsC].map((n) => Math.round(n) * bar) as [
    number,
    number,
    number,
  ];
  const runAt = a + b + c;
  interface Entry {
    voice: number;
    at: number;
    length: number;
    figure: keyof typeof figures;
    lift: number;
  }
  const entries: Entry[] = [];
  for (let i = 0; i * v.gapA < a; i++)
    entries.push({
      voice: i % 4,
      at: i * v.gapA,
      length: v.length,
      figure: i < 4 ? "wedge" : "hammer",
      lift: 0,
    });
  for (let j = 0; j * v.gapB < b; j++)
    entries.push({
      voice: j % 4,
      at: a + j * v.gapB,
      length: v.length,
      figure: j % 2 ? "hammer" : "wedge",
      lift: v.liftB,
    });
  if (c > 0)
    for (let s = 0; s < 4; s++)
      entries.push({
        voice: s,
        at: a + b + 2 * s,
        length: c - 2 * s,
        figure: "wedge",
        lift: v.liftC,
      });

  const technique = v.articulation === "spiccato" ? "spiccato" : undefined;
  const end = runAt / 4 + 4; // quarters: the run bar
  const dynamics = [
    { at: 0, level: v.startLevel, to: "linear" as const },
    { at: end, level: v.endLevel },
  ];

  const part = (s: number): Part => {
    const section = sections[s]!;
    const mine = entries.filter((e) => e.voice === s).sort((x, y) => x.at - y.at);
    const events: NoteEvent[] = [];
    const note = (at: number, midi: number, articulations: Articulation[]): void => {
      events.push({ at: at / 4, dur: 0.25, pitch: { midi }, articulations, technique });
    };
    mine.forEach((e, k) => {
      // A later entry of the same section cuts the one before it.
      const stop = Math.min(e.at + e.length, mine[k + 1]?.at ?? Infinity, runAt);
      const figure = figures[e.figure];
      for (let t = e.at; t < stop; t++)
        note(
          t,
          section.base + e.lift + figure[(t - e.at) % figure.length]!,
          t === e.at ? ["staccato", "accent"] : ["staccato"],
        );
    });
    // The run: every section climbs from its base through two octaves of the scale.
    for (let t = 0; t < bar; t++)
      note(runAt + t, section.base + step(t), t % 4 === 0 ? ["staccato", "accent"] : ["staccato"]);
    // The top, short and accented.
    events.push({
      at: end,
      dur: 0.5,
      pitch: { midi: section.base + step(bar) },
      articulations: ["staccato", "accent"],
    });
    return { id: section.id, instrument: section.instrument, dynamics, events };
  };

  const rehearsal = [
    { measure: 1, label: "A" },
    { measure: a / bar + 1, label: "B" },
    { measure: (a + b) / bar + 1, label: "C" },
    { measure: runAt / bar + 1, label: "D" },
  ].filter((r, i, all) => all.findIndex((x) => x.measure === r.measure) === i);

  return {
    title: `弦の16分（${v.articulation}）`,
    meter: [{ measure: 1, beats: 4, beatType: 4 }],
    tempo: [{ at: 0, bpm: v.tempo }],
    measures: runAt / bar + 2,
    rehearsal,
    parts: [3, 2, 1, 0].map(part), // score order: vn1, vn2, va, vc
  };
}

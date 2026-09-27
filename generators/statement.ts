// A statement of the piece's motif by one player, in one of its forms: once, its last note held
// ("motif"); again and again along its own intervals ("sequence"); spun out into a phrase that
// changes it as it goes, compressed, cut to its head, closed on its tail slowed down ("spin out");
// or stretched over the whole block in long notes ("fill": a cantus).

import type { NoteEvent } from "../src/score/types.ts";
import { choice, number, type Auto, type Values } from "../src/sketch/knobs.ts";
import { Motif, type Form, type Tone } from "../src/sketch/motif.ts";
import type { Context, Fragment, Player } from "../src/sketch/nest.ts";
import { harpStaff, names, snap, windowOf } from "./common.ts";

const phrases = ["motif", "sequence", "spin out", "fill"] as const;
type Phrase = (typeof phrases)[number];
const touches = ["legato", "tenuto", "detached", "marcato"] as const;
type Touch = (typeof touches)[number];

export interface StatementDefaults {
  by: string;
  form?: Form;
  key?: "section" | "home";
  transpose?: number;
  octave?: number;
  widen?: number;
  stretch?: number;
  phrase?: Phrase;
  enters?: number;
  dynamic?: Auto;
  hairpins?: "swell" | "fade" | "none";
  touch?: Touch;
}

interface Step {
  at: number;
  m: Motif;
  /** Semitones along the motif's own path. */
  shift: number;
}

/** Moved by octaves so it starts near `target`, keeping inside [lo, hi] as well as it can. */
function placeNear(m: Motif, target: number, lo: number, hi: number): Motif {
  let best = m;
  let score = Infinity;
  for (let o = -3; o <= 3; o++) {
    const c = m.transpose(12 * o);
    const out = c.pitches.reduce((a, p) => a + Math.max(0, lo - p, p - hi), 0);
    const s = Math.abs(c.first - target) + 20 * out;
    if (s < score) {
      score = s;
      best = c;
    }
  }
  return best;
}

/** Its long notes shortened to two thirds, the notes after them brought forward. */
function compress(m: Motif): Motif {
  const tones: Tone[] = [];
  let t = 0;
  m.tones.forEach((tone, i) => {
    const dur = tone.dur >= 1 ? Math.max(0.5, snap((tone.dur * 2) / 3)) : tone.dur;
    tones.push({ ...tone, at: t, dur });
    const next = m.tones[i + 1];
    const gap = next ? Math.max(0, next.at - (tone.at + tone.dur)) : 0;
    t += dur + gap;
  });
  return new Motif(tones, m.form);
}

/** Its last tone lengthened so the whole lasts `until` quarters (never shortened). */
function holdTo(m: Motif, until: number): Motif {
  const n = m.size;
  return m.lengths((t, i) => (i === n - 1 ? Math.max(t.dur, until - t.at) : t.dur));
}

function phrase(m: Motif, kind: Phrase, room: number, lo: number, hi: number): Step[] {
  const n = m.size;
  const path = m.path;
  if (kind === "fill") {
    const f = room / Math.max(0.25, m.length);
    const starts = m.tones.map((t) => Math.min(room, snap(t.at * f, 0.5)));
    const tones = m.tones
      .map((t, i) => ({
        at: starts[i]!,
        dur: (i + 1 < n ? starts[i + 1]! : room) - starts[i]!,
        midi: t.midi,
      }))
      .filter((t) => t.dur > 0);
    return [{ at: 0, m: new Motif(tones, m.form), shift: 0 }];
  }
  if (kind === "motif") return [{ at: 0, m: holdTo(m, Math.min(room, m.length * 3)), shift: 0 }];
  const steps: Step[] = [];
  if (kind === "sequence") {
    let t = 0;
    let last = m.first;
    for (let k = 0; t < room - 0.5; k++) {
      const s = placeNear(m.transpose(path[k % n]!), k ? last : m.first, lo, hi);
      steps.push({ at: t, m: s, shift: path[k % n]! });
      last = s.last;
      t += s.length + 0.5;
    }
  } else {
    // Spin out: the motif; compressed a step along its path; its head pressing on; its tail
    // slowed to a cadence, after a breath.
    const head = m.head(Math.max(2, n - 1));
    const variants = [
      m,
      compress(m).transpose(path[1 % n]!),
      head
        .lengths((t, i) => (i === head.size - 1 ? Math.min(t.dur, 1) : t.dur))
        .transpose(path[2 % n]!),
      m
        .tail(Math.min(2, n))
        .stretch(2)
        .transpose(path[3 % n]!),
    ];
    let t = 0;
    let last = m.first;
    variants.forEach((s, k) => {
      if (k === 3) t += 0.5;
      const placed = k ? placeNear(s, last, lo, hi) : s;
      steps.push({ at: t, m: placed, shift: path[k % n]! });
      last = placed.last;
      t += placed.length;
    });
  }
  // The last note rings on a little (up to the end of the block).
  const end = steps.at(-1)!;
  steps[steps.length - 1] = {
    ...end,
    m: holdTo(end.m, Math.min(room - end.at, end.m.length + 3)),
  };
  return steps.filter((s) => s.at < room);
}

export function statement(ensemble: readonly Player[], d: StatementDefaults) {
  const knobs = {
    by: choice({
      group: "Who",
      label: "Played by",
      help: "The player who states the motif",
      value: d.by,
      options: names(ensemble),
    }),
    form: choice({
      group: "Motif",
      label: "Form",
      help: "P as written, I upside down, R backwards, RI both",
      value: d.form ?? "P",
      options: ["P", "I", "R", "RI"],
    }),
    key: choice({
      group: "Motif",
      label: "Key",
      help: "section: moved to the section's centre · home: where the motif is written",
      value: d.key ?? "section",
      options: ["section", "home"],
    }),
    transpose: number({
      group: "Motif",
      label: "Transpose",
      help: "Semitones on top of the key",
      value: d.transpose ?? 0,
      min: -12,
      max: 12,
      step: 0.5,
      unit: "st",
    }),
    octave: number({
      group: "Motif",
      label: "Octave",
      help: "Octaves up or down from where it lies best for the player",
      value: d.octave ?? 0,
      min: -2,
      max: 2,
      step: 1,
    }),
    widen: number({
      group: "Motif",
      label: "Widen",
      help: "Its intervals ×: 2 makes every step twice as wide; 1.5 or 0.5 give quarter tones",
      value: d.widen ?? 1,
      min: 0.5,
      max: 3,
      step: 0.25,
    }),
    stretch: number({
      group: "Motif",
      label: "Stretch",
      help: "Its rhythm ×: 2 is twice as slow",
      value: d.stretch ?? 1,
      min: 0.5,
      max: 4,
      step: 0.25,
    }),
    phrase: choice({
      group: "Phrase",
      label: "Phrase",
      help: "motif: once, the last note held · sequence: again along its own intervals · spin out: changed as it goes (compressed, cut to its head, closed on its tail slowed down) · fill: stretched over the whole block",
      value: d.phrase ?? "spin out",
      options: [...phrases],
    }),
    enters: number({
      group: "Phrase",
      label: "Enters",
      help: "Beats after the block starts",
      value: d.enters ?? 0,
      min: 0,
      max: 32,
      step: 0.5,
      unit: "beats",
    }),
    dynamic: number({
      group: "Sound",
      label: "Dynamic",
      help: "1 ppp · 2 pp · 3 p · 4 mp · 5 mf · 6 f · 7 ff. May follow the piece's intensity",
      follow: true,
      value: d.dynamic ?? { follow: "intensity", from: 2, to: 6.5 },
      min: 0,
      max: 8,
      step: 0.5,
    }),
    hairpins: choice({
      group: "Sound",
      label: "Hairpins",
      help: "swell: each statement grows to its longest note and falls away · fade: the phrase dies away · none",
      value: d.hairpins ?? "swell",
      options: ["swell", "fade", "none"],
    }),
    touch: choice({
      group: "Sound",
      label: "Touch",
      help: "legato: slurred · tenuto: each note leaned on · detached: short notes staccato · marcato: accented",
      value: d.touch ?? "legato",
      options: [...touches],
    }),
  };

  function score(v: Values<typeof knobs>, ctx: Context): Fragment {
    const player = ctx.playerNamed(v.by);
    const id = player.id;
    const [lo, hi] = windowOf(player);
    const w = ctx.writer();
    const room = ctx.length - v.enters;
    if (room <= 0.25) return w.done();
    const m = ctx.material.motif
      .as(v.form as Form)
      .widen(v.widen)
      .stretch(v.stretch)
      .onGrid(0.25)
      .transpose((v.key === "home" ? 0 : ctx.centre) + v.transpose)
      .within(lo, hi)
      .transpose(12 * v.octave);
    w.use(m.form);
    const steps = phrase(m, v.phrase as Phrase, room, lo, hi);
    steps.forEach((step, k) => {
      const t0 = v.enters + step.at;
      const level = ctx.value(v.dynamic, t0);
      const end = t0 + step.m.length;
      if (v.hairpins === "swell") {
        w.dynamic(id, t0, level - 0.5, "linear");
        w.dynamic(id, t0 + step.m.peak.at, level + 0.5, "linear");
        w.dynamic(id, end, level - 1);
      } else if (v.hairpins === "fade" && k === steps.length - 1) {
        w.dynamic(id, t0, level, "linear");
        w.dynamic(id, end, Math.max(0.5, level - 2.5));
      } else w.dynamic(id, t0, level);
      step.m.tones.forEach((tone, i) => {
        const last = i === step.m.size - 1;
        const note: NoteEvent = { at: t0 + tone.at, dur: tone.dur, pitch: { midi: tone.midi } };
        const staff = harpStaff(player, tone.midi);
        if (staff) note.staff = staff;
        if (v.touch === "legato" && !last) note.slur = true;
        else if (v.touch === "tenuto") note.articulations = ["tenuto"];
        else if (v.touch === "detached")
          note.articulations = [tone.dur <= 0.5 ? "staccato" : "tenuto"];
        else if (v.touch === "marcato") note.articulations = ["accent"];
        w.note(id, note);
      });
      // Where the step stands, from the section's centre (the bells can strike its chord).
      const shift = (v.key === "home" ? -ctx.centre : 0) + v.transpose + step.shift;
      w.mark(t0, k === steps.length - 1 && steps.length > 1 ? "cadence" : "step", shift);
    });
    return w.done();
  }

  return { knobs, score };
}

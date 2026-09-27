// Motifs: short melodies, and what a piece does to them (src/sketch/nest.ts, docs/architecture.md,
// "Pieces"). A motif is a list of tones in its own time (0 = its first onset). Every operation gives
// a new motif; `form` follows the four classic forms (P, I, R, RI) through inversion and
// retrograde, so the piece's map can show which forms sound where.

export interface Tone {
  /** Start and length, in quarters from the motif's start. */
  at: number;
  dur: number;
  /** MIDI on the quarter-tone grid. */
  midi: number;
}

export type Form = "P" | "I" | "R" | "RI";

const clean = (x: number) => Math.round(x * 1e6) / 1e6;
const snap = (x: number, grid: number) => clean(Math.round(x / grid) * grid);
/** Pitch class on the quarter-tone grid (0–11.5). */
export const classOf = (midi: number) => ((midi % 12) + 12) % 12;

export class Motif {
  readonly tones: readonly Tone[];
  readonly form: Form;

  constructor(tones: readonly Tone[], form: Form = "P") {
    const sorted = [...tones].sort((a, b) => a.at - b.at);
    const start = sorted[0]?.at ?? 0;
    this.tones = sorted.map((t) => ({ at: clean(t.at - start), dur: clean(t.dur), midi: t.midi }));
    this.form = form;
  }

  /** From a motif knob's value: [start, length, MIDI] per note. */
  static of(value: readonly (readonly [number, number, number])[], form: Form = "P"): Motif {
    return new Motif(
      value.map(([at, dur, midi]) => ({ at, dur, midi })),
      form,
    );
  }

  get size(): number {
    return this.tones.length;
  }
  /** From its first onset to the end of its last tone, in quarters. */
  get length(): number {
    return Math.max(0, ...this.tones.map((t) => t.at + t.dur));
  }
  get pitches(): number[] {
    return this.tones.map((t) => t.midi);
  }
  get first(): number {
    return this.tones[0]?.midi ?? 60;
  }
  get last(): number {
    return this.tones.at(-1)?.midi ?? 60;
  }
  get lowest(): number {
    return Math.min(...this.pitches);
  }
  get highest(): number {
    return Math.max(...this.pitches);
  }
  /** Each tone's distance from the first, in semitones: the motif read as a path of transpositions. */
  get path(): number[] {
    return this.tones.map((t) => clean(t.midi - this.first));
  }
  /** Its pitch classes (0–11.5), each once, in order of appearance. */
  get classes(): number[] {
    return [...new Set(this.tones.map((t) => classOf(t.midi)))];
  }
  /** Where its longest tone starts (the goal of the gesture, often). */
  get peak(): Tone {
    return this.tones.reduce((a, b) => (b.dur > a.dur ? b : a), this.tones[0]!);
  }

  private make(tones: Tone[], form: Form = this.form): Motif {
    return new Motif(tones, form);
  }

  transpose(semitones: number): Motif {
    return this.make(this.tones.map((t) => ({ ...t, midi: clean(t.midi + semitones) })));
  }

  /** Mirrored around its first pitch (or `axis`). */
  invert(axis = this.first): Motif {
    const form = ({ P: "I", I: "P", R: "RI", RI: "R" } as const)[this.form];
    return this.make(
      this.tones.map((t) => ({ ...t, midi: clean(2 * axis - t.midi) })),
      form,
    );
  }

  /** Backwards: the pitches in reverse order, and the rhythm too (lengths and gaps). */
  retrograde(): Motif {
    const form = ({ P: "R", R: "P", I: "RI", RI: "I" } as const)[this.form];
    const end = this.length;
    return this.make(
      this.tones.map((t) => ({ ...t, at: end - (t.at + t.dur) })),
      form,
    );
  }

  /** One of the four forms, taking this motif as P. */
  as(form: Form): Motif {
    if (form === "I") return this.invert();
    if (form === "R") return this.retrograde();
    if (form === "RI") return this.invert().retrograde();
    return this;
  }

  /** Times scaled: over 1 augments, under 1 diminishes. */
  stretch(factor: number): Motif {
    return this.make(this.tones.map((t) => ({ ...t, at: t.at * factor, dur: t.dur * factor })));
  }

  /** Intervals from the first pitch scaled, then snapped to `grid` (0.5: quarter tones). */
  widen(factor: number, grid = 0.5): Motif {
    const f = this.first;
    return this.make(
      this.tones.map((t) => ({ ...t, midi: snap(f + (t.midi - f) * factor, grid) })),
    );
  }

  /** Tones `from` to `to` (not included), starting at 0. */
  slice(from: number, to = this.size): Motif {
    return this.make(this.tones.slice(from, to));
  }
  /** The first n tones. */
  head(n: number): Motif {
    return this.slice(0, Math.max(1, Math.min(this.size, n)));
  }
  /** The last n tones. */
  tail(n: number): Motif {
    return this.slice(Math.max(0, this.size - Math.max(1, n)));
  }

  /** The pitches moved k places along the rhythm (the rhythm stays). */
  rotate(k: number): Motif {
    const n = this.size;
    return this.make(
      this.tones.map((t, i) => ({ ...t, midi: this.tones[(((i + k) % n) + n) % n]!.midi })),
    );
  }

  /** Each tone's length changed (its start stays): e.g. long tones shortened. */
  lengths(f: (t: Tone, i: number) => number): Motif {
    return this.make(this.tones.map((t, i) => ({ ...t, dur: Math.max(0.0625, clean(f(t, i))) })));
  }

  /** The tones moved in time (lengths kept, then re-sorted). */
  times(f: (t: Tone, i: number) => number): Motif {
    return this.make(this.tones.map((t, i) => ({ ...t, at: Math.max(0, f(t, i)) })));
  }

  /**
   * Starts and lengths snapped to a grid (0.25: sixteenths), one tone at a time: no two start
   * together, none runs into the next.
   */
  onGrid(grid = 0.25): Motif {
    const tones: Tone[] = [];
    let earliest = 0;
    for (const t of this.tones) {
      const at = Math.max(earliest, snap(t.at, grid));
      tones.push({ ...t, at, dur: Math.max(grid, snap(t.dur, grid)) });
      earliest = at + grid;
    }
    for (let i = 0; i + 1 < tones.length; i++)
      tones[i]!.dur = Math.min(tones[i]!.dur, clean(tones[i + 1]!.at - tones[i]!.at));
    return this.make(tones);
  }

  /** Moved by octaves so its first pitch is as near to `target` as it can be. */
  near(target: number): Motif {
    return this.transpose(12 * Math.round((target - this.first) / 12));
  }

  /**
   * Moved by octaves so it lies in [lo, hi] as well as it can: the fewest semitones outside, then
   * the nearest to the middle.
   */
  within(lo: number, hi: number): Motif {
    let best = this as Motif;
    let score = Infinity;
    const mid = (lo + hi) / 2;
    for (let o = -6; o <= 6; o++) {
      const m = this.transpose(12 * o);
      const out = m.pitches.reduce((a, p) => a + Math.max(0, lo - p, p - hi), 0);
      const centre = Math.abs((m.lowest + m.highest) / 2 - mid);
      const s = out * 100 + centre;
      if (s < score) {
        score = s;
        best = m;
      }
    }
    return best;
  }
}

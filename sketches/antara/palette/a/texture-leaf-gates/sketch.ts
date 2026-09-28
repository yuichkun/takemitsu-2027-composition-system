// antara palette, A (texture): a chord whose leaves open and close.
//
// Eight divided string voices hold one chord, the standpoint with the set's betweens stacked on it
// (narrowest first, the order the set is held in). No pitch ever changes. Only time moves: each
// voice opens (sounds) for a number of atoms and closes (rests) for a number of atoms, again and
// again. The numbers are the same for every voice; each voice counts them in its own family, handed
// round from the lowest voice up (2, 3, 5, 2, 3, 5, ...). So the same numbers last different
// times: a cycle of n atoms is n/4 beats in the 2 family, n/3 in the 3, n/5 in the 5. Voice k starts
// its cycle k staggers in. Nothing says how many voices sound at a moment: the thickness of the
// chord is only where the voices' cycles happen to stand.
//
// The families meet on every beat, so their cycles meet too: every voice is back where it started
// after n beats, whatever the stagger. The thickness therefore repeats every (open + closed) beats.
// The numbers are chosen so that this is longer than the sketch, and the thickness never repeats.
//
// A voice attacks its pitch again (pp, senza vib.) each time it opens, and simply stops when it
// closes. In the last bar nothing opens or closes any more: the voices open at its downbeat hold to
// the end and fade out together, the closed ones stay silent. Card: README.md.

import type { NoteEvent, TextEvent } from "../../../../../src/score/types.ts";
import { betweenSet, number, pitch, type Values } from "../../../../../src/sketch/knobs.ts";
import { atomOf, type Family } from "../../../between.ts";
import { curve, divisi, note, part, scoreOf, TICKS } from "../../common.ts";

/** The family of each voice, from the lowest up, round and round. */
const FAMILIES: Family[] = [2, 3, 5];

export const knobs = {
  chord: betweenSet({
    group: "Chord",
    label: "Chord",
    help: "The betweens stacked on the standpoint, narrowest at the bottom (semitones, .5 for a quarter tone). One voice more than betweens; no pitch ever changes",
    value: "1 1 1.5 2 2.5 3.5 4",
    min: 0,
    max: 12,
    step: 0.5,
    unit: "st",
  }),
  anchor: pitch({
    group: "Chord",
    label: "Standpoint",
    help: "The lowest voice",
    value: "G3",
    min: "C2",
    max: "C5",
    step: 0.5,
  }),
  open: number({
    group: "Gates",
    label: "Open",
    help: "How long a voice sounds each time it opens, in atoms of its own family (the same number for every voice)",
    value: 44,
    min: 1,
    max: 120,
    step: 1,
    unit: "atoms",
  }),
  closed: number({
    group: "Gates",
    label: "Closed",
    help: "How long a voice rests each time it closes, in atoms of its own family (the same number for every voice). The thickness repeats every Open + Closed beats",
    value: 22,
    min: 1,
    max: 120,
    step: 1,
    unit: "atoms",
  }),
  stagger: number({
    group: "Gates",
    label: "Stagger",
    help: "Voice k (0 the lowest) starts k times this far into its cycle, in atoms of its own family",
    value: 11,
    min: 0,
    max: 120,
    step: 1,
    unit: "atoms",
  }),
  bars: number({
    group: "Form",
    label: "Bars",
    help: "Length in bars of 4/4; in the last bar the open voices hold and fade out",
    value: 16,
    min: 2,
    max: 40,
    step: 1,
    unit: "bars",
  }),
  tempo: number({
    group: "Form",
    label: "Tempo",
    help: "Quarter notes per minute",
    value: 54,
    min: 40,
    max: 120,
    step: 2,
    unit: "bpm",
  }),
};

export function score(v: Values<typeof knobs>) {
  const bar = 4 * TICKS;
  const end = v.bars * bar;
  const last = end - bar;
  const cycle = v.open + v.closed;

  const pitches = [v.anchor];
  for (const b of v.chord) pitches.push(pitches.at(-1)! + b);
  const players = divisi(pitches.map((m): [number, number] => [m, m]));

  const parts = pitches.map((midi, k) => {
    const atom = atomOf(FAMILIES[k % FAMILIES.length]!);
    // The voice's cycle began `into` atoms before the start.
    const into = (k * v.stagger) % cycle;
    const events: NoteEvent[] = [];
    for (let open = -into * atom; open <= last; open += cycle * atom) {
      const from = Math.max(0, open);
      const close = open + v.open * atom;
      if (close <= from) continue;
      // Open at the last bar's downbeat: it holds to the end.
      const to = close > last ? end : close;
      events.push(note(from, to - from, midi));
    }
    const dynamics = curve([
      { at: 0, level: 2 },
      { at: last, level: 2, ramp: true },
      { at: end, level: 0 },
    ]);
    const out = part(players[k]!, events, dynamics);
    const mark: TextEvent = { type: "text", at: events[0]?.at ?? 0, text: "senza vib." };
    out.events.unshift(mark);
    return out;
  });

  return scoreOf(
    "antara · palette A · a chord whose leaves open and close",
    v.bars,
    v.tempo,
    parts.reverse(),
  );
}

// Checks the notation the preview shows (docs/decisions/0020):
// 1. octave instruments are written in the conventional direction (contrabasses above sounding
//    pitch, piccolo below …);
// 2. how many notes still need more than 3 ledger lines after clef changes and octave lines, per
//    instrument (a chord spanning more than one staff can hold is the usual reason);
// 3. drawing measures one by one with a shared staff spacing lines their staves up, and how long
//    drawing takes.
//
//   vp node tools/notation-check.ts <score.json> [--measures 24]
//
// Exits 1 if an octave instrument goes the wrong way or the staves do not line up.

import { readFileSync } from "node:fs";

import createVerovioModule from "verovio/wasm";
import { enableLog, LOG_OFF, VerovioToolkit } from "verovio/esm";

import { staffCount, stripMeasures, written } from "../src/notation/musicxml.ts";
import { diatonic, ledgerLines, registersOf } from "../src/notation/registers.ts";
import { engrave, engraveOptions } from "../src/preview/engrave.ts";
import { normalize } from "../src/score/normalize.ts";
import type { Score } from "../src/score/types.ts";

const args = process.argv.slice(2);
const file = args[0];
if (!file) {
  console.error("usage: vp node tools/notation-check.ts <score.json> [--measures 24]");
  process.exit(1);
}
const at = args.indexOf("--measures");
const sample = at > 0 ? Number(args[at + 1]) : 24;
const score = normalize(JSON.parse(readFileSync(file, "utf8")) as Score);
let ok = true;

// 1. Octave direction: a written pitch is its sounding pitch plus the instrument's octaves.
console.log("1. Written octave of octave instruments");
for (const part of score.parts) {
  const shift = part.instrument.writtenOctave ?? 0;
  const note = part.notes.find((n) => n.pitches.length);
  if (!shift || !note) continue;
  const p = note.pitches[0]!;
  const w = written(p, part.instrument);
  const right = w.midi - p.midi === 12 * shift;
  ok &&= right;
  console.log(
    `   ${part.id} (${part.instrument.id}): sounding ${p.midi} → written ${w.midi} ${right ? "✓" : "✗"}`,
  );
}

// 2. Ledger lines left after clefs and octave lines.
console.log("2. Notes more than 3 ledger lines from the staff, per instrument (after → before)");
const rows = new Map<string, { notes: number; before: number; after: number }>();
for (const part of score.parts) {
  if (part.instrument.unpitched) continue;
  registersOf(part, score.measures, written).forEach((r, s) => {
    const lowered = new Map(r.ottavas.flatMap((o) => o.notes.map((n) => [n, o.octaves] as const)));
    const clefAt = (at: number) => {
      let m = score.measures.length - 1;
      while (m > 0 && score.measures[m]!.start.value > at) m--;
      return r.clefs[m]!;
    };
    const key = part.instrument.id + (part.instrument.clefs.length > 1 ? ` staff ${s + 1}` : "");
    const row = rows.get(key) ?? { notes: 0, before: 0, after: 0 };
    for (const n of part.notes.filter((n) => n.staff === s + 1))
      for (const p of n.pitches) {
        const d = diatonic(written(p, part.instrument));
        row.notes++;
        if (ledgerLines(d, part.instrument.clefs[s]!) > 3) row.before++;
        if (ledgerLines(d - 7 * (lowered.get(n) ?? 0), clefAt(n.at.value)) > 3) row.after++;
      }
    rows.set(key, row);
  });
}
for (const [k, r] of rows)
  if (r.before || r.after) console.log(`   ${k}: ${r.after} ← ${r.before} of ${r.notes}`);

// 3. Drawing: measures spread over the score, with the least spacing and then the shared one.
console.log(`3. Drawing ${sample} measures`);
const { measures } = stripMeasures(score);
const staves = staffCount(score);
const module = await createVerovioModule();
enableLog(LOG_OFF, module);
const tk = new VerovioToolkit(module);
tk.setOptions(engraveOptions);
const least = Array.from({ length: staves + 1 }, (_, n) => (n < 2 ? 0 : 12));
const picks = [
  ...new Set(
    Array.from({ length: sample }, (_, k) =>
      Math.round((k * (measures.length - 1)) / Math.max(1, sample - 1)),
    ),
  ),
];
let t = performance.now();
const first = picks.map((i) =>
  engrave(tk, { musicxml: measures[i]!.musicxml, seam: measures[i]!.seam, spacing: least }),
);
const firstMs = (performance.now() - t) / picks.length;
const shared = least.map((g, n) =>
  n < 2 ? 0 : Math.ceil(Math.max(g, ...first.map((e) => e.gaps[n - 1] ?? 0)) / 2 - 1e-6) * 2,
);
t = performance.now();
const aligned = picks.map((i) =>
  engrave(tk, { musicxml: measures[i]!.musicxml, seam: measures[i]!.seam, spacing: shared }),
);
const alignedMs = (performance.now() - t) / picks.length;
const layouts = new Set(
  aligned.map((e) => e.staves.map(([top]) => top - e.staves[0]![0]).join(",")),
);
ok &&= layouts.size === 1;
console.log(
  `   ${Math.round(firstMs)} ms per measure (least spacing), ${Math.round(alignedMs)} ms (shared)`,
);
console.log(`   staves line up: ${layouts.size === 1 ? "✓" : `✗ (${layouts.size} layouts)`}`);
process.exit(ok ? 0 : 1);

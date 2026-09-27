// Writes a sketch's score: runs sketches/<name>/sketch.ts with the values in values.json and writes
// sketches/<name>/<name>.json (only when it changed). The preview runs this in a fresh process after
// every knob change and every save of sketch.ts, so the sketch and everything it imports are read
// anew each time.
//
//   vp node src/sketch/run.ts sketches/<name>              write the score
//   vp node src/sketch/run.ts sketches/<name> --describe   print the knobs and values as JSON
//
// A sketch that throws exits with 1 and its message on stderr.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { emptyStored, resolveValues, type Knobs, type Stored } from "./knobs.ts";

export const sketchFile = (dir: string) => join(dir, "sketch.ts");
export const valuesFile = (dir: string) => join(dir, "values.json");
export const scoreFileOf = (dir: string) => join(dir, `${basename(dir)}.json`);

export function readStored(dir: string): Stored {
  const file = valuesFile(dir);
  if (!existsSync(file)) return emptyStored();
  const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<Stored>;
  return { ...emptyStored(), ...raw };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dir = resolve(args.find((a) => !a.startsWith("--")) ?? "");
  if (!existsSync(sketchFile(dir))) throw new Error(`No sketch.ts in ${dir}`);
  const sketch = (await import(pathToFileURL(sketchFile(dir)).href)) as {
    knobs?: Knobs;
    score: (values: Record<string, unknown>) => unknown;
  };
  const knobs = sketch.knobs ?? {};
  const stored = readStored(dir);
  const values = resolveValues(knobs, stored.values);
  if (args.includes("--describe")) {
    process.stdout.write(
      JSON.stringify({ knobs, values, presets: stored.presets, touched: stored.touched }),
    );
    return;
  }
  const text = JSON.stringify(sketch.score(values), null, 1) + "\n";
  const out = scoreFileOf(dir);
  if (!existsSync(out) || readFileSync(out, "utf8") !== text) writeFileSync(out, text);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  main().catch((e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });

// Sketches in the preview (src/sketch/knobs.ts): the knobs of the sketch whose score is open, and
// writing its score again when a knob changes or sketch.ts is saved. The sketch runs in a fresh
// Node process each time (src/sketch/run.ts); the score it writes is then picked up like any saved
// score.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { repoRoot } from "../render/host.ts";
import type { Knobs, Stored, Value } from "../sketch/knobs.ts";
import { readStored, scoreFileOf, sketchFile, valuesFile } from "../sketch/run.ts";

const runner = join(repoRoot, "src/sketch/run.ts");

export interface SketchState {
  dir: string;
  knobs: Knobs;
  values: Record<string, Value>;
  presets: Stored["presets"];
  touched: string[];
  /** The last run's error, if it failed (the score before stays). */
  error?: string;
}

/** The sketch folder a score belongs to: <dir>/<dir name>.json next to <dir>/sketch.ts. */
export function sketchOf(scorePath: string): string | undefined {
  const dir = dirname(scorePath);
  return existsSync(sketchFile(dir)) && scoreFileOf(dir) === scorePath ? dir : undefined;
}

function run(dir: string, describe = false): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [runner, dir, ...(describe ? ["--describe"] : [])],
      { cwd: repoRoot, timeout: 30_000, maxBuffer: 16e6 },
      (err, stdout, stderr) => {
        if (err) reject(new Error(stderr.trim() || err.message));
        else resolve(stdout);
      },
    );
  });
}

const errors = new Map<string, string>();
/** One run per sketch at a time; a change meanwhile runs it once more afterwards. */
const running = new Map<string, { again: boolean; done: Promise<void> }>();

/** Writes the sketch's score from its current values. */
export function rerun(dir: string): Promise<void> {
  const now = running.get(dir);
  if (now) {
    now.again = true;
    return now.done;
  }
  const entry = { again: false, done: Promise.resolve() };
  entry.done = (async () => {
    do {
      entry.again = false;
      try {
        await run(dir);
        errors.delete(dir);
      } catch (e) {
        errors.set(dir, e instanceof Error ? e.message : String(e));
      }
    } while (entry.again);
    running.delete(dir);
  })();
  running.set(dir, entry);
  return entry.done;
}

export async function sketchState(dir: string): Promise<SketchState> {
  const described = JSON.parse(await run(dir, true)) as Omit<SketchState, "dir" | "error">;
  return { dir: basename(dir), ...described, error: errors.get(dir) };
}

export type SketchChange =
  | { set: Record<string, Value> }
  | { save: string }
  | { load: string }
  | { remove: string }
  | { reset: true };

/** Applies a change from the panel to values.json and writes the score again. */
export async function changeSketch(dir: string, change: SketchChange): Promise<void> {
  const stored = readStored(dir);
  if ("set" in change) {
    Object.assign(stored.values, change.set);
    stored.touched = [...new Set([...stored.touched, ...Object.keys(change.set)])];
  } else if ("save" in change) {
    const name = change.save.trim();
    if (!name) throw new Error("A preset needs a name");
    const { values } = JSON.parse(await run(dir, true)) as {
      values: Record<string, Value>;
    };
    stored.presets[name] = values;
  } else if ("load" in change) {
    const preset = stored.presets[change.load];
    if (!preset) throw new Error(`No preset "${change.load}"`);
    stored.values = { ...preset };
    // A preset was chosen by someone: its values that differ from Claude's are no longer provisional.
    const { knobs } = JSON.parse(await run(dir, true)) as { knobs: Knobs };
    const chosen = Object.keys(knobs).filter(
      (k) => k in preset && JSON.stringify(preset[k]) !== JSON.stringify(knobs[k]!.value),
    );
    stored.touched = [...new Set([...stored.touched, ...chosen])];
  } else if ("remove" in change) delete stored.presets[change.remove];
  else {
    // Back to Claude's values, so they are provisional again.
    stored.values = {};
    stored.touched = [];
  }
  await writeFile(valuesFile(dir), JSON.stringify(stored, null, 2) + "\n");
  await rerun(dir);
}

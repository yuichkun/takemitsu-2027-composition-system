// Writes a sketch's score: runs sketches/<name>/sketch.ts with the values in values.json and writes
// sketches/<name>/<name>.json (only when it changed). The preview runs this in a fresh process after
// every knob change and every save of sketch.ts, so the sketch and everything it imports are read
// anew each time.
//
// A piece (pieces/<name>/, src/sketch/nest.ts) is a sketch whose sub-folders are sketches too: it is
// read with all of them, each with its own values.json, and only the piece's score is written.
// Given a folder inside a piece, the whole piece is run.
//
// A folder may be another sketch folder: its sketch.ts re-exports that sketch and says where it is
// (`export const sketch = "../../../sketches/…"`), and its values are that sketch's values.json. A
// piece's section written this way is the sketch: working on the sketch (its code, its knobs)
// changes the section, and the piece's score lists it (outline.sketches) so the preview writes the
// piece again.
//
//   vp node src/sketch/run.ts sketches/<name>              write the score
//   vp node src/sketch/run.ts sketches/<name> --describe   print the knobs and values as JSON
//
// A sketch that throws exits with 1 and its message on stderr.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { Score } from "../score/types.ts";
import { emptyStored, resolveValues, type Knobs, type Stored } from "./knobs.ts";
import { Context, type LoadedNode } from "./nest.ts";

export const sketchFile = (dir: string) => join(dir, "sketch.ts");
export const valuesFile = (dir: string) => join(dir, "values.json");
export const scoreFileOf = (dir: string) => join(dir, `${basename(dir)}.json`);

export function readStored(dir: string): Stored {
  const file = valuesFile(dir);
  if (!existsSync(file)) return emptyStored();
  const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<Stored>;
  return { ...emptyStored(), ...raw };
}

/** The folders under `dir` that are sketches: its children, when `dir` is part of a piece. */
export function childNodes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(sketchFile(join(dir, e.name))))
    .map((e) => e.name)
    .sort();
}

/** The top of the tree a sketch folder is in: itself, or the piece it is part of. */
export function rootOf(dir: string): string {
  let d = resolve(dir);
  while (existsSync(sketchFile(dirname(d))) && dirname(d) !== d) d = dirname(d);
  return d;
}

interface SketchModule {
  knobs?: Knobs;
  score: (values: Record<string, unknown>, ctx: Context) => unknown;
  seams?: LoadedNode["seams"];
  /** The sketch folder (from this one) this folder is: its code re-exported, its values used. */
  sketch?: string;
}

/** The sketch folder a folder's module says it is, if any. */
function linkOf(dir: string, mod: SketchModule): string | undefined {
  if (typeof mod.sketch !== "string") return undefined;
  const to = resolve(dir, mod.sketch);
  if (!existsSync(sketchFile(to)))
    throw new Error(`${dir}: "${mod.sketch}" is not a sketch folder`);
  return to;
}

/** Every sketch folder the nodes of a tree are. */
function linksOf(node: LoadedNode): string[] {
  const own = node.from ? [node.from] : [];
  return [...new Set([...own, ...[...node.children.values()].flatMap(linksOf)])];
}

async function load(dir: string, path: string): Promise<LoadedNode> {
  const sketch = (await import(pathToFileURL(sketchFile(dir)).href)) as SketchModule;
  const from = linkOf(dir, sketch);
  const values = resolveValues(sketch.knobs ?? {}, readStored(from ?? dir).values);
  const children = new Map<string, LoadedNode>();
  for (const name of childNodes(dir))
    children.set(name, await load(join(dir, name), path ? `${path}/${name}` : name));
  return {
    name: basename(dir),
    path,
    score: sketch.score,
    ...(sketch.seams ? { seams: sketch.seams } : {}),
    values,
    ...(from ? { from } : {}),
    children,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const given = resolve(args.find((a) => !a.startsWith("--")) ?? "");
  if (!existsSync(sketchFile(given))) throw new Error(`No sketch.ts in ${given}`);
  if (args.includes("--describe")) {
    const sketch = (await import(pathToFileURL(sketchFile(given)).href)) as SketchModule;
    const knobs = sketch.knobs ?? {};
    const from = linkOf(given, sketch);
    const stored = readStored(from ?? given);
    const values = resolveValues(knobs, stored.values);
    process.stdout.write(
      JSON.stringify({
        knobs,
        values,
        presets: stored.presets,
        touched: stored.touched,
        ...(from ? { from } : {}),
      }),
    );
    return;
  }
  const dir = rootOf(given);
  const tree = await load(dir, "");
  const score = tree.score(tree.values, Context.root(tree));
  if (!score || typeof score !== "object" || !("parts" in score) || !("meter" in score))
    throw new Error(`${basename(dir)}: score() must return a whole score (a piece: ctx.score(…))`);
  const links = linksOf(tree).map((d) => relative(dir, d));
  const outline = (score as Score).outline;
  if (outline && links.length) outline.sketches = links;
  const text = JSON.stringify(score, null, 1) + "\n";
  const out = scoreFileOf(dir);
  if (!existsSync(out) || readFileSync(out, "utf8") !== text) writeFileSync(out, text);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  main().catch((e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });

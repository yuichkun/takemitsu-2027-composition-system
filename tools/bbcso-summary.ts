// Summarises the key scans (.local/probe/scans/*.json, from `bbcso-probe.ts scan-all`) into
// src/libraries/bbcso/inventory.json: for every articulation, the sounding key range, gaps inside it,
// and how far the measured pitch sits from the key (pitched instruments only).
//
//   vp node tools/bbcso-summary.ts

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "../src/render/host.ts";

interface Row {
  key: number;
  attackDb: number;
  sustainDb: number;
  sounding: boolean;
  pitch: number | null;
}

export interface ArticulationInventory {
  /** Lowest and highest sounding key. */
  range: [number, number];
  /** Keys inside the range that did not sound. */
  gaps: number[];
  /** Median |measured − key| in cents over keys whose pitch could be measured; null for unpitched. */
  medianCents: number | null;
  /** Keys whose measured pitch is more than 30 cents from the key (possible mapping errors or noise). */
  offKeys: number[];
}

const dir = join(repoRoot, ".local/probe/scans");
// Keys re-played in isolation by `bbcso-probe.ts verify-gaps` (the fast scan misses slow attacks after a ringing note).
const verifiedPath = join(repoRoot, ".local/probe/gaps.json");
const verified = existsSync(verifiedPath)
  ? (JSON.parse(readFileSync(verifiedPath, "utf8")) as Record<
      string,
      Record<string, { key: number; attackDb: number }[]>
    >)
  : {};
const unpitched = new Set(["Untuned Percussion"]);
const inventory: Record<string, Record<string, ArticulationInventory | null>> = {};

for (const file of readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()) {
  const instrument = file.replace(/\.json$/, "").replaceAll("_", " ");
  const scans = JSON.parse(readFileSync(join(dir, file), "utf8")) as Record<string, Row[]>;
  inventory[instrument] = {};
  for (const [articulation, rows] of Object.entries(scans)) {
    const sounding = rows.filter((r) => r.sounding);
    if (sounding.length === 0) {
      inventory[instrument][articulation] = null;
      continue;
    }
    const lo = sounding[0]!.key;
    const hi = sounding.at(-1)!.key;
    const soundsAlone = new Set(
      (verified[instrument]?.[articulation] ?? [])
        .filter((v) => v.attackDb > -60)
        .map((v) => v.key),
    );
    const gaps = rows
      .filter((r) => r.key > lo && r.key < hi && !r.sounding && !soundsAlone.has(r.key))
      .map((r) => r.key);
    let medianCents: number | null = null;
    let offKeys: number[] = [];
    if (!unpitched.has(instrument)) {
      const deviations = sounding
        .filter((r) => r.pitch !== null)
        .map((r) => ({ key: r.key, cents: (r.pitch! - r.key) * 100 }));
      const sorted = deviations.map((d) => Math.abs(d.cents)).sort((a, b) => a - b);
      medianCents = sorted.length ? Math.round(sorted[Math.floor(sorted.length / 2)]!) : null;
      offKeys = deviations.filter((d) => Math.abs(d.cents) > 30).map((d) => d.key);
    }
    inventory[instrument][articulation] = { range: [lo, hi], gaps, medianCents, offKeys };
  }
}

writeFileSync(
  join(repoRoot, "src/libraries/bbcso/inventory.json"),
  JSON.stringify(inventory, null, 1) + "\n",
);

// Console report
const noteName = (k: number) =>
  ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"][k % 12] +
  String(Math.floor(k / 12) - 1);
for (const [instrument, arts] of Object.entries(inventory)) {
  console.log(`\n## ${instrument}`);
  for (const [articulation, inv] of Object.entries(arts)) {
    if (!inv) {
      console.log(`  ${articulation}: SILENT`);
      continue;
    }
    const flags = [
      inv.gaps.length ? `gaps ${inv.gaps.length}` : "",
      inv.medianCents !== null ? `median ${inv.medianCents}¢` : "",
      inv.offKeys.length ? `off ${inv.offKeys.length}` : "",
    ].filter(Boolean);
    console.log(
      `  ${articulation}: ${noteName(inv.range[0])}–${noteName(inv.range[1])} ${flags.join(", ")}`,
    );
  }
}

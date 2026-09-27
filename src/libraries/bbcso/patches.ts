// The installed BBC Symphony Orchestra patches, read from the library folder.
// Patch files are encrypted, but their file names carry the plugin's patch names:
//   BBCSO_b___Violins_1___Long_Sul_Pont.zmulti  →  "b - Violins 1 - Long Sul Pont"

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const pluginPath = "/Library/Audio/Plug-Ins/VST3/BBC Symphony Orchestra.vst3";

/** Library root from Spitfire's settings (~/Music/Spitfire Audio/Settings/Spitfire.properties). */
export function libraryRoot(): string {
  const settings = join(homedir(), "Music/Spitfire Audio/Settings/Spitfire.properties");
  const parsed = JSON.parse(readFileSync(settings, "utf8")) as Record<
    string,
    { patches?: string[] }
  >;
  const patches = parsed["BBC Symphony Orchestra"]?.patches?.[0];
  if (!patches) throw new Error(`BBC Symphony Orchestra is not registered in ${settings}`);
  return join(patches, "..");
}

export interface Patch {
  /** Name the plugin uses in its state. */
  name: string;
  /** Instrument part of the name, e.g. "Violins 1". */
  instrument: string;
  /** Articulation part of the name, e.g. "Long Sul Pont". */
  articulation: string;
}

export function installedPatches(root = libraryRoot()): Patch[] {
  const dir = join(root, "Patches/v1.5.0");
  if (!existsSync(dir)) throw new Error(`No patches at ${dir}`);
  return readdirSync(dir)
    .filter((f) => f.startsWith("BBCSO_") && f.endsWith(".zmulti"))
    .map((f) => {
      const [letter, instrument, articulation] = f
        .slice("BBCSO_".length, -".zmulti".length)
        .split("___");
      const words = (s: string) => s.replaceAll("_", " ");
      return {
        name: `${letter} - ${words(instrument!)} - ${words(articulation!)}`,
        instrument: words(instrument!),
        articulation: words(articulation!),
      };
    })
    .concat(discoverPiano(root))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Discover Piano (added in 1.7.0) follows another naming scheme: its only patch is called "Piano",
 * and it needs product mode 10 and its own mic ("pmix1"); see pluginSettings.
 */
function discoverPiano(root: string): Patch[] {
  const file = join(root, "Patches/v1.7.0/Discover Piano/BBCSO_Discover_Piano_Piano.zmulti");
  return existsSync(file)
    ? [{ name: "Piano", instrument: "Discover Piano", articulation: "Piano" }]
    : [];
}

/** Settings an instrument needs in its plugin state beyond the defaults. */
export const pluginSettings: Record<
  string,
  { productMode?: number; mics?: Record<string, number> }
> = {
  "Discover Piano": { productMode: 10, mics: { pmix1: 1 } },
};

export function patchesOf(instrument: string, patches = installedPatches()): Patch[] {
  return patches.filter((p) => p.instrument === instrument);
}

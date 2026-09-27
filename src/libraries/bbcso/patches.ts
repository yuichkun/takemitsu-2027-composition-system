// The installed BBC Symphony Orchestra patches, read from the library folder.
// Patch files are encrypted, but their file names carry the plugin's patch names:
//   BBCSO_b___Violins_1___Long_Sul_Pont.zmulti  →  "b - Violins 1 - Long Sul Pont"

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const pluginPath = "/Library/Audio/Plug-Ins/VST3/BBC Symphony Orchestra.vst3";

/** Folders under the library's Patches/ that patches are read from: 1.5.0, and 1.7.0 for Discover Piano. */
export const patchFolders = { main: "v1.5.0", discoverPiano: "v1.7.0" };

let version: string | undefined;
/** The plugin's build (its bundle's short version, e.g. "1.12.14-95f7150"); rendered sound depends on it. */
export function pluginVersion(): string {
  if (version) return version;
  try {
    const plist = readFileSync(join(pluginPath, "Contents/Info.plist"), "utf8");
    version =
      /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]*)<\/string>/.exec(plist)?.[1] ??
      "unknown";
  } catch {
    version = "unknown";
  }
  return version;
}

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
  const dir = join(root, "Patches", patchFolders.main);
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
  const file = join(
    root,
    "Patches",
    patchFolders.discoverPiano,
    "Discover Piano/BBCSO_Discover_Piano_Piano.zmulti",
  );
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

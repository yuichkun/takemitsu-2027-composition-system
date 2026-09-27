// Lanes → chunks: the units that are rendered, stored and played.
//
// - A chunk holds the notes of one lane that start in one measure (docs/decisions/0018). Notes
//   slurred into the next measure pull that measure into the same chunk, so a legato transition
//   is never split.
// - Each note is in exactly one chunk and is rendered whole, with its release and the room's
//   tail. A lane's sound is the sum of its chunks placed at their origins; chunks overlap and
//   are never cut or crossfaded.
// - Everything the host is told is relative to the chunk's origin, and the chunk's key is a hash
//   of exactly that request (plus what the sound depends on outside it: the plugin build, the
//   patch set, the sample files' contents). The same music at another place in the piece has the
//   same key, and a changed chunk can never keep an old key.
// - Each BBC SO chunk also says which of its note onsets must be audible, so a rendered chunk can
//   be checked before it is stored (docs/decisions/0019).

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  installedPatches,
  patchFolders,
  pluginSettings,
  pluginVersion,
} from "../libraries/bbcso/patches.ts";
import { stateXml } from "../libraries/bbcso/state.ts";
import type { BbcsoLane, Lane, LaneNote, SampleLane } from "./plan.ts";

export const sampleRate = 48000;
export const blockSize = 512;
/**
 * Bump when the chunk format or the rendering changes, so old chunks are not reused.
 * 2: chunks are checked before they are stored (docs/decisions/0019); stores from before hold
 *    chunks that were written silent while BBC SO was still loading.
 */
const formatVersion = 2;
/** The origin sits this far before the first onset, for the keyswitch. */
const preroll = 0.06;
/** CC1 is sent on this grid (relative to the origin) wherever its value changes. */
const ccStep = 0.05;
/** At most this long a tail after the last release (the host stops once it is quiet). */
export const tailMaxSeconds = 10;
/** Below this CC1 (or velocity, for short notes) a note may be inaudible: niente. */
const audibleLevel = 5;

const inventory = JSON.parse(
  readFileSync(join(import.meta.dirname, "../libraries/bbcso/inventory.json"), "utf8"),
) as Record<string, Record<string, { range: [number, number]; gaps: number[] } | null>>;

export type MidiEvent = [frame: number, ...bytes: number[]];

interface ChunkBase {
  /** Content hash; also the file name in the store. */
  key: string;
  laneId: string;
  partId: string;
  /** Where frame 0 of the chunk sits, in seconds from the start of the piece. */
  origin: number;
  /** Lane gain, applied when mixing (not part of the key). */
  gain: number;
  /** First measure (index) of the chunk; for ordering and progress. */
  measure: number;
  /** Frames the notes need; the stored chunk is longer by its tail. */
  frames: number;
  /** At most this many frames of tail after `frames`. */
  tailMax: number;
}

export interface BbcsoChunk extends ChunkBase {
  kind: "bbcso";
  /** Key of the plugin state; chunks with the same state share an instance. */
  stateKey: string;
  events: MidiEvent[];
  /** Frames of the note-ons that must be audible (in the sampled range, not niente). */
  shouldSound: number[];
}

export interface SampleChunk extends ChunkBase {
  kind: "samples";
  files: string[];
  hits: { frame: number; gain: number; seed: number }[];
}

export type Chunk = BbcsoChunk | SampleChunk;

/** A note that must sound on a state: played after loading, to know the samples are there. */
export interface Probe {
  keyswitch: number;
  key: number;
  velocity: number;
  cc: number;
}

const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);

let patchNames: Map<string, string> | undefined;
function patchName(instrument: string, articulation: string): string {
  patchNames ??= new Map(
    installedPatches().map((p) => [`${p.instrument}|${p.articulation}`, p.name]),
  );
  const name = patchNames.get(`${instrument}|${articulation}`);
  if (!name) throw new Error(`BBC SO has no patch ${instrument} / ${articulation}`);
  return name;
}

/** The plugin state (XML) of a lane. Lanes with equal states share instances. */
export function laneState(lane: BbcsoLane): string {
  return stateXml({
    ...pluginSettings[lane.instrument],
    family: "",
    name: lane.instrument,
    articulations: lane.articulations.map((a, i) => ({
      patch: patchName(lane.instrument, a),
      keyswitch: i,
    })),
    tune: lane.tune,
  });
}

export const stateKeyOf = (state: string) =>
  hash({ state, formatVersion, plugin: pluginVersion(), patches: patchFolders });

const fileHashes = new Map<string, string>();
/** A sample file's content hash (remembered by path, size and modification time). */
export function fileHash(path: string): string {
  const s = statSync(path);
  const id = `${path}|${s.size}|${s.mtimeMs}`;
  let h = fileHashes.get(id);
  if (!h) {
    h = createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 32);
    fileHashes.set(id, h);
  }
  return h;
}

/** Whether a note must be audible: inside its articulation's samples, and not niente. */
function audible(lane: BbcsoLane, n: LaneNote, cc: number): boolean {
  const samples = inventory[lane.instrument]?.[n.articulation];
  if (!samples) return false; // not scanned: cannot tell
  const [low, high] = samples.range;
  if (n.key < low || n.key > high || samples.gaps.includes(n.key)) return false;
  return n.articulation.startsWith("Short") ? n.velocity >= audibleLevel : cc >= audibleLevel;
}

/** CC1 a note starts with. */
const ccAt = (lane: BbcsoLane, n: LaneNote) => n.cc ?? (lane.cc ? lane.cc(n.on) : 127);

/** Groups a lane's notes: by onset measure, merging measures joined by a slur. */
function groups<T extends { measure: number }>(
  items: T[],
  joined: (last: T[], next: T[]) => boolean,
): T[][] {
  const byMeasure = new Map<number, T[]>();
  for (const item of items) {
    const list = byMeasure.get(item.measure) ?? [];
    list.push(item);
    byMeasure.set(item.measure, list);
  }
  const out: T[][] = [];
  for (const m of [...byMeasure.keys()].sort((a, b) => a - b)) {
    const list = byMeasure.get(m)!;
    const last = out.at(-1);
    if (last && joined(last, list)) last.push(...list);
    else out.push([...list]);
  }
  return out;
}

const frame = (seconds: number) => Math.round(seconds * sampleRate);

function bbcsoChunk(lane: BbcsoLane, notes: LaneNote[], stateKey: string): BbcsoChunk {
  const origin = Math.min(...notes.map((n) => n.on)) - preroll;
  const end = Math.max(...notes.map((n) => n.off));
  const rel = (seconds: number) => frame(seconds - origin);
  const events: MidiEvent[] = [
    // Whatever the instance played before has ended (the host ran it to silence); make sure.
    // No CC11: BBC SO applied CC11 only in an instance's first chunk, so the same chunk came out
    // 1.25 dB apart depending on what the instance had played (docs/worklog 2026-09-27 §11).
    [0, 0xb0, 123, 0],
  ];
  if (lane.cc) {
    let last = -1;
    for (let t = 0; t <= end - origin + ccStep; t += ccStep) {
      const value = lane.cc(origin + t);
      if (value !== last) events.push([frame(t), 0xb0, 1, value]);
      last = value;
    }
  }
  const shouldSound: number[] = [];
  let current = -1;
  for (const n of [...notes].sort((a, b) => a.on - b.on || a.key - b.key)) {
    const ks = lane.articulations.indexOf(n.articulation);
    if (ks !== current) {
      events.push([Math.max(0, rel(n.on - 0.03)), 0x90, ks, 100]);
      events.push([Math.max(1, rel(n.on - 0.02)), 0x80, ks, 0]);
      current = ks;
    }
    if (n.cc !== undefined) events.push([rel(n.on), 0xb0, 1, n.cc]);
    events.push([rel(n.on), 0x90, n.key, n.velocity]);
    events.push([rel(n.off), 0x80, n.key, 0]);
    if (audible(lane, n, ccAt(lane, n))) shouldSound.push(rel(n.on));
  }
  events.sort((a, b) => a[0] - b[0]);
  const frames = rel(end) + blockSize;
  const tailMax = tailMaxSeconds * sampleRate;
  return {
    kind: "bbcso",
    key: hash({ formatVersion, sampleRate, blockSize, stateKey, events, frames, tailMax }),
    laneId: lane.id,
    partId: lane.partId,
    origin,
    gain: lane.gain,
    measure: Math.min(...notes.map((n) => n.measure)),
    frames,
    tailMax,
    stateKey,
    events,
    shouldSound,
  };
}

function sampleChunk(lane: SampleLane, hits: SampleLane["hits"]): SampleChunk {
  const origin = Math.min(...hits.map((h) => h.seconds));
  const rel = hits.map((h) => ({ frame: frame(h.seconds - origin), gain: h.gain, seed: h.seed }));
  return {
    kind: "samples",
    key: hash({ formatVersion, sampleRate, files: lane.files.map(fileHash), hits: rel }),
    laneId: lane.id,
    partId: lane.partId,
    origin,
    gain: lane.gain,
    measure: Math.min(...hits.map((h) => h.measure)),
    frames: Math.max(...rel.map((h) => h.frame)) + 1,
    // A sample's length is known once it is read; assume a long one until then.
    tailMax: tailMaxSeconds * sampleRate,
    files: lane.files,
    hits: rel,
  };
}

export interface ChunkOptions {
  /** One chunk per lane (the whole lane in one go): the reference renders. */
  whole?: boolean;
}

export interface ChunkedLane {
  lane: Lane;
  /** For BBC SO lanes: the plugin state and its key. */
  state?: string;
  stateKey?: string;
  /** For BBC SO lanes: one audible note per articulation it plays, to check a loaded instance. */
  probes?: Probe[];
  chunks: Chunk[];
}

export function chunkLanes(lanes: Lane[], options: ChunkOptions = {}): ChunkedLane[] {
  return lanes.map((lane) => {
    if (lane.kind === "samples") {
      const parts = options.whole
        ? [lane.hits]
        : groups(lane.hits, () => false).filter((g) => g.length);
      return { lane, chunks: parts.map((h) => sampleChunk(lane, h)) };
    }
    const state = laneState(lane);
    const stateKey = stateKeyOf(state);
    const parts = options.whole
      ? [lane.notes]
      : groups(lane.notes, (last, next) => {
          const first = Math.min(...next.map((n) => n.on));
          return last.some((n) => n.slur && n.off >= first - 0.05);
        });
    const probes = new Map<number, Probe>();
    for (const n of lane.notes) {
      const keyswitch = lane.articulations.indexOf(n.articulation);
      const cc = ccAt(lane, n);
      if (!probes.has(keyswitch) && audible(lane, n, cc))
        probes.set(keyswitch, { keyswitch, key: n.key, velocity: n.velocity, cc });
    }
    return {
      lane,
      state,
      stateKey,
      probes: [...probes.values()],
      chunks: parts.filter((g) => g.length).map((g) => bbcsoChunk(lane, g, stateKey)),
    };
  });
}

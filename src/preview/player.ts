// Playback of rendered chunks through a mixer: one channel per part (compression, fader, mute,
// solo, meter) and a master (the same compression and fader, then a limiter). Every channel goes
// through a compressor, even at 0, so the compressor's look-ahead delays all channels alike.
//
// The player holds the score's list of chunk places (the manifest, one per version) and their
// status (which are rendered), each replaced whole whenever the server has a newer one
// (docs/decisions/0019). It streams each part as consecutive 2-second segments, mixed by the
// server from that part's rendered chunks (src/performance/segments.ts), and keeps only the few
// segments around the playhead. A segment is named by exactly what it mixes (which chunks, where,
// at what gain), so a new version changes the names of the segments that differ only.
//
// Rules:
// - Nothing incomplete is played. A segment is complete when every chunk that may sound in it is
//   rendered (or failed, which plays as a hole); a chunk not rendered yet may sound for its notes
//   plus the longest tail. All parts go on together: if the next segment of any part is not
//   complete and here, playback waits at the segment boundary.
// - Playback starts, and resumes after waiting, once the next 3 seconds are complete.
// - The player always plays the newest version: a new version takes over at the next segment
//   boundary. If the version moves the time of the playhead's measure (a tempo change or a
//   measure inserted before it), the playhead keeps its measure and its place in it.

import { compressorParams, limiterParams, type CompressorParams } from "../audio/dynamics.ts";
import { dbToGain, type ChannelState, type MixerSettings } from "../audio/mixer.ts";
import {
  placeReach,
  segmentContents,
  segmentSeconds,
  type Contribution,
  type Place,
} from "./segment-contents.ts";

export type { ChannelState, MixerSettings };

/** [key, part index, origin (s), gain, frames of its notes, frames of tail at most] */
export type ManifestChunk = [string, number, number, number, number, number];

export interface Manifest {
  version: number;
  duration: number;
  measures: { start: number; end: number }[];
  parts: string[];
  chunks: ManifestChunk[];
}

export interface Status {
  version: number;
  serial: number;
  /** Per chunk place: frames stored, -1 while not rendered, -2 when failed. */
  frames: number[];
}

export type { Contribution };

export interface SegmentRequest {
  id: string;
  frames: number;
  contributions: Contribution[];
}

interface Channel extends ChannelState {
  id: string;
  compressor: DynamicsCompressorNode;
  gain: GainNode;
  analyser: AnalyserNode;
}

interface Entry extends Place {
  part: string;
}

interface Wanted extends SegmentRequest {
  part: string;
  index: number;
}

const sampleRate = 48000;
/** Segment i covers [i·S, (i+1)·S) of the piece (S = segmentSeconds). */
const segmentFrames = segmentSeconds * sampleRate;
/** Segments fetched ahead of the playhead, and scheduled ahead on the audio clock. */
const fetchAhead = 3;
const scheduleAhead = 1;
/** Seconds that must be complete before playback starts or resumes. */
const startMargin = 3;
/** Segments per request, and requests at once (a tutti is ~100 parts, each ~400 KB a segment). */
const batchSize = 20;
const fetchers = 4;

function setCompressor(node: DynamicsCompressorNode, p: CompressorParams, ctx: AudioContext): void {
  const t = ctx.currentTime;
  node.threshold.setValueAtTime(p.threshold, t);
  node.ratio.setValueAtTime(Math.max(1, p.ratio), t);
  node.knee.setValueAtTime(p.knee, t);
  node.attack.setValueAtTime(p.attack, t);
  node.release.setValueAtTime(p.release, t);
}

/** Decodes the chunk format ("TKCH", see src/performance/store.ts) into an AudioBuffer. */
function decode(ctx: AudioContext, bytes: Uint8Array): AudioBuffer | null {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const frames = view.getInt32(12, true);
  if (frames <= 0) return null;
  const scale = view.getFloat32(20, true) / 32767;
  const samples = new Int16Array(
    bytes.buffer.slice(bytes.byteOffset + 24, bytes.byteOffset + 24 + frames * 4),
  );
  const buffer = ctx.createBuffer(2, frames, view.getInt32(8, true));
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    left[i] = samples[i * 2]! * scale;
    right[i] = samples[i * 2 + 1]! * scale;
  }
  buffer.copyToChannel(left, 0);
  buffer.copyToChannel(right, 1);
  return buffer;
}

/** A short, stable name for what a segment mixes (FNV-1a over the list). */
function nameOf(part: string, index: number, contributions: Contribution[]): string {
  let h = 0x811c9dc5;
  const text = contributions.map((c) => c.join(",")).join(";");
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return `${part}|${index}|${(h >>> 0).toString(36)}|${contributions.length}`;
}

/** Where `seconds` falls in `from` (measure, fraction), placed in `to`; undefined if unchanged. */
function carry(
  seconds: number,
  from: { start: number; end: number }[],
  to: { start: number; end: number }[],
): number | undefined {
  const m = from.findIndex((x) => seconds < x.end);
  if (m < 0 || !to[m]) return undefined;
  const a = from[m]!;
  const b = to[m]!;
  if (Math.abs(a.start - b.start) < 1e-6 && Math.abs(a.end - b.end) < 1e-6) return undefined;
  const f = a.end > a.start ? (seconds - a.start) / (a.end - a.start) : 0;
  return b.start + f * (b.end - b.start);
}

export class Player {
  readonly ctx = new AudioContext({ sampleRate });
  /** The master: the channels' sum → compressor → fader → limiter. */
  readonly masterCompressor = this.ctx.createDynamicsCompressor();
  readonly masterGain = this.ctx.createGain();
  readonly limiter = this.ctx.createDynamicsCompressor();
  readonly masterAnalyser = this.ctx.createAnalyser();
  masterDb = 0;
  /** The master's compression amount, 0–1 (as a channel's). */
  masterComp = 0;
  duration = 0;
  onChange?: () => void;
  /** Fetches mixed segments. */
  fetchSegments?: (requests: SegmentRequest[]) => Promise<Map<string, Uint8Array>>;

  private channels = new Map<string, Channel>();
  private manifest?: Manifest;
  /** In manifest order (status arrays index them), and per part by origin. */
  private entries: Entry[] = [];
  private sorted: Entry[] = [];
  private byPart = new Map<string, Entry[]>();
  /** Longest a chunk of each part may reach (seconds), for finding the ones in a segment. */
  private reach = new Map<string, number>();
  /** Decoded segments by name (null: silent). */
  private segments = new Map<string, AudioBuffer | null>();
  private fetching = new Set<string>();
  /** What is scheduled per part and segment index ("part|index"). */
  private scheduled = new Map<
    string,
    { name: string; index: number; source?: AudioBufferSourceNode }
  >();
  private startedAt = 0;
  private offset = 0;
  /** Playing as far as the user is concerned (it may be waiting for audio). */
  private running = false;
  /** Holding at `offset` until the next seconds are complete. */
  private waiting = false;

  constructor() {
    setCompressor(this.limiter, limiterParams, this.ctx);
    this.masterCompressor.connect(this.masterGain);
    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);
    this.masterAnalyser.fftSize = 1024;
  }

  /** Sets the channels (in score order) and their saved settings. Keeps settings of known ids. */
  setParts(ids: string[], settings: MixerSettings): void {
    for (const ch of this.channels.values()) ch.analyser.disconnect();
    const next = new Map<string, Channel>();
    for (const id of ids) {
      const saved = settings.parts?.[id] ?? this.channels.get(id);
      const compressor = this.ctx.createDynamicsCompressor();
      const gain = this.ctx.createGain();
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 1024;
      compressor.connect(gain);
      gain.connect(analyser);
      analyser.connect(this.masterCompressor);
      next.set(id, {
        id,
        db: saved?.db ?? 0,
        mute: saved?.mute ?? false,
        solo: saved?.solo ?? false,
        comp: saved?.comp ?? 0,
        compressor,
        gain,
        analyser,
      });
    }
    this.channels = next;
    this.masterDb = settings.master ?? this.masterDb;
    this.masterComp = settings.masterComp ?? this.masterComp;
    // Sounding segments were connected to the old channels.
    if (this.running) this.hold(this.position);
    this.apply();
  }

  settings(): MixerSettings {
    const parts: Record<string, ChannelState> = {};
    for (const ch of this.channels.values())
      parts[ch.id] = { db: ch.db, mute: ch.mute, solo: ch.solo, comp: ch.comp };
    return { master: this.masterDb, masterComp: this.masterComp, parts };
  }

  channel(id: string): ChannelState | undefined {
    return this.channels.get(id);
  }

  hasSound(id: string): boolean {
    return (this.byPart.get(id)?.length ?? 0) > 0;
  }

  get version(): number | undefined {
    return this.manifest?.version;
  }

  /**
   * Takes a version's list of chunk places, with its status. If the version moves the
   * playhead's measure in time, the playhead goes with the measure.
   */
  setManifest(manifest: Manifest, status?: Status): void {
    const before = this.manifest;
    const moved = before ? carry(this.position, before.measures, manifest.measures) : undefined;
    this.manifest = manifest;
    this.duration = manifest.duration;
    this.entries = manifest.chunks.map(([key, part, origin, gain, noteFrames, tailMax]) => ({
      key,
      part: manifest.parts[part]!,
      origin,
      gain,
      noteFrames,
      tailMax,
      failed: false,
    }));
    this.byPart = new Map();
    this.reach = new Map();
    this.sorted = [...this.entries].sort((a, b) => a.origin - b.origin);
    for (const e of this.sorted) {
      const list = this.byPart.get(e.part) ?? [];
      list.push(e);
      this.byPart.set(e.part, list);
      this.reach.set(e.part, Math.max(this.reach.get(e.part) ?? 0, placeReach(e)));
    }
    if (status) this.applyStatus(status);
    if (moved !== undefined) {
      if (this.running) this.hold(moved);
      else this.offset = moved;
    } else this.dropUnstarted();
    this.tick();
  }

  /** Takes the status of the current version (ignored for another version). */
  setStatus(status: Status): void {
    if (this.applyStatus(status)) this.tick();
  }

  private applyStatus(status: Status): boolean {
    if (status.version !== this.manifest?.version) return false;
    status.frames.forEach((f, i) => {
      const e = this.entries[i];
      if (!e) return;
      e.frames = f >= 0 ? f : undefined;
      e.failed = f === -2;
    });
    return true;
  }

  /** Per measure: the share of its chunks that are rendered, and whether any failed. */
  readiness(measures: { start: number; end: number }[]): { share: number; failed: boolean }[] {
    const all = measures.map(() => 0);
    const done = measures.map(() => 0);
    const failed = measures.map(() => false);
    let m = 0;
    for (const e of this.sorted) {
      const onset = e.origin + 0.06;
      while (m < measures.length - 1 && onset >= measures[m]!.end) m++;
      all[m]!++;
      if (e.frames !== undefined || e.failed) done[m]!++;
      if (e.failed) failed[m] = true;
    }
    return all.map((n, i) => ({ share: n ? done[i]! / n : 1, failed: failed[i]! }));
  }

  /** What segment `index` of a part mixes, and whether all of it is known yet. */
  private contents(part: string, index: number): { complete: boolean; mix: Contribution[] } {
    const list = this.byPart.get(part);
    if (!list) return { complete: true, mix: [] };
    return segmentContents(list, this.reach.get(part) ?? 0, index);
  }

  /** Segments of indices [from, to]: the complete ones with anything in them, and whether all are complete. */
  private wanted(from: number, to: number): { wanted: Wanted[]; complete: boolean[] } {
    const wanted: Wanted[] = [];
    const complete: boolean[] = [];
    for (let index = Math.max(-1, from); index <= to; index++) {
      let all = true;
      for (const part of this.byPart.keys()) {
        const { complete: done, mix } = this.contents(part, index);
        if (!done) {
          all = false;
          continue;
        }
        if (!mix.length) continue;
        const id = nameOf(part, index, mix);
        wanted.push({ id, part, index, frames: segmentFrames, contributions: mix });
      }
      complete[index - from] = all;
    }
    return { wanted, complete };
  }

  /** Whether segments [from, to] are complete and fetched, for every part. */
  private ready(from: number, to: number): boolean {
    const { wanted, complete } = this.wanted(from, to);
    return complete.every(Boolean) && wanted.every((w) => this.segments.has(w.id));
  }

  private effectiveGains(): Record<string, number> {
    const anySolo = [...this.channels.values()].some((c) => c.solo);
    const gains: Record<string, number> = {};
    for (const ch of this.channels.values()) {
      const audible = !ch.mute && (!anySolo || ch.solo);
      gains[ch.id] = audible ? dbToGain(ch.db) : 0;
    }
    return gains;
  }

  /** Applies compression, fader, mute and solo to the audio graph. */
  apply(): void {
    const gains = this.effectiveGains();
    for (const ch of this.channels.values()) {
      ch.gain.gain.setTargetAtTime(gains[ch.id]!, this.ctx.currentTime, 0.01);
      setCompressor(ch.compressor, compressorParams(ch.comp), this.ctx);
    }
    setCompressor(this.masterCompressor, compressorParams(this.masterComp), this.ctx);
    this.masterGain.gain.setTargetAtTime(dbToGain(this.masterDb), this.ctx.currentTime, 0.01);
    this.onChange?.();
  }

  set(id: string, change: Partial<ChannelState>): void {
    const ch = this.channels.get(id);
    if (!ch) return;
    Object.assign(ch, change);
    this.apply();
  }

  setMaster(db: number): void {
    this.masterDb = db;
    this.apply();
  }

  setMasterComp(amount: number): void {
    this.masterComp = amount;
    this.apply();
  }

  get isPlaying(): boolean {
    return this.running;
  }

  /** Playing but held until the next seconds are complete. */
  get isWaiting(): boolean {
    return this.running && this.waiting;
  }

  /** Playhead in seconds from the start of the piece. */
  get position(): number {
    // Sources start slightly after playback (re)starts; hold the offset until then.
    return this.running && !this.waiting
      ? this.offset + Math.max(0, this.ctx.currentTime - this.startedAt)
      : this.offset;
  }

  /** Fetches segments not here yet: small batches, earliest first, a few at a time. */
  private async load(requests: Wanted[]): Promise<void> {
    const missing = requests.filter((r) => !this.segments.has(r.id) && !this.fetching.has(r.id));
    if (!missing.length || !this.fetchSegments) return;
    const fetchSegments = this.fetchSegments;
    for (const r of missing) this.fetching.add(r.id);
    missing.sort((a, b) => a.index - b.index);
    const batches: Wanted[][] = [];
    for (let i = 0; i < missing.length; i += batchSize)
      batches.push(missing.slice(i, i + batchSize));
    const next = async (): Promise<void> => {
      for (let batch = batches.shift(); batch; batch = batches.shift()) {
        try {
          const got = await fetchSegments(
            batch.map(({ id, frames, contributions }) => ({ id, frames, contributions })),
          );
          for (const [id, bytes] of got) this.segments.set(id, decode(this.ctx, bytes));
        } finally {
          for (const r of batch) this.fetching.delete(r.id);
        }
        this.tick();
      }
    };
    await Promise.all(Array.from({ length: fetchers }, next));
  }

  async play(from = this.position): Promise<void> {
    await this.ctx.resume();
    this.running = true;
    this.hold(from);
    this.onChange?.();
  }

  pause(): void {
    const at = this.position;
    this.stopSources();
    this.running = false;
    this.waiting = false;
    this.offset = at;
    this.onChange?.();
  }

  seek(seconds: number): void {
    const at = Math.max(0, Math.min(seconds, this.duration));
    if (this.running) this.hold(at);
    else {
      this.offset = at;
      this.onChange?.();
      this.tick();
    }
  }

  /** Stops what sounds and waits at `seconds` until the next seconds are complete. */
  private hold(seconds: number): void {
    this.stopSources();
    this.offset = Math.max(0, Math.min(seconds, this.duration));
    this.waiting = true;
    this.tick();
  }

  private stopSources(): void {
    for (const s of this.scheduled.values()) {
      try {
        s.source?.stop();
      } catch {
        // already stopped
      }
      s.source?.disconnect();
    }
    this.scheduled.clear();
  }

  /** Forgets scheduled segments that have not started (a new version may mix them otherwise). */
  private dropUnstarted(): void {
    const current = Math.floor(this.position / segmentSeconds);
    for (const [slot, s] of this.scheduled) {
      if (s.index <= current) continue;
      try {
        s.source?.stop();
      } catch {
        // already stopped
      }
      s.source?.disconnect();
      this.scheduled.delete(slot);
    }
  }

  /** Fetches, schedules and forgets segments around the playhead. Call regularly. */
  tick(): void {
    const now = this.position;
    if (this.running && !this.waiting && now >= this.duration + 30) {
      this.pause();
      this.offset = 0;
      return;
    }
    const index = Math.floor(now / segmentSeconds);
    const { wanted: soon } = this.wanted(index, index + fetchAhead);
    void this.load(soon);
    // Forget segments that are not wanted any more (behind, or replaced by newer ones).
    const keep = new Set(soon.map((r) => r.id));
    for (const id of this.segments.keys()) if (!keep.has(id)) this.segments.delete(id);
    if (!this.running) return;

    if (this.waiting) {
      // Resume once the next seconds are complete and here.
      const last = Math.floor((now + startMargin) / segmentSeconds);
      if (!this.ready(index, last)) return;
      this.waiting = false;
      this.startedAt = this.ctx.currentTime + 0.05;
      this.onChange?.();
    }

    const at = (i: number) => this.startedAt + (i * segmentSeconds - this.offset);
    for (let i = index; i <= index + scheduleAhead; i++) {
      // What sounds now plays to its end, even if a newer version mixes this segment otherwise.
      const sounding = [...this.scheduled.values()].some((x) => x.index === i && i === index);
      if (sounding) continue;
      if (!this.ready(i, i)) {
        // All parts wait at the boundary of a segment that is not complete and here yet.
        if (this.ctx.currentTime >= at(i) - 0.02) {
          this.hold(Math.max(now, i * segmentSeconds));
          this.onChange?.();
        }
        break;
      }
      for (const r of soon) {
        if (r.index !== i) continue;
        const slot = `${r.part}|${r.index}`;
        if (this.scheduled.get(slot)?.name === r.id) continue;
        const buffer = this.segments.get(r.id);
        const channel = this.channels.get(r.part);
        const lateBy = Math.max(0, this.ctx.currentTime + 0.02 - at(r.index));
        if (!buffer || !channel || lateBy >= buffer.duration) {
          this.scheduled.set(slot, { name: r.id, index: r.index });
          continue;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(channel.compressor);
        source.start(at(r.index) + lateBy, lateBy);
        source.onended = () => source.disconnect();
        this.scheduled.set(slot, { name: r.id, index: r.index, source });
      }
    }
    // Forget what was scheduled for segments that have ended.
    for (const [slot, s] of this.scheduled) if (s.index < index - 1) this.scheduled.delete(slot);
  }

  /** Current gain reduction in dB (≤ 0) of a channel's compressor, or the master's (its compressor and limiter). */
  reduction(id?: string): number {
    return id
      ? (this.channels.get(id)?.compressor.reduction ?? 0)
      : this.masterCompressor.reduction + this.limiter.reduction;
  }

  /** Peak level (linear) of a channel after its fader, or of the master. */
  meter(id?: string): number {
    const analyser = id ? this.channels.get(id)?.analyser : this.masterAnalyser;
    if (!analyser) return 0;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v));
    return peak;
  }
}

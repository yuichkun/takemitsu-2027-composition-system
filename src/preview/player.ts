// Playback of rendered chunks through a mixer: one channel per part (compression, fader, mute,
// solo, meter) and a master with a limiter. Every channel goes through a compressor, even at 0,
// so the compressor's look-ahead delays all channels alike.
//
// The player gets the score's whole list of chunks (the manifest) each time the score changes.
// It streams each part as consecutive 2-second segments, mixed by the server from that part's
// rendered chunks (src/performance/segments.ts), and keeps only the few segments around the
// playhead. A segment is named by exactly what it mixes (which chunks, where, at what gain),
// so when a chunk becomes ready or the score changes, the segments that differ get new names
// and are fetched again; the rest stay. A chunk that is not rendered yet is silent.

import { compressorParams, limiterParams, type CompressorParams } from "../audio/dynamics.ts";

export interface ChannelState {
  db: number;
  mute: boolean;
  solo: boolean;
  /** Compression amount, 0–1 (src/audio/dynamics.ts). */
  comp: number;
}

export interface MixerSettings {
  master?: number;
  parts?: Record<string, ChannelState>;
}

/** [key, part index, origin (s), gain, stored frames or -1 while not rendered] */
export type ManifestChunk = [string, number, number, number, number];

export interface Manifest {
  version: number;
  duration: number;
  measures: { start: number; end: number }[];
  parts: string[];
  chunks: ManifestChunk[];
}

/** [chunk key, the chunk's frame 0 relative to the segment's start, gain] */
export type Contribution = [string, number, number];

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

interface Entry {
  key: string;
  part: string;
  origin: number;
  gain: number;
  /** Stored frames; undefined while not rendered. */
  frames?: number;
}

interface Wanted extends SegmentRequest {
  part: string;
  index: number;
}

const sampleRate = 48000;
/** Segment length in seconds; segment i covers [i·S, (i+1)·S) of the piece. */
const segmentSeconds = 2;
const segmentFrames = segmentSeconds * sampleRate;
/** Segments fetched ahead of the playhead, and scheduled ahead on the audio clock. */
const fetchAhead = 3;
const scheduleAhead = 1;

function setCompressor(node: DynamicsCompressorNode, p: CompressorParams, ctx: AudioContext): void {
  const t = ctx.currentTime;
  node.threshold.setValueAtTime(p.threshold, t);
  node.ratio.setValueAtTime(Math.max(1, p.ratio), t);
  node.knee.setValueAtTime(p.knee, t);
  node.attack.setValueAtTime(p.attack, t);
  node.release.setValueAtTime(p.release, t);
}

export const dbToGain = (db: number) => (db <= -60 ? 0 : 10 ** (db / 20));

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

export class Player {
  readonly ctx = new AudioContext({ sampleRate });
  readonly masterGain = this.ctx.createGain();
  readonly limiter = this.ctx.createDynamicsCompressor();
  readonly masterAnalyser = this.ctx.createAnalyser();
  masterDb = 0;
  duration = 0;
  onChange?: () => void;
  /** Fetches mixed segments. */
  fetchSegments?: (requests: SegmentRequest[]) => Promise<Map<string, Uint8Array>>;

  private channels = new Map<string, Channel>();
  /** Chunks per part, sorted by origin, and the longest chunk per part (seconds). */
  private byPart = new Map<string, Entry[]>();
  private longest = new Map<string, number>();
  private byKey = new Map<string, Entry>();
  private entries: Entry[] = [];
  /** Decoded segments by name (null: silent). */
  private segments = new Map<string, AudioBuffer | null>();
  private fetching = new Set<string>();
  /** What is scheduled per part and segment index ("part|index"). */
  private scheduled = new Map<string, { name: string; source?: AudioBufferSourceNode }>();
  private startedAt = 0;
  private offset = 0;
  private running = false;

  constructor() {
    setCompressor(this.limiter, limiterParams, this.ctx);
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
      analyser.connect(this.masterGain);
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
    // Sounding segments were connected to the old channels.
    if (this.running) this.restart();
    this.apply();
  }

  settings(): MixerSettings {
    const parts: Record<string, ChannelState> = {};
    for (const ch of this.channels.values())
      parts[ch.id] = { db: ch.db, mute: ch.mute, solo: ch.solo, comp: ch.comp };
    return { master: this.masterDb, parts };
  }

  channel(id: string): ChannelState | undefined {
    return this.channels.get(id);
  }

  hasSound(id: string): boolean {
    return (this.byPart.get(id)?.length ?? 0) > 0;
  }

  /** Takes a new list of chunks. Segments that mix the same things as before are kept. */
  setManifest(manifest: Manifest): void {
    this.duration = manifest.duration;
    this.entries = manifest.chunks
      .map(([key, part, origin, gain, frames]) => ({
        key,
        part: manifest.parts[part]!,
        origin,
        gain,
        frames: frames >= 0 ? frames : undefined,
      }))
      .sort((a, b) => a.origin - b.origin);
    this.byKey = new Map(this.entries.map((e) => [e.key, e]));
    this.byPart = new Map();
    this.longest = new Map();
    for (const e of this.entries) {
      const list = this.byPart.get(e.part) ?? [];
      list.push(e);
      this.byPart.set(e.part, list);
      this.longest.set(
        e.part,
        Math.max(this.longest.get(e.part) ?? 0, (e.frames ?? 0) / sampleRate),
      );
    }
    this.tick();
  }

  /** Chunks that finished rendering. */
  ready(chunks: [string, number][]): void {
    for (const [key, frames] of chunks) {
      const e = this.byKey.get(key);
      if (!e) continue;
      e.frames = frames;
      this.longest.set(e.part, Math.max(this.longest.get(e.part) ?? 0, frames / sampleRate));
    }
    this.tick();
  }

  /** How much of the piece is rendered: per measure, the share of its chunks that are ready. */
  readiness(measures: { start: number; end: number }[]): number[] {
    // One sweep: entries and measures are both in time order.
    const all = Array.from({ length: measures.length }, () => 0);
    const done = Array.from({ length: measures.length }, () => 0);
    let m = 0;
    for (const e of this.entries) {
      const onset = e.origin + 0.06;
      while (m < measures.length - 1 && onset >= measures[m]!.end) m++;
      all[m]!++;
      if (e.frames !== undefined) done[m]!++;
    }
    return all.map((n, i) => (n ? done[i]! / n : 1));
  }

  /** What segment `index` of a part mixes: its rendered chunks sounding in it. */
  private contributions(part: string, index: number): Contribution[] {
    const list = this.byPart.get(part);
    if (!list) return [];
    const start = index * segmentSeconds;
    const end = start + segmentSeconds;
    const earliest = start - (this.longest.get(part) ?? 0) - 1;
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]!.origin < earliest) lo = mid + 1;
      else hi = mid;
    }
    const out: Contribution[] = [];
    for (let i = lo; i < list.length && list[i]!.origin < end; i++) {
      const e = list[i]!;
      if (!e.frames) continue;
      const offset = Math.round((e.origin - start) * sampleRate);
      if (offset + e.frames <= 0) continue;
      out.push([e.key, offset, e.gain]);
    }
    return out;
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

  get isPlaying(): boolean {
    return this.running;
  }

  /** Playhead in seconds from the start of the piece. */
  get position(): number {
    // Sources start slightly after play() is called; hold the offset until then.
    return this.running
      ? this.offset + Math.max(0, this.ctx.currentTime - this.startedAt)
      : this.offset;
  }

  /** The segments with anything in them, for indices [from, to]. */
  private wanted(from: number, to: number): Wanted[] {
    const out: Wanted[] = [];
    for (let index = Math.max(-1, from); index <= to; index++)
      for (const part of this.byPart.keys()) {
        const contributions = this.contributions(part, index);
        if (!contributions.length) continue;
        const id = nameOf(part, index, contributions);
        out.push({ id, part, index, frames: segmentFrames, contributions });
      }
    return out;
  }

  /** Fetches segments not here yet. */
  private async load(requests: Wanted[]): Promise<void> {
    const missing = requests.filter((r) => !this.segments.has(r.id) && !this.fetching.has(r.id));
    if (!missing.length || !this.fetchSegments) return;
    for (const r of missing) this.fetching.add(r.id);
    try {
      // Small batches, earliest first: the segment under the playhead arrives soonest.
      missing.sort((a, b) => a.index - b.index);
      for (let i = 0; i < missing.length; i += 40) {
        const batch = missing
          .slice(i, i + 40)
          .map(({ id, frames, contributions }) => ({ id, frames, contributions }));
        const got = await this.fetchSegments(batch);
        for (const [id, bytes] of got) this.segments.set(id, decode(this.ctx, bytes));
        this.tick();
      }
    } finally {
      for (const r of missing) this.fetching.delete(r.id);
    }
  }

  async play(from = this.position): Promise<void> {
    await this.ctx.resume();
    this.stopSources();
    this.offset = Math.max(0, Math.min(from, this.duration));
    // Have the first moments here before starting, so the start is not ragged.
    const first = Math.floor(this.offset / segmentSeconds);
    await Promise.race([
      this.load(this.wanted(first, first)),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
    this.startedAt = this.ctx.currentTime + 0.05;
    this.running = true;
    this.tick();
    this.onChange?.();
  }

  pause(): void {
    const at = this.position;
    this.stopSources();
    this.running = false;
    this.offset = at;
    this.onChange?.();
  }

  seek(seconds: number): void {
    if (this.running) void this.play(seconds);
    else {
      this.offset = Math.max(0, Math.min(seconds, this.duration));
      this.onChange?.();
      this.tick();
    }
  }

  private restart(): void {
    const at = this.position;
    this.stopSources();
    this.offset = at;
    this.startedAt = this.ctx.currentTime + 0.05;
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

  /** Fetches, schedules and forgets segments around the playhead. Call regularly. */
  tick(): void {
    const now = this.position;
    if (this.running && now >= this.duration + 30) {
      this.pause();
      this.offset = 0;
      return;
    }
    const index = Math.floor(now / segmentSeconds);
    const soon = this.wanted(index, index + fetchAhead);
    void this.load(soon);
    // Forget segments that are not wanted any more (behind, or replaced by newer ones).
    const keep = new Set(soon.map((r) => r.id));
    for (const id of this.segments.keys()) if (!keep.has(id)) this.segments.delete(id);
    if (!this.running) return;

    for (const r of soon) {
      if (r.index > index + scheduleAhead) continue;
      const slot = `${r.part}|${r.index}`;
      const current = this.scheduled.get(slot);
      if (current?.name === r.id) continue;
      const buffer = this.segments.get(r.id);
      if (buffer === undefined) continue; // not here yet
      // A newer version of a segment that is already playing takes over from here.
      try {
        current?.source?.stop();
      } catch {
        // already stopped
      }
      const channel = this.channels.get(r.part);
      const at = this.startedAt + (r.index * segmentSeconds - this.offset);
      const lateBy = Math.max(0, this.ctx.currentTime + 0.02 - at);
      if (buffer === null || !channel || lateBy >= buffer.duration) {
        this.scheduled.set(slot, { name: r.id });
        continue;
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(channel.compressor);
      source.start(at + lateBy, lateBy);
      source.onended = () => source.disconnect();
      this.scheduled.set(slot, { name: r.id, source });
    }
    // Forget what was scheduled for segments that have ended.
    for (const slot of this.scheduled.keys())
      if (Number(slot.slice(slot.lastIndexOf("|") + 1)) < index - 1) this.scheduled.delete(slot);
  }

  /** Current gain reduction in dB (≤ 0) of a channel's compressor, or of the master limiter. */
  reduction(id?: string): number {
    return id ? (this.channels.get(id)?.compressor.reduction ?? 0) : this.limiter.reduction;
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

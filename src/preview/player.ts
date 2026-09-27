// Playback with a mixer: one channel per part (fader, mute, solo, meter) and a master.
//
// Stems mode mixes the parts' stems in the browser, so every change is immediate.
// Long renders with many parts would not fit in memory decoded; they use mix mode instead:
// the server mixes the stems with the fader settings and the browser plays one file.

export interface ChannelState {
  db: number;
  mute: boolean;
  solo: boolean;
}

export interface MixerSettings {
  master?: number;
  parts?: Record<string, ChannelState>;
}

interface Channel extends ChannelState {
  id: string;
  gain: GainNode;
  analyser: AnalyserNode;
  buffer?: AudioBuffer;
}

/** Decoded stems above this size switch to mix mode. */
const stemBudgetBytes = 1.2e9;

export const dbToGain = (db: number) => (db <= -60 ? 0 : 10 ** (db / 20));

export class Player {
  readonly ctx = new AudioContext({ sampleRate: 48000 });
  readonly masterGain = this.ctx.createGain();
  readonly masterAnalyser = this.ctx.createAnalyser();
  masterDb = 0;
  mode: "stems" | "mix" = "stems";
  duration = 0;
  onChange?: () => void;

  private channels = new Map<string, Channel>();
  private sources: AudioBufferSourceNode[] = [];
  private startedAt = 0;
  private offset = 0;
  private playing = false;
  private element = new Audio();
  private elementSource = this.ctx.createMediaElementSource(this.element);
  private remix?: (gains: Record<string, number>) => Promise<string>;
  private remixTimer = 0;

  constructor() {
    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);
    this.masterAnalyser.fftSize = 1024;
    this.elementSource.connect(this.masterGain);
    this.element.addEventListener("ended", () => {
      this.playing = false;
      this.onChange?.();
    });
  }

  /** Sets the channels (in score order) and their saved settings. Keeps settings of known ids. */
  setParts(ids: string[], settings: MixerSettings): void {
    for (const ch of this.channels.values()) ch.gain.disconnect();
    const next = new Map<string, Channel>();
    for (const id of ids) {
      const saved = settings.parts?.[id] ??
        this.channels.get(id) ?? { db: 0, mute: false, solo: false };
      const gain = this.ctx.createGain();
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 1024;
      gain.connect(analyser);
      analyser.connect(this.masterGain);
      next.set(id, {
        id,
        db: saved.db,
        mute: saved.mute,
        solo: saved.solo,
        gain,
        analyser,
        buffer: this.channels.get(id)?.buffer,
      });
    }
    this.channels = next;
    this.masterDb = settings.master ?? this.masterDb;
    this.apply();
  }

  settings(): MixerSettings {
    const parts: Record<string, ChannelState> = {};
    for (const ch of this.channels.values())
      parts[ch.id] = { db: ch.db, mute: ch.mute, solo: ch.solo };
    return { master: this.masterDb, parts };
  }

  channel(id: string): ChannelState | undefined {
    return this.channels.get(id);
  }

  hasSound(id: string): boolean {
    return this.mode === "mix" || this.channels.get(id)?.buffer !== undefined;
  }

  /** Loads a render: stems when they fit in memory, otherwise the server-mixed file. */
  async load(
    stems: Record<string, string>,
    seconds: number,
    remix: (gains: Record<string, number>) => Promise<string>,
    onProgress?: (text: string) => void,
  ): Promise<void> {
    this.stop();
    this.remix = remix;
    this.duration = seconds;
    const bytes = seconds * this.ctx.sampleRate * 2 * 4 * Object.keys(stems).length;
    for (const ch of this.channels.values()) ch.buffer = undefined;
    if (bytes > stemBudgetBytes) {
      this.mode = "mix";
      await this.remixNow();
      return;
    }
    this.mode = "stems";
    let loaded = 0;
    await Promise.all(
      Object.entries(stems).map(async ([id, url]) => {
        const data = await (await fetch(url)).arrayBuffer();
        const buffer = await this.ctx.decodeAudioData(data);
        const ch = this.channels.get(id);
        if (ch) ch.buffer = buffer;
        onProgress?.(`音を読み込み中 ${++loaded}/${Object.keys(stems).length}`);
      }),
    );
    this.apply();
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

  /** Applies fader, mute and solo to the audio graph (or asks the server to mix again). */
  apply(): void {
    const gains = this.effectiveGains();
    for (const ch of this.channels.values())
      ch.gain.gain.setTargetAtTime(gains[ch.id]!, this.ctx.currentTime, 0.01);
    this.masterGain.gain.setTargetAtTime(dbToGain(this.masterDb), this.ctx.currentTime, 0.01);
    if (this.mode === "mix" && this.remix) {
      clearTimeout(this.remixTimer);
      this.remixTimer = window.setTimeout(() => void this.remixNow(), 400);
    }
    this.onChange?.();
  }

  private async remixNow(): Promise<void> {
    if (!this.remix) return;
    const at = this.position;
    const wasPlaying = this.playing;
    const url = await this.remix(this.effectiveGains());
    this.element.src = url;
    this.element.currentTime = at;
    if (wasPlaying) await this.element.play();
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
    return this.playing;
  }

  get position(): number {
    if (this.mode === "mix") return this.element.currentTime;
    // Sources start slightly after play() is called; hold the offset until then.
    return this.playing
      ? this.offset + Math.max(0, this.ctx.currentTime - this.startedAt)
      : this.offset;
  }

  async play(from = this.position): Promise<void> {
    await this.ctx.resume();
    this.stop(false);
    this.offset = Math.max(0, Math.min(from, this.duration));
    if (this.mode === "mix") {
      this.element.currentTime = this.offset;
      await this.element.play();
    } else {
      this.startedAt = this.ctx.currentTime + 0.05;
      for (const ch of this.channels.values()) {
        if (!ch.buffer) continue;
        const src = this.ctx.createBufferSource();
        src.buffer = ch.buffer;
        src.connect(ch.gain);
        src.start(this.startedAt, this.offset);
        this.sources.push(src);
      }
    }
    this.playing = true;
    this.onChange?.();
  }

  pause(): void {
    const at = this.position;
    this.stop(false);
    this.offset = at;
    this.onChange?.();
  }

  seek(seconds: number): void {
    if (this.playing) void this.play(seconds);
    else {
      this.offset = Math.max(0, Math.min(seconds, this.duration));
      if (this.mode === "mix") this.element.currentTime = this.offset;
      this.onChange?.();
    }
  }

  private stop(resetOffset = true): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // already stopped
      }
      s.disconnect();
    }
    this.sources = [];
    this.element.pause();
    this.playing = false;
    if (resetOffset) this.offset = 0;
  }

  /** Stops at the end of the render. Call regularly. */
  tick(): void {
    if (this.playing && this.mode === "stems" && this.position >= this.duration) {
      this.stop();
      this.onChange?.();
    }
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

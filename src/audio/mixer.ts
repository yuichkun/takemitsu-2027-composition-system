// The preview's mixer settings, shared by the page, which plays through them
// (src/preview/player.ts), and the server, which exports the mix the same way
// (src/performance/render.ts, mixAsHeard).

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

/** A fader's gain: −60 dB and below is silence. */
export const dbToGain = (db: number) => (db <= -60 ? 0 : 10 ** (db / 20));

/** Each part's fader gain after mute and solo (0 for a part that is not heard). */
export function audibleGains(settings: MixerSettings, ids: string[]): Record<string, number> {
  const state = (id: string) => settings.parts?.[id];
  const anySolo = ids.some((id) => state(id)?.solo);
  const gains: Record<string, number> = {};
  for (const id of ids) {
    const s = state(id);
    const audible = !s?.mute && (!anySolo || s?.solo === true);
    gains[id] = audible ? dbToGain(s?.db ?? 0) : 0;
  }
  return gains;
}

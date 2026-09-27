// Compression for the mixer: one "amount" per channel (0–1) sets threshold, ratio and make-up
// together. The browser uses DynamicsCompressorNode with these parameters; the server applies
// the same curve offline when it mixes a render too long for the browser.

export interface CompressorParams {
  /** dBFS where compression starts. */
  threshold: number;
  ratio: number;
  /** Soft-knee width in dB. */
  knee: number;
  attack: number;
  release: number;
  /** Gain added after compression, in dB (Chromium's DynamicsCompressorNode adds the same amount itself). */
  makeup: number;
}

/** 0 = transparent, 1 = heavy (−40 dB threshold, 8:1, about +21 dB make-up). */
export function compressorParams(amount: number): CompressorParams {
  const a = Math.max(0, Math.min(1, amount));
  const threshold = -40 * a;
  const ratio = 1 + 7 * a;
  // Chromium's automatic make-up: (1 / gain at full scale)^0.6.
  const makeup = -0.6 * threshold * (1 - 1 / ratio);
  return { threshold, ratio, knee: a > 0 ? 12 : 0, attack: 0.005, release: 0.25, makeup };
}

/** Brick-wall-ish limiter at the end of the master bus. */
export const limiterParams: CompressorParams = {
  threshold: -1,
  ratio: 20,
  knee: 0,
  attack: 0.001,
  release: 0.08,
  makeup: -0.6 * -1 * (1 - 1 / 20),
};

/** Static curve: output level (dB) for an input level (dB). */
function curve(inDb: number, p: CompressorParams): number {
  const over = inDb - p.threshold;
  if (p.knee > 0 && Math.abs(over) <= p.knee / 2) {
    return inDb + ((1 / p.ratio - 1) * (over + p.knee / 2) ** 2) / (2 * p.knee);
  }
  return over > 0 ? p.threshold + over / p.ratio : inDb;
}

/** Compresses stereo audio in place (stereo-linked peak detection). */
export function compressInPlace(
  channels: Float32Array[],
  sampleRate: number,
  p: CompressorParams,
): void {
  if (p.ratio <= 1 && p.makeup === 0) return;
  const attack = Math.exp(-1 / (p.attack * sampleRate));
  const release = Math.exp(-1 / (p.release * sampleRate));
  const makeup = 10 ** (p.makeup / 20);
  const length = channels[0]?.length ?? 0;
  let reduction = 0; // dB, ≤ 0
  for (let i = 0; i < length; i++) {
    let peak = 0;
    for (const ch of channels) peak = Math.max(peak, Math.abs(ch[i]!));
    const inDb = peak > 1e-9 ? 20 * Math.log10(peak) : -180;
    const target = curve(inDb, p) - inDb;
    const coeff = target < reduction ? attack : release;
    reduction = coeff * reduction + (1 - coeff) * target;
    const gain = 10 ** (reduction / 20) * makeup;
    for (const ch of channels) ch[i]! *= gain;
  }
}

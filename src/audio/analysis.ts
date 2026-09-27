// Measurements used to verify renders: loudness per window and pitch near an expected frequency.

export function rms(samples: Float32Array, start = 0, end = samples.length): number {
  let sum = 0;
  const from = Math.max(0, start);
  const to = Math.min(samples.length, end);
  for (let i = from; i < to; i++) sum += samples[i]! * samples[i]!;
  return to > from ? Math.sqrt(sum / (to - from)) : 0;
}

export function peak(samples: Float32Array, start = 0, end = samples.length): number {
  let max = 0;
  for (let i = Math.max(0, start); i < Math.min(samples.length, end); i++) max = Math.max(max, Math.abs(samples[i]!));
  return max;
}

export const toDb = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

/** In-place iterative radix-2 FFT. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a]! += tr;
        im[a]! += ti;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
}

export interface Spectrum {
  magnitude: Float64Array;
  binHz: number;
}

export function spectrum(samples: Float32Array, start: number, size = 65536, sampleRate = 48000): Spectrum {
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    const s = samples[start + i] ?? 0;
    re[i] = s * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  fft(re, im);
  const magnitude = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) magnitude[i] = Math.hypot(re[i]!, im[i]!);
  return { magnitude, binHz: sampleRate / size };
}

/** Strongest peak within ±`windowCents` of `hz`, refined by parabolic interpolation on log magnitude. */
export function peakNear(s: Spectrum, hz: number, windowCents = 80): { hz: number; level: number } | undefined {
  const lo = Math.max(1, Math.floor((hz * 2 ** (-windowCents / 1200)) / s.binHz));
  const hi = Math.min(s.magnitude.length - 2, Math.ceil((hz * 2 ** (windowCents / 1200)) / s.binHz));
  let best = -1;
  for (let i = lo; i <= hi; i++) if (best < 0 || s.magnitude[i]! > s.magnitude[best]!) best = i;
  if (best < 0) return undefined;
  const a = Math.log(s.magnitude[best - 1]! + 1e-12);
  const b = Math.log(s.magnitude[best]! + 1e-12);
  const c = Math.log(s.magnitude[best + 1]! + 1e-12);
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  return { hz: (best + shift) * s.binHz, level: s.magnitude[best]! };
}

export const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * Measured pitch (in fractional MIDI) of a sound expected near `expectedMidi`.
 * Uses the first few harmonics, weighted by their level, so a weak fundamental does not dominate.
 */
export function measurePitch(
  samples: Float32Array,
  start: number,
  expectedMidi: number,
  sampleRate = 48000,
  size = 65536,
): number | undefined {
  const s = spectrum(samples, start, size, sampleRate);
  const f0 = midiToHz(expectedMidi);
  let weighted = 0;
  let total = 0;
  for (let h = 1; h <= 4; h++) {
    if (f0 * h > sampleRate / 2 - 1000) break;
    const p = peakNear(s, f0 * h, 80);
    if (!p) continue;
    weighted += hzToMidi(p.hz / h) * p.level;
    total += p.level;
  }
  return total > 0 ? weighted / total : undefined;
}

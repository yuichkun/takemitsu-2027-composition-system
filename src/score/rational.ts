// Exact time arithmetic. Durations like 1/3 or 1/5 must not drift through floating point.

import type { Time } from "./types.ts";

export class Rational {
  readonly n: number;
  readonly d: number;

  constructor(n: number, d = 1) {
    if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0)
      throw new Error(`Invalid fraction ${n}/${d}`);
    const g = gcd(Math.abs(n), Math.abs(d)) || 1;
    const sign = d < 0 ? -1 : 1;
    this.n = (sign * n) / g;
    this.d = (sign * d) / g;
  }

  static of(t: Time): Rational {
    if (Array.isArray(t)) return new Rational(t[0], t[1]);
    return fromNumber(t);
  }

  static readonly zero = new Rational(0);

  add(o: Rational): Rational {
    return new Rational(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Rational): Rational {
    return new Rational(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Rational): Rational {
    return new Rational(this.n * o.n, this.d * o.d);
  }
  div(o: Rational): Rational {
    return new Rational(this.n * o.d, this.d * o.n);
  }
  cmp(o: Rational): number {
    return this.n * o.d - o.n * this.d;
  }
  eq(o: Rational): boolean {
    return this.cmp(o) === 0;
  }
  lt(o: Rational): boolean {
    return this.cmp(o) < 0;
  }
  lte(o: Rational): boolean {
    return this.cmp(o) <= 0;
  }
  gt(o: Rational): boolean {
    return this.cmp(o) > 0;
  }
  gte(o: Rational): boolean {
    return this.cmp(o) >= 0;
  }
  get value(): number {
    return this.n / this.d;
  }
  floor(): number {
    return Math.floor(this.n / this.d);
  }
  toString(): string {
    return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`;
  }
}

export const min = (a: Rational, b: Rational) => (a.lte(b) ? a : b);
export const max = (a: Rational, b: Rational) => (a.gte(b) ? a : b);

export function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

/** Converts a decimal to a fraction, accepting only values that are exact to 1/10080 of a quarter. */
function fromNumber(x: number): Rational {
  if (Number.isInteger(x)) return new Rational(x);
  // 10080 = 2^5·3^2·5·7: covers tuplets of 3, 5, 7, 9 and 32nd subdivisions.
  const grid = 10080;
  const scaled = Math.round(x * grid);
  if (Math.abs(scaled / grid - x) > 1e-9)
    throw new Error(`Time ${x} is not an exact fraction; write it as [numerator, denominator]`);
  return new Rational(scaled, grid);
}

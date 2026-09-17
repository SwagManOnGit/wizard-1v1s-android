// Seeded random numbers so the server, a replay and a client all compute the same duel.
export class Rng {
  private a: number;
  constructor(seed: number) { this.a = seed >>> 0; }
  /** Uniform float in [0, 1). */
  next(): number {
    this.a = (this.a + 0x6D2B79F5) | 0;
    let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number { return a + this.next() * (b - a); }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
}

export function randomSeed(): number { return Math.floor(Math.random() * 0xffffffff) >>> 0; }

// $1 Unistroke Recognizer (Wobbrock, Wilson, Li 2007), adapted:
//  - no rotation invariance (a caret and a vee are different spells), only a small bounded search
//  - uniform scaling so straight lines do not collapse into NaN
import type { Point } from './glyphs';

const N = 64;
const SIZE = 250;
const HALF_DIAG = 0.5 * Math.sqrt(2 * SIZE * SIZE);
const ANGLE_RANGE = 18 * (Math.PI / 180);
const ANGLE_PRECISION = 2 * (Math.PI / 180);
const PHI = 0.5 * (-1 + Math.sqrt(5));

export interface Template<T> { key: T; points: Point[] }
export interface Match<T> { key: T; score: number }

export function pathLength(pts: Point[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}

function resample(points: Point[], n: number): Point[] {
  const I = pathLength(points) / (n - 1);
  if (I === 0) return Array.from({ length: n }, () => ({ ...points[0] }));
  let D = 0;
  const pts = points.map(p => ({ ...p }));
  const out: Point[] = [{ ...pts[0] }];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (D + d >= I) {
      const q = {
        x: pts[i - 1].x + ((I - D) / d) * (pts[i].x - pts[i - 1].x),
        y: pts[i - 1].y + ((I - D) / d) * (pts[i].y - pts[i - 1].y),
      };
      out.push(q);
      pts.splice(i, 0, q);
      D = 0;
    } else D += d;
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out.slice(0, n);
}

function centroid(pts: Point[]): Point {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

function scaleUniform(pts: Point[], size: number): Point[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const s = size / Math.max(maxX - minX, maxY - minY, 1e-6);
  return pts.map(p => ({ x: p.x * s, y: p.y * s }));
}

function translateToOrigin(pts: Point[]): Point[] {
  const c = centroid(pts);
  return pts.map(p => ({ x: p.x - c.x, y: p.y - c.y }));
}

function rotateBy(pts: Point[], a: number): Point[] {
  const c = centroid(pts);
  const cos = Math.cos(a), sin = Math.sin(a);
  return pts.map(p => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

function pathDistance(a: Point[], b: Point[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return d / a.length;
}

function distanceAtAngle(pts: Point[], t: Point[], a: number): number {
  return pathDistance(rotateBy(pts, a), t);
}

function distanceAtBestAngle(pts: Point[], t: Point[]): number {
  let a = -ANGLE_RANGE, b = ANGLE_RANGE;
  let x1 = PHI * a + (1 - PHI) * b; let f1 = distanceAtAngle(pts, t, x1);
  let x2 = (1 - PHI) * a + PHI * b; let f2 = distanceAtAngle(pts, t, x2);
  while (Math.abs(b - a) > ANGLE_PRECISION) {
    if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = PHI * a + (1 - PHI) * b; f1 = distanceAtAngle(pts, t, x1); }
    else { a = x1; x1 = x2; f1 = f2; x2 = (1 - PHI) * a + PHI * b; f2 = distanceAtAngle(pts, t, x2); }
  }
  return Math.min(f1, f2);
}

/** Drops near-duplicate samples and applies a 3-point moving average so finger jitter does not inflate the path. */
export function smooth(points: Point[]): Point[] {
  const dedup: Point[] = [];
  for (const p of points) {
    const last = dedup[dedup.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 2) dedup.push(p);
  }
  if (dedup.length < 3) return dedup;
  const out: Point[] = [dedup[0]];
  for (let i = 1; i < dedup.length - 1; i++) {
    out.push({ x: (dedup[i - 1].x + dedup[i].x + dedup[i + 1].x) / 3, y: (dedup[i - 1].y + dedup[i].y + dedup[i + 1].y) / 3 });
  }
  out.push(dedup[dedup.length - 1]);
  return out;
}

export function normalize(points: Point[]): Point[] {
  return translateToOrigin(scaleUniform(resample(points, N), SIZE));
}

export class Recognizer<T> {
  private templates: Template<T>[] = [];

  /** Adds a template in both stroke directions so left-handed strokes match too. */
  add(key: T, points: Point[], bothDirections = true): void {
    this.templates.push({ key, points: normalize(points) });
    if (bothDirections) this.templates.push({ key, points: normalize([...points].reverse()) });
  }

  clear(): void { this.templates = []; }

  /** Returns the best match, or null when the stroke is too short to mean anything. */
  recognize(points: Point[]): Match<T> | null {
    const cleaned = smooth(points);
    if (cleaned.length < 4 || pathLength(cleaned) < 25) return null;
    const c = normalize(cleaned);
    let best: Match<T> | null = null;
    for (const t of this.templates) {
      const d = distanceAtBestAngle(c, t.points);
      const score = 1 - d / HALF_DIAG;
      if (!best || score > best.score) best = { key: t.key, score };
    }
    return best;
  }
}

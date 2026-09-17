// Stroke templates for every spell glyph. Coordinates live in a 0..100 box, y down.
// Templates are resampled by the recognizer, so straight segments only need their corners.

export interface Point { x: number; y: number }

export type GlyphId =
  | 'line-v' | 'line-h' | 'circle' | 'triangle' | 'square' | 'caret' | 'v' | 'check'
  | 'z' | 'n' | 'm' | 'w' | 's' | 'c' | 'u' | 'l' | 'spiral' | 'heart' | 'infinity'
  | 'star' | 'bolt' | 'hourglass' | 'wave' | 'pigtail';

const D = Math.PI / 180;

function poly(...pts: [number, number][]): Point[] {
  return pts.map(([x, y]) => ({ x, y }));
}

/** Arc in screen space: angle grows clockwise. */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 24): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * D;
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return out;
}

function param(fn: (t: number) => Point, n = 48, t0 = 0, t1 = 1): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) out.push(fn(t0 + ((t1 - t0) * i) / n));
  return out;
}

export interface GlyphDef { id: GlyphId; label: string; points: Point[] }

export const GLYPHS: Record<GlyphId, GlyphDef> = {
  'line-v': { id: 'line-v', label: 'Down stroke', points: poly([50, 5], [50, 95]) },
  'line-h': { id: 'line-h', label: 'Side stroke', points: poly([5, 50], [95, 50]) },
  circle: { id: 'circle', label: 'Circle', points: arc(50, 50, 44, -90, 270, 48) },
  triangle: { id: 'triangle', label: 'Triangle', points: poly([50, 8], [8, 92], [92, 92], [50, 8]) },
  square: { id: 'square', label: 'Square', points: poly([10, 10], [10, 90], [90, 90], [90, 10], [10, 10]) },
  caret: { id: 'caret', label: 'Caret', points: poly([8, 90], [50, 10], [92, 90]) },
  v: { id: 'v', label: 'Vee', points: poly([8, 10], [50, 90], [92, 10]) },
  check: { id: 'check', label: 'Check', points: poly([8, 55], [38, 90], [92, 10]) },
  z: { id: 'z', label: 'Zigzag', points: poly([8, 10], [92, 10], [8, 90], [92, 90]) },
  n: { id: 'n', label: 'N shape', points: poly([8, 90], [8, 10], [92, 90], [92, 10]) },
  m: { id: 'm', label: 'M shape', points: poly([8, 90], [8, 10], [50, 62], [92, 10], [92, 90]) },
  w: { id: 'w', label: 'W shape', points: poly([8, 10], [28, 90], [50, 32], [72, 90], [92, 10]) },
  s: { id: 's', label: 'S curve', points: [...arc(50, 28, 22, -20, -270, 20), ...arc(50, 72, 22, -90, 200, 22)] },
  c: { id: 'c', label: 'C curve', points: arc(50, 50, 42, -50, -310, 30) },
  u: { id: 'u', label: 'U curve', points: [...poly([12, 8], [12, 58]), ...arc(50, 58, 38, 180, 360, 20), ...poly([88, 58], [88, 8])] },
  l: { id: 'l', label: 'L shape', points: poly([15, 8], [15, 92], [92, 92]) },
  spiral: {
    id: 'spiral', label: 'Spiral',
    points: param(t => {
      const a = (-90 + t * 720) * D; const r = 46 - 36 * t;
      return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) };
    }, 72),
  },
  heart: {
    id: 'heart', label: 'Heart',
    points: param(t => {
      const a = t * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(a), 3);
      const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
      return { x: 50 + x * 2.7, y: 52 - y * 2.7 };
    }, 56),
  },
  infinity: {
    id: 'infinity', label: 'Infinity',
    points: param(t => {
      const a = t * Math.PI * 2; const d = 1 + Math.sin(a) ** 2;
      return { x: 50 + (46 * Math.cos(a)) / d, y: 50 + (46 * 1.4 * Math.sin(a) * Math.cos(a)) / d };
    }, 56),
  },
  star: { id: 'star', label: 'Star', points: poly([50, 5], [76, 92], [7, 38], [93, 38], [24, 92], [50, 5]) },
  bolt: { id: 'bolt', label: 'Bolt', points: poly([66, 4], [34, 48], [62, 48], [34, 96]) },
  hourglass: { id: 'hourglass', label: 'Hourglass', points: poly([10, 10], [90, 10], [10, 90], [90, 90], [10, 10]) },
  wave: {
    id: 'wave', label: 'Wave',
    points: param(t => ({ x: 6 + 88 * t, y: 50 - 24 * Math.sin(t * Math.PI * 3) }), 40),
  },
  pigtail: {
    id: 'pigtail', label: 'Pigtail',
    points: param(t => {
      const th = -3.1 + 6.2 * t;
      return { x: 50 + (12 * th - 28 * Math.sin(th)) * 1.15, y: 52 + (12 - 28 * Math.cos(th)) * 1.15 };
    }, 56),
  },
};

/** Draws a glyph template into a canvas (used for HUD and shop icons). */
export function drawGlyph(ctx: CanvasRenderingContext2D, id: GlyphId, x: number, y: number, size: number, color: string, width = 3): void {
  const pts = GLYPHS[id].points;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => {
    const px = x + (p.x / 100) * size; const py = y + (p.y / 100) * size;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.stroke();
  // Start marker so the player knows where the stroke begins.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + (pts[0].x / 100) * size, y + (pts[0].y / 100) * size, width * 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

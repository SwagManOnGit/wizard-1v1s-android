// Stroke templates for every spell glyph. Coordinates live in a 0..100 box, y down.
// Templates are resampled by the recognizer, so straight segments only need their corners.
// Every glyph is a single unbroken stroke: the hard ones are hard because the *path* is intricate,
// not because they need extra taps.

export interface Point { x: number; y: number }

export type GlyphId =
  // plain shapes
  | 'line-v' | 'line-h' | 'circle' | 'triangle' | 'square' | 'deltoid' | 'keyhole'
  | 'caret' | 'v' | 'check' | 'l' | 'u' | 'c' | 's' | 'n' | 'm' | 'w' | 'z'
  // curves and hooks
  | 'spiral' | 'heart' | 'infinity' | 'star' | 'bolt' | 'hourglass' | 'wave' | 'pigtail'
  | 'crescent' | 'teardrop' | 'leaf' | 'jhook' | 'omega' | 'steps' | 'shieldshape' | 'zigzag4'
  // intricate
  | 'sqspiral' | 'trispiral' | 'dspiral' | 'coil' | 'doubleloop'
  | 'rose3' | 'rose4' | 'rose5'
  | 'star6' | 'star7' | 'star8' | 'star9'
  | 'lissajous' | 'trefoil' | 'pentacle'
  // light, earth and chrono additions
  | 'star4' | 'star7b' | 'star9b' | 'star11' | 'star12' | 'sunburst'
  | 'rose6' | 'rose7' | 'rose8'
  | 'astroid' | 'nephroid' | 'pentspiral' | 'vcoil'
  | 'lissajous43' | 'lissajous54'
  | 'tridown' | 'chalice' | 'spade' | 'key' | 'feather' | 'arrowhead'
  // mythic sigils
  | 'sigil1' | 'sigil2' | 'sigil3';

const D = Math.PI / 180;
const TAU = Math.PI * 2;

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

/** Fits a point set into the 0..100 box, preserving aspect ratio. */
function fit(pts: Point[], pad = 6): Point[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const s = (100 - pad * 2) / span;
  const ox = (100 - (maxX - minX) * s) / 2, oy = (100 - (maxY - minY) * s) / 2;
  return pts.map(p => ({ x: (p.x - minX) * s + ox, y: (p.y - minY) * s + oy }));
}

/** Star polygon {n/k}: one unbroken stroke whenever n and k share no common factor. */
function starPoly(n: number, k: number, samples = 6): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (-90 + (i * k * 360) / n) * D;
    const a1 = (-90 + ((i + 1) * k * 360) / n) * D;
    for (let j = 0; j < samples; j++) {
      const t = j / samples;
      out.push({
        x: 50 + (Math.cos(a0) * (1 - t) + Math.cos(a1) * t) * 46,
        y: 50 + (Math.sin(a0) * (1 - t) + Math.sin(a1) * t) * 46,
      });
    }
  }
  out.push({ x: 50 + Math.cos(-90 * D) * 46, y: 50 + Math.sin(-90 * D) * 46 });
  return out;
}

/** Rose curve r = cos(k*theta). Odd k draws k petals, even k draws 2k. */
function rose(k: number, turns: number, n = 120): Point[] {
  return fit(param(t => {
    const th = t * Math.PI * turns;
    const r = Math.cos(k * th);
    return { x: 50 + r * 46 * Math.cos(th), y: 50 + r * 46 * Math.sin(th) };
  }, n));
}

/** Rectangular spiral (a meander), clearly different from the round one. */
function squareSpiral(turns: number): Point[] {
  const pts: Point[] = [{ x: 50, y: 50 }];
  let x = 50, y = 50, len = 8;
  const dirs: [number, number][] = [[1, 0], [0, -1], [-1, 0], [0, 1]];
  for (let i = 0; i < turns; i++) {
    const [dx, dy] = dirs[i % 4];
    x += dx * len; y += dy * len;
    pts.push({ x, y });
    if (i % 2 === 1) len += 9;
  }
  return fit(pts);
}

/** Spiral with 120-degree turns: a triangular vortex. */
function triSpiral(turns: number): Point[] {
  const pts: Point[] = [{ x: 50, y: 50 }];
  let x = 50, y = 50, len = 10, ang = -90;
  for (let i = 0; i < turns; i++) {
    x += Math.cos(ang * D) * len; y += Math.sin(ang * D) * len;
    pts.push({ x, y });
    ang += 120; len += 7;
  }
  return fit(pts);
}

/** Classic n-point star outline: alternating outer and inner radius. */
function pointedStar(points: number, inner: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= points * 2; i++) {
    const a = (-90 + (i * 360) / (points * 2)) * D;
    const r = 46 * (i % 2 === 0 ? 1 : inner);
    out.push({ x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) });
  }
  return out;
}

/** Spiral with 72-degree turns: a five-sided vortex, clearly not the square or triangular one. */
function pentSpiral(turns: number): Point[] {
  const pts: Point[] = [{ x: 50, y: 50 }];
  let x = 50, y = 50, len = 9, ang = -90;
  for (let i = 0; i < turns; i++) {
    x += Math.cos(ang * D) * len; y += Math.sin(ang * D) * len;
    pts.push({ x, y });
    ang += 72; len += 5.5;
  }
  return fit(pts);
}

/** Hypocycloid with n cusps (n=3 is the deltoid, n=4 the astroid). */
function cusped(n: number, samples = 96): Point[] {
  return fit(param(t => {
    const a = t * TAU;
    return { x: (n - 1) * Math.cos(a) + Math.cos((n - 1) * a), y: (n - 1) * Math.sin(a) - Math.sin((n - 1) * a) };
  }, samples));
}

function lissajousCurve(a: number, b: number, phase: number): Point[] {
  return fit(param(t => {
    const u = t * TAU;
    return { x: 50 + 46 * Math.sin(a * u), y: 50 + 46 * Math.sin(b * u + phase) };
  }, 140));
}

export interface GlyphDef { id: GlyphId; label: string; points: Point[] }

export const GLYPHS: Record<GlyphId, GlyphDef> = {
  // ---- plain shapes -------------------------------------------------------------
  'line-v': { id: 'line-v', label: 'Down stroke', points: poly([50, 5], [50, 95]) },
  'line-h': { id: 'line-h', label: 'Side stroke', points: poly([5, 50], [95, 50]) },
  circle: { id: 'circle', label: 'Circle', points: arc(50, 50, 44, -90, 270, 48) },
  triangle: { id: 'triangle', label: 'Triangle', points: poly([50, 8], [8, 92], [92, 92], [50, 8]) },
  square: { id: 'square', label: 'Square', points: poly([10, 10], [10, 90], [90, 90], [90, 10], [10, 10]) },
  // A three-cusped deltoid: unmistakably not a circle or a square, unlike the diamond it replaced.
  deltoid: {
    id: 'deltoid', label: 'Three-cusp arch',
    points: fit(param(t => { const a = t * TAU; return { x: 2 * Math.cos(a) + Math.cos(2 * a), y: 2 * Math.sin(a) - Math.sin(2 * a) }; }, 72)),
  },
  keyhole: {
    id: 'keyhole', label: 'Keyhole',
    points: fit([...arc(50, 34, 26, -90, 270, 30), ...poly([50, 60], [50, 96])]),
  },
  caret: { id: 'caret', label: 'Caret', points: poly([8, 90], [50, 10], [92, 90]) },
  v: { id: 'v', label: 'Vee', points: poly([8, 10], [50, 90], [92, 10]) },
  check: { id: 'check', label: 'Check', points: poly([8, 55], [38, 90], [92, 10]) },
  l: { id: 'l', label: 'L shape', points: poly([15, 8], [15, 92], [92, 92]) },
  u: { id: 'u', label: 'U curve', points: [...poly([12, 8], [12, 58]), ...arc(50, 58, 38, 180, 360, 20), ...poly([88, 58], [88, 8])] },
  c: { id: 'c', label: 'C curve', points: arc(50, 50, 42, -50, -310, 30) },
  s: { id: 's', label: 'S curve', points: [...arc(50, 28, 22, -20, -270, 20), ...arc(50, 72, 22, -90, 200, 22)] },
  n: { id: 'n', label: 'N shape', points: poly([8, 90], [8, 10], [92, 90], [92, 10]) },
  m: { id: 'm', label: 'M shape', points: poly([8, 90], [8, 10], [50, 62], [92, 10], [92, 90]) },
  w: { id: 'w', label: 'W shape', points: poly([8, 10], [28, 90], [50, 32], [72, 90], [92, 10]) },
  z: { id: 'z', label: 'Zigzag', points: poly([8, 10], [92, 10], [8, 90], [92, 90]) },

  // ---- curves and hooks ---------------------------------------------------------
  spiral: {
    id: 'spiral', label: 'Spiral',
    points: param(t => { const a = (-90 + t * 720) * D; const r = 46 - 36 * t; return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) }; }, 72),
  },
  heart: {
    id: 'heart', label: 'Heart',
    points: param(t => {
      const a = t * TAU;
      const x = 16 * Math.pow(Math.sin(a), 3);
      const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
      return { x: 50 + x * 2.7, y: 52 - y * 2.7 };
    }, 56),
  },
  infinity: {
    id: 'infinity', label: 'Infinity',
    points: param(t => { const a = t * TAU; const d = 1 + Math.sin(a) ** 2; return { x: 50 + (46 * Math.cos(a)) / d, y: 50 + (46 * 1.4 * Math.sin(a) * Math.cos(a)) / d }; }, 56),
  },
  star: { id: 'star', label: 'Five-point star', points: starPoly(5, 2) },
  // Wide on purpose: a narrow bolt normalises into something close to a plain down stroke.
  bolt: { id: 'bolt', label: 'Bolt', points: poly([84, 4], [16, 44], [72, 56], [8, 96]) },
  hourglass: { id: 'hourglass', label: 'Hourglass', points: poly([10, 10], [90, 10], [10, 90], [90, 90], [10, 10]) },
  wave: { id: 'wave', label: 'Wave', points: param(t => ({ x: 6 + 88 * t, y: 50 - 24 * Math.sin(t * Math.PI * 3) }), 40) },
  pigtail: {
    id: 'pigtail', label: 'Pigtail',
    points: param(t => { const th = -3.1 + 6.2 * t; return { x: 50 + (12 * th - 28 * Math.sin(th)) * 1.15, y: 52 + (12 - 28 * Math.cos(th)) * 1.15 }; }, 56),
  },
  crescent: {
    id: 'crescent', label: 'Crescent',
    points: fit([...arc(50, 50, 44, -80, 80, 26), ...arc(26, 50, 48, 62, -62, 26)]),
  },
  teardrop: {
    id: 'teardrop', label: 'Teardrop',
    points: fit([...poly([50, 4]), ...arc(50, 62, 34, -122, 180, 30), ...arc(50, 62, 34, 180, 302, 6), ...poly([50, 4])]),
  },
  leaf: {
    id: 'leaf', label: 'Leaf',
    points: fit([...arc(80, 80, 74, -125, -55, 24), ...arc(20, 20, 74, 55, 125, 24)]),
  },
  jhook: { id: 'jhook', label: 'Hook', points: fit([...poly([74, 6], [74, 58]), ...arc(46, 58, 28, 0, 200, 24)]) },
  omega: {
    id: 'omega', label: 'Omega',
    points: fit([...poly([20, 92], [36, 92]), ...arc(50, 52, 34, 125, -305, 32), ...poly([64, 92], [80, 92])]),
  },
  steps: { id: 'steps', label: 'Steps', points: poly([8, 92], [8, 66], [36, 66], [36, 42], [64, 42], [64, 18], [92, 18]) },
  shieldshape: {
    id: 'shieldshape', label: 'Shield',
    points: fit([...poly([14, 14], [86, 14]), ...param(t => ({ x: 86 - 36 * t * t, y: 14 + 78 * t }), 16), ...param(t => ({ x: 14 + 36 * t * t, y: 92 - 78 * t }), 16)]),
  },
  zigzag4: { id: 'zigzag4', label: 'Four-fold zigzag', points: poly([6, 20], [94, 20], [6, 47], [94, 47], [6, 74], [94, 74]) },

  // ---- intricate ----------------------------------------------------------------
  sqspiral: { id: 'sqspiral', label: 'Meander', points: squareSpiral(9) },
  trispiral: { id: 'trispiral', label: 'Triangular vortex', points: triSpiral(9) },
  dspiral: {
    id: 'dspiral', label: 'Twin spiral',
    points: fit([
      ...param(t => { const a = (180 + t * 540) * D; const r = 4 + 22 * t; return { x: 28 + r * Math.cos(a), y: 50 + r * Math.sin(a) }; }, 44),
      ...param(t => { const a = (0 - t * 540) * D; const r = 26 - 22 * t; return { x: 72 + r * Math.cos(a), y: 50 + r * Math.sin(a) }; }, 44),
    ]),
  },
  coil: {
    id: 'coil', label: 'Coil',
    points: fit(param(t => { const a = t * TAU * 4; return { x: 8 + 84 * t + 9 * Math.cos(a), y: 50 + 16 * Math.sin(a) }; }, 96)),
  },
  doubleloop: {
    id: 'doubleloop', label: 'Twin loop',
    points: fit(param(t => { const a = t * TAU; return { x: 50 + 26 * Math.sin(2 * a), y: 50 - 44 * Math.cos(a) }; }, 72)),
  },
  rose3: { id: 'rose3', label: 'Trefoil bloom', points: rose(3, 1) },
  rose4: { id: 'rose4', label: 'Quatrefoil bloom', points: rose(2, 2) },
  rose5: { id: 'rose5', label: 'Cinquefoil bloom', points: rose(5, 1, 150) },
  star6: { id: 'star6', label: 'Six-point star', points: pointedStar(6, 0.40) },
  star7: { id: 'star7', label: 'Heptagram', points: starPoly(7, 3) },
  star8: { id: 'star8', label: 'Octagram', points: starPoly(8, 3) },
  star9: { id: 'star9', label: 'Enneagram', points: starPoly(9, 4) },
  lissajous: {
    id: 'lissajous', label: 'Lissajous knot',
    points: fit(param(t => { const a = t * TAU; return { x: 50 + 46 * Math.sin(3 * a), y: 50 + 46 * Math.sin(2 * a + Math.PI / 4) }; }, 120)),
  },
  trefoil: {
    id: 'trefoil', label: 'Trefoil knot',
    points: fit(param(t => { const a = t * TAU; return { x: Math.sin(a) + 2 * Math.sin(2 * a), y: Math.cos(a) - 2 * Math.cos(2 * a) }; }, 120)),
  },
  pentacle: {
    id: 'pentacle', label: 'Sealed star',
    points: fit([...starPoly(5, 2, 5), ...arc(50, 50, 46, -90, 270, 40)]),
  },

  // ---- light, earth and chrono --------------------------------------------------
  star4: { id: 'star4', label: 'Four-point star', points: pointedStar(4, 0.34) },
  sunburst: { id: 'sunburst', label: 'Sunburst', points: pointedStar(8, 0.46) },
  star7b: { id: 'star7b', label: 'Wide heptagram', points: starPoly(7, 2) },
  star9b: { id: 'star9b', label: 'Wide enneagram', points: starPoly(9, 2) },
  star11: { id: 'star11', label: 'Hendecagram', points: starPoly(11, 3) },
  star12: { id: 'star12', label: 'Dodecagram', points: starPoly(12, 5) },
  rose6: { id: 'rose6', label: 'Six-petal bloom', points: rose(3, 2) },
  rose7: { id: 'rose7', label: 'Seven-petal bloom', points: rose(7, 1, 160) },
  rose8: { id: 'rose8', label: 'Eight-petal bloom', points: rose(4, 2, 160) },
  astroid: { id: 'astroid', label: 'Four-cusp arch', points: cusped(4) },
  nephroid: { id: 'nephroid', label: 'Twin-cusp arch', points: fit(param(t => { const a = t * TAU; return { x: 3 * Math.cos(a) - Math.cos(3 * a), y: 3 * Math.sin(a) - Math.sin(3 * a) }; }, 80)) },
  pentspiral: { id: 'pentspiral', label: 'Five-sided vortex', points: pentSpiral(11) },
  vcoil: { id: 'vcoil', label: 'Upright coil', points: fit(param(t => { const a = t * TAU * 4; return { x: 50 + 16 * Math.sin(a), y: 8 + 84 * t + 9 * Math.cos(a) }; }, 96)) },
  lissajous43: { id: 'lissajous43', label: 'Four-three knot', points: lissajousCurve(4, 3, Math.PI / 3) },
  lissajous54: { id: 'lissajous54', label: 'Five-four knot', points: lissajousCurve(5, 4, Math.PI / 6) },
  tridown: { id: 'tridown', label: 'Inverted triangle', points: poly([8, 10], [92, 10], [50, 94], [8, 10]) },
  chalice: {
    id: 'chalice', label: 'Chalice',
    points: fit([...poly([16, 8]), ...arc(50, 12, 34, 180, 360, 22), ...poly([84, 8], [84, 12]), ...poly([54, 58], [54, 84], [80, 90]), ...poly([20, 90], [46, 84], [46, 58])]),
  },
  spade: {
    id: 'spade', label: 'Spade',
    points: fit([...poly([50, 4]), ...arc(72, 42, 28, -122, 100, 22), ...arc(28, 42, 28, 80, -58, 22), ...poly([50, 4])]),
  },
  key: {
    id: 'key', label: 'Key',
    points: fit([...arc(50, 22, 18, -90, 270, 22), ...poly([50, 40], [50, 94], [76, 94], [50, 78], [70, 78])]),
  },
  feather: {
    id: 'feather', label: 'Feather',
    points: fit([...poly([82, 6], [22, 92]), ...param(t => ({ x: 22 + 60 * t, y: 92 - 86 * t * t }), 26)]),
  },
  arrowhead: { id: 'arrowhead', label: 'Arrowhead', points: poly([12, 88], [50, 6], [88, 88], [50, 62], [12, 88]) },

  // ---- mythic sigils ------------------------------------------------------------
  // Invented paths: long, asymmetric, and unlike anything a player draws by accident.
  sigil1: {
    id: 'sigil1', label: 'Rime sigil',
    points: fit([
      ...poly([50, 4], [50, 44]),
      ...arc(50, 44, 26, -90, 210, 26),
      ...poly([50 + 26 * Math.cos(210 * D), 44 + 26 * Math.sin(210 * D)], [10, 92], [90, 92], [64, 60]),
    ]),
  },
  sigil2: {
    id: 'sigil2', label: 'Umbral sigil',
    points: fit([
      ...arc(38, 38, 30, 90, -180, 26),
      ...poly([38, 8], [86, 46]),
      ...arc(62, 66, 26, -55, 235, 28),
      ...poly([36, 78], [12, 96]),
    ]),
  },
  sigil3: {
    id: 'sigil3', label: 'Eternity sigil',
    points: fit([
      ...param(t => { const a = (-90 + t * 900) * D; const r = 8 + 26 * t; return { x: 40 + r * Math.cos(a), y: 46 + r * Math.sin(a) }; }, 60),
      ...poly([78, 74], [96, 30], [58, 12]),
    ]),
  },
};

export const ALL_GLYPH_IDS = Object.keys(GLYPHS) as GlyphId[];

/**
 * The stroke a spell demands. Direction is part of the requirement: the same shape drawn the other
 * way round is a different glyph, which is why one template can carry two spells.
 */
export function glyphStroke(id: GlyphId, reverse = false): Point[] {
  const pts = GLYPHS[id].points;
  return reverse ? [...pts].reverse() : pts;
}

/** Cumulative length along a polyline, used to space the direction arrows evenly. */
function walk(pts: Point[], target: number): { p: Point; dx: number; dy: number } {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) continue;
    if (acc + d >= target) {
      const t = (target - acc) / d;
      return { p: { x: pts[i - 1].x + dx * t, y: pts[i - 1].y + dy * t }, dx: dx / d, dy: dy / d };
    }
    acc += d;
  }
  const n = pts.length - 1;
  const dx = pts[n].x - pts[n - 1].x, dy = pts[n].y - pts[n - 1].y;
  const d = Math.max(1e-6, Math.hypot(dx, dy));
  return { p: pts[n], dx: dx / d, dy: dy / d };
}

/**
 * Draws a glyph template into a canvas (HUD, spellbook and shop icons), with a dot on the starting
 * point and small arrowheads along the path: everything the player needs to know which way to move.
 */
export function drawGlyph(ctx: CanvasRenderingContext2D, id: GlyphId, x: number, y: number, size: number, color: string, width = 3, reverse = false): void {
  const pts = glyphStroke(id, reverse).map(p => ({ x: x + (p.x / 100) * size, y: y + (p.y / 100) * size }));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
  ctx.stroke();

  ctx.fillStyle = color;
  // Start marker so the player knows where the stroke begins.
  ctx.beginPath();
  ctx.arc(pts[0].x, pts[0].y, width * 1.1, 0, Math.PI * 2);
  ctx.fill();

  // Direction arrows. Tiny icons only have room for two.
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const marks = size < 26 ? [0.4, 0.8] : [0.28, 0.56, 0.86];
  const a = Math.max(2.2, size * 0.1);
  for (const f of marks) {
    const { p, dx, dy } = walk(pts, total * f);
    ctx.beginPath();
    ctx.moveTo(p.x + dx * a, p.y + dy * a);
    ctx.lineTo(p.x - dx * a * 0.55 - dy * a * 0.75, p.y - dy * a * 0.55 + dx * a * 0.75);
    ctx.lineTo(p.x - dx * a * 0.55 + dy * a * 0.75, p.y - dy * a * 0.55 - dx * a * 0.75);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

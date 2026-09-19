// The ground under the level map. One biome per chapter of fifty levels, painted at a fifth of the
// screen's resolution and scaled up with image-rendering: pixelated, so a whole chapter of terrain
// costs about as much memory as a single icon.
//
// Every painter draws into a canvas whose width is the map's width and whose height is one
// chapter's worth of trail. The trail itself is drawn on top by drawTrail, from the same node
// positions the DOM buttons use, so the path and the buttons can never drift apart.
import { TIERS } from '@wizard/shared';

/** CSS pixels per canvas pixel. Five is chunky enough to read as pixel art at any phone width. */
export const TERRAIN_SCALE = 5;

function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type G = CanvasRenderingContext2D;
type Painter = (g: G, w: number, h: number, rnd: () => number, c: Chapter) => void;

interface Chapter { ground: string; dark: string; light: string; accent: string; trail: string; trailEdge: string }

/**
 * Each chapter's palette. The ground follows the tier it belongs to, so the map and the arena a
 * player is about to fight in are recognisably the same place.
 */
export function chapterPalette(chapter: number): Chapter {
  const t = TIERS[Math.min(TIERS.length - 1, chapter)];
  const PALETTES: Chapter[] = [
    { ground: '#3f7a3a', dark: '#2c5c2a', light: '#5a9a4e', accent: '#8ad06a', trail: '#c9a86a', trailEdge: '#8a6a3a' },
    { ground: '#2f5a33', dark: '#1e3f24', light: '#417a44', accent: '#7ac06a', trail: '#8a6a42', trailEdge: '#5a4228' },
    { ground: '#4a2218', dark: '#2e140e', light: '#6a3020', accent: '#ff7a2a', trail: '#7a4a2a', trailEdge: '#4a2a16' },
    { ground: '#4a6a8a', dark: '#31506e', light: '#6e92b4', accent: '#d8f4ff', trail: '#cfe4f2', trailEdge: '#7a9ab4' },
    { ground: '#3a3a6a', dark: '#26264a', light: '#52528e', accent: '#ffe066', trail: '#9a9ac4', trailEdge: '#5a5a8a' },
    { ground: '#273a2c', dark: '#16261b', light: '#38543e', accent: '#9affb0', trail: '#5a5a48', trailEdge: '#343428' },
    { ground: '#5a2a5a', dark: '#3c1a3c', light: '#7c3e7c', accent: '#ff8ff2', trail: '#d0a0d8', trailEdge: '#7a4a86' },
    { ground: '#4a1a24', dark: '#2e0e16', light: '#6a2a36', accent: '#ff5a6a', trail: '#8a4a4a', trailEdge: '#52282c' },
    { ground: '#1a1030', dark: '#0e0820', light: '#2a1c4a', accent: '#b04dff', trail: '#4a3a7a', trailEdge: '#2a2048' },
    { ground: '#4a3a16', dark: '#2e240c', light: '#6a5424', accent: '#ffe066', trail: '#d0a030', trailEdge: '#8a6a1c' },
  ];
  const p = PALETTES[Math.min(PALETTES.length - 1, chapter)];
  return { ...p, accent: chapter === 0 ? p.accent : t.spell ?? p.accent };
}

// ---- small shapes the painters share -------------------------------------------------

function speckle(g: G, w: number, h: number, rnd: () => number, colors: string[], n: number, size = 1): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(rnd() * colors.length)];
    g.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), size, size);
  }
}

function blob(g: G, x: number, y: number, r: number, color: string): void {
  g.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    g.fillRect(x - dx, y + dy, dx * 2 + 1, 1);
  }
}

function tree(g: G, x: number, y: number, s: number, trunk: string, leaf: string, dark: string): void {
  g.fillStyle = trunk;
  g.fillRect(x - 1, y - s, 2, s);
  for (let i = 0; i < 3; i++) {
    const r = s * 0.6 - i * s * 0.16;
    blob(g, x, y - s - i * s * 0.42, Math.max(1, Math.round(r)), i === 0 ? dark : leaf);
  }
}

function crystal(g: G, x: number, y: number, s: number, color: string, edge: string): void {
  g.fillStyle = edge;
  g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.5, y - s * 0.4); g.lineTo(x + s * 0.4, y); g.lineTo(x - s * 0.4, y);
  g.lineTo(x - s * 0.5, y - s * 0.4); g.closePath(); g.fill();
  g.fillStyle = color;
  g.beginPath(); g.moveTo(x, y - s + 1); g.lineTo(x + s * 0.28, y - s * 0.4); g.lineTo(x, y - 1); g.closePath(); g.fill();
}

function rock(g: G, x: number, y: number, s: number, color: string, light: string): void {
  g.fillStyle = color;
  g.fillRect(x - s, y - s * 0.7, s * 2, s * 0.7 + 1);
  g.fillRect(x - s * 0.6, y - s, s * 1.2, s * 0.4);
  g.fillStyle = light;
  g.fillRect(x - s * 0.5, y - s + 1, s * 0.5, 1);
}

// ---- the ten biomes ------------------------------------------------------------------

const BIOMES: Painter[] = [
  // Apprentice meadow: grass tufts and a few boulders.
  (g, w, h, rnd, c) => {
    speckle(g, w, h, rnd, [c.light, c.dark], Math.round(w * h * 0.05));
    for (let i = 0; i < h / 22; i++) {
      const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h);
      g.fillStyle = c.accent;
      g.fillRect(x, y, 1, 2); g.fillRect(x + 2, y - 1, 1, 3); g.fillRect(x + 4, y, 1, 2);
    }
    for (let i = 0; i < h / 70; i++) rock(g, Math.floor(rnd() * w), Math.floor(rnd() * h), 3, c.dark, c.light);
  },
  // Hedge forest: a canopy of overlapping trees.
  (g, w, h, rnd, c) => {
    speckle(g, w, h, rnd, [c.dark, c.light], Math.round(w * h * 0.06));
    for (let i = 0; i < h / 16; i++) {
      tree(g, Math.floor(rnd() * w), Math.floor(rnd() * h), 5 + Math.floor(rnd() * 4), '#4a3218', c.light, c.dark);
    }
  },
  // Pyromancer: cracked basalt with lava in the seams.
  (g, w, h, rnd, c) => {
    speckle(g, w, h, rnd, [c.dark, c.light], Math.round(w * h * 0.07));
    for (let i = 0; i < h / 12; i++) {
      let x = Math.floor(rnd() * w), y = Math.floor(rnd() * h);
      g.fillStyle = rnd() > 0.4 ? c.accent : '#ffd23f';
      for (let k = 0; k < 6 + rnd() * 8; k++) {
        g.fillRect(x, y, 1, 1);
        x += Math.round(rnd() * 2 - 1); y += 1;
      }
    }
    for (let i = 0; i < h / 60; i++) rock(g, Math.floor(rnd() * w), Math.floor(rnd() * h), 4, '#1d0f0a', c.light);
  },
  // Frost: drifts of snow and shards of ice.
  (g, w, h, rnd, c) => {
    speckle(g, w, h, rnd, [c.light, '#e8f6ff'], Math.round(w * h * 0.06));
    for (let i = 0; i < h / 30; i++) blob(g, Math.floor(rnd() * w), Math.floor(rnd() * h), 3 + Math.floor(rnd() * 4), '#dfeefc');
    for (let i = 0; i < h / 26; i++) crystal(g, Math.floor(rnd() * w), Math.floor(rnd() * h), 5 + Math.floor(rnd() * 4), '#ffffff', c.accent);
  },
  // Storm plateau: cloud banks, and lightning between them.
  (g, w, h, rnd, c) => {
    speckle(g, w, h, rnd, [c.dark, c.light], Math.round(w * h * 0.04));
    for (let i = 0; i < h / 24; i++) {
      const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h), s = 3 + Math.floor(rnd() * 3);
      blob(g, x, y, s, c.light); blob(g, x + s, y + 1, Math.max(2, s - 1), c.light); blob(g, x - s, y + 1, Math.max(2, s - 1), c.dark);
    }
    for (let i = 0; i < h / 90; i++) {
      let x = Math.floor(rnd() * w), y = Math.floor(rnd() * h);
      g.fillStyle = c.accent;
      for (let k = 0; k < 7; k++) { g.fillRect(x, y + k, 1, 1); x += k % 2 ? 1 : -1; }
    }
  },
  // Necromancer bog: still water, reeds and bones.
  (g, w, h, rnd, c) => {
    speckle(g, w, h, rnd, [c.dark, c.light], Math.round(w * h * 0.05));
    for (let i = 0; i < h / 28; i++) {
      const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h);
      blob(g, x, y, 3 + Math.floor(rnd() * 3), c.dark);
      g.fillStyle = c.accent; g.fillRect(x - 1, y - 1, 1, 1);
    }
    for (let i = 0; i < h / 40; i++) {
      const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h);
      g.fillStyle = '#d8d4c0';
      g.fillRect(x, y, 1, 4); g.fillRect(x - 1, y, 3, 1); g.fillRect(x - 1, y + 3, 3, 1);
    }
  },
  // Illusionist: a mirror floor and standing prisms.
  (g, w, h, rnd, c) => {
    for (let y = 0; y < h; y += 6) { g.fillStyle = y % 12 ? c.dark : c.light; g.fillRect(0, y, w, 3); }
    speckle(g, w, h, rnd, [c.accent, '#ffffff'], Math.round(w * h * 0.02));
    for (let i = 0; i < h / 22; i++) crystal(g, Math.floor(rnd() * w), Math.floor(rnd() * h), 6 + Math.floor(rnd() * 5), '#ffffff', c.accent);
  },
  // Warlock: thorn scrub over red clay.
  (g, w, h, rnd, c) => {
    speckle(g, w, h, rnd, [c.dark, c.light], Math.round(w * h * 0.07));
    for (let i = 0; i < h / 18; i++) {
      const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h);
      g.fillStyle = '#2a1016';
      for (let k = 0; k < 5; k++) g.fillRect(x + k, y - k, 1, 1);
      g.fillStyle = c.accent; g.fillRect(x + 5, y - 5, 1, 1);
    }
    for (let i = 0; i < h / 70; i++) rock(g, Math.floor(rnd() * w), Math.floor(rnd() * h), 4, c.dark, c.light);
  },
  // Void: nothing, and stars in it.
  (g, w, h, rnd, c) => {
    speckle(g, w, h, rnd, ['#ffffff', c.accent, c.light], Math.round(w * h * 0.03));
    for (let i = 0; i < h / 40; i++) {
      const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h);
      g.fillStyle = c.accent;
      g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5);
    }
    for (let i = 0; i < h / 90; i++) blob(g, Math.floor(rnd() * w), Math.floor(rnd() * h), 4 + Math.floor(rnd() * 5), c.light);
  },
  // Archmage sanctum: a tiled gold floor and broken pillars.
  (g, w, h, rnd, c) => {
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
      g.fillStyle = ((x / 8 + y / 8) % 2) ? c.dark : c.light;
      g.fillRect(x, y, 8, 8);
    }
    speckle(g, w, h, rnd, [c.accent], Math.round(w * h * 0.012));
    for (let i = 0; i < h / 34; i++) {
      const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h), s = 8 + Math.floor(rnd() * 10);
      g.fillStyle = '#d8cfae'; g.fillRect(x - 2, y - s, 5, s);
      g.fillStyle = c.accent; g.fillRect(x - 3, y - s - 2, 7, 2);
    }
  },
];

/** Fills a chapter's canvas with its biome. Deterministic: the same chapter is the same place. */
export function paintTerrain(g: G, w: number, h: number, chapter: number): void {
  const c = chapterPalette(chapter);
  g.imageSmoothingEnabled = false;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, c.dark);
  grad.addColorStop(0.5, c.ground);
  grad.addColorStop(1, c.dark);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  BIOMES[Math.min(BIOMES.length - 1, chapter)](g, w, h, mulberry(1337 + chapter * 7919), c);
}

/**
 * The trail, drawn through the node positions of this chapter. Two passes: a wide dark edge and a
 * narrower fill, which is what makes a flat line read as a worn path rather than a stroke.
 */
export function drawTrail(g: G, points: { x: number; y: number }[], chapter: number): void {
  if (points.length < 2) return;
  const c = chapterPalette(chapter);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const [color, width] of [[c.trailEdge, 7], [c.trail, 4]] as const) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1], p = points[i];
      g.quadraticCurveTo(prev.x, (prev.y + p.y) / 2, p.x, p.y);
    }
    g.stroke();
  }
}

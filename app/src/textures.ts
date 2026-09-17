// Procedural 64x64 textures for the PS2-style look: chunky, nearest-filtered, tiled by world-space UVs.
import * as THREE from 'three';

type Painter = (g: CanvasRenderingContext2D, s: number, rnd: () => number) => void;

function mulberry(seed: number): () => number {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function noise(g: CanvasRenderingContext2D, s: number, rnd: () => number, amount: number, cell = 1): void {
  for (let y = 0; y < s; y += cell) for (let x = 0; x < s; x += cell) {
    const v = (rnd() - 0.5) * amount;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    g.fillRect(x, y, cell, cell);
  }
}

const PAINTERS: Record<string, Painter> = {
  stone(g, s, rnd) {
    g.fillStyle = '#9a9aa8'; g.fillRect(0, 0, s, s);
    noise(g, s, rnd, 0.35, 2);
    // Two rows of blocks, offset like masonry.
    g.fillStyle = 'rgba(20,16,30,0.75)';
    for (let row = 0; row < 2; row++) {
      const y = row * (s / 2);
      g.fillRect(0, y, s, 2);
      const off = row ? s / 4 : 0;
      for (let k = 0; k < 2; k++) g.fillRect((off + k * (s / 2)) % s, y, 2, s / 2);
    }
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let row = 0; row < 2; row++) g.fillRect(0, row * (s / 2) + 2, s, 1);
  },
  wood(g, s, rnd) {
    g.fillStyle = '#8a5a30'; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 3) { g.fillStyle = `rgba(0,0,0,${0.1 + rnd() * 0.25})`; g.fillRect(x, 0, 1 + Math.floor(rnd() * 2), s); }
    noise(g, s, rnd, 0.2, 2);
  },
  cloth(g, s, rnd) {
    g.fillStyle = '#d4d4e6'; g.fillRect(0, 0, s, s);
    noise(g, s, rnd, 0.2, 2);
    g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,0.12)';
    for (let d = -s; d < s; d += 6) { g.beginPath(); g.moveTo(d, 0); g.lineTo(d + s, s); g.stroke(); }
    // Gold-ish embroidered band.
    g.fillStyle = 'rgba(255,220,120,0.35)'; g.fillRect(0, s * 0.72, s, 3);
    g.fillRect(0, s * 0.8, s, 1);
  },
  gold(g, s, rnd) {
    g.fillStyle = '#e0b040'; g.fillRect(0, 0, s, s);
    noise(g, s, rnd, 0.3, 2);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, s, 2);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, s - 2, s, 2);
  },
  skin(g, s, rnd) {
    g.fillStyle = '#e8c39e'; g.fillRect(0, 0, s, s);
    noise(g, s, rnd, 0.12, 2);
  },
  beard(g, s, rnd) {
    g.fillStyle = '#e8e8e4'; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 2) { g.fillStyle = `rgba(120,120,140,${rnd() * 0.5})`; g.fillRect(x, 0, 1, s); }
  },
  metal(g, s, rnd) {
    g.fillStyle = '#6c6c78'; g.fillRect(0, 0, s, s);
    noise(g, s, rnd, 0.25, 2);
    g.fillStyle = 'rgba(255,255,255,0.2)'; for (let y = 0; y < s; y += 8) g.fillRect(0, y, s, 1);
  },
  roof(g, s, rnd) {
    g.fillStyle = '#a03040'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 8) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, y, s, 2); for (let x = (y / 8) % 2 ? 8 : 0; x < s; x += 16) g.fillRect(x, y, 2, 8); }
    noise(g, s, rnd, 0.15, 2);
  },
  grass(g, s, rnd) {
    g.fillStyle = '#4f9a3a'; g.fillRect(0, 0, s, s);
    noise(g, s, rnd, 0.3, 2);
    for (let i = 0; i < 90; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(170,240,110,0.6)' : 'rgba(20,70,20,0.5)'; const x = rnd() * s, y = rnd() * s; g.fillRect(x, y, 1, 2 + rnd() * 3); }
  },
  dirt(g, s, rnd) {
    g.fillStyle = '#8a6a44'; g.fillRect(0, 0, s, s);
    noise(g, s, rnd, 0.3, 3);
    for (let i = 0; i < 20; i++) { g.fillStyle = 'rgba(60,40,20,0.5)'; g.fillRect(rnd() * s, rnd() * s, 3 + rnd() * 5, 2 + rnd() * 3); }
  },
  leaf(g, s, rnd) {
    g.fillStyle = '#2f7a34'; g.fillRect(0, 0, s, s);
    noise(g, s, rnd, 0.4, 4);
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(150,230,90,0.45)'; g.fillRect(rnd() * s, rnd() * s, 3, 3); }
  },
  obsidian(g, s, rnd) {
    g.fillStyle = '#2a1e3a'; g.fillRect(0, 0, s, s);
    noise(g, s, rnd, 0.25, 2);
    g.fillStyle = 'rgba(120,80,200,0.35)';
    for (let i = 0; i < 8; i++) { const x = rnd() * s, y = rnd() * s; g.fillRect(x, y, 1, 6 + rnd() * 14); }
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(0, s / 2, s, 2); g.fillRect(s / 2, 0, 2, s / 2); g.fillRect(s / 4, s / 2, 2, s / 2);
  },
  lava(g, s, rnd) {
    g.fillStyle = '#ff6a1a'; g.fillRect(0, 0, s, s);
    noise(g, s, rnd, 0.35, 3);
    g.fillStyle = 'rgba(40,0,0,0.85)';
    for (let i = 0; i < 12; i++) { const x = rnd() * s, y = rnd() * s, w = 4 + rnd() * 14; if (rnd() < 0.5) g.fillRect(x, y, w, 2); else g.fillRect(x, y, 2, w); }
    for (let i = 0; i < 16; i++) { g.fillStyle = 'rgba(255,240,140,0.7)'; g.fillRect(rnd() * s, rnd() * s, 2, 2); }
  },
  crystal(g, s, rnd) {
    g.fillStyle = '#6af2ff'; g.fillRect(0, 0, s, s);
    noise(g, s, rnd, 0.3, 4);
    g.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 6; i++) g.fillRect(rnd() * s, 0, 2, s);
  },
  bone(g, s, rnd) {
    g.fillStyle = '#e6dcc0'; g.fillRect(0, 0, s, s);
    noise(g, s, rnd, 0.2, 3);
  },
  banner(g, s, rnd) {
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, s, s);
    noise(g, s, rnd, 0.15, 2);
    g.fillStyle = 'rgba(255,230,140,0.85)';
    // Simple heraldic diamond.
    g.beginPath(); g.moveTo(s / 2, s * 0.25); g.lineTo(s * 0.72, s / 2); g.lineTo(s / 2, s * 0.75); g.lineTo(s * 0.28, s / 2); g.closePath(); g.fill();
    g.fillRect(0, s * 0.06, s, 2); g.fillRect(0, s * 0.92, s, 2);
  },
};

const cache = new Map<string, THREE.Texture>();

export function texture(kind: string, repeat = 1): THREE.Texture {
  const key = `${kind}:${repeat}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  (PAINTERS[kind] ?? PAINTERS.stone)(g, s, mulberry(kind.length * 977 + 13));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 1;
  cache.set(key, t);
  return t;
}

/** Which texture each named GLB material gets. */
export const MATERIAL_TEXTURE: Record<string, string> = {
  Robe: 'cloth', Hat: 'cloth', Cape: 'cloth', Trim: 'gold', Skin: 'skin', Beard: 'beard', Wood: 'wood', Dark: 'skin',
  Stone: 'stone', StoneDark: 'stone', StoneLight: 'stone', Metal: 'metal', Gold: 'gold', Roof: 'roof', Banner: 'banner',
  Grass: 'grass', Dirt: 'dirt', Bark: 'wood', Leaf: 'leaf', Rock: 'stone', Obsidian: 'obsidian', Lava: 'lava', Crystal: 'crystal', Bone: 'bone',
};

/** Materials that glow on their own (rendered unlit). */
export const UNLIT_MATERIALS = new Set(['Flame', 'Lava', 'Crystal']);

// Pixel-art emblems for gear and upgrades: painted small on canvas and scaled up with crisp edges.
import type { EquipSlot } from '@wizard/shared';

export const TIER_COLORS = ['#c98b4a', '#d8dce8', '#ffd23f', '#c77dff', '#ff7a3d'];   // bronze, silver, gold, arcane, legendary
/** Internal pixel size of every emblem; CSS scales it up with image-rendering: pixelated. */
export const ICON_PX = 24;

type Painter = (g: CanvasRenderingContext2D, s: number, c: string) => void;

function stroke(g: CanvasRenderingContext2D, c: string, w: number): void {
  g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'butt'; g.lineJoin = 'miter';
}

function star(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, n = 4): void {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i * Math.PI) / n - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.4;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
}

const GEAR: Record<EquipSlot, Painter> = {
  wand(g, s, c) {
    stroke(g, '#8a5a2a', s * 0.1);
    g.beginPath(); g.moveTo(s * 0.25, s * 0.78); g.lineTo(s * 0.66, s * 0.36); g.stroke();
    g.fillStyle = c; star(g, s * 0.7, s * 0.3, s * 0.18, 4); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(s * 0.66, s * 0.26, s * 0.08, s * 0.08);
  },
  robe(g, s, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.18); g.lineTo(s * 0.34, s * 0.26); g.lineTo(s * 0.2, s * 0.44); g.lineTo(s * 0.28, s * 0.52);
    g.lineTo(s * 0.24, s * 0.84); g.lineTo(s * 0.76, s * 0.84); g.lineTo(s * 0.72, s * 0.52); g.lineTo(s * 0.8, s * 0.44);
    g.lineTo(s * 0.66, s * 0.26); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(s * 0.47, s * 0.26, s * 0.06, s * 0.56);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(s * 0.38, s * 0.22, s * 0.08, s * 0.1);
  },
  charm(g, s, c) {
    stroke(g, '#ffd23f', s * 0.07);
    g.beginPath(); g.moveTo(s * 0.32, s * 0.2); g.lineTo(s * 0.5, s * 0.08); g.lineTo(s * 0.68, s * 0.2); g.lineTo(s * 0.5, s * 0.38); g.closePath(); g.stroke();
    g.fillStyle = c; g.beginPath(); g.moveTo(s * 0.5, s * 0.36); g.lineTo(s * 0.76, s * 0.58); g.lineTo(s * 0.5, s * 0.88); g.lineTo(s * 0.24, s * 0.58); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(s * 0.42, s * 0.46, s * 0.1, s * 0.1);
  },
  boots(g, s, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(s * 0.34, s * 0.14); g.lineTo(s * 0.6, s * 0.14); g.lineTo(s * 0.6, s * 0.56); g.lineTo(s * 0.82, s * 0.7); g.lineTo(s * 0.82, s * 0.84);
    g.lineTo(s * 0.24, s * 0.84); g.lineTo(s * 0.24, s * 0.6); g.lineTo(s * 0.34, s * 0.5); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(s * 0.24, s * 0.74, s * 0.58, s * 0.1);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(s * 0.34, s * 0.14, s * 0.26, s * 0.08);
  },
};

const UPGRADE: Record<string, Painter> = {
  vitality(g, s, c) {
    g.fillStyle = c;
    g.beginPath(); g.moveTo(s * 0.5, s * 0.84);
    g.bezierCurveTo(s * 0.1, s * 0.56, s * 0.16, s * 0.16, s * 0.5, s * 0.34);
    g.bezierCurveTo(s * 0.84, s * 0.16, s * 0.9, s * 0.56, s * 0.5, s * 0.84); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(s * 0.32, s * 0.34, s * 0.1, s * 0.1);
  },
  wisdom(g, s, c) {
    g.fillStyle = '#e8e8ff'; g.fillRect(s * 0.4, s * 0.1, s * 0.2, s * 0.22);
    g.fillStyle = c; g.beginPath(); g.moveTo(s * 0.4, s * 0.32); g.lineTo(s * 0.6, s * 0.32); g.lineTo(s * 0.8, s * 0.62); g.lineTo(s * 0.74, s * 0.88); g.lineTo(s * 0.26, s * 0.88); g.lineTo(s * 0.2, s * 0.62); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(s * 0.58, s * 0.62, s * 0.1, s * 0.1);
  },
  focus(g, s, c) {
    stroke(g, c, s * 0.08);
    g.beginPath(); g.moveTo(s * 0.12, s * 0.5); g.quadraticCurveTo(s * 0.5, s * 0.08, s * 0.88, s * 0.5); g.quadraticCurveTo(s * 0.5, s * 0.92, s * 0.12, s * 0.5); g.stroke();
    g.fillStyle = c; g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.17, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#10082a'; g.fillRect(s * 0.44, s * 0.44, s * 0.12, s * 0.12);
  },
  power(g, s, c) {
    g.fillStyle = c;
    g.beginPath(); g.moveTo(s * 0.5, s * 0.08); g.quadraticCurveTo(s * 0.9, s * 0.42, s * 0.68, s * 0.74);
    g.quadraticCurveTo(s * 0.74, s * 0.9, s * 0.5, s * 0.92); g.quadraticCurveTo(s * 0.26, s * 0.9, s * 0.32, s * 0.74);
    g.quadraticCurveTo(s * 0.1, s * 0.42, s * 0.5, s * 0.08); g.fill();
    g.fillStyle = '#fff3a8'; g.beginPath(); g.moveTo(s * 0.5, s * 0.42); g.quadraticCurveTo(s * 0.68, s * 0.64, s * 0.5, s * 0.84); g.quadraticCurveTo(s * 0.32, s * 0.64, s * 0.5, s * 0.42); g.fill();
  },
  resolve(g, s, c) {
    g.fillStyle = c;
    g.beginPath(); g.moveTo(s * 0.5, s * 0.08); g.lineTo(s * 0.86, s * 0.22); g.lineTo(s * 0.8, s * 0.6); g.lineTo(s * 0.5, s * 0.92); g.lineTo(s * 0.2, s * 0.6); g.lineTo(s * 0.14, s * 0.22); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(s * 0.46, s * 0.26, s * 0.08, s * 0.44); g.fillRect(s * 0.3, s * 0.42, s * 0.4, s * 0.08);
  },
  agility(g, s, c) {
    stroke(g, c, s * 0.09);
    g.beginPath(); g.moveTo(s * 0.16, s * 0.78); g.quadraticCurveTo(s * 0.3, s * 0.3, s * 0.84, s * 0.18); g.quadraticCurveTo(s * 0.7, s * 0.66, s * 0.3, s * 0.72); g.stroke();
    stroke(g, 'rgba(255,255,255,0.7)', s * 0.04); g.beginPath(); g.moveTo(s * 0.24, s * 0.7); g.lineTo(s * 0.78, s * 0.24); g.stroke();
  },
  endurance(g, s, c) {
    g.fillStyle = c;
    g.beginPath(); g.moveTo(s * 0.58, s * 0.06); g.lineTo(s * 0.24, s * 0.54); g.lineTo(s * 0.48, s * 0.54); g.lineTo(s * 0.4, s * 0.94); g.lineTo(s * 0.78, s * 0.42); g.lineTo(s * 0.54, s * 0.42); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(s * 0.44, s * 0.2, s * 0.08, s * 0.16);
  },
  grimoire(g, s, c) {
    g.fillStyle = '#6a3a1e'; g.fillRect(s * 0.18, s * 0.12, s * 0.64, s * 0.76);
    g.fillStyle = c; g.fillRect(s * 0.24, s * 0.18, s * 0.5, s * 0.64);
    g.fillStyle = '#f0e0b0'; g.fillRect(s * 0.74, s * 0.18, s * 0.08, s * 0.64);
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(s * 0.34, s * 0.36, s * 0.3, s * 0.06); g.fillRect(s * 0.46, s * 0.28, s * 0.06, s * 0.22);
  },
};

export function makePixelCanvas(px: number, cssSize: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = px; c.height = px;
  c.style.width = `${cssSize}px`; c.style.height = `${cssSize}px`;
  c.style.imageRendering = 'pixelated';
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  paint(g);
  return c;
}

/** Medallion background shared by all emblems. */
function medallion(g: CanvasRenderingContext2D, s: number, rim: string): void {
  g.fillStyle = rim; g.fillRect(s * 0.08, s * 0.08, s * 0.84, s * 0.84);
  g.fillStyle = '#2a1a5e'; g.fillRect(s * 0.16, s * 0.16, s * 0.68, s * 0.68);
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(s * 0.16, s * 0.16, s * 0.68, s * 0.08);
}

export function gearIcon(slot: EquipSlot, tier: number, size = 44): HTMLCanvasElement {
  const color = TIER_COLORS[Math.max(0, Math.min(TIER_COLORS.length - 1, tier - 1))];
  return makePixelCanvas(ICON_PX, size, g => { medallion(g, ICON_PX, color); GEAR[slot](g, ICON_PX, color); });
}

export function upgradeIcon(id: string, size = 44): HTMLCanvasElement {
  const colors: Record<string, string> = {
    vitality: '#ff4d6d', wisdom: '#4fc3ff', focus: '#c9b3ff', power: '#ff7a1a', resolve: '#6ea8ff', agility: '#a8fff0', endurance: '#ffd23f', grimoire: '#b06cff',
  };
  const paint = UPGRADE[id];
  return makePixelCanvas(ICON_PX, size, g => { medallion(g, ICON_PX, '#ffd23f'); if (paint) paint(g, ICON_PX, colors[id] ?? '#ffffff'); });
}

export function slotIcon(slot: EquipSlot, size = 28): HTMLCanvasElement {
  return makePixelCanvas(ICON_PX, size, g => GEAR[slot](g, ICON_PX, '#ffe9a8'));
}

// Pixel-art emblems for gear and upgrades: painted small on canvas and scaled up with crisp edges.
import { ELEMENT_BY_ID, RARITY_COLORS, type ElementId, type EquipSlot, type Rarity } from '@wizard/shared';

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
  staff(g, s, c) {
    stroke(g, '#8a5a2a', s * 0.1);
    g.beginPath(); g.moveTo(s * 0.25, s * 0.78); g.lineTo(s * 0.66, s * 0.36); g.stroke();
    g.fillStyle = c; star(g, s * 0.7, s * 0.3, s * 0.18, 4); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(s * 0.66, s * 0.26, s * 0.08, s * 0.08);
  },
  outfit(g, s, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.18); g.lineTo(s * 0.34, s * 0.26); g.lineTo(s * 0.2, s * 0.44); g.lineTo(s * 0.28, s * 0.52);
    g.lineTo(s * 0.24, s * 0.84); g.lineTo(s * 0.76, s * 0.84); g.lineTo(s * 0.72, s * 0.52); g.lineTo(s * 0.8, s * 0.44);
    g.lineTo(s * 0.66, s * 0.26); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(s * 0.47, s * 0.26, s * 0.06, s * 0.56);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(s * 0.38, s * 0.22, s * 0.08, s * 0.1);
  },
  hat(g, s, c) {
    g.fillStyle = c;
    g.beginPath(); g.moveTo(s * 0.5, s * 0.1); g.lineTo(s * 0.68, s * 0.6); g.lineTo(s * 0.32, s * 0.6); g.closePath(); g.fill();
    g.fillRect(s * 0.16, s * 0.6, s * 0.68, s * 0.12);
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(s * 0.32, s * 0.5, s * 0.36, s * 0.08);
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(s * 0.44, s * 0.22, s * 0.07, s * 0.12);
  },
  shoes(g, s, c) {
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

// ---- general UI emblems -----------------------------------------------------------------
// Most screens were words on a card. These are the small pictures that go next to them: one
// painter per idea, all at ICON_PX so they scale crisply like everything else.

export type UiIconName =
  | 'sword' | 'swords' | 'boot' | 'skull' | 'gem' | 'chest' | 'eye' | 'heart' | 'coin'
  | 'trophy' | 'medal' | 'target' | 'scroll' | 'hourglass' | 'flame' | 'ribbon' | 'spark' | 'book'
  | 'ghost' | 'link' | 'shirt';

const UI: Record<UiIconName, Painter> = {
  sword(g, s) {
    // A long, narrow blade. The first pass was 32% of the box wide and only half of it tall, which
    // at 20px read as a chess piece rather than a sword.
    g.fillStyle = '#d8dce8';
    g.beginPath(); g.moveTo(s * 0.5, s * 0.04); g.lineTo(s * 0.62, s * 0.22); g.lineTo(s * 0.62, s * 0.62);
    g.lineTo(s * 0.38, s * 0.62); g.lineTo(s * 0.38, s * 0.22); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(s * 0.44, s * 0.16, s * 0.06, s * 0.44);
    g.fillStyle = '#ffcc33'; g.fillRect(s * 0.14, s * 0.62, s * 0.72, s * 0.1);
    g.fillStyle = '#8a5a2a'; g.fillRect(s * 0.43, s * 0.72, s * 0.14, s * 0.16);
    g.fillStyle = '#ffcc33'; g.fillRect(s * 0.37, s * 0.88, s * 0.26, s * 0.08);
  },
  swords(g, s) {
    g.strokeStyle = '#d8dce8'; g.lineWidth = s * 0.13; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(s * 0.22, s * 0.86); g.lineTo(s * 0.8, s * 0.14); g.stroke();
    g.beginPath(); g.moveTo(s * 0.78, s * 0.86); g.lineTo(s * 0.2, s * 0.14); g.stroke();
    // Brass guards and pommels, so the blades read as swords rather than as a cross.
    g.fillStyle = '#ffcc33';
    g.fillRect(s * 0.08, s * 0.64, s * 0.3, s * 0.1); g.fillRect(s * 0.62, s * 0.64, s * 0.3, s * 0.1);
    g.fillRect(s * 0.12, s * 0.82, s * 0.16, s * 0.1); g.fillRect(s * 0.72, s * 0.82, s * 0.16, s * 0.1);
  },
  boot(g, s, c) {
    g.fillStyle = c;
    g.beginPath(); g.moveTo(s * 0.3, s * 0.16); g.lineTo(s * 0.54, s * 0.16); g.lineTo(s * 0.54, s * 0.56);
    g.lineTo(s * 0.84, s * 0.68); g.lineTo(s * 0.84, s * 0.82); g.lineTo(s * 0.22, s * 0.82); g.lineTo(s * 0.22, s * 0.3);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(s * 0.3, s * 0.2, s * 0.22, s * 0.08);
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(s * 0.22, s * 0.74, s * 0.62, s * 0.08);
  },
  skull(g, s, c) {
    g.fillStyle = c;
    g.beginPath(); g.arc(s * 0.5, s * 0.44, s * 0.28, Math.PI, 0); g.lineTo(s * 0.78, s * 0.62);
    g.lineTo(s * 0.22, s * 0.62); g.closePath(); g.fill();
    g.fillRect(s * 0.34, s * 0.62, s * 0.32, s * 0.16);
    g.fillStyle = '#1a1030';
    g.fillRect(s * 0.34, s * 0.38, s * 0.12, s * 0.14); g.fillRect(s * 0.54, s * 0.38, s * 0.12, s * 0.14);
    g.fillRect(s * 0.46, s * 0.62, s * 0.08, s * 0.16);
  },
  gem(g, s, c) {
    g.fillStyle = c;
    g.beginPath(); g.moveTo(s * 0.5, s * 0.12); g.lineTo(s * 0.86, s * 0.42); g.lineTo(s * 0.5, s * 0.88);
    g.lineTo(s * 0.14, s * 0.42); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath(); g.moveTo(s * 0.5, s * 0.12); g.lineTo(s * 0.68, s * 0.42); g.lineTo(s * 0.5, s * 0.5); g.closePath(); g.fill();
  },
  chest(g, s, c) {
    g.fillStyle = '#8a5a2a'; g.fillRect(s * 0.14, s * 0.4, s * 0.72, s * 0.42);
    g.beginPath(); g.arc(s * 0.5, s * 0.4, s * 0.36, Math.PI, 0); g.fill();
    g.fillStyle = c; g.fillRect(s * 0.14, s * 0.52, s * 0.72, s * 0.08);
    g.fillStyle = '#ffd23f'; g.fillRect(s * 0.44, s * 0.44, s * 0.12, s * 0.22);
    g.fillStyle = '#1a1030'; g.fillRect(s * 0.47, s * 0.52, s * 0.06, s * 0.08);
  },
  eye(g, s, c) {
    g.fillStyle = '#efe8ff';
    g.beginPath(); g.ellipse(s * 0.5, s * 0.5, s * 0.36, s * 0.22, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = c; g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a1030'; g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.07, 0, Math.PI * 2); g.fill();
  },
  heart(g, s, c) {
    g.fillStyle = c;
    g.beginPath(); g.moveTo(s * 0.5, s * 0.84);
    g.bezierCurveTo(s * 0.02, s * 0.5, s * 0.22, s * 0.1, s * 0.5, s * 0.34);
    g.bezierCurveTo(s * 0.78, s * 0.1, s * 0.98, s * 0.5, s * 0.5, s * 0.84);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(s * 0.3, s * 0.3, s * 0.1, s * 0.1);
  },
  coin(g, s, c) {
    g.fillStyle = c; g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.34, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.22, 0, Math.PI * 2); g.fill();
    g.fillStyle = c; g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.16, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(s * 0.3, s * 0.26, s * 0.1, s * 0.08);
  },
  trophy(g, s, c) {
    g.fillStyle = c;
    g.beginPath(); g.moveTo(s * 0.26, s * 0.14); g.lineTo(s * 0.74, s * 0.14); g.lineTo(s * 0.64, s * 0.54);
    g.lineTo(s * 0.36, s * 0.54); g.closePath(); g.fill();
    g.fillRect(s * 0.44, s * 0.54, s * 0.12, s * 0.16); g.fillRect(s * 0.3, s * 0.7, s * 0.4, s * 0.12);
    stroke(g, c, s * 0.07);
    g.beginPath(); g.moveTo(s * 0.26, s * 0.2); g.lineTo(s * 0.12, s * 0.3); g.lineTo(s * 0.22, s * 0.44); g.stroke();
    g.beginPath(); g.moveTo(s * 0.74, s * 0.2); g.lineTo(s * 0.88, s * 0.3); g.lineTo(s * 0.78, s * 0.44); g.stroke();
  },
  medal(g, s, c) {
    g.fillStyle = '#6ea8ff';
    g.beginPath(); g.moveTo(s * 0.3, s * 0.1); g.lineTo(s * 0.46, s * 0.1); g.lineTo(s * 0.5, s * 0.42); g.lineTo(s * 0.36, s * 0.42); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(s * 0.7, s * 0.1); g.lineTo(s * 0.54, s * 0.1); g.lineTo(s * 0.5, s * 0.42); g.lineTo(s * 0.64, s * 0.42); g.closePath(); g.fill();
    g.fillStyle = c; g.beginPath(); g.arc(s * 0.5, s * 0.62, s * 0.26, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.35)'; star(g, s * 0.5, s * 0.62, s * 0.14, 5); g.fill();
  },
  target(g, s, c) {
    stroke(g, c, s * 0.09);
    g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.34, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.18, 0, Math.PI * 2); g.stroke();
    g.fillStyle = c; g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.07, 0, Math.PI * 2); g.fill();
  },
  scroll(g, s, c) {
    g.fillStyle = '#e8dcb8'; g.fillRect(s * 0.22, s * 0.16, s * 0.56, s * 0.68);
    g.fillStyle = c; g.fillRect(s * 0.16, s * 0.12, s * 0.68, s * 0.1); g.fillRect(s * 0.16, s * 0.78, s * 0.68, s * 0.1);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    for (let i = 0; i < 3; i++) g.fillRect(s * 0.3, s * 0.32 + i * s * 0.14, s * 0.4, s * 0.06);
  },
  hourglass(g, s, c) {
    g.fillStyle = c; g.fillRect(s * 0.2, s * 0.1, s * 0.6, s * 0.1); g.fillRect(s * 0.2, s * 0.8, s * 0.6, s * 0.1);
    g.beginPath(); g.moveTo(s * 0.26, s * 0.2); g.lineTo(s * 0.74, s * 0.2); g.lineTo(s * 0.52, s * 0.5);
    g.lineTo(s * 0.74, s * 0.8); g.lineTo(s * 0.26, s * 0.8); g.lineTo(s * 0.48, s * 0.5); g.closePath(); g.fill();
    g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(s * 0.34, s * 0.7); g.lineTo(s * 0.66, s * 0.7); g.lineTo(s * 0.5, s * 0.54); g.closePath(); g.fill();
  },
  flame(g, s, c) {
    g.fillStyle = c;
    g.beginPath(); g.moveTo(s * 0.5, s * 0.08);
    g.quadraticCurveTo(s * 0.86, s * 0.46, s * 0.66, s * 0.72);
    g.quadraticCurveTo(s * 0.58, s * 0.88, s * 0.34, s * 0.8);
    g.quadraticCurveTo(s * 0.12, s * 0.6, s * 0.5, s * 0.08);
    g.fill();
    g.fillStyle = '#ffe066';
    g.beginPath(); g.moveTo(s * 0.52, s * 0.42); g.quadraticCurveTo(s * 0.68, s * 0.64, s * 0.5, s * 0.78);
    g.quadraticCurveTo(s * 0.36, s * 0.64, s * 0.52, s * 0.42); g.fill();
  },
  ribbon(g, s, c) {
    g.fillStyle = c; g.fillRect(s * 0.22, s * 0.14, s * 0.56, s * 0.42);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(s * 0.22, s * 0.44, s * 0.56, s * 0.12);
    g.fillStyle = c;
    g.beginPath(); g.moveTo(s * 0.22, s * 0.56); g.lineTo(s * 0.5, s * 0.72); g.lineTo(s * 0.78, s * 0.56);
    g.lineTo(s * 0.78, s * 0.9); g.lineTo(s * 0.5, s * 0.76); g.lineTo(s * 0.22, s * 0.9); g.closePath(); g.fill();
    g.fillStyle = '#fff6dc'; star(g, s * 0.5, s * 0.32, s * 0.14, 5); g.fill();
  },
  spark(g, s, c) {
    g.fillStyle = c;
    g.beginPath(); g.moveTo(s * 0.6, s * 0.06); g.lineTo(s * 0.32, s * 0.5); g.lineTo(s * 0.5, s * 0.5);
    g.lineTo(s * 0.38, s * 0.94); g.lineTo(s * 0.7, s * 0.44); g.lineTo(s * 0.5, s * 0.44); g.closePath(); g.fill();
  },
  book(g, s, c) {
    g.fillStyle = c; g.fillRect(s * 0.14, s * 0.14, s * 0.72, s * 0.72);
    g.fillStyle = '#e8dcb8'; g.fillRect(s * 0.22, s * 0.2, s * 0.56, s * 0.6);
    g.fillStyle = c; g.fillRect(s * 0.46, s * 0.14, s * 0.08, s * 0.72);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(s * 0.27, s * 0.3, s * 0.15, s * 0.05); g.fillRect(s * 0.27, s * 0.42, s * 0.15, s * 0.05);
    g.fillRect(s * 0.58, s * 0.3, s * 0.15, s * 0.05); g.fillRect(s * 0.58, s * 0.42, s * 0.15, s * 0.05);
  },
  // A ghost duel is a recording of somebody who is not here, so: a sheet with a ragged hem.
  ghost(g, s, c) {
    g.fillStyle = c;
    g.beginPath(); g.arc(s * 0.5, s * 0.44, s * 0.3, Math.PI, 0); g.lineTo(s * 0.8, s * 0.86);
    for (let i = 0; i < 3; i++) {
      const x = s * (0.8 - i * 0.2);
      g.lineTo(x - s * 0.1, s * 0.72); g.lineTo(x - s * 0.2, s * 0.86);
    }
    g.closePath(); g.fill();
    g.fillStyle = '#1a1030';
    g.fillRect(s * 0.36, s * 0.38, s * 0.1, s * 0.12); g.fillRect(s * 0.54, s * 0.38, s * 0.1, s * 0.12);
  },
  // Two links of chain: the shared code that joins one player to another. Drawn as rings rather
  // than rectangles, which at this size read as a domino.
  link(g, s, c) {
    g.strokeStyle = c; g.lineWidth = s * 0.11;
    g.beginPath(); g.arc(s * 0.35, s * 0.5, s * 0.22, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(s * 0.65, s * 0.5, s * 0.22, 0, Math.PI * 2); g.stroke();
  },
  shirt(g, s, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.16); g.lineTo(s * 0.32, s * 0.22); g.lineTo(s * 0.12, s * 0.38); g.lineTo(s * 0.24, s * 0.5);
    g.lineTo(s * 0.24, s * 0.86); g.lineTo(s * 0.76, s * 0.86); g.lineTo(s * 0.76, s * 0.5); g.lineTo(s * 0.88, s * 0.38);
    g.lineTo(s * 0.68, s * 0.22); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(s * 0.47, s * 0.22, s * 0.06, s * 0.62);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(s * 0.3, s * 0.3, s * 0.1, s * 0.1);
  },
};

export function uiIcon(name: UiIconName, size = 24, tint = '#ffd23f'): HTMLCanvasElement {
  return makePixelCanvas(ICON_PX, size, g => UI[name](g, ICON_PX, tint));
}

/** Quest metrics to the picture that says what the quest is about. */
export function questIcon(metric: string, size = 24): HTMLCanvasElement {
  const map: Record<string, [UiIconName, string]> = {
    wins: ['sword', '#ff9a9a'],
    casts: ['spark', '#ffe066'],
    dodges: ['boot', '#8ef3ff'],
    bossWins: ['skull', '#d0a0ff'],
    duelWins: ['swords', '#ff8f8f'],
    discovered: ['eye', '#7dff9b'],
    chests: ['chest', '#ffd23f'],
    drops: ['gem', '#6fd67a'],
  };
  const [name, tint] = map[metric] ?? ['scroll', '#ffd23f'];
  return uiIcon(name, size, tint);
}

/** Season reward kinds to a picture, so a tier row reads before it is read. */
export function rewardIcon(kind: string, size = 24): HTMLCanvasElement {
  if (kind === 'chest') return uiIcon('chest', size, '#ffd23f');
  if (kind === 'title') return uiIcon('ribbon', size, '#ff4fd8');
  return uiIcon('coin', size, '#ffcc33');
}

/**
 * Awards, by what the award is for. Keyed on the id prefix because the ids already group that way,
 * so a new level_* or duel_* award inherits the right picture without touching this.
 */
export function achievementIcon(id: string, size = 24): HTMLCanvasElement {
  const rules: [RegExp, UiIconName, string][] = [
    [/^level_/, 'trophy', '#ffcc33'],
    [/^boss_/, 'skull', '#d0a0ff'],
    [/^(first_win|wins_)/, 'sword', '#ff9a9a'],
    [/^secret_/, 'eye', '#ff4fd8'],
    [/^spells_/, 'book', '#ffd23f'],
    [/^mythic_gear/, 'gem', '#ff7a3d'],
    [/^mythic_/, 'spark', '#c77dff'],
    [/^elements_/, 'flame', '#ff8a2a'],
    [/^(fullset|gear_full)/, 'shirt', '#8ef3ff'],
    [/^drops_/, 'chest', '#ffd23f'],
    [/^dodge_/, 'boot', '#8ef3ff'],
    [/^cast_/, 'scroll', '#ffe066'],
    [/^meteor_/, 'flame', '#ff6a3d'],
    [/^streak_/, 'hourglass', '#ffcc33'],
    [/^rating_/, 'medal', '#ffcc33'],
    [/^duel_/, 'swords', '#ff8f8f'],
  ];
  const hit = rules.find(r => r[0].test(id));
  return uiIcon(hit ? hit[1] : 'medal', size, hit ? hit[2] : '#ffcc33');
}

/** Gold, silver and bronze for the top three; everybody else gets the plain number. */
export function placeIcon(place: number, size = 26): HTMLCanvasElement | null {
  const tint = ['#ffcc33', '#d8dce8', '#c98b4a'][place - 1];
  return tint ? uiIcon('medal', size, tint) : null;
}

/**
 * The shopkeeper. Drawn at twice the usual size because he is the only picture on the screen that
 * is meant to be looked at rather than glanced at.
 */
export const PORTRAIT_PX = 48;
export function wizardPortrait(size = 96): HTMLCanvasElement {
  return makePixelCanvas(PORTRAIT_PX, size, g => {
    const s = PORTRAIT_PX;
    // Staff, behind everything.
    g.fillStyle = '#8a5a2a'; g.fillRect(s * 0.78, s * 0.22, s * 0.05, s * 0.72);
    g.fillStyle = '#7dff9b'; g.beginPath(); g.arc(s * 0.805, s * 0.2, s * 0.07, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(125,255,155,0.45)'; g.beginPath(); g.arc(s * 0.805, s * 0.2, s * 0.11, 0, Math.PI * 2); g.fill();
    // Robe.
    g.fillStyle = '#4a4fd0';
    g.beginPath(); g.moveTo(s * 0.5, s * 0.46); g.lineTo(s * 0.24, s * 0.62); g.lineTo(s * 0.2, s * 0.96);
    g.lineTo(s * 0.8, s * 0.96); g.lineTo(s * 0.76, s * 0.62); g.closePath(); g.fill();
    g.fillStyle = '#2e2fa8'; g.fillRect(s * 0.46, s * 0.62, s * 0.08, s * 0.34);
    // Face and beard.
    g.fillStyle = '#e8c39e'; g.fillRect(s * 0.36, s * 0.3, s * 0.28, s * 0.22);
    g.fillStyle = '#d8dce8';
    g.beginPath(); g.moveTo(s * 0.36, s * 0.44); g.lineTo(s * 0.64, s * 0.44); g.lineTo(s * 0.56, s * 0.72);
    g.lineTo(s * 0.44, s * 0.72); g.closePath(); g.fill();
    g.fillStyle = '#1a1030'; g.fillRect(s * 0.41, s * 0.37, s * 0.05, s * 0.05); g.fillRect(s * 0.54, s * 0.37, s * 0.05, s * 0.05);
    // Hat.
    g.fillStyle = '#2e2fa8';
    g.beginPath(); g.moveTo(s * 0.5, s * 0.02); g.lineTo(s * 0.72, s * 0.3); g.lineTo(s * 0.28, s * 0.3); g.closePath(); g.fill();
    g.fillRect(s * 0.22, s * 0.28, s * 0.56, s * 0.07);
    g.fillStyle = '#ffd23f'; g.fillRect(s * 0.3, s * 0.24, s * 0.4, s * 0.05);
    star(g, s * 0.56, s * 0.14, s * 0.05, 4); g.fill();
  });
}

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

/** Gear emblem: the rim shows rarity, the emblem itself is tinted by the element. */
export function gearIcon(slot: EquipSlot, rarity: Rarity | number, size = 44, elementColor?: string): HTMLCanvasElement {
  const r = Math.max(1, Math.min(5, Math.round(rarity))) as Rarity;
  const rim = RARITY_COLORS[r];
  const tint = elementColor ?? rim;
  return makePixelCanvas(ICON_PX, size, g => { medallion(g, ICON_PX, rim); GEAR[slot](g, ICON_PX, tint); });
}

/** One emblem per element, drawn from its own simple motif. */
export function elementIcon(id: ElementId, size = 44): HTMLCanvasElement {
  const c = ELEMENT_BY_ID[id].color;
  return makePixelCanvas(ICON_PX, size, g => {
    const s = ICON_PX;
    medallion(g, s, c);
    g.fillStyle = c;
    switch (id) {
      case 'arcane':   star(g, s * 0.5, s * 0.5, s * 0.3, 4); g.fill(); break;
      case 'fire':     g.beginPath(); g.moveTo(s * 0.5, s * 0.22); g.quadraticCurveTo(s * 0.78, s * 0.52, s * 0.5, s * 0.8); g.quadraticCurveTo(s * 0.22, s * 0.52, s * 0.5, s * 0.22); g.fill(); break;
      case 'frost':    stroke(g, c, s * 0.07); g.beginPath(); for (let i = 0; i < 3; i++) { const a = (i * 60) * Math.PI / 180; g.moveTo(s * 0.5 - Math.cos(a) * s * 0.3, s * 0.5 - Math.sin(a) * s * 0.3); g.lineTo(s * 0.5 + Math.cos(a) * s * 0.3, s * 0.5 + Math.sin(a) * s * 0.3); } g.stroke(); break;
      case 'storm':    g.beginPath(); g.moveTo(s * 0.62, s * 0.2); g.lineTo(s * 0.36, s * 0.52); g.lineTo(s * 0.52, s * 0.52); g.lineTo(s * 0.38, s * 0.82); g.lineTo(s * 0.66, s * 0.46); g.lineTo(s * 0.5, s * 0.46); g.closePath(); g.fill(); break;
      case 'nature':   g.beginPath(); g.ellipse(s * 0.5, s * 0.5, s * 0.16, s * 0.3, Math.PI / 4, 0, Math.PI * 2); g.fill(); break;
      case 'shadow':   g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.3, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1e1a5a'; g.beginPath(); g.arc(s * 0.62, s * 0.42, s * 0.26, 0, Math.PI * 2); g.fill(); break;
      case 'light':    g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.16, 0, Math.PI * 2); g.fill(); stroke(g, c, s * 0.05); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(s * 0.5 + Math.cos(a) * s * 0.24, s * 0.5 + Math.sin(a) * s * 0.24); g.lineTo(s * 0.5 + Math.cos(a) * s * 0.34, s * 0.5 + Math.sin(a) * s * 0.34); g.stroke(); } break;
      case 'earth':    g.beginPath(); g.moveTo(s * 0.18, s * 0.74); g.lineTo(s * 0.38, s * 0.34); g.lineTo(s * 0.54, s * 0.58); g.lineTo(s * 0.68, s * 0.28); g.lineTo(s * 0.84, s * 0.74); g.closePath(); g.fill(); break;
      case 'chrono':   stroke(g, c, s * 0.06); g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.28, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(s * 0.5, s * 0.5); g.lineTo(s * 0.5, s * 0.3); g.moveTo(s * 0.5, s * 0.5); g.lineTo(s * 0.66, s * 0.58); g.stroke(); break;
      case 'eclipse':  g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.3, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1e1a5a'; g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.19, 0, Math.PI * 2); g.fill(); break;
    }
  });
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

// Wizard appearance types and colour helpers. Kept separate from data.ts so equipment can name a
// hat style without pulling in the whole balance table.

export const HAT_STYLES = ['pointy', 'hood', 'crown', 'horns', 'wide', 'turban', 'halo', 'helm', 'veil'] as const;
export type HatStyle = typeof HAT_STYLES[number];

/** Staff heads, so the staff slot is visible on the model rather than just a stat line. */
export const STAFF_STYLES = ['claw', 'crystal', 'ring', 'blade', 'skull', 'leaf', 'sun', 'hammer', 'hourglass'] as const;
export type StaffStyle = typeof STAFF_STYLES[number];

export interface WizardLook {
  robe: string; hat: string; trim: string; skin: string;
  /** The beard and the boots. The beard is the player's own choice; the boots follow the shoes. */
  beardColor: string; boots: string;
  hatStyle: HatStyle; staffStyle: StaffStyle; beard: boolean; cape: boolean;
}

/** Skin tones and beard colours offered in settings. Names are what the picker shows. */
export const SKIN_TONES: { id: string; name: string; color: string }[] = [
  { id: 'porcelain', name: 'Porcelain', color: '#f2d9c4' },
  { id: 'fair', name: 'Fair', color: '#e8c39e' },
  { id: 'olive', name: 'Olive', color: '#c9a077' },
  { id: 'tan', name: 'Tan', color: '#b07d4f' },
  { id: 'bronze', name: 'Bronze', color: '#8a5a36' },
  { id: 'deep', name: 'Deep', color: '#5e3a24' },
  { id: 'ash', name: 'Ashen', color: '#b9b4c8' },
  { id: 'verdant', name: 'Verdant', color: '#86a86a' },
];

export const BEARD_COLORS: { id: string; name: string; color: string }[] = [
  { id: 'snow', name: 'Snow', color: '#efeeea' },
  { id: 'silver', name: 'Silver', color: '#c4c2cf' },
  { id: 'slate', name: 'Slate', color: '#7d7a8c' },
  { id: 'soot', name: 'Soot', color: '#3a3646' },
  { id: 'chestnut', name: 'Chestnut', color: '#8a5a30' },
  { id: 'ginger', name: 'Ginger', color: '#c96a22' },
  { id: 'gold', name: 'Gold', color: '#d9b45c' },
  { id: 'ember', name: 'Ember', color: '#e2553a' },
];

export const DEFAULT_SKIN = SKIN_TONES[1].color;
export const DEFAULT_BEARD = BEARD_COLORS[0].color;

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number): number => { const k = (n + h * 12) % 12; const a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  const to = (v: number): string => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

/** Shifts a colour's hue (0..1 wraps) and nudges its lightness. */
export function shiftColor(hex: string, hue: number, light = 0): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex((h + hue + 1) % 1, s, Math.max(0.12, Math.min(0.85, l + light)));
}

/** Darkens or lightens without changing hue. */
export function shade(hex: string, light: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0.06, Math.min(0.94, l + light)));
}

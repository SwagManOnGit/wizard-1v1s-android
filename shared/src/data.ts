// All balance data: spells, upgrades, equipment, enemies, bosses and the level curve.
import type { GlyphId } from './glyphs';

export const LANES = 3;
export const MAX_LEVEL = 100;
export const ENEMY_Z = -13;   // distance between the two wizards in world units
export const LANE_X = [-1.7, 0, 1.7];

export type SpellKind = 'attack' | 'defense' | 'heal' | 'utility';

export interface SpellDef {
  id: string;
  name: string;
  glyph: GlyphId;
  kind: SpellKind;
  cost: number;          // mana
  price: number;         // coins; 0 = starting spell
  color: string;         // css colour for icons, projectiles and particles
  desc: string;
  cooldown?: number;     // seconds, only for a few utility spells
  damage?: number;
  hits?: number;         // projectiles fired
  speed?: number;        // world units per second (default 16)
  pierce?: boolean;      // ignores enemy shields
  lifesteal?: number;    // fraction of damage healed
  dot?: { perSec: number; dur: number };
  slow?: { factor: number; dur: number };   // enemy cast speed multiplier
  freeze?: number;       // seconds the enemy cannot cast
  interrupt?: boolean;   // cancels the enemy's current cast
  shield?: { amount: number; dur: number };
  heal?: number;
  hot?: { perSec: number; dur: number };
  cleanse?: boolean;
  reflect?: number;      // seconds
  phase?: { charges: number; dur: number };
  mana?: number;
}

export const SPELLS: SpellDef[] = [
  // ---- starting five -------------------------------------------------------
  { id: 'spark', name: 'Spark', glyph: 'line-v', kind: 'attack', cost: 8, price: 0, color: '#ffe066', damage: 12, speed: 22,
    desc: 'A quick jolt. Cheap and fast.' },
  { id: 'fireball', name: 'Fireball', glyph: 'circle', kind: 'attack', cost: 22, price: 0, color: '#ff7a1a', damage: 30,
    desc: 'The classic. Solid damage for the mana.' },
  { id: 'iceshard', name: 'Ice Shard', glyph: 'triangle', kind: 'attack', cost: 20, price: 0, color: '#7fe3ff', damage: 20, speed: 19,
    slow: { factor: 0.6, dur: 3 }, desc: 'Chills the enemy, slowing their casting for 3s.' },
  { id: 'ward', name: 'Ward', glyph: 'caret', kind: 'defense', cost: 25, price: 0, color: '#6ea8ff',
    shield: { amount: 35, dur: 6 }, desc: 'A barrier that absorbs 35 damage for 6s.' },
  { id: 'mend', name: 'Mend', glyph: 'heart', kind: 'heal', cost: 30, price: 0, color: '#7dff9b', heal: 25,
    desc: 'Restores 25 health.' },
  // ---- shop spells ---------------------------------------------------------
  { id: 'windslash', name: 'Wind Slash', glyph: 'line-h', kind: 'attack', cost: 6, price: 120, color: '#d8fff4', damage: 16, speed: 30,
    desc: 'Blindingly fast and nearly free.' },
  { id: 'lightning', name: 'Lightning', glyph: 'bolt', kind: 'attack', cost: 32, price: 220, color: '#c9b3ff', damage: 46, speed: 40,
    desc: 'Strikes almost instantly for heavy damage.' },
  { id: 'missiles', name: 'Arcane Missiles', glyph: 'w', kind: 'attack', cost: 30, price: 280, color: '#e08cff', damage: 15, hits: 3,
    desc: 'Three homing missiles, 15 damage each.' },
  { id: 'venom', name: 'Venom', glyph: 's', kind: 'attack', cost: 26, price: 320, color: '#a4ff3c', damage: 10,
    dot: { perSec: 9, dur: 5 }, desc: 'Poisons the enemy for 9 damage a second over 5s.' },
  { id: 'regen', name: 'Regeneration', glyph: 'spiral', kind: 'heal', cost: 34, price: 420, color: '#9dffc2',
    hot: { perSec: 7, dur: 6 }, desc: 'Heals 7 health a second for 6s.' },
  { id: 'frostnova', name: 'Frost Nova', glyph: 'square', kind: 'attack', cost: 40, price: 480, color: '#b8f4ff', damage: 30,
    freeze: 2, interrupt: true, desc: 'Freezes the enemy solid for 2s, cancelling their cast.' },
  { id: 'drain', name: 'Drain', glyph: 'n', kind: 'attack', cost: 34, price: 520, color: '#ff5fa0', damage: 30, lifesteal: 0.6,
    desc: 'Steals life: heals you for 60% of the damage.' },
  { id: 'greatward', name: 'Greater Ward', glyph: 'm', kind: 'defense', cost: 45, price: 580, color: '#4f8dff',
    shield: { amount: 90, dur: 8 }, desc: 'A mighty barrier absorbing 90 damage for 8s.' },
  { id: 'phase', name: 'Phase Step', glyph: 'l', kind: 'defense', cost: 28, price: 620, color: '#c4c4ff', cooldown: 10,
    phase: { charges: 2, dur: 6 }, desc: 'The next 2 enemy spells pass right through you.' },
  { id: 'shadowbolt', name: 'Shadow Bolt', glyph: 'v', kind: 'attack', cost: 36, price: 680, color: '#9b5cff', damage: 42, pierce: true,
    desc: 'Passes through enemy shields.' },
  { id: 'reflect', name: 'Mirror Shell', glyph: 'c', kind: 'defense', cost: 40, price: 740, color: '#e6f2ff', cooldown: 8, reflect: 4,
    desc: 'For 4s enemy spells bounce straight back at them.' },
  { id: 'surge', name: 'Mana Surge', glyph: 'u', kind: 'utility', cost: 0, price: 800, color: '#66d9ff', cooldown: 14, mana: 55,
    desc: 'Instantly restores 55 mana. 14s cooldown.' },
  { id: 'timewarp', name: 'Time Warp', glyph: 'hourglass', kind: 'utility', cost: 38, price: 860, color: '#ffd166', cooldown: 6,
    slow: { factor: 0.45, dur: 6 }, desc: 'Slows the enemy\'s casting by more than half for 6s.' },
  { id: 'chain', name: 'Chain Lightning', glyph: 'z', kind: 'attack', cost: 46, price: 920, color: '#8ef3ff', damage: 62, speed: 34,
    desc: 'Arcing power. Big damage, fast.' },
  { id: 'holylight', name: 'Holy Light', glyph: 'check', kind: 'heal', cost: 50, price: 1000, color: '#fff3a8', cooldown: 8, heal: 55, cleanse: true,
    desc: 'Heals 55 and cleanses poison and burns.' },
  { id: 'inferno', name: 'Inferno', glyph: 'infinity', kind: 'attack', cost: 48, price: 1100, color: '#ff4d2e', damage: 36,
    dot: { perSec: 12, dur: 4 }, desc: 'Sets the enemy ablaze: 36 damage plus 12 a second for 4s.' },
  { id: 'tidal', name: 'Tidal Wave', glyph: 'wave', kind: 'attack', cost: 44, price: 1250, color: '#4fc3ff', damage: 50, interrupt: true, speed: 14,
    desc: 'A crashing wave that knocks the enemy out of their cast.' },
  { id: 'meteor', name: 'Meteor', glyph: 'star', kind: 'attack', cost: 65, price: 1500, color: '#ff9d3c', damage: 115, speed: 10,
    desc: 'Slow to arrive, devastating when it does.' },
  { id: 'voidrift', name: 'Void Rift', glyph: 'pigtail', kind: 'attack', cost: 58, price: 1900, color: '#b04dff', damage: 90, pierce: true, speed: 20,
    desc: 'Tears through shields for 90 damage.' },
];

export const SPELL_BY_ID: Record<string, SpellDef> = Object.fromEntries(SPELLS.map(s => [s.id, s]));
export const STARTING_SPELLS = SPELLS.filter(s => s.price === 0).map(s => s.id);
export const BASE_SLOTS = 6;

// ---- upgrades -----------------------------------------------------------------
export interface UpgradeDef {
  id: string; name: string; desc: string; max: number; basePrice: number; growth: number;
}
export const UPGRADES: UpgradeDef[] = [
  { id: 'vitality', name: 'Vitality', desc: '+20 max health per rank', max: 30, basePrice: 60, growth: 1.28 },
  { id: 'wisdom', name: 'Wisdom', desc: '+10 max mana per rank', max: 15, basePrice: 80, growth: 1.32 },
  { id: 'focus', name: 'Focus', desc: '+1.5 mana regen per second per rank', max: 12, basePrice: 110, growth: 1.38 },
  { id: 'power', name: 'Spell Power', desc: '+8% spell damage per rank', max: 30, basePrice: 90, growth: 1.3 },
  { id: 'resolve', name: 'Resolve', desc: '+10% healing and shields per rank', max: 10, basePrice: 100, growth: 1.4 },
  { id: 'agility', name: 'Agility', desc: 'Longer dodge invulnerability per rank', max: 5, basePrice: 150, growth: 1.6 },
  { id: 'endurance', name: 'Endurance', desc: '+12 max stamina per rank (dodging costs stamina)', max: 10, basePrice: 90, growth: 1.35 },
  { id: 'grimoire', name: 'Grimoire', desc: '+1 spell slot in your loadout', max: 4, basePrice: 400, growth: 2.2 },
];
export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

export function upgradePrice(u: UpgradeDef, rank: number): number {
  return Math.round(u.basePrice * Math.pow(u.growth, rank));
}

// ---- equipment ----------------------------------------------------------------
export type EquipSlot = 'wand' | 'robe' | 'charm' | 'boots';
export interface EquipDef {
  id: string; slot: EquipSlot; name: string; price: number; desc: string; tier: number;
  power?: number; hp?: number; mana?: number; regen?: number; costMult?: number;
  healMult?: number; shieldMult?: number; coinMult?: number; revive?: number;
  stamina?: number; staminaRegen?: number; dodgeCostMult?: number;
}
export const EQUIPMENT: EquipDef[] = [
  { id: 'wand1', slot: 'wand', name: 'Oak Wand', price: 150, tier: 1, power: 0.06, desc: '+6% spell damage' },
  { id: 'wand2', slot: 'wand', name: 'Ember Wand', price: 450, tier: 2, power: 0.14, desc: '+14% spell damage' },
  { id: 'wand3', slot: 'wand', name: 'Crystal Wand', price: 1100, tier: 3, power: 0.24, regen: 2, desc: '+24% damage, +2 mana regen' },
  { id: 'wand4', slot: 'wand', name: 'Storm Wand', price: 2600, tier: 4, power: 0.36, desc: '+36% spell damage' },
  { id: 'wand5', slot: 'wand', name: 'Archmage Wand', price: 6000, tier: 5, power: 0.5, costMult: 0.9, desc: '+50% damage, spells cost 10% less' },
  { id: 'robe1', slot: 'robe', name: 'Linen Robe', price: 120, tier: 1, hp: 30, desc: '+30 max health' },
  { id: 'robe2', slot: 'robe', name: 'Silk Robe', price: 400, tier: 2, hp: 80, desc: '+80 max health' },
  { id: 'robe3', slot: 'robe', name: 'Enchanted Robe', price: 1000, tier: 3, hp: 160, shieldMult: 1.15, desc: '+160 health, +15% shields' },
  { id: 'robe4', slot: 'robe', name: 'Dragonhide Robe', price: 2400, tier: 4, hp: 320, desc: '+320 max health' },
  { id: 'robe5', slot: 'robe', name: 'Astral Robe', price: 5500, tier: 5, hp: 600, healMult: 1.2, desc: '+600 health, +20% healing' },
  { id: 'charm1', slot: 'charm', name: 'Mana Bead', price: 140, tier: 1, mana: 25, desc: '+25 max mana' },
  { id: 'charm2', slot: 'charm', name: 'Focus Ring', price: 420, tier: 2, regen: 3, desc: '+3 mana regen per second' },
  { id: 'charm3', slot: 'charm', name: 'Lucky Coin', price: 900, tier: 3, coinMult: 1.2, desc: '+20% coins from battles' },
  { id: 'charm4', slot: 'charm', name: 'Phoenix Feather', price: 2200, tier: 4, revive: 0.35, desc: 'Once per battle, revive with 35% health' },
  { id: 'charm5', slot: 'charm', name: 'Chrono Amulet', price: 5000, tier: 5, costMult: 0.85, coinMult: 1.3, desc: 'Spells cost 15% less, +30% coins' },
  { id: 'boots1', slot: 'boots', name: 'Leather Boots', price: 130, tier: 1, stamina: 20, desc: '+20 max stamina' },
  { id: 'boots2', slot: 'boots', name: 'Runner\'s Boots', price: 400, tier: 2, staminaRegen: 6, desc: '+6 stamina regen per second' },
  { id: 'boots3', slot: 'boots', name: 'Windstep Boots', price: 950, tier: 3, dodgeCostMult: 0.8, desc: 'Dodging costs 20% less stamina' },
  { id: 'boots4', slot: 'boots', name: 'Griffon Boots', price: 2300, tier: 4, stamina: 45, staminaRegen: 6, desc: '+45 stamina, +6 stamina regen' },
  { id: 'boots5', slot: 'boots', name: 'Chrono Greaves', price: 5200, tier: 5, stamina: 30, dodgeCostMult: 0.65, desc: 'Dodging costs 35% less, +30 stamina' },
];
export const EQUIP_BY_ID: Record<string, EquipDef> = Object.fromEntries(EQUIPMENT.map(e => [e.id, e]));
export const EQUIP_SLOTS: { id: EquipSlot; name: string }[] = [
  { id: 'wand', name: 'Wand' }, { id: 'robe', name: 'Robe' }, { id: 'charm', name: 'Charm' }, { id: 'boots', name: 'Boots' },
];

// ---- enemies ------------------------------------------------------------------
export interface EnemyTier {
  name: string; robe: string; hat: string; trim: string; spell: string; sky: string; floor: string; fog: string;
}
export const TIERS: EnemyTier[] = [
  { name: 'Apprentice', robe: '#6a7fd8', hat: '#4a56b0', trim: '#e0e8ff', spell: '#8ab4ff', sky: '#2438a0', floor: '#3a4a90', fog: '#4a62c8' },
  { name: 'Hedge Wizard', robe: '#4ea44a', hat: '#2f7a33', trim: '#e6ffb0', spell: '#a6ff5c', sky: '#1c6a4a', floor: '#2f6a3a', fog: '#3a9a6a' },
  { name: 'Pyromancer', robe: '#e0481e', hat: '#a82a12', trim: '#ffd48a', spell: '#ff7a1a', sky: '#7a1a10', floor: '#6a2a1a', fog: '#c04a20' },
  { name: 'Frost Witch', robe: '#4aa0e0', hat: '#2a6aa8', trim: '#eafcff', spell: '#8be9ff', sky: '#1a4a8a', floor: '#2a5a8a', fog: '#4a90d0' },
  { name: 'Storm Caller', robe: '#6a4fd8', hat: '#4a32a8', trim: '#ffe98a', spell: '#d4c3ff', sky: '#2a1a7a', floor: '#3a2a80', fog: '#5a48c8' },
  { name: 'Necromancer', robe: '#3f6a48', hat: '#264a30', trim: '#b0ffb0', spell: '#7dff7d', sky: '#0f2a1a', floor: '#1e3a28', fog: '#2a7a4a' },
  { name: 'Illusionist', robe: '#c24fc0', hat: '#8a2f88', trim: '#ffd0f8', spell: '#ff8ff2', sky: '#5a1a70', floor: '#5a2a68', fog: '#b040c0' },
  { name: 'Warlock', robe: '#9a2438', hat: '#6a1428', trim: '#ff9a9a', spell: '#ff4a4a', sky: '#4a0a18', floor: '#4a1a28', fog: '#a02040' },
  { name: 'Void Sorcerer', robe: '#4a3a8a', hat: '#2a1f5a', trim: '#d0a0ff', spell: '#b04dff', sky: '#180a3a', floor: '#2a1a4a', fog: '#6a30c0' },
  { name: 'Archmage', robe: '#d0a030', hat: '#a07820', trim: '#fff6c8', spell: '#ffe066', sky: '#5a4010', floor: '#5a4a20', fog: '#c09a30' },
];

export const BOSS_NAMES = [
  'Grumbold the Gray', 'Sister Ember', 'Frostjaw', 'The Hollow Twins', 'Baron Thunderhide',
  'Mortis the Pale', 'Lady Mirage', 'Kraag Hexfist', 'Nullsong', 'Magister Vell',
  'Cinderwraith', 'Glacius Prime', 'The Tempest King', 'Queen of Ash', 'The Hollow Sage',
  'Duke Nihil', 'Seraphine the Bright', 'Oblivion Warden', 'The Eternal Apprentice', 'Archmage Zorvath',
];

export interface EnemyDef {
  level: number; boss: boolean; name: string; tier: EnemyTier;
  hp: number; damage: number; castInterval: number; projectileSpeed: number; telegraph: number;
  coins: number;
}

export function isBossLevel(level: number): boolean { return level % 5 === 0; }

export function enemyForLevel(level: number): EnemyDef {
  const L = Math.max(1, level);
  const boss = isBossLevel(L);
  const tier = TIERS[Math.min(TIERS.length - 1, Math.floor((L - 1) / 10))];
  const hp = Math.round((80 + 20 * L + 0.75 * L * L) * (boss ? 2.2 : 1));
  const damage = Math.round((7 + 1.25 * L + 0.004 * L * L) * (boss ? 1.2 : 1));
  const castInterval = Math.max(0.85, 2.7 - 0.018 * L) * (boss ? 0.85 : 1);
  const projectileSpeed = 8.5 + 0.05 * L;
  const telegraph = Math.max(0.35, 0.75 - 0.003 * L);
  const coins = Math.round((15 + 6 * L + 0.15 * L * L) * (boss ? 3 : 1));
  const name = boss ? BOSS_NAMES[Math.min(BOSS_NAMES.length - 1, L / 5 - 1)] : `${tier.name} ${romanish(L)}`;
  return { level: L, boss, name, tier, hp, damage, castInterval, projectileSpeed, telegraph, coins };
}

function romanish(n: number): string {
  const suffixes = ['', 'of the East', 'of the Marsh', 'the Younger', 'of the Spire', 'of the Deep', 'the Bold', 'of the Vale', 'the Quiet'];
  return suffixes[n % suffixes.length];
}

// ---- enemy outfits and stages -----------------------------------------------------
export const HAT_STYLES = ['pointy', 'hood', 'crown', 'horns', 'wide', 'turban'] as const;
export type HatStyle = typeof HAT_STYLES[number];
export interface WizardLook { robe: string; hat: string; trim: string; skin: string; hatStyle: HatStyle; beard: boolean; cape: boolean }
const SKINS = ['#e8c39e', '#c68a5a', '#9ad0a8', '#d0a8ff', '#a0a8b8', '#f0d0b0'];
const TRIMS = ['#ffd23f', '#e8e8ff', '#ff9a5a', '#7df9ff'];

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

/** A deterministic outfit per level so no two neighbouring wizards look alike. */
export function enemyLook(def: EnemyDef): WizardLook {
  const L = def.level, t = def.tier;
  const hue = ((L * 37) % 5) * 0.06 - 0.12;
  const light = ((L * 13) % 3) * 0.05 - 0.05;
  const hatStyle: HatStyle = def.boss ? (L % 10 === 0 ? 'crown' : 'horns') : HAT_STYLES[(L * 7 + Math.floor(L / 7)) % HAT_STYLES.length];
  return {
    robe: shiftColor(t.robe, hue, light),
    hat: shiftColor(t.hat, hue + (L % 2 ? 0.04 : -0.04), light),
    trim: def.boss ? '#ffd23f' : TRIMS[(L * 3) % TRIMS.length],
    skin: SKINS[(L * 5 + Math.floor(L / 6)) % SKINS.length],
    hatStyle,
    beard: L % 3 !== 1,
    cape: def.boss || L % 2 === 0,
  };
}

export const PLAYER_LOOK: WizardLook = { robe: '#4a4fd0', hat: '#2e2fa8', trim: '#ffd23f', skin: '#e8c39e', hatStyle: 'pointy', beard: true, cape: true };

export type StageId = 'castle' | 'forest' | 'cave' | 'sanctum';
export const STAGE_NAMES: Record<StageId, string> = { castle: 'Castle Courtyard', forest: 'Ruined Glade', cave: 'Crystal Cavern', sanctum: 'Lava Sanctum' };
/** Regular levels rotate through three arenas; bosses always fight in the sanctum. */
export function stageForLevel(level: number, boss: boolean): StageId {
  if (boss) return 'sanctum';
  return (['castle', 'forest', 'cave'] as StageId[])[(level - 1) % 3];
}
/** Optional sky and fog overrides per stage (merged over the enemy tier palette). */
export const STAGE_THEME: Partial<Record<StageId, { sky: string; fog: string }>> = {
  sanctum: { sky: '#3a0a12', fog: '#a02a20' },
  cave: { sky: '#0a1030', fog: '#1a3a6a' },
};

export const TRAINING_DUMMY_HP = 1_000_000;
export const AD_REWARD = (level: number): number => 60 + 25 * level;
export const PLAYER_BASE = { hp: 100, mana: 100, regen: 10, iframes: 0.3, stamina: 100, staminaRegen: 22, dodgeCost: 30 };
export const DODGE_TIME = 0.14;

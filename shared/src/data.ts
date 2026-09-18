// Enemies, the level curve, upgrades and the economy. Spells live in spells.ts, gear in
// equipment.ts, elements in elements.ts and drops in loot.ts.
import { ELEMENT_BY_ID, type ElementId } from './elements';
import { HAT_STYLES, STAFF_STYLES, shiftColor, type HatStyle, type StaffStyle, type WizardLook } from './looks';

export const LANES = 3;
export const MAX_LEVEL = 500;
/** The map is cut into chapters so five hundred levels stay readable on a phone. */
export const CHAPTER_SIZE = 50;
export const CHAPTERS = MAX_LEVEL / CHAPTER_SIZE;
export function chapterOf(level: number): number { return Math.floor((Math.max(1, level) - 1) / CHAPTER_SIZE); }
/** Each chapter is named after the kind of wizard who lives there. */
export function chapterName(chapter: number): string {
  return TIERS[Math.min(TIERS.length - 1, chapter)].name + 's';
}

/**
 * A wizard's account level is simply how far up the tower they are: the level they are facing now.
 * One number, and it is the same number the campaign is already showing them.
 */
export function wizardLevel(best: number): number {
  return Math.min(MAX_LEVEL, Math.max(1, Math.floor(best) + 1));
}
export const ENEMY_Z = -13;   // distance between the two wizards in world units
export const LANE_X = [-1.7, 0, 1.7];

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

// ---- enemies ------------------------------------------------------------------
export interface EnemyTier {
  name: string; element: ElementId; robe: string; hat: string; trim: string; spell: string; sky: string; floor: string; fog: string;
}
export const TIERS: EnemyTier[] = [
  { name: 'Apprentice', element: 'arcane', robe: '#6a7fd8', hat: '#4a56b0', trim: '#e0e8ff', spell: '#8ab4ff', sky: '#2438a0', floor: '#3a4a90', fog: '#4a62c8' },
  { name: 'Hedge Wizard', element: 'nature', robe: '#4ea44a', hat: '#2f7a33', trim: '#e6ffb0', spell: '#a6ff5c', sky: '#1c6a4a', floor: '#2f6a3a', fog: '#3a9a6a' },
  { name: 'Pyromancer', element: 'fire', robe: '#e0481e', hat: '#a82a12', trim: '#ffd48a', spell: '#ff7a1a', sky: '#7a1a10', floor: '#6a2a1a', fog: '#c04a20' },
  { name: 'Frost Witch', element: 'frost', robe: '#4aa0e0', hat: '#2a6aa8', trim: '#eafcff', spell: '#8be9ff', sky: '#1a4a8a', floor: '#2a5a8a', fog: '#4a90d0' },
  { name: 'Storm Caller', element: 'storm', robe: '#6a4fd8', hat: '#4a32a8', trim: '#ffe98a', spell: '#d4c3ff', sky: '#2a1a7a', floor: '#3a2a80', fog: '#5a48c8' },
  { name: 'Necromancer', element: 'shadow', robe: '#3f6a48', hat: '#264a30', trim: '#b0ffb0', spell: '#7dff7d', sky: '#0f2a1a', floor: '#1e3a28', fog: '#2a7a4a' },
  { name: 'Illusionist', element: 'arcane', robe: '#c24fc0', hat: '#8a2f88', trim: '#ffd0f8', spell: '#ff8ff2', sky: '#5a1a70', floor: '#5a2a68', fog: '#b040c0' },
  { name: 'Warlock', element: 'fire', robe: '#9a2438', hat: '#6a1428', trim: '#ff9a9a', spell: '#ff4a4a', sky: '#4a0a18', floor: '#4a1a28', fog: '#a02040' },
  { name: 'Void Sorcerer', element: 'shadow', robe: '#4a3a8a', hat: '#2a1f5a', trim: '#d0a0ff', spell: '#b04dff', sky: '#180a3a', floor: '#2a1a4a', fog: '#6a30c0' },
  { name: 'Archmage', element: 'eclipse', robe: '#d0a030', hat: '#a07820', trim: '#fff6c8', spell: '#ffe066', sky: '#5a4010', floor: '#5a4a20', fog: '#c09a30' },
];

/** One returning epithet per lap of the boss roster, so deeper bosses are recognisably worse. */
export const BOSS_EPITHETS = ['Reborn', 'Unbound', 'Ascendant', 'Eternal'];

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
/** Every fiftieth level closes a chapter, and those bosses hit noticeably harder. */
export function isChapterBoss(level: number): boolean { return level % CHAPTER_SIZE === 0; }

/** Twenty named bosses, then the same names again wearing worse titles. */
export function bossName(level: number): string {
  const i = Math.max(0, Math.round(level / 5) - 1);
  const lap = Math.floor(i / BOSS_NAMES.length);
  const name = BOSS_NAMES[i % BOSS_NAMES.length];
  return lap === 0 ? name : `${name}, ${BOSS_EPITHETS[Math.min(BOSS_EPITHETS.length - 1, lap - 1)]}`;
}

/**
 * The difficulty curve, stretched over five hundred levels.
 *
 * The health curve is set from measured player damage (see server/src/campaigntest.ts), not from a
 * guess: a fully kitted wizard sustains about 250 damage a second, so level 500 is roughly five
 * and a half thousand health and a fight lasts around twenty seconds, or a minute against a
 * chapter lord. Enemy damage grows more slowly still (L^0.85), because the game is about dodging.
 */
export function enemyForLevel(level: number): EnemyDef {
  const L = Math.max(1, level);
  const boss = isBossLevel(L);
  const chapterBoss = isChapterBoss(L);
  const mult = chapterBoss ? 2.2 : boss ? 1.7 : 1;
  const tier = TIERS[Math.min(TIERS.length - 1, chapterOf(L))];
  const hp = Math.round((90 + 6 * L + 0.12 * Math.pow(L, 1.6)) * mult);
  const damage = Math.round((6 + 1.1 * Math.pow(L, 0.85)) * (boss ? 1.2 : 1));
  const castInterval = Math.max(0.8, 2.6 - 0.0036 * L) * (boss ? 0.85 : 1);
  const projectileSpeed = Math.min(18, 8.5 + 0.02 * L);
  const telegraph = Math.max(0.3, 0.75 - 0.0009 * L);
  const coins = Math.round((15 + 8 * L + 0.02 * Math.pow(L, 1.6)) * (chapterBoss ? 5 : boss ? 3 : 1));
  const name = boss ? bossName(L) : `${tier.name} ${romanish(L)}`;
  return { level: L, boss, name, tier, hp, damage, castInterval, projectileSpeed, telegraph, coins };
}

function romanish(n: number): string {
  const suffixes = ['', 'of the East', 'of the Marsh', 'the Younger', 'of the Spire', 'of the Deep', 'the Bold', 'of the Vale', 'the Quiet'];
  return suffixes[n % suffixes.length];
}

// ---- looks and stages -----------------------------------------------------------
const SKINS = ['#e8c39e', '#c68a5a', '#9ad0a8', '#d0a8ff', '#a0a8b8', '#f0d0b0'];
const TRIMS = ['#ffd23f', '#e8e8ff', '#ff9a5a', '#7df9ff'];

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
    staffStyle: STAFF_STYLES[(L * 5 + 2) % STAFF_STYLES.length],
    beard: L % 3 !== 1,
    cape: def.boss || L % 2 === 0,
  };
}

/** The hero's base colours; the equipped gear recolours these by element. */
export const PLAYER_LOOK: WizardLook = { robe: '#4a4fd0', hat: '#2e2fa8', trim: '#ffd23f', skin: '#e8c39e', hatStyle: 'pointy', staffStyle: 'claw', beard: true, cape: true };

/** Dresses the hero from the elements they are wearing. */
export function playerLookFrom(outfitElement: ElementId | null, hatElement: ElementId | null, hatStyle: HatStyle, staffElement: ElementId | null, staffStyle: StaffStyle = 'claw'): WizardLook {
  const robe = outfitElement ? ELEMENT_BY_ID[outfitElement].color : PLAYER_LOOK.robe;
  const hat = hatElement ? ELEMENT_BY_ID[hatElement].color : PLAYER_LOOK.hat;
  return {
    ...PLAYER_LOOK,
    robe: shiftColor(robe, 0, -0.18),
    hat: shiftColor(hat, 0, -0.26),
    trim: staffElement ? ELEMENT_BY_ID[staffElement].color : PLAYER_LOOK.trim,
    hatStyle,
    staffStyle,
  };
}

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

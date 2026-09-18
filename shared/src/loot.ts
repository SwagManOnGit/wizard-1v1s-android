// Where equipment comes from: level clears, boss kills and chests bought with coins.
import { EQUIPMENT, EQUIP_SLOTS, type EquipDef, type Rarity } from './equipment';
import { MUNDANE_ELEMENTS, type ElementId } from './elements';
import { Rng } from './rng';

export interface DropRoll { item: EquipDef; duplicate: boolean }

/** Chance that clearing a level drops anything at all. Bosses always drop. */
export function dropChance(level: number, boss: boolean, firstClear: boolean): number {
  if (boss) return 1;
  const base = firstClear ? 0.55 : 0.28;
  return Math.min(0.85, base + level * 0.0012);
}

/**
 * Rarity weights drift towards the top as the tower gets taller, but a level 1 player can still
 * get lucky: that early Mythic is the story they tell other players.
 */
export function rarityWeights(level: number, boss: boolean): number[] {
  // Stretched over the long campaign: the top of the drop table arrives around level 200, which
  // is roughly where a full Mythic set stops being a fantasy.
  const t = Math.min(1, level / 200);
  const w = [
    Math.max(4, 60 - 50 * t),
    30 + 5 * t,
    8 + 26 * t,
    1.5 + 14 * t,
    0.4 + 5 * t,
  ];
  if (boss) { w[0] *= 0.35; w[3] *= 2.2; w[4] *= 3; }
  return w;
}

function pickWeighted(weights: number[], rng: Rng): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}

export interface RollOptions {
  level: number;
  boss: boolean;
  /** Elements the player has attuned: their gear is twice as likely to appear. */
  owned: ElementId[];
  /** Force a single element (elemental chests). */
  element?: ElementId;
  minRarity?: Rarity;
  maxRarity?: Rarity;
  seed?: number;
}

export function rollItem(opts: RollOptions): EquipDef {
  const rng = new Rng(opts.seed ?? Math.floor(Math.random() * 0xffffffff));
  const weights = rarityWeights(opts.level, opts.boss).map((w, i) => {
    const r = (i + 1) as Rarity;
    if (opts.minRarity && r < opts.minRarity) return 0;
    if (opts.maxRarity && r > opts.maxRarity) return 0;
    return w;
  });
  const rarity = (pickWeighted(weights.some(w => w > 0) ? weights : [1, 1, 1, 1, 1], rng) + 1) as Rarity;

  let element = opts.element;
  if (!element) {
    const elWeights = MUNDANE_ELEMENTS.map(e => (opts.owned.includes(e) ? 2 : 1));
    element = MUNDANE_ELEMENTS[pickWeighted(elWeights, rng)];
  }
  const slot = EQUIP_SLOTS[Math.floor(rng.next() * EQUIP_SLOTS.length)].id;
  const id = `${element}_${slot}_${rarity}`;
  return EQUIPMENT.find(e => e.id === id) ?? EQUIPMENT[0];
}

/** Rolls the reward for finishing a level, or null when nothing drops. */
export function rollLevelDrop(level: number, boss: boolean, firstClear: boolean, owned: ElementId[]): EquipDef | null {
  if (Math.random() > dropChance(level, boss, firstClear)) return null;
  return rollItem({ level, boss, owned });
}

// ---- chests ---------------------------------------------------------------------
export interface ChestDef {
  id: string;
  name: string;
  price: number;
  items: number;
  minRarity?: Rarity;
  maxRarity?: Rarity;
  /** Elemental chests ask the player to pick the element first. */
  pickElement?: boolean;
  desc: string;
  /** Effective level used for the rarity curve, so chests stay worthwhile late. */
  level: number;
}

export const CHESTS: ChestDef[] = [
  { id: 'wood', name: 'Wooden Chest', price: 300, items: 1, maxRarity: 3, level: 20, desc: 'One piece of equipment, Worn to Rare.' },
  { id: 'silver', name: 'Silver Chest', price: 1100, items: 2, minRarity: 2, maxRarity: 4, level: 45, desc: 'Two pieces, Fine to Epic.' },
  { id: 'gold', name: 'Gold Chest', price: 3200, items: 3, minRarity: 3, level: 80, desc: 'Three pieces, Rare or better, with a real shot at Mythic.' },
  { id: 'elemental', name: 'Elemental Chest', price: 4500, items: 3, minRarity: 3, pickElement: true, level: 85,
    desc: 'Three pieces of one element you choose. The fastest way to complete a set.' },
];
export const CHEST_BY_ID: Record<string, ChestDef> = Object.fromEntries(CHESTS.map(c => [c.id, c]));

export function openChest(chest: ChestDef, owned: ElementId[], element?: ElementId): EquipDef[] {
  const out: EquipDef[] = [];
  for (let i = 0; i < chest.items; i++) {
    out.push(rollItem({
      level: chest.level, boss: false, owned,
      element: chest.pickElement ? element : undefined,
      minRarity: chest.minRarity, maxRarity: chest.maxRarity,
    }));
  }
  return out;
}

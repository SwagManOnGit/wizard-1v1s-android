// Equipment is no longer bought: it drops from levels and chests. Every piece belongs to an element,
// and how many pieces of one element you wear decides how deep that element's spell list opens up.
import { ATTUNING_RARITY, MUNDANE_ELEMENTS, type ElementId } from './elements';
import type { HatStyle, StaffStyle } from './looks';

export type EquipSlot = 'hat' | 'outfit' | 'staff' | 'shoes';
export const EQUIP_SLOTS: { id: EquipSlot; name: string }[] = [
  { id: 'hat', name: 'Hat' }, { id: 'outfit', name: 'Outfit' }, { id: 'staff', name: 'Staff' }, { id: 'shoes', name: 'Shoes' },
];
export const SET_SIZE = EQUIP_SLOTS.length;

export type Rarity = 1 | 2 | 3 | 4 | 5;
export const RARITY_NAMES: Record<Rarity, string> = { 1: 'Worn', 2: 'Fine', 3: 'Rare', 4: 'Epic', 5: 'Mythic' };
export const RARITY_COLORS: Record<Rarity, string> = { 1: '#b8b8c8', 2: '#6fd67a', 3: '#5aa8ff', 4: '#c77dff', 5: '#ffb03d' };
/** Coins a duplicate is melted into. */
export const DUPLICATE_VALUE: Record<Rarity, number> = { 1: 40, 2: 110, 3: 300, 4: 900, 5: 2600 };

export interface EquipDef {
  id: string;
  slot: EquipSlot;
  element: ElementId;
  rarity: Rarity;
  name: string;
  desc: string;
  hatStyle?: HatStyle;
  staffStyle?: StaffStyle;
  power?: number; hp?: number; mana?: number; regen?: number; costMult?: number;
  healMult?: number; shieldMult?: number; coinMult?: number; revive?: number;
  stamina?: number; staminaRegen?: number; dodgeCostMult?: number;
}

/** Which 3D staff head an element's staff shows. */
export const ELEMENT_STAFF: Record<ElementId, StaffStyle> = {
  arcane: 'claw', fire: 'blade', frost: 'crystal', storm: 'ring', nature: 'leaf', shadow: 'skull',
  light: 'sun', earth: 'hammer', chrono: 'hourglass', eclipse: 'ring',
};

/** Which 3D hat a wizard wears when this element's headgear is equipped. */
export const ELEMENT_HAT: Record<ElementId, HatStyle> = {
  arcane: 'pointy', fire: 'wide', frost: 'hood', storm: 'crown', nature: 'turban', shadow: 'horns',
  light: 'halo', earth: 'helm', chrono: 'veil', eclipse: 'crown',
};

const ADJECTIVES: Record<ElementId, [string, string, string, string, string]> = {
  arcane: ['Apprentice', 'Scholar\'s', 'Runed', 'Astral', 'Archmage'],
  fire: ['Ember', 'Cinder', 'Blazing', 'Infernal', 'Phoenix'],
  frost: ['Frosted', 'Glacial', 'Rimebound', 'Everwinter', 'Absolute'],
  storm: ['Breezy', 'Charged', 'Thunderborn', 'Tempest', 'Skyforged'],
  nature: ['Mossy', 'Verdant', 'Thornwoven', 'Wildheart', 'Worldroot'],
  shadow: ['Dusky', 'Shrouded', 'Nightbound', 'Umbral', 'Voidforged'],
  light: ['Candle', 'Gilded', 'Radiant', 'Seraph', 'Dawnforged'],
  earth: ['Clay', 'Stonecut', 'Granite', 'Mountainborn', 'Worldstone'],
  chrono: ['Ticking', 'Winding', 'Hourbound', 'Aeon', 'Timeless'],
  eclipse: ['Dimmed', 'Waning', 'Penumbral', 'Totality', 'Eclipsed'],
};

const SLOT_NOUNS: Record<EquipSlot, [string, string, string, string, string]> = {
  hat: ['Cap', 'Hat', 'Hat', 'Crown', 'Diadem'],
  outfit: ['Tunic', 'Robe', 'Robe', 'Mantle', 'Vestments'],
  staff: ['Stick', 'Staff', 'Staff', 'Sceptre', 'Rod'],
  shoes: ['Shoes', 'Boots', 'Boots', 'Striders', 'Greaves'],
};

function statsFor(slot: EquipSlot, r: Rarity): Partial<EquipDef> {
  switch (slot) {
    case 'hat': return { mana: 15 * r, regen: 0.6 * r, ...(r === 5 ? { coinMult: 1.2 } : {}) };
    case 'outfit': return { hp: 35 * r, shieldMult: 1 + 0.03 * r, ...(r === 5 ? { revive: 0.3 } : {}) };
    case 'staff': return { power: 0.05 * r, costMult: 1 - 0.015 * r, ...(r === 5 ? { healMult: 1.15 } : {}) };
    case 'shoes': return { stamina: 12 * r, staminaRegen: 1.5 * r, dodgeCostMult: 1 - 0.03 * r };
  }
}

function describe(slot: EquipSlot, r: Rarity): string {
  const s = statsFor(slot, r);
  const bits: string[] = [];
  if (s.hp) bits.push(`+${s.hp} health`);
  if (s.mana) bits.push(`+${s.mana} mana`);
  if (s.regen) bits.push(`+${s.regen.toFixed(1)} mana regen`);
  if (s.power) bits.push(`+${Math.round(s.power * 100)}% spell power`);
  if (s.costMult && s.costMult < 1) bits.push(`${Math.round((1 - s.costMult) * 100)}% cheaper spells`);
  if (s.shieldMult && s.shieldMult > 1) bits.push(`+${Math.round((s.shieldMult - 1) * 100)}% shields`);
  if (s.healMult && s.healMult > 1) bits.push(`+${Math.round((s.healMult - 1) * 100)}% healing`);
  if (s.stamina) bits.push(`+${s.stamina} stamina`);
  if (s.staminaRegen) bits.push(`+${s.staminaRegen.toFixed(1)} stamina regen`);
  if (s.dodgeCostMult && s.dodgeCostMult < 1) bits.push(`${Math.round((1 - s.dodgeCostMult) * 100)}% cheaper dodges`);
  if (s.coinMult && s.coinMult > 1) bits.push(`+${Math.round((s.coinMult - 1) * 100)}% coins`);
  if (s.revive) bits.push(`revive once at ${Math.round(s.revive * 100)}% health`);
  return bits.join(', ');
}

function build(): EquipDef[] {
  const out: EquipDef[] = [];
  for (const element of MUNDANE_ELEMENTS) {
    for (const { id: slot } of EQUIP_SLOTS) {
      for (let r = 1 as Rarity; r <= 5; r = (r + 1) as Rarity) {
        out.push({
          id: `${element}_${slot}_${r}`,
          slot, element, rarity: r,
          name: `${ADJECTIVES[element][r - 1]} ${SLOT_NOUNS[slot][r - 1]}`,
          desc: describe(slot, r),
          ...(slot === 'hat' ? { hatStyle: ELEMENT_HAT[element] } : {}),
          ...(slot === 'staff' ? { staffStyle: ELEMENT_STAFF[element] } : {}),
          ...statsFor(slot, r),
        });
      }
    }
  }
  return out;
}

export const EQUIPMENT: EquipDef[] = build();
export const EQUIP_BY_ID: Record<string, EquipDef> = Object.fromEntries(EQUIPMENT.map(e => [e.id, e]));
/** What a brand new wizard is wearing. */
export const STARTING_EQUIPMENT = ['arcane_hat_1', 'arcane_outfit_1', 'arcane_staff_1', 'arcane_shoes_1'];

// ---- set bonuses ----------------------------------------------------------------
export interface SetBonus { pieces: number; name: string; desc: string; power?: number; hpMult?: number; mana?: number; regen?: number }
export const SET_BONUSES: SetBonus[] = [
  { pieces: 2, name: 'Attuned', desc: '+8% spell power', power: 0.08 },
  { pieces: 3, name: 'Devoted', desc: '+8% spell power, +25 mana and +2 regen', power: 0.08, mana: 25, regen: 2 },
  { pieces: 4, name: 'Ascendant', desc: '+18% spell power, +15% health, and the element opens its deepest secrets', power: 0.18, hpMult: 1.15 },
];

/**
 * How many pieces of each element are currently worn, counting only gear good enough to channel
 * (see ATTUNING_RARITY): the threadbare starter kit gives no attunement at all.
 */
export function affinities(equipped: Partial<Record<EquipSlot, string>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { id: slot } of EQUIP_SLOTS) {
    const item = equipped[slot] ? EQUIP_BY_ID[equipped[slot] as string] : undefined;
    if (item && item.rarity >= ATTUNING_RARITY) out[item.element] = (out[item.element] ?? 0) + 1;
  }
  return out;
}

export function affinityOf(equipped: Partial<Record<EquipSlot, string>>, element: ElementId): number {
  return affinities(equipped)[element] ?? 0;
}

/** The strongest set bonus currently active, if any. */
export function activeSetBonus(equipped: Partial<Record<EquipSlot, string>>): { element: ElementId; bonus: SetBonus } | null {
  const aff = affinities(equipped);
  let best: { element: ElementId; bonus: SetBonus } | null = null;
  for (const [el, n] of Object.entries(aff)) {
    for (const b of SET_BONUSES) {
      if (n >= b.pieces && (!best || b.pieces > best.bonus.pieces)) best = { element: el as ElementId, bonus: b };
    }
  }
  return best;
}

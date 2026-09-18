// Owning things: gear that drops, elements that are attuned, and the look that results.
import {
  ELEMENT_BY_ID, EQUIP_BY_ID, EQUIP_SLOTS, DUPLICATE_VALUE, PLAYER_LOOK, playerLookFrom,
  type Attunement, type ElementId, type EquipDef, type EquipSlot, type WizardLook,
} from '@wizard/shared';
import type { SaveData } from '../save';

export interface GrantResult { item: EquipDef; isNew: boolean; coins: number; upgrade: boolean }

/**
 * Adds a dropped item. Duplicates melt into coins instead of cluttering the bag, and anything
 * strictly better than what is worn in that slot is equipped straight away.
 */
export function grantItem(save: SaveData, item: EquipDef): GrantResult {
  const isNew = !save.inventory.includes(item.id);
  let coins = 0;
  if (isNew) {
    save.inventory.push(item.id);
    save.stats.drops++;
  } else {
    coins = DUPLICATE_VALUE[item.rarity];
    save.coins += coins;
    save.earned += coins;
  }
  const current = save.equipped[item.slot] ? EQUIP_BY_ID[save.equipped[item.slot] as string] : undefined;
  const upgrade = isNew && (!current || item.rarity > current.rarity);
  if (upgrade) save.equipped[item.slot] = item.id;
  return { item, isNew, coins, upgrade };
}

export function equipItem(save: SaveData, id: string): boolean {
  const item = EQUIP_BY_ID[id];
  if (!item || !save.inventory.includes(id)) return false;
  save.equipped[item.slot] = id;
  return true;
}

export function ownedInSlot(save: SaveData, slot: EquipSlot): EquipDef[] {
  return save.inventory
    .map(id => EQUIP_BY_ID[id])
    .filter(e => e && e.slot === slot)
    .sort((a, b) => b.rarity - a.rarity || a.element.localeCompare(b.element));
}

export function attunement(save: SaveData): Attunement {
  return { elements: save.elements, equipped: save.equipped };
}

/** Elements the player can actually buy right now, cheapest first. */
export function canAttune(save: SaveData, el: ElementId): boolean {
  return !save.elements.includes(el) && save.coins >= ELEMENT_BY_ID[el].price && ELEMENT_BY_ID[el].price > 0;
}

export function attune(save: SaveData, el: ElementId): boolean {
  const def = ELEMENT_BY_ID[el];
  if (def.price <= 0 || save.elements.includes(el) || save.coins < def.price) return false;
  save.coins -= def.price;
  save.elements.push(el);
  return true;
}

/** The hero's appearance, driven entirely by what they are wearing. */
export function playerLook(save: SaveData): WizardLook {
  const hat = save.equipped.hat ? EQUIP_BY_ID[save.equipped.hat] : undefined;
  const outfit = save.equipped.outfit ? EQUIP_BY_ID[save.equipped.outfit] : undefined;
  const staff = save.equipped.staff ? EQUIP_BY_ID[save.equipped.staff] : undefined;
  return playerLookFrom(outfit?.element ?? null, hat?.element ?? null, hat?.hatStyle ?? PLAYER_LOOK.hatStyle, staff?.element ?? null, staff?.staffStyle ?? PLAYER_LOOK.staffStyle);
}

/** Short "2 of 4 Fire" style summary of the worn set, for the gear header. */
export function setSummary(save: SaveData): { element: ElementId; count: number } | null {
  const counts: Partial<Record<ElementId, number>> = {};
  for (const s of EQUIP_SLOTS) {
    const id = save.equipped[s.id];
    const item = id ? EQUIP_BY_ID[id] : undefined;
    if (item) counts[item.element] = (counts[item.element] ?? 0) + 1;
  }
  let best: { element: ElementId; count: number } | null = null;
  for (const [el, n] of Object.entries(counts) as [ElementId, number][]) {
    if (!best || n > best.count) best = { element: el, count: n };
  }
  return best;
}

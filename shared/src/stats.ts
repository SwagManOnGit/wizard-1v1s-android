// Derived combat stats. Lives in shared so the server can validate a duellist's numbers.
import { BASE_SLOTS, EQUIP_BY_ID, EQUIP_SLOTS, PLAYER_BASE, UPGRADES, type EquipSlot } from './data';

export interface PlayerStats {
  maxHp: number; maxMana: number; regen: number; power: number; healMult: number; shieldMult: number;
  iframes: number; costMult: number; coinMult: number; slots: number; revive: number;
  maxStamina: number; staminaRegen: number; dodgeCost: number;
}

export interface Build {
  upgrades: Record<string, number>;
  equipped: Partial<Record<EquipSlot, string>>;
}

export function computeStats(b: Build): PlayerStats {
  const r = (id: string): number => Math.min(UPGRADES.find(u => u.id === id)?.max ?? 0, Math.max(0, Math.floor(b.upgrades[id] ?? 0)));
  const st: PlayerStats = {
    maxHp: PLAYER_BASE.hp + 20 * r('vitality'),
    maxMana: PLAYER_BASE.mana + 10 * r('wisdom'),
    regen: PLAYER_BASE.regen + 1.5 * r('focus'),
    power: 1 + 0.08 * r('power'),
    healMult: 1 + 0.1 * r('resolve'),
    shieldMult: 1 + 0.1 * r('resolve'),
    iframes: PLAYER_BASE.iframes + 0.07 * r('agility'),
    costMult: 1,
    coinMult: 1,
    slots: BASE_SLOTS + r('grimoire'),
    revive: 0,
    maxStamina: PLAYER_BASE.stamina + 12 * r('endurance'),
    staminaRegen: PLAYER_BASE.staminaRegen,
    dodgeCost: PLAYER_BASE.dodgeCost,
  };
  for (const slot of EQUIP_SLOTS) {
    const id = b.equipped[slot.id];
    const e = id ? EQUIP_BY_ID[id] : undefined;
    if (!e || e.slot !== slot.id) continue;
    st.power += e.power ?? 0;
    st.maxHp += e.hp ?? 0;
    st.maxMana += e.mana ?? 0;
    st.regen += e.regen ?? 0;
    st.costMult *= e.costMult ?? 1;
    st.healMult *= e.healMult ?? 1;
    st.shieldMult *= e.shieldMult ?? 1;
    st.coinMult *= e.coinMult ?? 1;
    st.revive = Math.max(st.revive, e.revive ?? 0);
    st.maxStamina += e.stamina ?? 0;
    st.staminaRegen += e.staminaRegen ?? 0;
    st.dodgeCost *= e.dodgeCostMult ?? 1;
  }
  st.dodgeCost = Math.round(st.dodgeCost);
  return st;
}

/** Ranked duels use a fixed, fair build so progression never decides a match. */
export const RANKED_BUILD: Build = { upgrades: { vitality: 5, wisdom: 3, focus: 3, power: 4, resolve: 2, agility: 1, endurance: 3 }, equipped: {} };

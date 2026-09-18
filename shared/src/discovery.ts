// The discovery rules: which spells the world is currently willing to reveal to you.
//
// A spell shows itself only when you are attuned to its element AND wearing enough of that element.
// Tier 5 needs a complete four-piece set, which is why those spells are expected to stay rumours
// for a long time after release.
import { MUNDANE_ELEMENTS, TIER_AFFINITY, TIER_THRESHOLD, type ElementId, type GlyphTier } from './elements';
import { affinities, SET_SIZE, type EquipSlot } from './equipment';
import { LISTED_SPELLS, SPELLS, type SpellDef } from './spells';

export interface Attunement {
  /** Elements the player has paid to attune to. Arcane is always present. */
  elements: ElementId[];
  equipped: Partial<Record<EquipSlot, string>>;
}

/** Eclipse is never bought: it answers only once every other element is attuned. */
export function isAttuned(att: Attunement, el: ElementId): boolean {
  if (el === 'eclipse') return MUNDANE_ELEMENTS.every(m => att.elements.includes(m));
  return att.elements.includes(el);
}

/**
 * Pieces of the spell's element currently worn. Eclipse has no gear of its own, so it accepts a
 * complete set of any single element as proof of mastery.
 */
export function affinityFor(att: Attunement, el: ElementId): number {
  const aff = affinities(att.equipped);
  if (el === 'eclipse') return Math.max(0, ...Object.values(aff));
  return aff[el] ?? 0;
}

export function requiredAffinity(tier: GlyphTier): number { return TIER_AFFINITY[tier]; }
export function discoveryThreshold(tier: GlyphTier): number { return TIER_THRESHOLD[tier]; }

/** Can this spell be found right now? */
export function canDiscover(spell: SpellDef, att: Attunement): boolean {
  return isAttuned(att, spell.element) && affinityFor(att, spell.element) >= requiredAffinity(spell.tier);
}

/** Every spell the current loadout could reveal, minus the ones already known. */
export function discoverable(att: Attunement, known: string[]): SpellDef[] {
  const have = new Set(known);
  return SPELLS.filter(s => !have.has(s.id) && canDiscover(s, att));
}

export type LockReason = 'known' | 'ready' | 'element' | 'affinity';

export interface SpellStatus {
  spell: SpellDef;
  known: boolean;
  reason: LockReason;
  /** Pieces of the element worn, and how many are needed. */
  affinity: number;
  needed: number;
}

export function spellStatus(spell: SpellDef, att: Attunement, known: string[]): SpellStatus {
  const affinity = affinityFor(att, spell.element);
  const needed = requiredAffinity(spell.tier);
  if (known.includes(spell.id)) return { spell, known: true, reason: 'known', affinity, needed };
  if (!isAttuned(att, spell.element)) return { spell, known: false, reason: 'element', affinity, needed };
  if (affinity < needed) return { spell, known: false, reason: 'affinity', affinity, needed };
  return { spell, known: false, reason: 'ready', affinity, needed };
}

/** One line telling the player exactly what is standing between them and this spell. */
export function requirementText(st: SpellStatus, elementName: string): string {
  switch (st.reason) {
    case 'known': return 'Known';
    case 'element': return st.spell.element === 'eclipse' ? 'Attune to every other element' : `Attune to ${elementName}`;
    case 'affinity': return st.needed >= SET_SIZE
      ? `Wear a full ${elementName} set, Fine or better (${st.affinity} of ${SET_SIZE})`
      : `Wear ${st.needed} ${elementName} piece${st.needed === 1 ? '' : 's'}, Fine or better (${st.affinity} of ${st.needed})`;
    case 'ready': return 'Draw it to discover it';
  }
}

/**
 * Progress for the grimoire header, counted per element.
 *
 * Secret spells are not part of any total until the player has found one: the counter must never
 * read "6 / 87" and quietly admit that fifteen spells exist which the codex refuses to name.
 */
export function discoveryProgress(known: string[]): { found: number; total: number; secrets: number; byElement: Record<string, { found: number; total: number }> } {
  const have = new Set(known);
  const byElement: Record<string, { found: number; total: number }> = {};
  let found = 0, secrets = 0;
  for (const s of SPELLS) {
    const e = (byElement[s.element] ??= { found: 0, total: 0 });
    const listed = !s.secret || have.has(s.id);
    if (listed) e.total++;
    if (have.has(s.id)) {
      e.found++; found++;
      if (s.secret) secrets++;
    }
  }
  return { found, total: LISTED_SPELLS + secrets, secrets, byElement };
}

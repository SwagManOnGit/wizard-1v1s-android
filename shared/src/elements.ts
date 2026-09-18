// Elements are the spine of the new progression: spells belong to an element, equipment is forged
// from an element, and how much of that element you wear decides how deep its secrets go.

export type ElementId = 'arcane' | 'fire' | 'frost' | 'storm' | 'nature' | 'shadow' | 'eclipse';

export interface ElementDef {
  id: ElementId;
  name: string;
  color: string;
  /** Coins to attune. 0 = you start with it, -1 = it cannot be bought at any price. */
  price: number;
  /** Eclipse is never sold: it answers only to a wizard who has mastered every other element. */
  secret?: boolean;
  motto: string;
  desc: string;
}

export const ELEMENTS: ElementDef[] = [
  { id: 'arcane', name: 'Arcane', color: '#c9a0ff', price: 0, motto: 'The first language.',
    desc: 'The element every apprentice is born knowing. Balanced, reliable, and full of quiet depth.' },
  { id: 'fire', name: 'Fire', color: '#ff7a1a', price: 1200, motto: 'Burn first, ask later.',
    desc: 'Raw damage and lingering burns. The fastest way to end a duel, and the fastest way to lose one.' },
  { id: 'frost', name: 'Frost', color: '#7fe3ff', price: 2000, motto: 'Patience is a weapon.',
    desc: 'Slows, freezes and shatters. Control the tempo and the kill takes care of itself.' },
  { id: 'storm', name: 'Storm', color: '#ffe066', price: 3000, motto: 'Faster than thought.',
    desc: 'Bolts that arrive almost before you finish the glyph. Punishes a slow dodge.' },
  { id: 'nature', name: 'Nature', color: '#7dff6a', price: 4200, motto: 'Everything grows. Everything rots.',
    desc: 'Poison, regrowth and entanglement. Wins the long fight.' },
  { id: 'shadow', name: 'Shadow', color: '#b04dff', price: 6000, motto: 'What is taken is kept.',
    desc: 'Life stealing, shield piercing, and spells that simply refuse to be blocked.' },
  { id: 'eclipse', name: 'Eclipse', color: '#ff4fd8', price: -1, secret: true, motto: 'When all six align.',
    desc: 'No one sells this. It is said to answer a wizard who has attuned to every other element, and who knows what to draw.' },
];

export const ELEMENT_BY_ID: Record<ElementId, ElementDef> = Object.fromEntries(ELEMENTS.map(e => [e.id, e])) as Record<ElementId, ElementDef>;
export const BUYABLE_ELEMENTS = ELEMENTS.filter(e => e.price > 0);
/** The six that must all be attuned before Eclipse will answer. */
export const MUNDANE_ELEMENTS: ElementId[] = ELEMENTS.filter(e => !e.secret).map(e => e.id);
export const STARTING_ELEMENTS: ElementId[] = ['arcane'];

/**
 * How hard a glyph is to stumble upon, and therefore how much of an element you must wear
 * before that spell will reveal itself. Tier 5 needs a full four-piece set of the element.
 */
export type GlyphTier = 1 | 2 | 3 | 4 | 5;
export const TIER_NAMES: Record<GlyphTier, string> = {
  1: 'Common', 2: 'Uncommon', 3: 'Obscure', 4: 'Forbidden', 5: 'Mythic',
};
/**
 * Equipped pieces of the spell's element needed before it can be discovered at all.
 * Threadbare starter gear does not count towards this (see ATTUNING_RARITY), so the first two
 * tiers are open to everyone and the Mythic really does need a complete, real set.
 */
export const TIER_AFFINITY: Record<GlyphTier, number> = { 1: 0, 2: 0, 3: 1, 4: 2, 5: 4 };
/** Worn (rarity 1) gear is too threadbare to channel an element. */
export const ATTUNING_RARITY = 2;
/** Recogniser confidence a stroke must clear to count as a discovery, per tier. */
export const TIER_THRESHOLD: Record<GlyphTier, number> = { 1: 0.78, 2: 0.80, 3: 0.82, 4: 0.84, 5: 0.86 };

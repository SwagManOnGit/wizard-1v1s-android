// Every spell in the game. Nothing here is bought: spells are *discovered* by drawing their glyph
// while attuned to the right element, so this table is also the game's secret list.
//
// tier 1  anyone will stumble on it
// tier 2  a deliberate guess
// tier 3  needs the element half worn
// tier 4  needs three matching pieces and a steady hand
// tier 5  needs a full four-piece set of the element; these are meant to stay unfound for a long time
import type { ElementId, GlyphTier } from './elements';
import type { GlyphId } from './glyphs';

export type SpellKind = 'attack' | 'defense' | 'heal' | 'utility';

export interface SpellDef {
  id: string;
  name: string;
  element: ElementId;
  tier: GlyphTier;
  glyph: GlyphId;
  kind: SpellKind;
  cost: number;          // mana
  color: string;         // projectiles, particles and icons
  desc: string;
  /** Shown in the grimoire before the spell is found. Deliberately vague at high tiers. */
  hint: string;
  /** True for the handful of spells a new player already knows. */
  starter?: boolean;
  cooldown?: number;
  damage?: number;
  hits?: number;
  speed?: number;
  pierce?: boolean;
  lifesteal?: number;
  dot?: { perSec: number; dur: number };
  slow?: { factor: number; dur: number };
  freeze?: number;
  interrupt?: boolean;
  shield?: { amount: number; dur: number };
  heal?: number;
  hot?: { perSec: number; dur: number };
  cleanse?: boolean;
  reflect?: number;
  phase?: { charges: number; dur: number };
  mana?: number;
}

export const SPELLS: SpellDef[] = [
  // ---------------- ARCANE : the element everyone starts with ----------------
  { id: 'spark', name: 'Spark', element: 'arcane', tier: 1, glyph: 'line-v', kind: 'attack', cost: 8, color: '#ffe066', damage: 12, speed: 22,
    starter: true, desc: 'A quick jolt. Cheap and fast.', hint: 'The first thing any apprentice draws.' },
  { id: 'arcaneorb', name: 'Arcane Orb', element: 'arcane', tier: 1, glyph: 'circle', kind: 'attack', cost: 22, color: '#c9a0ff', damage: 30,
    starter: true, desc: 'A sphere of raw magic. Solid damage for the mana.', hint: 'Round and simple.' },
  { id: 'ward', name: 'Ward', element: 'arcane', tier: 1, glyph: 'caret', kind: 'defense', cost: 25, color: '#6ea8ff',
    shield: { amount: 35, dur: 6 }, starter: true, desc: 'A barrier that absorbs 35 damage for 6s.', hint: 'A roof over your head.' },
  { id: 'mend', name: 'Mend', element: 'arcane', tier: 2, glyph: 'heart', kind: 'heal', cost: 30, color: '#7dff9b', heal: 25,
    starter: true, desc: 'Restores 25 health.', hint: 'Draw what you want to keep beating.' },
  { id: 'missiles', name: 'Arcane Missiles', element: 'arcane', tier: 2, glyph: 'w', kind: 'attack', cost: 30, color: '#e08cff', damage: 15, hits: 3,
    desc: 'Three homing missiles, 15 damage each.', hint: 'Three darts need three valleys.' },
  { id: 'surge', name: 'Mana Surge', element: 'arcane', tier: 3, glyph: 'u', kind: 'utility', cost: 0, color: '#66d9ff', cooldown: 14, mana: 55,
    desc: 'Instantly restores 55 mana. 14s cooldown.', hint: 'A cup, to be filled.' },
  { id: 'reflect', name: 'Mirror Shell', element: 'arcane', tier: 3, glyph: 'c', kind: 'defense', cost: 40, color: '#e6f2ff', cooldown: 8, reflect: 4,
    desc: 'For 4s enemy spells bounce straight back at them.', hint: 'Half a circle turns a spell around.' },
  { id: 'greatward', name: 'Greater Ward', element: 'arcane', tier: 3, glyph: 'shieldshape', kind: 'defense', cost: 45, color: '#4f8dff',
    shield: { amount: 95, dur: 8 }, desc: 'A mighty barrier absorbing 95 damage for 8s.', hint: 'What a knight hides behind.' },
  { id: 'phase', name: 'Phase Step', element: 'arcane', tier: 4, glyph: 'l', kind: 'defense', cost: 28, color: '#c4c4ff', cooldown: 10,
    phase: { charges: 2, dur: 6 }, desc: 'The next 2 enemy spells pass right through you.', hint: 'Step down, then aside.' },
  { id: 'timewarp', name: 'Time Warp', element: 'arcane', tier: 4, glyph: 'hourglass', kind: 'utility', cost: 38, color: '#ffd166', cooldown: 6,
    slow: { factor: 0.45, dur: 6 }, desc: 'Slows the enemy\'s casting by more than half for 6s.', hint: 'Sand runs both ways.' },
  { id: 'sealing', name: 'Rune of Sealing', element: 'arcane', tier: 5, glyph: 'pentacle', kind: 'defense', cost: 60, color: '#d8c0ff', cooldown: 16,
    shield: { amount: 150, dur: 10 }, reflect: 3, cleanse: true,
    desc: 'A sealed circle: absorbs 150, reflects for 3s and burns away every curse.', hint: 'A star that never leaves its ring.' },

  // ---------------- FIRE ----------------
  { id: 'fireball', name: 'Fireball', element: 'fire', tier: 1, glyph: 'triangle', kind: 'attack', cost: 24, color: '#ff7a1a', damage: 34,
    desc: 'The classic. Heavy for its cost.', hint: 'A flame has three sides.' },
  { id: 'cinder', name: 'Cinder', element: 'fire', tier: 1, glyph: 'v', kind: 'attack', cost: 10, color: '#ffb066', damage: 14, speed: 24,
    dot: { perSec: 3, dur: 3 }, desc: 'A small ember that keeps burning.', hint: 'A spark falling into a notch.' },
  { id: 'flamewall', name: 'Flame Wall', element: 'fire', tier: 2, glyph: 'square', kind: 'defense', cost: 34, color: '#ff8a3d',
    shield: { amount: 55, dur: 5 }, dot: { perSec: 6, dur: 4 }, desc: 'A burning barrier: absorbs 55 and scorches whoever shot it.', hint: 'Four walls of fire.' },
  { id: 'embercoil', name: 'Ember Coil', element: 'fire', tier: 3, glyph: 'coil', kind: 'attack', cost: 30, color: '#ff6a2a', damage: 14,
    dot: { perSec: 14, dur: 5 }, desc: 'Wraps the enemy in fire: 14 a second for 5s.', hint: 'Fire loops as it travels.' },
  { id: 'inferno', name: 'Inferno', element: 'fire', tier: 3, glyph: 'infinity', kind: 'attack', cost: 48, color: '#ff4d2e', damage: 40,
    dot: { perSec: 12, dur: 4 }, desc: '40 damage and 12 a second for 4s.', hint: 'A fire that feeds itself, forever.' },
  { id: 'meteor', name: 'Meteor', element: 'fire', tier: 4, glyph: 'star', kind: 'attack', cost: 65, color: '#ff9d3c', damage: 125, speed: 10,
    desc: 'Slow to arrive, devastating when it does.', hint: 'Something falling from very far away.' },
  { id: 'phoenix', name: 'Phoenix Rite', element: 'fire', tier: 5, glyph: 'rose3', kind: 'heal', cost: 62, color: '#ff5a2a', cooldown: 20,
    heal: 90, damage: 60, cleanse: true, desc: 'Reborn in flame: heals 90, cleanses, and burns the enemy for 60.', hint: 'Three petals of flame, and it rises again.' },

  // ---------------- FROST ----------------
  { id: 'iceshard', name: 'Ice Shard', element: 'frost', tier: 1, glyph: 'check', kind: 'attack', cost: 20, color: '#7fe3ff', damage: 22, speed: 19,
    slow: { factor: 0.6, dur: 3 }, desc: 'Chills the enemy, slowing their casting for 3s.', hint: 'A shard is a stroke that turns once.' },
  { id: 'tidal', name: 'Tidal Wave', element: 'frost', tier: 2, glyph: 'wave', kind: 'attack', cost: 44, color: '#4fc3ff', damage: 52, interrupt: true, speed: 14,
    desc: 'A crashing wave that knocks the enemy out of their cast.', hint: 'Water remembers its own shape.' },
  { id: 'frostnova', name: 'Frost Nova', element: 'frost', tier: 2, glyph: 'keyhole', kind: 'attack', cost: 40, color: '#b8f4ff', damage: 30,
    freeze: 2, interrupt: true, desc: 'Freezes the enemy solid for 2s, cancelling their cast.', hint: 'A lock, and the ice that fills it.' },
  { id: 'glacier', name: 'Glacier', element: 'frost', tier: 3, glyph: 'star6', kind: 'defense', cost: 46, color: '#9ae6ff',
    shield: { amount: 110, dur: 9 }, slow: { factor: 0.75, dur: 4 }, desc: 'A wall of ice absorbing 110, and the cold slows them too.', hint: 'Every one of them has six arms.' },
  { id: 'blizzard', name: 'Blizzard', element: 'frost', tier: 3, glyph: 'zigzag4', kind: 'attack', cost: 44, color: '#cdf4ff', damage: 16, hits: 3,
    slow: { factor: 0.5, dur: 4 }, desc: 'Three freezing volleys that halve their casting speed.', hint: 'Snow falls in layers, not lines.' },
  { id: 'absolutezero', name: 'Absolute Zero', element: 'frost', tier: 4, glyph: 'star8', kind: 'attack', cost: 58, color: '#e8fbff', damage: 45,
    freeze: 3.5, interrupt: true, desc: 'Everything stops. 45 damage and a 3.5s freeze.', hint: 'Eight points, drawn without lifting.' },
  { id: 'rime', name: 'Rime Sigil', element: 'frost', tier: 5, glyph: 'sigil1', kind: 'attack', cost: 70, color: '#bff0ff', damage: 80,
    freeze: 3, slow: { factor: 0.4, dur: 8 }, pierce: true, desc: 'The old sign of winter: 80 piercing damage, a freeze and a long, deep chill.', hint: 'Carved above doors in the frozen north. Few remember the shape.' },

  // ---------------- STORM ----------------
  { id: 'lightning', name: 'Lightning', element: 'storm', tier: 1, glyph: 'bolt', kind: 'attack', cost: 32, color: '#ffe066', damage: 48, speed: 40,
    desc: 'Strikes almost instantly for heavy damage.', hint: 'Draw the thing itself.' },
  { id: 'gust', name: 'Gust', element: 'storm', tier: 1, glyph: 'line-h', kind: 'attack', cost: 6, color: '#d8fff4', damage: 16, speed: 30,
    desc: 'Blindingly fast and nearly free.', hint: 'Wind travels sideways.' },
  { id: 'chain', name: 'Chain Lightning', element: 'storm', tier: 2, glyph: 'z', kind: 'attack', cost: 46, color: '#8ef3ff', damage: 66, speed: 34,
    desc: 'Arcing power. Big damage, fast.', hint: 'Lightning that changes its mind. Twice.' },
  { id: 'thunderclap', name: 'Thunderclap', element: 'storm', tier: 2, glyph: 'n', kind: 'attack', cost: 34, color: '#fff3a8', damage: 30, interrupt: true, speed: 38,
    desc: 'A crack of sound that interrupts the enemy mid-cast.', hint: 'Up, across, and up again.' },
  { id: 'tempest', name: 'Tempest', element: 'storm', tier: 3, glyph: 'sqspiral', kind: 'attack', cost: 50, color: '#a8f0ff', damage: 22, hits: 3, speed: 30,
    desc: 'Three fast bolts from a turning sky.', hint: 'A storm turns in corners, not circles.' },
  { id: 'stormcrown', name: 'Storm Crown', element: 'storm', tier: 4, glyph: 'star7', kind: 'attack', cost: 60, color: '#fff0a0', damage: 95, speed: 44,
    desc: 'A crown of seven bolts, and it arrives at once.', hint: 'Seven points. You will not find it by accident.' },
  { id: 'ion', name: 'Ion Sigil', element: 'storm', tier: 5, glyph: 'lissajous', kind: 'attack', cost: 72, color: '#ffffc0', damage: 70, hits: 2, speed: 46, pierce: true,
    desc: 'Two piercing bolts at impossible speed.', hint: 'Two rhythms crossing. Draw the shape a trapped bolt makes.' },

  // ---------------- NATURE ----------------
  { id: 'venom', name: 'Venom', element: 'nature', tier: 1, glyph: 's', kind: 'attack', cost: 26, color: '#a4ff3c', damage: 10,
    dot: { perSec: 10, dur: 5 }, desc: 'Poisons the enemy for 10 damage a second over 5s.', hint: 'Snakes are not drawn straight.' },
  { id: 'dewdrop', name: 'Dewdrop', element: 'nature', tier: 1, glyph: 'teardrop', kind: 'heal', cost: 14, color: '#b0ffd0', heal: 18,
    desc: 'A small, cheap heal.', hint: 'One drop.' },
  { id: 'regen', name: 'Regeneration', element: 'nature', tier: 2, glyph: 'spiral', kind: 'heal', cost: 34, color: '#9dffc2',
    hot: { perSec: 8, dur: 6 }, desc: 'Heals 8 health a second for 6s.', hint: 'Growth curls inward.' },
  { id: 'entangle', name: 'Entangle', element: 'nature', tier: 2, glyph: 'leaf', kind: 'attack', cost: 28, color: '#8aff6a', damage: 18,
    slow: { factor: 0.55, dur: 5 }, desc: 'Roots them: casting slowed by nearly half for 5s.', hint: 'Two arcs, meeting at both ends.' },
  { id: 'thornwall', name: 'Thorn Wall', element: 'nature', tier: 2, glyph: 'deltoid', kind: 'defense', cost: 36, color: '#6ade4a',
    shield: { amount: 70, dur: 7 }, dot: { perSec: 5, dur: 5 }, desc: 'A bramble shield of 70 that bleeds the attacker.', hint: 'Three cusps, curving inward.' },
  { id: 'bramble', name: 'Bramble', element: 'nature', tier: 3, glyph: 'steps', kind: 'attack', cost: 38, color: '#7dff6a', damage: 24,
    dot: { perSec: 9, dur: 6 }, lifesteal: 0.3, desc: 'Creeping thorns: damage over time that feeds you.', hint: 'It climbs.' },
  { id: 'bloom', name: 'Bloom', element: 'nature', tier: 3, glyph: 'rose4', kind: 'heal', cost: 48, color: '#c8ff9a', heal: 45,
    hot: { perSec: 8, dur: 5 }, cleanse: true, desc: 'Heals 45, then 8 a second for 5s, and clears poison.', hint: 'Four petals open at once.' },
  { id: 'wildgrowth', name: 'Wildgrowth', element: 'nature', tier: 4, glyph: 'trispiral', kind: 'heal', cost: 56, color: '#9dff5c', cooldown: 12,
    heal: 40, hot: { perSec: 16, dur: 8 }, desc: 'Explosive regrowth: 40 now and 16 a second for 8s.', hint: 'Growth that turns in threes.' },
  { id: 'worldseed', name: 'World Seed', element: 'nature', tier: 5, glyph: 'trefoil', kind: 'heal', cost: 75, color: '#c0ff80', cooldown: 22,
    heal: 60, hot: { perSec: 20, dur: 10 }, shield: { amount: 80, dur: 10 }, cleanse: true,
    desc: 'The seed of everything: a huge regrowth, a shield, and every curse undone.', hint: 'A knot with no beginning and no end.' },

  // ---------------- SHADOW ----------------
  { id: 'shadowbolt', name: 'Shadow Bolt', element: 'shadow', tier: 1, glyph: 'crescent', kind: 'attack', cost: 36, color: '#9b5cff', damage: 44, pierce: true,
    desc: 'Passes straight through enemy shields.', hint: 'The moon, when it is hiding.' },
  { id: 'drain', name: 'Drain', element: 'shadow', tier: 2, glyph: 'jhook', kind: 'attack', cost: 34, color: '#ff5fa0', damage: 32, lifesteal: 0.6,
    desc: 'Steals life: heals you for 60% of the damage.', hint: 'A hook, to pull something out.' },
  { id: 'curse', name: 'Curse', element: 'shadow', tier: 2, glyph: 'omega', kind: 'attack', cost: 30, color: '#b04dff', damage: 12,
    dot: { perSec: 11, dur: 6 }, slow: { factor: 0.7, dur: 6 }, desc: 'A withering hex: damage over time and slowed casting.', hint: 'The last letter.' },
  { id: 'voidrift', name: 'Void Rift', element: 'shadow', tier: 3, glyph: 'pigtail', kind: 'attack', cost: 58, color: '#b04dff', damage: 95, pierce: true, speed: 20,
    desc: 'Tears through shields for 95 damage.', hint: 'A loop with a tail.' },
  { id: 'nightfall', name: 'Nightfall', element: 'shadow', tier: 3, glyph: 'doubleloop', kind: 'attack', cost: 46, color: '#7a3fd0', damage: 30, lifesteal: 0.5,
    dot: { perSec: 8, dur: 5 }, desc: 'Creeping dark that feeds on what it takes.', hint: 'One loop above, one below.' },
  { id: 'oblivion', name: 'Oblivion', element: 'shadow', tier: 4, glyph: 'star9', kind: 'attack', cost: 68, color: '#c58bff', damage: 120, pierce: true,
    desc: 'Nothing survives it and nothing blocks it.', hint: 'Nine points, one stroke. Count carefully.' },
  { id: 'umbral', name: 'Umbral Sigil', element: 'shadow', tier: 5, glyph: 'sigil2', kind: 'attack', cost: 76, color: '#d0a0ff', damage: 90, pierce: true, lifesteal: 0.8,
    dot: { perSec: 14, dur: 6 }, desc: 'The sign nothing survives: 90 piercing, drains most of it back, and leaves a wound.', hint: 'Found scratched into a tomb wall. Nobody has copied it correctly yet.' },

  // ---------------- ECLIPSE : never sold, only earned ----------------
  { id: 'eclipse', name: 'Eclipse', element: 'eclipse', tier: 5, glyph: 'dspiral', kind: 'attack', cost: 80, color: '#ff4fd8', damage: 110, pierce: true,
    freeze: 2, dot: { perSec: 16, dur: 5 }, desc: 'Light and dark meet: 110 piercing damage, a freeze and a lingering burn.', hint: 'Two spirals, turning against each other.' },
  { id: 'singularity', name: 'Singularity', element: 'eclipse', tier: 5, glyph: 'rose5', kind: 'attack', cost: 90, color: '#ff8ff2', damage: 75, hits: 3, pierce: true, speed: 18,
    desc: 'Three collapsing points, none of which can be blocked.', hint: 'Five petals, one stroke, no lifting.' },
  { id: 'eternity', name: 'Eternity', element: 'eclipse', tier: 5, glyph: 'sigil3', kind: 'heal', cost: 95, color: '#ffd0f8', cooldown: 30,
    heal: 140, shield: { amount: 140, dur: 12 }, hot: { perSec: 18, dur: 10 }, cleanse: true, reflect: 5,
    desc: 'Time refuses you. A vast heal, a vast shield, reflection, and every curse undone.', hint: 'They say it cannot be drawn. They are probably right.' },
];

export const SPELL_BY_ID: Record<string, SpellDef> = Object.fromEntries(SPELLS.map(s => [s.id, s]));
export const STARTING_SPELLS = SPELLS.filter(s => s.starter).map(s => s.id);
export const SPELLS_BY_ELEMENT: Record<ElementId, SpellDef[]> = SPELLS.reduce((acc, s) => {
  (acc[s.element] ??= []).push(s);
  return acc;
}, {} as Record<ElementId, SpellDef[]>);
export const BASE_SLOTS = 6;

/** Spells of an element, ordered the way the grimoire lists them. */
export function elementSpells(el: ElementId): SpellDef[] {
  return (SPELLS_BY_ELEMENT[el] ?? []).slice().sort((a, b) => a.tier - b.tier || a.cost - b.cost);
}

// Every spell in the game. Nothing here is bought: spells are *discovered* by drawing their glyph
// while attuned to the right element, so this table is also the game's secret list.
//
// tier 1  anyone will stumble on it
// tier 2  a deliberate guess
// tier 3  needs the element half worn
// tier 4  needs three matching pieces and a steady hand
// tier 5  needs a full four-piece set of the element; these are meant to stay unfound for a long time
import type { ElementId, GlyphTier } from './elements';
import { glyphStroke, type GlyphId, type Point } from './glyphs';

export type SpellKind = 'attack' | 'defense' | 'heal' | 'utility';

export interface SpellDef {
  id: string;
  name: string;
  element: ElementId;
  tier: GlyphTier;
  glyph: GlyphId;
  /**
   * Which way the stroke must travel. The codex draws the arrows; the recogniser enforces them.
   * A glyph drawn backwards is a different spell, so one shape can hold two.
   */
  reverse?: boolean;
  kind: SpellKind;
  cost: number;          // mana
  color: string;         // projectiles, particles and icons
  desc: string;
  /** Shown in the grimoire before the spell is found. Deliberately vague at high tiers. */
  hint: string;
  /** True for the handful of spells a new player already knows. */
  starter?: boolean;
  /**
   * A spell the codex has never recorded: it is not listed, not counted and not hinted at until
   * somebody draws it. These are the rumours the game is meant to generate.
   */
  secret?: boolean;
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

  // ---------------- LIGHT ----------------
  { id: 'glimmer', name: 'Glimmer', element: 'light', tier: 1, glyph: 'star4', kind: 'attack', cost: 14, color: '#fff3a8', damage: 20, speed: 26,
    desc: 'A bright, cheap mote of radiance.', hint: 'The simplest star there is.' },
  { id: 'blessing', name: 'Blessing', element: 'light', tier: 1, glyph: 'chalice', kind: 'heal', cost: 28, color: '#ffe9a8', heal: 32,
    desc: 'Restores 32 health.', hint: 'Something to drink from.' },
  { id: 'sanctuary', name: 'Sanctuary', element: 'light', tier: 2, glyph: 'nephroid', kind: 'defense', cost: 40, color: '#fff0c0',
    shield: { amount: 100, dur: 8 }, cleanse: true, desc: 'A shield of 100 that also burns away curses.', hint: 'Two arches meeting.' },
  { id: 'radiance', name: 'Radiance', element: 'light', tier: 2, glyph: 'sunburst', kind: 'attack', cost: 38, color: '#ffd23f', damage: 42,
    slow: { factor: 0.7, dur: 4 }, desc: 'Blinding light: damage, and they cast slower for 4s.', hint: 'Draw the sun.' },
  { id: 'consecrate', name: 'Consecrate', element: 'light', tier: 3, glyph: 'rose6', kind: 'heal', cost: 46, color: '#fff6d0',
    heal: 30, hot: { perSec: 12, dur: 7 }, cleanse: true, desc: 'Hallowed ground: 30 now, 12 a second for 7s, and no curse survives.', hint: 'Six petals of light.' },
  { id: 'judgement', name: 'Judgement', element: 'light', tier: 4, glyph: 'star7b', kind: 'attack', cost: 62, color: '#fffbe0', damage: 105, pierce: true, speed: 30,
    desc: 'A verdict no shield can appeal.', hint: 'Seven points, but drawn the wide way.' },
  { id: 'dawnbreaker', name: 'Dawnbreaker', element: 'light', tier: 5, glyph: 'lissajous54', kind: 'heal', cost: 82, color: '#ffffe0', cooldown: 20,
    heal: 110, damage: 80, shield: { amount: 100, dur: 10 }, cleanse: true,
    desc: 'The sun comes up whether you are ready or not: a huge heal, a shield, and 80 damage.', hint: 'Five against four. It is drawn in one breath, or not at all.' },

  // ---------------- EARTH ----------------
  { id: 'pebble', name: 'Pebble', element: 'earth', tier: 1, glyph: 'tridown', kind: 'attack', cost: 10, color: '#c98b4a', damage: 18, speed: 20,
    desc: 'It is just a rock, and it works.', hint: 'A triangle, upside down.' },
  { id: 'boulder', name: 'Boulder', element: 'earth', tier: 1, glyph: 'spade', kind: 'attack', cost: 34, color: '#a8763c', damage: 56, speed: 11,
    desc: 'Slow, heavy, and very hard to ignore.', hint: 'The shape on a playing card.' },
  { id: 'stoneskin', name: 'Stoneskin', element: 'earth', tier: 2, glyph: 'astroid', kind: 'defense', cost: 42, color: '#d8a868',
    shield: { amount: 130, dur: 10 }, desc: 'A shield of 130 that lasts a full ten seconds.', hint: 'Four cusps, curving in.' },
  { id: 'quake', name: 'Quake', element: 'earth', tier: 3, glyph: 'pentspiral', kind: 'attack', cost: 48, color: '#b8834a', damage: 60, interrupt: true,
    desc: 'The ground moves and their cast dies with it.', hint: 'A vortex with five sides.' },
  { id: 'petrify', name: 'Petrify', element: 'earth', tier: 3, glyph: 'key', kind: 'attack', cost: 50, color: '#9a8a70', damage: 30,
    freeze: 3, interrupt: true, desc: 'Turns them to stone for 3s.', hint: 'It locks something.' },
  { id: 'mountainheart', name: 'Mountainheart', element: 'earth', tier: 4, glyph: 'star12', kind: 'defense', cost: 64, color: '#e0b070', cooldown: 14,
    shield: { amount: 220, dur: 12 }, heal: 50, desc: 'A shield of 220 and 50 health. You simply do not fall.', hint: 'Twelve points. Count them, then draw them.' },
  { id: 'worldbreaker', name: 'Worldbreaker', element: 'earth', tier: 5, glyph: 'star11', kind: 'attack', cost: 88, color: '#ffbe60', damage: 150, speed: 9,
    interrupt: true, desc: 'One hundred and fifty damage arriving like a dropped continent.', hint: 'Eleven points in a single line. Nobody draws this by accident.' },

  // ---------------- CHRONO ----------------
  { id: 'tick', name: 'Tick', element: 'chrono', tier: 1, glyph: 'arrowhead', kind: 'attack', cost: 9, color: '#6af2ff', damage: 15, speed: 34,
    desc: 'A sliver of stolen time, thrown hard.', hint: 'The point of an arrow.' },
  { id: 'haste', name: 'Haste', element: 'chrono', tier: 1, glyph: 'feather', kind: 'utility', cost: 0, color: '#b0f8ff', cooldown: 12, mana: 45,
    desc: 'Restores 45 mana on a 12s cooldown.', hint: 'Light enough to fall slowly.' },
  { id: 'rewind', name: 'Rewind', element: 'chrono', tier: 2, glyph: 'vcoil', kind: 'heal', cost: 36, color: '#9ff0ff', heal: 55,
    desc: 'Puts 55 health back where it was.', hint: 'A coil, standing up.' },
  { id: 'stasis', name: 'Stasis', element: 'chrono', tier: 2, glyph: 'rose7', kind: 'attack', cost: 44, color: '#7fe3ff', damage: 25,
    freeze: 2.5, interrupt: true, desc: 'Holds them still for 2.5s.', hint: 'Seven petals.' },
  { id: 'echo', name: 'Echo', element: 'chrono', tier: 3, glyph: 'lissajous43', kind: 'attack', cost: 52, color: '#8ef3ff', damage: 38, hits: 2, speed: 28,
    desc: 'The same spell twice, a heartbeat apart.', hint: 'Four against three.' },
  { id: 'timelock', name: 'Timelock', element: 'chrono', tier: 4, glyph: 'star9b', kind: 'attack', cost: 66, color: '#c0fbff', damage: 55,
    freeze: 4, slow: { factor: 0.4, dur: 8 }, desc: 'Four seconds frozen, then eight crawling.', hint: 'Nine points, the wide way round.' },
  { id: 'paradox', name: 'Paradox', element: 'chrono', tier: 5, glyph: 'rose8', kind: 'attack', cost: 92, color: '#e0ffff', damage: 130, pierce: true,
    freeze: 3, mana: 60, desc: 'Happens before you cast it: 130 piercing damage, a freeze, and the mana back.', hint: 'Eight petals, one stroke, and it must close perfectly.' },

  // ---------------- ECLIPSE : never sold, only earned ----------------
  { id: 'eclipse', name: 'Eclipse', element: 'eclipse', tier: 5, glyph: 'dspiral', kind: 'attack', cost: 80, color: '#ff4fd8', damage: 110, pierce: true,
    freeze: 2, dot: { perSec: 16, dur: 5 }, desc: 'Light and dark meet: 110 piercing damage, a freeze and a lingering burn.', hint: 'Two spirals, turning against each other.' },
  { id: 'singularity', name: 'Singularity', element: 'eclipse', tier: 5, glyph: 'rose5', kind: 'attack', cost: 90, color: '#ff8ff2', damage: 75, hits: 3, pierce: true, speed: 18,
    desc: 'Three collapsing points, none of which can be blocked.', hint: 'Five petals, one stroke, no lifting.' },
  { id: 'eternity', name: 'Eternity', element: 'eclipse', tier: 5, glyph: 'sigil3', kind: 'heal', cost: 95, color: '#ffd0f8', cooldown: 30,
    heal: 140, shield: { amount: 140, dur: 12 }, hot: { perSec: 18, dur: 10 }, cleanse: true, reflect: 5,
    desc: 'Time refuses you. A vast heal, a vast shield, reflection, and every curse undone.', hint: 'They say it cannot be drawn. They are probably right.' },

  // ---------------- APOCRYPHA : nothing below is written in the codex ----------------
  // Every one of these is an existing sign drawn the other way round. Nobody is told they exist;
  // they are found by a wizard who wonders what happens when the stroke runs backwards.
  { id: 'riposte', name: 'Riposte', element: 'arcane', tier: 2, glyph: 'line-h', reverse: true, secret: true, kind: 'defense', cost: 18, color: '#9fd8ff',
    shield: { amount: 45, dur: 4 }, desc: 'A stroke drawn back the way it came. Absorbs 45 for 4s.', hint: 'Sideways, but the wrong way.' },
  { id: 'nullsphere', name: 'Nullsphere', element: 'arcane', tier: 4, glyph: 'circle', reverse: true, secret: true, kind: 'attack', cost: 54, color: '#8f7fd8',
    damage: 78, pierce: true, desc: 'An orb turned inside out: 78 damage that no shield stops.', hint: 'Round, widdershins.' },

  { id: 'backdraft', name: 'Backdraft', element: 'fire', tier: 3, glyph: 'triangle', reverse: true, secret: true, kind: 'attack', cost: 32, color: '#ff9440',
    damage: 26, dot: { perSec: 13, dur: 4 }, interrupt: true, desc: 'The flame pulled inward, then let go: it interrupts, then burns.', hint: 'Three sides, anticlockwise.' },
  { id: 'emberfall', name: 'Emberfall', element: 'fire', tier: 5, glyph: 'star', reverse: true, secret: true, kind: 'attack', cost: 78, color: '#ff6a2a',
    damage: 118, speed: 12, dot: { perSec: 14, dur: 5 }, desc: 'A meteor drawn in reverse falls anyway: 118 damage and a long burn.', hint: 'The star, unmade.' },

  { id: 'frostbite', name: 'Frostbite', element: 'frost', tier: 3, glyph: 'check', reverse: true, secret: true, kind: 'attack', cost: 30, color: '#a8ecff',
    damage: 26, freeze: 1.8, slow: { factor: 0.55, dur: 5 }, desc: 'The cold gets in the other way: a short freeze and a long chill.', hint: 'A tick, untucked.' },

  { id: 'skyrend', name: 'Skyrend', element: 'storm', tier: 4, glyph: 'bolt', reverse: true, secret: true, kind: 'attack', cost: 58, color: '#fff2b0',
    damage: 88, speed: 42, pierce: true, desc: 'Lightning drawn upward, the way it actually strikes. 88 piercing damage.', hint: 'From the ground up.' },

  { id: 'witherbloom', name: 'Witherbloom', element: 'nature', tier: 4, glyph: 'rose4', reverse: true, secret: true, kind: 'attack', cost: 50, color: '#8fbf5a',
    damage: 20, dot: { perSec: 18, dur: 6 }, lifesteal: 0.4, desc: 'Four petals closing: rot that feeds you as it spreads.', hint: 'A bloom, running backwards.' },

  { id: 'waningmoon', name: 'Waning Moon', element: 'shadow', tier: 3, glyph: 'crescent', reverse: true, secret: true, kind: 'attack', cost: 40, color: '#a86cff',
    damage: 48, pierce: true, lifesteal: 0.5, desc: 'The moon going the other way takes half of what it deals.', hint: 'It sets as easily as it rises.' },

  { id: 'afterglow', name: 'Afterglow', element: 'light', tier: 3, glyph: 'chalice', reverse: true, secret: true, kind: 'heal', cost: 40, color: '#ffeec0',
    heal: 38, hot: { perSec: 10, dur: 6 }, desc: 'The cup poured out instead of filled: 38 now, then 10 a second for 6s.', hint: 'Empty the cup.' },
  { id: 'blacksun', name: 'Black Sun', element: 'light', tier: 5, glyph: 'sunburst', reverse: true, secret: true, kind: 'heal', cost: 84, color: '#ffd070',
    cooldown: 18, heal: 60, damage: 96, cleanse: true, desc: 'Light running backwards: it takes 96 from them and gives 60 to you.', hint: 'Draw the sun, but unwind it.' },

  { id: 'unmaking', name: 'Unmaking', element: 'earth', tier: 5, glyph: 'astroid', reverse: true, secret: true, kind: 'attack', cost: 86, color: '#e0a860',
    damage: 140, speed: 10, pierce: true, interrupt: true, desc: 'The stone remembers being sand: 140 piercing damage, and their cast dies with it.', hint: 'Four cusps, undone.' },

  { id: 'foresight', name: 'Foresight', element: 'chrono', tier: 3, glyph: 'feather', reverse: true, secret: true, kind: 'utility', cost: 0, color: '#c8fbff',
    cooldown: 14, mana: 60, desc: 'You already drew it a moment ago. Restores 60 mana.', hint: 'The feather falls upward.' },
  { id: 'unwind', name: 'Unwind', element: 'chrono', tier: 5, glyph: 'vcoil', reverse: true, secret: true, kind: 'heal', cost: 80, color: '#d0ffff',
    cooldown: 18, heal: 120, hot: { perSec: 14, dur: 8 }, cleanse: true, desc: 'The last twenty seconds simply did not happen to you.', hint: 'The coil, wound down.' },

  { id: 'newmoon', name: 'New Moon', element: 'eclipse', tier: 5, glyph: 'dspiral', reverse: true, secret: true, kind: 'attack', cost: 88, color: '#ff6ae0',
    damage: 120, pierce: true, freeze: 2.5, lifesteal: 0.5, desc: 'The dark half of the sign: 120 piercing, a freeze, and half of it comes back to you.', hint: 'The twin spiral, the other way.' },
  { id: 'zenith', name: 'Zenith', element: 'eclipse', tier: 5, glyph: 'rose5', reverse: true, secret: true, kind: 'defense', cost: 92, color: '#ffd0f8',
    cooldown: 24, shield: { amount: 260, dur: 12 }, reflect: 5, cleanse: true, desc: 'Nothing reaches you at the top: a shield of 260, five seconds of reflection, every curse gone.', hint: 'Five petals, reversed and closed.' },
];

export const SPELL_BY_ID: Record<string, SpellDef> = Object.fromEntries(SPELLS.map(s => [s.id, s]));
export const STARTING_SPELLS = SPELLS.filter(s => s.starter).map(s => s.id);
export const SPELLS_BY_ELEMENT: Record<ElementId, SpellDef[]> = SPELLS.reduce((acc, s) => {
  (acc[s.element] ??= []).push(s);
  return acc;
}, {} as Record<ElementId, SpellDef[]>);
export const BASE_SLOTS = 6;

/**
 * Spells of an element, ordered the way the grimoire lists them. Secret spells are left out unless
 * the player has already found them, so the codex never hints at how many are missing.
 */
export function elementSpells(el: ElementId, known?: readonly string[]): SpellDef[] {
  return (SPELLS_BY_ELEMENT[el] ?? [])
    .filter(s => !s.secret || (known ? known.includes(s.id) : true))
    .sort((a, b) => a.tier - b.tier || a.cost - b.cost);
}

/** The exact stroke a spell demands, direction included. */
export function spellStroke(s: SpellDef): Point[] { return glyphStroke(s.glyph, s.reverse); }

/** How many spells the codex admits to: progress counters must never leak the unlisted ones. */
export const LISTED_SPELLS = SPELLS.filter(s => !s.secret).length;

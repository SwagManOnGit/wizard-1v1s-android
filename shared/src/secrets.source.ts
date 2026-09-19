// The apocrypha, in readable form. THIS FILE IS NOT SHIPPED.
//
// Nothing in the app imports it: the game reads secrets.data.ts, which is this table sealed into an
// opaque blob by `npm run seal`. Edit the spells here, run the seal, and commit both files. A test
// fails if the two ever disagree.
import type { SpellDef } from './spells';

export const SECRET_SOURCE: SpellDef[] = [
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

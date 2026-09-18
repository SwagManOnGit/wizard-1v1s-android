// Achievements are evaluated from the save after every battle, purchase or duel.
import { EQUIP_SLOTS, LISTED_SPELLS, MAX_LEVEL, MUNDANE_ELEMENTS, SPELLS } from '@wizard/shared';
import type { SaveData } from '../save';

export interface AchievementDef { id: string; name: string; desc: string; coins: number; done: (s: SaveData) => boolean }

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_win', name: 'First Blood', desc: 'Win your first duel.', coins: 50, done: s => s.wins >= 1 },
  { id: 'wins_10', name: 'Apprentice No More', desc: 'Win 10 battles.', coins: 150, done: s => s.wins >= 10 },
  { id: 'wins_50', name: 'Battle Mage', desc: 'Win 50 battles.', coins: 400, done: s => s.wins >= 50 },
  { id: 'boss_1', name: 'Giant Slayer', desc: 'Defeat your first boss.', coins: 200, done: s => s.stats.bossWins >= 1 },
  { id: 'boss_10', name: 'Boss Hunter', desc: 'Defeat 10 bosses.', coins: 800, done: s => s.stats.bossWins >= 10 },
  { id: 'level_25', name: 'Quarter Way', desc: 'Clear level 25.', coins: 300, done: s => s.best >= 25 },
  { id: 'level_50', name: 'Halfway There', desc: 'Clear level 50.', coins: 800, done: s => s.best >= 50 },
  { id: 'level_100', name: 'Archmage', desc: 'Clear level 100.', coins: 5000, done: s => s.best >= 100 },
  { id: 'level_250', name: 'Halfway to Heaven', desc: 'Clear level 250.', coins: 15000, done: s => s.best >= 250 },
  { id: 'level_500', name: 'Top of the Tower', desc: `Clear level ${MAX_LEVEL}.`, coins: 50000, done: s => s.best >= MAX_LEVEL },
  { id: 'spells_10', name: 'Collector', desc: 'Discover 10 spells.', coins: 200, done: s => s.discovered.length >= 10 },
  // Counts only the spells the codex admits to: the unlisted ones are a separate award, and
  // saying how many of those exist would spoil the whole point of them.
  { id: 'spells_all', name: 'Grand Grimoire', desc: `Discover all ${LISTED_SPELLS} spells in the codex.`, coins: 5000,
    done: s => SPELLS.filter(x => !x.secret).every(x => s.discovered.includes(x.id)) },
  { id: 'secret_1', name: 'Apocrypha', desc: 'Discover a spell the codex never recorded.', coins: 2500,
    done: s => s.discovered.some(id => SPELLS.find(x => x.id === id)?.secret) },
  { id: 'secret_5', name: 'Heretic Scholar', desc: 'Discover five spells the codex never recorded.', coins: 10000,
    done: s => s.discovered.filter(id => SPELLS.find(x => x.id === id)?.secret).length >= 5 },
  { id: 'spells_25', name: 'Seeker', desc: 'Discover 25 spells.', coins: 900, done: s => s.discovered.length >= 25 },
  { id: 'mythic_1', name: 'Mythwright', desc: 'Discover a Mythic spell.', coins: 2000, done: s => s.discovered.some(id => SPELLS.find(x => x.id === id)?.tier === 5) },
  { id: 'elements_all', name: 'Polymath', desc: 'Attune to every element.', coins: 3000, done: s => MUNDANE_ELEMENTS.every(e => s.elements.includes(e)) },
  // The starter kit is a full Arcane set already, so this only counts once you have replaced it.
  { id: 'fullset', name: 'Matching Set', desc: 'Wear four pieces of one element, all Fine or better.', coins: 1200, done: s => {
    const counts: Record<string, number> = {};
    let allGood = true;
    for (const slot of EQUIP_SLOTS) {
      const id = s.equipped[slot.id];
      if (!id) { allGood = false; continue; }
      const [el, , rarity] = id.split('_');
      if (Number(rarity) < 2) allGood = false;
      counts[el] = (counts[el] ?? 0) + 1;
    }
    return allGood && Object.values(counts).some(n => n >= EQUIP_SLOTS.length);
  } },
  { id: 'drops_25', name: 'Magpie', desc: 'Collect 25 pieces of equipment.', coins: 600, done: s => s.stats.drops >= 25 },
  { id: 'dodge_500', name: 'Untouchable', desc: 'Dodge 500 times.', coins: 250, done: s => s.stats.dodges >= 500 },
  { id: 'cast_1000', name: 'Calligrapher', desc: 'Cast 1,000 spells.', coins: 400, done: s => s.stats.casts >= 1000 },
  { id: 'meteor_50', name: 'Sky Fall', desc: 'Cast Meteor 50 times.', coins: 300, done: s => s.stats.metersCast >= 50 },
  { id: 'streak_7', name: 'Devoted', desc: 'Claim 7 daily rewards in a row.', coins: 500, done: s => s.daily.streak >= 7 },
  { id: 'duel_1', name: 'Challenger', desc: 'Win an online or ghost duel.', coins: 150, done: s => s.stats.duelWins + s.stats.ghostWins >= 1 },
  { id: 'duel_25', name: 'Duellist', desc: 'Win 25 duels.', coins: 700, done: s => s.stats.duelWins + s.stats.ghostWins >= 25 },
  { id: 'rating_1200', name: 'Rising Star', desc: 'Reach a duel rating of 1200.', coins: 600, done: s => s.rating >= 1200 },
  { id: 'gear_full', name: 'Dressed to Kill', desc: 'Wear Rare or better in all four slots.', coins: 300,
    done: s => EQUIP_SLOTS.every(slot => Number((s.equipped[slot.id] ?? '_0').split('_')[2] ?? 0) >= 3) },
  { id: 'mythic_gear', name: 'Treasure Hunter', desc: 'Find a Mythic piece of equipment.', coins: 800, done: s => s.inventory.some(id => id.endsWith('_5')) },
];

/** Marks newly completed achievements, pays their coins and returns them for the toast. */
export function evaluateAchievements(save: SaveData): AchievementDef[] {
  const fresh: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (save.achievements.includes(a.id)) continue;
    if (a.done(save)) { save.achievements.push(a.id); save.coins += a.coins; save.earned += a.coins; fresh.push(a); }
  }
  return fresh;
}

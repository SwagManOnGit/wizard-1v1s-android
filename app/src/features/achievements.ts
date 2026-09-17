// Achievements are evaluated from the save after every battle, purchase or duel.
import { SPELLS } from '@wizard/shared';
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
  { id: 'spells_10', name: 'Collector', desc: 'Own 10 spells.', coins: 200, done: s => s.owned.length >= 10 },
  { id: 'spells_all', name: 'Grand Grimoire', desc: `Own all ${SPELLS.length} spells.`, coins: 1500, done: s => s.owned.length >= SPELLS.length },
  { id: 'dodge_500', name: 'Untouchable', desc: 'Dodge 500 times.', coins: 250, done: s => s.stats.dodges >= 500 },
  { id: 'cast_1000', name: 'Calligrapher', desc: 'Cast 1,000 spells.', coins: 400, done: s => s.stats.casts >= 1000 },
  { id: 'meteor_50', name: 'Sky Fall', desc: 'Cast Meteor 50 times.', coins: 300, done: s => s.stats.metersCast >= 50 },
  { id: 'streak_7', name: 'Devoted', desc: 'Claim 7 daily rewards in a row.', coins: 500, done: s => s.daily.streak >= 7 },
  { id: 'duel_1', name: 'Challenger', desc: 'Win an online or ghost duel.', coins: 150, done: s => s.stats.duelWins + s.stats.ghostWins >= 1 },
  { id: 'duel_25', name: 'Duellist', desc: 'Win 25 duels.', coins: 700, done: s => s.stats.duelWins + s.stats.ghostWins >= 25 },
  { id: 'rating_1200', name: 'Rising Star', desc: 'Reach a duel rating of 1200.', coins: 600, done: s => s.rating >= 1200 },
  { id: 'gear_full', name: 'Dressed to Kill', desc: 'Equip gear in all four slots.', coins: 300, done: s => Object.keys(s.equipped).length >= 4 },
  { id: 'hats_3', name: 'Hat Trick', desc: 'Own three hats.', coins: 200, done: s => s.hats.length >= 3 },
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

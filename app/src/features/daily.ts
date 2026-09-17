// Daily login rewards and the daily challenge: the two cheapest retention hooks.
import { enemyForLevel, type EnemyDef } from '@wizard/shared';
import { todayKey, type SaveData } from '../save';

export const DAILY_REWARDS = [60, 90, 130, 180, 250, 350, 500];

function yesterdayKey(): string {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns the reward if today's login has not been claimed yet, and marks it claimed. */
export function claimDaily(save: SaveData): { coins: number; day: number } | null {
  const today = todayKey();
  if (save.daily.lastClaim === today) return null;
  save.daily.streak = save.daily.lastClaim === yesterdayKey() ? save.daily.streak + 1 : 1;
  save.daily.lastClaim = today;
  const day = Math.min(DAILY_REWARDS.length, save.daily.streak);
  const coins = DAILY_REWARDS[day - 1];
  save.coins += coins; save.earned += coins;
  return { coins, day };
}

export interface Challenge { key: string; name: string; desc: string; enemy: EnemyDef; rewardMult: number; level: number }

const MODIFIERS = [
  { name: 'Hasty', desc: 'The enemy casts 35% faster.', apply: (e: EnemyDef) => { e.castInterval *= 0.65; } },
  { name: 'Brutal', desc: 'The enemy hits 60% harder.', apply: (e: EnemyDef) => { e.damage = Math.round(e.damage * 1.6); } },
  { name: 'Ironclad', desc: 'The enemy has double health.', apply: (e: EnemyDef) => { e.hp *= 2; } },
  { name: 'Blitz', desc: 'Enemy bolts fly 50% faster.', apply: (e: EnemyDef) => { e.projectileSpeed *= 1.5; e.telegraph *= 0.8; } },
];

/** One challenge per calendar day, built from the player's best level so it stays relevant. */
export function dailyChallenge(save: SaveData): Challenge {
  const key = todayKey();
  const seed = [...key].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0;
  const level = Math.max(1, Math.min(100, save.best + 1 + (seed % 3)));
  const mod = MODIFIERS[seed % MODIFIERS.length];
  const enemy = { ...enemyForLevel(level), tier: { ...enemyForLevel(level).tier } };
  mod.apply(enemy);
  enemy.name = `${enemy.name} (${mod.name})`;
  return { key, name: `Daily: ${mod.name}`, desc: mod.desc, enemy, rewardMult: 3, level };
}

export function challengeAvailable(save: SaveData): boolean {
  return !(save.daily.challengeDate === todayKey() && save.daily.challengeDone);
}

export function markChallengeDone(save: SaveData): void {
  save.daily.challengeDate = todayKey();
  save.daily.challengeDone = true;
}

/** When the next daily reward unlocks (local midnight plus a friendly morning hour). */
export function nextRewardTime(): Date {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0);
  return d;
}

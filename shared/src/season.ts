// The season: thirty days, forty tiers, two tracks.
//
// Rewards are coins, chests and titles. Titles are the interesting half: they cost no art, they
// are visible to other players on the leaderboard, and they are the only thing in the game that
// says where you were and when. A season that sells power would poison the ranked ladder, which is
// the one place this game promises a fair fight.

export const SEASON_DAYS = 30;
export const SEASON_TIERS = 40;
/**
 * Experience for the next tier. Flat, because a curve here only obscures how far off the end is.
 *
 * Set from the pacing target rather than by feel: a daily player doing eight levels and the three
 * quests earns about 610 a day, so forty tiers at 350 finishes on day 23 of 30 — the week to spare
 * the plan asked for. At 500 the same player needed 33 days and could never finish at all.
 */
export const TIER_XP = 350;

export type SeasonRewardKind = 'coins' | 'chest' | 'title';
export interface SeasonReward {
  kind: SeasonRewardKind;
  /** Coins, or the chest id, or the title text. */
  value: string | number;
  /** Premium rewards are shown to everyone and given to holders: that visibility is the pitch. */
  premium: boolean;
  tier: number;
}

export interface SeasonDef { id: string; name: string; start: number; end: number; day: number }

const EPOCH = Date.UTC(2026, 0, 1);
const DAY = 86_400_000;

/** Seasons run back to back from a fixed epoch, so every player is in the same one. */
export function seasonFor(now: number = Date.now()): SeasonDef {
  const n = Math.max(0, Math.floor((now - EPOCH) / (SEASON_DAYS * DAY)));
  const start = EPOCH + n * SEASON_DAYS * DAY;
  return {
    id: `S${n + 1}`,
    name: SEASON_NAMES[n % SEASON_NAMES.length],
    start,
    end: start + SEASON_DAYS * DAY,
    day: Math.min(SEASON_DAYS, Math.floor((now - start) / DAY) + 1),
  };
}

const SEASON_NAMES = [
  'the Waking Ember', 'the Long Frost', 'the Storm Year', 'the Green Tide',
  'the Quiet Dark', 'the Second Sun', 'the Sunken Stone', 'the Turning Hour',
];

/** Titles a season hands out, free track then premium. Kept short: they sit beside a player name. */
const FREE_TITLES: Record<number, string> = { 10: 'the Persistent', 25: 'the Devoted', 40: 'the Unbroken' };
const PREMIUM_TITLES: Record<number, string> = { 5: 'the Early', 20: 'the Studious', 30: 'the Relentless', 40: 'the Ascendant' };

/** What a given tier pays on each track. Every tier pays something on the free track. */
export function rewardsFor(tier: number): SeasonReward[] {
  const out: SeasonReward[] = [];
  if (FREE_TITLES[tier]) out.push({ kind: 'title', value: FREE_TITLES[tier], premium: false, tier });
  else if (tier % 10 === 0) out.push({ kind: 'chest', value: 'gold', premium: false, tier });
  else if (tier % 5 === 0) out.push({ kind: 'chest', value: 'silver', premium: false, tier });
  else out.push({ kind: 'coins', value: 150 + tier * 25, premium: false, tier });

  if (PREMIUM_TITLES[tier]) out.push({ kind: 'title', value: PREMIUM_TITLES[tier], premium: true, tier });
  else if (tier % 5 === 0) out.push({ kind: 'chest', value: tier % 10 === 0 ? 'elemental' : 'gold', premium: true, tier });
  else out.push({ kind: 'coins', value: 300 + tier * 60, premium: true, tier });
  return out;
}

export function tierFor(xp: number): number {
  return Math.max(0, Math.min(SEASON_TIERS, Math.floor(xp / TIER_XP)));
}

export function xpIntoTier(xp: number): number {
  return tierFor(xp) >= SEASON_TIERS ? TIER_XP : xp % TIER_XP;
}

/**
 * Experience for clearing a level. Deliberately flat-ish: a season that pays far more at level 400
 * than at level 4 tells a new player the season is not for them.
 */
export function battleXp(level: number, boss: boolean, firstClear: boolean): number {
  return Math.round((20 + Math.min(40, level * 0.1)) * (boss ? 1.6 : 1) * (firstClear ? 1.5 : 1));
}

export const QUEST_SET_XP = 300;
export const DUEL_WIN_XP = 60;

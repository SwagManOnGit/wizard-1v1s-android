// Season progress against the save: rolling over, earning, claiming, and the offline trickle.
import { CHESTS, QUEST_SET_XP, SEASON_TIERS, battleXp, rewardsFor, seasonFor, tierFor, type SeasonReward } from '@wizard/shared';
import type { SaveData } from '../save';

export { battleXp, rewardsFor, seasonFor, tierFor };

/** Starts a new season when the calendar says so. Titles already earned are kept; progress is not. */
export function ensureSeason(save: SaveData): void {
  const s = seasonFor();
  if (save.season.id === s.id) return;
  save.season = { id: s.id, xp: 0, claimed: [], premium: false };
}

export function addSeasonXp(save: SaveData, xp: number): number {
  ensureSeason(save);
  const before = tierFor(save.season.xp);
  save.season.xp += Math.max(0, Math.round(xp));
  return tierFor(save.season.xp) - before;
}

/** Tiers reached but not yet taken, which is what the badge on the Market tab counts. */
export function unclaimedTiers(save: SaveData): number[] {
  ensureSeason(save);
  const reached = tierFor(save.season.xp);
  const out: number[] = [];
  for (let t = 1; t <= reached; t++) if (!save.season.claimed.includes(t)) out.push(t);
  return out;
}

/** The rewards a given tier owes this player: free always, premium only if they hold the pass. */
export function owedAt(save: SaveData, tier: number): SeasonReward[] {
  return rewardsFor(tier).filter(r => !r.premium || save.season.premium);
}

export interface ClaimResult { coins: number; chests: string[]; titles: string[]; tiers: number[] }

export function claimSeason(save: SaveData): ClaimResult {
  const out: ClaimResult = { coins: 0, chests: [], titles: [], tiers: [] };
  for (const tier of unclaimedTiers(save)) {
    save.season.claimed.push(tier);
    out.tiers.push(tier);
    for (const r of owedAt(save, tier)) {
      if (r.kind === 'coins') out.coins += Number(r.value);
      else if (r.kind === 'chest') out.chests.push(String(r.value));
      else if (r.kind === 'title' && !save.titles.includes(String(r.value))) out.titles.push(String(r.value));
    }
  }
  save.coins += out.coins;
  save.earned += out.coins;
  save.titles.push(...out.titles);
  // Wearing the newest title by default: a title nobody can see is not a reward.
  if (out.titles.length) save.title = out.titles[out.titles.length - 1];
  return out;
}

export function chestById(id: string): (typeof CHESTS)[number] {
  return CHESTS.find(c => c.id === id) ?? CHESTS[0];
}

export const SEASON_TIER_COUNT = SEASON_TIERS;
export const QUEST_XP = QUEST_SET_XP;

// ---- the offline trickle ---------------------------------------------------------------
/** Coins a minute away is worth, which is small on purpose: it is a reason to open the app, not a
 *  way to progress by not playing. */
const PER_MINUTE = 0.6;
const CAP_HOURS = 8;

export interface OfflineEarnings { minutes: number; coins: number }

/**
 * What the tower earned while the app was shut. Capped at eight hours so leaving it for a week is
 * worth no more than a night, and scaled by how far up the tower they are.
 */
export function offlineEarnings(save: SaveData, now = Date.now()): OfflineEarnings | null {
  if (!save.lastSeen) return null;
  const minutes = Math.floor((now - save.lastSeen) / 60_000);
  if (minutes < 10) return null;
  const capped = Math.min(minutes, CAP_HOURS * 60);
  const coins = Math.round(capped * PER_MINUTE * (1 + Math.min(save.best, 500) / 100));
  return coins > 0 ? { minutes: capped, coins } : null;
}

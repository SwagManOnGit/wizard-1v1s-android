// Three quests a day: the cheapest reason to come back that is not a login bribe.
//
// Progress is measured as a delta against a snapshot of the player's lifetime counters, taken when
// the day rolls over. That means no quest needs its own tracking code in the battle loop, and a
// quest can never disagree with the statistics screen.
import { CHESTS, type ChestDef } from '@wizard/shared';
import { todayKey, type SaveData } from '../save';

export type QuestMetric = 'wins' | 'casts' | 'dodges' | 'bossWins' | 'duelWins' | 'discovered' | 'chests' | 'drops';

export interface QuestDef {
  id: string; metric: QuestMetric; goal: number; name: string; desc: string;
  /** Kept out of the pool until the player has climbed this far, so a day's set is always winnable. */
  minBest?: number;
}

/** The first three are things any wizard does by playing; the rest need a little intent. */
const BASIC: QuestDef[] = [
  { id: 'wins3', metric: 'wins', goal: 3, name: 'Three victories', desc: 'Win three battles.' },
  { id: 'casts25', metric: 'casts', goal: 25, name: 'Twenty-five glyphs', desc: 'Cast 25 spells.' },
  { id: 'dodges20', metric: 'dodges', goal: 20, name: 'Light on your feet', desc: 'Dodge 20 times.' },
];

const EXTRA: QuestDef[] = [
  { id: 'boss1', metric: 'bossWins', goal: 1, name: 'Giant felling', desc: 'Defeat a boss.' },
  { id: 'drops2', metric: 'drops', goal: 2, name: 'Magpie', desc: 'Find two pieces of equipment.' },
  { id: 'chest1', metric: 'chests', goal: 1, name: 'Locksmith', desc: 'Open a chest.' },
  { id: 'casts60', metric: 'casts', goal: 60, name: 'Calligraphy', desc: 'Cast 60 spells.', minBest: 3 },
  { id: 'wins8', metric: 'wins', goal: 8, name: 'Eight victories', desc: 'Win eight battles.', minBest: 5 },
  // A discovery needs attuned gear to be findable at all, and a duel needs the server and somebody
  // to fight. Handing either to a day-one wizard makes the day's chest unreachable through no
  // fault of theirs, which is worse than not offering a quest at all.
  { id: 'discover1', metric: 'discovered', goal: 1, name: 'Seeker', desc: 'Discover a spell you have never drawn.', minBest: 5 },
  { id: 'duel1', metric: 'duelWins', goal: 1, name: 'Challenger', desc: 'Win an online or ghost duel.', minBest: 10 },
];

export const ALL_QUESTS = [...BASIC, ...EXTRA];

export function metricValue(save: SaveData, m: QuestMetric): number {
  switch (m) {
    case 'wins': return save.wins;
    case 'casts': return save.stats.casts;
    case 'dodges': return save.stats.dodges;
    case 'bossWins': return save.stats.bossWins;
    case 'duelWins': return save.stats.duelWins + save.stats.ghostWins;
    case 'discovered': return save.discovered.length;
    case 'chests': return save.stats.chests;
    case 'drops': return save.stats.drops;
  }
}

/**
 * FNV-1a with a final avalanche, and a salt per slot.
 *
 * The obvious `s * 31 + c` over a date string only really moves its low bits from one day to the
 * next, so picking slots off different bit ranges of one seed handed out the same two quests all
 * week. This mixes properly: neighbouring days and different salts land nowhere near each other.
 */
function hash(key: string, salt: number): number {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return h >>> 0;
}

/** One basic quest and two others, the same three for everybody at the same point in the tower. */
function pickFor(key: string, best: number): QuestDef[] {
  const basic = BASIC[hash(key, 1) % BASIC.length];
  const pool = EXTRA.filter(q => (q.minBest ?? 0) <= best);
  const a = pool.splice(hash(key, 2) % pool.length, 1)[0];
  const b = pool.splice(hash(key, 3) % pool.length, 1)[0];
  return [basic, a, b];
}

/** Rolls the day over if needed. Call this before reading quests anywhere. */
export function ensureQuests(save: SaveData): void {
  const today = todayKey();
  if (save.quests.date === today) return;
  save.quests.date = today;
  save.quests.claimed = false;
  save.quests.base = {};
  for (const q of ALL_QUESTS) save.quests.base[q.metric] = metricValue(save, q.metric);
}

export interface QuestState { def: QuestDef; progress: number; done: boolean }

export function questsToday(save: SaveData): QuestState[] {
  return pickFor(save.quests.date || todayKey(), save.best).map(def => {
    const base = save.quests.base[def.metric] ?? metricValue(save, def.metric);
    const progress = Math.max(0, Math.min(def.goal, metricValue(save, def.metric) - base));
    return { def, progress, done: progress >= def.goal };
  });
}

/** The chest three quests are worth, which grows with the tower so it never stops mattering. */
export function questChest(save: SaveData): ChestDef {
  const id = save.best >= 100 ? 'gold' : save.best >= 25 ? 'silver' : 'wood';
  return CHESTS.find(c => c.id === id) ?? CHESTS[0];
}

export function questsComplete(save: SaveData): boolean {
  return questsToday(save).every(q => q.done);
}

export function canClaimQuests(save: SaveData): boolean {
  return !save.quests.claimed && questsComplete(save);
}

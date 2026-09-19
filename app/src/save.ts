// Persistent progress. Parsed defensively so older saves keep loading.
// v3 replaced bought spells and bought gear with discovered spells and dropped gear.
import {
  BEARD_COLORS, DEFAULT_BEARD, DEFAULT_SKIN, EQUIP_BY_ID, EQUIP_SLOTS, MUNDANE_ELEMENTS, SKIN_TONES, SPELL_BY_ID,
  STARTING_ELEMENTS, STARTING_EQUIPMENT, STARTING_SPELLS, UPGRADES,
  computeStats, type ElementId, type EquipSlot, type PlayerStats,
} from '@wizard/shared';

export { computeStats };
export type { PlayerStats };

export interface Settings { music: boolean; sfx: boolean; haptics: boolean; notifications: boolean; analytics: boolean }
export interface DailyState {
  lastClaim: string; streak: number; challengeDate: string; challengeDone: boolean;
  /** The month (YYYY-MM) in which the one free missed day was last spent. */
  graceMonth: string;
}
/** Today's quests: when they were rolled, the counters they are measured against, and whether the
 *  reward has been taken. Progress is a delta from that base, so no quest needs its own tracking. */
export interface QuestState { date: string; base: Record<string, number>; claimed: boolean }
export interface LifetimeStats {
  dodges: number; casts: number; bossWins: number; duelWins: number; duelLosses: number;
  ghostWins: number; ghostLosses: number; metersCast: number; drops: number; chests: number;
}

export interface SaveData {
  v: 3;
  coins: number;
  level: number;
  best: number;
  /** How far through the scripted first duel: 0 not started, 1 in it, 2 done, 3 codex card seen. */
  ftue: number;
  /** The week key of the last rumour the player has actually looked at. */
  rumourSeen: string;
  /** Season progress. Resets when the season id changes; the titles earned are kept forever. */
  season: { id: string; xp: number; claimed: number[]; premium: boolean };
  /** Every title ever earned, and the one being worn. */
  titles: string[];
  title: string;
  /** When the game was last closed, for the offline trickle. */
  lastSeen: number;
  /** Spell ids the player has actually drawn at least once. */
  discovered: string[];
  /** Successful casts per spell, which is what fades that spell's guide off the draw pad. */
  practice: Record<string, number>;
  /** Discoveries the player has not looked at in the spellbook yet: drives the NEW badge. */
  unseen: string[];
  loadout: string[];
  /** Elements attuned. Arcane is always present; Eclipse is never listed, it is derived. */
  elements: ElementId[];
  upgrades: Record<string, number>;
  /** Equipment ids owned. Duplicates are melted for coins, so this is a set. */
  inventory: string[];
  equipped: Partial<Record<EquipSlot, string>>;
  wins: number;
  losses: number;
  earned: number;
  adsWatched: number;
  deviceId: string;
  name: string;
  /** The two parts of the wizard the player picks rather than earns. Stored as hex. */
  skin: string;
  beardColor: string;
  settings: Settings;
  daily: DailyState;
  quests: QuestState;
  achievements: string[];
  passes: { doubleCoins: boolean; noAds: boolean };
  stats: LifetimeStats;
  reviewAsked: boolean;
  rating: number;
}

function newDeviceId(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

const NAMES = ['Ember', 'Frost', 'Storm', 'Shade', 'Rune', 'Glim', 'Hex', 'Vex', 'Sage', 'Nyx'];
function randomName(): string { return `${NAMES[Math.floor(Math.random() * NAMES.length)]}${Math.floor(100 + Math.random() * 900)}`; }

export function defaultSave(): SaveData {
  return {
    v: 3, coins: 0, level: 1, best: 0, ftue: 0, rumourSeen: '',
    season: { id: '', xp: 0, claimed: [], premium: false }, titles: [], title: '', lastSeen: 0,
    // A new wizard knows the four starters but carries only Spark: the rest are handed over one
    // per level, so the first four fights each teach exactly one new thing.
    discovered: [...STARTING_SPELLS], unseen: [], loadout: [STARTING_SPELLS[0]], practice: {},
    elements: [...STARTING_ELEMENTS],
    upgrades: {}, inventory: [...STARTING_EQUIPMENT],
    equipped: { hat: 'arcane_hat_1', outfit: 'arcane_outfit_1', staff: 'arcane_staff_1', shoes: 'arcane_shoes_1' },
    wins: 0, losses: 0, earned: 0, adsWatched: 0,
    deviceId: newDeviceId(), name: randomName(),
    skin: DEFAULT_SKIN, beardColor: DEFAULT_BEARD,
    settings: { music: true, sfx: true, haptics: true, notifications: true, analytics: true },
    daily: { lastClaim: '', streak: 0, challengeDate: '', challengeDone: false, graceMonth: '' },
    quests: { date: '', base: {}, claimed: false },
    achievements: [],
    passes: { doubleCoins: false, noAds: false },
    stats: { dodges: 0, casts: 0, bossWins: 0, duelWins: 0, duelLosses: 0, ghostWins: 0, ghostLosses: 0, metersCast: 0, drops: 0, chests: 0 },
    reviewAsked: false,
    rating: 1000,
  };
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d: number, min = 0): number => Math.max(min, Math.floor(num(v, d)));
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

export function parseSave(raw: string | null): SaveData {
  const d = defaultSave();
  if (!raw) return d;
  try {
    const o = obj(JSON.parse(raw));
    d.coins = int(o.coins, 0);
    d.level = int(o.level, 1, 1);
    d.ftue = int(o.ftue, 0);
    d.rumourSeen = str(o.rumourSeen, '');
    const sn = obj(o.season);
    d.season = {
      id: str(sn.id, ''), xp: int(sn.xp, 0), premium: bool(sn.premium, false),
      claimed: (Array.isArray(sn.claimed) ? sn.claimed : []).filter((x): x is number => typeof x === 'number'),
    };
    d.titles = strList(o.titles);
    d.title = str(o.title, '');
    d.lastSeen = int(o.lastSeen, 0);
    d.best = int(o.best, 0);

    // v1/v2 stored bought spells in `owned`; those the player had are treated as already discovered.
    const knownSource = strList(o.discovered).length ? strList(o.discovered) : strList(o.owned);
    const known = new Set([...STARTING_SPELLS, ...knownSource.filter(id => SPELL_BY_ID[id])]);
    d.discovered = [...known];
    d.unseen = strList(o.unseen).filter(id => known.has(id));
    const pr = obj(o.practice);
    for (const id of Object.keys(pr)) if (SPELL_BY_ID[id]) d.practice[id] = int(pr[id], 0);
    const loadout = strList(o.loadout).filter(id => known.has(id));
    d.loadout = loadout.length ? loadout : [...STARTING_SPELLS];

    const els = strList(o.elements).filter((e): e is ElementId => (MUNDANE_ELEMENTS as string[]).includes(e));
    d.elements = [...new Set<ElementId>([...STARTING_ELEMENTS, ...els])];

    const up = obj(o.upgrades);
    for (const u of UPGRADES) d.upgrades[u.id] = Math.min(u.max, int(up[u.id], 0));

    const inv = strList(o.inventory).filter(id => EQUIP_BY_ID[id]);
    d.inventory = [...new Set([...STARTING_EQUIPMENT, ...inv])];
    d.equipped = {};
    const eq = obj(o.equipped);
    for (const s of EQUIP_SLOTS) {
      const id = eq[s.id];
      if (typeof id === 'string' && EQUIP_BY_ID[id]?.slot === s.id && d.inventory.includes(id)) d.equipped[s.id] = id;
    }
    // Anything the save did not fill keeps the starter piece so the player is never half naked.
    for (const s of EQUIP_SLOTS) {
      if (!d.equipped[s.id]) {
        const fallback = d.inventory.find(id => EQUIP_BY_ID[id]?.slot === s.id);
        if (fallback) d.equipped[s.id] = fallback;
      }
    }

    d.wins = int(o.wins, 0); d.losses = int(o.losses, 0); d.earned = int(o.earned, 0); d.adsWatched = int(o.adsWatched, 0);
    d.deviceId = str(o.deviceId, d.deviceId) || d.deviceId;
    d.name = str(o.name, d.name).slice(0, 16) || d.name;
    // Only the offered swatches are accepted: a hand-edited save cannot put an arbitrary colour on
    // a wizard that other players see in duels and on ghosts.
    d.skin = SKIN_TONES.some(t => t.color === o.skin) ? String(o.skin) : d.skin;
    d.beardColor = BEARD_COLORS.some(t => t.color === o.beardColor) ? String(o.beardColor) : d.beardColor;
    const st = obj(o.settings);
    d.settings = { music: bool(st.music, true), sfx: bool(st.sfx, true), haptics: bool(st.haptics, true), notifications: bool(st.notifications, true), analytics: bool(st.analytics, true) };
    const dl = obj(o.daily);
    d.daily = { lastClaim: str(dl.lastClaim, ''), streak: int(dl.streak, 0), challengeDate: str(dl.challengeDate, ''), challengeDone: bool(dl.challengeDone, false), graceMonth: str(dl.graceMonth, '') };
    const qz = obj(o.quests);
    const rawBase = obj(qz.base);
    const base: Record<string, number> = {};
    for (const k of Object.keys(rawBase)) base[k] = int(rawBase[k], 0);
    d.quests = { date: str(qz.date, ''), base, claimed: bool(qz.claimed, false) };
    d.achievements = strList(o.achievements);
    const ps = obj(o.passes);
    d.passes = { doubleCoins: bool(ps.doubleCoins, false), noAds: bool(ps.noAds, false) };
    const ls = obj(o.stats);
    d.stats = {
      dodges: int(ls.dodges, 0), casts: int(ls.casts, 0), bossWins: int(ls.bossWins, 0), duelWins: int(ls.duelWins, 0), duelLosses: int(ls.duelLosses, 0),
      ghostWins: int(ls.ghostWins, 0), ghostLosses: int(ls.ghostLosses, 0), metersCast: int(ls.metersCast, 0),
      drops: int(ls.drops, 0), chests: int(ls.chests, 0),
    };
    d.reviewAsked = bool(o.reviewAsked, false);
    d.rating = int(o.rating, 1000);
  } catch { /* corrupt save: start fresh */ }
  d.loadout = d.loadout.slice(0, computeStats(d).slots);
  return d;
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

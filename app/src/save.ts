// Persistent progress for the Android edition. Parsed defensively so v1 (Playables) saves still load.
import { EQUIP_BY_ID, EQUIP_SLOTS, HAT_STYLES, SPELL_BY_ID, STARTING_SPELLS, UPGRADES, computeStats, type EquipSlot, type HatStyle, type PlayerStats } from '@wizard/shared';

export { computeStats };
export type { PlayerStats };

export interface Settings { music: boolean; sfx: boolean; haptics: boolean; notifications: boolean }
export interface DailyState { lastClaim: string; streak: number; challengeDate: string; challengeDone: boolean }
export interface LifetimeStats { dodges: number; casts: number; bossWins: number; duelWins: number; duelLosses: number; ghostWins: number; ghostLosses: number; metersCast: number }

export interface SaveData {
  v: 2;
  coins: number;
  level: number;
  best: number;
  owned: string[];
  loadout: string[];
  upgrades: Record<string, number>;
  equipOwned: string[];
  equipped: Partial<Record<EquipSlot, string>>;
  wins: number;
  losses: number;
  earned: number;
  adsWatched: number;
  deviceId: string;
  name: string;
  settings: Settings;
  daily: DailyState;
  achievements: string[];
  hats: HatStyle[];
  hat: HatStyle;
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
    v: 2, coins: 0, level: 1, best: 0,
    owned: [...STARTING_SPELLS], loadout: [...STARTING_SPELLS],
    upgrades: {}, equipOwned: [], equipped: {}, wins: 0, losses: 0, earned: 0, adsWatched: 0,
    deviceId: newDeviceId(), name: randomName(),
    settings: { music: true, sfx: true, haptics: true, notifications: true },
    daily: { lastClaim: '', streak: 0, challengeDate: '', challengeDone: false },
    achievements: [], hats: ['pointy'], hat: 'pointy',
    passes: { doubleCoins: false, noAds: false },
    stats: { dodges: 0, casts: 0, bossWins: 0, duelWins: 0, duelLosses: 0, ghostWins: 0, ghostLosses: 0, metersCast: 0 },
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
    d.best = int(o.best, 0);
    const owned = new Set([...STARTING_SPELLS, ...strList(o.owned).filter(id => SPELL_BY_ID[id])]);
    d.owned = [...owned];
    const loadout = strList(o.loadout).filter(id => owned.has(id));
    d.loadout = loadout.length ? loadout : [...STARTING_SPELLS];
    const up = obj(o.upgrades);
    for (const u of UPGRADES) d.upgrades[u.id] = Math.min(u.max, int(up[u.id], 0));
    d.equipOwned = strList(o.equipOwned).filter(id => EQUIP_BY_ID[id]);
    const eq = obj(o.equipped);
    for (const s of EQUIP_SLOTS) {
      const id = eq[s.id];
      if (typeof id === 'string' && EQUIP_BY_ID[id] && d.equipOwned.includes(id) && EQUIP_BY_ID[id].slot === s.id) d.equipped[s.id] = id;
    }
    d.wins = int(o.wins, 0); d.losses = int(o.losses, 0); d.earned = int(o.earned, 0); d.adsWatched = int(o.adsWatched, 0);
    d.deviceId = str(o.deviceId, d.deviceId) || d.deviceId;
    d.name = str(o.name, d.name).slice(0, 16) || d.name;
    const st = obj(o.settings);
    d.settings = { music: bool(st.music, true), sfx: bool(st.sfx, true), haptics: bool(st.haptics, true), notifications: bool(st.notifications, true) };
    const dl = obj(o.daily);
    d.daily = { lastClaim: str(dl.lastClaim, ''), streak: int(dl.streak, 0), challengeDate: str(dl.challengeDate, ''), challengeDone: bool(dl.challengeDone, false) };
    d.achievements = strList(o.achievements);
    const hats = strList(o.hats).filter((h): h is HatStyle => (HAT_STYLES as readonly string[]).includes(h));
    d.hats = [...new Set<HatStyle>(['pointy', ...hats])];
    const hat = str(o.hat, 'pointy');
    d.hat = d.hats.includes(hat as HatStyle) ? (hat as HatStyle) : 'pointy';
    const ps = obj(o.passes);
    d.passes = { doubleCoins: bool(ps.doubleCoins, false), noAds: bool(ps.noAds, false) };
    const ls = obj(o.stats);
    d.stats = {
      dodges: int(ls.dodges, 0), casts: int(ls.casts, 0), bossWins: int(ls.bossWins, 0), duelWins: int(ls.duelWins, 0), duelLosses: int(ls.duelLosses, 0),
      ghostWins: int(ls.ghostWins, 0), ghostLosses: int(ls.ghostLosses, 0), metersCast: int(ls.metersCast, 0),
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

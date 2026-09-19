// A tiny JSON-file store. Enough for thousands of players; swap for Postgres or SQLite when it grows.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { GhostTape, LeaderboardEntry } from '@wizard/shared';

export interface PlayerRecord { deviceId: string; name: string; best: number; rating: number; wins: number; losses: number; updatedAt: number; title?: string }

/**
 * Telemetry is kept as a per-device set of milestones rather than a log of every event: the
 * question worth answering is "how many players reached each step", and that needs one row per
 * player, not one row per tap.
 */
export interface DeviceRecord { first: number; last: number; sessions: number; steps: Record<string, number> }
interface Db {
  players: Record<string, PlayerRecord>;
  ghosts: (GhostTape & { id: string; deviceId: string; plays: number; beaten: number })[];
  devices: Record<string, DeviceRecord>;
  events: Record<string, number>;
  /**
   * Who has found what. `who` exists to make a repeat report idempotent; it is the one part of this
   * store that grows with players times spells, and the first thing to move to a real database.
   */
  discoveries: Record<string, { count: number; first: { name: string; at: number; deviceId?: string } | null; who: Record<string, 1> }>;
}

/** The funnel, in order. Every one of these is a step a player can fall out of. */
export const FUNNEL_STEPS = ['install', 'battle_start', 'ftue_done', 'level_cleared', 'session_2', 'level_5', 'spell_discovered', 'purchase_complete'] as const;

const MAX_GHOSTS = 2000;

export class Store {
  private db: Db = { players: {}, ghosts: [], devices: {}, events: {}, discoveries: {} };
  private timer: NodeJS.Timeout | null = null;

  constructor(private path: string) {
    try { this.db = JSON.parse(readFileSync(path, 'utf8')) as Db; } catch { /* fresh store */ }
    this.db.players ??= {}; this.db.ghosts ??= []; this.db.devices ??= {}; this.db.events ??= {}; this.db.discoveries ??= {};
  }

  private flush(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try { mkdirSync(dirname(this.path), { recursive: true }); writeFileSync(this.path, JSON.stringify(this.db)); } catch (e) { console.error('store write failed', e); }
    }, 500);
  }

  player(deviceId: string, name?: string): PlayerRecord {
    let p = this.db.players[deviceId];
    if (!p) { p = { deviceId, name: name ?? 'Wizard', best: 0, rating: 1000, wins: 0, losses: 0, updatedAt: Date.now() }; this.db.players[deviceId] = p; }
    if (name && name !== p.name) { p.name = name; p.updatedAt = Date.now(); this.flush(); }
    return p;
  }

  recordBest(deviceId: string, name: string, best: number, title?: string): PlayerRecord {
    const p = this.player(deviceId, name);
    if (best > p.best) { p.best = best; p.updatedAt = Date.now(); this.flush(); }
    if (title !== undefined && title !== p.title) { p.title = title.slice(0, 24); p.updatedAt = Date.now(); this.flush(); }
    return p;
  }

  // ---- discoveries ----------------------------------------------------------------
  /** Records that this wizard found this spell, and says where they came in. Idempotent. */
  recordDiscovery(deviceId: string, name: string, spellId: string): { rank: number; holders: number; first: string | null } {
    // Count the device here too. The denominator for "x% of wizards know this" is the device
    // table, and a player who turned analytics off would otherwise be a holder without ever being
    // a player, which can push a percentage past 100.
    const now = Date.now();
    const dev = (this.db.devices[deviceId] ??= { first: now, last: now, sessions: 0, steps: { install: now } });
    dev.last = now;
    const d = (this.db.discoveries[spellId] ??= { count: 0, first: null, who: {} });
    let rank = 0;
    if (!d.who[deviceId]) {
      d.who[deviceId] = 1;
      d.count++;
      rank = d.count;
      d.first ??= { name: name.slice(0, 16) || 'A wizard', at: Date.now(), deviceId };
      this.flush();
    } else {
      // A repeat report from a reinstall: they still know it, they are just not new.
      rank = 0;
    }
    return { rank, holders: d.count, first: d.first?.name ?? null };
  }

  /** How many know each spell, for the "0.4% of wizards know this" line in the codex. */
  discoveryBoard(): { players: number; spells: Record<string, { holders: number; first: string | null }> } {
    const spells: Record<string, { holders: number; first: string | null }> = {};
    for (const [id, d] of Object.entries(this.db.discoveries)) {
      spells[id] = { holders: d.count, first: d.first?.name ?? null };
    }
    return { players: Math.max(1, Object.keys(this.db.devices).length), spells };
  }

  // ---- telemetry ------------------------------------------------------------------
  /** Records a batch of client events as milestones. Unknown names are counted but not funnelled. */
  recordEvents(deviceId: string, events: { name: string; props?: Record<string, unknown> }[]): number {
    if (!deviceId || !Array.isArray(events)) return 0;
    const now = Date.now();
    const d = (this.db.devices[deviceId] ??= { first: now, last: now, sessions: 0, steps: { install: now } });
    d.last = now;
    let kept = 0;
    for (const e of events) {
      if (!e || typeof e.name !== 'string') continue;
      const name = e.name.slice(0, 40);
      this.db.events[name] = (this.db.events[name] ?? 0) + 1;
      kept++;
      if (name === 'session_start') {
        d.sessions++;
        if (d.sessions >= 2) d.steps.session_2 ??= now;
      }
      // A step is stamped the first time it happens and never overwritten, so the funnel counts
      // players rather than repeats.
      if (name === 'battle_start' || name === 'ftue_done' || name === 'level_cleared'
        || name === 'spell_discovered' || name === 'purchase_complete') d.steps[name] ??= now;
      if (name === 'level_cleared' && Number(e.props?.level) >= 5) d.steps.level_5 ??= now;
    }
    this.flush();
    return kept;
  }

  /** Unique devices that reached each funnel step, plus raw event counts. */
  funnel(): { devices: number; steps: Record<string, number>; events: Record<string, number> } {
    const steps: Record<string, number> = {};
    for (const step of FUNNEL_STEPS) steps[step] = 0;
    for (const d of Object.values(this.db.devices)) {
      for (const step of FUNNEL_STEPS) if (d.steps[step]) steps[step]++;
    }
    return { devices: Object.keys(this.db.devices).length, steps, events: { ...this.db.events } };
  }

  recordDuel(winner: string, loser: string, ranked: boolean): [number, number] {
    const w = this.player(winner), l = this.player(loser);
    w.wins++; l.losses++;
    let dw = 0, dl = 0;
    if (ranked) {
      const expected = 1 / (1 + Math.pow(10, (l.rating - w.rating) / 400));
      dw = Math.round(32 * (1 - expected)); dl = -Math.round(32 * (1 - expected));
      w.rating += dw; l.rating = Math.max(100, l.rating + dl);
    }
    w.updatedAt = l.updatedAt = Date.now();
    this.flush();
    return [dw, dl];
  }

  /** How many spells this wizard got to first. Folklore, and the only badge worth chasing. */
  private firstsBy(deviceId: string): number {
    let n = 0;
    for (const d of Object.values(this.db.discoveries)) if (d.first?.deviceId === deviceId) n++;
    return n;
  }

  leaderboard(by: 'best' | 'rating', limit = 50): LeaderboardEntry[] {
    return Object.values(this.db.players)
      .filter(p => (by === 'best' ? p.best > 0 : p.wins + p.losses > 0))
      .sort((a, b) => (by === 'best' ? b.best - a.best || b.rating - a.rating : b.rating - a.rating || b.best - a.best))
      .slice(0, limit)
      .map(p => ({ deviceId: p.deviceId, name: p.name, best: p.best, rating: p.rating, wins: p.wins, updatedAt: p.updatedAt, firsts: this.firstsBy(p.deviceId), title: p.title }));
  }

  addGhost(deviceId: string, tape: GhostTape): string {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    // One ghost per player: the latest replaces the previous one.
    this.db.ghosts = this.db.ghosts.filter(g => g.deviceId !== deviceId);
    this.db.ghosts.push({ ...tape, id, deviceId, plays: 0, beaten: 0 });
    if (this.db.ghosts.length > MAX_GHOSTS) this.db.ghosts.splice(0, this.db.ghosts.length - MAX_GHOSTS);
    this.flush();
    return id;
  }

  randomGhost(deviceId: string, rating: number): (GhostTape & { id: string }) | null {
    const pool = this.db.ghosts.filter(g => g.deviceId !== deviceId);
    if (!pool.length) return null;
    // Prefer ghosts near the player's rating.
    const sorted = pool.map(g => ({ g, d: Math.abs(g.rating - rating) + Math.random() * 120 })).sort((a, b) => a.d - b.d);
    const pick = sorted[Math.floor(Math.random() * Math.min(5, sorted.length))].g;
    pick.plays++;
    this.flush();
    return pick;
  }

  ghost(id: string): (GhostTape & { id: string }) | null { return this.db.ghosts.find(g => g.id === id) ?? null; }

  ghostResult(id: string, won: boolean): void {
    const g = this.db.ghosts.find(x => x.id === id);
    if (g && won) { g.beaten++; this.flush(); }
  }

  get counts(): { players: number; ghosts: number } { return { players: Object.keys(this.db.players).length, ghosts: this.db.ghosts.length }; }
}

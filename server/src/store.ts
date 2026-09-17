// A tiny JSON-file store. Enough for thousands of players; swap for Postgres or SQLite when it grows.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { GhostTape, LeaderboardEntry } from '@wizard/shared';

export interface PlayerRecord { deviceId: string; name: string; best: number; rating: number; wins: number; losses: number; updatedAt: number }
interface Db { players: Record<string, PlayerRecord>; ghosts: (GhostTape & { id: string; deviceId: string; plays: number; beaten: number })[] }

const MAX_GHOSTS = 2000;

export class Store {
  private db: Db = { players: {}, ghosts: [] };
  private timer: NodeJS.Timeout | null = null;

  constructor(private path: string) {
    try { this.db = JSON.parse(readFileSync(path, 'utf8')) as Db; } catch { /* fresh store */ }
    this.db.players ??= {}; this.db.ghosts ??= [];
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

  recordBest(deviceId: string, name: string, best: number): PlayerRecord {
    const p = this.player(deviceId, name);
    if (best > p.best) { p.best = best; p.updatedAt = Date.now(); this.flush(); }
    return p;
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

  leaderboard(by: 'best' | 'rating', limit = 50): LeaderboardEntry[] {
    return Object.values(this.db.players)
      .filter(p => (by === 'best' ? p.best > 0 : p.wins + p.losses > 0))
      .sort((a, b) => (by === 'best' ? b.best - a.best || b.rating - a.rating : b.rating - a.rating || b.best - a.best))
      .slice(0, limit)
      .map(p => ({ deviceId: p.deviceId, name: p.name, best: p.best, rating: p.rating, wins: p.wins, updatedAt: p.updatedAt }));
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

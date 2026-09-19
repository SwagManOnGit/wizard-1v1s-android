// Small HTTP client for the duel server. Every call tolerates the server being offline.
import type { DiscoveryBoard, DiscoveryResponse, GhostTape, LeaderboardEntry, ProfileResponse } from '@wizard/shared';
import { CONFIG } from '../platform/config';

async function call<T>(path: string, init?: RequestInit, timeoutMs = 6000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${CONFIG.serverUrl}${path}`, { ...init, signal: ctrl.signal, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => call<{ ok: boolean; players: number; ghosts: number }>('/api/health', undefined, 3000),
  leaderboard: (by: 'best' | 'rating') => call<{ by: string; entries: LeaderboardEntry[] }>(`/api/leaderboard?by=${by}`),
  profile: (deviceId: string) => call<ProfileResponse>(`/api/profile/${encodeURIComponent(deviceId)}`),
  postScore: (deviceId: string, name: string, best: number) => call<{ ok: boolean; rating: number; best: number }>('/api/score', { method: 'POST', body: JSON.stringify({ deviceId, name, best }) }),
  postGhost: (deviceId: string, tape: GhostTape) => call<{ ok: boolean; id: string }>('/api/ghost', { method: 'POST', body: JSON.stringify({ deviceId, tape }) }),
  randomGhost: (deviceId: string, rating: number) => call<GhostTape & { id: string }>(`/api/ghost/random?deviceId=${encodeURIComponent(deviceId)}&rating=${rating}`),
  ghostResult: (deviceId: string, ghostId: string, won: boolean) => call<{ ok: boolean }>('/api/ghost/result', { method: 'POST', body: JSON.stringify({ deviceId, ghostId, won }) }),
  postDiscovery: (deviceId: string, name: string, spellId: string) =>
    call<DiscoveryResponse>('/api/discovery', { method: 'POST', body: JSON.stringify({ deviceId, name, spellId }) }, 4000),
  discoveries: () => call<DiscoveryBoard>('/api/discoveries', undefined, 4000),
  wsUrl: (): string => CONFIG.serverUrl.replace(/^http/, 'ws'),
};

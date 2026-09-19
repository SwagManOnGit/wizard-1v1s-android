// Messages between the app and the duel server, plus the HTTP API shapes.
import type { FighterIndex, PvpEvent, PvpSnapshot } from './pvp';
import type { Build } from './stats';
import type { GhostTape } from './ghost';

/** What the server says back when a spell is reported found. */
export interface DiscoveryResponse {
  /** Where this wizard came in: 1 is the first person in the world to draw it. */
  rank: number;
  /** How many wizards know it now. */
  holders: number;
  /** How many wizards the server has ever seen, so the client can work out a percentage. */
  players: number;
  /** Who got there first, if anybody has. */
  first: string | null;
}

/** The whole board, for the spellbook: spell id to how many know it and who was first. */
export interface DiscoveryBoard {
  players: number;
  spells: Record<string, { holders: number; first: string | null }>;
}

export const PROTOCOL_VERSION = 1;
export const DUEL_ROOM = 'duel';
export const TICK_RATE = 30;
export const SNAPSHOT_RATE = 12;

/** Sent when joining a duel room. */
export interface JoinOptions {
  v: number;
  deviceId: string;
  name: string;
  loadout: string[];
  build: Build;
  ranked: boolean;
}

export type ClientMessage =
  | { t: 'input'; k: 'd'; v: -1 | 1 }
  | { t: 'input'; k: 'c'; v: string }
  | { t: 'ready' };

export interface StartMessage {
  seed: number;
  you: FighterIndex;
  names: [string, string];
  loadouts: [string[], string[]];
  builds: [Build, Build];
  ratings: [number, number];
  countdown: number;
}

export interface EndMessage { winner: FighterIndex | null; reason: 'ko' | 'forfeit' | 'timeout'; ratingDelta: [number, number]; ratings: [number, number] }

export type ServerMessage =
  | { t: 'start'; d: StartMessage }
  | { t: 'snap'; d: PvpSnapshot }
  | { t: 'ev'; d: PvpEvent[] }
  | { t: 'end'; d: EndMessage }
  | { t: 'wait'; d: { seconds: number } };

// ---- HTTP API -------------------------------------------------------------------
export interface LeaderboardEntry {
  deviceId: string; name: string; best: number; rating: number; wins: number; updatedAt: number;
  /** A season title, worn beside the name. Cosmetic, and the point of the season's free track. */
  title?: string;
  /** Spells this wizard was the first in the world to draw. */
  firsts?: number;
}
export interface ScorePost { deviceId: string; name: string; best: number; title?: string }
export interface GhostPost { deviceId: string; tape: GhostTape }
export interface GhostResultPost { deviceId: string; ghostId: string; won: boolean }
export interface ProfileResponse { deviceId: string; name: string; rating: number; wins: number; losses: number; best: number }

// Duel sessions: practice against the bot, fight a downloaded ghost, or play online through Colyseus.
// Each session owns a PvpView the battle screen renders, and reports the outcome when it ends.
import { Client, type Room } from 'colyseus.js';
import {
  GhostPlayer, GhostRecorder, PvpBattle, PvpBot, RANKED_BUILD, computeStats, randomSeed, DUEL_ROOM, PROTOCOL_VERSION, SPELL_BY_ID,
  type BotLevel, type Build, type EndMessage, type GhostTape, type PvpEvent, type PvpSnapshot, type StartMessage,
} from '@wizard/shared';
import { api } from '../net/api';
import type { SaveData } from '../save';
import { PvpView } from './view';

export type DuelMode = 'bot' | 'ghost' | 'online' | 'ranked';

export interface DuelOutcome { won: boolean; ratingDelta: number; rating: number; reason: 'ko' | 'forfeit' | 'timeout' | 'disconnect'; ghostId?: string; tape?: GhostTape }

export interface DuelSession {
  readonly mode: DuelMode;
  readonly view: PvpView;
  readonly opponentName: string;
  /** Seconds until the fight starts (0 once running). */
  countdown: number;
  status: string;
  tick(dt: number): void;
  leave(): void;
  readonly outcome: DuelOutcome | null;
}

function buildOf(save: SaveData): Build { return { upgrades: save.upgrades, equipped: save.equipped }; }

/** Records the local player's inputs so the run can be uploaded as a ghost. */
class Tape {
  private rec = new GhostRecorder();
  constructor(view: PvpView) {
    const sim = view.sim;
    const dodge = sim.dodge.bind(sim), cast = sim.cast.bind(sim);
    sim.dodge = (i, dir) => { const ok = dodge(i, dir); if (ok && i === view.me) this.rec.dodge(sim.time, dir); return ok; };
    sim.cast = (i, id) => { const r = cast(i, id); if (r === 'ok' && i === view.me) this.rec.cast(sim.time, id); return r; };
  }
  finish(save: SaveData, seed: number, loadout: string[], won: boolean, duration: number): GhostTape {
    return { v: 1, name: save.name, rating: save.rating, seed, loadout, build: buildOf(save), inputs: this.rec.inputs, duration, won, createdAt: Date.now() };
  }
}

// ---- local: bot -------------------------------------------------------------------
export class BotSession implements DuelSession {
  readonly mode: DuelMode = 'bot';
  readonly view: PvpView;
  readonly opponentName: string;
  countdown = 3;
  status = 'Practice duel';
  outcome: DuelOutcome | null = null;
  private bot: PvpBot;
  private tape: Tape;
  private seed = randomSeed();
  private loadout: string[];

  constructor(private save: SaveData, level: BotLevel) {
    // The practice bot mirrors the player's build so practice stays fair at every stage of progression.
    const mine = computeStats(buildOf(save));
    const theirs = computeStats(buildOf(save));
    this.loadout = [...save.loadout];
    const botLoadout = ['spark', 'arcaneorb', 'iceshard', 'ward', 'mend', level === 'hard' ? 'lightning' : 'gust'];
    const sim = new PvpBattle({ seed: this.seed, loadouts: [this.loadout, botLoadout], stats: [mine, theirs] });
    this.opponentName = level === 'hard' ? 'Grand Bot' : level === 'easy' ? 'Novice Bot' : 'Bot Wizard';
    this.view = new PvpView(sim, 0, this.opponentName);
    this.bot = new PvpBot(sim, 1, level, this.seed ^ 0x5bd1e995);
    this.tape = new Tape(this.view);
  }

  tick(dt: number): void {
    if (this.countdown > 0) { this.countdown = Math.max(0, this.countdown - dt); this.view.locked = this.countdown > 0; return; }
    this.view.locked = false;
    this.bot.tick(dt);
    this.view.tick(dt);
    if (this.view.sim.over !== null && !this.outcome) {
      const won = this.view.over === 'win';
      this.outcome = { won, ratingDelta: 0, rating: this.save.rating, reason: 'ko', tape: this.tape.finish(this.save, this.seed, this.loadout, won, this.view.sim.time) };
    }
  }
  leave(): void { if (!this.outcome) this.outcome = { won: false, ratingDelta: 0, rating: this.save.rating, reason: 'forfeit' }; }
}

// ---- local: ghost -----------------------------------------------------------------
export class GhostSession implements DuelSession {
  readonly mode: DuelMode = 'ghost';
  readonly view: PvpView;
  readonly opponentName: string;
  countdown = 3;
  status = 'Ghost duel';
  outcome: DuelOutcome | null = null;
  private ghost: GhostPlayer;
  private tape: Tape;
  private seed = randomSeed();
  private loadout: string[];

  constructor(private save: SaveData, private ghostTape: GhostTape & { id?: string }) {
    const mine = computeStats(buildOf(save));
    const theirs = computeStats(ghostTape.build);
    this.loadout = [...save.loadout];
    const sim = new PvpBattle({ seed: this.seed, loadouts: [this.loadout, ghostTape.loadout.filter(id => SPELL_BY_ID[id])], stats: [mine, theirs] });
    this.opponentName = `${ghostTape.name}'s ghost`;
    this.view = new PvpView(sim, 0, this.opponentName);
    this.ghost = new GhostPlayer(ghostTape, sim, 1);
    this.tape = new Tape(this.view);
  }

  tick(dt: number): void {
    if (this.countdown > 0) { this.countdown = Math.max(0, this.countdown - dt); this.view.locked = this.countdown > 0; return; }
    this.view.locked = false;
    this.ghost.tick();
    this.view.tick(dt);
    // A ghost that ran out of recorded inputs stands still; give the player 10 more seconds to finish it.
    if (this.view.sim.over === null && this.ghost.finished && this.view.sim.time > this.ghostTape.duration + 10) {
      this.view.sim.fighters[1].hp = 0; this.view.sim.tick(0);
    }
    if (this.view.sim.over !== null && !this.outcome) {
      const won = this.view.over === 'win';
      this.outcome = { won, ratingDelta: 0, rating: this.save.rating, reason: 'ko', ghostId: this.ghostTape.id, tape: this.tape.finish(this.save, this.seed, this.loadout, won, this.view.sim.time) };
    }
  }
  leave(): void { if (!this.outcome) this.outcome = { won: false, ratingDelta: 0, rating: this.save.rating, reason: 'forfeit', ghostId: this.ghostTape.id }; }
}

// ---- online ----------------------------------------------------------------------------
export class OnlineSession implements DuelSession {
  readonly mode: DuelMode;
  view: PvpView;
  opponentName = '...';
  countdown = 3;
  status = 'Connecting...';
  outcome: DuelOutcome | null = null;
  private room: Room | null = null;
  private started = false;
  private queued: PvpEvent[] = [];

  private constructor(private save: SaveData, ranked: boolean) {
    this.mode = ranked ? 'ranked' : 'online';
    // Placeholder view until the server sends the real match; keeps the battle screen simple.
    const stats = computeStats(ranked ? RANKED_BUILD : buildOf(save));
    this.view = new PvpView(new PvpBattle({ seed: 1, loadouts: [save.loadout, save.loadout], stats: [stats, stats] }), 0, '...');
  }

  static async connect(save: SaveData, ranked: boolean): Promise<OnlineSession> {
    const s = new OnlineSession(save, ranked);
    const client = new Client(api.wsUrl());
    s.room = await client.joinOrCreate(DUEL_ROOM, { v: PROTOCOL_VERSION, deviceId: save.deviceId, name: save.name, loadout: save.loadout, build: buildOf(save), ranked });
    s.status = 'Finding an opponent...';
    s.room.onMessage('wait', (d: { seconds: number }) => { s.status = `Finding an opponent... a bot steps in after ${d.seconds}s`; });
    s.room.onMessage('start', (d: StartMessage) => s.onStart(d));
    s.room.onMessage('snap', (d: PvpSnapshot) => { if (s.started) s.view.sim.applySnapshot(d); });
    s.room.onMessage('ev', (d: PvpEvent[]) => { if (s.started) s.queued.push(...d.map(hydrate)); });
    s.room.onMessage('end', (d: EndMessage) => s.onEnd(d));
    s.room.onLeave(() => { if (!s.outcome && s.started) s.outcome = { won: false, ratingDelta: 0, rating: save.rating, reason: 'disconnect' }; });
    return s;
  }

  private onStart(d: StartMessage): void {
    const stats = [computeStats(d.builds[0]), computeStats(d.builds[1])] as [ReturnType<typeof computeStats>, ReturnType<typeof computeStats>];
    const sim = new PvpBattle({ seed: d.seed, loadouts: d.loadouts, stats });
    this.opponentName = d.names[d.you === 0 ? 1 : 0];
    this.view = new PvpView(sim, d.you, this.opponentName);
    this.view.onInput = (k, v) => this.room?.send('input', { t: 'input', k, v });
    this.countdown = d.countdown;
    this.status = `vs ${this.opponentName}`;
    this.started = true;
  }

  private onEnd(d: EndMessage): void {
    const me = this.view.me;
    const won = d.winner === me;
    this.outcome = { won, ratingDelta: d.ratingDelta[me], rating: d.ratings[me], reason: d.reason };
    this.save.rating = d.ratings[me];
    if (this.view.sim.over === null) { this.view.sim.fighters[won ? this.view.foe : me].hp = 0; this.view.sim.tick(0); }
  }

  tick(dt: number): void {
    if (!this.started) { this.view.locked = true; return; }
    if (this.countdown > 0) { this.countdown = Math.max(0, this.countdown - dt); this.view.locked = this.countdown > 0; return; }
    this.view.locked = false;
    // Local prediction between snapshots keeps motion smooth; the next snapshot corrects it.
    this.view.tick(dt);
    if (this.queued.length) { this.view.pushEvents(this.queued); this.queued = []; }
  }

  leave(): void {
    if (!this.outcome && this.started) this.outcome = { won: false, ratingDelta: 0, rating: this.save.rating, reason: 'forfeit' };
    void this.room?.leave();
    this.room = null;
  }
}

/** Server events carry spell ids only; restore the definitions the renderer expects. */
function hydrate(e: PvpEvent): PvpEvent {
  if (e.type === 'cast') return { ...e, spell: SPELL_BY_ID[e.spell.id] ?? e.spell };
  if (e.type === 'spawn') return { ...e, p: { ...e.p, spell: SPELL_BY_ID[e.p.spell.id] ?? e.p.spell } };
  return e;
}

/** Picks a ghost from the server, or null when none is available. */
export async function fetchGhost(save: SaveData): Promise<(GhostTape & { id: string }) | null> {
  return api.randomGhost(save.deviceId, save.rating);
}

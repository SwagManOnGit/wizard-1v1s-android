// Authoritative real-time duel: both clients send inputs, the server runs the shared simulation
// and streams snapshots. A bot steps in when nobody else joins within a few seconds.
import { Room, type Client } from 'colyseus';
import {
  PvpBattle, PvpBot, RANKED_BUILD, computeStats, randomSeed, SNAPSHOT_RATE, TICK_RATE, STARTING_SPELLS, SPELL_BY_ID,
  type ClientMessage, type FighterIndex, type JoinOptions, type PvpEvent, type ServerMessage, type Build,
} from '@wizard/shared';
import type { Store } from './store';

const BOT_WAIT_SECONDS = 8;
const MAX_DURATION = 240;

interface Seat { client: Client | null; deviceId: string; name: string; loadout: string[]; build: Build; rating: number; ready: boolean }

export class DuelRoom extends Room {
  maxClients = 2;
  private seats: Seat[] = [];
  private sim: PvpBattle | null = null;
  private bot: PvpBot | null = null;
  private ranked = false;
  private waitT = 0;
  private countdown = 0;
  private snapAcc = 0;
  private ended = false;
  private store!: Store;

  onCreate(options: { store: Store; ranked?: boolean }): void {
    this.store = options.store;
    this.ranked = !!options.ranked;
    this.setSimulationInterval(dt => this.update(dt / 1000), 1000 / TICK_RATE);
    this.onMessage('input', (client, msg: ClientMessage) => this.onInput(client, msg));
    this.onMessage('ready', client => { const s = this.seats.find(x => x.client === client); if (s) s.ready = true; });
  }

  onJoin(client: Client, options: JoinOptions): void {
    const loadout = (options.loadout ?? []).filter(id => SPELL_BY_ID[id]).slice(0, 10);
    const build: Build = this.ranked ? RANKED_BUILD : sanitizeBuild(options.build);
    const rec = this.store.player(options.deviceId ?? client.sessionId, sanitizeName(options.name));
    this.seats.push({ client, deviceId: rec.deviceId, name: rec.name, loadout: loadout.length ? loadout : [...STARTING_SPELLS], build, rating: rec.rating, ready: false });
    if (this.seats.length === 2) this.start();
    else this.sendTo(client, { t: 'wait', d: { seconds: BOT_WAIT_SECONDS } });
  }

  onLeave(client: Client): void {
    const i = this.seats.findIndex(s => s.client === client) as FighterIndex;
    if (i < 0) return;
    if (this.sim && !this.ended) this.finish(i === 0 ? 1 : 0, 'forfeit');
    else if (!this.sim) { this.seats.splice(i, 1); if (!this.seats.length) this.disconnect(); }
  }

  private start(): void {
    this.lock();
    const seed = randomSeed();
    const stats = this.seats.map(s => computeStats(s.build)) as [ReturnType<typeof computeStats>, ReturnType<typeof computeStats>];
    this.sim = new PvpBattle({ seed, loadouts: [this.seats[0].loadout, this.seats[1].loadout], stats });
    if (!this.seats[1].client) this.bot = new PvpBot(this.sim, 1, this.ranked ? 'hard' : 'normal', seed);
    this.countdown = 3;
    this.seats.forEach((s, i) => {
      if (!s.client) return;
      this.sendTo(s.client, { t: 'start', d: {
        seed, you: i as FighterIndex, names: [this.seats[0].name, this.seats[1].name], loadouts: [this.seats[0].loadout, this.seats[1].loadout],
        builds: [this.seats[0].build, this.seats[1].build], ratings: [this.seats[0].rating, this.seats[1].rating], countdown: this.countdown,
      } });
    });
  }

  private onInput(client: Client, msg: ClientMessage): void {
    if (!this.sim || this.countdown > 0 || this.ended || msg.t !== 'input') return;
    const i = this.seats.findIndex(s => s.client === client) as FighterIndex;
    if (i < 0) return;
    if (msg.k === 'd') this.sim.dodge(i, msg.v === -1 ? -1 : 1);
    else if (typeof msg.v === 'string') this.sim.cast(i, msg.v);
  }

  private update(dt: number): void {
    if (!this.sim) {
      this.waitT += dt;
      if (this.waitT >= BOT_WAIT_SECONDS && this.seats.length === 1) {
        this.seats.push({ client: null, deviceId: 'bot', name: 'Bot Wizard', loadout: ['spark', 'fireball', 'iceshard', 'ward', 'mend', 'lightning'], build: RANKED_BUILD, rating: 1000, ready: true });
        this.start();
      }
      return;
    }
    if (this.ended) return;
    if (this.countdown > 0) { this.countdown -= dt; return; }
    this.bot?.tick(dt);
    this.sim.tick(dt);
    const events = this.sim.drainEvents();
    if (events.length) this.broadcastAll({ t: 'ev', d: events.map(stripEvent) });
    this.snapAcc += dt;
    if (this.snapAcc >= 1 / SNAPSHOT_RATE) { this.snapAcc = 0; this.broadcastAll({ t: 'snap', d: this.sim.snapshot() }); }
    if (this.sim.over !== null) this.finish(this.sim.over, 'ko');
    else if (this.sim.time > MAX_DURATION) this.finish(this.sim.fighters[0].hp >= this.sim.fighters[1].hp ? 0 : 1, 'timeout');
  }

  private finish(winner: FighterIndex, reason: 'ko' | 'forfeit' | 'timeout'): void {
    if (this.ended) return;
    this.ended = true;
    const w = this.seats[winner], l = this.seats[winner === 0 ? 1 : 0];
    let delta: [number, number] = [0, 0];
    if (w && l && w.deviceId !== 'bot' && l.deviceId !== 'bot') {
      const [dw, dl] = this.store.recordDuel(w.deviceId, l.deviceId, this.ranked);
      delta = winner === 0 ? [dw, dl] : [dl, dw];
    } else if (w && w.deviceId !== 'bot') {
      // Beating the bot pays a little so early players still climb.
      this.store.recordDuel(w.deviceId, 'bot', false);
    }
    const ratings: [number, number] = [this.store.player(this.seats[0].deviceId).rating, this.seats[1] ? this.store.player(this.seats[1].deviceId).rating : 1000];
    this.broadcastAll({ t: 'end', d: { winner, reason, ratingDelta: delta, ratings } });
    setTimeout(() => this.disconnect(), 4000);
  }

  private sendTo(client: Client, msg: ServerMessage): void { client.send(msg.t, msg.d); }
  private broadcastAll(msg: ServerMessage): void { this.broadcast(msg.t, msg.d); }
}

function sanitizeName(n: unknown): string {
  const s = typeof n === 'string' ? n.replace(/[^\w \-]/g, '').trim().slice(0, 16) : '';
  return s || 'Wizard';
}

function sanitizeBuild(b: unknown): Build {
  const o = (b && typeof b === 'object' ? b : {}) as Partial<Build>;
  const upgrades: Record<string, number> = {};
  for (const [k, v] of Object.entries(o.upgrades ?? {})) if (typeof v === 'number') upgrades[k] = Math.max(0, Math.min(30, Math.floor(v)));
  const equipped: Build['equipped'] = {};
  for (const [k, v] of Object.entries(o.equipped ?? {})) if (typeof v === 'string') (equipped as Record<string, string>)[k] = v;
  return { upgrades, equipped };
}

/** Events carry the full spell definition; the client can look it up, so send the id only. */
function stripEvent(e: PvpEvent): PvpEvent {
  if (e.type === 'cast') return { ...e, spell: { id: e.spell.id } as PvpEvent extends { spell: infer S } ? S : never };
  if (e.type === 'spawn') return { ...e, p: { ...e.p, spell: { id: e.p.spell.id } as typeof e.p.spell } };
  return e;
}

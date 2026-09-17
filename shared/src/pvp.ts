// Symmetric two-wizard duel simulation. Runs identically on the server, in a ghost replay and
// against the local bot. Unlike the campaign, attack spells are lane-locked at cast time so both
// duellists must dodge. Fighter 0 and fighter 1 are interchangeable; the client decides which is "me".
import { ENEMY_Z, LANE_X, LANES, SPELL_BY_ID, type SpellDef } from './data';
import type { Dot, Side } from './battle';
import type { PlayerStats } from './stats';
import { Rng } from './rng';

export type FighterIndex = 0 | 1;
export const DUEL_DISTANCE = -ENEMY_Z;
/** Projectiles follow the target's lane until this much of the flight is done, then commit: dodge late to survive. */
export const LOCK_PROGRESS = 0.5;
/** Duellists get more health than the campaign hero so a match lasts long enough to turn around. */
export const PVP_HP_MULT = 2.5;

export interface PvpFighter {
  hp: number; maxHp: number;
  mana: number; maxMana: number;
  stamina: number; maxStamina: number;
  shield: number; shieldT: number;
  lane: number; x: number;
  dots: Dot[];
  reflectT: number;
  phaseCharges: number; phaseT: number;
  hot: { perSec: number; t: number } | null;
  iframesT: number;
  dodgeT: number; dodgeDir: number;
  freezeT: number;
  slow: { factor: number; t: number } | null;
  castT: number;          // time until the fighter may cast again (spell speed / slow effects)
  revived: boolean;
}

export interface PvpProjectile {
  id: number;
  owner: FighterIndex;
  lane: number;
  x0: number; x1: number;
  progress: number;       // 0 at the caster, 1 at the target
  speed: number;          // world units per second along DUEL_DISTANCE
  damage: number;
  color: string;
  spell: SpellDef;
  radius: number;
  delay: number;          // seconds before the projectile appears (multi-hit spells)
  reflected: boolean;
}

export type PvpEvent =
  | { type: 'cast'; who: FighterIndex; spell: SpellDef; color: string }
  | { type: 'telegraph'; who: FighterIndex; lanes: number[]; dur: number }
  | { type: 'spawn'; who: FighterIndex; p: PvpProjectile }
  | { type: 'impact'; who: FighterIndex; id: number; hit: boolean }
  | { type: 'damage'; who: FighterIndex; amount: number; absorbed: number; color: string; dot?: boolean }
  | { type: 'heal'; who: FighterIndex; amount: number }
  | { type: 'shield'; who: FighterIndex; amount: number }
  | { type: 'reflect'; who: FighterIndex; id: number }
  | { type: 'phase'; who: FighterIndex }
  | { type: 'miss'; who: FighterIndex }
  | { type: 'buff'; who: FighterIndex; name: string; color: string }
  | { type: 'freeze'; who: FighterIndex; dur: number }
  | { type: 'revive'; who: FighterIndex }
  | { type: 'death'; who: FighterIndex }
  | { type: 'fizzle'; who: FighterIndex; reason: 'mana' | 'cooldown' | 'stamina' | 'frozen' };

export interface PvpConfig {
  seed: number;
  loadouts: [string[], string[]];
  stats: [PlayerStats, PlayerStats];
}

let nextId = 1;

export class PvpBattle {
  readonly fighters: [PvpFighter, PvpFighter];
  readonly loadouts: [SpellDef[], SpellDef[]];
  readonly stats: [PlayerStats, PlayerStats];
  readonly cooldowns: [Record<string, number>, Record<string, number>] = [{}, {}];
  projectiles: PvpProjectile[] = [];
  time = 0;
  over: FighterIndex | null = null;
  overT = 0;
  readonly rng: Rng;
  private events: PvpEvent[] = [];

  constructor(cfg: PvpConfig) {
    this.rng = new Rng(cfg.seed);
    this.stats = cfg.stats;
    this.loadouts = [cfg.loadouts[0].map(id => SPELL_BY_ID[id]).filter(Boolean), cfg.loadouts[1].map(id => SPELL_BY_ID[id]).filter(Boolean)];
    const mk = (s: PlayerStats): PvpFighter => ({
      hp: Math.round(s.maxHp * PVP_HP_MULT), maxHp: Math.round(s.maxHp * PVP_HP_MULT), mana: s.maxMana, maxMana: s.maxMana, stamina: s.maxStamina, maxStamina: s.maxStamina,
      shield: 0, shieldT: 0, lane: 1, x: 0, dots: [], reflectT: 0, phaseCharges: 0, phaseT: 0, hot: null, iframesT: 0,
      dodgeT: 9, dodgeDir: 0, freezeT: 0, slow: null, castT: 0, revived: false,
    });
    this.fighters = [mk(cfg.stats[0]), mk(cfg.stats[1])];
  }

  drainEvents(): PvpEvent[] { const e = this.events; this.events = []; return e; }
  private emit(e: PvpEvent): void { this.events.push(e); }

  spellCost(i: FighterIndex, spell: SpellDef): number { return Math.round(spell.cost * this.stats[i].costMult); }

  dodge(i: FighterIndex, dir: -1 | 1): boolean {
    if (this.over !== null) return false;
    const f = this.fighters[i];
    const target = f.lane + dir;
    if (target < 0 || target >= LANES) return false;
    if (f.freezeT > 0) { this.emit({ type: 'fizzle', who: i, reason: 'frozen' }); return false; }
    if (f.stamina < this.stats[i].dodgeCost) { this.emit({ type: 'fizzle', who: i, reason: 'stamina' }); return false; }
    f.stamina -= this.stats[i].dodgeCost;
    f.lane = target;
    f.iframesT = this.stats[i].iframes;
    f.dodgeT = 0;
    f.dodgeDir = dir;
    return true;
  }

  cast(i: FighterIndex, spellId: string): 'ok' | 'mana' | 'cooldown' | 'frozen' | 'over' {
    if (this.over !== null) return 'over';
    const spell = this.loadouts[i].find(s => s.id === spellId);
    if (!spell) return 'over';
    const f = this.fighters[i], s = this.stats[i], o: FighterIndex = i === 0 ? 1 : 0, other = this.fighters[o];
    if (f.freezeT > 0) { this.emit({ type: 'fizzle', who: i, reason: 'frozen' }); return 'frozen'; }
    if ((this.cooldowns[i][spell.id] ?? 0) > 0) { this.emit({ type: 'fizzle', who: i, reason: 'cooldown' }); return 'cooldown'; }
    const cost = this.spellCost(i, spell);
    if (f.mana < cost) { this.emit({ type: 'fizzle', who: i, reason: 'mana' }); return 'mana'; }
    f.mana -= cost;
    if (spell.cooldown) this.cooldowns[i][spell.id] = spell.cooldown;
    this.emit({ type: 'cast', who: i, spell, color: spell.color });

    if (spell.shield) { const amt = Math.round(spell.shield.amount * s.shieldMult); f.shield = Math.max(f.shield, amt); f.shieldT = spell.shield.dur; this.emit({ type: 'shield', who: i, amount: amt }); }
    if (spell.heal) this.heal(i, Math.round(spell.heal * s.healMult));
    if (spell.cleanse) f.dots = [];
    if (spell.hot) { f.hot = { perSec: spell.hot.perSec * s.healMult, t: spell.hot.dur }; this.emit({ type: 'buff', who: i, name: 'Regenerating', color: spell.color }); }
    if (spell.reflect) { f.reflectT = spell.reflect; this.emit({ type: 'buff', who: i, name: 'Mirror Shell', color: spell.color }); }
    if (spell.phase) { f.phaseCharges = spell.phase.charges; f.phaseT = spell.phase.dur; this.emit({ type: 'buff', who: i, name: 'Phased', color: spell.color }); }
    if (spell.mana) { f.mana = Math.min(f.maxMana, f.mana + spell.mana); this.emit({ type: 'buff', who: i, name: `+${spell.mana} mana`, color: spell.color }); }
    if (spell.slow && !spell.damage) { other.slow = { factor: spell.slow.factor, t: spell.slow.dur }; this.emit({ type: 'buff', who: o, name: 'Slowed', color: spell.color }); }

    if (spell.damage) {
      const hits = spell.hits ?? 1;
      const speed = spell.speed ?? 16;
      // Starts on the opponent's lane and keeps tracking until LOCK_PROGRESS, then commits.
      const lane = other.lane;
      for (let k = 0; k < hits; k++) {
        const p: PvpProjectile = {
          id: nextId++, owner: i, lane, x0: LANE_X[f.lane] + (k - (hits - 1) / 2) * 0.35, x1: LANE_X[lane], progress: 0, speed,
          damage: spell.damage * s.power, color: spell.color, spell, radius: 0.22, delay: k * 0.14, reflected: false,
        };
        this.projectiles.push(p);
        this.emit({ type: 'spawn', who: i, p });
      }
      this.emit({ type: 'telegraph', who: o, lanes: [lane], dur: Math.min(1.2, (DUEL_DISTANCE / speed) * (1 - LOCK_PROGRESS)) });
    }
    return 'ok';
  }

  tick(dt: number): void {
    this.time += dt;
    if (this.over !== null) { this.overT += dt; this.move(dt, false); return; }
    for (let i = 0 as FighterIndex; i < 2; i = (i + 1) as FighterIndex) {
      const f = this.fighters[i], s = this.stats[i];
      const slowMul = f.slow ? f.slow.factor : 1;
      f.mana = Math.min(f.maxMana, f.mana + s.regen * dt * slowMul);
      f.stamina = Math.min(f.maxStamina, f.stamina + s.staminaRegen * dt);
      f.iframesT = Math.max(0, f.iframesT - dt);
      f.dodgeT += dt;
      if (f.shieldT > 0) { f.shieldT -= dt; if (f.shieldT <= 0) f.shield = 0; }
      f.reflectT = Math.max(0, f.reflectT - dt);
      if (f.phaseT > 0) { f.phaseT -= dt; if (f.phaseT <= 0) f.phaseCharges = 0; }
      if (f.hot) { this.heal(i, f.hot.perSec * dt, true); f.hot.t -= dt; if (f.hot.t <= 0) f.hot = null; }
      f.freezeT = Math.max(0, f.freezeT - dt);
      if (f.slow) { f.slow.t -= dt; if (f.slow.t <= 0) f.slow = null; }
      for (const d of f.dots) { d.t -= dt; this.damage(i, d.perSec * dt, d.color, true, true); }
      f.dots = f.dots.filter(d => d.t > 0);
      for (const id of Object.keys(this.cooldowns[i])) this.cooldowns[i][id] = Math.max(0, this.cooldowns[i][id] - dt);
      f.x += (LANE_X[f.lane] - f.x) * Math.min(1, dt * 14);
    }
    this.move(dt, true);
    for (let i = 0 as FighterIndex; i < 2; i = (i + 1) as FighterIndex) {
      if (this.fighters[i].hp <= 0 && this.over === null) { this.over = i === 0 ? 1 : 0; this.overT = 0; this.emit({ type: 'death', who: i }); }
    }
  }

  private heal(i: FighterIndex, amount: number, quiet = false): void {
    const f = this.fighters[i];
    const real = Math.min(f.maxHp - f.hp, amount);
    if (real <= 0) return;
    f.hp += real;
    if (!quiet) this.emit({ type: 'heal', who: i, amount: Math.round(real) });
  }

  private move(dt: number, resolve: boolean): void {
    const keep: PvpProjectile[] = [];
    for (const p of this.projectiles) {
      if (p.delay > 0) { p.delay -= dt; keep.push(p); continue; }
      p.progress += (p.speed / DUEL_DISTANCE) * dt;
      const target: FighterIndex = p.owner === 0 ? 1 : 0;
      const t = this.fighters[target];
      if (p.progress < LOCK_PROGRESS && !p.reflected) { p.lane = t.lane; p.x1 = LANE_X[t.lane]; }
      if (p.progress < 1 || !resolve) { if (p.progress < 1.25) keep.push(p); continue; }
      const sp = p.spell;
      if (t.lane === p.lane && t.reflectT > 0 && !p.reflected) {
        p.owner = target; p.reflected = true; p.progress = 0; p.lane = this.fighters[p.owner === 0 ? 1 : 0].lane;
        p.x0 = LANE_X[t.lane]; p.x1 = LANE_X[p.lane]; p.speed = 20; p.color = '#e6f2ff';
        this.emit({ type: 'reflect', who: target, id: p.id });
        keep.push(p);
        continue;
      }
      if (t.lane === p.lane && t.iframesT <= 0) {
        if (t.phaseCharges > 0) { t.phaseCharges--; this.emit({ type: 'phase', who: target }); this.emit({ type: 'impact', who: target, id: p.id, hit: false }); continue; }
        this.damage(target, p.damage, p.color, !!sp.pierce, false);
        const caster = p.owner;
        if (sp.lifesteal) this.heal(caster, Math.round(p.damage * sp.lifesteal));
        if (sp.dot) t.dots.push({ perSec: sp.dot.perSec * this.stats[caster].power, t: sp.dot.dur, color: sp.color });
        if (sp.slow) { t.slow = { factor: sp.slow.factor, t: sp.slow.dur }; this.emit({ type: 'buff', who: target, name: 'Slowed', color: sp.color }); }
        if (sp.freeze) { t.freezeT = Math.max(t.freezeT, sp.freeze); this.emit({ type: 'freeze', who: target, dur: sp.freeze }); }
        this.emit({ type: 'impact', who: target, id: p.id, hit: true });
      } else {
        this.emit({ type: 'miss', who: target });
        this.emit({ type: 'impact', who: target, id: p.id, hit: false });
      }
    }
    this.projectiles = keep;
  }

  private damage(i: FighterIndex, amount: number, color: string, pierce: boolean, dot: boolean): void {
    const f = this.fighters[i];
    if (this.over !== null) return;
    let absorbed = 0;
    if (f.shield > 0 && !pierce && !dot) { absorbed = Math.min(f.shield, amount); f.shield -= absorbed; if (f.shield <= 0) { f.shield = 0; f.shieldT = 0; } }
    const real = amount - absorbed;
    f.hp -= real;
    if (!dot || this.rng.next() < 0.1) this.emit({ type: 'damage', who: i, amount: Math.round(dot ? amount * 10 : real), absorbed: Math.round(absorbed), color, dot });
    if (f.hp <= 0 && this.stats[i].revive > 0 && !f.revived) {
      f.revived = true; f.hp = Math.round(f.maxHp * this.stats[i].revive); f.iframesT = 1.5;
      this.emit({ type: 'revive', who: i });
    }
  }

  /** Compact snapshot for the network and for ghost replays. */
  snapshot(): PvpSnapshot {
    return {
      t: this.time, over: this.over, overT: this.overT,
      f: this.fighters.map(f => ({ ...f, dots: f.dots.map(d => ({ ...d })), hot: f.hot ? { ...f.hot } : null, slow: f.slow ? { ...f.slow } : null })) as [PvpFighter, PvpFighter],
      p: this.projectiles.map(p => ({ id: p.id, o: p.owner, l: p.lane, x0: p.x0, x1: p.x1, g: p.progress, s: p.speed, d: p.damage, c: p.color, sp: p.spell.id, r: p.radius, dl: p.delay, rf: p.reflected })),
      cd: [{ ...this.cooldowns[0] }, { ...this.cooldowns[1] }],
    };
  }

  /** Overwrites the local state with an authoritative snapshot (projectile objects are kept by id). */
  applySnapshot(s: PvpSnapshot): void {
    this.time = s.t; this.over = s.over; this.overT = s.overT;
    for (let i = 0; i < 2; i++) Object.assign(this.fighters[i], s.f[i]);
    const byId = new Map(this.projectiles.map(p => [p.id, p]));
    this.projectiles = s.p.map(c => {
      const p = byId.get(c.id) ?? { id: c.id, owner: c.o, lane: c.l, x0: c.x0, x1: c.x1, progress: c.g, speed: c.s, damage: c.d, color: c.c, spell: SPELL_BY_ID[c.sp], radius: c.r, delay: c.dl, reflected: c.rf };
      p.owner = c.o; p.lane = c.l; p.x0 = c.x0; p.x1 = c.x1; p.progress = c.g; p.speed = c.s; p.damage = c.d; p.color = c.c; p.delay = c.dl; p.reflected = c.rf;
      return p;
    });
    this.cooldowns[0] = { ...s.cd[0] }; this.cooldowns[1] = { ...s.cd[1] };
  }
}

export interface PvpSnapshot {
  t: number; over: FighterIndex | null; overT: number;
  f: [PvpFighter, PvpFighter];
  p: { id: number; o: FighterIndex; l: number; x0: number; x1: number; g: number; s: number; d: number; c: string; sp: string; r: number; dl: number; rf: boolean }[];
  cd: [Record<string, number>, Record<string, number>];
}

export function sideOf(who: FighterIndex, me: FighterIndex): Side { return who === me ? 'player' : 'enemy'; }

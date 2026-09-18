// Battle simulation. No DOM, no three.js: it advances with tick(dt) and emits events
// that the renderer and HUD consume. Lanes are 0..2 (left, centre, right).
import { ENEMY_Z, LANE_X, LANES, TRAINING_DUMMY_HP, type EnemyDef } from './data';
import type { SpellDef } from './spells';
import type { PlayerStats } from './stats';

export type Side = 'player' | 'enemy';
export type AttackKind = 'bolt' | 'double' | 'homing' | 'barrage' | 'heal' | 'shield';

export interface Projectile {
  id: number;
  owner: Side;
  lane: number;          // target lane
  x0: number; x1: number; // start and target x (visual interpolation)
  z: number;
  speed: number;
  damage: number;
  color: string;
  homing: boolean;       // enemy seekers retarget until close; player spells always home
  spell?: SpellDef;
  reflected?: boolean;
  radius: number;
  /** Extra travel added before spawning (barrage shots), in world units. */
  delayZ: number;
}

export interface Dot { perSec: number; t: number; color: string }

export interface Fighter {
  hp: number; maxHp: number;
  shield: number; shieldT: number;
  lane: number;
  dots: Dot[];
}

export interface PlayerState extends Fighter {
  mana: number; maxMana: number;
  stamina: number; maxStamina: number;
  reflectT: number;
  phaseCharges: number; phaseT: number;
  hot: { perSec: number; t: number } | null;
  iframesT: number;
  dodgeT: number;        // time since last dodge (for animation)
  dodgeDir: number;
  revived: boolean;
}

export interface EnemyState extends Fighter {
  x: number;             // visual x (drifts between lanes)
  laneT: number;
  castTimer: number;
  casting: { kind: AttackKind; lanes: number[]; t: number; dur: number } | null;
  freezeT: number;
  slow: { factor: number; t: number } | null;
  healCd: number;
  shieldCd: number;
}

export type BattleEvent =
  | { type: 'cast'; who: Side; spell?: SpellDef; color: string; kind?: AttackKind }
  | { type: 'telegraph'; lanes: number[]; dur: number; kind: AttackKind }
  | { type: 'spawn'; p: Projectile }
  | { type: 'impact'; p: Projectile; hit: boolean; who: Side }
  | { type: 'damage'; who: Side; amount: number; absorbed: number; color: string; dot?: boolean }
  | { type: 'heal'; who: Side; amount: number }
  | { type: 'shield'; who: Side; amount: number }
  | { type: 'reflect'; p: Projectile }
  | { type: 'phase' }
  | { type: 'miss' }
  | { type: 'buff'; who: Side; name: string; color: string }
  | { type: 'freeze'; dur: number }
  | { type: 'interrupt' }
  | { type: 'revive' }
  | { type: 'death'; who: Side }
  | { type: 'fizzle'; reason: 'mana' | 'cooldown' | 'stamina' };

export interface BattleOptions {
  enemy: EnemyDef;
  stats: PlayerStats;
  loadout: SpellDef[];
  training?: boolean;
}

let nextId = 1;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export class Battle {
  readonly enemyDef: EnemyDef;
  readonly stats: PlayerStats;
  readonly loadout: SpellDef[];
  readonly training: boolean;
  /** Training only: whether the dummy fights back. */
  sparring = false;

  player: PlayerState;
  enemy: EnemyState;
  projectiles: Projectile[] = [];
  cooldowns: Record<string, number> = {};
  time = 0;
  over: 'win' | 'lose' | null = null;
  overT = 0;
  damageDealt = 0;
  damageTaken = 0;
  casts = 0;
  private events: BattleEvent[] = [];

  constructor(opts: BattleOptions) {
    this.enemyDef = opts.enemy;
    this.stats = opts.stats;
    this.loadout = opts.loadout;
    this.training = !!opts.training;
    const s = opts.stats;
    this.player = {
      hp: s.maxHp, maxHp: s.maxHp, shield: 0, shieldT: 0, lane: 1, dots: [],
      mana: s.maxMana, maxMana: s.maxMana, stamina: s.maxStamina, maxStamina: s.maxStamina, reflectT: 0, phaseCharges: 0, phaseT: 0, hot: null,
      iframesT: 0, dodgeT: 9, dodgeDir: 0, revived: false,
    };
    const hp = this.training ? TRAINING_DUMMY_HP : opts.enemy.hp;
    this.enemy = {
      hp, maxHp: hp, shield: 0, shieldT: 0, lane: 1, x: 0, dots: [], laneT: rand(2, 4),
      castTimer: this.training ? 1.5 : 1.6, casting: null, freezeT: 0, slow: null, healCd: 0, shieldCd: 0,
    };
  }

  drainEvents(): BattleEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private emit(e: BattleEvent): void { this.events.push(e); }

  // ---- player input ----------------------------------------------------------
  dodge(dir: -1 | 1): boolean {
    if (this.over) return false;
    const target = this.player.lane + dir;
    if (target < 0 || target >= LANES) return false;
    if (this.player.stamina < this.stats.dodgeCost) { this.emit({ type: 'fizzle', reason: 'stamina' }); return false; }
    this.player.stamina -= this.stats.dodgeCost;
    this.player.lane = target;
    this.player.iframesT = this.stats.iframes;
    this.player.dodgeT = 0;
    this.player.dodgeDir = dir;
    return true;
  }

  spellCost(spell: SpellDef): number {
    return Math.round(spell.cost * this.stats.costMult);
  }

  cast(spellId: string): 'ok' | 'mana' | 'cooldown' | 'over' {
    if (this.over) return 'over';
    const spell = this.loadout.find(s => s.id === spellId);
    if (!spell) return 'over';
    if ((this.cooldowns[spell.id] ?? 0) > 0) { this.emit({ type: 'fizzle', reason: 'cooldown' }); return 'cooldown'; }
    const cost = this.spellCost(spell);
    if (this.player.mana < cost) { this.emit({ type: 'fizzle', reason: 'mana' }); return 'mana'; }
    this.player.mana -= cost;
    if (spell.cooldown) this.cooldowns[spell.id] = spell.cooldown;
    this.casts++;
    const p = this.player, s = this.stats;
    this.emit({ type: 'cast', who: 'player', spell, color: spell.color });

    if (spell.shield) {
      const amt = Math.round(spell.shield.amount * s.shieldMult);
      p.shield = Math.max(p.shield, amt);
      p.shieldT = spell.shield.dur;
      this.emit({ type: 'shield', who: 'player', amount: amt });
    }
    if (spell.heal) this.healPlayer(Math.round(spell.heal * s.healMult));
    if (spell.cleanse) p.dots = [];
    if (spell.hot) { p.hot = { perSec: spell.hot.perSec * s.healMult, t: spell.hot.dur }; this.emit({ type: 'buff', who: 'player', name: 'Regenerating', color: spell.color }); }
    if (spell.reflect) { p.reflectT = spell.reflect; this.emit({ type: 'buff', who: 'player', name: 'Mirror Shell', color: spell.color }); }
    if (spell.phase) { p.phaseCharges = spell.phase.charges; p.phaseT = spell.phase.dur; this.emit({ type: 'buff', who: 'player', name: 'Phased', color: spell.color }); }
    if (spell.mana) { p.mana = Math.min(p.maxMana, p.mana + spell.mana); this.emit({ type: 'buff', who: 'player', name: `+${spell.mana} mana`, color: spell.color }); }
    if (spell.slow && !spell.damage) { this.enemy.slow = { factor: spell.slow.factor, t: spell.slow.dur }; this.emit({ type: 'buff', who: 'enemy', name: 'Slowed', color: spell.color }); }

    if (spell.damage) {
      const hits = spell.hits ?? 1;
      const speed = spell.speed ?? 16;
      for (let i = 0; i < hits; i++) {
        const proj: Projectile = {
          id: nextId++, owner: 'player', lane: this.enemy.lane, x0: LANE_X[p.lane] + (i - (hits - 1) / 2) * 0.35, x1: this.enemy.x,
          z: 0, speed, damage: spell.damage * s.power, color: spell.color, homing: true, spell, radius: 0.22, delayZ: i * speed * 0.14,
        };
        this.projectiles.push(proj);
        this.emit({ type: 'spawn', p: proj });
      }
    }
    return 'ok';
  }

  // ---- simulation ----------------------------------------------------------
  tick(dt: number): void {
    this.time += dt;
    const p = this.player, e = this.enemy;

    if (this.over) {
      this.overT += dt;
      this.moveProjectiles(dt, false);
      return;
    }

    // Player timers.
    p.mana = Math.min(p.maxMana, p.mana + this.stats.regen * dt);
    p.stamina = Math.min(p.maxStamina, p.stamina + this.stats.staminaRegen * dt);
    p.iframesT = Math.max(0, p.iframesT - dt);
    p.dodgeT += dt;
    if (p.shieldT > 0) { p.shieldT -= dt; if (p.shieldT <= 0) p.shield = 0; }
    p.reflectT = Math.max(0, p.reflectT - dt);
    if (p.phaseT > 0) { p.phaseT -= dt; if (p.phaseT <= 0) p.phaseCharges = 0; }
    if (p.hot) { this.healPlayer(p.hot.perSec * dt, true); p.hot.t -= dt; if (p.hot.t <= 0) p.hot = null; }
    this.tickDots(p, 'player', dt);
    for (const id of Object.keys(this.cooldowns)) this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt);

    // Enemy timers.
    if (e.shieldT > 0) { e.shieldT -= dt; if (e.shieldT <= 0) e.shield = 0; }
    if (e.slow) { e.slow.t -= dt; if (e.slow.t <= 0) e.slow = null; }
    e.freezeT = Math.max(0, e.freezeT - dt);
    e.healCd = Math.max(0, e.healCd - dt);
    e.shieldCd = Math.max(0, e.shieldCd - dt);
    this.tickDots(e, 'enemy', dt);
    if (this.training && e.hp < e.maxHp * 0.5) e.hp = e.maxHp;

    // Enemy drifts between lanes for flavour.
    e.laneT -= dt;
    if (e.laneT <= 0) { e.lane = pick([0, 1, 2].filter(l => l !== e.lane)); e.laneT = rand(2.5, 5); }
    e.x += (LANE_X[e.lane] - e.x) * Math.min(1, dt * 4);

    // Enemy casting.
    const canAct = !(this.training && !this.sparring);
    if (canAct && e.freezeT <= 0) {
      const speed = e.slow ? e.slow.factor : 1;
      if (e.casting) {
        e.casting.t += dt * speed;
        if (e.casting.t >= e.casting.dur) { this.fire(e.casting.kind, e.casting.lanes); e.casting = null; e.castTimer = this.enemyDef.castInterval * rand(0.85, 1.15); }
      } else {
        e.castTimer -= dt * speed;
        if (e.castTimer <= 0) this.beginCast();
      }
    }

    this.moveProjectiles(dt, true);
    this.checkEnd();
  }

  private tickDots(f: Fighter, who: Side, dt: number): void {
    for (const d of f.dots) {
      const amt = d.perSec * dt;
      d.t -= dt;
      if (who === 'enemy') this.damageEnemy(amt, d.color, true, true);
      else this.damagePlayer(amt, d.color, true);
    }
    f.dots = f.dots.filter(d => d.t > 0);
  }

  private healPlayer(amount: number, quiet = false): void {
    const p = this.player;
    const real = Math.min(p.maxHp - p.hp, amount);
    if (real <= 0) return;
    p.hp += real;
    if (!quiet) this.emit({ type: 'heal', who: 'player', amount: Math.round(real) });
  }

  private beginCast(): void {
    const e = this.enemy, d = this.enemyDef, L = d.level;
    const w: [AttackKind, number][] = [['bolt', 60]];
    if (L >= 6) w.push(['double', 22 + L * 0.1]);
    if (L >= 12) w.push(['homing', 12 + L * 0.15]);
    if (d.boss || L >= 30) w.push(['barrage', d.boss ? 18 : 10]);
    if (d.boss && e.hp < e.maxHp * 0.6 && e.healCd <= 0) w.push(['heal', 22]);
    if (d.boss && L >= 15 && e.shieldCd <= 0 && e.shield <= 0) w.push(['shield', 16]);
    if (this.training) w.length = 1;
    const total = w.reduce((s, [, n]) => s + n, 0);
    let r = Math.random() * total;
    let kind: AttackKind = 'bolt';
    for (const [k, n] of w) { r -= n; if (r <= 0) { kind = k; break; } }

    const pl = this.player.lane;
    let lanes: number[] = [pl];
    if (kind === 'double') lanes = [pl, pick([0, 1, 2].filter(l => l !== pl))];
    if (kind === 'barrage') lanes = [pl, pick([0, 1, 2]), pick([0, 1, 2])];
    const dur = kind === 'heal' ? 1.3 : kind === 'shield' ? 0.5 : d.telegraph;
    e.casting = { kind, lanes, t: 0, dur };
    this.emit({ type: 'telegraph', lanes, dur, kind });
  }

  private fire(kind: AttackKind, lanes: number[]): void {
    const e = this.enemy, d = this.enemyDef;
    if (kind === 'heal') {
      const amt = Math.round(e.maxHp * 0.1);
      e.hp = Math.min(e.maxHp, e.hp + amt);
      e.healCd = 12;
      this.emit({ type: 'heal', who: 'enemy', amount: amt });
      return;
    }
    if (kind === 'shield') {
      e.shield = Math.round(e.maxHp * 0.15);
      e.shieldT = 7;
      e.shieldCd = 16;
      this.emit({ type: 'shield', who: 'enemy', amount: e.shield });
      return;
    }
    const base = this.training ? 5 : d.damage;
    const mult = kind === 'homing' ? 1.25 : kind === 'double' ? 0.9 : kind === 'barrage' ? 0.7 : 1;
    const speed = kind === 'homing' ? d.projectileSpeed * 0.8 : d.projectileSpeed;
    this.emit({ type: 'cast', who: 'enemy', color: d.tier.spell, kind });
    lanes.forEach((lane, i) => {
      const proj: Projectile = {
        id: nextId++, owner: 'enemy', lane, x0: e.x, x1: LANE_X[lane], z: ENEMY_Z, speed,
        damage: base * mult, color: kind === 'homing' ? '#ff4df2' : d.tier.spell, homing: kind === 'homing',
        radius: kind === 'homing' ? 0.3 : 0.24, delayZ: kind === 'barrage' ? i * speed * 0.32 : 0,
      };
      this.projectiles.push(proj);
      this.emit({ type: 'spawn', p: proj });
    });
  }

  private moveProjectiles(dt: number, resolve: boolean): void {
    const p = this.player, e = this.enemy;
    const keep: Projectile[] = [];
    for (const pr of this.projectiles) {
      if (pr.delayZ > 0) { pr.delayZ -= pr.speed * dt; keep.push(pr); continue; }
      if (pr.owner === 'enemy') {
        pr.z += pr.speed * dt;
        if (pr.homing && pr.z < -4.5) { pr.lane = p.lane; pr.x1 = LANE_X[p.lane]; }
        if (pr.z < 0 || !resolve) { if (pr.z < 3) keep.push(pr); continue; }
        // Arrived at the player's row.
        if (pr.lane === p.lane && p.reflectT > 0) {
          pr.owner = 'player'; pr.reflected = true; pr.homing = true; pr.x0 = LANE_X[p.lane]; pr.x1 = e.x; pr.z = 0; pr.speed = 20; pr.color = '#e6f2ff';
          this.emit({ type: 'reflect', p: pr });
          keep.push(pr);
          continue;
        }
        if (pr.lane === p.lane && p.iframesT <= 0) {
          if (p.phaseCharges > 0) { p.phaseCharges--; this.emit({ type: 'phase' }); this.emit({ type: 'impact', p: pr, hit: false, who: 'player' }); continue; }
          this.damagePlayer(pr.damage, pr.color, false);
          if (this.enemyDef.tier.name === 'Necromancer' || this.enemyDef.tier.name === 'Warlock') {
            p.dots.push({ perSec: (pr.damage * 0.25) / 3, t: 3, color: '#7dff7d' });
          }
          this.emit({ type: 'impact', p: pr, hit: true, who: 'player' });
        } else {
          this.emit({ type: 'miss' });
          this.emit({ type: 'impact', p: pr, hit: false, who: 'player' });
        }
      } else {
        pr.z -= pr.speed * dt;
        pr.x1 = e.x;
        if (pr.z > ENEMY_Z || !resolve) { if (pr.z > ENEMY_Z - 3) keep.push(pr); continue; }
        const sp = pr.spell;
        this.damageEnemy(pr.damage, pr.color, !!sp?.pierce, false);
        if (sp) {
          if (sp.lifesteal) this.healPlayer(Math.round(pr.damage * sp.lifesteal));
          if (sp.dot) e.dots.push({ perSec: sp.dot.perSec * this.stats.power, t: sp.dot.dur, color: sp.color });
          if (sp.slow) { e.slow = { factor: sp.slow.factor, t: sp.slow.dur }; this.emit({ type: 'buff', who: 'enemy', name: 'Slowed', color: sp.color }); }
          if (sp.freeze) { e.freezeT = Math.max(e.freezeT, sp.freeze); this.emit({ type: 'freeze', dur: sp.freeze }); }
          if (sp.interrupt && e.casting) { e.casting = null; e.castTimer = this.enemyDef.castInterval * 0.7; this.emit({ type: 'interrupt' }); }
        }
        this.emit({ type: 'impact', p: pr, hit: true, who: 'enemy' });
      }
    }
    this.projectiles = keep;
  }

  private damagePlayer(amount: number, color: string, dot: boolean): void {
    const p = this.player;
    if (this.over) return;
    let absorbed = 0;
    if (p.shield > 0 && !dot) {
      absorbed = Math.min(p.shield, amount);
      p.shield -= absorbed;
      if (p.shield <= 0) { p.shield = 0; p.shieldT = 0; }
    }
    const real = amount - absorbed;
    p.hp -= real;
    this.damageTaken += real;
    if (!dot || Math.random() < 0.1) this.emit({ type: 'damage', who: 'player', amount: Math.round(dot ? amount * 10 : real), absorbed: Math.round(absorbed), color, dot });
    if (p.hp <= 0) {
      if (this.stats.revive > 0 && !p.revived) {
        p.revived = true;
        p.hp = Math.round(p.maxHp * this.stats.revive);
        p.iframesT = 1.5;
        this.emit({ type: 'revive' });
      } else {
        p.hp = 0;
      }
    }
  }

  private damageEnemy(amount: number, color: string, pierce: boolean, dot: boolean): void {
    const e = this.enemy;
    if (this.over) return;
    let absorbed = 0;
    if (e.shield > 0 && !pierce && !dot) {
      absorbed = Math.min(e.shield, amount);
      e.shield -= absorbed;
      if (e.shield <= 0) { e.shield = 0; e.shieldT = 0; }
    }
    const real = amount - absorbed;
    e.hp -= real;
    this.damageDealt += real;
    if (!dot || Math.random() < 0.12) this.emit({ type: 'damage', who: 'enemy', amount: Math.round(dot ? amount * 8 : real), absorbed: Math.round(absorbed), color, dot });
  }

  private checkEnd(): void {
    if (this.player.hp <= 0) { this.over = 'lose'; this.overT = 0; this.emit({ type: 'death', who: 'player' }); }
    else if (this.enemy.hp <= 0 && !this.training) { this.over = 'win'; this.overT = 0; this.emit({ type: 'death', who: 'enemy' }); }
  }
}

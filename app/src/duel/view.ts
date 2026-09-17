// Presents a PvP simulation through the same surface the campaign Battle exposes, so the arena
// renderer and the HUD work unchanged for duels. "me" is the fighter index this client controls.
import {
  ENEMY_Z, DUEL_DISTANCE, sideOf, LANE_X, enemyForLevel,
  type BattleEvent, type EnemyDef, type FighterIndex, type Projectile, type PvpBattle, type PvpEvent, type PvpProjectile, type SpellDef,
} from '@wizard/shared';

/** The subset of Battle the UI and renderer rely on. Battle itself satisfies it structurally. */
export interface BattleLike {
  player: PlayerLike;
  enemy: EnemyLike;
  projectiles: Projectile[];
  cooldowns: Record<string, number>;
  loadout: SpellDef[];
  stats: { dodgeCost: number; coinMult: number };
  over: 'win' | 'lose' | null;
  overT: number;
  training: boolean;
  enemyDef: EnemyDef;
  damageDealt: number;
  casts: number;
  spellCost(spell: SpellDef): number;
  drainEvents(): BattleEvent[];
  dodge(dir: -1 | 1): boolean;
  cast(spellId: string): string;
  tick(dt: number): void;
}
export interface PlayerLike {
  hp: number; maxHp: number; mana: number; maxMana: number; stamina: number; maxStamina: number;
  shield: number; reflectT: number; phaseCharges: number; hot: { t: number } | null; dots: { color: string }[];
  lane: number; dodgeT: number; dodgeDir: number;
}
export interface EnemyLike {
  hp: number; maxHp: number; shield: number; freezeT: number; slow: { t: number } | null; dots: { perSec: number; color: string }[]; x: number; lane: number;
}

export class PvpView implements BattleLike {
  readonly training = false;
  readonly enemyDef: EnemyDef;
  damageDealt = 0;
  casts = 0;
  private projMap = new Map<number, Projectile>();
  private pending: BattleEvent[] = [];
  /** Inputs are routed here so online sessions can forward them to the server. */
  onInput: ((kind: 'd' | 'c', value: number | string) => void) | null = null;
  /** True during the countdown and before the server starts the match. */
  locked = true;

  constructor(readonly sim: PvpBattle, readonly me: FighterIndex, opponentName: string) {
    this.enemyDef = { ...enemyForLevel(1), name: opponentName, boss: false };
  }

  get foe(): FighterIndex { return this.me === 0 ? 1 : 0; }
  get player(): PlayerLike { return this.sim.fighters[this.me]; }
  get enemy(): EnemyLike { return this.sim.fighters[this.foe]; }
  get cooldowns(): Record<string, number> { return this.sim.cooldowns[this.me]; }
  get loadout(): SpellDef[] { return this.sim.loadouts[this.me]; }
  get stats(): { dodgeCost: number; coinMult: number } { return this.sim.stats[this.me]; }
  get over(): 'win' | 'lose' | null { return this.sim.over === null ? null : this.sim.over === this.me ? 'win' : 'lose'; }
  get overT(): number { return this.sim.overT; }
  spellCost(spell: SpellDef): number { return this.sim.spellCost(this.me, spell); }

  get projectiles(): Projectile[] {
    const out: Projectile[] = [];
    const live = new Set<number>();
    for (const p of this.sim.projectiles) {
      live.add(p.id);
      out.push(this.project(p));
    }
    for (const id of [...this.projMap.keys()]) if (!live.has(id)) this.projMap.delete(id);
    return out;
  }

  private project(p: PvpProjectile): Projectile {
    let v = this.projMap.get(p.id);
    const mine = p.owner === this.me;
    if (!v) {
      v = { id: p.id, owner: mine ? 'player' : 'enemy', lane: p.lane, x0: p.x0, x1: p.x1, z: 0, speed: p.speed, damage: p.damage, color: p.color, homing: !mine, spell: p.spell, radius: p.radius, delayZ: 0 };
      this.projMap.set(p.id, v);
    }
    v.owner = mine ? 'player' : 'enemy';
    v.lane = p.lane; v.x1 = p.x1; v.x0 = p.x0; v.color = p.color; v.speed = p.speed;
    v.z = mine ? -p.progress * DUEL_DISTANCE : ENEMY_Z + p.progress * DUEL_DISTANCE;
    v.delayZ = p.delay > 0 ? 1 : 0;
    return v;
  }

  dodge(dir: -1 | 1): boolean {
    if (this.locked) return false;
    const ok = this.sim.dodge(this.me, dir);
    if (ok && this.onInput) this.onInput('d', dir);
    return ok;
  }

  cast(spellId: string): string {
    if (this.locked) return 'over';
    const r = this.sim.cast(this.me, spellId);
    if (r === 'ok') { this.casts++; if (this.onInput) this.onInput('c', spellId); }
    return r;
  }

  tick(dt: number): void { this.sim.tick(dt); }

  /** Converts simulation events into the renderer's vocabulary (relative to "me"). */
  pushEvents(events: PvpEvent[]): void {
    for (const e of events) {
      const who = sideOf(e.who, this.me);
      switch (e.type) {
        case 'cast': this.pending.push({ type: 'cast', who, spell: e.spell, color: e.color }); break;
        case 'telegraph': if (who === 'player') this.pending.push({ type: 'telegraph', lanes: e.lanes, dur: e.dur, kind: 'bolt' }); break;
        case 'spawn': this.pending.push({ type: 'spawn', p: this.project(e.p) }); break;
        case 'impact': { const p = this.projMap.get(e.id); if (p) this.pending.push({ type: 'impact', p, hit: e.hit, who }); break; }
        case 'damage': if (who === 'enemy' && !e.dot) this.damageDealt += e.amount; this.pending.push({ type: 'damage', who, amount: e.amount, absorbed: e.absorbed, color: e.color, dot: e.dot }); break;
        case 'heal': this.pending.push({ type: 'heal', who, amount: e.amount }); break;
        case 'shield': this.pending.push({ type: 'shield', who, amount: e.amount }); break;
        case 'reflect': { const p = this.projMap.get(e.id); if (p) this.pending.push({ type: 'reflect', p }); break; }
        case 'phase': if (who === 'player') this.pending.push({ type: 'phase' }); break;
        case 'miss': if (who === 'player') this.pending.push({ type: 'miss' }); break;
        case 'buff': this.pending.push({ type: 'buff', who, name: e.name, color: e.color }); break;
        case 'freeze': this.pending.push(who === 'enemy' ? { type: 'freeze', dur: e.dur } : { type: 'buff', who, name: 'Frozen!', color: '#b8f4ff' }); break;
        case 'revive': if (who === 'player') this.pending.push({ type: 'revive' }); break;
        case 'death': this.pending.push({ type: 'death', who }); break;
        case 'fizzle': if (who === 'player') this.pending.push({ type: 'fizzle', reason: e.reason === 'frozen' ? 'cooldown' : e.reason }); break;
      }
    }
  }

  drainEvents(): BattleEvent[] {
    this.pushEvents(this.sim.drainEvents());
    const out = this.pending; this.pending = [];
    return out;
  }

  /** Opponent x for the renderer follows the lane like the campaign enemy does. */
  opponentX(): number { return LANE_X[this.enemy.lane]; }
}

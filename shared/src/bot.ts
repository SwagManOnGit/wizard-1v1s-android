// A duel opponent for offline practice and for filling matchmaking when nobody is online.
import { LOCK_PROGRESS, type FighterIndex, type PvpBattle } from './pvp';
import { Rng } from './rng';

export type BotLevel = 'easy' | 'normal' | 'hard';

// Reaction is measured from the moment a projectile commits to a lane; slow bots get hit a lot.
const REACTION: Record<BotLevel, [number, number]> = { easy: [0.45, 0.8], normal: [0.3, 0.5], hard: [0.22, 0.34] };
const DISTRACTION: Record<BotLevel, number> = { easy: 0.35, normal: 0.2, hard: 0.08 };
const CAST_GAP: Record<BotLevel, [number, number]> = { easy: [1.8, 2.8], normal: [1.1, 1.9], hard: [0.7, 1.3] };

export class PvpBot {
  private reactT = 0;
  private distracted = false;
  private castT = 1;
  private rng: Rng;

  constructor(private sim: PvpBattle, private me: FighterIndex, private level: BotLevel = 'normal', seed = 1234) {
    this.rng = new Rng(seed);
  }

  tick(dt: number): void {
    if (this.sim.over !== null) return;
    const f = this.sim.fighters[this.me];
    const foe: FighterIndex = this.me === 0 ? 1 : 0;
    // Threat check: a projectile that has committed to my lane.
    const incoming = this.sim.projectiles.filter(p => p.owner === foe && p.lane === f.lane && p.delay <= 0 && p.progress >= LOCK_PROGRESS);
    if (incoming.length) {
      this.reactT -= dt;
      if (this.reactT <= 0 && !this.distracted) {
        const safe = [0, 1, 2].filter(l => l !== f.lane && !this.sim.projectiles.some(p => p.owner === foe && p.lane === l && p.progress >= LOCK_PROGRESS));
        const target = safe.length ? safe.reduce((a, c) => Math.abs(c - f.lane) < Math.abs(a - f.lane) ? c : a) : (f.lane === 1 ? (this.rng.next() < 0.5 ? 0 : 2) : 1);
        this.sim.dodge(this.me, target < f.lane ? -1 : 1);
        this.reactT = this.rng.range(...REACTION[this.level]);
      }
    } else {
      // A new threat starts a fresh reaction window; sometimes the bot simply does not notice it.
      this.reactT = this.rng.range(...REACTION[this.level]);
      this.distracted = this.rng.next() < DISTRACTION[this.level];
    }
    this.castT -= dt;
    if (this.castT > 0) return;
    this.castT = this.rng.range(...CAST_GAP[this.level]);
    const spells = this.sim.loadouts[this.me];
    const can = (id: string): boolean => { const s = spells.find(x => x.id === id); return !!s && f.mana >= this.sim.spellCost(this.me, s) && (this.sim.cooldowns[this.me][id] ?? 0) <= 0; };
    const heal = spells.find(s => s.heal && can(s.id));
    const shield = spells.find(s => s.shield && can(s.id));
    if (f.hp < f.maxHp * 0.4 && heal) { this.sim.cast(this.me, heal.id); return; }
    if (incoming.length && shield && f.shield <= 0 && this.rng.next() < 0.5) { this.sim.cast(this.me, shield.id); return; }
    const attacks = spells.filter(s => s.damage && can(s.id));
    if (!attacks.length) return;
    // Prefer heavier hits, but keep some variety.
    attacks.sort((a, b) => (b.damage ?? 0) - (a.damage ?? 0));
    const pickFrom = attacks.slice(0, this.level === 'hard' ? 2 : 3);
    this.sim.cast(this.me, this.rng.pick(pickFrom).id);
  }
}

// Does the five-hundred-level campaign actually stay finishable?
//
// Simulates a competent player (dodges late but reliably, casts the best spell they can afford,
// heals when low) against the enemy curve at a spread of levels, using a build that matches how
// far along they would plausibly be. Run with: npx tsx src/campaigntest.ts
import {
  Battle, MAX_LEVEL, SPELLS, UPGRADES, computeStats, enemyForLevel, isChapterBoss,
  type BattleEvent, type EquipSlot, type SpellDef,
} from '@wizard/shared';

const DT = 1 / 60;
const LIMIT = 300; // seconds before we call it a stalemate

/** A plausible build for someone who has just arrived at this level. */
function buildFor(level: number): { upgrades: Record<string, number>; equipped: Partial<Record<EquipSlot, string>>; loadout: SpellDef[] } {
  const p = Math.min(1, level / 400);
  const upgrades: Record<string, number> = {};
  for (const u of UPGRADES) upgrades[u.id] = Math.floor(u.max * p);
  const rarity = Math.max(1, Math.min(5, 1 + Math.round(p * 4)));
  const element = 'fire';
  const equipped: Partial<Record<EquipSlot, string>> = {
    hat: `${element}_hat_${rarity}`, outfit: `${element}_outfit_${rarity}`,
    staff: `${element}_staff_${rarity}`, shoes: `${element}_shoes_${rarity}`,
  };
  const stats = computeStats({ upgrades, equipped });
  // Whatever they could have found: their element plus arcane, up to the tier their gear opens.
  const maxTier = rarity >= 2 ? 5 : 2;
  const pool = SPELLS.filter(s => !s.secret && (s.element === element || s.element === 'arcane') && s.tier <= maxTier);
  const attack = pool.filter(s => s.damage).sort((a, b) => (b.damage ?? 0) * (b.hits ?? 1) - (a.damage ?? 0) * (a.hits ?? 1));
  const heal = pool.filter(s => s.heal).sort((a, b) => (b.heal ?? 0) - (a.heal ?? 0));
  const shield = pool.filter(s => s.shield).sort((a, b) => (b.shield?.amount ?? 0) - (a.shield?.amount ?? 0));
  const loadout = [...attack.slice(0, stats.slots - 2), ...heal.slice(0, 1), ...shield.slice(0, 1)];
  return { upgrades, equipped, loadout };
}

/**
 * Sustained damage a player at this stage can actually put out, measured against the training
 * dummy rather than guessed: mana regen, not spell damage, is what caps it.
 */
function dpsProbe(level: number, seconds = 60): number {
  const { upgrades, equipped, loadout } = buildFor(level);
  const stats = computeStats({ upgrades, equipped });
  const b = new Battle({ enemy: enemyForLevel(level), stats, loadout, training: true });
  let castTimer = 0;
  while (b.time < seconds) {
    b.tick(DT);
    b.drainEvents();
    castTimer -= DT;
    if (castTimer <= 0) {
      const best = loadout
        .filter(x => x.damage && b.player.mana >= b.spellCost(x) && (b.cooldowns[x.id] ?? 0) <= 0)
        .sort((x, y) => (y.damage ?? 0) * (y.hits ?? 1) - (x.damage ?? 0) * (x.hits ?? 1))[0];
      castTimer = best && b.cast(best.id) === 'ok' ? 0.5 : 0.15;
    }
  }
  return b.damageDealt / seconds;
}

interface Result { level: number; won: boolean; time: number; hpLeft: number; casts: number; dodges: number; hits: number }

function fight(level: number, accuracy: number): Result {
  const { upgrades, equipped, loadout } = buildFor(level);
  const stats = computeStats({ upgrades, equipped });
  const b = new Battle({ enemy: enemyForLevel(level), stats, loadout });
  let dodges = 0, hits = 0, castTimer = 0;
  // One reaction roll per incoming shot, not per frame: rolling every frame means never missing.
  const reacted = new Map<number, boolean>();

  while (!b.over && b.time < LIMIT) {
    b.tick(DT);
    for (const ev of b.drainEvents() as BattleEvent[]) if (ev.type === 'damage' && ev.who === 'player' && !ev.dot) hits++;

    // Dodge: leave the lane just before something lands in it, once homing shots have committed.
    const incoming = b.projectiles
      .filter(pr => pr.owner === 'enemy' && pr.delayZ <= 0 && pr.lane === b.player.lane && (!pr.homing || pr.z >= -4.5))
      .sort((x, y) => -x.z / x.speed - -y.z / y.speed)[0];
    const danger = incoming ? -incoming.z / incoming.speed : undefined;
    if (incoming && !reacted.has(incoming.id)) reacted.set(incoming.id, Math.random() < accuracy);
    if (danger !== undefined && danger < 0.28 && b.player.iframesT <= 0 && reacted.get(incoming!.id)) {
      const busy = new Set(b.projectiles.filter(pr => pr.owner === 'enemy' && -pr.z / pr.speed < 0.7).map(pr => pr.lane));
      const dir = [-1, 1].find(d => {
        const t = b.player.lane + d;
        return t >= 0 && t <= 2 && !busy.has(t);
      }) ?? (b.player.lane === 0 ? 1 : -1);
      if (b.dodge(dir as -1 | 1)) dodges++;
    }

    // Cast: heal when low, otherwise the biggest thing affordable right now.
    castTimer -= DT;
    if (castTimer <= 0) {
      const low = b.player.hp < b.player.maxHp * 0.45;
      const options = loadout
        .filter(s => b.player.mana >= b.spellCost(s) && (b.cooldowns[s.id] ?? 0) <= 0)
        .sort((x, y) => (low ? (y.heal ?? 0) - (x.heal ?? 0) : 0) || (y.damage ?? 0) * (y.hits ?? 1) - (x.damage ?? 0) * (x.hits ?? 1));
      const pick = low ? (options.find(s => s.heal) ?? options[0]) : options[0];
      if (pick && b.cast(pick.id) === 'ok') castTimer = 0.55;
      else castTimer = 0.2;
    }
  }
  return { level, won: b.over === 'win', time: b.time, hpLeft: Math.max(0, Math.round(b.player.hp)), casts: b.casts, dodges, hits };
}

// A spread of ordinary levels, ordinary bosses and chapter lords: the lords are one level in
// fifty, so testing only multiples of fifty would make the game look far harder than it is.
const LEVELS = [1, 5, 10, 25, 49, 50, 75, 99, 100, 150, 199, 200, 250, 299, 300, 375, 400, 450, 499, MAX_LEVEL];
// Two players: one who dodges four shots in five, and one who is genuinely good at it. The
// campaign is meant to stay winnable for the first and comfortable for the second.
const SLOPPY = 0.8, SHARP = 0.95;
const RUNS = 4;
console.log('level  enemy hp    dmg  coins    dps   ttk   sloppy   sharp    time  hp left  hits');
let failures = 0;
for (const L of LEVELS) {
  const e = enemyForLevel(L);
  const sloppy = Array.from({ length: RUNS }, () => fight(L, SLOPPY));
  const sharp = Array.from({ length: RUNS }, () => fight(L, SHARP));
  const wins = (rs: Result[]): number => rs.filter(r => r.won).length;
  const avg = (rs: Result[], g: (r: Result) => number): number => rs.reduce((s, r) => s + g(r), 0) / rs.length;
  const tag = isChapterBoss(L) ? 'LORD' : e.boss ? 'boss' : '';
  const dps = dpsProbe(L);
  console.log(
    `${String(L).padStart(4)}${tag.padStart(6)} ${String(e.hp).padStart(7)} ${String(e.damage).padStart(5)} ${String(e.coins).padStart(6)}` +
    ` ${dps.toFixed(0).padStart(6)} ${(e.hp / dps).toFixed(0).padStart(4)}s` +
    `   ${wins(sloppy)}/${RUNS}      ${wins(sharp)}/${RUNS}` +
    `  ${avg(sharp, r => r.time).toFixed(0).padStart(5)}s ${avg(sharp, r => r.hpLeft).toFixed(0).padStart(7)} ${avg(sharp, r => r.hits).toFixed(0).padStart(5)}`,
  );
  // A sharp player must always win; a sloppy one is allowed to lose deep in the tower.
  if (wins(sharp) < RUNS) failures++;
}

console.log(`\nlevels a sharp player did not always win: ${failures}`);
process.exit(failures === 0 ? 0 : 1);

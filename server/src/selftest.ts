// Headless checks: two bots duel, and a recorded ghost replays deterministically.
import { GhostPlayer, GhostRecorder, PvpBattle, PvpBot, RANKED_BUILD, computeStats, type GhostTape } from '@wizard/shared';

const stats = computeStats(RANKED_BUILD);
const loadout = ['spark', 'fireball', 'iceshard', 'ward', 'mend', 'lightning'];

// 1. Bot vs bot must end within the time limit without throwing.
{
  const sim = new PvpBattle({ seed: 42, loadouts: [loadout, loadout], stats: [stats, stats] });
  const a = new PvpBot(sim, 0, 'normal', 1), b = new PvpBot(sim, 1, 'hard', 2);
  let events = 0;
  while (sim.over === null && sim.time < 240) { a.tick(1 / 30); b.tick(1 / 30); sim.tick(1 / 30); events += sim.drainEvents().length; }
  console.log(`bot duel: winner=${sim.over} time=${sim.time.toFixed(1)}s hp=[${Math.round(sim.fighters[0].hp)}, ${Math.round(sim.fighters[1].hp)}] events=${events}`);
  if (sim.over === null) throw new Error('duel did not finish');
}

// 2. Record fighter 0's inputs, replay them against the same seed, expect identical outcome.
{
  const run = (tape?: GhostTape): { over: number | null; hp: number[]; tape: GhostTape } => {
    const sim = new PvpBattle({ seed: 7, loadouts: [loadout, loadout], stats: [stats, stats] });
    const rec = new GhostRecorder();
    const foe = new PvpBot(sim, 1, 'normal', 99);
    const me = tape ? null : new PvpBot(sim, 0, 'normal', 5);
    const ghost = tape ? new GhostPlayer(tape, sim, 0) : null;
    // Wrap inputs so the recorder sees exactly what the sim received.
    const origDodge = sim.dodge.bind(sim), origCast = sim.cast.bind(sim);
    sim.dodge = (i, dir) => { const ok = origDodge(i, dir); if (ok && i === 0 && !tape) rec.dodge(sim.time, dir); return ok; };
    sim.cast = (i, id) => { const r = origCast(i, id); if (r === 'ok' && i === 0 && !tape) rec.cast(sim.time, id); return r; };
    while (sim.over === null && sim.time < 240) { me?.tick(1 / 30); ghost?.tick(); foe.tick(1 / 30); sim.tick(1 / 30); sim.drainEvents(); }
    return { over: sim.over, hp: sim.fighters.map(f => Math.round(f.hp)), tape: { v: 1, name: 'test', rating: 1000, seed: 7, loadout, build: RANKED_BUILD, inputs: rec.inputs, duration: sim.time, won: sim.over === 0, createdAt: 0 } };
  };
  const live = run();
  const replay = run(live.tape);
  console.log(`ghost: live winner=${live.over} hp=${live.hp} inputs=${live.tape.inputs.length} | replay winner=${replay.over} hp=${replay.hp}`);
  if (live.over !== replay.over || live.hp.join() !== replay.hp.join()) throw new Error('ghost replay diverged');
}
console.log('selftest ok');

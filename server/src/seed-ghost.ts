// Posts a bot-played ghost tape under a fake device id so ghost duels can be tested locally.
import { GhostRecorder, PvpBattle, PvpBot, RANKED_BUILD, computeStats } from '@wizard/shared';
const stats = computeStats(RANKED_BUILD);
const loadout = ['spark', 'fireball', 'iceshard', 'ward', 'mend', 'lightning'];
const sim = new PvpBattle({ seed: 99, loadouts: [loadout, loadout], stats: [stats, stats] });
const rec = new GhostRecorder();
const me = new PvpBot(sim, 0, 'normal', 3), foe = new PvpBot(sim, 1, 'easy', 4);
const d = sim.dodge.bind(sim), c = sim.cast.bind(sim);
sim.dodge = (i, dir) => { const ok = d(i, dir); if (ok && i === 0) rec.dodge(sim.time, dir); return ok; };
sim.cast = (i, id) => { const r = c(i, id); if (r === 'ok' && i === 0) rec.cast(sim.time, id); return r; };
while (sim.over === null && sim.time < 120) { me.tick(1 / 30); foe.tick(1 / 30); sim.tick(1 / 30); sim.drainEvents(); }
const tape = { v: 1, name: 'SeedGhost', rating: 1000, seed: 99, loadout, build: RANKED_BUILD, inputs: rec.inputs, duration: sim.time, won: sim.over === 0, createdAt: Date.now() };
const res = await fetch('http://localhost:2567/api/ghost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: 'seed-device', tape }) });
console.log(res.status, await res.text(), `inputs=${rec.inputs.length} duration=${sim.time.toFixed(1)}`);

// Wizard 1v1s duel server: Colyseus rooms for real-time duels plus a small HTTP API for
// leaderboards, profiles and ghost tapes. Run with `npm run server` (tsx) or the Dockerfile.
import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { DUEL_ROOM, PROTOCOL_VERSION, type GhostPost, type GhostResultPost, type ScorePost } from '@wizard/shared';
import { Store } from './store';
import { DuelRoom } from './DuelRoom';

const PORT = Number(process.env.PORT ?? 2567);
const DATA = process.env.DATA_FILE ?? new URL('../data/db.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const store = new Store(DATA);

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, protocol: PROTOCOL_VERSION, ...store.counts }));

app.get('/api/leaderboard', (req, res) => {
  const by = req.query.by === 'rating' ? 'rating' : 'best';
  res.json({ by, entries: store.leaderboard(by) });
});

app.get('/api/profile/:deviceId', (req, res) => {
  const p = store.player(String(req.params.deviceId));
  res.json({ deviceId: p.deviceId, name: p.name, rating: p.rating, wins: p.wins, losses: p.losses, best: p.best });
});

app.post('/api/score', (req, res) => {
  const b = req.body as Partial<ScorePost>;
  if (typeof b.deviceId !== 'string' || typeof b.best !== 'number') { res.status(400).json({ error: 'bad request' }); return; }
  const best = Math.max(0, Math.min(100, Math.floor(b.best)));
  const p = store.recordBest(b.deviceId.slice(0, 64), String(b.name ?? 'Wizard').slice(0, 16), best);
  res.json({ ok: true, rating: p.rating, best: p.best });
});

app.post('/api/ghost', (req, res) => {
  const b = req.body as Partial<GhostPost>;
  const t = b.tape;
  if (typeof b.deviceId !== 'string' || !t || t.v !== 1 || !Array.isArray(t.inputs) || t.inputs.length > 2000) { res.status(400).json({ error: 'bad tape' }); return; }
  const id = store.addGhost(b.deviceId.slice(0, 64), { ...t, name: String(t.name).slice(0, 16), inputs: t.inputs.slice(0, 2000) });
  res.json({ ok: true, id });
});

app.get('/api/ghost/random', (req, res) => {
  const g = store.randomGhost(String(req.query.deviceId ?? ''), Number(req.query.rating ?? 1000));
  if (!g) { res.status(404).json({ error: 'no ghosts yet' }); return; }
  res.json(g);
});

app.post('/api/ghost/result', (req, res) => {
  const b = req.body as Partial<GhostResultPost>;
  if (typeof b.ghostId !== 'string') { res.status(400).json({ error: 'bad request' }); return; }
  store.ghostResult(b.ghostId, !!b.won);
  if (typeof b.deviceId === 'string' && b.won) store.recordDuel(b.deviceId, 'ghost', false);
  res.json({ ok: true });
});

const httpServer = createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define(DUEL_ROOM, DuelRoom, { store }).filterBy(['ranked']);

httpServer.listen(PORT, () => console.log(`Wizard 1v1s server on :${PORT} (${store.counts.players} players, ${store.counts.ghosts} ghosts)`));

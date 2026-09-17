# Duel server

`server/` is a small Node service: Colyseus rooms for real-time duels and an HTTP API for rankings, profiles and ghost tapes. It shares the simulation code in `shared/` with the app, so the server is the authority and clients only send inputs.

## Run locally

```bash
npm run server
```

Listens on port 2567. Health check: http://localhost:2567/api/health. The app's dev build points at `http://localhost:2567` by default (`VITE_SERVER_URL`).

Self-test (two bots duel, then a ghost replay is checked for determinism):

```bash
npm test -w server
```

## Endpoints

| Method and path | Purpose |
|---|---|
| `GET /api/health` | ok, protocol version, player and ghost counts |
| `GET /api/leaderboard?by=best` or `by=rating` | top 50 |
| `GET /api/profile/:deviceId` | name, rating, wins, losses, best |
| `POST /api/score` `{deviceId, name, best}` | records a best level |
| `POST /api/ghost` `{deviceId, tape}` | stores the player's latest ghost (one per player) |
| `GET /api/ghost/random?deviceId&rating` | a ghost near the player's rating, never their own |
| `POST /api/ghost/result` `{deviceId, ghostId, won}` | records the outcome |
| WebSocket room `duel` | joined with `{deviceId, name, loadout, build, ranked}`; see `shared/src/protocol.ts` |

Ranked rooms use a fixed build for both players and change Elo ratings (K = 32). Casual rooms use each player's own build. If nobody joins within 8 seconds a server-side bot fills the seat; beating it pays coins but not rating.

## Deploy on Fly.io (about 5 USD a month at this size)

1. Install flyctl and sign in: `fly auth login`.
2. From the repo root: `fly launch --no-deploy --copy-config --name wizard-1v1s` (accept `fly.toml`).
3. Persistent storage for the JSON database: `fly volumes create wizard_data --size 1 --region cdg`.
4. `fly deploy`. The URL is `https://wizard-1v1s.fly.dev`.
5. In GitHub, set the Actions variable `SERVER_URL` to that URL and push, so the app builds point at it.

Any Docker host works the same way (Railway, Render, a VPS): build `server/Dockerfile` from the repo root and mount a volume at `/data`.

## Scaling notes

- The JSON store (`server/src/store.ts`) rewrites one file on change. It is fine to a few thousand players; switch the class to SQLite or Postgres when the file passes a few megabytes.
- One small VM handles hundreds of simultaneous duels (each room ticks 30 times a second and sends 12 snapshots a second). Colyseus supports multiple processes behind a Redis presence when you outgrow it.
- Abuse: names are sanitised, builds are clamped, ranked ignores client builds, inputs are validated by the simulation. There is no account system; a determined cheater could inflate their campaign "best" via the API, which only affects the campaign leaderboard. Add Play Games sign-in later if that matters.

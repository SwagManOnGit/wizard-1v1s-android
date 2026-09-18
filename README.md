# Wizard 1v1s — Android edition

The full game version of Wizard 1v1s for Google Play: the draw-to-cast wizard duel (100 levels, 20 bosses, 4 arenas, 24 spells, gear, hats) plus everything a store release needs: ads, purchases, daily rewards, achievements, rankings, and online, ghost and practice duels.

The YouTube Playables version lives in the separate `wizard-1v1s` repository. Both share the same game code; this repo adds the platform layer, the multiplayer server and the launch tooling.

## Layout

| Folder | What |
|---|---|
| `app/` | The game (Vite + TypeScript + three.js) wrapped with Capacitor. `app/android` is the generated Android project. |
| `app/src/platform/` | Everything that touches the host: saves, lifecycle, back button, AdMob, Play Billing, haptics, notifications. `web.ts` for browsers, `android.ts` for the app. |
| `app/src/features/` | Daily rewards and challenge, achievements. |
| `app/src/duel/` | Duel sessions (bot, ghost, online) and the view that lets the arena render a PvP battle. |
| `shared/` | Code used by both app and server: spell and enemy data, the campaign battle, the PvP simulation, bots, ghost tapes, protocol. |
| `server/` | Colyseus duel server and HTTP API (rankings, ghosts). Docker and Fly.io files included. |
| `docs/` | `LAUNCH-CHECKLIST.md` (step by step to the Play Store), `STORE-LISTING.md`, `PROMOTION.md`, `SERVER.md`. |
| `.github/workflows/` | `android.yml` builds a debug APK on every push and a signed AAB once secrets exist; `pages.yml` publishes the web build and the privacy policy. |

## Develop

```bash
npm install
npm run dev        # game at http://localhost:5175 (browser build: fake ads and purchases)
npm run server     # duel server at http://localhost:2567
npm run typecheck
npm test -w server # headless duel + ghost determinism check
```

Environment variables at build time: `VITE_SERVER_URL`, `VITE_ADMOB_REWARDED`, `VITE_ADMOB_TESTING` (see `app/src/platform/config.ts`).

## Build the Android app

Without Android Studio: push to GitHub and download the APK artifact from the Actions run.

With Android Studio installed:

```bash
npm run android:sync   # builds the web assets and copies them into app/android
npm run android:open   # opens the project in Android Studio; Run installs on a connected phone
```

Icons and splash screens are generated from `app/resources/` with `npm run assets -w app` (source art comes from `node app/scripts/make-icon.mjs`).

## Release

Follow `docs/LAUNCH-CHECKLIST.md`. In short: create the Play Console and AdMob accounts, add the signing secrets and ids to GitHub, upload the AAB to internal testing, run the 14-day closed test with 12 testers, then go to production.

## Discovery, elements and loot

The core loop changed in the second design pass:

- **Spells are hidden until you draw them.** The codex lists 72 spells, but an undiscovered one is a silhouette with a tier, a kind and a cryptic hint ("Eleven points in a single line. Nobody draws this by accident."). Drawing its glyph in battle reveals it, shows a discovery card over the arena, adds it to your spellbook and casts it on the spot.
- **Ten elements.** Arcane is free; Fire, Frost, Storm, Nature, Shadow, Light, Earth and Chrono are bought with coins. Eclipse is never sold: it answers only a wizard attuned to all nine others, and its three spells are all Mythic.
- **Glyph tiers run from obvious to absurd.** Common spells are a line or a triangle. Mythic ones are a hendecagram, a five-against-four Lissajous knot, an eight-petal rose or an invented sigil, all in a single unbroken stroke. Those are meant to stay rumours for a long time after launch. The library is 73 templates, confusion-tested at 100%.
- **Equipment drops, it is not bought.** Hats, outfits, staffs and shoes fall from levels (bosses always drop) and from four kinds of chest. Every piece belongs to an element and has one of five rarities. Duplicates melt into coins.
- **Gear is the key to the spell list.** Wearing pieces of an element raises your affinity with it, and affinity is what makes deeper spells findable: one piece for Obscure, two for Forbidden, and a complete four-piece set for that element's Mythic. Threadbare starter gear does not count, so the set has to be earned.
- **Sets pay off twice**: a stat bonus at two, three and four pieces, and the deepest spells at four.
- Equipment is visible on the wizard: nine hat models and nine staff heads, one per element, plus robe and trim colours that follow what you wear.
- **Spellbook and codex.** "Known" is your collection, grouped by element, and where you build a loadout. "Codex" is every spell in the game with the unfound ones as silhouettes. A badge on the tab bar counts discoveries you have not looked at yet.

## Menu layout

A five-tab bar runs along the bottom in portrait and down the left edge in landscape:

| Tab | What |
|---|---|
| Shop | Attune elements, buy chests, buy character upgrades (coins) |
| Gear | Your equipment by slot, set progress and the set bonus |
| **Battle** | The home page: player bar, daily challenge, the 100-level map, and the Battle, Duel and Training buttons |
| Spells | Spellbook (known) and Codex (everything), with the NEW badge |
| Market | Rewarded ads and real-money purchases |

## Game design notes

- Campaign battles are unchanged from the Playables version: spells lock on, the enemy telegraphs lanes.
- Duels are symmetric: a spell chases the opponent's lane until halfway, then commits, so both players must dodge late. Duellists have 2.5x health so a match lasts long enough to turn around. Ranked uses a fixed fair build; casual uses your own gear.
- Ghost duels replay another player's recorded inputs against you; every practice or ghost duel you play uploads your own recording.

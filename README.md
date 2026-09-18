# Wizard 1v1s — Android edition

The full game version of Wizard 1v1s for Google Play: the draw-to-cast wizard duel (500 levels, 100 bosses, 4 arenas, 87 spells, gear, hats) plus everything a store release needs: ads, purchases, daily rewards, achievements, rankings, and online, ghost and practice duels.

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

## Engagement plan

`docs/ENGAGEMENT-PLAN.md` is the retention and engagement roadmap, written against 2026 benchmark
data: what to instrument, the first-session script, how to turn spell discovery into the growth
engine, and the reward systems worth building (plus the ones that would hurt this game).

## Release

Follow `docs/LAUNCH-CHECKLIST.md`. In short: create the Play Console and AdMob accounts, add the signing secrets and ids to GitHub, upload the AAB to internal testing, run the 14-day closed test with 12 testers, then go to production.

## Discovery, elements and loot

The core loop changed in the second design pass:

- **Spells are hidden until you draw them.** The codex lists 72 spells, but an undiscovered one is a silhouette with a tier, a kind and a cryptic hint ("Eleven points in a single line. Nobody draws this by accident."). Drawing its glyph in battle reveals it, shows a discovery card over the arena, adds it to your spellbook and casts it on the spot.
- **Fifteen spells are not in the codex at all.** The apocrypha are not listed, not counted and not hinted at: nothing in the game admits they exist until somebody draws one. Every one of them is a sign the codex *does* record, drawn the other way round, so the first player to wonder "what if I draw that backwards?" finds one. Two achievements are the only acknowledgement that they are there.
- **Direction is part of the glyph.** Every spell demands a stroke direction, drawn on its icon as a start dot and arrowheads along the path. A circle drawn clockwise and the same circle anticlockwise are two different spells, which doubles the design space for free. Draw a known glyph backwards and the game tells you so ("Spark runs the other way!") rather than failing silently.
- **Ten elements.** Arcane is free; Fire, Frost, Storm, Nature, Shadow, Light, Earth and Chrono are bought with coins. Eclipse is never sold: it answers only a wizard attuned to all nine others, and its three spells are all Mythic.
- **Glyph tiers run from obvious to absurd.** Common spells are a line or a triangle. Mythic ones are a hendecagram, a five-against-four Lissajous knot, an eight-petal rose or an invented sigil, all in a single unbroken stroke. Those are meant to stay rumours for a long time after launch. The library is 73 templates, or 146 once direction counts, confusion-tested at 100% in both directions at once.
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
| **Battle** | The home page: player bar with your wizard level, daily challenge, the level map, and the Battle, Duel and Training buttons |
| Spells | Spellbook (known) and Codex (everything), with the NEW badge |
| Market | Rewarded ads and real-money purchases |

## The campaign

Five hundred levels in ten chapters of fifty. The map shows one chapter at a time, unlocked as you climb; each is named after the wizards who live there. A boss waits every fifth level and a chapter lord every fiftieth, and the twenty named bosses come round again with worse titles: Grumbold the Gray, then Grumbold the Gray, Reborn, then Ascendant, then Eternal.

**Your campaign level is your account level.** The number on the player bar is simply the level you are facing, so clearing a level is a level-up and the result screen says so.

The curve is set from measured player damage rather than guessed: `server/src/campaigntest.ts` builds a plausible wizard for a given level, plays the fight out with a bot that dodges a set fraction of incoming shots, and reports whether it won. A sharp player (dodges 95%) wins every level up to 500; a sloppy one (80%) starts losing chapter lords around level 150. Boss self-healing is capped at 8% of health per 20 seconds, because a tenth every twelve seconds outgrew the player's damage past level 300 and turned deep bosses into stalemates.

## Game design notes

- Campaign battles are unchanged from the Playables version: spells lock on, the enemy telegraphs lanes.
- Duels are symmetric: a spell chases the opponent's lane until halfway, then commits, so both players must dodge late. Duellists have 2.5x health so a match lasts long enough to turn around. Ranked uses a fixed fair build; casual uses your own gear.
- Ghost duels replay another player's recorded inputs against you; every practice or ghost duel you play uploads your own recording.

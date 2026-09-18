# Wizard 1v1s — Android edition

Draw-to-cast wizard duels. npm workspaces: `shared/` (pure game logic), `app/` (Vite + three.js +
Capacitor), `server/` (Colyseus duel rooms, HTTP API, and the headless test harnesses).

## Commands

```bash
npm run dev          # Vite dev server on 5175 (preview_start "android-dev" also starts this)
npm test             # typecheck + every headless harness; run this before committing
npm run typecheck    # app + server
npm run build        # production web build
npm run android:sync # build, then copy into app/android
```

Individual harnesses live in `server/`: `npm run test:duel -w server` (bot duel + ghost replay
determinism), `test:glyphs` (glyph confusion), `test:campaign` (level curve), `test:progression`
(a report, not an assertion — read its numbers, it always exits 0).

## This machine has no Android toolchain

No JDK, no Android SDK, no adb. `npm run android:*` and anything under `app/android` cannot be
built or run locally — GitHub Actions produces the APK and AAB. Verify gameplay through the web
build in the browser pane instead, and say plainly that the Android shell itself is unverified.

## Invariants worth knowing before you change things

- **`shared/` must stay platform-free.** No DOM, no three.js, no Capacitor. The duel server imports
  it, so anything that touches a browser API breaks the server build.
- **Stroke direction is part of a glyph.** Recognisers are armed one direction per spell
  (`spellStroke`), and `Recognizer.add` defaults to a single direction. A shape drawn backwards is
  a different spell. If you add a glyph or reverse an existing one, run `test:glyphs` — it checks
  all 146 direction variants against each other and must stay at 100%.
- **Secret spells (`secret: true`) are invisible.** Not listed in the codex, not counted in any
  total, not hinted at. Anything that counts or displays spells must filter them through
  `codexSpells`/`elementSpells(el, known)` or `LISTED_SPELLS`, never `SPELLS.length`.
- **Ghost replays must be bit-exact.** The battle sim is deterministic from a seed; ghost tapes are
  input recordings. Never round input timestamps up (`Math.floor`, see `shared/src/ghost.ts`) and
  never introduce unseeded randomness into a path a replay walks.
- **Balance is measured, not guessed.** `server/src/campaigntest.ts` measures real player damage and
  plays fights out at two dodge accuracies. If you touch the level curve, player stats, spell
  damage or enemy behaviour, run it: a 95% dodger must win every sampled level.
- **Saves are parsed defensively** (`app/src/save.ts`) and migrate old versions. Adding a field means
  adding its default and its parse branch, or existing players lose progress.

## Style

Comments say *why*, not *what*, and only where the reason is not obvious from the code. Prose uses
British spelling (recogniser, colour); identifiers keep the `$1` recognizer's American spelling.
Match the density of the file you are editing — most of this codebase is uncommented.

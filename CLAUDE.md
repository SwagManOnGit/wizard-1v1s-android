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
determinism), `test:glyphs` (glyph confusion), `test:campaign` (level curve), `test:seal` (the
sealed apocrypha match their source), `test:progression` (a report, not an assertion — read its
numbers, it always exits 0).

`test:friend` is not in `npm test` because it needs a live server: start one with `npm run server`,
then `npm run test:friend -w server`. It checks two clients on one code meet each other and that a
coded room never fills with a bot.

**Restarting the duel server: free the port first and check the new process bound.** `curl
/api/health` answering proves *a* server is up, not yours — a stale process holding 2567 will serve
old code and make a working change look broken. This has cost time twice.

**The emulator reaches the duel server through `adb reverse`, and only in debug builds.**

```bash
adb reverse tcp:2567 tcp:2567
```

The reverse has to be set again after the emulator restarts. Two rules were stopping the call and
both are lifted for debug only, on purpose: `app/src/debug/res/xml/network_security_config.xml`
permits cleartext to the loopback names, because Android has blocked plain HTTP since API 28; and
MainActivity sets `MIXED_CONTENT_ALWAYS_ALLOW`, because the web layer is served from
https://localhost and an http://localhost:2567 call from it is mixed content. Release builds keep
both platform defaults and reach the server over https. If Rankings says it needs a connection on
the emulator, check the reverse first.

## The wizard model is code

`tools/wizard-model.py` builds the whole Wizard collection from primitives, exports
`app/src/assets/models/wizard.glb` and saves the blend. Edit the script, never the mesh:

```bash
"/c/Program Files/Blender Foundation/Blender 5.1/blender.exe" -b art/wizard-1v1s-models.blend --python tools/wizard-model.py
```

Add `-- --preview <dir>` to render front, three-quarter and back views instead of exporting, and
`-- --no-save` to leave the blend alone. `art/wizard-1v1s-models.blend` is the only source. Keep it closed in Blender while the
script runs: an open session holds its own copy in memory and would save back over the export.

Enemy variety is measured, not eyeballed: `npm run test:looks -w server` fails if neighbouring
levels share too many attributes or a look repeats within ten levels. Add `--dump <file> <levels>`
to that test and feed the file to `-- --lineup <file> <dir>` to render those wizards side by side.

**Wind every face outwards.** An inside-out solid renders perfectly in Blender, which draws back
faces, and then vanishes in the game, which culls them. `add_mesh` runs
`bmesh.ops.recalc_face_normals` on everything for this reason; the beard was invisible in the
app while looking right in every Blender render until it did.

**The names are a contract with `app/src/scene.ts`:** materials `Robe`, `Cape`, `Hat`, `Trim`,
`Skin`, `Beard`, `Boots` are recoloured per player; one empty per hat style named
`Hat_<Style>` and per staff head named `Staff_<Style>`, of which the game shows exactly one;
`ArmPivot` is the arm the game raises to cast, and `OrbAnchor` under it is where the glow and
every projectile start. Rename any of these and the model still loads, silently wrong.

## Building the Android app locally

The toolchain is installed but not on PATH, so export these first. JAVA_HOME must point at 21:
Android Studio bundles JDK 25 and Gradle 8.11 refuses it, and CI builds with Temurin 21 anyway.

```bash
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot"
export ANDROID_HOME="/c/Users/louis/AppData/Local/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
npm run android:sync                                       # web build, then copy into app/android
cd app/android && ./gradlew.bat assembleDebug --no-daemon   # ~2m30s cold
```

The APK lands in `app/android/app/build/outputs/apk/debug/`. There is no emulator image, and
usually no phone attached: check `adb devices` before assuming the app can actually be run. A
build proving it compiles is not the same as proving it works on a device — say which one you did.

## Invariants worth knowing before you change things

- **`shared/` must stay platform-free.** No DOM, no three.js, no Capacitor. The duel server imports
  it, so anything that touches a browser API breaks the server build.
- **Stroke direction is part of a glyph.** Recognisers are armed one direction per spell
  (`spellStroke`), and `Recognizer.add` defaults to a single direction. A shape drawn backwards is
  a different spell. If you add a glyph or reverse an existing one, run `test:glyphs` — it checks
  all 146 direction variants against each other and must stay at 100%.
- **The apocrypha are sealed.** Edit them in `shared/src/secrets.source.ts`, then run `npm run seal`
  and commit both that file and the generated `shared/src/secrets.data.ts`. `npm test` fails if the
  two disagree. The point is that the shipped bundle never spells out which sign an unlisted spell
  wants; `shared/src/secrets.ts` explains exactly how much that is worth, which is less than it
  sounds.
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

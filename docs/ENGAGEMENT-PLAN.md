# Making Wizard 1v1s stick

An improvement plan for retention and engagement, written against 2026 benchmark data and the
design literature. Sources are listed at the end; every number in section 1 is cited.

The short version: the game has a genuinely unusual core mechanic and a discovery system that no
competitor has, and it is currently missing the three things that decide whether anyone ever sees
them — a first session that teaches the hand, any measurement at all, and a named reason to come
back tomorrow. Fix those three before building anything else on this list.

---

## 1. The bar

What "good" looks like in 2026, from GameAnalytics' benchmark set (16,262 mobile games) and
AppAgent/Segwise aggregates:

| | Median | Top 25% | Top 1% |
|---|---|---|---|
| D1 retention | 18–22% | ~30% | 64–68% |
| D7 retention | ~4% | 6–7% | >25% |
| D30 retention | 0.7–0.8% | 1.6–1.8% | 13–15% |
| Session length | 3.1–3.5 min | ~5.2 min | ~22 min |
| Sessions/day | 3.8 | 5.3–5.7 | ~14 |
| Playtime/day | — | 22–24 min | 94+ min |

Midcore titles specifically run 10–15 minute sessions and 6–7 sessions a day. By genre, RPG sits at
roughly 30.5% / 9.9% / 3.5% for D1/D7/D30; strategy is lower at 25.4% / 8.1% / 3.1%.

**Targets for launch.** D1 30%, D7 10%, D30 3%, with a 6-minute session played 3–4 times a day.
That is top-quartile but not fantasy. Two findings set the agenda for how to get there: good
onboarding lifts retention by up to 50%, and roughly 60% of players abandon a game whose difficulty
escalates too quickly.

---

## 2. Diagnosis

**What is already strong.** The core loop is novel in a market of clones — dodge, draw, cast is not
a reskin of anything. The discovery system (87 spells, 15 unlisted, gated behind elemental gear) is
a real competitive moat and the best marketing asset the game has. There are 500 levels, three duel
modes, a working economy and coherent art. The foundations are not the problem.

**Three structural gaps, in order of severity.**

1. **There is no tutorial.** Not a thin one — none. A search of `app/src` for onboarding of any kind
   returns nothing. A new player is dropped on a hub with five tabs and 500 levels, and the one
   mechanic nobody has ever seen before (draw a remembered shape, in the correct direction, large
   enough) is explained by the words "DRAW A GLYPH" on a dark square. The literature is unanimous
   that this is where D1 is won or lost, and this game needs it more than most because its verb is
   unfamiliar.

2. **There is no analytics.** No event logging, no funnel, nothing. Every tuning decision after
   launch would be guesswork, and the single most valuable thing about a soft launch — finding the
   step where players drop — would be unavailable. This is cheap to fix and blocks everything else.

3. **Nothing tells the player why to come back.** A daily reward and a daily challenge exist, but
   they are discovered rather than promised. The player never sees a sentence that means "something
   is waiting for you tomorrow". Meta-layer thinness is the standard cause of D7 and D30 collapse:
   people leave because nothing was waiting, not because the game was bad.

---

## 3. Priority zero — instrument before tuning

Half a day of work; everything after this depends on it.

Log these to the existing server (`server/src/index.ts` already has an express API and a JSON
store, so a `POST /api/event` endpoint is enough to start; swap for Firebase/GameAnalytics later):

- `session_start`, `session_end` with duration
- `ftue_step` with an index, for every step of the first session
- `battle_start` / `battle_end` with level, outcome, duration, hp remaining
- `cast_attempt` with spell id, recognised/failed, score, coverage, wrong-direction flag
- `spell_discovered` with spell id and the level it happened on
- `shop_view`, `purchase_attempt`, `purchase_complete`, `ad_watched`
- `churn_point`: last level played before a 7-day absence

The `cast_attempt` event is the important one and is specific to this game: it tells you which
glyphs players cannot draw. If Blizzard's four-fold zigzag fails 40% of the time in the wild, that
is a content bug you will never otherwise find. The recogniser already computes the score and the
coverage — it costs nothing to record them.

**The one funnel that matters at launch:** install → first battle started → first spell cast → first
level cleared → second session. Publish that funnel weekly and fix the worst step.

---

## 4. Priority one — the first ninety seconds

Replace the current cold open with a scripted first battle. Do not build a separate tutorial mode;
weave it into the real game, which is what the FTUE literature consistently recommends.

The script:

1. **Skip the menu entirely on first launch.** App opens directly into a battle against a stationary
   Apprentice on level 1. No hub, no tabs, no daily reward.
2. **One spell in the loadout: Spark.** The pad shows its glyph, large, with the direction arrows,
   pulsing. Text: *"Trace it."* Nothing else on screen is tappable.
3. **The player draws it. It fires.** Slow-motion on impact, big damage number, screen shake. This is
   the moment that has to feel good — everything else is decoration.
4. **The enemy telegraphs a lane.** The dodge button on the safe side pulses. Text: *"Move."* Time
   dilates to ~40% until they tap, so it cannot be failed.
5. **Two more exchanges**, then the kill. Victory, coins, and a gear drop that is guaranteed on the
   first clear.
6. **Then, and only then, the hub** — which now has one glowing thing on it: level 2.

Add the remaining spells one per level for the first five levels, each introduced the same way, so
the loadout grows with the player's hand. Arcane Orb at 2, Ward at 3, Mend at 4.

**Then hand them the hook.** At the end of level 3, a full-screen card: *"There are 72 spells in the
codex. You know four. Some are not in the codex at all."* This is the game's whole pitch and it
should be delivered in the first three minutes, not discovered by chance.

**Target:** 80% of installs should reach "first level cleared". Measure it from day one.

---

## 5. Priority two — teach the hand

The recognition mechanic is the game and it is the churn risk. Three changes, all cheap:

- **Fading training wheels, per spell.** The first three times a spell is cast, draw its glyph
  faintly on the pad as a guide. Fade the guide out over the next five casts, then remove it. Track
  the count per spell id in the save. New spells at level 200 get the same courtesy as Spark did,
  which matters because a Mythic glyph is genuinely hard.
- **A hold-to-peek button on the pad.** Holding it shows the glyph of the last-tapped spell chip
  while the enemy keeps casting. It costs tempo, not currency. This removes the memory barrier
  without removing the skill.
- **Loosen the first ten levels.** `requiredCoverage` and the per-spell clarity threshold should
  scale in over the first ten levels rather than applying at full strength to a player who has held
  the game for ninety seconds. Given that 60% of players quit over difficulty, the opening should be
  forgiving to the point of feeling generous.

The wrong-direction message added recently (*"Spark runs the other way!"*) is exactly the right
pattern — a near miss that explains itself. Apply the same idea to size: *"Bigger"* is already
there; make it show the required size as a ghost outline.

---

## 6. Priority three — shape the session

**Target shape:** 6 minutes, 3–4 times a day. Currently a level takes 20–60 seconds and nothing
tells the player when to stop or when to return.

- **Daily quests — three, rotating, visible on the hub.** "Clear 3 levels", "Cast 15 spells", "Win a
  duel", "Discover a spell", "Open a chest". Completing all three pays a chest. This is the single
  highest-leverage retention feature on this list after the FTUE, and it is a day of work.
- **A "next goal" strip under the player bar.** One line, always: *"2 more levels to the Hedge
  Wizards"*, *"1,200 coins from attuning Fire"*, *"Wear one more Fire piece to open Ember Coil"*.
  Never let the player look at the hub without a stated next action.
- **Name tomorrow.** The result screen after the last quest of the day should say what is waiting:
  *"Tomorrow: day 3 of your streak, and a new rumour."*

**Do not add an energy system.** Clash Royale's chest-slot pacing works because its battles are free
and only the *rewards* are gated. Gating battles in a skill game whose appeal is practice would
damage the thing people came for. The daily challenge and quests provide the same "come back
tomorrow" pressure without taking the game away.

---

## 7. Priority four — make discovery the growth engine

This is the section I would spend the most time on, because it is the only part of the game that
competitors cannot copy in a month, and because it converts players into marketers.

The precedent is *Animal Well* and *Tunic*: games designed in layers, where layer three exists to be
cracked by a community rather than an individual. Its designer, Billy Basso, was explicit that
difficulty is *"an opportunity for [players] to bond with each other"*. Animal Well shipped a puzzle
that structurally cannot be solved alone — 50 players each hold one tile of one image. That design
bought more discussion, video coverage and word of mouth than any ad campaign.

Wizard 1v1s already has the raw material: 15 spells that nothing in the game admits exist. What it
lacks is any way for a discovery to be *seen*. Fix that:

- **Global discovery rarity.** The server counts how many players have found each spell. The codex
  then shows *"0.4% of wizards know this"* under each found spell. This costs one endpoint and one
  counter, and it converts a private moment into a status symbol.
- **First-finder credit.** The first 100 players to find each unlisted spell get a permanent title on
  their profile and the leaderboard. At launch this is a race; afterwards it is folklore. Record the
  finder's name server-side and show it: *"First found by Shade822."*
- **A share card.** After a discovery, one button produces an image: the spell name, its element, its
  tier, the rarity percentage, and the glyph deliberately obscured. It is designed to make the
  viewer ask what the shape is. This is the cheapest user acquisition this game will ever get.
- **The weekly rumour.** Every Monday, one cryptic line is pushed to every player, pointing at one
  undiscovered spell: *"They say the sun can be unwound."* (That is Black Sun — the reversed
  sunburst.) It gives the community something to chew on for a week and gives you a live-ops beat
  that costs one sentence to author.
- **Hold back a few spells entirely.** Ship with two or three glyphs that are not in the build's
  data at all, and add them in an update months later with no patch note. Datamining is the enemy of
  this kind of secret; content that does not exist yet cannot be mined.

**Guard the secrets in the build you do ship.** *(Done — the apocrypha are sealed.)* The spell table
used to be plain TypeScript in the web bundle: searching it for "Black Sun" returned the name, the
description and `glyph: 'sunburst', reverse: true`, which is the whole secret. The shapes were never
the secret, since every unlisted spell is a reversal of a sign a listed spell already uses — the
*mapping* was. The unlisted definitions now ship as an opaque blob (`shared/src/secrets.data.ts`,
regenerated by `npm run seal`).

Be clear about what that buys: the key is in the bundle, because the game must recognise these
spells offline, and anyone who opens a debugger can read the decoded table out of memory. It raises
the cost from Ctrl+F to understanding the build and writing a script. The only real protection
remains content that is not in the build at all, so still hold two or three spells back for a later
update.

---

## 8. Priority five — reward systems

**Make the drop the moment.** A first-clear drop currently appears as a row on the result card. It
should be an opening chest with a rarity-coloured burst, a held beat before the reveal, and a bigger
one for Epic and Mythic. The variable-ratio reward is already in the design; it is the *presentation*
that converts it into a feeling.

**A 30-day season.** Free track and a premium track at £4.99. Around 50 tiers, paced so a daily
player finishes with a week to spare. Keep the premium rewards visible but locked — that visibility
is what converts. Reward with chests, coins, an exclusive hat style per season and, at the top, one
cosmetic recolour that cannot be earned any other way. Battle passes have become the primary
monetisation mechanic in live-service games precisely because they pay for engagement rather than
power, which suits this game: selling power would poison the ranked ladder.

**Arenas for ranked duels.** Elo already exists but is invisible. Name the bands — Apprentice,
Adept, Magister, Archmage — show the ladder, and reset softly each season. A visible tier is a
better retention object than a number.

**Streaks with insurance.** The 7-day login streak should survive one missed day per month
automatically. Punishing a missed day mostly teaches people that the streak is already broken, so
they stop.

**Offline progress, carefully.** A small "the tower fought on without you" coin trickle capped at
8 hours gives a reason to open the app, without letting anyone progress by not playing.

---

## 9. UI changes

The hub currently shows: player bar, daily challenge, chapter strip, 50 level tiles, level info,
BATTLE, DUEL, Training, Ranks, Awards, and five nav tabs. That is a lot of competing calls to
action. Clash Royale, the stated reference, has exactly one dominant button.

- **Demote Ranks and Awards** into a profile panel behind the player bar. They are not session goals.
- **Make BATTLE unmistakably dominant** — larger, animated, and the only gold element in the lower
  half of the screen.
- **Put the daily quests where the daily challenge is**, and move the challenge into the quest list
  as one of the three.
- **Collapse the level map by default** to a strip of five tiles around the current level, with a
  "map" button that opens the full chapter view. Most sessions the player wants the next level, not
  a map.
- **Make the codex a showcase.** Grid of emblems, found ones bright, unfound ones as silhouettes,
  with the collection percentage large at the top. It should look like something worth completing.

**Juice, in priority order:** damage numbers that scale with the hit, a freeze frame on a kill, a
screen flash on discovery (exists), a rarity-coloured burst on a drop, and a satisfying
end-of-glyph confirmation — a brief trail on the pad that snaps into the recognised shape. That last
one directly reinforces the mechanic being taught.

---

## 10. Social

Nothing on this list matters as much as the first four sections, but two are cheap:

- **Friend duels by code.** A six-character room code, no account system. The Colyseus server
  already exists; this is a room-join argument.
- **Ghost duels are already built and under-sold.** Surface them as "Beat Shade822's run" with the
  opponent's name and level, rather than a generic mode button.

Clans and chat are a later problem, and a moderation burden for a solo developer. The discovery
community in section 7 is a better use of the same effort — it happens on Discord and Reddit, which
someone else moderates.

---

## 11. Monetisation, and one compliance problem

The current catalogue is coins, coins, Double coins, Supporter pass, Founder's hoard. It sells
progress in a game whose progression is the content, which is backwards. Reorder around:

1. **Season pass** (£4.99/month) — the main earner, sells engagement not power.
2. **Cosmetics** — hat and staff styles, robe colours. Nine hat models already exist.
3. **Double coins** — keep, it converts well and does not affect duels.
4. **Coin packs** — keep, but stop promoting them; they compete with the season pass.

Whales are typically 1–2% of players and 50–70% of revenue, so track payer retention separately from
overall retention. But for a first title with no audience, revenue is downstream of retention, and
every hour spent on monetisation before D7 is above 10% is an hour spent wrong.

**The compliance problem.** The Founder's hoard sells seven Gold Chests for real money. Gold Chests
contain randomised items. Google Play requires the odds of receiving randomised virtual items to be
**disclosed before purchase**, and a build without that disclosure will not pass review. The real
odds, computed from `rarityWeights` (`server/src/oddstest.ts` prints this table):

| Chest | Worn | Fine | Rare | Epic | Mythic |
|---|---|---|---|---|---|
| Wooden | 57.2% | 31.7% | 11.0% | — | — |
| Silver | — | 62.7% | 27.9% | 9.4% | — |
| Gold | — | — | 65.9% | 25.4% | 8.6% |
| Elemental | — | — | 65.6% | 25.7% | 8.7% |

Each chest rolls its slots independently (Wooden 1, Silver 2, Gold 3, Elemental 3). Put this table
on the chest cards in the shop and on the Founder's hoard card before submitting to review.

---

## 12. What I would not build

The request was for the game to be as addictive as possible. The honest answer is that the reliable
route is the one above — a mechanic people want to get good at, secrets they want to crack, and a
clear reason to return — and that several standard "addiction" tools would make *this* game worse,
not just more cynical:

- **Energy or lives.** Takes away practice in a game about skill. Directly attacks the reason people
  would stay.
- **Countdown timers on offers.** Manufactured urgency is the most-cited dark pattern in the
  research literature, it reads as cheap, and it trains players to distrust the shop.
- **Pay-to-win in ranked.** Ranked already uses a fixed fair build. Keep it that way; it is the
  reason the ladder can be taken seriously.
- **Loss-aversion streak punishment.** See streak insurance above.
- **Notification spam.** One a day, tied to something real. Frequency should match how often the
  player actually plays; cap it before scaling.

The dark-patterns research is blunt that these mechanics frustrate the same needs — autonomy,
competence, relatedness — that make a game worth playing in the first place. A game people respect
is also a game they tell other people about, and this game's growth model depends on being talked
about.

---

## 13. Sequence

**Phase 1 — before launch (2–3 weeks).**
Analytics and the launch funnel. The scripted FTUE. Fading training wheels and the peek button.
Eased first ten levels. Daily quests. The next-goal strip. Chest odds disclosure.

**Phase 2 — launch month.**
Global discovery rarity and first-finder credit. Share cards. The weekly rumour. Result-screen drop
reveal. Arena names for ranked. Streak insurance.

**Phase 3 — month two onward.** *(Built, except the content drop.)*
Season pass with titles as the cosmetic, friend duels by code, and the offline trickle are in. Hub
simplification happened early, forced by the device: the map is collapsed by default and the rumour
moved to the spellbook.

The one part that cannot be built in advance is the content drop: its whole value is that the
spells are **not in the shipped build**, so nothing about them can be mined. Write them into
`shared/src/secrets.source.ts`, run `npm run seal`, and release that as an update some months after
launch, with no patch note. Two or three is enough.

**The one measurement that decides everything:** the install → first-clear → second-session funnel.
If D1 is below 25% after the FTUE ships, stop building features and fix the first ninety seconds.

---

## Sources

- [GameAnalytics — 2026 Mobile & PC Gaming Benchmarks](https://www.gameanalytics.com/reports/2026-mobile-pc-gaming-benchmarks) ([summary](https://gamedevreports.substack.com/p/gameanalytics-mobile-and-pc-game))
- [Segwise — Mobile Game Retention Benchmarks 2026](https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies)
- [Heroic Labs — What Is Meta Game Design?](https://heroiclabs.com/blog/metagame-design-guide/index.html)
- [Mobile Free To Play — Crafting A Strong Core Loop](https://mobilefreetoplay.com/bible/crafting-strong-core-loop/)
- [Mobile Free To Play — Improving Your Game's Retention](https://mobilefreetoplay.com/bible/improving-games-retention/)
- [Deconstructor of Fun — Clash Royale](https://www.deconstructoroffun.com/blog//2016/02/clash-royale-next-billion-dollar-game.html)
- [GameAnalytics — Designing battle passes in mobile games](https://www.gameanalytics.com/blog/designing-battle-passes-in-mobile-games-the-whats-whys-and-hows)
- [Udonis — First-Time User Experience in Mobile Games](https://www.blog.udonis.co/mobile-marketing/mobile-games/first-time-user-experience)
- [Game Developer — Best practices for a successful FTUE](https://www.gamedeveloper.com/design/best-practices-for-a-successful-ftue-first-time-user-experience-)
- [Sensor Tower — Live Ops strategies of top-grossing mobile games](https://sensortower.com/blog/top-grossing-mobile-games-live-ops-strategies-2025-report)
- [Game File — Animal Well's plan to hide parts of the game from data miners](https://www.gamefile.news/p/indie-developer-has-a-plan-to-keep)
- [Push Square — Animal Well's puzzle that requires 50 players](https://www.pushsquare.com/news/2024/05/single-player-animal-well-has-a-secret-puzzle-that-requires-50-players-to-solve)
- [GMTK — The Secret to Designing Mysterious Games](https://gmtk.substack.com/p/the-secret-to-designing-mysterious)
- [ACM CHI — A Game of Dark Patterns: Designing Healthy, Highly-Engaging Mobile Games](https://dl.acm.org/doi/fullHtml/10.1145/3491101.3519837)
- [Fenwick — Google Play Now Requires Disclosure of Loot Box Odds](https://www.fenwick.com/insights/publications/google-play-now-requires-disclosure-of-loot-box-odds)
- [Kwalee — Mastering Push Notification Strategy](https://www.kwalee.com/blog/master-push-notification-strategy)

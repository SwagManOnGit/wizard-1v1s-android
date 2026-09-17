# Getting players and keeping them

The drawing mechanic is the whole pitch. Every asset you make should show a finger drawing a glyph and the spell landing.

## Before launch (during closed testing)

1. **Web demo**: the Pages workflow publishes the game at `https://<user>.github.io/wizard-1v1s-android/`. Post it on itch.io and Newgrounds as "Wizard 1v1s (browser demo)" with a "coming to Android" line. Feedback and ratings there cost nothing.
2. **Play Store pre-registration**: enable it in Play Console once the listing is complete. Pre-registered users get the app auto-installed on launch day, which fuels the first-week ranking.
3. **Discord**: create a server with #announcements, #duels (find opponents), #feedback, #ghosts. Put the invite in the app's About card (`docs` link) and on every post.
4. **Press kit** in a public folder: icon, feature graphic, 6 screenshots, 3 GIFs, a 40-word and a 150-word description, your contact. Send it to Android gaming sites (Android Police, Droid Gamers, Pocket Gamer, TouchArcade) a week before launch with the pre-registration link.
5. **Closed testers doubling as your first community**: recruit the 12+ testers from r/AndroidGaming's testing threads, r/TestMyApp, and Discord servers for indie games. Ask each for one sentence of feedback.

## Content that spreads

- **Vertical clips, 8 to 15 seconds**: finger draws a star, meteor drops, boss dies. Post daily to YouTube Shorts, TikTok and Instagram Reels for the first 30 days. Captions like "you have to DRAW your spells" do the work.
- **Glyph challenges**: "can you draw a perfect Void Rift?" with the pad on screen. Viewers try in their head; that is engagement.
- **Boss showcases**: one clip per boss, 20 bosses, 20 posts.
- **Duel clips**: two phones side by side.
- Make the clips with a screen recorder on the phone (Android's built-in recorder is enough); no editing beyond a caption.

## Communities (post as the developer, answer every reply)

- Reddit: r/AndroidGaming (Saturday self-promo rules), r/IndieGaming, r/playmygame, r/incremental_games is not a fit, r/gamedev for postmortems only.
- Discord: indie game showcase servers, the Godot/Phaser/three.js communities (the tech story is interesting to developers).
- TouchArcade forums "Upcoming games" thread, then a release thread.
- YouTube Playables: if the Playable version is accepted, its players will search for the app by name. Keep the name and icon identical.

## Store page optimisation

- Keywords belong in the title and the first two lines of the description: "draw", "spell", "duel", "wizard".
- Screenshots with big captions convert better than raw gameplay. Put the drawing shot first.
- Reply to reviews; a reply raises the chance that a 3-star reviewer edits to 4.
- Localise the listing (not the game) into Spanish, Portuguese, German, French, Indonesian with a translator or an LLM; the store shows it automatically and it is nearly free reach.

## Keeping players (already built into the app)

- Daily login streak, daily challenge for triple coins, achievements with coin rewards, a rating ladder, ghosts of other players, cosmetic hats to chase.
- A reminder notification once a day when the reward is ready (only if the player left reminders on).
- Review prompt after the third boss.

Watch these numbers in Play Console after launch:

| Metric | Healthy for a casual action game | If lower |
|---|---|---|
| Day 1 retention | 35% | onboarding: first two levels too hard, or players do not understand drawing; add a tutorial popup |
| Day 7 retention | 15% | not enough goals: surface the daily challenge and duels on the title screen |
| Day 30 retention | 6% | add seasons, new hats, weekly events |
| Crash-free users | 99.5% | read Android vitals, fix, ship |

## Paid acquisition (only once D1 is above 30%)

- Google Ads "App campaign", 5 to 10 USD a day, let it optimise for installs for two weeks, then switch to in-app actions (first boss win).
- Compare cost per install with what a player earns you: rewarded ads pay roughly 0.01 to 0.03 USD per view; a player who watches 10 ads over a month is worth 0.10 to 0.30 USD, plus purchases. Keep the cost per install below that or stop.

## Seasonal cadence after launch

- Every 2 to 3 weeks: a small update with a visible change (new hat, boss tweak, a new challenge modifier).
- Monthly: a ranked season reset with a title screen banner and a hat for the top 100.
- Halloween, winter and spring: themed hats and a recoloured arena; cheap to make in Blender and they give you a reason to post.

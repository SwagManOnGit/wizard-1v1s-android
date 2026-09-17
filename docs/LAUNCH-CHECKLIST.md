# Wizard 1v1s — Google Play launch checklist

Work top to bottom. Each step says where it happens (this repo, a website, or your phone) and what it costs.
Items marked **DONE** are already handled by the code in this repository.

## 0. What is already built

- **DONE** Android project (`app/android`) generated with Capacitor; the game runs in a WebView with the platform layer in `app/src/platform`.
- **DONE** Saves via Capacitor Preferences, pause/resume, hardware back button, haptics, local reminder notifications.
- **DONE** AdMob rewarded ads with the Google UMP consent form (test ad unit until you swap the id).
- **DONE** Google Play Billing through `cordova-plugin-purchase` (five products, see step 6).
- **DONE** Daily login rewards (7-day streak), daily challenge, 19 achievements, leaderboards, settings, hats, review prompt.
- **DONE** Multiplayer: practice bot, ghost duels, casual and ranked online duels, plus the server in `server/`.
- **DONE** CI: every push to `main` builds a debug APK (downloadable from the Actions tab) and, once signing secrets exist, a release AAB.
- **DONE** Store assets: `app/resources/icon.png` (1024), `feature.png` (1024x500), splash screens. Regenerate with `node app/scripts/make-icon.mjs` and `npm run assets -w app`.

## 1. Accounts (day 1, about 1 hour)

| Account | Where | Cost | Notes |
|---|---|---|---|
| Google Play Console | play.google.com/console | 25 USD once | Needs a Google account, government ID and a phone number for verification. Register as an individual unless you have a company with a D-U-N-S number. |
| AdMob | admob.google.com | free | Same Google account. Create an app "Wizard 1v1s" (Android) and one **Rewarded** ad unit. |
| GitHub | github.com | free | Repo `wizard-1v1s-android`; Actions builds the APK and AAB. |
| Fly.io (server) | fly.io | ~5 USD/month | Only needed for online duels, ghosts and leaderboards. See `docs/SERVER.md`. |
| Apple Developer (later) | developer.apple.com | 99 USD/year | Not needed for Android. The same Capacitor project can target iOS later. |

Important Play Console rule for new personal accounts: before you can publish to production you must run a **closed test with at least 12 testers opted in for 14 consecutive days**, then apply for production access. Start the closed test as early as possible.

## 2. First install on your own phone (day 1)

1. Push this repo to GitHub. The `Android build` workflow runs automatically.
2. Open the workflow run, download the `wizard-1v1s-debug-apk` artifact, copy `app-debug.apk` to your phone.
3. On the phone allow "install unknown apps" for your file manager, install, play.
4. Optional local builds: install Android Studio, then `npm run android:open` opens the project; Run installs it on a connected phone with USB debugging.

## 3. Wire the real ids (day 1 to 2)

In the GitHub repo go to Settings, Secrets and variables, Actions, and add **variables**:

| Variable | Value |
|---|---|
| `SERVER_URL` | `https://<your-fly-app>.fly.dev` once the server is deployed |
| `ADMOB_REWARDED` | the rewarded ad unit id from AdMob, e.g. `ca-app-pub-1234567890123456/1234567890` |
| `ADMOB_TESTING` | `true` while testing, `false` for the production build |

Also edit `app/android/app/src/main/AndroidManifest.xml` and replace the AdMob **application id** (the one with a `~`) with yours from AdMob, App settings.
Keep `ADMOB_TESTING=true` on every device you own: clicking live ads on your own phone can get the AdMob account suspended.

## 4. Signing key (once, 10 minutes)

The release bundle must be signed with a key you keep forever. On any machine with Java installed:

```bash
keytool -genkeypair -v -keystore wizard-release.keystore -alias wizard -keyalg RSA -keysize 2048 -validity 10000
```

Back the file up somewhere safe (a password manager attachment is fine). Then add these GitHub **secrets**:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | output of `base64 -w0 wizard-release.keystore` (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("wizard-release.keystore"))`) |
| `KEYSTORE_PASSWORD` | the keystore password |
| `KEY_ALIAS` | `wizard` |
| `KEY_PASSWORD` | the key password |

The next push produces `wizard-1v1s-release-aab`. Play uses **Play App Signing**: on first upload it takes your key as the upload key and signs the final APKs itself.

## 5. Create the app in Play Console (1 to 2 hours)

1. Create app: name "Wizard 1v1s", default language, Game, Free.
2. **Store listing**: copy from `docs/STORE-LISTING.md`. Upload the 512x512 icon (`app/resources/icon.png` downscaled), the 1024x500 feature graphic, and at least 4 phone screenshots (take them on your phone; portrait, 1080x1920 is ideal).
3. **App content** section, in order:
   - Privacy policy URL: `https://<your-github-user>.github.io/wizard-1v1s-android/privacy.html` (deployed by the Pages workflow; set Pages source to GitHub Actions once).
   - Ads: **Yes, contains ads**.
   - App access: all features available without login.
   - Content rating: fill the IARC questionnaire (fantasy violence, no blood) → expect Everyone 10+ / PEGI 7.
   - Target audience: 13 and over. Do not tick under-13, or the Families policy applies.
   - Data safety: the app collects **Device or other IDs** (AdMob advertising id, and a random player id sent to the duel server), shared with Google (AdMob). Data is not encrypted at rest on the server; users can request deletion by email. Mark "Data collected: Device or other IDs; Purpose: Advertising, App functionality".
   - Government apps, financial features, health: No.
4. **Monetisation setup**: link the AdMob app; create the in-app products from step 6.

## 6. In-app products (30 minutes)

In Play Console, Monetise, Products, create these with exactly these ids (they are in `app/src/platform/config.ts`):

| Product id | Type | Suggested price |
|---|---|---|
| `wizard_coins_small` | Consumable (in-app product) | 1.99 |
| `wizard_coins_large` | Consumable | 7.99 |
| `wizard_double_coins` | One-time (non-consumable) | 3.99 |
| `wizard_no_ads` | One-time | 2.99 |
| `wizard_hat_pack` | One-time | 2.99 |

Products only work in builds that are uploaded to Play (internal testing is enough) and on accounts added as **licence testers** (Play Console, Settings, Licence testing). Licence testers are not charged.

## 7. Testing tracks (2 to 3 weeks of calendar time)

1. **Internal testing**: upload the AAB, add your own email as a tester, install from the opt-in link. Verify ads (test ads), a purchase with a licence tester account, notifications, the back button, online duels.
2. **Closed testing**: create an "Alpha" track, upload the same AAB, add at least 12 testers (friends, Discord, r/AndroidGaming test-request threads). They must opt in and keep the app installed; the 14-day clock runs while 12+ are opted in.
3. Fix what they report; every push builds a new AAB. Bump `versionCode` in `app/android/app/build.gradle` for each upload.
4. After 14 days, Play Console shows "Apply for production access": answer the short questionnaire honestly.
5. **Pre-launch report** (automatic on each upload) shows crashes and screenshots from Google's test devices. Check it.

## 8. Production release

1. Set `ADMOB_TESTING=false`, push, download the release AAB.
2. Create the production release, add release notes, roll out to 100% (or 20% staged if nervous).
3. First review usually takes 1 to 7 days. Later updates are faster.
4. After approval, the listing URL is `https://play.google.com/store/apps/details?id=com.swaggames.wizard1v1s` (already in `config.ts` for the share button and review prompt).

## 9. Server for online play (any time before launch)

Follow `docs/SERVER.md`. Until it is deployed the app still works fully offline: practice duels, campaign, shop. Ghosts, rankings and online duels show "server unreachable".

## 10. Launch week

Follow `docs/PROMOTION.md`. Have the Discord invite, press kit and three video clips ready before you press publish.

## 11. After launch, each week

- Read Play Console: crashes (Android vitals), ratings, retention (D1/D7/D30 under Statistics).
- Reply to every review in the first month.
- Ship a small update every 2 to 3 weeks (a new hat, a boss tweak, a seasonal challenge) so the "Updated" date stays fresh.
- Keep the target API level current each August (Google raises the requirement yearly): update Capacitor (`npm i @capacitor/android@latest`) and rebuild.

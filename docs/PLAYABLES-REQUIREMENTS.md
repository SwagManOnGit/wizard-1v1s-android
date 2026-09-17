# YouTube Playables – research notes (2026-09-16)

Official docs: https://developers.google.com/youtube/gaming/playables

## Access / submission flow
1. Fill in the Playables interest form (Google Form, linked from the docs "Contact" page). Early access, invite-only.
   Third-party guides say page 2 asks for a publicly hosted HTTPS game URL as a demo.
2. If accepted, your channel is onboarded and you get the Playables Developer Portal.
3. In the portal: "Add a new game" -> metadata (title, genre, description, publisher) -> upload bundle as ZIP -> thumbnails -> ad settings.
4. "Create release" -> Dev Link + Test Suite link (desktop web, mobile web, Android, iOS) -> "Submit for Certification".
The public URL is only the demo for the interest form; the real delivery is the ZIP upload.

## Engines
Anything that exports to HTML5 using Canvas/WebGL. Listed by Google as previously used:
BabylonJS, Cocos, Construct, Defold, melonJS, Phaser, PixiJS, PlayCanvas, React, three.js, Godot, Unity.
Official samples: plain JavaScript, Flutter web, Godot, Unity (C# wrapper + .jslib + WebGL template).
Unity: build for WebGL WITHOUT gzip/brotli compression; lazy-load via Addressables if big.

## Hard limits (stability/performance page)
| Item | MUST | SHOULD |
|---|---|---|
| Initial bundle | < 30 MiB | < 15 MiB |
| Total bundle | < 250 MiB | |
| Single file | < 30 MiB | < 512 KiB |
| Total files | <= 8,000 | |
| JS heap peak | <= 512 MB | |
| Saved data | < 3 MB | < 500 KB |
| Time to interactive | | < 5 s |
- No external network calls at all (no analytics, no CDNs, no fonts) – everything in the bundle.
- Relative paths only; filenames: alphanumeric plus `_ - .`
- Must work in YouTube app (Android/iOS) and all YouTube-supported browsers.

## SDK integration (must)
- `index.html` at bundle root; first script: `<script src="https://www.youtube.com/game_api/v1"></script>` (no-op when served elsewhere).
- `ytgame.game.firstFrameReady()` when the splash/loader shows; `ytgame.game.gameReady()` only when interactive.
- Saving ONLY via `ytgame.game.saveData()` / `loadData()` (await loadData before saveData; must load older save formats). No localStorage.
- Pause/resume ONLY via `ytgame.system.onPause()` / `onResume()` (Page Visibility API forbidden). Save on pause.
- Audio: respect `ytgame.system.isAudioEnabled()` + `onAudioEnabledChange()`. No in-game mute button.
- Optional: `ytgame.engagement.sendScore()`; best score must match the save.

## Design (must)
- Support every aspect ratio from 9:32 to 32:9; never lock orientation; keep state on resize.
- Touch AND mouse for everything; keyboard recommended; Esc closes modals (don't preventDefault Esc).
- No exit/quit button, no external links, no share prompts, no extra EULAs, no icons mimicking YouTube controls.
- Text/graphics crisp (no blurry scaling). Thumbnails in multiple aspect ratios.

## Monetization
None, except YouTube-provided interstitial/rewarded ad functions configured in the portal. No IAP, no third-party ads.

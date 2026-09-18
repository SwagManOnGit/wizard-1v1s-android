import './style.css';
import { platform } from './platform';
import { pauseAudio, resumeAudio, setAudioEnabled, setMusicEnabled, setSfxEnabled } from './audio';
import { parseSave } from './save';
import { analytics } from './net/analytics';
import { UI, showSplash } from './ui';
import { preloadModels } from './scene';
import { Battle, GLYPHS, PvpBattle, PvpBot, Recognizer, SPELLS, SPELL_BY_ID, computeStats, enemyForLevel, enemyLook } from '@wizard/shared';

async function boot(): Promise<void> {
  const root = document.getElementById('app') as HTMLElement;
  await platform.init();

  const splashDone = showSplash(root);
  const [raw] = await Promise.all([
    platform.load(),
    preloadModels(),
    document.fonts ? document.fonts.ready.then(() => undefined) : Promise.resolve(),
  ]);
  const save = parseSave(raw);
  analytics.start(save.deviceId, save.settings.analytics);
  setAudioEnabled(true);
  setMusicEnabled(save.settings.music);
  setSfxEnabled(save.settings.sfx);

  const ui = new UI(root, save, () => { void platform.save(JSON.stringify(save)); });
  if (import.meta.env.DEV) {
    (window as unknown as { __wiz: unknown }).__wiz = { GLYPHS, Recognizer, SPELLS, SPELL_BY_ID, enemyForLevel, enemyLook, Battle, PvpBattle, PvpBot, computeStats, ui, save };
  }

  platform.onPause(() => { pauseAudio(); ui.onPause(); analytics.endSession(); void platform.save(JSON.stringify(save)); });
  // Coming back from the background starts a fresh session, which is what "sessions per day" means.
  platform.onResume(() => { resumeAudio(); ui.onResume(); analytics.start(save.deviceId, save.settings.analytics); });
  platform.onBack(() => ui.onBack());

  await splashDone;
  ui.start();
}

void boot();

// DOM screens, HUD, draw pad, shop and training. Owns the battle loop.
import logoUrl from './assets/swag-logo.png';
import { setMusic, sfx, unlockAudio } from './audio';
import { Battle, type BattleEvent } from '@wizard/shared';
import {
  AD_REWARD, BUYABLE_ELEMENTS, CHAPTERS, CHAPTER_SIZE, CHESTS, ELEMENTS, ELEMENT_BY_ID, EQUIP_BY_ID, EQUIP_SLOTS, HAT_STYLES, MAX_LEVEL,
  ATTUNING_RARITY, BEARD_COLORS, RARITY_COLORS, RARITY_NAMES, SET_BONUSES, SET_SIZE, SKIN_TONES,
  LISTED_SPELLS, SEASON_DAYS, SPELLS, SPELL_BY_ID, STAFF_STYLES, STARTING_EQUIPMENT, TIER_NAMES, TIER_XP, UPGRADES,
  activeSetBonus, affinities, arenaFor, chapterName, chapterOf, discoverable, discoveryProgress, discoveryThreshold, elementSpells, enemyForLevel,
  nextArena,
  isAttuned, isBossLevel, isChapterBoss,
  chestOdds, makeDuelCode, normaliseDuelCode, openChest, requirementText, rollItem, rollLevelDrop, shiftColor,
  spellStatus, spellStroke, upgradePrice, wizardLevel,
  type ChestDef, type ElementId, type EnemyDef, type EquipDef, type EquipSlot, type Rarity, type SpellDef, type StageId, type WizardLook,
} from '@wizard/shared';
import { drawGlyph, pointAlong, spellStroke as strokeOf, type Point } from '@wizard/shared';
import { ICON_PX, achievementIcon, elementIcon, gearIcon, makePixelCanvas, placeIcon, questIcon, rewardIcon, slotIcon, uiIcon, upgradeIcon, wizardPortrait, type UiIconName } from './icons';
import { Recognizer } from '@wizard/shared';
import { attune, attunement, equipItem, grantItem, ownedInSlot, playerLook, setSummary, type GrantResult } from './features/collection';
import { computeStats, type SaveData } from './save';
import { Arena, WizardView } from './scene';
import { TERRAIN_SCALE, drawTrail, paintTerrain } from './terrain';
import { CONFIG, platform, webPlatform } from './platform';
import { setMusicEnabled, setSfxEnabled } from './audio';
import { api } from './net/api';
import { analytics } from './net/analytics';
import { ACHIEVEMENTS, evaluateAchievements } from './features/achievements';
import { challengeAvailable, claimDaily, dailyChallenge, markChallengeDone, nextRewardTime, type Challenge } from './features/daily';
import { canClaimQuests, ensureQuests, questChest, questsToday } from './features/quests';
import { weekKey, weeklyRumour } from './features/rumour';
import {
  QUEST_XP, SEASON_TIER_COUNT, addSeasonXp, battleXp, chestById, claimSeason, ensureSeason,
  offlineEarnings, rewardsFor, seasonFor, tierFor, unclaimedTiers,
} from './features/season';
import { BotSession, GhostSession, OnlineSession, fetchGhost, type DuelMode, type DuelSession } from './duel/session';
import type { BattleLike } from './duel/view';

const RECOGNIZE_THRESHOLD = 0.6;
/** Scripted first duel: a softer opponent, three Sparks and it falls. */
const FTUE_ENEMY_HP = 36;
/** ftue values: 0 not started, 1 in the scripted duel, 2 duel done, 3 codex card seen. */
const FTUE_BATTLE_DONE = 2, FTUE_ALL_DONE = 3;
/** One starter handed over per cleared level, so each of the first fights teaches one thing. */
const FTUE_GIFTS: Record<number, string> = { 1: 'arcaneorb', 2: 'ward', 3: 'mend' };
/** A discovery must beat the best equipped match by this much, so known spells always win ties. */
const DISCOVERY_MARGIN = 0.03;
/**
 * Training wheels. A spell's glyph is drawn on the pad while it is still unfamiliar and fades out
 * as it is used, so a new spell at level 300 gets the same help Spark did on level 1. Nothing is
 * taken away permanently: the peek button brings the guide back at full strength whenever it is
 * wanted, at the cost of the seconds spent holding it.
 */
const WHEELS_FULL = 3, WHEELS_GONE = 8;
function wheelsAlpha(casts: number): number {
  if (casts < WHEELS_FULL) return 1;
  if (casts >= WHEELS_GONE) return 0;
  return 1 - (casts - WHEELS_FULL) / (WHEELS_GONE - WHEELS_FULL);
}

/** A stable outfit for an opponent we only know by name. */
function lookFromName(name: string): WizardLook {
  const h = [...name].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  return {
    robe: shiftColor('#c04040', (h % 10) / 10), hat: shiftColor('#802020', (h % 10) / 10), trim: '#ffd23f',
    skin: SKIN_TONES[h % SKIN_TONES.length].color,
    beardColor: BEARD_COLORS[(h >>> 3) % BEARD_COLORS.length].color,
    boots: shiftColor('#5c3a1e', ((h >>> 5) % 4) * 0.03),
    girth: 0.88 + ((h >>> 7) % 32) / 32 * 0.3, height: 0.94 + ((h >>> 11) % 32) / 32 * 0.16,
    hatStyle: HAT_STYLES[h % HAT_STYLES.length], staffStyle: STAFF_STYLES[h % STAFF_STYLES.length],
    beard: h % 3 !== 0, cape: h % 2 === 0,
  };
}



/** The level map: pixels of trail per level, and the gap left above level 500 for the crest. */
const MAP_STEP = 78;
const MAP_TOP = 150;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function btn(label: string, cls = '', onClick?: () => void): HTMLButtonElement {
  const b = el('button', `btn ${cls}`.trim(), label);
  if (onClick) b.addEventListener('click', () => { unlockAudio(); sfx.click(); onClick(); });
  return b;
}

function glyphCanvas(spell: SpellDef, size = 44): HTMLCanvasElement {
  const px = 28;
  return makePixelCanvas(px, size, g => {
    g.fillStyle = '#1a1250'; g.fillRect(0, 0, px, px);
    g.fillStyle = '#2a2080'; g.fillRect(1, 1, px - 2, px - 2);
    drawGlyph(g, spell.glyph, px * 0.15, px * 0.15, px * 0.7, spell.color, 2.4, spell.reverse);
  });
}

/** A silhouette for a spell nobody has drawn yet: enough to tease, never enough to copy. */
function mysteryCanvas(spell: SpellDef, size = 44): HTMLCanvasElement {
  const px = 28;
  const colour = ELEMENT_BY_ID[spell.element].color;
  return makePixelCanvas(px, size, g => {
    g.fillStyle = '#120c34'; g.fillRect(0, 0, px, px);
    g.fillStyle = '#1e1a5a'; g.fillRect(1, 1, px - 2, px - 2);
    // Tier is shown as dots, so players can see how deep a secret is without seeing its shape.
    g.fillStyle = colour;
    for (let i = 0; i < spell.tier; i++) g.fillRect(4 + i * 4, px - 7, 3, 3);
    g.fillStyle = shiftColor(colour, 0, -0.25);
    g.font = '16px "Jersey 10", sans-serif'; g.textAlign = 'center';
    g.fillText('?', px / 2, px / 2 + 4);
  });
}

function strokeExtent(pts: Point[]): number {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  return Math.max(maxX - minX, maxY - minY);
}

/** Fraction of the pad a glyph must span: cheap spells stay quick, big spells demand a big, deliberate stroke. */
function requiredCoverage(spell: SpellDef): number {
  return Math.min(0.68, 0.28 + 0.42 * (spell.cost / 65));
}

/**
 * Slack for a new wizard, full at level 1 and gone by level 10.
 *
 * The size and clarity gates exist to stop a veteran spamming a Mythic with a two-centimetre
 * scribble. Applying them at full strength to somebody ninety seconds into the game punishes the
 * exact stroke they are still learning to make, and roughly three in five players leave a game
 * whose difficulty arrives too fast. It is also safe: early on only a handful of spells are armed,
 * so a looser threshold has almost nothing to be confused with.
 */
function leniency(best: number): number {
  return Math.max(0, 1 - best / 10);
}

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Rarity as a player-readable share, never rounding a real discovery down to "0%". */
function sharePercent(holders: number, players: number): string {
  const pct = (holders / Math.max(1, players)) * 100;
  if (pct >= 10) return `${Math.round(pct)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  return `${Math.max(0.1, Number(pct.toFixed(2)))}%`;
}

/**
 * The per-item odds line. Google Play will not pass a build that sells randomised items without
 * showing the chances first, and it is the honest thing to put next to a price anyway.
 */
function oddsLine(chest: ChestDef): HTMLElement {
  const row = el('div', 'odds');
  chestOdds(chest).forEach((p, i) => {
    if (p <= 0) return;
    const r = (i + 1) as Rarity;
    const span = el('span', '', `${RARITY_NAMES[r]} ${p.toFixed(1)}%`);
    span.style.color = RARITY_COLORS[r];
    row.append(span);
  });
  const note = el('small', '', `per item · ${chest.items} ${chest.items === 1 ? 'item' : 'items'} per chest`);
  row.append(note);
  return row;
}

/** A blank progression block for the reset button (identity and settings are kept by the caller). */
function parseSaveFresh(): Partial<SaveData> {
  const starters = SPELLS.filter(s => s.starter).map(s => s.id);
  return {
    coins: 0, level: 1, best: 0, discovered: [...starters], loadout: [...starters],
    elements: ['arcane'], upgrades: {},
    inventory: [...STARTING_EQUIPMENT],
    equipped: { hat: 'arcane_hat_1', outfit: 'arcane_outfit_1', staff: 'arcane_staff_1', shoes: 'arcane_shoes_1' },
    wins: 0, losses: 0, earned: 0, adsWatched: 0,
    daily: { lastClaim: '', streak: 0, challengeDate: '', challengeDone: false, graceMonth: '' }, achievements: [],
    stats: { dodges: 0, casts: 0, bossWins: 0, duelWins: 0, duelLosses: 0, ghostWins: 0, ghostLosses: 0, metersCast: 0, drops: 0, chests: 0 },
    reviewAsked: false, rating: 1000,
  };
}

export function showSplash(root: HTMLElement): Promise<void> {
  root.innerHTML = '';
  const s = el('div', 'screen active'); s.id = 'splash';
  const img = el('img'); img.src = logoUrl; img.alt = 'Swag Games';
  s.append(img, el('div', 'studio', 'SWAG GAMES'));
  root.append(s);
  return new Promise(res => setTimeout(res, 1500));
}

type ScreenId = 'menu' | 'battle' | 'result' | 'shop' | 'duel' | 'settings' | 'ranks' | 'achievements' | 'spellbook' | 'gear' | 'market' | 'season';
type ShopTab = 'elements' | 'chests' | 'upgrades';
type SpellbookTab = 'known' | 'codex';

/** Simple pixel glyphs for the tab bar. */
function navIcon(id: ScreenId, size: number): HTMLCanvasElement {
  return makePixelCanvas(24, size, g => {
    const s = 24;
    g.fillStyle = '#ffe9a8';
    switch (id) {
      case 'shop':
        g.fillRect(s * 0.14, s * 0.4, s * 0.72, s * 0.42);
        g.fillStyle = '#ff7a3d';
        for (let i = 0; i < 4; i++) g.fillRect(s * 0.14 + i * s * 0.18, s * 0.22, s * 0.09, s * 0.18);
        break;
      case 'gear':
        g.beginPath(); g.moveTo(s * 0.5, s * 0.14); g.lineTo(s * 0.7, s * 0.6); g.lineTo(s * 0.3, s * 0.6); g.closePath(); g.fill();
        g.fillRect(s * 0.14, s * 0.6, s * 0.72, s * 0.12);
        break;
      case 'menu':
        g.beginPath(); g.moveTo(s * 0.56, s * 0.1); g.lineTo(s * 0.26, s * 0.54); g.lineTo(s * 0.46, s * 0.54);
        g.lineTo(s * 0.38, s * 0.9); g.lineTo(s * 0.74, s * 0.42); g.lineTo(s * 0.52, s * 0.42); g.closePath(); g.fill();
        break;
      case 'spellbook':
        g.fillStyle = '#6a3a1e'; g.fillRect(s * 0.16, s * 0.16, s * 0.68, s * 0.68);
        g.fillStyle = '#ffe9a8'; g.fillRect(s * 0.22, s * 0.22, s * 0.44, s * 0.56);
        g.fillStyle = '#4de1ff'; g.fillRect(s * 0.3, s * 0.36, s * 0.28, s * 0.06); g.fillRect(s * 0.4, s * 0.28, s * 0.08, s * 0.24);
        break;
      case 'market':
        for (let i = 0; i < 3; i++) { g.fillStyle = i === 0 ? '#ffd23f' : '#e0a820'; g.fillRect(s * 0.24, s * 0.62 - i * s * 0.16, s * 0.52, s * 0.14); }
        break;
      default:
        g.fillRect(s * 0.3, s * 0.3, s * 0.4, s * 0.4);
    }
  });
}

export class UI {
  private save: SaveData;
  private onChange: () => void;
  private screens: Record<ScreenId, HTMLElement>;
  private overlay: HTMLElement;
  private nav: HTMLElement;
  private pickedLevel: number;
  private spellbookTab: SpellbookTab = 'known';

  // Battle.
  private arenaEl: HTMLElement;
  private arenaOverlay: HTMLElement;
  private controls: HTMLElement;
  private arena: Arena | null = null;
  private battle: BattleLike | null = null;
  private duel: DuelSession | null = null;
  private duelCountdownShown = 99;
  private challenge: Challenge | null = null;
  private dailyChecked = false;
  private toasts: HTMLElement | null = null;
  private recognizer = new Recognizer<string>();
  /** Separate pool of spells the player has not found yet but could, given their element and gear. */
  private discoveryRec = new Recognizer<string>();
  /** The same equipped spells armed backwards, purely so a wrong-way stroke can be named. */
  private mirrorRec = new Recognizer<string>();
  private grimoireElement: ElementId = 'arcane';
  /** Step of the scripted first duel: 0 trace, 1 dodge, 2 finish. -1 when not in it. */
  private ftueStep = -1;
  /** The concrete Battle behind the script: the duel view interface cannot hold the enemy still. */
  private scripted: Battle | null = null;
  private battleStartedAt = 0;
  private ftueTimeScale = 1;
  private pendingGift: SpellDef | null = null;
  /** Tiers gained since the last result screen, so the season bump is reported where it happened. */
  private seasonGained = 0;
  /** How many wizards know each spell, fetched when the spellbook opens. Null until it answers. */
  private board: { players: number; spells: Record<string, { holders: number; first: string | null }> } | null = null;
  private loopId = 0;
  private lastT = 0;
  private paused = false;
  private training = false;
  private battleLevel = 1;
  private hud!: {
    enemyName: HTMLElement; enemyTag: HTMLElement; enemyLvl: HTMLElement; enemyFill: HTMLElement; enemyShield: HTMLElement; enemyTxt: HTMLElement;
    hpFill: HTMLElement; hpShield: HTMLElement; hpTxt: HTMLElement; manaFill: HTMLElement; manaTxt: HTMLElement; stamFill: HTMLElement; stamTxt: HTMLElement;
    buffs: HTMLElement; enemyBuffs: HTMLElement;
    trainStats: HTMLElement; sparBtn: HTMLButtonElement; chips: Map<string, HTMLElement>; castMsg: HTMLElement; pad: HTMLCanvasElement; dodgeBtns: HTMLButtonElement[];
  };
  private padPoints: Point[] = [];
  private padDrawing = false;
  private padFlash = 0;
  /** Set while the pad has something moving on it, so the loop keeps redrawing it. */
  private padAnimating = false;
  /** Frames of frozen time after a heavy impact. The oldest trick in the book and it was missing. */
  private hitStop = 0;
  private padHint: SpellDef | null = null;
  private padHintT = 0;
  /** True while the peek button is held: the guide is shown and the duel carries on around it. */
  private peeking = false;
  private castMsgT = 0;
  private lastDps = { t: 0, dmg: 0, dps: 0 };
  private arrangeControls: (() => void) | null = null;

  constructor(root: HTMLElement, save: SaveData, onChange: () => void) {
    this.save = save;
    this.onChange = onChange;
    this.pickedLevel = Math.min(save.level, MAX_LEVEL);

    root.innerHTML = '';
    this.screens = {
      menu: el('div', 'screen'), battle: el('div', 'screen'), result: el('div', 'screen'), shop: el('div', 'screen'),
      duel: el('div', 'screen'), settings: el('div', 'screen'), ranks: el('div', 'screen'), achievements: el('div', 'screen'),
      spellbook: el('div', 'screen'), gear: el('div', 'screen'), market: el('div', 'screen'), season: el('div', 'screen'),
    };
    for (const [id, s] of Object.entries(this.screens)) { s.id = id; root.append(s); }
    this.overlay = el('div', 'overlay');
    this.toasts = el('div', 'toasts');
    this.nav = el('div', 'nav');
    root.append(this.nav, this.overlay, this.toasts);
    this.buildNav();
    if (webPlatform) {
      webPlatform.fakeAd = () => this.showFakeAd();
      webPlatform.fakePurchase = sku => this.showFakePurchase(sku);
    }

    // Battle screen skeleton (arena canvas persists across battles).
    this.arenaEl = el('div', 'arena');
    this.arenaOverlay = el('div', 'arena-overlay');
    this.arenaEl.append(this.arenaOverlay);
    this.controls = el('div', 'controls');
    this.screens.battle.append(this.arenaEl, this.controls);

    window.addEventListener('keydown', e => this.onKey(e));
    window.addEventListener('resize', () => { this.arena?.resize(); this.arrangeControls?.(); });
    window.addEventListener('pointerdown', () => unlockAudio(), { passive: true });
    // Swipe on the arena also dodges.
    let swipe: { x: number; y: number } | null = null;
    this.arenaEl.addEventListener('pointerdown', e => { swipe = { x: e.clientX, y: e.clientY }; });
    this.arenaEl.addEventListener('pointerup', e => {
      if (!swipe) return;
      const dx = e.clientX - swipe.x;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - swipe.y)) this.dodge(dx < 0 ? -1 : 1);
      swipe = null;
    });
  }

  /** Screens that keep the tab bar on. The battle and its result take the whole screen. */
  private static readonly NAV_SCREENS: ScreenId[] = ['menu', 'shop', 'gear', 'spellbook', 'market', 'duel', 'ranks', 'achievements', 'settings'];

  private show(id: ScreenId): void {
    if (this.overlayDismiss) this.overlayDismiss();
    if (id !== 'gear') this.wizardView?.stop();
    for (const [k, s] of Object.entries(this.screens)) s.classList.toggle('active', k === id);
    this.nav.classList.toggle('hidden', !UI.NAV_SCREENS.includes(id));
    this.syncNav(id);
  }

  /** The five-tab bar: across the bottom in portrait, down the left side in landscape. */
  private buildNav(): void {
    const tabs: { id: ScreenId; label: string; go: () => void; main?: boolean }[] = [
      { id: 'shop', label: 'Shop', go: () => this.showShop('elements') },
      { id: 'gear', label: 'Loadout', go: () => this.showGear() },
      { id: 'menu', label: 'Battle', go: () => this.showMenu(), main: true },
      { id: 'spellbook', label: 'Spells', go: () => this.showSpellbook() },
      { id: 'market', label: 'Market', go: () => this.showMarket() },
    ];
    this.nav.innerHTML = '';
    for (const t of tabs) {
      const b = el('button', `nav-tab ${t.main ? 'main' : ''}`.trim());
      b.dataset.screen = t.id;
      b.append(navIcon(t.id, t.main ? 38 : 28), el('span', 'nav-label', t.label), el('span', 'nav-badge'));
      b.addEventListener('click', () => { unlockAudio(); sfx.click(); t.go(); });
      this.nav.append(b);
    }
  }

  /** Highlights the active tab and shows the NEW badge over the spellbook. */
  private syncNav(id: ScreenId): void {
    for (const b of Array.from(this.nav.children) as HTMLElement[]) {
      b.classList.toggle('on', b.dataset.screen === id);
      const badge = b.querySelector('.nav-badge') as HTMLElement | null;
      if (!badge) continue;
      const n = b.dataset.screen === 'spellbook' ? this.save.unseen.length : 0;
      badge.textContent = n ? String(n) : '';
      badge.classList.toggle('show', n > 0);
    }
  }

  private commit(): void { this.onChange(); }

  /**
   * Boot entry. A brand new wizard never sees the menu first: they are dropped straight into a
   * scripted duel, because the one verb this game runs on is one nobody has met before.
   */
  start(): void {
    if (this.save.ftue < FTUE_BATTLE_DONE && this.save.best === 0) { this.startFtue(); return; }
    const away = offlineEarnings(this.save);
    this.save.lastSeen = Date.now();
    this.showMenu();
    if (away) {
      this.save.coins += away.coins;
      this.save.earned += away.coins;
      this.commit();
      const hours = Math.floor(away.minutes / 60), mins = away.minutes % 60;
      setTimeout(() => this.openOverlay((box, close) => {
        box.append(el('h2', '', 'WHILE YOU WERE OUT'),
          el('div', 'note', `The tower kept paying for ${hours ? `${hours}h ${mins}m` : `${mins}m`}.`),
          el('div', 'reward', `+${fmt(away.coins)} coins`),
          btn('TAKE IT', 'gold big', close));
      }), 400);
    }
  }

  private startFtue(): void {
    this.save.ftue = 1;
    this.commit();
    this.startBattle(1, false, null, true);
  }

  // ---------------------------------------------------------------- scripted first duel
  /** Moves the script on, and with it the prompt, the clock and what the player is allowed to do. */
  private ftueEnter(step: number): void {
    this.ftueStep = step;
    analytics.track('ftue_step', { step });
    for (const d of this.hud.dodgeBtns) { d.disabled = step === 0; d.classList.remove('pulse'); }
    if (step === 0) {
      this.padHint = SPELL_BY_ID.spark; this.padHintT = 9999;
      this.ftueSay('TRACE THE GLYPH', 'Follow the arrows, top to bottom.');
    } else if (step === 1) {
      this.padHintT = 0; this.ftueTimeScale = 0.35;
      this.ftueSay('NOW MOVE', 'Tap the side that lights up.');
      if (this.scripted) this.scripted.enemy.castTimer = 0.25;
    } else if (step === 2) {
      this.ftueTimeScale = 1;
      this.ftueSay('FINISH IT', 'Keep drawing. Dodge when a lane lights up.');
      setTimeout(() => this.arenaOverlay.querySelector('.ftue-prompt')?.classList.add('out'), 2600);
    }
  }

  private ftueSay(title: string, sub: string): void {
    this.arenaOverlay.querySelector('.ftue-prompt')?.remove();
    const p = el('div', 'ftue-prompt');
    p.innerHTML = `<b>${title}</b><small>${sub}</small>`;
    this.arenaOverlay.append(p);
  }

  private clearFtue(): void {
    this.peeking = false;
    this.ftueStep = -1;
    this.scripted = null;
    this.ftueTimeScale = 1;
    this.padHintT = 0;
    this.arenaOverlay.querySelector('.ftue-prompt')?.remove();
    for (const d of this.hud.dodgeBtns ?? []) { d.disabled = false; d.classList.remove('pulse'); }
  }

  // ---------------------------------------------------------------- menu
  /** The home page: player bar, daily challenge, the level map and the battle buttons. */
  showMenu(): void {
    this.stopLoop();
    setMusic('menu');
    const s = this.screens.menu;
    s.innerHTML = '';

    // Player bar: who you are, what you have, and a way into the settings.
    const bar = el('div', 'player-bar');
    const badge = el('div', 'wiz-level');
    badge.innerHTML = `<small>LV</small>${wizardLevel(this.save.best)}`;
    const inChapter = this.save.best % CHAPTER_SIZE;
    const xp = el('div', 'lv-bar');
    const xpFill = el('div', 'lv-fill');
    xpFill.style.width = `${Math.round((inChapter / CHAPTER_SIZE) * 100)}%`;
    xp.append(xpFill, el('span', '', `${inChapter}/${CHAPTER_SIZE}`));
    badge.append(xp);
    const idBox = el('div', 'who-box');
    const nameLine = el('div', 'who-name', this.save.name);
    if (this.save.title) nameLine.append(el('span', 'worn-title', ` ${this.save.title}`));
    idBox.append(nameLine, el('div', 'who-sub',
      `${arenaFor(this.save.rating).name} · ${this.save.best ? `${this.save.best} of ${MAX_LEVEL} cleared` : 'No levels cleared yet'}`));
    const purse = el('div', 'purse');
    const plus = el('button', 'purse-plus', '+');
    plus.addEventListener('click', () => { sfx.click(); this.showMarket(); });
    purse.append(el('div', 'coins', fmt(this.save.coins)), plus);
    bar.append(badge, idBox, purse, btn('⚙', 'small ghost', () => this.showSettings()));

    // One line, always, saying what to do next.
    const goal = this.nextGoal();
    const goalStrip = el('button', 'goal-strip');
    goalStrip.append(uiIcon('spark', 20, '#ffcc33'), el('i', '', 'NEXT'), el('span', '', goal.text), el('em', '', '›'));
    goalStrip.addEventListener('click', () => { unlockAudio(); sfx.click(); goal.go(); });

    const body = el('div', 'hub-body');
    const overlayTop = el('div', 'map-top');
    const dailyRow = el('div', 'drawer-row');
    const dailyBody = el('div', 'drawer-host');
    overlayTop.append(dailyRow, dailyBody);

    // Three quests a day. Progress is a delta against counters the game already keeps, so a quest
    // can never disagree with the statistics screen.
    ensureQuests(this.save);
    const chest = questChest(this.save);
    const quests = questsToday(this.save);
    const doneCount = quests.filter(q => q.done).length;
    const claimable = canClaimQuests(this.save);
    dailyRow.append(this.drawer('quests', 'scroll', '#ffcc33', 'QUESTS',
      claimable ? `${chest.name} ready` : this.save.quests.claimed ? 'Claimed' : `${doneCount}/${quests.length} done`,
      claimable, qCard => {
        qCard.classList.add('quests');
        qCard.append(el('div', 'quest-head', this.save.quests.claimed ? 'Reward claimed' : `All three: a ${chest.name}`));
        for (const q of quests) {
          const row = el('div', `quest ${q.done ? 'done' : ''}`);
          row.append(questIcon(q.def.metric, 26));
          const txt = el('div', 'quest-txt');
          txt.append(el('div', 'name', q.def.name), el('div', 'desc', q.def.desc));
          const bar = el('div', 'quest-bar');
          const fill = el('div', 'fill');
          fill.style.width = `${Math.round((q.progress / q.def.goal) * 100)}%`;
          bar.append(fill);
          row.append(txt, bar, el('div', 'quest-count', q.done ? 'DONE' : `${q.progress}/${q.def.goal}`));
          qCard.append(row);
        }
        if (claimable) qCard.append(btn(`CLAIM ${chest.name.toUpperCase()}`, 'gold', () => this.claimQuests()));
      }, () => this.showMenu(), dailyBody));

    // Daily challenge sits at the top: one modified fight a day for triple coins.
    const ch = dailyChallenge(this.save);
    const open = challengeAvailable(this.save);
    dailyRow.append(this.drawer('challenge', 'flame', '#ff8a2a', 'CHALLENGE',
      open ? ch.name : 'Done today', open, chCard => {
        chCard.classList.add('challenge');
        const chInfo = el('div');
        chInfo.append(el('div', 'name', ch.name),
          el('div', 'desc', `${ch.desc} Level ${ch.level}: ${ch.enemy.name}. Triple coins.`));
        chCard.append(uiIcon('flame', 34, '#ff8a2a'), chInfo);
        if (open) chCard.append(btn('FIGHT', 'gold', () => this.startBattle(ch.level, false, ch)));
        else chCard.append(btn('Done today', 'ghost'));
      }, () => this.showMenu(), dailyBody));

    // The level map: one continuous trail from level 1 to 500, winding up through ten chapters of
    // terrain. It is its own scroll container, so the hub around it never moves.
    //
    // Cost is kept down by never drawing a chapter that nobody is looking at: the terrain canvas and
    // the fifty buttons of a chapter are built the first time it comes near the viewport and kept
    // afterwards. Five hundred buttons at once is a stutter on a phone, and nine tenths of them are
    // off screen at any moment.
    const maxPick = Math.min(MAX_LEVEL, this.save.best + 1);
    if (this.pickedLevel > maxPick) this.pickedLevel = maxPick;

    const map = el('div', 'level-map');
    const info = el('div', 'level-info');
    const playBtn = btn('BATTLE', 'gold big', () => this.startBattle(this.pickedLevel, false));
    const nodes = new Map<number, HTMLElement>();

    const renderInfo = (): void => {
      const e = enemyForLevel(this.pickedLevel);
      const cleared = this.pickedLevel <= this.save.best;
      info.innerHTML = '';
      const title = el('div', 'level-title');
      title.innerHTML = `<b>Level ${this.pickedLevel}</b> <span class="${e.boss ? 'boss' : ''}">${e.boss ? 'BOSS: ' : ''}${e.name}</span>`;
      info.append(title);
      const stats = el('div', 'level-stats');
      const stat = (icon: UiIconName, tint: string, text: string): HTMLElement => {
        const box = el('div', 'level-stat');
        box.append(uiIcon(icon, 20, tint), el('span', '', text));
        return box;
      };
      const coin = stat('coin', cleared ? '#8a7a4a' : '#ffcc33', fmt(cleared ? Math.round(e.coins * 0.6) : e.coins));
      if (cleared) coin.title = 'Replays pay 60%';
      stats.append(stat('heart', '#ff6a6a', `${fmt(e.hp)}`), stat('sword', '#d8dce8', `${e.damage}`), coin);
      info.append(stats);
      nodes.forEach((n, L) => n.classList.toggle('picked', L === this.pickedLevel));
      playBtn.textContent = `BATTLE: LEVEL ${this.pickedLevel}`;
    };

    /** Where a level sits on the trail, as a fraction of the map's width and an absolute y. */
    const nodeX = (level: number): number => 0.5 + Math.sin((level - 1) * 0.52) * 0.33;
    const nodeY = (level: number): number => (MAX_LEVEL - level) * MAP_STEP + MAP_STEP / 2 + MAP_TOP;

    const built = new Set<number>();
    const sections: HTMLElement[] = [];
    const buildChapter = (c: number): void => {
      if (built.has(c)) return;
      built.add(c);
      const section = sections[c];
      const width = map.clientWidth || 360;
      const first = c * CHAPTER_SIZE + 1, last = (c + 1) * CHAPTER_SIZE;

      const canvas = document.createElement('canvas');
      canvas.className = 'map-terrain';
      const cw = Math.max(1, Math.round(width / TERRAIN_SCALE));
      const chH = CHAPTER_SIZE * MAP_STEP;
      const ch = Math.max(1, Math.round(chH / TERRAIN_SCALE));
      canvas.width = cw; canvas.height = ch;
      const g = canvas.getContext('2d')!;
      paintTerrain(g, cw, ch, c);
      // One node beyond each end so the trail runs through the chapter seams without a gap.
      const pts: { x: number; y: number }[] = [];
      for (let L = Math.min(MAX_LEVEL, last + 1); L >= Math.max(1, first - 1); L--) {
        pts.push({ x: nodeX(L) * cw, y: (nodeY(L) - (MAX_LEVEL - last) * MAP_STEP - MAP_TOP) / TERRAIN_SCALE });
      }
      drawTrail(g, pts, c);
      section.append(canvas);

      const banner = el('div', 'map-banner');
      banner.append(el('b', '', chapterName(c)), el('small', '', `Levels ${first}–${last}`));
      section.append(banner);

      for (let L = first; L <= last; L++) {
        const boss = isBossLevel(L), lord = isChapterBoss(L);
        const state = L <= this.save.best ? 'done' : L === maxPick ? 'next' : 'locked';
        const n = el('button', `map-node ${state} ${boss ? 'boss' : ''} ${lord ? 'lord' : ''} ${L === this.pickedLevel ? 'picked' : ''}`);
        n.style.left = `${nodeX(L) * 100}%`;
        n.style.bottom = `${(L - first) * MAP_STEP + MAP_STEP / 2}px`;
        n.append(el('b', '', String(L)));
        if (boss) {
          const mark = lord ? uiIcon('trophy', 20, '#ffcc33') : uiIcon('skull', 18, '#ff8f8f');
          mark.className = 'map-mark';
          n.append(mark);
        }
        if (state === 'locked') n.disabled = true;
        else n.addEventListener('click', () => { unlockAudio(); sfx.click(); this.pickedLevel = L; renderInfo(); });
        nodes.set(L, n);
        section.append(n);
      }
    };

    // Chapters are stacked bottom to top: level 1 at the foot of the map, 500 at its head.
    for (let c = CHAPTERS - 1; c >= 0; c--) {
      const section = el('div', `map-chapter ${c > chapterOf(maxPick) ? 'unseen' : ''}`);
      section.style.height = `${CHAPTER_SIZE * MAP_STEP}px`;
      sections[c] = section;
      map.append(section);
    }

    // The head of the map, above level 500.
    const crest = el('div', 'map-crest');
    crest.append(uiIcon('spark', 30, '#ffcc33'), el('b', '', 'MORE LEVELS COMING SOON'),
      el('small', '', `Five hundred wizards is where the tower ends, for now.`));
    map.prepend(crest);

    const visibleChapters = (): void => {
      const top = map.scrollTop, bottom = top + map.clientHeight;
      for (let c = 0; c < CHAPTERS; c++) {
        const s = sections[c];
        const y0 = s.offsetTop, y1 = y0 + s.offsetHeight;
        if (y1 > top - MAP_STEP * 6 && y0 < bottom + MAP_STEP * 6) buildChapter(c);
      }
    };

    const jump = btn('', 'map-jump gold small', () => scrollToNode(true));
    jump.append(uiIcon('target', 20, '#3a2410'), el('span', '', 'Current level'));
    const scrollToNode = (smooth = false): void => {
      const want = Math.max(0, nodeY(this.pickedLevel) - map.clientHeight / 2);
      map.scrollTo({ top: want, behavior: smooth ? 'smooth' : 'auto' });
      visibleChapters();
    };

    map.addEventListener('scroll', () => {
      visibleChapters();
      const n = nodes.get(this.pickedLevel);
      const away = !n || Math.abs(n.getBoundingClientRect().top - map.getBoundingClientRect().top - map.clientHeight / 2) > map.clientHeight * 0.6;
      jump.classList.toggle('show', away);
    }, { passive: true });

    const wrap = el('div', 'map-wrap');
    const overlayBottom = el('div', 'map-bottom');
    overlayBottom.append(info);
    wrap.append(map, overlayTop, overlayBottom, jump);
    body.append(wrap);
    // Measured on the second frame: the map takes its height from the viewport, and on the first
    // frame that height is not settled, so every offset would be computed against zero.
    requestAnimationFrame(() => requestAnimationFrame(() => { visibleChapters(); scrollToNode(); renderInfo(); }));


    const foot = el('div', 'hub-foot');
    // Duelling is a headline mode, not a thing beside training, so it gets the same weight as the
    // campaign button. Training drops down to sit with the two screens nobody opens mid-session.
    const duelBtn = btn('DUEL', 'red big has-icon', () => this.showDuelMenu());
    duelBtn.prepend(uiIcon('swords', 26, '#ffffff'));
    const extraRow = el('div', 'menu-row');
    const trainBtn = btn('Training', 'ghost small has-icon', () => this.startBattle(Math.min(MAX_LEVEL, Math.max(1, this.save.best)), true));
    trainBtn.prepend(uiIcon('target', 20, '#b8ffc4'));
    const ranksBtn = btn('Ranks', 'ghost small has-icon', () => this.showRanks());
    ranksBtn.prepend(uiIcon('trophy', 20, '#ffcc33'));
    const awardsBtn = btn('Awards', 'ghost small has-icon', () => this.showAchievements());
    awardsBtn.prepend(uiIcon('medal', 20, '#ffcc33'));
    extraRow.append(trainBtn, ranksBtn, awardsBtn);
    foot.append(playBtn, duelBtn, extraRow);

    s.append(bar, goalStrip, body, foot);
    this.show('menu');
    if (!this.dailyChecked) { this.dailyChecked = true; this.checkDaily(); }
  }

  /**
   * Books tomorrow's reminder, which is also what asks Android for notification permission.
   *
   * Never on a cold first launch: a permission prompt over the menu of a game nobody has played
   * yet is refused, and Android only asks twice before the player has to dig into Settings.
   *
   * Nor on the first clear, which already carries the victory, the level-up, the first drop and
   * the spell card: the OS dialog landed on top of all of it. The second clear is the first quiet
   * moment where the player has a reason to want reminding.
   */
  private maybeScheduleReminder(force = false): void {
    if (!this.save.settings.notifications) return;
    if (!force && this.save.best < 2) return;
    void platform.scheduleReminder(1, 'Wizard 1v1s', 'Your daily reward is ready. The tower awaits!', nextRewardTime());
  }

  /**
   * The one thing worth doing next, in a single line.
   *
   * A hub with a map, a challenge, three quests and five tabs can still leave a player with no
   * idea what to do, which is the usual reason a session ends early. The rules are ordered by how
   * much the player gains, and every one of them is a tap to the screen that resolves it.
   */
  private nextGoal(): { text: string; go: () => void } {
    const save = this.save;
    if (save.unseen.length) {
      const n = save.unseen.length;
      return { text: `${n} new spell${n === 1 ? '' : 's'} in your spellbook`, go: () => this.showSpellbook('known') };
    }
    if (canClaimQuests(save)) {
      return { text: `All three quests done: claim your ${questChest(save).name}`, go: () => this.showMenu() };
    }
    if (weeklyRumour(save) && save.rumourSeen !== weekKey()) {
      return { text: 'A new rumour is going round', go: () => this.showSpellbook('known') };
    }
    const element = BUYABLE_ELEMENTS.filter(e => !save.elements.includes(e.id)).sort((a, b) => a.price - b.price)[0];
    if (element && save.coins >= element.price) {
      return { text: `You can attune ${element.name} for ${fmt(element.price)} coins`, go: () => this.showShop('elements') };
    }
    const upgrade = UPGRADES
      .map(u => ({ u, rank: save.upgrades[u.id] ?? 0 }))
      .filter(x => x.rank < x.u.max && save.coins >= upgradePrice(x.u, x.rank))
      .sort((a, b) => upgradePrice(a.u, a.rank) - upgradePrice(b.u, b.rank))[0];
    if (upgrade) {
      return { text: `${upgrade.u.name} ${upgrade.rank + 1} costs ${fmt(upgradePrice(upgrade.u, upgrade.rank))} coins`, go: () => this.showShop('upgrades') };
    }
    // Only while it is a specific nudge. Once a wizard is attuned to half the elements this count
    // runs to thirty-odd and never changes, and a line that always says the same thing is wallpaper.
    const findable = discoverable(attunement(save), save.discovered).filter(x => !x.secret).length;
    if (findable && findable <= 3) {
      return { text: `${findable} spell${findable === 1 ? '' : 's'} findable with what you are wearing`, go: () => this.showSpellbook('codex') };
    }
    const next = Math.min(MAX_LEVEL, save.best + 1);
    const toChapter = CHAPTER_SIZE - ((next - 1) % CHAPTER_SIZE);
    if (chapterOf(next) + 1 < CHAPTERS) {
      return { text: `${toChapter} level${toChapter === 1 ? '' : 's'} to the ${chapterName(chapterOf(next) + 1)}`, go: () => this.startBattle(next, false) };
    }
    return { text: `Level ${next} of ${MAX_LEVEL}. The top is close.`, go: () => this.startBattle(next, false) };
  }

  /** Pays the three-quest reward as an actual chest opening, which is the better moment. */
  private claimQuests(): void {
    if (!canClaimQuests(this.save)) return;
    const chest = questChest(this.save);
    this.save.quests.claimed = true;
    this.save.stats.chests++;
    const results = openChest(chest, this.save.elements).map(it => grantItem(this.save, it));
    addSeasonXp(this.save, QUEST_XP);
    analytics.track('quest_claimed', { chest: chest.id, best: this.save.best });
    this.commit();
    this.afterProgress();
    this.showMenu();
    this.showLoot(results, `${chest.name} claimed`);
  }

  // ---------------------------------------------------------------- daily reward
  private checkDaily(): void {
    const reward = claimDaily(this.save);
    this.maybeScheduleReminder();
    if (!reward) return;
    this.commit();
    platform.haptic('success');
    sfx.coin();
    this.openOverlay((box, close) => {
      box.append(el('h2', '', 'DAILY REWARD'), el('div', 'note', `Day ${reward.day} of your streak`), el('div', 'reward', `+${fmt(reward.coins)} coins`));
      if (reward.saved) box.append(el('div', 'note gold-note', 'You missed a day. Your streak survived it, once this month.'));
      const days = el('div', 'streak');
      for (let i = 1; i <= 7; i++) days.append(el('span', `pip big ${i <= reward.day ? 'on' : ''}`));
      box.append(days, btn('CLAIM', 'gold big', () => { close(); this.showMenu(); }));
    });
    this.afterProgress();
  }

  /** Runs after anything that can complete an achievement. */
  private afterProgress(): void {
    const fresh = evaluateAchievements(this.save);
    if (fresh.length) { this.commit(); for (const a of fresh) this.toast(`Achievement: ${a.name}`, `+${a.coins} coins`); }
  }

  private toast(title: string, sub = ''): void {
    if (!this.toasts) return;
    const t = el('div', 'toast frame');
    t.innerHTML = `<b>${title}</b>${sub ? `<small>${sub}</small>` : ''}`;
    this.toasts.append(t);
    sfx.coin();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  // ---------------------------------------------------------------- Android back button
  /** Returns true when the press was consumed; false lets the app minimise. */
  onBack(): boolean {
    if (this.overlay.classList.contains('active')) { this.overlayDismiss?.(); return true; }
    const active = (Object.keys(this.screens) as ScreenId[]).find(id => this.screens[id].classList.contains('active'));
    if (active === 'battle') { if (this.training) this.leaveTraining(); else this.confirmForfeit(); return true; }
    if (active && active !== 'menu') { this.showMenu(); return true; }
    return false;
  }


  // ---------------------------------------------------------------- battle
  private startBattle(level: number, training: boolean, challenge: Challenge | null = null, ftue = false): void {
    unlockAudio();
    this.training = training;
    this.duel = null;
    this.challenge = challenge;
    this.battleLevel = level;
    const enemy = challenge ? challenge.enemy
      : ftue ? { ...enemyForLevel(1), hp: FTUE_ENEMY_HP, damage: 6, castInterval: 2.6 }
      : enemyForLevel(level);
    const stats = computeStats(this.save);
    const loadout = (ftue ? ['spark'] : this.save.loadout).map(id => SPELL_BY_ID[id]).filter(Boolean);
    analytics.track('battle_start', { level, training, challenge: !!challenge, ftue });
    const battle = new Battle({ enemy, stats, loadout, training });
    this.battle = battle;
    this.scripted = ftue ? battle : null;
    this.battleStartedAt = performance.now();
    this.armRecognizers(loadout);

    if (!this.arena) this.arena = new Arena(this.arenaEl);
    this.arena.setPlayerLook(playerLook(this.save));
    this.arena.setEnemyLook(enemy, enemy.boss && !training);
    this.arena.setRunning(true);
    this.buildHud(enemy, loadout);
    this.arenaOverlay.querySelectorAll('.popup, .banner').forEach(n => n.remove());
    this.show('battle');
    this.arena.resize();
    setMusic('battle');
    if (enemy.boss && !training) sfx.boss();
    this.banner(training ? 'TRAINING' : challenge ? 'DAILY CHALLENGE' : enemy.boss ? 'BOSS' : `LEVEL ${level}`, training ? 'Draw glyphs to test your spells' : enemy.name);
    if (ftue) this.ftueEnter(0); else this.clearFtue();

    this.lastT = performance.now();
    this.stopLoop();
    this.loopId = requestAnimationFrame(t => this.loop(t));
  }

  // ---------------------------------------------------------------- duels
  /** "Adept · 1043 · 57 to Magister" — a band to hold and a band to chase. */


  showDuelMenu(): void {
    this.stopLoop();
    setMusic('menu');
    const s = this.screens.duel;
    s.innerHTML = '';
    const head = el('div', 'shop-head');
    head.append(btn('◀', 'small ghost', () => this.showMenu()), el('h1', '', 'DUELS'), el('div', 'coins', fmt(this.save.coins)));
    const body = el('div', 'shop-body');
    const st = this.save.stats;

    // The rating card. A duel screen whose only mention of progress was the word "Adept" was
    // hiding its own ladder: the number, the band, and how far the next one is now lead the screen.
    const here = arenaFor(this.save.rating), next = nextArena(this.save.rating);
    const me = el('div', 'card duel-me');
    me.append(wizardPortrait(64));
    const mine = el('div', 'duel-me-words');
    mine.append(el('div', 'name', this.save.name));
    const rank = el('div', 'arena-line');
    rank.append(uiIcon('trophy', 22, '#ffcc33'), el('b', '', here.name), el('span', '', String(this.save.rating)));
    mine.append(rank);
    const ladder = el('div', 'rating-bar');
    const fill = el('div', 'rating-fill');
    // Across the current band, or pinned full once there is no band above.
    const span = next ? next.rank.from - here.from : 1;
    fill.style.width = next ? `${Math.round(Math.max(0, Math.min(1, (this.save.rating - here.from) / span)) * 100)}%` : '100%';
    ladder.append(fill, el('span', '', next ? `${next.away} to ${next.rank.name}` : 'Top of the ladder'));
    mine.append(ladder);
    me.append(mine);

    const record = el('div', 'duel-record');
    const tally = (icon: UiIconName, tint: string, text: string): HTMLElement => {
      const box = el('div', 'level-stat');
      box.append(uiIcon(icon, 20, tint), el('span', '', text));
      return box;
    };
    const played = st.duelWins + st.duelLosses;
    record.append(tally('swords', '#ff8f8f', `${st.duelWins}W ${st.duelLosses}L`),
      tally('ghost', '#d8dce8', `${st.ghostWins}W ${st.ghostLosses}L`),
      tally('medal', '#ffcc33', played ? `${Math.round((st.duelWins / played) * 100)}%` : '—'));
    body.append(me, record);

    // Server status as a pill with a light on it, rather than a sentence that changes under you.
    const status = el('div', 'server-pill waiting');
    status.append(el('i', ''), el('span', '', 'Checking the duel server'));
    body.append(status);

    const online: HTMLButtonElement[] = [];
    const mk = (icon: UiIconName, tint: string, title: string, desc: string, label: string, cls: string, run: () => void, needsServer = false): void => {
      const c = el('div', 'card');
      const b = btn(label, cls, run);
      if (needsServer) { b.disabled = true; online.push(b); }
      c.append(this.cardHead(icon, tint, title, desc), b);
      body.append(c);
    };
    mk('trophy', '#ffcc33', 'Ranked duel', 'Live 1v1 against another player with a fair fixed build. Wins raise your rating.', 'FIND RANKED MATCH', 'gold', () => void this.startOnline(true), true);
    mk('swords', '#9ad8ff', 'Casual duel', 'Live 1v1 with your own spells and gear. No rating change. A bot joins if nobody is around.', 'FIND CASUAL MATCH', 'blue', () => void this.startOnline(false), true);
    mk('ghost', '#b8ffc4', 'Ghost duel', 'Fight a recording of another player. Your own runs are uploaded as ghosts too.', 'FIGHT A GHOST', 'green', () => void this.startGhost(), true);

    // The online modes stay disabled until the server answers, so a tap cannot end in an error
    // dialog that the screen already knew was coming.
    void api.health().then(h => {
      status.className = `server-pill ${h ? 'up' : 'down'}`;
      status.lastChild!.textContent = h
        ? `${h.players} wizard${h.players === 1 ? '' : 's'} online · ${h.ghosts} ghost${h.ghosts === 1 ? '' : 's'}`
        : 'Server unreachable. Practice and friend codes still work.';
      for (const b of online) b.disabled = !h;
    });

    // Friend duels: a six-character code and no account system. No bot ever fills these rooms.
    const friend = el('div', 'card');
    friend.append(this.cardHead('link', '#ffcc33', 'Duel a friend',
      'Share a code and fight whoever types it in. No rating, no bot, your own spells and gear.'));
    const friendRow = el('div', 'menu-row');
    friendRow.append(btn('CREATE A CODE', 'blue', () => void this.startFriendDuel(makeDuelCode())),
      btn('ENTER A CODE', 'ghost', () => this.askForCode()));
    friend.append(friendRow);
    body.append(friend);
    const rerender = (): void => this.showDuelMenu();
    body.append(this.drawer('duel-practice', 'target', '#b8ffc4', 'PRACTICE', 'Offline, no rating', false, card => {
      card.append(el('div', 'desc', 'Offline duel against a bot. Pick your challenge.'));
      const row = el('div', 'menu-row');
      row.append(btn('Easy', 'ghost', () => this.startDuel(new BotSession(this.save, 'easy'))),
        btn('Normal', 'ghost', () => this.startDuel(new BotSession(this.save, 'normal'))),
        btn('Hard', 'ghost', () => this.startDuel(new BotSession(this.save, 'hard'))));
      card.append(row);
    }, rerender));
    body.append(this.drawer('duel-tips', 'book', '#ffcc33', 'HOW DUELS DIFFER', 'Read me once', false, card => {
      card.append(el('div', 'desc', 'Spells chase the opponent\'s lane until halfway, then commit: dodge late. Both wizards have extra health, so read the pad, bait dodges, and save stamina.'));
    }, rerender));
    s.append(head, body);
    this.show('duel');
  }

  /** A code to read out, held on screen until somebody types it in somewhere else. */
  private async startFriendDuel(code: string, joining = false): Promise<void> {
    this.openOverlay((box, close) => {
      box.append(el('h2', '', 'YOUR CODE'), el('div', 'duel-code', code),
        el('div', 'note', 'Give this to your friend. They tap ENTER A CODE and type it in. The room stays open for three minutes.'),
        btn('Share it', 'blue', () => void platform.share(`Duel me in Wizard 1v1s. Code: ${code}`)),
        btn('Cancel', 'ghost', () => { this.friendCancelled = true; close(); this.showDuelMenu(); }));
    });
    this.friendCancelled = false;
    try {
      const session = await OnlineSession.connect(this.save, false, code);
      if (this.friendCancelled) { session.leave(); return; }
      this.overlayDismiss?.();
      this.startDuel(session);
    } catch {
      if (this.friendCancelled) return;
      this.overlayDismiss?.();
      // Telling somebody who just created a code to "check the code" sends them looking in the
      // wrong place: for them the only thing that can be wrong is the connection.
      this.openOverlay((box, close) => {
        box.append(el('h2', '', 'NO LUCK'), el('div', 'note', joining
          ? 'That room could not be reached. Check the code, and that your friend is still waiting.'
          : 'Could not open a room. The duel server is unreachable right now.'), btn('OK', 'gold', close));
      });
    }
  }

  private askForCode(): void {
    this.openOverlay((box, close) => {
      box.append(el('h2', '', 'ENTER A CODE'));
      const input = el('input', 'text-input code-input');
      input.maxLength = 10;
      input.placeholder = 'ABC234';
      input.autocapitalize = 'characters';
      box.append(input);
      const go = btn('DUEL', 'gold big', () => {
        const code = normaliseDuelCode(input.value);
        if (code.length < 6) { input.classList.add('bad'); return; }
        close();
        void this.startFriendDuel(code, true);
      });
      input.addEventListener('input', () => input.classList.remove('bad'));
      input.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); });
      box.append(go, btn('Cancel', 'ghost', close));
      setTimeout(() => input.focus(), 50);
    });
  }

  private friendCancelled = false;

  private async startOnline(ranked: boolean): Promise<void> {
    this.openOverlay((box) => { box.append(el('h2', '', ranked ? 'RANKED' : 'CASUAL'), el('div', 'note', 'Connecting to the duel server...')); });
    try {
      const session = await OnlineSession.connect(this.save, ranked);
      this.overlayDismiss?.();
      this.startDuel(session);
    } catch {
      this.overlayDismiss?.();
      this.openOverlay((box, close) => { box.append(el('h2', '', 'OFFLINE'), el('div', 'note', 'Could not reach the duel server. Try a practice duel instead.'), btn('OK', 'gold', close)); });
    }
  }

  private async startGhost(): Promise<void> {
    this.openOverlay((box) => { box.append(el('h2', '', 'GHOST DUEL'), el('div', 'note', 'Summoning a rival\'s ghost...')); });
    const tape = await fetchGhost(this.save);
    this.overlayDismiss?.();
    if (!tape) {
      this.openOverlay((box, close) => { box.append(el('h2', '', 'NO GHOSTS YET'), el('div', 'note', 'No ghost is available right now. Win a practice duel to leave yours, and try again later.'), btn('OK', 'gold', close)); });
      return;
    }
    this.startDuel(new GhostSession(this.save, tape));
  }

  private startDuel(session: DuelSession): void {
    unlockAudio();
    this.training = false;
    this.challenge = null;
    this.duel = session;
    this.duelCountdownShown = 99;
    this.battle = session.view;
    this.armRecognizers(session.view.loadout);
    if (!this.arena) this.arena = new Arena(this.arenaEl);
    const stages: StageId[] = ['castle', 'forest', 'cave'];
    this.arena.setPlayerLook(playerLook(this.save));
    this.arena.setDuelLook(lookFromName(session.opponentName), stages[Math.floor(Math.random() * stages.length)], Math.floor(Math.random() * 5));
    this.arena.setRunning(true);
    this.buildHud(session.view.enemyDef, session.view.loadout);
    this.hud.enemyLvl.textContent = session.mode === 'ranked' ? 'RANKED' : session.mode === 'online' ? 'CASUAL' : session.mode === 'ghost' ? 'GHOST' : 'PRACTICE';
    this.arenaOverlay.querySelectorAll('.popup, .banner').forEach(n => n.remove());
    this.show('battle');
    this.arena.resize();
    setMusic('battle');
    this.lastT = performance.now();
    this.stopLoop();
    this.loopId = requestAnimationFrame(t => this.loop(t));
  }

  private endDuel(): void {
    const d = this.duel; if (!d || !this.arena) return;
    this.stopLoop();
    const out = d.outcome ?? { won: false, ratingDelta: 0, rating: this.save.rating, reason: 'forfeit' as const };
    const st = this.save.stats;
    if (d.mode === 'ghost') { if (out.won) st.ghostWins++; else st.ghostLosses++; }
    else if (d.mode !== 'bot') { if (out.won) st.duelWins++; else st.duelLosses++; }
    let reward = 0;
    if (out.won) reward = d.mode === 'ranked' ? 150 : d.mode === 'online' ? 100 : d.mode === 'ghost' ? 60 : 25;
    if (this.save.passes.doubleCoins) reward *= 2;
    this.save.coins += reward; this.save.earned += reward;
    if (out.won) platform.haptic('success'); else platform.haptic('error');
    // Share the run as a ghost and report ghost outcomes; failures are silent.
    if (out.tape && out.tape.inputs.length >= 4) void api.postGhost(this.save.deviceId, out.tape);
    if (out.ghostId) void api.ghostResult(this.save.deviceId, out.ghostId, out.won);
    this.commit();
    this.afterProgress();
    d.leave();
    this.duel = null;
    this.battle = null;
    this.arena.setRunning(false);
    const name = d.opponentName;
    const mode = d.mode;
    setMusic('menu');
    const s = this.screens.result;
    s.innerHTML = '';
    const card = el('div', 'result-card frame');
    card.append(el('h2', out.won ? 'win' : 'lose', out.won ? 'VICTORY' : 'DEFEATED'));
    const why = out.reason === 'forfeit' ? 'The duel was forfeited.' : out.reason === 'disconnect' ? 'Connection lost.' : out.reason === 'timeout' ? 'Time ran out; the healthier wizard wins.' : out.won ? `${name} is defeated.` : `${name} was the better wizard today.`;
    card.append(el('div', 'sub', why));
    if (out.ratingDelta) card.append(el('div', 'reward', `${out.ratingDelta > 0 ? '+' : ''}${out.ratingDelta} rating · now ${out.rating}`));
    card.append(el('div', 'reward', `+${fmt(reward)} coins`), el('div', 'coins', fmt(this.save.coins)));
    card.append(btn('REMATCH', 'gold big', () => this.rematch(mode)));
    const row = el('div', 'menu-row');
    row.append(btn('Duels', 'blue', () => this.showDuelMenu()), btn('Menu', '', () => this.showMenu()));
    card.append(row);
    s.append(card);
    this.show('result');
  }

  private rematch(mode: DuelMode): void {
    if (mode === 'ranked' || mode === 'online') void this.startOnline(mode === 'ranked');
    else if (mode === 'ghost') void this.startGhost();
    else this.startDuel(new BotSession(this.save, 'normal'));
  }

  private stopLoop(): void {
    if (this.loopId) cancelAnimationFrame(this.loopId);
    this.loopId = 0;
  }

  private loop(now: number): void {
    this.loopId = requestAnimationFrame(t => this.loop(t));
    const b = this.battle, a = this.arena;
    if (!b || !a) return;
    if (this.paused) { this.lastT = now; return; }
    let dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    // The scripted duel slows the clock while the player learns to dodge, so it cannot be failed.
    if (this.ftueStep >= 0) dt *= this.ftueTimeScale;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.updateHud(0);
      this.drawPad();
      return;
    }
    if (this.duel) {
      const d = this.duel;
      d.tick(dt);
      // The battle view can be replaced once the server starts the match.
      if (this.battle !== d.view) { this.battle = d.view; this.armRecognizers(d.view.loadout); this.buildHud(d.view.enemyDef, d.view.loadout); this.hud.enemyLvl.textContent = d.mode.toUpperCase(); }
      const c = Math.ceil(d.countdown);
      if (c !== this.duelCountdownShown) { this.duelCountdownShown = c; if (c > 0) this.banner(String(c), d.status); else this.banner('DUEL!', `vs ${d.opponentName}`); }
      if (d.outcome && (d.view.overT > 1.8 || d.outcome.reason !== 'ko')) { this.endDuel(); return; }
    } else {
      // Step 0 is "learn the pad", so the opponent stands there and waits for it.
      if (this.ftueStep === 0 && this.scripted) this.scripted.enemy.castTimer = 5;
      b.tick(dt);
    }
    const events = b.drainEvents();
    a.handleEvents(events);
    this.handleEvents(events);
    a.update(dt, b);
    this.updateHud(dt);
    if (!this.duel && b.over && b.overT > 1.8) this.endBattle();
  }

  private buildHud(enemy: EnemyDef, loadout: SpellDef[]): void {
    const ov = this.arenaOverlay;
    ov.innerHTML = '';
    const top = el('div', 'hud-top');
    const nameRow = el('div', 'hud-name');
    const enemyName = el('span', '', this.training ? 'Training Dummy' : enemy.name);
    const enemyTag = el('span', 'tag', enemy.boss && !this.training ? 'BOSS' : '');
    const enemyLvl = el('span', 'lvl', this.training ? '' : `Lv ${enemy.level}`);
    nameRow.append(enemyName, enemyTag, enemyLvl);
    const eb = el('div', 'bar enemy'); const enemyShield = el('div', 'shield'); const enemyFill = el('div', 'fill'); const enemyTxt = el('div', 'txt');
    eb.append(enemyShield, enemyFill, enemyTxt);
    const enemyBuffs = el('div', 'buffs');
    const tools = el('div', 'hud-tools');
    top.append(nameRow, eb, tools, enemyBuffs);

    const bottom = el('div', 'hud-bottom');
    const buffs = el('div', 'buffs');
    const hb = el('div', 'bar hp'); const hpShield = el('div', 'shield'); const hpFill = el('div', 'fill'); const hpTxt = el('div', 'txt');
    hb.append(hpShield, hpFill, hpTxt);
    const mb = el('div', 'bar mana'); const manaFill = el('div', 'fill'); const manaTxt = el('div', 'txt');
    mb.append(manaFill, manaTxt);
    const sb = el('div', 'bar stamina'); const stamFill = el('div', 'fill'); const stamTxt = el('div', 'txt');
    sb.append(stamFill, stamTxt);
    bottom.append(buffs, hb, mb, sb);

    const trainStats = el('div', 'train-stats');
    const corner = el('div', 'hud-corner');
    tools.append(trainStats, corner);
    let sparBtn = btn('', 'small ghost');
    if (this.training) {
      sparBtn = btn('Dummy: passive', 'small ghost', () => {
        const b = this.battle as Battle | null; if (!b) return;
        b.sparring = !b.sparring;
        sparBtn.textContent = b.sparring ? 'Dummy: attacks' : 'Dummy: passive';
      });
      const refill = btn('Refill', 'small ghost', () => {
        const b = this.battle as Battle | null; if (!b) return;
        b.player.hp = b.player.maxHp; b.player.mana = b.player.maxMana;
        b.player.stamina = b.player.maxStamina;
        b.cooldowns = {};
      });
      const exit = btn('Exit', 'small', () => this.leaveTraining());
      corner.append(sparBtn, refill, exit);
    } else {
      corner.append(btn('Forfeit', 'small ghost', () => this.confirmForfeit()));
    }
    ov.append(top, bottom);

    // Controls.
    const c = this.controls;
    c.innerHTML = '';
    const strip = el('div', 'spell-strip');
    const chips = new Map<string, HTMLElement>();
    for (const s of loadout) {
      const chip = el('button', 'spell-chip');
      chip.append(glyphCanvas(s, 36), el('div', 'nm', s.name), el('div', 'cost', s.cost ? `${this.battle?.spellCost(s) ?? s.cost}` : 'free'));
      chip.addEventListener('click', () => { this.padHint = s; this.padHintT = 2.5; this.drawPad(); });
      chips.set(s.id, chip);
      strip.append(chip);
    }
    const row = el('div', 'pad-row');
    const left = el('button', 'dodge'); left.innerHTML = '◀<small>DODGE</small>';
    const right = el('button', 'dodge'); right.innerHTML = '▶<small>DODGE</small>';
    const dodgeBtns = [left, right];
    const bind = (b: HTMLButtonElement, dir: -1 | 1): void => {
      b.addEventListener('pointerdown', e => { e.preventDefault(); this.dodge(dir); b.classList.add('pressed'); });
      b.addEventListener('pointerup', () => b.classList.remove('pressed'));
      b.addEventListener('pointercancel', () => b.classList.remove('pressed'));
      b.addEventListener('pointerleave', () => b.classList.remove('pressed'));
    };
    bind(left, -1); bind(right, 1);
    const padWrap = el('div', 'pad-wrap');
    const pad = el('canvas', 'pad');
    const castMsg = el('div', 'cast-msg');
    // Hold to see the glyph. The duel does not pause, so remembering is still worth something.
    const peek = el('button', 'peek', 'PEEK');
    peek.title = 'Hold to see the glyph';
    const setPeek = (on: boolean) => (e: Event): void => {
      e.preventDefault();
      this.peeking = on;
      peek.classList.toggle('held', on);
      this.drawPad();
    };
    peek.addEventListener('pointerdown', setPeek(true));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) peek.addEventListener(ev, setPeek(false));
    padWrap.append(pad, castMsg, peek);
    const pair = el('div', 'dodge-pair');
    // Portrait: left | pad | right. Landscape: pad above a pair of buttons. Re-arranged on resize.
    this.arrangeControls = (): void => {
      const landscape = window.matchMedia('(min-aspect-ratio: 6/5)').matches;
      if (landscape) { pair.append(left, right); row.append(padWrap, pair); }
      else { pair.remove(); row.append(left, padWrap, right); }
    };
    this.arrangeControls();
    c.append(strip, row);
    this.hud = {
      enemyName, enemyTag, enemyLvl, enemyFill, enemyShield, enemyTxt, hpFill, hpShield, hpTxt, manaFill, manaTxt, stamFill, stamTxt, buffs, enemyBuffs,
      trainStats, sparBtn, chips, castMsg, pad, dodgeBtns,
    };
    this.setupPad(pad);
  }

  private dodge(dir: -1 | 1): void {
    if (!this.battle || this.paused) return;
    if (this.battle.dodge(dir)) {
      sfx.dodge(); this.save.stats.dodges++; if (this.save.settings.haptics) platform.haptic('light');
      if (this.ftueStep === 1) this.ftueEnter(2);
    }
  }

  private onKey(e: KeyboardEvent): void {
    const inBattle = this.screens.battle.classList.contains('active') && this.battle;
    if (e.key === 'Escape') {
      if (this.overlay.classList.contains('active')) { if (this.overlayDismiss) this.overlayDismiss(); return; }
      if (!this.screens.menu.classList.contains('active') && !this.screens.battle.classList.contains('active')) { this.showMenu(); return; }
      if (inBattle) { if (this.training) this.leaveTraining(); else this.confirmForfeit(); }
      return;
    }
    if (!inBattle) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.dodge(-1);
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.dodge(1);
  }

  private handleEvents(events: BattleEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'cast':
          if (ev.who === 'player' && ev.spell) {
            sfx.cast(0.8 + (ev.spell.cost / 65) * 0.6);
            this.save.stats.casts++; if (ev.spell.id === 'meteor') this.save.stats.metersCast++;
            this.save.practice[ev.spell.id] = (this.save.practice[ev.spell.id] ?? 0) + 1;
            const chip = this.hud.chips.get(ev.spell.id); if (chip) { chip.classList.add('flash'); setTimeout(() => chip.classList.remove('flash'), 220); }
          } else sfx.cast(0.6);
          break;
        case 'telegraph':
          if (this.ftueStep === 1 && this.battle) {
            const safe = [0, 1, 2].find(l => !ev.lanes.includes(l)) ?? 1;
            const side = safe < this.battle.player.lane ? 0 : 1;
            this.hud.dodgeBtns[side]?.classList.add('pulse');
          }
          sfx.telegraph(); if (ev.kind === 'heal') this.popup('Healing...', 'enemy', 'small', '#7dff9b'); if (ev.kind === 'shield') this.popup('Shielding', 'enemy', 'small', '#6ea8ff'); break;
        case 'damage':
          if (!ev.dot) {
            // Scaled by how much of a health bar just went: a Spark taps, a Worldbreaker lands.
            const share = ev.amount / Math.max(1, ev.who === 'enemy' ? this.battle?.enemy.maxHp ?? 1 : this.battle?.player.maxHp ?? 1);
            this.arena?.kick(0.25 + Math.min(0.75, share * 4));
            if (share > 0.08) this.hitStop = Math.min(0.11, 0.045 + share * 0.5);
          }
          if (ev.who === 'enemy') { if (!ev.dot) sfx.hitEnemy(); this.popup(`-${fmt(ev.amount)}`, 'enemy', ev.amount >= 60 ? 'big' : ev.dot ? 'small' : '', ev.dot ? ev.color : '#ffffff'); if (ev.absorbed) this.popup(`${fmt(ev.absorbed)} blocked`, 'enemy', 'small', '#6ea8ff'); }
          else { if (!ev.dot) { sfx.hitPlayer(); if (this.save.settings.haptics) platform.haptic('medium'); } this.popup(`-${fmt(ev.amount)}`, 'player', ev.dot ? 'small' : '', ev.dot ? ev.color : '#ff6a6a'); if (ev.absorbed) { sfx.shield(); this.popup(`${fmt(ev.absorbed)} blocked`, 'player', 'small', '#6ea8ff'); } }
          break;
        case 'heal': if (ev.who === 'player') sfx.heal(); this.popup(`+${fmt(ev.amount)}`, ev.who, '', '#7dff9b'); break;
        case 'shield': sfx.shield(); this.popup(`Shield ${fmt(ev.amount)}`, ev.who, 'small', '#6ea8ff'); break;
        case 'miss': sfx.miss(); this.popup('MISS', 'player', 'small', '#cfcfe8'); break;
        case 'phase': sfx.miss(); this.popup('PHASED', 'player', 'small', '#c4c4ff'); break;
        case 'reflect': sfx.shield(); this.popup('REFLECT!', 'player', '', '#e6f2ff'); break;
        case 'buff': this.popup(ev.name, ev.who, 'small', ev.color); break;
        case 'freeze': sfx.freeze(); this.popup('FROZEN', 'enemy', '', '#b8f4ff'); break;
        case 'interrupt': this.popup('INTERRUPTED', 'enemy', 'small', '#ffffff'); break;
        case 'revive': sfx.revive(); this.banner('REVIVED', 'The phoenix feather burns'); break;
        case 'death':
          // The longest freeze in the game, on the only moment that ends a fight.
          this.hitStop = 0.16;
          this.arena?.kick(1); if (ev.who === 'enemy') { sfx.win(); this.banner('VICTORY', ''); } else { sfx.lose(); this.banner('DEFEATED', ''); } break;
        case 'fizzle': this.castMessage(ev.reason === 'mana' ? 'Not enough mana' : ev.reason === 'stamina' ? 'Out of breath!' : 'On cooldown', true); sfx.fizzle(); break;
        default: break;
      }
    }
  }

  private popup(text: string, who: 'player' | 'enemy', cls: string, color: string): void {
    if (!this.arena) return;
    const p = this.arena.project(who === 'player' ? this.arena.playerAnchor() : this.arena.enemyAnchor());
    const d = el('div', `popup ${cls}`.trim(), text);
    d.style.left = `${p.x + (Math.random() - 0.5) * 70}px`;
    d.style.top = `${p.y + (Math.random() - 0.5) * 30}px`;
    d.style.color = color;
    this.arenaOverlay.append(d);
    setTimeout(() => d.remove(), 950);
  }

  private banner(text: string, sub: string): void {
    const b = el('div', 'banner');
    b.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    this.arenaOverlay.append(b);
    setTimeout(() => b.remove(), 1900);
  }

  private castMessage(text: string, bad: boolean): void {
    const m = this.hud.castMsg;
    m.textContent = text;
    m.classList.toggle('bad', bad);
    m.classList.add('show');
    this.castMsgT = 1.1;
  }

  private updateHud(dt: number): void {
    const b = this.battle; if (!b) return;
    const h = this.hud;
    const p = b.player, e = b.enemy;
    const setBar = (fill: HTMLElement, v: number, max: number): void => { fill.style.transform = `scaleX(${Math.max(0, Math.min(1, v / max))})`; };
    setBar(h.enemyFill, e.hp, e.maxHp);
    setBar(h.enemyShield, Math.min(e.maxHp, e.hp + e.shield), e.maxHp);
    h.enemyTxt.textContent = this.training ? `${fmt(e.hp)}` : `${fmt(Math.max(0, e.hp))} / ${fmt(e.maxHp)}`;
    setBar(h.hpFill, p.hp, p.maxHp);
    setBar(h.hpShield, Math.min(p.maxHp, p.hp + p.shield), p.maxHp);
    h.hpTxt.textContent = `${fmt(Math.max(0, p.hp))} / ${fmt(p.maxHp)}${p.shield > 0 ? `  +${fmt(p.shield)}` : ''}`;
    setBar(h.manaFill, p.mana, p.maxMana);
    h.manaTxt.textContent = `${Math.floor(p.mana)} / ${p.maxMana}`;
    setBar(h.stamFill, p.stamina, p.maxStamina);
    h.stamTxt.textContent = `${Math.floor(p.stamina)} / ${p.maxStamina}`;
    const tired = p.stamina < b.stats.dodgeCost;
    for (const d of h.dodgeBtns) d.classList.toggle('tired', tired);

    const buffs: [string, string][] = [];
    if (p.shield > 0) buffs.push([`Shield ${fmt(p.shield)}`, '#6ea8ff']);
    if (p.reflectT > 0) buffs.push([`Mirror ${p.reflectT.toFixed(1)}s`, '#e6f2ff']);
    if (p.phaseCharges > 0) buffs.push([`Phase x${p.phaseCharges}`, '#c4c4ff']);
    if (p.hot) buffs.push([`Regen ${p.hot.t.toFixed(1)}s`, '#9dffc2']);
    if (p.dots.length) buffs.push(['Cursed', '#7dff7d']);
    this.renderBuffs(h.buffs, buffs);
    const eb: [string, string][] = [];
    if (e.shield > 0) eb.push([`Shield ${fmt(e.shield)}`, '#6ea8ff']);
    if (e.freezeT > 0) eb.push([`Frozen ${e.freezeT.toFixed(1)}s`, '#b8f4ff']);
    else if (e.slow) eb.push([`Slowed ${e.slow.t.toFixed(1)}s`, '#7fe3ff']);
    if (e.dots.length) eb.push([e.dots.some(d => d.perSec > 10) ? 'Burning' : 'Poisoned', e.dots[0].color]);
    this.renderBuffs(h.enemyBuffs, eb);

    for (const s of b.loadout) {
      const chip = h.chips.get(s.id); if (!chip) continue;
      const cd = b.cooldowns[s.id] ?? 0;
      chip.classList.toggle('poor', p.mana < b.spellCost(s));
      chip.classList.toggle('cd', cd > 0);
      if (cd > 0) chip.dataset.cd = cd.toFixed(0);
    }

    if (this.training) {
      this.lastDps.t += dt;
      if (this.lastDps.t >= 1) { this.lastDps.dps = (b.damageDealt - this.lastDps.dmg) / this.lastDps.t; this.lastDps.dmg = b.damageDealt; this.lastDps.t = 0; }
      h.trainStats.textContent = `Dealt ${fmt(b.damageDealt)}  |  DPS ${fmt(this.lastDps.dps)}  |  Casts ${b.casts}`;
    }

    if (this.castMsgT > 0) { this.castMsgT -= dt; if (this.castMsgT <= 0) h.castMsg.classList.remove('show'); }
    if (this.padFlash > 0 || this.padHintT > 0 || this.padDrawing || this.padAnimating) {
      this.padFlash = Math.max(0, this.padFlash - dt);
      this.padHintT = Math.max(0, this.padHintT - dt);
      if (this.padHintT <= 0) this.padHint = null;
      this.padAnimating = false;
      this.drawPad();
    }
  }

  private renderBuffs(container: HTMLElement, list: [string, string][]): void {
    const key = list.map(b => b[0]).join('|');
    if (container.dataset.key === key) return;
    container.dataset.key = key;
    container.innerHTML = '';
    for (const [t, c] of list) { const d = el('span', 'buff', t); d.style.color = c; container.append(d); }
  }

  // ---------------------------------------------------------------- draw pad
  private setupPad(pad: HTMLCanvasElement): void {
    const fit = (): void => {
      const r = pad.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (pad.width !== w || pad.height !== h) { pad.width = w; pad.height = h; this.drawPad(); }
    };
    new ResizeObserver(fit).observe(pad);
    fit();
    const pos = (e: PointerEvent): Point => { const r = pad.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    pad.addEventListener('pointerdown', e => {
      if (!this.battle || this.battle.over || this.paused) return;
      e.preventDefault();
      try { pad.setPointerCapture(e.pointerId); } catch { /* synthetic events have no active pointer */ }
      this.padDrawing = true;
      this.padPoints = [pos(e)];
      pad.classList.remove('ok', 'bad');
      this.drawPad();
    });
    pad.addEventListener('pointermove', e => {
      if (!this.padDrawing) return;
      this.padPoints.push(pos(e));
    });
    const finish = (): void => {
      if (!this.padDrawing) return;
      this.padDrawing = false;
      this.finishStroke();
    };
    pad.addEventListener('pointerup', finish);
    pad.addEventListener('pointercancel', finish);
    this.drawPad();
  }

  /**
   * Arms the three pools. Every template goes in one direction only: that is what makes the
   * arrows on a spell icon a requirement rather than decoration, and what lets one shape carry
   * two different spells. The mirror pool exists so a backwards stroke gets a useful message
   * instead of a shrug.
   */
  private armRecognizers(loadout: SpellDef[]): void {
    this.recognizer.clear();
    this.mirrorRec.clear();
    for (const s of loadout) {
      this.recognizer.add(s.id, spellStroke(s));
      this.mirrorRec.add(s.id, [...spellStroke(s)].reverse());
    }
    this.discoveryRec.clear();
    const equipped = new Set(loadout.map(s => s.id));
    for (const s of discoverable(attunement(this.save), this.save.discovered)) {
      if (!equipped.has(s.id)) this.discoveryRec.add(s.id, spellStroke(s));
    }
  }

  /** Appends a chip for a spell learned mid-battle, without rebuilding (and wiping) the HUD. */
  private addSpellChip(spell: SpellDef): void {
    const strip = this.controls.querySelector('.spell-strip');
    if (!strip || this.hud.chips.has(spell.id)) return;
    const chip = el('button', 'spell-chip fresh');
    chip.append(glyphCanvas(spell, 36), el('div', 'nm', spell.name), el('div', 'cost', spell.cost ? `${this.battle?.spellCost(spell) ?? spell.cost}` : 'free'));
    chip.addEventListener('click', () => { this.padHint = spell; this.padHintT = 2.5; this.drawPad(); });
    this.hud.chips.set(spell.id, chip);
    strip.append(chip);
    chip.scrollIntoView({ inline: 'end', block: 'nearest' });
  }

  /** A spell has been drawn for the first time. This is the moment the whole system exists for. */
  private discover(spell: SpellDef): void {
    if (this.save.discovered.includes(spell.id)) return;
    this.save.discovered.push(spell.id);
    const stats = computeStats(this.save);
    if (!this.save.loadout.includes(spell.id) && this.save.loadout.length < stats.slots) this.save.loadout.push(spell.id);
    this.save.unseen.push(spell.id);
    analytics.track('spell_discovered', { spell: spell.id, level: this.battleLevel, secret: !!spell.secret });
    this.commit();
    this.afterProgress();
    if (this.save.settings.haptics) platform.haptic('success');
    sfx.win();
    this.arena?.flashDiscovery(ELEMENT_BY_ID[spell.element].color);
    const card = this.showDiscovery(spell);
    // Tell the world, and say where they came in. The server decides the rank, not the client.
    void api.postDiscovery(this.save.deviceId, this.save.name, spell.id).then(r => {
      if (!r || !card.isConnected) return;
      const line = r.rank === 1 ? 'You are the FIRST wizard in the world to draw this'
        : r.rank > 0 && r.rank <= 100 ? `The ${ordinal(r.rank)} wizard in the world to draw this`
        : r.first ? `${sharePercent(r.holders, r.players)} of wizards know it · first found by ${r.first}`
        : null;
      if (line) {
        const rank = el('div', 'discovery-rank', line);
        rank.style.color = ELEMENT_BY_ID[spell.element].color;
        card.insertBefore(rank, card.querySelector('.btn'));
      }
    });
  }

  /**
   * The in-game notification for a new spell: a card that slides over the arena for a few seconds
   * without pausing the fight, so the moment lands but the duel carries on.
   */
  private showDiscovery(spell: SpellDef): HTMLElement {
    const elDef = ELEMENT_BY_ID[spell.element];
    const card = el('div', 'discovery frame');
    card.style.borderColor = elDef.color;
    const header = el('div', 'discovery-head', 'NEW SPELL DISCOVERED');
    header.style.color = elDef.color;
    const row = el('div', 'discovery-row');
    row.append(glyphCanvas(spell, 56));
    const info = el('div', 'discovery-info');
    info.append(el('div', 'discovery-name', spell.name));
    const sub = el('div', 'discovery-sub', `${TIER_NAMES[spell.tier]} · ${elDef.name} · ${spell.kind}`);
    sub.style.color = elDef.color;
    info.append(sub, el('div', 'discovery-desc', spell.desc));
    row.append(info);
    card.append(header, row, el('div', 'discovery-foot', 'Added to your spellbook'));
    card.append(btn('SHARE', 'gold small', () => this.shareSpell(spell)));
    this.arenaOverlay.append(card);
    // Longer than the old four seconds: there is a rank line and a share button to read now.
    setTimeout(() => card.classList.add('out'), 6200);
    setTimeout(() => card.remove(), 6800);
    return card;
  }

  /**
   * The share card, which is the cheapest user acquisition this game will ever get. The glyph is
   * deliberately not described: the whole point is that the reader has to ask what the shape is.
   */
  private shareSpell(spell: SpellDef): void {
    const rare = this.board?.spells[spell.id];
    const rarity = rare && this.board ? ` Only ${sharePercent(rare.holders, this.board.players)} of wizards know it.` : '';
    const secret = spell.secret ? ' It is not in the codex at all.' : '';
    void platform.share(`I found ${spell.name} in Wizard 1v1s — a ${TIER_NAMES[spell.tier]} ${ELEMENT_BY_ID[spell.element].name} spell.${secret}${rarity} Can you work out the sign? ${CONFIG.storeUrl}`);
  }

  /** Pulls the rarity board once per spellbook visit; the UI works fine without it. */
  private async loadBoard(): Promise<void> {
    const b = await api.discoveries();
    if (!b) return;
    this.board = b;
    if (this.screens.spellbook.classList.contains('active')) this.showSpellbook(this.spellbookTab);
  }

  private finishStroke(): void {
    const b = this.battle; if (!b) return;
    const pad = this.hud.pad;
    const rectEarly = pad.getBoundingClientRect();
    const coverageNow = strokeExtent(this.padPoints) / Math.max(1, Math.min(rectEarly.width, rectEarly.height));
    const m = this.recognizer.recognize(this.padPoints);

    // Unknown spells are checked first: a confident, large stroke that beats every equipped glyph
    // is how a spell reveals itself. The bar rises with the spell's tier.
    const dm = this.discoveryRec.recognize(this.padPoints);
    if (dm) {
      const found = SPELL_BY_ID[dm.key];
      const clear = dm.score >= discoveryThreshold(found.tier);
      const beatsKnown = !m || dm.score > m.score + DISCOVERY_MARGIN;
      const bigEnough = coverageNow >= this.coverageFor(found);
      if (clear && beatsKnown && bigEnough) {
        this.padFlash = 0.45;
        pad.classList.add('ok');
        this.discover(found);
        // Bring it into this battle straight away when the loadout has room, then re-arm so the
        // spell stops counting as undiscovered.
        if (this.save.loadout.includes(found.id) && !b.loadout.some(s => s.id === found.id)) {
          b.loadout.push(found);
          this.addSpellChip(found);
        }
        this.armRecognizers(b.loadout);
        if (b.loadout.some(s => s.id === found.id)) b.cast(found.id);
        else this.castMessage(`${found.name} is in your grimoire`, false);
        return;
      }
    }

    this.padFlash = 0.45;
    if (!m || m.score < this.recogniseFloor()) {
      pad.classList.add('bad');
      // The commonest near miss is now the right shape drawn the wrong way round, so name it
      // and put the arrows back on the pad instead of leaving the player guessing.
      const back = this.mirrorRec.recognize(this.padPoints);
      if (back && back.score >= RECOGNIZE_THRESHOLD + 0.06) {
        const wrongWay = SPELL_BY_ID[back.key];
        this.castMessage(`${wrongWay.name} runs the other way!`, true);
        this.padHint = wrongWay; this.padHintT = 2.2;
      } else this.castMessage(m ? `Unclear... ${SPELL_BY_ID[m.key]?.name ?? ''}?` : 'Draw bigger', true);
      sfx.fizzle();
      return;
    }
    const spell = SPELL_BY_ID[m.key];
    // Stronger spells need a clearer and larger stroke, so a tiny scribble cannot spam them.
    if (m.score < this.clarityFor(spell)) {
      pad.classList.add('bad');
      this.castMessage(`Draw ${spell.name} more clearly`, true);
      sfx.fizzle();
      return;
    }
    const rect = pad.getBoundingClientRect();
    const coverage = strokeExtent(this.padPoints) / Math.max(1, Math.min(rect.width, rect.height));
    if (coverage < this.coverageFor(spell)) {
      pad.classList.add('bad');
      this.castMessage(`Draw ${spell.name} bigger!`, true);
      this.padHint = spell; this.padHintT = 1.6;
      sfx.fizzle();
      return;
    }
    const r = b.cast(spell.id);
    if (r === 'ok' && this.ftueStep === 0) this.ftueEnter(1);
    if (r === 'ok') {
      pad.classList.add('ok');
      this.castMessage(`${spell.name}!`, false);
      this.snapStrokeTo(spell);
    }
    else pad.classList.add('bad');
  }

  /** The least practised spell in the loadout, or nothing once they are all familiar. */
  private guideSpell(): SpellDef | null {
    const b = this.battle;
    if (!b) return null;
    let best: SpellDef | null = null;
    let fewest = WHEELS_GONE;
    for (const s of b.loadout) {
      // Never offer a glyph they cannot pay for: tracing it would fizzle, which teaches the
      // opposite of what the guide is for.
      if (b.player.mana < b.spellCost(s)) continue;
      const n = this.save.practice[s.id] ?? 0;
      if (n < fewest) { best = s; fewest = n; }
    }
    return best;
  }

  /** The size this stroke really has to be right now, easing off over the first ten levels. */
  private coverageFor(spell: SpellDef): number {
    return requiredCoverage(spell) * (1 - 0.35 * leniency(this.save.best));
  }

  /** The score below which a stroke is not a spell at all, eased for the first ten levels. */
  private recogniseFloor(): number {
    return RECOGNIZE_THRESHOLD - 0.06 * leniency(this.save.best);
  }

  /** The score this particular spell demands, which is the floor plus a surcharge for power. */
  private clarityFor(spell: SpellDef): number {
    return this.recogniseFloor() + 0.1 * (spell.cost / 65) * (1 - leniency(this.save.best));
  }

  /**
   * Replaces the wobbly line the player drew with the shape the recogniser matched, so the fade-out
   * shows the glyph they meant rather than the one their thumb managed. It is the only moment in
   * the game that says "yes, that" about the thing the whole game is made of.
   */
  private snapStrokeTo(spell: SpellDef): void {
    const pad = this.hud.pad;
    const rect = pad.getBoundingClientRect();
    if (!rect.width) return;
    const size = Math.min(rect.width, rect.height) * this.coverageFor(spell) / 0.86;
    const ox = (rect.width - size) / 2, oy = (rect.height - size) / 2;
    this.padPoints = strokeOf(spell).map(p => ({ x: ox + (p.x / 100) * size, y: oy + (p.y / 100) * size }));
  }

  private drawPad(): void {
    const pad = this.hud?.pad; if (!pad) return;
    const g = pad.getContext('2d'); if (!g) return;
    const w = pad.width, h = pad.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    g.clearRect(0, 0, w, h);
    // Rune circle backdrop.
    g.save();
    g.strokeStyle = 'rgba(140,120,255,0.12)'; g.lineWidth = 2 * dpr;
    g.beginPath(); g.arc(w / 2, h / 2, Math.min(w, h) * 0.42, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, Math.min(w, h) * 0.3, 0, Math.PI * 2); g.stroke();
    g.restore();
    // What to trace: the chip the player tapped, otherwise the spell they have practised least.
    const asked = !!this.padHint && (this.padHintT > 0 || this.peeking);
    const guide = asked ? this.padHint : this.guideSpell();
    const alpha = !guide ? 0
      : this.peeking ? 0.85
      : asked ? 0.35 + Math.min(1, this.padHintT) * 0.3
      : wheelsAlpha(this.save.practice[guide.id] ?? 0) * 0.32;
    if (guide && alpha > 0.02) {
      // Ghost glyph drawn at the size the spell actually requires (templates fill ~86% of their box).
      const size = (Math.min(w, h) * this.coverageFor(guide)) / 0.86;
      const ox = (w - size) / 2, oy = (h - size) / 2;
      g.save(); g.globalAlpha = alpha;
      drawGlyph(g, guide.glyph, ox, oy, size, guide.color, 4 * dpr, guide.reverse);
      // A light running the path the way the stroke has to go. Arrows say which way; a moving
      // light says it without being read, and it shows where the stroke starts each time round.
      const t = (performance.now() % 1600) / 1600;
      const head = pointAlong(strokeOf(guide), t);
      g.globalAlpha = Math.min(1, alpha * 2.2);
      g.fillStyle = guide.color;
      g.shadowColor = guide.color;
      g.shadowBlur = 10 * dpr;
      g.beginPath();
      g.arc(ox + (head.x / 100) * size, oy + (head.y / 100) * size, 5 * dpr, 0, Math.PI * 2);
      g.fill();
      g.restore();
      this.padAnimating = true;
    } else if (!this.padDrawing && this.padPoints.length === 0) {
      g.save(); g.fillStyle = 'rgba(200,190,255,0.35)'; g.font = `${18 * dpr}px "Jersey 10", sans-serif`; g.textAlign = 'center';
      g.fillText('DRAW A GLYPH', w / 2, h / 2 + 6 * dpr); g.restore();
    }
    const pts = this.padPoints;
    if (pts.length > 1) {
      const alpha = this.padDrawing ? 1 : Math.min(1, this.padFlash / 0.45);
      g.save();
      g.globalAlpha = alpha;
      g.lineCap = 'round'; g.lineJoin = 'round';
      const color = pad.classList.contains('ok') ? '#7dff9b' : pad.classList.contains('bad') ? '#ff5a5a' : '#ffd166';
      g.shadowColor = color; g.shadowBlur = 14 * dpr;
      g.strokeStyle = color; g.lineWidth = 5 * dpr;
      g.beginPath();
      pts.forEach((p, i) => { if (i === 0) g.moveTo(p.x * dpr, p.y * dpr); else g.lineTo(p.x * dpr, p.y * dpr); });
      g.stroke();
      g.restore();
      if (!this.padDrawing && this.padFlash <= 0) this.padPoints = [];
    }
  }

  // ---------------------------------------------------------------- battle end
  private endBattle(): void {
    const b = this.battle; if (!b || !this.arena) return;
    this.stopLoop();
    const outcome = b.over ?? 'lose';
    const enemy = b.enemyDef;
    const stats = b.stats;
    const level = this.battleLevel;
    const replay = level <= this.save.best;
    const challenge = this.challenge;
    let reward = Math.round(enemy.coins * stats.coinMult * (outcome === 'win' ? (replay ? 0.6 : 1) : 0.25));
    if (challenge && outcome === 'win') reward = Math.round(enemy.coins * stats.coinMult * challenge.rewardMult);
    if (this.save.passes.doubleCoins) reward *= 2;
    if (this.training) reward = 0;
    this.save.coins += reward;
    this.save.earned += reward;
    // Equipment only comes from here and from chests, so a win is always worth playing out.
    let drop: GrantResult | null = null;
    if (outcome === 'win' && !this.training) {
      // The scripted duel always drops a Fine piece. A guaranteed reward that turns out to be a
      // duplicate of the starter kit reads as 'you got nothing', which is the wrong first lesson,
      // and Fine is the lowest rarity that can channel an element.
      const item = this.ftueStep >= 0
        ? rollItem({ level, boss: false, owned: this.save.elements, minRarity: 2 })
        : rollLevelDrop(level, enemy.boss, level > this.save.best, this.save.elements);
      if (item) drop = grantItem(this.save, item);
    }
    analytics.track('battle_end', {
      level, outcome, seconds: Math.round((performance.now() - this.battleStartedAt) / 1000),
      hpLeft: Math.max(0, Math.round(b.player.hp)),
      casts: b.casts, ftue: this.ftueStep >= 0,
    });
    if (outcome === 'win' && !this.training && level <= this.save.best) {
      // A replay still moves the season on, just less than a first clear.
      this.seasonGained += addSeasonXp(this.save, Math.round(battleXp(level, enemy.boss, false) * 0.5));
    }
    if (outcome === 'win') {
      this.save.wins++;
      if (enemy.boss) this.save.stats.bossWins++;
      if (challenge) markChallengeDone(this.save);
      if (level > this.save.best && !challenge) {
        const first = this.save.best === 0;
        this.save.best = level;
        analytics.track('level_cleared', { level });
        this.seasonGained += addSeasonXp(this.save, battleXp(level, enemy.boss, true));
        void api.postScore(this.save.deviceId, this.save.name, level, this.save.title);
        // Asked on the second clear, once the scripted duel and its cards are out of the way.
        if (!first && this.save.best === 2) this.maybeScheduleReminder();
        // One starter spell per level for the first three, each introduced on its own card.
        const gift = FTUE_GIFTS[this.save.best];
        if (gift && this.save.discovered.includes(gift) && !this.save.loadout.includes(gift)
          && this.save.loadout.length < computeStats(this.save).slots) {
          this.save.loadout.push(gift);
          this.pendingGift = SPELL_BY_ID[gift];
        }
      }
      if (!challenge) { this.save.level = Math.min(MAX_LEVEL, Math.max(this.save.level, level + 1)); this.pickedLevel = Math.min(MAX_LEVEL, level + 1); }
      if (this.save.settings.haptics) platform.haptic('success');
    } else {
      this.save.losses++;
      this.pickedLevel = level;
      if (this.save.settings.haptics) platform.haptic('error');
    }
    if (this.ftueStep >= 0) {
      this.save.ftue = Math.max(this.save.ftue, FTUE_BATTLE_DONE);
      analytics.track('ftue_done', { outcome });
      this.clearFtue();
    }
    this.challenge = null;
    this.commit();
    this.afterProgress();
    this.battle = null;
    this.arena.setRunning(false);
    this.showResult(outcome, reward, level, enemy, drop);
    // Ask for a store review once, after the third boss falls: the player is invested by then.
    if (outcome === 'win' && enemy.boss && this.save.stats.bossWins === 3 && !this.save.reviewAsked && platform.native) {
      this.save.reviewAsked = true; this.commit();
      setTimeout(() => this.openOverlay((box, close) => {
        box.append(el('h2', '', 'ENJOYING IT?'), el('div', 'note', 'A quick rating helps other wizards find the game.'));
        const row = el('div', 'menu-row');
        row.append(btn('Rate it', 'gold', () => { close(); void platform.requestReview(); }), btn('Not now', 'ghost', close));
        box.append(row);
      }), 800);
    }
  }

  private showResult(outcome: 'win' | 'lose', reward: number, level: number, enemy: EnemyDef, drop: GrantResult | null = null): void {
    setMusic('menu');
    const s = this.screens.result;
    s.innerHTML = '';
    const card = el('div', 'result-card frame');
    const h2 = el('h2', outcome, outcome === 'win' ? 'VICTORY' : 'DEFEATED');
    const sub = el('div', 'sub', outcome === 'win'
      ? (level >= MAX_LEVEL ? `You defeated ${enemy.name}. The tower is yours!` : `${enemy.name} falls. Level ${level} cleared.`)
      : `${enemy.name} was too strong this time.`);
    const rew = el('div', 'reward', `+${fmt(reward)} coins`);
    const coins = el('div', 'coins', fmt(this.save.coins));
    card.append(h2, sub, rew, coins);
    // The campaign level is the account level, so a first clear is a level-up worth announcing.
    if (outcome === 'win' && level === this.save.best) card.append(el('div', 'levelup', `WIZARD LEVEL ${wizardLevel(this.save.best)}`));
    if (outcome === 'win') {
      const gained = this.seasonGained;
      this.seasonGained = 0;
      card.append(this.seasonBar(gained));
    }
    if (drop) {
      // Held for a beat and then revealed, with the rarity colour arriving as a burst. The random
      // reward was always here; it was the presentation that made it read as a line of text.
      const elDef = ELEMENT_BY_ID[drop.item.element];
      const slot = el('div', 'drop-slot');
      slot.style.setProperty('--rarity', RARITY_COLORS[drop.item.rarity]);
      slot.append(el('div', 'drop-sealed', '?'));
      card.append(slot);
      setTimeout(() => {
        slot.innerHTML = '';
        slot.classList.add('revealed');
        const loot = el('div', 'row-card loot');
        loot.style.borderColor = RARITY_COLORS[drop.item.rarity];
        loot.append(gearIcon(drop.item.slot, drop.item.rarity, 44, elDef.color));
        const info = el('div', 'info');
        info.append(el('div', 'name', drop.item.name), el('div', 'kind', `${RARITY_NAMES[drop.item.rarity]} · ${elDef.name}`));
        info.append(el('div', 'desc', drop.isNew ? (drop.upgrade ? 'New, and equipped' : 'New') : `Duplicate, melted for ${fmt(drop.coins)} coins`));
        loot.append(info);
        slot.append(el('div', 'burst'), loot);
        if (drop.item.rarity >= 4) { sfx.win(); if (this.save.settings.haptics) platform.haptic('heavy'); }
        else sfx.buy();
      }, 700);
    }
    if (outcome === 'win' && level < MAX_LEVEL) card.append(btn(`NEXT: LEVEL ${level + 1}`, 'gold big', () => this.startBattle(level + 1, false)));
    if (outcome === 'lose') card.append(btn('RETRY', 'gold big', () => this.startBattle(level, false)));
    const row = el('div', 'menu-row');
    row.append(btn('Shop', 'green', () => this.showShop('elements')), btn('Menu', '', () => this.showMenu()));
    card.append(row);
    s.append(card);
    this.show('result');

    // The spell handed over for clearing this level, then the pitch for the whole game.
    const gift = this.pendingGift;
    this.pendingGift = null;
    if (gift) {
      setTimeout(() => this.openOverlay((box, close) => {
        box.append(el('h2', '', 'NEW SPELL'));
        const row = el('div', 'discovery-row');
        const info = el('div', 'discovery-info');
        info.append(el('div', 'discovery-name', gift.name), el('div', 'discovery-desc', gift.desc));
        row.append(glyphCanvas(gift, 64), info);
        box.append(row, el('div', 'note', 'Equipped, and in your spellbook. Draw it the way the arrows point.'),
          btn('GOT IT', 'gold big', close));
      }), 650);
    } else if (outcome === 'win' && this.save.best >= 3 && this.save.ftue < FTUE_ALL_DONE) {
      this.save.ftue = FTUE_ALL_DONE;
      this.commit();
      setTimeout(() => this.openOverlay((box, close) => {
        box.append(el('h2', '', 'THE CODEX'),
          el('div', 'note', `There are ${LISTED_SPELLS} spells in the codex. You know ${this.save.discovered.length}.`),
          el('div', 'note gold-note', 'Some are not in the codex at all.'),
          el('div', 'note', 'Every spell is a shape. Wear an element\u2019s gear and its deeper spells become findable \u2014 draw one in battle and it is yours.'),
          btn('OPEN THE CODEX', 'gold big', () => { close(); this.showSpellbook('codex'); }),
          btn('Later', 'ghost', close));
      }), 650);
    }
  }

  /** A thin season bar with whatever tiers this fight just earned. */
  private seasonBar(gainedTiers = 0): HTMLElement {
    ensureSeason(this.save);
    const tier = tierFor(this.save.season.xp);
    const into = tier >= SEASON_TIER_COUNT ? TIER_XP : this.save.season.xp % TIER_XP;
    const row = el('div', 'season-bar');
    const label = el('div', 'season-label', gainedTiers > 0
      ? `SEASON TIER ${tier} · +${gainedTiers} tier${gainedTiers === 1 ? '' : 's'}`
      : `SEASON TIER ${tier} of ${SEASON_TIER_COUNT}`);
    const track = el('div', 'season-track');
    const fill = el('div', 'fill');
    fill.style.width = `${Math.round((into / TIER_XP) * 100)}%`;
    track.append(fill);
    row.append(label, track);
    if (gainedTiers > 0) row.classList.add('gained');
    return row;
  }

  /** The pass itself: a ladder of forty tiers, both tracks visible, only one of them yours. */
  showSeason(): void {
    this.stopLoop();
    setMusic('menu');
    ensureSeason(this.save);
    const def = seasonFor();
    const s = this.screens.season;
    s.innerHTML = '';
    const head = el('div', 'shop-head');
    head.append(btn('◀', 'small ghost', () => this.showMarket()), el('h1', '', 'SEASON'), el('div', 'coins', fmt(this.save.coins)));

    const body = el('div', 'shop-body');
    const tier = tierFor(this.save.season.xp);
    const intro = el('div', 'card season-intro');
    intro.append(this.cardHead('hourglass', '#ffcc33', `Season of ${def.name}`,
      `Day ${def.day} of ${SEASON_DAYS}. Tier ${tier} of ${SEASON_TIER_COUNT}. Play anything to climb: levels, quests and duels all count.`));
    intro.append(this.seasonBar());
    if (!this.save.season.premium) {
      const buy = btn(`UNLOCK PREMIUM · ${platform.price(CONFIG.skus.seasonPass) ?? '£4.99'}`, 'gold', async () => {
        buy.disabled = true;
        analytics.track('purchase_attempt', { sku: CONFIG.skus.seasonPass });
        const r = platform.purchasesAvailable() ? await platform.purchase(CONFIG.skus.seasonPass) : await this.showFakePurchase(CONFIG.skus.seasonPass).then(ok => ({ ok, sku: CONFIG.skus.seasonPass, message: '' }));
        if (r.ok) { this.grantPurchase(CONFIG.skus.seasonPass); sfx.buy(); this.toast('Season pass unlocked', 'Every premium reward you have already passed is yours'); }
        this.showSeason();
      });
      intro.append(el('div', 'note', 'The premium track pays on every tier, including the ones you have already climbed past.'), buy);
    } else intro.append(el('div', 'note gold-note', 'Premium track unlocked.'));
    body.append(intro);

    const claimable = unclaimedTiers(this.save);
    if (claimable.length) {
      body.append(btn(`CLAIM ${claimable.length} TIER${claimable.length === 1 ? '' : 'S'}`, 'gold big', () => this.claimSeasonNow()));
    }

    const ladderHead = el('div', 'season-tier ladder-head');
    ladderHead.append(el('div', 'tier-no', ''));
    const heads = el('div', 'tier-tracks');
    const freeHead = el('div', 'tier-reward head');
    freeHead.append(uiIcon('coin', 20, '#ffcc33'), el('span', '', 'FREE'));
    const premHead = el('div', `tier-reward premium head ${this.save.season.premium ? '' : 'locked'}`);
    premHead.append(uiIcon('gem', 20, '#ff4fd8'), el('span', '', 'PREMIUM'));
    heads.append(freeHead, premHead);
    ladderHead.append(heads);
    body.append(ladderHead);

    for (let t = 1; t <= SEASON_TIER_COUNT; t++) {
      const reached = t <= tier, taken = this.save.season.claimed.includes(t);
      const row = el('div', `season-tier ${reached ? 'reached' : ''} ${taken ? 'taken' : ''}`);
      row.append(el('div', 'tier-no', String(t)));
      const tracks = el('div', 'tier-tracks');
      for (const r of rewardsFor(t)) {
        const locked = r.premium && !this.save.season.premium;
        const chip = el('div', `tier-reward ${r.premium ? 'premium' : ''} ${locked ? 'locked' : ''}`);
        chip.append(rewardIcon(r.kind, 22), el('span', '', r.kind === 'coins' ? `${fmt(Number(r.value))}`
          : r.kind === 'chest' ? chestById(String(r.value)).name.replace(' Chest', '')
          : `"${r.value}"`));
        tracks.append(chip);
      }
      row.append(tracks);
      body.append(row);
    }
    s.append(head, body);
    this.show('season');
  }

  private claimSeasonNow(): void {
    const owed = unclaimedTiers(this.save);
    if (!owed.length) return;
    const got = claimSeason(this.save);
    const loot: GrantResult[] = [];
    for (const id of got.chests) for (const it of openChest(chestById(id), this.save.elements)) loot.push(grantItem(this.save, it));
    this.save.stats.chests += got.chests.length;
    analytics.track('quest_claimed', { season: this.save.season.id, tiers: got.tiers.length });
    this.commit();
    this.afterProgress();
    this.showSeason();
    if (got.titles.length) this.toast(`Title earned: "${got.titles[got.titles.length - 1]}"`, 'Worn now; change it in Settings');
    if (loot.length) this.showLoot(loot, 'Season rewards');
    else if (got.coins) this.toast(`+${fmt(got.coins)} coins`, `${got.tiers.length} tier${got.tiers.length === 1 ? '' : 's'} claimed`);
  }

  private leaveTraining(): void {
    this.stopLoop();
    this.battle = null;
    this.arena?.setRunning(false);
    this.showMenu();
  }

  private overlayDismiss: (() => void) | null = null;

  private confirmForfeit(): void {
    this.openOverlay((box, close) => {
      box.append(el('h2', '', 'Forfeit?'), el('div', 'note', 'You keep nothing from this battle.'));
      const row = el('div', 'menu-row');
      row.append(btn('Keep fighting', 'gold', close), btn('Forfeit', 'ghost', () => {
        close();
        if (this.duel) { this.duel.leave(); this.endDuel(); return; }
        const b = this.battle as Battle | null;
        if (b) { b.player.hp = 0; b.over = 'lose'; b.overT = 5; }
      }));
      box.append(row);
    });
  }

  private openOverlay(build: (box: HTMLElement, close: () => void) => void): void {
    // Never nest overlays: the previous one restores its pause state first.
    if (this.overlayDismiss) this.overlayDismiss();
    this.overlay.innerHTML = '';
    const box = el('div', 'box frame');
    const wasPaused = this.paused;
    this.paused = true;
    const close = (): void => { this.overlay.classList.remove('active'); this.overlay.innerHTML = ''; this.overlayDismiss = null; this.paused = wasPaused; this.lastT = performance.now(); };
    this.overlayDismiss = close;
    build(box, close);
    this.overlay.append(box);
    this.overlay.classList.add('active');
  }

  // ---------------------------------------------------------------- pause (SDK)
  onPause(): void { this.paused = true; }
  onResume(): void { this.paused = this.overlay.classList.contains('active'); this.lastT = performance.now(); }

  // ---------------------------------------------------------------- shop
  private shopTab: ShopTab = 'elements';

  showShop(tab: ShopTab): void {
    this.stopLoop();
    setMusic('menu');
    analytics.track('shop_view', { tab });
    this.shopTab = tab;
    this.renderShop();
    this.show('shop');
  }

  /**
   * The gold-bar pill in a screen header means coins. Spells found and awards earned were borrowing
   * it, so three screens said "4 / 72" next to a picture of money. This gives a count its own icon.
   */
  private countPill(icon: UiIconName, tint: string, text: string): HTMLElement {
    const pill = el('div', 'count-pill');
    pill.append(uiIcon(icon, 22, tint), el('span', '', text));
    return pill;
  }

  /** Icon, title and subtitle on one line, for cards that otherwise open with a wall of words. */
  private cardHead(icon: UiIconName, tint: string, title: string, sub?: string): HTMLElement {
    const head = el('div', 'card-head');
    head.append(uiIcon(icon, 34, tint));
    const words = el('div', 'card-head-words');
    words.append(el('div', 'name', title));
    if (sub) words.append(el('div', 'desc', sub));
    head.append(words);
    return head;
  }

  /** The shopkeeper. A counter with somebody behind it reads as a shop; a list of prices does not. */
  private shopKeeper(line: string): HTMLElement {
    const bar = el('div', 'shopkeeper');
    bar.append(wizardPortrait(84));
    const speech = el('div', 'shop-speech');
    speech.append(el('div', 'shop-name', 'MAGISTER ODWIN'), el('div', 'shop-line', line));
    bar.append(speech);
    return bar;
  }

  private renderShop(): void {
    const s = this.screens.shop;
    s.classList.add('woodshop');
    const scrollTop = (s.querySelector('.shop-body') as HTMLElement | null)?.scrollTop ?? 0;
    s.innerHTML = '';
    const head = el('div', 'shop-head');
    head.append(btn('◀', 'small ghost', () => this.showMenu()), el('h1', '', 'SHOP'), el('div', 'coins', fmt(this.save.coins)));
    const lines: Record<ShopTab, string> = {
      elements: 'Attune to an element and its spells start answering you.',
      chests: 'No refunds, no promises. That is what a chest is.',
      upgrades: 'Every rank stays with you. Spend well.',
    };
    const keeper = this.shopKeeper(lines[this.shopTab]);
    const tabs = el('div', 'tabs shop-tabs');
    const icons: Record<ShopTab, Parameters<typeof uiIcon>[0]> = { elements: 'flame', chests: 'chest', upgrades: 'gem' };
    const names: [ShopTab, string][] = [['elements', 'Elements'], ['chests', 'Chests'], ['upgrades', 'Upgrades']];
    for (const [id, label] of names) {
      const t = el('button', `tab ${this.shopTab === id ? 'active' : ''}`);
      t.append(uiIcon(icons[id], 22, this.shopTab === id ? '#3a2410' : '#ffcc33'), el('span', '', label));
      t.addEventListener('click', () => { sfx.click(); this.shopTab = id; this.renderShop(); });
      tabs.append(t);
    }
    const body = el('div', 'shop-body');
    switch (this.shopTab) {
      case 'elements': this.renderElements(body); break;
      case 'upgrades': this.renderUpgrades(body); break;
      case 'chests': this.renderChests(body); break;
    }
    s.append(head, keeper, tabs, body);
    body.scrollTop = scrollTop;
  }


  private renderUpgrades(body: HTMLElement): void {
    const stats = computeStats(this.save);
    const title = el('div', 'section-title');
    title.innerHTML = `Character <small>HP ${stats.maxHp} · Mana ${stats.maxMana} · Regen ${stats.regen.toFixed(1)}/s · Power ${Math.round(stats.power * 100)}% · Stamina ${stats.maxStamina} (dodge ${stats.dodgeCost})</small>`;
    body.append(title);
    for (const u of UPGRADES) {
      const rank = this.save.upgrades[u.id] ?? 0;
      const row = el('div', 'row-card');
      row.append(upgradeIcon(u.id, 48));
      const info = el('div', 'info');
      info.append(el('div', 'name', u.name), el('div', 'desc', u.desc));
      const pips = el('div', 'pips');
      for (let i = 0; i < u.max; i++) pips.append(el('span', `pip ${i < rank ? 'on' : ''}`));
      info.append(pips);
      row.append(info);
      if (rank >= u.max) row.append(btn('MAX', 'ghost'));
      else {
        const price = upgradePrice(u, rank);
        const b = btn(`${fmt(price)}`, 'gold small', () => {
          if (this.save.coins < price) return;
          this.save.coins -= price;
          this.save.upgrades[u.id] = rank + 1;
          sfx.buy();
          this.commit();
          this.renderShop();
        });
        b.disabled = this.save.coins < price;
        row.append(b);
      }
      body.append(row);
    }
  }

  private renderElements(body: HTMLElement): void {
    const att = attunement(this.save);
    const title = el('div', 'section-title');
    title.innerHTML = `Elements <small>Attuning reveals that element's spells. You still have to find them.</small>`;
    body.append(title);
    for (const e of ELEMENTS) {
      const owned = isAttuned(att, e.id);
      const prog = discoveryProgress(this.save.discovered).byElement[e.id] ?? { found: 0, total: 0 };
      const row = el('div', `row-card ${owned ? 'done' : ''}`);
      row.append(elementIcon(e.id, 48));
      const info = el('div', 'info');
      info.append(el('div', 'name', e.name), el('div', 'desc', e.desc));
      info.append(el('div', 'kind', owned ? `Attuned · ${prog.found} of ${prog.total} spells found` : e.motto));
      row.append(info);
      if (owned) row.append(btn('Attuned', 'ghost small'));
      else if (e.secret) row.append(btn('???', 'ghost small'));
      else {
        const b = btn(fmt(e.price), 'gold small', () => {
          if (!attune(this.save, e.id)) return;
          sfx.buy(); this.commit(); this.afterProgress(); this.renderShop();
          this.toast(`${e.name} attuned`, 'Its spells can now be found');
        });
        b.disabled = this.save.coins < e.price;
        row.append(b);
      }
      body.append(row);
    }
    const eclipse = ELEMENT_BY_ID.eclipse;
    const hint = el('div', 'card');
    hint.append(el('div', 'name', eclipse.name), el('div', 'desc', eclipse.desc));
    body.append(hint);
  }

  private renderCoins(body: HTMLElement): void {
    const amount = AD_REWARD(this.save.best + 1);
    const card = el('div', 'card ad-card');
    card.append(this.cardHead('eye', '#9ad8ff', 'Watch an ad, earn coins'));
    const big = el('div', 'big-coins');
    big.append(uiIcon('coin', 40, '#ffcc33'), el('span', '', `+${fmt(amount)}`));
    card.append(big, el('div', 'note', 'The reward grows with your best level.'));
    const b = btn('WATCH AD', 'gold big', async () => {
      b.disabled = true;
      const ok = await platform.showRewardedAd();
      if (ok) {
        this.save.coins += amount;
        this.save.earned += amount;
        this.save.adsWatched++;
        analytics.track('ad_watched', { amount });
        sfx.coin();
        this.commit();
        this.afterProgress();
      }
      this.renderShop();
    });
    if (!platform.adsAvailable()) { b.disabled = true; b.textContent = 'NO AD READY'; }
    card.append(b, el('div', 'note', `Ads watched: ${this.save.adsWatched} · Total earned: ${fmt(this.save.earned)} coins`));
    body.append(card);
    const tips = el('div', 'card');
    tips.append(this.cardHead('coin', '#ffcc33', 'Other ways to earn'));
    tips.append(el('div', 'desc', 'Replaying a cleared level pays 60% of its reward. Losing still pays 25%. Boss levels pay triple. The Lucky Coin and Chrono Amulet charms multiply everything.'));
    body.append(tips);
  }

  private renderChests(body: HTMLElement): void {
    const title = el('div', 'section-title');
    title.innerHTML = `Chests <small>Equipment only drops. Chests are how you aim the drops.</small>`;
    body.append(title);
    for (const c of CHESTS) {
      const row = el('div', 'row-card');
      const info = el('div', 'info');
      info.append(el('div', 'name', c.name), el('div', 'desc', c.desc), oddsLine(c));
      row.append(info);
      const b = btn(fmt(c.price), 'gold small', () => {
        if (this.save.coins < c.price) return;
        if (c.pickElement) this.pickChestElement(c);
        else this.openChestNow(c);
      });
      b.disabled = this.save.coins < c.price;
      row.append(b);
      body.append(row);
    }
    const note = el('div', 'card');
    note.append(el('div', 'name', 'Where else gear comes from'),
      el('div', 'desc', 'Every level can drop a piece, and a boss always drops one. The higher the level, the better the odds of Epic and Mythic. Duplicates melt into coins automatically.'));
    body.append(note);
  }

  private pickChestElement(c: ChestDef): void {
    this.openOverlay((box, close) => {
      box.append(el('h2', '', 'CHOOSE AN ELEMENT'), el('div', 'note', 'Every piece in this chest will be of that element.'));
      const grid = el('div', 'element-picker');
      for (const e of ELEMENTS.filter(x => !x.secret)) {
        const b = btn(e.name, 'ghost small', () => { close(); this.openChestNow(c, e.id); });
        b.style.borderColor = e.color;
        grid.append(b);
      }
      box.append(grid, btn('Cancel', 'ghost', close));
    });
  }

  private openChestNow(c: ChestDef, element?: ElementId): void {
    if (this.save.coins < c.price) return;
    this.save.coins -= c.price;
    this.save.stats.chests++;
    const items = openChest(c, this.save.elements, element);
    const results = items.map(i => grantItem(this.save, i));
    sfx.buy();
    this.commit();
    this.afterProgress();
    this.showLoot(results, c.name);
  }

  private renderBank(body: HTMLElement): void {
    const title = el('div', 'section-title');
    title.innerHTML = `Bank <small>${platform.purchasesAvailable() ? 'Real-money purchases through Google Play.' : 'Purchases are available in the Android app.'}</small>`;
    body.append(title);
    const items: { sku: string; name: string; desc: string; owned?: boolean; fallback: string }[] = [
      { sku: CONFIG.skus.coinsSmall, name: `${fmt(CONFIG.coinsSmall)} coins`, desc: 'A pouch of gold for spells and gear.', fallback: '$1.99' },
      { sku: CONFIG.skus.coinsLarge, name: `${fmt(CONFIG.coinsLarge)} coins`, desc: 'A chest of gold. Best value.', fallback: '$7.99' },
      { sku: CONFIG.skus.doubleCoins, name: 'Double coins', desc: 'Every battle and duel pays twice as much, forever.', owned: this.save.passes.doubleCoins, fallback: '$3.99' },
      { sku: CONFIG.skus.noAds, name: 'Supporter pass', desc: 'Support the game. Rewarded ads stay optional and keep paying.', owned: this.save.passes.noAds, fallback: '$2.99' },
      { sku: CONFIG.skus.hatPack, name: 'Founder\'s hoard', desc: 'Seven Gold Chests, opened instantly.', fallback: '$2.99' },
    ];
    const bankArt: Record<string, [UiIconName, string]> = {
      [CONFIG.skus.coinsSmall]: ['coin', '#ffcc33'],
      [CONFIG.skus.coinsLarge]: ['chest', '#ffcc33'],
      [CONFIG.skus.doubleCoins]: ['gem', '#ffcc33'],
      [CONFIG.skus.noAds]: ['ribbon', '#ff4fd8'],
      [CONFIG.skus.hatPack]: ['trophy', '#ffcc33'],
    };
    const grid = el('div', 'grid');
    for (const it of items) {
      const card = el('div', `card ${it.owned ? 'equipped' : ''}`);
      const art = bankArt[it.sku] ?? ['gem', '#ffcc33'] as [UiIconName, string];
      card.append(this.cardHead(art[0], art[1], it.name), el('div', 'desc', it.desc));
      if (it.sku === CONFIG.skus.hatPack) {
        const gold = CHESTS.find(c => c.id === 'gold');
        if (gold) card.append(oddsLine(gold));
      }
      if (it.owned) card.append(btn('Owned', 'ghost'));
      else {
        const b = btn(platform.price(it.sku) ?? it.fallback, 'gold', async () => {
          b.disabled = true;
          const r = await platform.purchase(it.sku);
          if (r.ok) { this.grantPurchase(it.sku); sfx.buy(); this.toast('Purchase complete', it.name); }
          else if (r.message) this.toast('Purchase failed', r.message);
          this.renderShop();
        });
        b.disabled = !platform.purchasesAvailable();
        card.append(b);
      }
      grid.append(card);
    }
    body.append(grid);
    const restore = btn('Restore purchases', 'ghost small', async () => { const skus = await platform.restorePurchases(); for (const s of skus) this.grantPurchase(s, true); this.renderShop(); });
    restore.disabled = !platform.purchasesAvailable();
    body.append(restore);
  }

  private grantPurchase(sku: string, restoring = false): void {
    if (!restoring) analytics.track('purchase_complete', { sku });
    if (sku === CONFIG.skus.coinsSmall && !restoring) { this.save.coins += CONFIG.coinsSmall; this.save.earned += CONFIG.coinsSmall; }
    if (sku === CONFIG.skus.coinsLarge && !restoring) { this.save.coins += CONFIG.coinsLarge; this.save.earned += CONFIG.coinsLarge; }
    if (sku === CONFIG.skus.doubleCoins) this.save.passes.doubleCoins = true;
    if (sku === CONFIG.skus.noAds) this.save.passes.noAds = true;
    if (sku === CONFIG.skus.seasonPass) {
      // Unclaim every tier already reached, so the premium half of each is paid on the next claim.
      ensureSeason(this.save);
      this.save.season.premium = true;
      this.save.season.claimed = [];
    }
    if (sku === CONFIG.skus.hatPack && !restoring) {
      const gold = CHESTS.find(c => c.id === 'gold')!;
      for (let i = 0; i < 7; i++) for (const it of openChest(gold, this.save.elements)) grantItem(this.save, it);
    }
    this.commit();
    this.afterProgress();
  }

  showFakePurchase(sku: string): Promise<boolean> {
    return new Promise(resolve => {
      this.openOverlay((box, close) => {
        box.append(el('h2', '', 'DEMO PURCHASE'), el('div', 'note', `Google Play would charge you for "${sku}" here. In this web build the item is granted for free.`));
        const row = el('div', 'menu-row');
        row.append(btn('Buy', 'gold', () => { close(); resolve(true); }), btn('Cancel', 'ghost', () => { close(); resolve(false); }));
        box.append(row);
      });
    });
  }

  // ---------------------------------------------------------------- spellbook
  /**
   * Two views of the same book: "Known" is the collection of spells you have actually found and
   * the place you build a loadout, "Codex" is every spell in the game with the unfound ones as
   * silhouettes and a hint.
   */
  showSpellbook(tab: SpellbookTab = this.spellbookTab): void {
    this.spellbookTab = tab;
    if (!this.board) void this.loadBoard();
    // Opening the book is what clears the NEW badge.
    if (this.save.unseen.length) { this.save.unseen = []; this.commit(); }
    if (tab === 'known') this.renderKnownSpells();
    else this.renderCodex();
  }

  /** One cryptic line a week about a spell nobody has been told exists. */
  private rumourCard(): HTMLElement | null {
    const rumour = weeklyRumour(this.save);
    if (!rumour) return null;
    if (this.save.rumourSeen !== rumour.week) { this.save.rumourSeen = rumour.week; this.commit(); }
    const card = el('div', 'card rumour');
    const rHead = el('div', 'rumour-head');
    rHead.append(uiIcon('eye', 22, '#ff4fd8'), el('span', '', 'THIS WEEK THEY SAY'));
    card.append(rHead, el('div', 'rumour-text', `"${rumour.text}"`),
      el('div', 'note faint', 'Some spells were never written down. This is one of them.'));
    return card;
  }

  private renderKnownSpells(): void {
    this.stopLoop();
    setMusic('menu');
    const s = this.screens.spellbook;
    s.innerHTML = '';
    const stats = computeStats(this.save);
    const prog = discoveryProgress(this.save.discovered);
    const head = el('div', 'shop-head');
    head.append(btn('◀', 'small ghost', () => this.showMenu()), el('h1', '', 'SPELLBOOK'), this.countPill('book', '#ffcc33', `${prog.found} / ${prog.total}`));
    const tabs = el('div', 'tabs');
    const mk = (id: SpellbookTab, label: string): void => {
      const t = el('button', `tab ${this.spellbookTab === id ? 'active' : ''}`, label);
      t.addEventListener('click', () => { sfx.click(); this.showSpellbook(id); });
      tabs.append(t);
    };
    mk('known', `Known ${prog.found}`);
    mk('codex', `Codex ${prog.total}`);

    const body = el('div', 'shop-body');
    const rumour = this.rumourCard();
    if (rumour) body.append(rumour);
    const title = el('div', 'section-title');
    title.innerHTML = `Loadout <small>${this.save.loadout.length} / ${stats.slots} slots. Only equipped spells can be cast in battle.</small>`;
    body.append(title);

    // Known spells, grouped by element so a collection reads at a glance.
    const known = SPELLS.filter(sp => this.save.discovered.includes(sp.id));
    const byElement = new Map<ElementId, SpellDef[]>();
    for (const sp of known) { const arr = byElement.get(sp.element) ?? []; arr.push(sp); byElement.set(sp.element, arr); }
    for (const e of ELEMENTS) {
      const list = byElement.get(e.id);
      if (!list) continue;
      const p = prog.byElement[e.id] ?? { found: 0, total: 0 };
      const st = el('div', 'section-title');
      const tl = el('span', 'with-icon'); tl.append(elementIcon(e.id, 26), document.createTextNode(e.name));
      st.append(tl, el('small', '', `${p.found} of ${p.total} found`));
      body.append(st);
      const grid = el('div', 'grid');
      for (const sp of list.sort((a, b) => a.tier - b.tier)) {
        const equipped = this.save.loadout.includes(sp.id);
        const card = el('div', `card spell-card ${equipped ? 'equipped' : ''}`);
        const hr = el('div', 'head'); const nb = el('div');
        nb.append(el('div', 'name', sp.name), el('div', `kind ${sp.secret ? 'secret' : ''}`, `${TIER_NAMES[sp.tier]} · ${sp.kind}${sp.secret ? ' · unrecorded' : ''}`));
        hr.append(glyphCanvas(sp), nb);
        card.append(hr, el('div', 'desc', sp.desc));
        const meta = el('div', 'meta');
        meta.innerHTML = `<span>${sp.cost ? `${sp.cost} mana` : 'no mana'}</span><span>${sp.cooldown ? `${sp.cooldown}s cd` : ''}</span>`;
        card.append(meta);
        const rarity = this.rarityLine(sp);
        if (rarity) card.append(rarity);
        if (equipped) {
          const b = btn('Unequip', 'ghost', () => { this.save.loadout = this.save.loadout.filter(id => id !== sp.id); this.commit(); this.showSpellbook('known'); });
          b.disabled = this.save.loadout.length <= 1;
          card.append(b);
        } else {
          const b = btn('Equip', 'green', () => { this.save.loadout.push(sp.id); this.commit(); this.showSpellbook('known'); });
          b.disabled = this.save.loadout.length >= stats.slots;
          if (b.disabled) b.textContent = 'Loadout full';
          card.append(b);
        }
        grid.append(card);
      }
      body.append(grid);
    }
    const att = attunement(this.save);
    const ready = discoverable(att, this.save.discovered).filter(x => !x.secret).length;
    const foot = el('div', 'shop-foot');
    foot.append(el('div', 'note', ready
      ? `${ready} more spell${ready === 1 ? '' : 's'} could be found with what you are wearing. Draw in a battle to find them.`
      : 'Attune to more elements and wear their gear to make new spells findable.'));
    if (prog.secrets) foot.append(el('div', 'note faint', `${prog.secrets} of your spells ${prog.secrets === 1 ? "is" : "are"} not in the codex at all.`));
    s.append(head, tabs, body, foot);
    this.show('spellbook');
  }

  /** The full list, including everything still unfound. */
  private renderCodex(): void {
    this.stopLoop();
    setMusic('menu');
    const s = this.screens.spellbook;
    s.innerHTML = '';
    const att = attunement(this.save);
    const stats = computeStats(this.save);
    const prog = discoveryProgress(this.save.discovered);
    const head = el('div', 'shop-head');
    head.append(btn('◀', 'small ghost', () => this.showSpellbook('known')), el('h1', '', 'CODEX'), this.countPill('book', '#ffcc33', `${prog.found} / ${prog.total}`));

    // Ten element names do not fit across a phone, and truncating them to "Arca" and "Eclip"
    // reads as broken. Each tab is its own emblem instead, with the count beneath it and the full
    // name spelled out in the section heading below.
    const tabs = el('div', 'tabs element-tabs');
    for (const e of ELEMENTS) {
      const known = isAttuned(att, e.id);
      const p = prog.byElement[e.id] ?? { found: 0, total: 0 };
      const active = this.grimoireElement === e.id;
      const t = el('button', `tab element-tab ${active ? 'active' : ''} ${known ? '' : 'locked'}`);
      t.title = known ? `${e.name}: ${p.found} of ${p.total} found` : `${e.name}: not attuned`;
      const count = el('span', 'count', known ? `${p.found}/${p.total}` : '?');
      if (!active) count.style.color = e.color;
      t.append(elementIcon(e.id, ICON_PX), count);
      t.addEventListener('click', () => { sfx.click(); this.grimoireElement = e.id; this.renderCodex(); });
      tabs.append(t);
    }

    const body = el('div', 'shop-body');
    const elDef = ELEMENT_BY_ID[this.grimoireElement];
    const loadNote = el('div', 'section-title');
    loadNote.innerHTML = `${elDef.name} <small>Loadout ${this.save.loadout.length} / ${stats.slots}. Only equipped spells can be cast.</small>`;
    body.append(loadNote);
    if (!isAttuned(att, this.grimoireElement)) {
      const locked = el('div', 'card');
      locked.append(el('div', 'name', 'Not attuned'), el('div', 'desc', elDef.desc));
      if (!elDef.secret) locked.append(btn('Attune in the shop', 'gold', () => this.showShop('elements')));
      body.append(locked);
    }
    const grid = el('div', 'grid');
    for (const sp of elementSpells(this.grimoireElement, this.save.discovered)) {
      const st = spellStatus(sp, att, this.save.discovered);
      const equipped = this.save.loadout.includes(sp.id);
      const card = el('div', `card spell-card ${equipped ? 'equipped' : ''} ${st.known ? '' : 'undiscovered'} ${st.reason === 'ready' ? 'ready' : ''}`);
      const headRow = el('div', 'head');
      const nameBox = el('div');
      if (st.known) {
        headRow.append(glyphCanvas(sp), nameBox);
        nameBox.append(el('div', 'name', sp.name), el('div', `kind ${sp.secret ? 'secret' : ''}`, `${TIER_NAMES[sp.tier]} · ${sp.kind}${sp.secret ? ' · unrecorded' : ''}`));
        card.append(headRow, el('div', 'desc', sp.desc));
        const meta = el('div', 'meta');
        meta.innerHTML = `<span>${sp.cost ? `${sp.cost} mana` : 'no mana'}</span><span>${sp.cooldown ? `${sp.cooldown}s cd` : ''}</span>`;
        card.append(meta);
        if (equipped) {
          const b = btn('Unequip', 'ghost', () => { this.save.loadout = this.save.loadout.filter(id => id !== sp.id); this.commit(); this.renderCodex(); });
          b.disabled = this.save.loadout.length <= 1;
          card.append(b);
        } else {
          const b = btn('Equip', 'green', () => { this.save.loadout.push(sp.id); this.commit(); this.renderCodex(); });
          b.disabled = this.save.loadout.length >= stats.slots;
          if (b.disabled) b.textContent = 'Loadout full';
          card.append(b);
        }
      } else {
        headRow.append(mysteryCanvas(sp), nameBox);
        nameBox.append(el('div', 'name', '? ? ?'), el('div', 'kind', `${TIER_NAMES[sp.tier]} · ${sp.kind}`));
        card.append(headRow, el('div', 'desc hint', `"${sp.hint}"`));
        card.append(el('div', 'meta req', requirementText(st, elDef.name)));
      }
      grid.append(card);
    }
    body.append(grid);

    // Secrets are not listed above, so the count of "ready" spells would give them away. Only
    // the ones the codex knows about are counted here.
    const chosen = tabs.querySelector('.element-tab.active') as HTMLElement | null;
    if (chosen) requestAnimationFrame(() => { tabs.scrollLeft = chosen.offsetLeft - tabs.clientWidth / 2 + chosen.offsetWidth / 2; });

    const ready = discoverable(att, this.save.discovered).filter(x => x.element === this.grimoireElement && !x.secret).length;
    const foot = el('div', 'shop-foot');
    foot.append(el('div', 'note', ready
      ? `${ready} ${elDef.name} spell${ready === 1 ? '' : 's'} could be found right now. Draw one in a battle.`
      : 'Wear more of this element to make its deeper spells findable.'));
    foot.append(el('div', 'note faint', 'The codex holds only what someone wrote down. Not every spell was.'));
    s.append(head, tabs, body, foot);
    this.show('spellbook');
  }

  // ---------------------------------------------------------------- gear
  /** Which slot the collection below the wizard is filtering to, and which element inside it. */
  /** The one open drawer, anywhere in the app. Accordion: opening one closes the last. */
  private openDrawer: string | null = null;
  private gearSlot: EquipSlot = 'hat';
  private gearElement: ElementId | 'all' = 'all';
  /** Kept between renders so the canvas and its WebGL context survive a re-render. */
  private wizardStage: HTMLElement | null = null;
  private wizardView: WizardView | null = null;

  /**
   * The wizard on his plinth. Built once: tearing down a WebGL context on every equip would cost
   * more than the whole screen, and the point is that the model changes while you watch it.
   */
  private ensureWizardStage(): HTMLElement {
    if (this.wizardStage) return this.wizardStage;
    const stage = el('div', 'wizard-stage');
    const canvas = document.createElement('canvas');
    canvas.className = 'wizard-canvas';
    stage.append(canvas);
    const view = new WizardView(canvas, playerLook(this.save));
    if (view.ok) this.wizardView = view;
    else { canvas.remove(); stage.append(wizardPortrait(150)); }   // no WebGL: the pixel portrait still says who you are
    stage.append(el('div', 'wizard-plate'), el('div', 'wizard-hint', 'drag to turn'));
    this.wizardStage = stage;
    return stage;
  }

  /** One of the four worn slots, as a card in the row under the wizard. */
  private slotCard(slot: { id: EquipSlot; name: string }): HTMLElement {
    const id = this.save.equipped[slot.id];
    const item = id ? EQUIP_BY_ID[id] : undefined;
    const picked = this.gearSlot === slot.id;
    const card = el('button', `slot-card ${picked ? 'picked' : ''} ${item ? '' : 'empty'}`);
    if (item) card.style.setProperty('--slot-tint', RARITY_COLORS[item.rarity]);
    const art = el('div', 'slot-art');
    art.append(item ? gearIcon(item.slot, item.rarity, 46, ELEMENT_BY_ID[item.element].color) : slotIcon(slot.id, 46));
    card.append(art, el('div', 'slot-name', item ? item.name : slot.name));
    card.append(el('div', 'slot-kind', item ? RARITY_NAMES[item.rarity] : 'empty'));
    card.addEventListener('click', () => { sfx.click(); this.gearSlot = slot.id; this.showGear(); });
    return card;
  }

  showGear(): void {
    this.stopLoop();
    setMusic('menu');
    const s = this.screens.gear;
    const body0 = s.querySelector('.shop-body') as HTMLElement | null;
    const scrollTop = body0?.scrollTop ?? 0;
    const stage = this.ensureWizardStage();
    stage.remove();                        // detach before innerHTML clears the screen, so the context lives
    s.innerHTML = '';

    const head = el('div', 'shop-head');
    head.append(btn('◀', 'small ghost', () => this.showMenu()), el('h1', '', 'LOADOUT'), el('div', 'coins', fmt(this.save.coins)));

    // The plinth glows in the colour of whatever set is closest to complete.
    //
    // Counted with affinities(), not setSummary(): only Fine or better counts towards a set bonus,
    // and the old screen filled a pip for every matching piece regardless. That made four starter
    // rags read as a finished set while the bonus line underneath said nothing was active.
    const aff = affinities(this.save.equipped);
    let set: { element: ElementId; count: number } | null = null;
    for (const [e, n] of Object.entries(aff) as [ElementId, number][]) {
      if (!set || n > set.count) set = { element: e, count: n };
    }
    const nearest = set ?? setSummary(this.save);   // nothing qualifies yet: colour by what is worn
    const setDef = nearest ? ELEMENT_BY_ID[nearest.element] : null;
    const setCount = set?.count ?? 0;
    stage.style.setProperty('--stage-glow', setDef ? setDef.color : '#6ea8ff');
    const plate = stage.querySelector('.wizard-plate') as HTMLElement;
    plate.innerHTML = '';
    plate.append(el('b', '', this.save.name), el('span', '', `Level ${wizardLevel(this.save.best)} · ${arenaFor(this.save.rating).name}`));
    this.wizardView?.setLook(playerLook(this.save));

    const body = el('div', 'shop-body loadout');

    // The banner over the worn row, in the shape Clash Royale uses over a battle deck: a token on
    // the left, the name of the thing in the middle, its progress on the right.
    const band = el('div', 'deck-band');
    const token = el('div', 'deck-token');
    token.append(nearest ? elementIcon(nearest.element, 30) : uiIcon('spark', 30, '#9ad8ff'));
    const pips = el('div', 'pips');
    for (let i = 0; i < SET_SIZE; i++) pips.append(el('span', `pip big ${i < setCount ? 'on' : ''}`));
    band.append(token, el('div', 'deck-title', nearest ? `${setDef!.name} set` : 'No set'), pips);

    const bonus = activeSetBonus(this.save.equipped);
    const nextBonus = SET_BONUSES.find(b => b.pieces > setCount);
    const bandNote = el('div', 'deck-note', bonus
      ? `${bonus.bonus.name}: ${bonus.bonus.desc}`
      : `Wear two pieces of one element, ${RARITY_NAMES[ATTUNING_RARITY]} or better, for the first set bonus.`);

    const row = el('div', 'deck-row');
    for (const slot of EQUIP_SLOTS) row.append(this.slotCard(slot));
    body.append(band, row, bandNote);
    if (nextBonus) body.append(el('div', 'note faint deck-next', `At ${nextBonus.pieces} pieces: ${nextBonus.desc}`));

    // ---- the picker ------------------------------------------------------------------
    const slotDef = EQUIP_SLOTS.find(x => x.id === this.gearSlot)!;
    const prompt = el('div', 'pick-head');
    prompt.append(slotIcon(this.gearSlot, 26), el('span', '', `Choose a ${slotDef.name.toLowerCase()}`));
    body.append(prompt);

    const owned = ownedInSlot(this.save, this.gearSlot);
    const haveElements = new Set(owned.map(o => o.element));
    const strip = el('div', 'element-strip');
    const chip = (label: string, on: boolean, tint: string, icon: HTMLCanvasElement | null, run: () => void): void => {
      const c = el('button', `el-chip ${on ? 'on' : ''}`);
      c.style.setProperty('--chip-tint', tint);
      if (icon) c.append(icon);
      c.append(el('span', '', label));
      c.addEventListener('click', () => { sfx.click(); run(); });
      strip.append(c);
    };
    chip('All', this.gearElement === 'all', '#ffcc33', null, () => { this.gearElement = 'all'; this.showGear(); });
    for (const e of ELEMENTS) {
      if (!haveElements.has(e.id)) continue;
      chip(e.name, this.gearElement === e.id, e.color, elementIcon(e.id, 22), () => { this.gearElement = e.id; this.showGear(); });
    }
    if (strip.children.length > 1) body.append(strip);

    const shown = owned.filter(o => this.gearElement === 'all' || o.element === this.gearElement);
    if (!shown.length) {
      body.append(el('div', 'card', owned.length
        ? 'Nothing of that element in this slot yet.'
        : 'Nothing for this slot yet. Win levels and open chests.'));
    } else {
      const grid = el('div', 'pick-grid');
      for (const item of shown) grid.append(this.pickCard(item, this.save.equipped[item.slot] === item.id));
      body.append(grid);
    }

    const look = el('div', 'pick-head');
    look.append(uiIcon('spark', 24, '#ffcc33'), el('span', '', 'Appearance'));
    body.append(look);
    body.append(this.swatchRow('Skin', SKIN_TONES, () => this.save.skin, c => { this.save.skin = c; }));
    body.append(this.swatchRow('Beard', BEARD_COLORS, () => this.save.beardColor, c => { this.save.beardColor = c; }));

    s.append(head, stage, body);
    body.scrollTop = scrollTop;
    this.show('gear');
    this.wizardView?.start();
  }

  /**
   * A collapsed row that opens to show its card. The hub had the quests, the challenge, the level
   * map and four buttons all competing at once; this keeps the daily pair to one line each until
   * they are asked for, without hiding the fact that something is waiting to be claimed.
   */
  private drawer(id: string, icon: UiIconName, tint: string, title: string, note: string,
    flag: boolean, fill: (card: HTMLElement) => void, rerender: () => void = () => this.showMenu(),
    bodyHost?: HTMLElement): HTMLElement {
    const open = this.openDrawer === id;
    const wrap = el('div', `drawer ${open ? 'open' : ''} ${flag ? 'ready' : ''}`);
    const head = el('button', 'drawer-head');
    head.append(uiIcon(icon, 24, tint), el('b', '', title), el('small', '', note), el('em', '', open ? '▴' : '▾'));
    head.addEventListener('click', () => {
      sfx.click();
      this.openDrawer = open ? null : id;   // one at a time, or the screen is back where it started
      rerender();
    });
    wrap.append(head);
    if (open) {
      const card = el('div', 'card drawer-body');
      fill(card);
      (bodyHost ?? wrap).append(card);
    }
    return wrap;
  }

  /**
   * A strip of colour swatches. Picking one repaints the model above without rebuilding the screen,
   * which is the point of having the wizard on the same page.
   */
  private swatchRow(label: string, swatches: readonly { id: string; name: string; color: string }[],
    current: () => string, set: (color: string) => void): HTMLElement {
    const row = el('div', 'swatch-row');
    row.append(el('div', 'swatch-label', label));
    const strip = el('div', 'swatch-strip');
    for (const sw of swatches) {
      const b = el('button', `swatch ${current() === sw.color ? 'on' : ''}`);
      b.style.background = sw.color;
      b.title = sw.name;
      b.setAttribute('aria-label', `${label}: ${sw.name}`);
      b.addEventListener('click', () => {
        sfx.click();
        set(sw.color);
        this.commit();
        this.wizardView?.setLook(playerLook(this.save));
        for (const other of strip.children) other.classList.remove('on');
        b.classList.add('on');
      });
      strip.append(b);
    }
    row.append(strip);
    return row;
  }

  /** A collection tile: art, name, rarity, and the stat line it is really chosen for. */
  private pickCard(item: EquipDef, worn: boolean): HTMLElement {
    const elDef = ELEMENT_BY_ID[item.element];
    const card = el('button', `pick-card ${worn ? 'worn' : ''}`);
    card.style.setProperty('--slot-tint', RARITY_COLORS[item.rarity]);
    card.append(gearIcon(item.slot, item.rarity, 52, elDef.color));
    card.append(el('div', 'slot-name', item.name));
    card.append(el('div', 'slot-kind', `${RARITY_NAMES[item.rarity]} · ${elDef.name}`));
    card.append(el('div', 'pick-desc', item.desc));
    if (worn) card.append(el('div', 'worn-tag', 'WORN'));
    else card.addEventListener('click', () => {
      sfx.buy();
      equipItem(this.save, item.id);
      this.commit();
      this.afterProgress();
      this.wizardView?.setLook(playerLook(this.save));
      this.wizardView?.flourish();
      this.showGear();
    });
    return card;
  }

  /** "0.4% of wizards know this", once the board has answered. A private moment made public. */
  private rarityLine(spell: SpellDef): HTMLElement | null {
    const stat = this.board?.spells[spell.id];
    if (!stat || !this.board) return null;
    const row = el('div', 'rarity-line');
    const who = stat.first ? ` · first found by ${stat.first}` : '';
    row.append(el('span', '', `${sharePercent(stat.holders, this.board.players)} of wizards know this${who}`),
      btn('Share', 'ghost small', () => this.shareSpell(spell)));
    return row;
  }



  /** Shown after a drop or a chest: what you got, and whether it was new. */
  private showLoot(results: GrantResult[], title: string): void {
    if (!results.length) return;
    this.openOverlay((box, close) => {
      box.append(el('h2', '', title.toUpperCase()));
      for (const r of results) {
        const elDef = ELEMENT_BY_ID[r.item.element];
        const row = el('div', 'row-card loot');
        row.style.borderColor = RARITY_COLORS[r.item.rarity];
        row.append(gearIcon(r.item.slot, r.item.rarity, 44, elDef.color));
        const info = el('div', 'info');
        info.append(el('div', 'name', r.item.name), el('div', 'kind', `${RARITY_NAMES[r.item.rarity]} · ${elDef.name}`));
        info.append(el('div', 'desc', r.isNew ? (r.upgrade ? 'New, and equipped' : 'New') : `Duplicate, melted for ${fmt(r.coins)} coins`));
        row.append(info);
        box.append(row);
      }
      const row = el('div', 'menu-row');
      row.append(btn('Nice', 'gold', close), btn('Open gear', 'blue', () => { close(); this.showGear(); }));
      box.append(row);
    });
  }

  // ---------------------------------------------------------------- marketplace
  /** Real money, rewarded ads and offers. Coins earned in play are spent in the Shop tab instead. */
  showMarket(): void {
    this.stopLoop();
    setMusic('menu');
    const s = this.screens.market;
    s.innerHTML = '';
    const head = el('div', 'shop-head');
    head.append(btn('◀', 'small ghost', () => this.showMenu()), el('h1', '', 'MARKETPLACE'), el('div', 'coins', fmt(this.save.coins)));
    const body = el('div', 'shop-body');
    ensureSeason(this.save);
    const def = seasonFor();
    const owed = unclaimedTiers(this.save).length;
    const pass = el('div', 'card season-card');
    pass.append(this.cardHead('hourglass', '#ffcc33', `Season of ${def.name}`,
      `Day ${def.day} of ${SEASON_DAYS} · tier ${tierFor(this.save.season.xp)} of ${SEASON_TIER_COUNT}${owed ? ` · ${owed} waiting` : ''}`));
    pass.append(this.seasonBar(), btn(owed ? `OPEN THE SEASON · ${owed} TO CLAIM` : 'OPEN THE SEASON', owed ? 'gold' : 'blue', () => this.showSeason()));
    body.append(pass);
    this.renderCoins(body);
    this.renderBank(body);
    s.append(head, body);
    this.show('market');
  }

  // ---------------------------------------------------------------- settings, ranks, achievements
  showSettings(): void {
    this.stopLoop();
    const s = this.screens.settings;
    s.innerHTML = '';
    const head = el('div', 'shop-head');
    head.append(btn('◀', 'small ghost', () => this.showMenu()), el('h1', '', 'SETTINGS'), el('div', 'coins', fmt(this.save.coins)));
    const body = el('div', 'shop-body');
    const nameCard = el('div', 'card');
    nameCard.append(el('div', 'name', 'Wizard name'), el('div', 'desc', 'Shown on leaderboards and to duel opponents.'));
    const input = el('input', 'text-input'); input.maxLength = 16; input.value = this.save.name; input.placeholder = 'Your name';
    input.addEventListener('change', () => { const v = input.value.replace(/[^\w \-]/g, '').trim().slice(0, 16); if (v) { this.save.name = v; this.commit(); } input.value = this.save.name; });
    nameCard.append(input);
    body.append(nameCard);
    const toggles: [keyof SaveData['settings'], string, string][] = [
      ['music', 'Music', 'The generative soundtrack.'], ['sfx', 'Sound effects', 'Casts, hits and clicks.'],
      ['haptics', 'Vibration', 'A small buzz on dodges and hits.'], ['notifications', 'Reminders', 'One notification a day when your reward is ready.'],
      ['analytics', 'Share gameplay data', 'Anonymous counts of levels played and spells cast, so the game can be improved. No personal data.'],
    ];
    for (const [key, name, desc] of toggles) {
      const row = el('div', 'row-card');
      const info = el('div', 'info'); info.append(el('div', 'name', name), el('div', 'desc', desc));
      const b = btn(this.save.settings[key] ? 'ON' : 'OFF', this.save.settings[key] ? 'green small' : 'ghost small', () => {
        this.save.settings[key] = !this.save.settings[key];
        if (key === 'music') setMusicEnabled(this.save.settings.music);
        if (key === 'sfx') setSfxEnabled(this.save.settings.sfx);
        if (key === 'analytics') analytics.setEnabled(this.save.settings.analytics);
        if (key === 'notifications') {
          if (this.save.settings.notifications) this.maybeScheduleReminder(true);
          else void platform.cancelReminders();
        }
        this.commit(); this.showSettings();
      });
      row.append(info, b);
      body.append(row);
    }
    const hatCard = el('div', 'card');
    hatCard.append(el('div', 'name', 'Appearance'), el('div', 'desc', 'Your hat, robe and staff colours all come from the gear you are wearing.'), btn('Open gear', 'blue small', () => this.showGear()));
    body.append(hatCard);
    const about = el('div', 'card');
    about.append(el('div', 'name', 'About'), el('div', 'desc', `Wizard 1v1s ${CONFIG.version} by Swag Games. Player id ${this.save.deviceId.slice(0, 8)}.`));
    const links = el('div', 'menu-row');
    links.append(btn('Privacy policy', 'ghost small', () => platform.openUrl(CONFIG.privacyUrl)), btn('Share', 'ghost small', () => void platform.share(`I cleared level ${this.save.best} in Wizard 1v1s! ${CONFIG.storeUrl}`)));
    about.append(links);
    body.append(about);
    const danger = el('div', 'card');
    danger.append(el('div', 'name', 'Reset progress'), el('div', 'desc', 'Wipes coins, spells, gear and levels on this device. Purchases can be restored from the Bank.'));
    danger.append(btn('Reset everything', 'red small', () => this.openOverlay((box, close) => {
      box.append(el('h2', '', 'RESET?'), el('div', 'note', 'This cannot be undone.'));
      const row = el('div', 'menu-row');
      row.append(btn('Keep my progress', 'gold', close), btn('Reset', 'red', () => {
        const keep = { deviceId: this.save.deviceId, name: this.save.name, settings: this.save.settings, passes: this.save.passes };
        const fresh = parseSaveFresh();
        Object.assign(this.save, fresh, keep);
        this.pickedLevel = 1; this.commit(); close(); this.showMenu();
      }));
      box.append(row);
    })));
    body.append(danger);
    s.append(head, body);
    this.show('settings');
  }

  showRanks(): void {
    this.stopLoop();
    const s = this.screens.ranks;
    s.innerHTML = '';
    const head = el('div', 'shop-head');
    head.append(btn('◀', 'small ghost', () => this.showMenu()), el('h1', '', 'RANKINGS'), this.countPill('trophy', '#ffcc33', arenaFor(this.save.rating).name));
    const tabs = el('div', 'tabs');
    const body = el('div', 'shop-body');
    const render = async (by: 'best' | 'rating'): Promise<void> => {
      for (const t of tabs.children) t.classList.toggle('active', (t as HTMLElement).dataset.by === by);
      body.innerHTML = '';
      body.append(el('div', 'note', 'Loading...'));
      const res = await api.leaderboard(by);
      body.innerHTML = '';
      if (!res) { body.append(el('div', 'card', 'Rankings need a connection to the duel server.')); return; }
      if (!res.entries.length) { body.append(el('div', 'card', 'Nobody has posted a score yet. Be the first!')); return; }
      res.entries.forEach((e, i) => {
        const row = el('div', `row-card ${e.deviceId === this.save.deviceId ? 'me' : ''}`);
        // Gold, silver and bronze for the podium; a number is enough for everybody below it.
        const medal = placeIcon(i + 1, 30);
        const place = el('div', 'rank');
        if (medal) place.append(medal); else place.textContent = `#${i + 1}`;
        row.append(place);
        const info = el('div', 'info');
        const nameRow = el('div', 'name-row');
        nameRow.append(el('div', 'name', e.name));
        if (e.title) nameRow.append(el('span', 'worn-title', e.title));
        // A world first is the rarest thing anyone can hold: it is worth a badge on the board.
        if (e.firsts) {
          const badge = el('span', 'firsts', `★ ${e.firsts}`);
          badge.title = `${e.firsts} spell${e.firsts === 1 ? '' : 's'} drawn first in the world`;
          nameRow.append(badge);
        }
        info.append(nameRow, el('div', 'desc', by === 'best'
          ? `Level ${e.best} · ${arenaFor(e.rating).name}`
          : `${arenaFor(e.rating).name} ${e.rating} · ${e.wins} wins · level ${e.best}`));
        row.append(info);
        body.append(row);
      });
    };
    for (const [by, label, icon] of [['best', 'Campaign', 'sword'], ['rating', 'Duels', 'swords']] as const) {
      const t = el('button', 'tab');
      t.append(uiIcon(icon, 22, '#ffcc33'), el('span', '', label));
      t.dataset.by = by;
      t.addEventListener('click', () => { sfx.click(); void render(by); });
      tabs.append(t);
    }
    s.append(head, tabs, body);
    this.show('ranks');
    void api.postScore(this.save.deviceId, this.save.name, this.save.best, this.save.title).then(() => render('best'));
  }

  showAchievements(): void {
    this.stopLoop();
    const s = this.screens.achievements;
    s.innerHTML = '';
    const head = el('div', 'shop-head');
    const done = this.save.achievements.length;
    head.append(btn('◀', 'small ghost', () => this.showMenu()), el('h1', '', 'AWARDS'), this.countPill('medal', '#ffcc33', `${done} / ${ACHIEVEMENTS.length}`));
    const body = el('div', 'shop-body');
    for (const a of ACHIEVEMENTS) {
      const got = this.save.achievements.includes(a.id);
      const row = el('div', `row-card ${got ? 'done' : ''}`);
      const info = el('div', 'info'); info.append(el('div', 'name', a.name), el('div', 'desc', a.desc));
      const mark = el('div', `award-mark ${got ? '' : 'locked'}`);
      mark.append(achievementIcon(a.id, 34));
      if (got) mark.append(el('span', 'award-tick', '★'));
      row.append(mark, info, el('div', 'coins', fmt(a.coins)));
      body.append(row);
    }
    s.append(head, body);
    this.show('achievements');
  }


  // ---------------------------------------------------------------- fake ad (outside YouTube)
  showFakeAd(): Promise<boolean> {
    return new Promise(resolve => {
      this.openOverlay((box, close) => {
        box.classList.add('ad-box');
        const fake = el('div', 'screen-fake', 'AD  3');
        box.append(el('h2', '', 'Demo ad'), fake, el('div', 'note', 'Inside YouTube this is a real rewarded ad.'));
        let n = 3;
        const iv = setInterval(() => {
          n--;
          fake.textContent = n > 0 ? `AD  ${n}` : 'Reward granted';
          if (n <= 0) { clearInterval(iv); setTimeout(() => { close(); resolve(true); }, 500); }
        }, 1000);
      });
    });
  }
}


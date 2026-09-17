// DOM screens, HUD, draw pad, shop and training. Owns the battle loop.
import logoUrl from './assets/swag-logo.png';
import { setMusic, sfx, unlockAudio } from './audio';
import { Battle, type BattleEvent } from '@wizard/shared';
import {
  AD_REWARD, EQUIPMENT, EQUIP_BY_ID, EQUIP_SLOTS, HAT_STYLES, MAX_LEVEL, PLAYER_LOOK, SPELLS, SPELL_BY_ID, UPGRADES, enemyForLevel, isBossLevel, shiftColor, upgradePrice,
  type EnemyDef, type HatStyle, type SpellDef, type StageId, type WizardLook,
} from '@wizard/shared';
import { GLYPHS, drawGlyph, type Point } from '@wizard/shared';
import { gearIcon, makePixelCanvas, slotIcon, upgradeIcon } from './icons';
import { Recognizer } from '@wizard/shared';
import { computeStats, type SaveData } from './save';
import { Arena } from './scene';
import { CONFIG, platform, webPlatform } from './platform';
import { setMusicEnabled, setSfxEnabled } from './audio';
import { api } from './net/api';
import { ACHIEVEMENTS, evaluateAchievements } from './features/achievements';
import { challengeAvailable, claimDaily, dailyChallenge, markChallengeDone, nextRewardTime, type Challenge } from './features/daily';
import { BotSession, GhostSession, OnlineSession, fetchGhost, type DuelMode, type DuelSession } from './duel/session';
import type { BattleLike } from './duel/view';

const RECOGNIZE_THRESHOLD = 0.6;
const HAT_PRICES: Record<HatStyle, number> = { pointy: 0, hood: 800, wide: 1200, turban: 1500, crown: 3000, horns: 5000 };
const HAT_NAMES: Record<HatStyle, string> = { pointy: 'Classic Pointy', hood: 'Shadow Hood', wide: 'Witch Brim', turban: 'Sultan Turban', crown: 'Royal Crown', horns: 'Warlord Horns' };

/** The hero's look: the chosen hat over the classic blue robes. */
function playerLook(save: SaveData): WizardLook { return { ...PLAYER_LOOK, hatStyle: save.hat }; }

/** A stable outfit for an opponent we only know by name. */
function lookFromName(name: string): WizardLook {
  const h = [...name].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  return { robe: shiftColor('#c04040', (h % 10) / 10), hat: shiftColor('#802020', (h % 10) / 10), trim: '#ffd23f', skin: '#e8c39e', hatStyle: HAT_STYLES[h % HAT_STYLES.length], beard: h % 3 !== 0, cape: h % 2 === 0 };
}

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
    drawGlyph(g, spell.glyph, px * 0.15, px * 0.15, px * 0.7, spell.color, 2.4);
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

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

/** A blank progression block for the reset button (identity and settings are kept by the caller). */
function parseSaveFresh(): Partial<SaveData> {
  return {
    coins: 0, level: 1, best: 0, owned: [...SPELLS.filter(s => s.price === 0).map(s => s.id)], loadout: [...SPELLS.filter(s => s.price === 0).map(s => s.id)],
    upgrades: {}, equipOwned: [], equipped: {}, wins: 0, losses: 0, earned: 0, adsWatched: 0,
    daily: { lastClaim: '', streak: 0, challengeDate: '', challengeDone: false }, achievements: [],
    stats: { dodges: 0, casts: 0, bossWins: 0, duelWins: 0, duelLosses: 0, ghostWins: 0, ghostLosses: 0, metersCast: 0 }, reviewAsked: false, rating: 1000,
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

type ScreenId = 'menu' | 'levels' | 'battle' | 'result' | 'shop' | 'duel' | 'settings' | 'ranks' | 'achievements';
type ShopTab = 'spells' | 'upgrades' | 'gear' | 'hats' | 'coins' | 'bank' | 'training';

export class UI {
  private save: SaveData;
  private onChange: () => void;
  private screens: Record<ScreenId, HTMLElement>;
  private overlay: HTMLElement;
  private pickedLevel: number;

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
  private padHint: SpellDef | null = null;
  private padHintT = 0;
  private castMsgT = 0;
  private lastDps = { t: 0, dmg: 0, dps: 0 };
  private arrangeControls: (() => void) | null = null;

  constructor(root: HTMLElement, save: SaveData, onChange: () => void) {
    this.save = save;
    this.onChange = onChange;
    this.pickedLevel = Math.min(save.level, MAX_LEVEL);

    root.innerHTML = '';
    this.screens = {
      menu: el('div', 'screen'), levels: el('div', 'screen'), battle: el('div', 'screen'), result: el('div', 'screen'), shop: el('div', 'screen'),
      duel: el('div', 'screen'), settings: el('div', 'screen'), ranks: el('div', 'screen'), achievements: el('div', 'screen'),
    };
    for (const [id, s] of Object.entries(this.screens)) { s.id = id; root.append(s); }
    this.overlay = el('div', 'overlay');
    this.toasts = el('div', 'toasts');
    root.append(this.overlay, this.toasts);
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

  private show(id: ScreenId): void {
    if (this.overlayDismiss) this.overlayDismiss();
    for (const [k, s] of Object.entries(this.screens)) s.classList.toggle('active', k === id);
  }

  private commit(): void { this.onChange(); }

  // ---------------------------------------------------------------- menu
  showMenu(): void {
    this.stopLoop();
    setMusic('menu');
    const m = this.screens.menu;
    m.innerHTML = '';
    const title = el('div', 'title'); title.innerHTML = 'WIZARD<span>1v1s</span>';
    const sub = el('div', 'subtitle', '~ Dodge. Draw. Destroy. ~');
    const card = el('div', 'menu-card frame');

    const topRow = el('div', 'menu-top');
    const coins = el('div', 'coins', fmt(this.save.coins));
    const who = el('div', 'who', `${this.save.name} · ${this.save.rating}`);
    topRow.append(coins, who);
    const best = el('div', 'stats-line', this.save.best ? `Best: level ${this.save.best} cleared` : 'No levels cleared yet');
    const play = btn('PLAY', 'gold big', () => this.showLevels());
    const duelBtn = btn('DUEL', 'red big', () => this.showDuelMenu());
    const row = el('div', 'menu-row');
    row.append(btn('Shop', 'blue', () => this.showShop('spells')), btn('Training', 'green', () => this.startBattle(Math.min(MAX_LEVEL, Math.max(1, this.save.best)), true)));
    const row2 = el('div', 'menu-row');
    row2.append(btn('Ranks', 'ghost', () => this.showRanks()), btn('Awards', 'ghost', () => this.showAchievements()), btn('Settings', 'ghost', () => this.showSettings()));
    card.append(topRow, play, duelBtn, row, row2, best);
    const howto = el('div', 'howto', 'Draw a spell glyph on the pad to cast it. Spells lock on by themselves. Tap the side buttons (or swipe) to dodge the enemy\'s bolts. Win coins, buy spells, beat 100 levels.');
    m.append(title, sub, card, howto);
    this.show('menu');
    if (!this.dailyChecked) { this.dailyChecked = true; this.checkDaily(); }
  }

  // ---------------------------------------------------------------- daily reward
  private checkDaily(): void {
    const reward = claimDaily(this.save);
    if (this.save.settings.notifications) void platform.scheduleReminder(1, 'Wizard 1v1s', 'Your daily reward is ready. The tower awaits!', nextRewardTime());
    if (!reward) return;
    this.commit();
    platform.haptic('success');
    sfx.coin();
    this.openOverlay((box, close) => {
      box.append(el('h2', '', 'DAILY REWARD'), el('div', 'note', `Day ${reward.day} of your streak`), el('div', 'reward', `+${fmt(reward.coins)} coins`));
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

  showLevels(): void {
    this.stopLoop();
    setMusic('menu');
    const s = this.screens.levels;
    s.innerHTML = '';
    const head = el('div', 'shop-head');
    head.append(btn('◀', 'small ghost', () => this.showMenu()), el('h1', '', 'CHOOSE A LEVEL'), el('div', 'coins', fmt(this.save.coins)));
    const body = el('div', 'levels-body');
    // Daily challenge: one modified fight per day for triple coins.
    const ch = dailyChallenge(this.save);
    const chCard = el('div', 'card challenge');
    const chInfo = el('div');
    chInfo.append(el('div', 'name', ch.name), el('div', 'desc', `${ch.desc} Level ${ch.level}: ${ch.enemy.name}. Triple coins.`));
    chCard.append(chInfo);
    if (challengeAvailable(this.save)) chCard.append(btn('FIGHT', 'gold', () => this.startBattle(ch.level, false, ch)));
    else chCard.append(btn('Done today', 'ghost'));
    body.append(chCard);
    const grid = el('div', 'level-grid');
    const maxPick = Math.min(MAX_LEVEL, this.save.best + 1);
    if (this.pickedLevel > maxPick) this.pickedLevel = maxPick;
    const info = el('div', 'level-info');
    const foot = el('div', 'shop-foot');
    const tiles: HTMLElement[] = [];
    const renderInfo = (): void => {
      const e = enemyForLevel(this.pickedLevel);
      const cleared = this.pickedLevel <= this.save.best;
      info.innerHTML = `<b>Level ${this.pickedLevel}</b> <span class="${e.boss ? 'boss' : ''}">${e.boss ? 'BOSS: ' : ''}${e.name}</span><small>${fmt(e.hp)} HP · ${e.damage} dmg per hit · ${cleared ? `cleared, replay pays ${fmt(Math.round(e.coins * 0.6))}` : `${fmt(e.coins)} coins`}</small>`;
      tiles.forEach((t, i) => t.classList.toggle('picked', i + 1 === this.pickedLevel));
    };
    for (let L = 1; L <= MAX_LEVEL; L++) {
      const boss = isBossLevel(L);
      const state = L <= this.save.best ? 'done' : L === maxPick ? 'next' : 'locked';
      const t = el('button', `level-tile ${state} ${boss ? 'boss' : ''}`);
      t.innerHTML = `<b>${L}</b>${boss ? '<i>BOSS</i>' : ''}`;
      if (state === 'locked') t.disabled = true;
      else t.addEventListener('click', () => { unlockAudio(); sfx.click(); this.pickedLevel = L; renderInfo(); });
      tiles.push(t); grid.append(t);
    }
    body.append(grid);
    foot.append(btn('BATTLE', 'gold big', () => this.startBattle(this.pickedLevel, false)));
    s.append(head, body, info, foot);
    renderInfo();
    this.show('levels');
    tiles[this.pickedLevel - 1]?.scrollIntoView({ block: 'center' });
  }

  // ---------------------------------------------------------------- battle
  private startBattle(level: number, training: boolean, challenge: Challenge | null = null): void {
    unlockAudio();
    this.training = training;
    this.duel = null;
    this.challenge = challenge;
    this.battleLevel = level;
    const enemy = challenge ? challenge.enemy : enemyForLevel(level);
    const stats = computeStats(this.save);
    const loadout = this.save.loadout.map(id => SPELL_BY_ID[id]).filter(Boolean);
    this.battle = new Battle({ enemy, stats, loadout, training });
    this.recognizer.clear();
    for (const s of loadout) this.recognizer.add(s.id, GLYPHS[s.glyph].points);

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

    this.lastT = performance.now();
    this.stopLoop();
    this.loopId = requestAnimationFrame(t => this.loop(t));
  }

  // ---------------------------------------------------------------- duels
  showDuelMenu(): void {
    this.stopLoop();
    setMusic('menu');
    const s = this.screens.duel;
    s.innerHTML = '';
    const head = el('div', 'shop-head');
    head.append(btn('◀', 'small ghost', () => this.showMenu()), el('h1', '', 'DUELS'), el('div', 'coins', fmt(this.save.coins)));
    const body = el('div', 'shop-body');
    const me = el('div', 'card');
    const st = this.save.stats;
    me.append(el('div', 'name', `${this.save.name} · rating ${this.save.rating}`), el('div', 'desc', `Online ${st.duelWins}W ${st.duelLosses}L · Ghosts ${st.ghostWins}W ${st.ghostLosses}L`));
    const status = el('div', 'note', 'Checking the duel server...');
    me.append(status);
    body.append(me);
    void api.health().then(h => { status.textContent = h ? `Server online · ${h.players} wizards · ${h.ghosts} ghosts` : 'Server unreachable: online and ghost duels need a connection. Practice still works.'; });

    const mk = (title: string, desc: string, label: string, cls: string, run: () => void): void => {
      const c = el('div', 'card');
      c.append(el('div', 'name', title), el('div', 'desc', desc), btn(label, cls, run));
      body.append(c);
    };
    mk('Ranked duel', 'Live 1v1 against another player with a fair fixed build. Wins raise your rating.', 'FIND RANKED MATCH', 'gold', () => void this.startOnline(true));
    mk('Casual duel', 'Live 1v1 with your own spells and gear. No rating change. A bot joins if nobody is around.', 'FIND CASUAL MATCH', 'blue', () => void this.startOnline(false));
    mk('Ghost duel', 'Fight a recording of another player. Your own runs are uploaded as ghosts too.', 'FIGHT A GHOST', 'green', () => void this.startGhost());
    const prac = el('div', 'card');
    prac.append(el('div', 'name', 'Practice'), el('div', 'desc', 'Offline duel against a bot. Pick your challenge.'));
    const row = el('div', 'menu-row');
    row.append(btn('Easy', 'ghost', () => this.startDuel(new BotSession(this.save, 'easy'))), btn('Normal', 'ghost', () => this.startDuel(new BotSession(this.save, 'normal'))), btn('Hard', 'ghost', () => this.startDuel(new BotSession(this.save, 'hard'))));
    prac.append(row);
    body.append(prac);
    const tips = el('div', 'card');
    tips.append(el('div', 'name', 'How duels differ'), el('div', 'desc', 'Spells chase the opponent\'s lane until halfway, then commit: dodge late. Both wizards have extra health, so read the pad, bait dodges, and save stamina.'));
    body.append(tips);
    s.append(head, body);
    this.show('duel');
  }

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
    this.recognizer.clear();
    for (const s of session.view.loadout) this.recognizer.add(s.id, GLYPHS[s.glyph].points);
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
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    if (this.duel) {
      const d = this.duel;
      d.tick(dt);
      // The battle view can be replaced once the server starts the match.
      if (this.battle !== d.view) { this.battle = d.view; this.recognizer.clear(); for (const s of d.view.loadout) this.recognizer.add(s.id, GLYPHS[s.glyph].points); this.buildHud(d.view.enemyDef, d.view.loadout); this.hud.enemyLvl.textContent = d.mode.toUpperCase(); }
      const c = Math.ceil(d.countdown);
      if (c !== this.duelCountdownShown) { this.duelCountdownShown = c; if (c > 0) this.banner(String(c), d.status); else this.banner('DUEL!', `vs ${d.opponentName}`); }
      if (d.outcome && (d.view.overT > 1.8 || d.outcome.reason !== 'ko')) { this.endDuel(); return; }
    } else {
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
    padWrap.append(pad, castMsg);
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
    if (this.battle.dodge(dir)) { sfx.dodge(); this.save.stats.dodges++; if (this.save.settings.haptics) platform.haptic('light'); }
  }

  private onKey(e: KeyboardEvent): void {
    const inBattle = this.screens.battle.classList.contains('active') && this.battle;
    if (e.key === 'Escape') {
      if (this.overlay.classList.contains('active')) { if (this.overlayDismiss) this.overlayDismiss(); return; }
      if (this.screens.shop.classList.contains('active') || this.screens.result.classList.contains('active') || this.screens.levels.classList.contains('active')) { this.showMenu(); return; }
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
            const chip = this.hud.chips.get(ev.spell.id); if (chip) { chip.classList.add('flash'); setTimeout(() => chip.classList.remove('flash'), 220); }
          } else sfx.cast(0.6);
          break;
        case 'telegraph': sfx.telegraph(); if (ev.kind === 'heal') this.popup('Healing...', 'enemy', 'small', '#7dff9b'); if (ev.kind === 'shield') this.popup('Shielding', 'enemy', 'small', '#6ea8ff'); break;
        case 'damage':
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
        case 'death': if (ev.who === 'enemy') { sfx.win(); this.banner('VICTORY', ''); } else { sfx.lose(); this.banner('DEFEATED', ''); } break;
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
    if (this.padFlash > 0 || this.padHintT > 0 || this.padDrawing) {
      this.padFlash = Math.max(0, this.padFlash - dt);
      this.padHintT = Math.max(0, this.padHintT - dt);
      if (this.padHintT <= 0) this.padHint = null;
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

  private finishStroke(): void {
    const b = this.battle; if (!b) return;
    const pad = this.hud.pad;
    const m = this.recognizer.recognize(this.padPoints);
    this.padFlash = 0.45;
    if (!m || m.score < RECOGNIZE_THRESHOLD) {
      pad.classList.add('bad');
      this.castMessage(m ? `Unclear... ${SPELL_BY_ID[m.key]?.name ?? ''}?` : 'Draw bigger', true);
      sfx.fizzle();
      return;
    }
    const spell = SPELL_BY_ID[m.key];
    // Stronger spells need a clearer and larger stroke, so a tiny scribble cannot spam them.
    if (m.score < RECOGNIZE_THRESHOLD + 0.1 * (spell.cost / 65)) {
      pad.classList.add('bad');
      this.castMessage(`Draw ${spell.name} more clearly`, true);
      sfx.fizzle();
      return;
    }
    const rect = pad.getBoundingClientRect();
    const coverage = strokeExtent(this.padPoints) / Math.max(1, Math.min(rect.width, rect.height));
    if (coverage < requiredCoverage(spell)) {
      pad.classList.add('bad');
      this.castMessage(`Draw ${spell.name} bigger!`, true);
      this.padHint = spell; this.padHintT = 1.6;
      sfx.fizzle();
      return;
    }
    const r = b.cast(spell.id);
    if (r === 'ok') { pad.classList.add('ok'); this.castMessage(`${spell.name}!`, false); }
    else pad.classList.add('bad');
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
    if (this.padHint) {
      // Ghost glyph drawn at the size the spell actually requires (templates fill ~86% of their box).
      const size = (Math.min(w, h) * requiredCoverage(this.padHint)) / 0.86;
      g.save(); g.globalAlpha = 0.35 + Math.min(1, this.padHintT) * 0.3;
      drawGlyph(g, this.padHint.glyph, (w - size) / 2, (h - size) / 2, size, this.padHint.color, 4 * dpr);
      g.restore();
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
    if (outcome === 'win') {
      this.save.wins++;
      if (enemy.boss) this.save.stats.bossWins++;
      if (challenge) markChallengeDone(this.save);
      if (level > this.save.best && !challenge) { this.save.best = level; void api.postScore(this.save.deviceId, this.save.name, level); }
      if (!challenge) { this.save.level = Math.min(MAX_LEVEL, Math.max(this.save.level, level + 1)); this.pickedLevel = Math.min(MAX_LEVEL, level + 1); }
      if (this.save.settings.haptics) platform.haptic('success');
    } else {
      this.save.losses++;
      this.pickedLevel = level;
      if (this.save.settings.haptics) platform.haptic('error');
    }
    this.challenge = null;
    this.commit();
    this.afterProgress();
    this.battle = null;
    this.arena.setRunning(false);
    this.showResult(outcome, reward, level, enemy);
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

  private showResult(outcome: 'win' | 'lose', reward: number, level: number, enemy: EnemyDef): void {
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
    if (outcome === 'win' && level < MAX_LEVEL) card.append(btn(`NEXT: LEVEL ${level + 1}`, 'gold big', () => this.startBattle(level + 1, false)));
    if (outcome === 'lose') card.append(btn('RETRY', 'gold big', () => this.startBattle(level, false)));
    const row = el('div', 'menu-row');
    row.append(btn('Shop', 'green', () => this.showShop('spells')), btn('Menu', '', () => this.showMenu()));
    card.append(row);
    s.append(card);
    this.show('result');
  }

  private leaveTraining(): void {
    this.stopLoop();
    this.battle = null;
    this.arena?.setRunning(false);
    this.showShop('training');
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
  private shopTab: ShopTab = 'spells';

  showShop(tab: ShopTab): void {
    this.stopLoop();
    setMusic('menu');
    this.shopTab = tab;
    this.renderShop();
    this.show('shop');
  }

  private renderShop(): void {
    const s = this.screens.shop;
    const scrollTop = (s.querySelector('.shop-body') as HTMLElement | null)?.scrollTop ?? 0;
    s.innerHTML = '';
    const head = el('div', 'shop-head');
    head.append(btn('◀', 'small ghost', () => this.showMenu()), el('h1', '', 'SHOP'), el('div', 'coins', fmt(this.save.coins)));
    const tabs = el('div', 'tabs');
    const names: [ShopTab, string][] = [['spells', 'Spells'], ['upgrades', 'Upgrades'], ['gear', 'Gear'], ['hats', 'Hats'], ['coins', 'Coins'], ['bank', 'Bank'], ['training', 'Training']];
    for (const [id, label] of names) {
      const t = el('button', `tab ${this.shopTab === id ? 'active' : ''}`, label);
      t.addEventListener('click', () => { sfx.click(); this.shopTab = id; this.renderShop(); });
      tabs.append(t);
    }
    const body = el('div', 'shop-body');
    switch (this.shopTab) {
      case 'spells': this.renderSpells(body); break;
      case 'upgrades': this.renderUpgrades(body); break;
      case 'gear': this.renderGear(body); break;
      case 'hats': this.renderHats(body); break;
      case 'coins': this.renderCoins(body); break;
      case 'bank': this.renderBank(body); break;
      case 'training': this.renderTraining(body); break;
    }
    const foot = el('div', 'shop-foot');
    const lvl = Math.min(MAX_LEVEL, this.pickedLevel);
    foot.append(btn(`BATTLE: LEVEL ${lvl}`, 'gold', () => this.startBattle(lvl, false)));
    s.append(head, tabs, body, foot);
    body.scrollTop = scrollTop;
  }

  private renderSpells(body: HTMLElement): void {
    const stats = computeStats(this.save);
    const title = el('div', 'section-title');
    title.innerHTML = `Loadout <small>${this.save.loadout.length} / ${stats.slots} slots. Only equipped spells can be drawn.</small>`;
    body.append(title);
    const grid = el('div', 'grid');
    const sorted = [...SPELLS].sort((a, b) => a.price - b.price);
    for (const sp of sorted) {
      const owned = this.save.owned.includes(sp.id);
      const equipped = this.save.loadout.includes(sp.id);
      const card = el('div', `card ${equipped ? 'equipped' : ''} ${owned ? '' : 'locked'}`);
      const head = el('div', 'head');
      const nameBox = el('div');
      nameBox.append(el('div', 'name', sp.name), el('div', 'kind', `${sp.kind} · ${GLYPHS[sp.glyph].label}`));
      head.append(glyphCanvas(sp), nameBox);
      const meta = el('div', 'meta');
      meta.innerHTML = `<span>${sp.cost ? `${sp.cost} mana` : 'no mana'}</span><span>${sp.cooldown ? `${sp.cooldown}s cd` : ''}</span>`;
      card.append(head, el('div', 'desc', sp.desc), meta);
      if (!owned) {
        const b = btn(`Buy · ${fmt(sp.price)}`, 'gold', () => this.buySpell(sp));
        b.disabled = this.save.coins < sp.price;
        card.append(b);
      } else if (equipped) {
        const b = btn('Unequip', 'ghost', () => { this.save.loadout = this.save.loadout.filter(id => id !== sp.id); this.commit(); this.renderShop(); });
        b.disabled = this.save.loadout.length <= 1;
        card.append(b);
      } else {
        const b = btn('Equip', 'green', () => { this.save.loadout.push(sp.id); this.commit(); this.renderShop(); });
        b.disabled = this.save.loadout.length >= stats.slots;
        if (b.disabled) b.textContent = 'Loadout full';
        card.append(b);
      }
      grid.append(card);
    }
    body.append(grid);
  }

  private buySpell(sp: SpellDef): void {
    if (this.save.coins < sp.price || this.save.owned.includes(sp.id)) return;
    this.save.coins -= sp.price;
    this.save.owned.push(sp.id);
    const stats = computeStats(this.save);
    if (this.save.loadout.length < stats.slots) this.save.loadout.push(sp.id);
    sfx.buy();
    this.commit();
    this.renderShop();
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

  private renderGear(body: HTMLElement): void {
    for (const slot of EQUIP_SLOTS) {
      const title = el('div', 'section-title');
      const cur = this.save.equipped[slot.id];
      const tl = el('span', 'with-icon'); tl.append(slotIcon(slot.id, 26), document.createTextNode(slot.name));
      title.append(tl, el('small', '', cur ? EQUIP_BY_ID[cur].name : 'nothing equipped'));
      body.append(title);
      const grid = el('div', 'grid');
      for (const e of EQUIPMENT.filter(x => x.slot === slot.id)) {
        const owned = this.save.equipOwned.includes(e.id);
        const equipped = cur === e.id;
        const card = el('div', `card ${equipped ? 'equipped' : ''}`);
        const head = el('div', 'head'); const nb = el('div');
        nb.append(el('div', 'name', e.name), el('div', 'kind', `${slot.name} · tier ${e.tier}`));
        head.append(gearIcon(e.slot, e.tier), nb);
        card.append(head, el('div', 'desc', e.desc));
        if (!owned) {
          const b = btn(`Buy · ${fmt(e.price)}`, 'gold', () => {
            if (this.save.coins < e.price) return;
            this.save.coins -= e.price;
            this.save.equipOwned.push(e.id);
            this.save.equipped[slot.id] = e.id;
            sfx.buy();
            this.commit();
            this.renderShop();
          });
          b.disabled = this.save.coins < e.price;
          card.append(b);
        } else if (equipped) {
          card.append(btn('Equipped', 'ghost', () => { delete this.save.equipped[slot.id]; this.commit(); this.renderShop(); }));
        } else {
          card.append(btn('Equip', 'green', () => { this.save.equipped[slot.id] = e.id; this.commit(); this.renderShop(); }));
        }
        grid.append(card);
      }
      body.append(grid);
    }
  }

  private renderCoins(body: HTMLElement): void {
    const amount = AD_REWARD(this.save.best + 1);
    const card = el('div', 'card ad-card');
    card.append(el('div', 'name', 'Watch an ad, earn coins'), el('div', 'big-coins', `+${fmt(amount)}`),
      el('div', 'note', 'The reward grows with your best level.'));
    const b = btn('WATCH AD', 'gold big', async () => {
      b.disabled = true;
      const ok = await platform.showRewardedAd();
      if (ok) {
        this.save.coins += amount;
        this.save.earned += amount;
        this.save.adsWatched++;
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
    tips.append(el('div', 'name', 'Other ways to earn'), el('div', 'desc', 'Replaying a cleared level pays 60% of its reward. Losing still pays 25%. Boss levels pay triple. The Lucky Coin and Chrono Amulet charms multiply everything.'));
    body.append(tips);
  }

  private renderHats(body: HTMLElement): void {
    const title = el('div', 'section-title');
    title.innerHTML = `Hats <small>Cosmetic. Worn in every battle and shown to duel opponents.</small>`;
    body.append(title);
    const grid = el('div', 'grid');
    for (const hat of HAT_STYLES) {
      const owned = this.save.hats.includes(hat);
      const worn = this.save.hat === hat;
      const card = el('div', `card ${worn ? 'equipped' : ''}`);
      card.append(el('div', 'name', HAT_NAMES[hat]), el('div', 'desc', hat === 'pointy' ? 'The one every apprentice starts with.' : `A ${hat} for the discerning duellist.`));
      if (!owned) {
        const price = HAT_PRICES[hat];
        const b = btn(`Buy · ${fmt(price)}`, 'gold', () => {
          if (this.save.coins < price) return;
          this.save.coins -= price; this.save.hats.push(hat); this.save.hat = hat;
          sfx.buy(); this.commit(); this.afterProgress(); this.renderShop();
        });
        b.disabled = this.save.coins < price;
        card.append(b);
      } else if (worn) card.append(btn('Wearing', 'ghost'));
      else card.append(btn('Wear', 'green', () => { this.save.hat = hat; this.commit(); this.renderShop(); }));
      grid.append(card);
    }
    body.append(grid);
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
      { sku: CONFIG.skus.hatPack, name: 'Hat pack', desc: 'Unlocks every hat at once.', owned: HAT_STYLES.every(h => this.save.hats.includes(h)), fallback: '$2.99' },
    ];
    const grid = el('div', 'grid');
    for (const it of items) {
      const card = el('div', `card ${it.owned ? 'equipped' : ''}`);
      card.append(el('div', 'name', it.name), el('div', 'desc', it.desc));
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
    if (sku === CONFIG.skus.coinsSmall && !restoring) { this.save.coins += CONFIG.coinsSmall; this.save.earned += CONFIG.coinsSmall; }
    if (sku === CONFIG.skus.coinsLarge && !restoring) { this.save.coins += CONFIG.coinsLarge; this.save.earned += CONFIG.coinsLarge; }
    if (sku === CONFIG.skus.doubleCoins) this.save.passes.doubleCoins = true;
    if (sku === CONFIG.skus.noAds) this.save.passes.noAds = true;
    if (sku === CONFIG.skus.hatPack) this.save.hats = [...HAT_STYLES];
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
    ];
    for (const [key, name, desc] of toggles) {
      const row = el('div', 'row-card');
      const info = el('div', 'info'); info.append(el('div', 'name', name), el('div', 'desc', desc));
      const b = btn(this.save.settings[key] ? 'ON' : 'OFF', this.save.settings[key] ? 'green small' : 'ghost small', () => {
        this.save.settings[key] = !this.save.settings[key];
        if (key === 'music') setMusicEnabled(this.save.settings.music);
        if (key === 'sfx') setSfxEnabled(this.save.settings.sfx);
        if (key === 'notifications' && !this.save.settings.notifications) void platform.cancelReminders();
        this.commit(); this.showSettings();
      });
      row.append(info, b);
      body.append(row);
    }
    const hatCard = el('div', 'card');
    hatCard.append(el('div', 'name', 'Hat'), el('div', 'desc', `Wearing: ${HAT_NAMES[this.save.hat]}. Buy and swap hats in the shop.`), btn('Open hat shop', 'blue small', () => this.showShop('hats')));
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
        const keep = { deviceId: this.save.deviceId, name: this.save.name, settings: this.save.settings, passes: this.save.passes, hats: this.save.hats };
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
    head.append(btn('◀', 'small ghost', () => this.showMenu()), el('h1', '', 'RANKINGS'), el('div', 'coins', fmt(this.save.coins)));
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
        row.append(el('div', 'rank', `#${i + 1}`));
        const info = el('div', 'info'); info.append(el('div', 'name', e.name), el('div', 'desc', by === 'best' ? `Level ${e.best} · rating ${e.rating}` : `Rating ${e.rating} · ${e.wins} wins · level ${e.best}`));
        row.append(info);
        body.append(row);
      });
    };
    for (const [by, label] of [['best', 'Campaign'], ['rating', 'Duels']] as const) {
      const t = el('button', 'tab', label); t.dataset.by = by;
      t.addEventListener('click', () => { sfx.click(); void render(by); });
      tabs.append(t);
    }
    s.append(head, tabs, body);
    this.show('ranks');
    void api.postScore(this.save.deviceId, this.save.name, this.save.best).then(() => render('best'));
  }

  showAchievements(): void {
    this.stopLoop();
    const s = this.screens.achievements;
    s.innerHTML = '';
    const head = el('div', 'shop-head');
    const done = this.save.achievements.length;
    head.append(btn('◀', 'small ghost', () => this.showMenu()), el('h1', '', 'AWARDS'), el('div', 'coins', `${done} / ${ACHIEVEMENTS.length}`));
    const body = el('div', 'shop-body');
    for (const a of ACHIEVEMENTS) {
      const got = this.save.achievements.includes(a.id);
      const row = el('div', `row-card ${got ? 'done' : ''}`);
      const info = el('div', 'info'); info.append(el('div', 'name', a.name), el('div', 'desc', a.desc));
      row.append(el('div', 'rank', got ? '★' : '☆'), info, el('div', 'coins', fmt(a.coins)));
      body.append(row);
    }
    s.append(head, body);
    this.show('achievements');
  }

  private renderTraining(body: HTMLElement): void {
    const card = el('div', 'card ad-card');
    card.append(el('div', 'name', 'Training grounds'),
      el('div', 'desc', 'Practice your glyphs on a dummy with endless health. See your damage and DPS, toggle the dummy to fight back to rehearse dodges, refill any time. No coins, no risk.'));
    card.append(btn('ENTER TRAINING', 'green big', () => this.startBattle(Math.max(1, this.save.best), true)));
    body.append(card);
    const ref = el('div', 'card');
    ref.append(el('div', 'name', 'Your glyphs'), el('div', 'desc', 'Tap a spell in battle to see its glyph on the pad. The dot marks where the stroke starts, but either direction works.'));
    const grid = el('div', 'grid');
    for (const id of this.save.loadout) {
      const sp = SPELL_BY_ID[id]; if (!sp) continue;
      const c = el('div', 'card'); const head = el('div', 'head'); const nb = el('div');
      nb.append(el('div', 'name', sp.name), el('div', 'kind', GLYPHS[sp.glyph].label));
      head.append(glyphCanvas(sp), nb); c.append(head); grid.append(c);
    }
    ref.append(grid);
    body.append(ref);
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


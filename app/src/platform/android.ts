// Capacitor implementation for the Android app: Preferences for saves, App for lifecycle and the
// back button, AdMob rewarded ads with the UMP consent flow, Play Billing through cordova-plugin-purchase,
// haptics, local notifications and the browser for the privacy policy.
/// <reference types="cordova-plugin-purchase" />
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { StatusBar } from '@capacitor/status-bar';
import { AdMob, AdmobConsentStatus, RewardAdPluginEvents } from '@capacitor-community/admob';
import { CONFIG } from './config';
import type { HapticKind, Platform, PurchaseResult } from './types';

const KEY = 'save';

export class AndroidPlatform implements Platform {
  readonly native = true;
  private pauseCbs: (() => void)[] = [];
  private resumeCbs: (() => void)[] = [];
  private backCbs: (() => boolean)[] = [];
  private adsReady = false;
  private adLoading: Promise<void> | null = null;
  private prices = new Map<string, string>();
  private storeReady = false;
  private pendingPurchase: { sku: string; resolve: (r: PurchaseResult) => void } | null = null;
  private owned = new Set<string>();

  async init(): Promise<void> {
    try { await StatusBar.hide(); } catch { /* not critical */ }
    App.addListener('appStateChange', ({ isActive }) => { (isActive ? this.resumeCbs : this.pauseCbs).forEach(cb => cb()); });
    App.addListener('backButton', () => { if (!this.backCbs.some(cb => cb())) void App.minimizeApp(); });
    void this.initAds();
    this.initStore();
  }

  // ---- storage ---------------------------------------------------------------
  async load(): Promise<string | null> {
    const { value } = await Preferences.get({ key: KEY });
    if (value) return value;
    // First run after migrating from the web build: pick up a localStorage save if present.
    try { return localStorage.getItem('wizard-1v1s-android-save'); } catch { return null; }
  }
  async save(data: string): Promise<void> { await Preferences.set({ key: KEY, value: data }); }

  onPause(cb: () => void): void { this.pauseCbs.push(cb); }
  onResume(cb: () => void): void { this.resumeCbs.push(cb); }
  onBack(cb: () => boolean): void { this.backCbs.push(cb); }

  // ---- ads -------------------------------------------------------------------
  private async initAds(): Promise<void> {
    try {
      await AdMob.initialize();
      // European users must be asked for consent before personalised ads (Google UMP).
      const info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm();
      await this.loadAd();
    } catch (e) { console.warn('AdMob init failed', e); }
  }
  private loadAd(): Promise<void> {
    if (!this.adLoading) {
      this.adLoading = AdMob.prepareRewardVideoAd({ adId: CONFIG.admob.rewardedAdId, isTesting: CONFIG.admob.testing })
        .then(() => { this.adsReady = true; })
        .catch(e => { console.warn('Ad load failed', e); this.adsReady = false; })
        .finally(() => { this.adLoading = null; });
    }
    return this.adLoading;
  }
  adsAvailable(): boolean { return this.adsReady; }
  async showRewardedAd(): Promise<boolean> {
    if (!this.adsReady) { await this.loadAd(); if (!this.adsReady) return false; }
    return new Promise<boolean>(resolve => {
      let rewarded = false;
      const done = (): void => { void rewardedSub.then(s => s.remove()); void dismissSub.then(s => s.remove()); this.adsReady = false; void this.loadAd(); resolve(rewarded); };
      const rewardedSub = AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { rewarded = true; });
      const dismissSub = AdMob.addListener(RewardAdPluginEvents.Dismissed, done);
      AdMob.showRewardVideoAd().catch(() => done());
    });
  }

  // ---- purchases (Google Play Billing via cordova-plugin-purchase) ----------------
  private initStore(): void {
    if (typeof CdvPurchase === 'undefined') return;
    const { store, ProductType, Platform: P } = CdvPurchase;
    const consumables = [CONFIG.skus.coinsSmall, CONFIG.skus.coinsLarge];
    const nonConsumables = [CONFIG.skus.doubleCoins, CONFIG.skus.noAds, CONFIG.skus.hatPack];
    store.register([
      ...consumables.map(id => ({ id, type: ProductType.CONSUMABLE, platform: P.GOOGLE_PLAY })),
      ...nonConsumables.map(id => ({ id, type: ProductType.NON_CONSUMABLE, platform: P.GOOGLE_PLAY })),
    ]);
    store.when()
      .productUpdated(p => { const offer = p.getOffer(); if (offer?.pricingPhases[0]) this.prices.set(p.id, offer.pricingPhases[0].price); })
      .approved(t => t.verify())
      .verified(r => {
        for (const line of r.collection) {
          this.owned.add(line.id);
          if (this.pendingPurchase && this.pendingPurchase.sku === line.id) { this.pendingPurchase.resolve({ ok: true, sku: line.id }); this.pendingPurchase = null; }
        }
        r.finish();
      });
    store.error(err => {
      if (this.pendingPurchase) { this.pendingPurchase.resolve({ ok: false, sku: this.pendingPurchase.sku, message: err.message }); this.pendingPurchase = null; }
    });
    store.initialize([P.GOOGLE_PLAY]).then(() => { this.storeReady = true; });
  }
  purchasesAvailable(): boolean { return this.storeReady; }
  price(sku: string): string | null { return this.prices.get(sku) ?? null; }
  async purchase(sku: string): Promise<PurchaseResult> {
    if (!this.storeReady || typeof CdvPurchase === 'undefined') return { ok: false, sku, message: 'Store not ready' };
    const product = CdvPurchase.store.get(sku, CdvPurchase.Platform.GOOGLE_PLAY);
    const offer = product?.getOffer();
    if (!offer) return { ok: false, sku, message: 'Product not found' };
    return new Promise<PurchaseResult>(resolve => {
      this.pendingPurchase = { sku, resolve };
      offer.order().then(err => { if (err && this.pendingPurchase) { this.pendingPurchase = null; resolve({ ok: false, sku, message: err.message }); } });
    });
  }
  async restorePurchases(): Promise<string[]> {
    if (!this.storeReady || typeof CdvPurchase === 'undefined') return [...this.owned];
    await CdvPurchase.store.restorePurchases();
    return [...this.owned];
  }

  // ---- misc ------------------------------------------------------------------
  haptic(kind: HapticKind): void {
    const run = kind === 'success' ? Haptics.notification({ type: NotificationType.Success })
      : kind === 'error' ? Haptics.notification({ type: NotificationType.Error })
      : Haptics.impact({ style: kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
    run.catch(() => { /* no vibrator */ });
  }
  async scheduleReminder(id: number, title: string, body: string, at: Date): Promise<void> {
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return;
      await LocalNotifications.schedule({ notifications: [{ id, title, body, schedule: { at } }] });
    } catch (e) { console.warn('notification failed', e); }
  }
  async cancelReminders(): Promise<void> {
    try { const pending = await LocalNotifications.getPending(); if (pending.notifications.length) await LocalNotifications.cancel(pending); } catch { /* ignore */ }
  }
  async requestReview(): Promise<void> {
    // Swap for an in-app review plugin later; opening the listing is the reliable fallback.
    await Browser.open({ url: CONFIG.storeUrl });
  }
  openUrl(url: string): void { void Browser.open({ url }); }
  async share(text: string): Promise<void> {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  }
}

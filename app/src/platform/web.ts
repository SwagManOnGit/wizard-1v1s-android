// Browser implementation: localStorage, the Page Visibility API and stand-ins for ads and purchases.
import type { HapticKind, Platform, PurchaseResult } from './types';

const KEY = 'wizard-1v1s-android-save';

export class WebPlatform implements Platform {
  readonly native = false;
  private pauseCbs: (() => void)[] = [];
  private resumeCbs: (() => void)[] = [];
  private backCbs: (() => boolean)[] = [];
  /** The UI installs a demo ad overlay here so the flow can be tested in a browser. */
  fakeAd: (() => Promise<boolean>) | null = null;
  fakePurchase: ((sku: string) => Promise<boolean>) | null = null;

  async init(): Promise<void> {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pauseCbs.forEach(cb => cb()); else this.resumeCbs.forEach(cb => cb());
    });
    window.addEventListener('keydown', e => { if (e.key === 'Escape') this.backCbs.some(cb => cb()); });
  }

  async load(): Promise<string | null> { try { return localStorage.getItem(KEY); } catch { return null; } }
  async save(data: string): Promise<void> { try { localStorage.setItem(KEY, data); } catch { /* private mode */ } }

  onPause(cb: () => void): void { this.pauseCbs.push(cb); }
  onResume(cb: () => void): void { this.resumeCbs.push(cb); }
  onBack(cb: () => boolean): void { this.backCbs.push(cb); }

  adsAvailable(): boolean { return !!this.fakeAd; }
  async showRewardedAd(): Promise<boolean> { return this.fakeAd ? this.fakeAd() : false; }

  purchasesAvailable(): boolean { return import.meta.env.DEV && !!this.fakePurchase; }
  async purchase(sku: string): Promise<PurchaseResult> {
    if (this.fakePurchase) return { ok: await this.fakePurchase(sku), sku };
    return { ok: false, sku, message: 'Purchases are available in the Android app.' };
  }
  async restorePurchases(): Promise<string[]> { return []; }
  price(): string | null { return null; }

  haptic(kind: HapticKind): void {
    // Browsers block vibration before the first tap and log an error; skip it until then.
    if (!('vibrate' in navigator) || !navigator.userActivation?.hasBeenActive) return;
    const ms = kind === 'heavy' ? 40 : kind === 'medium' ? 25 : kind === 'error' ? 60 : 12;
    try { navigator.vibrate(ms); } catch { /* unsupported */ }
  }
  async scheduleReminder(): Promise<void> { /* no local notifications on the web build */ }
  async cancelReminders(): Promise<void> { /* nothing scheduled */ }
  async requestReview(): Promise<void> { /* no store on the web */ }
  openUrl(url: string): void { window.open(url, '_blank', 'noopener'); }
  async share(text: string): Promise<void> {
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    if (nav.share) { try { await nav.share({ text }); } catch { /* cancelled */ } }
    else { try { await navigator.clipboard.writeText(text); } catch { /* denied */ } }
  }
}

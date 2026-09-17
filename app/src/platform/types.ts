// Everything the game needs from the host: storage, lifecycle, ads, purchases, haptics, notifications.
// The web build and the Android build each implement this once; the game never touches a plugin directly.

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'error';

export interface PurchaseResult { ok: boolean; sku: string; message?: string }

export interface Platform {
  /** True inside the Capacitor Android shell. */
  readonly native: boolean;
  init(): Promise<void>;

  load(): Promise<string | null>;
  save(data: string): Promise<void>;

  onPause(cb: () => void): void;
  onResume(cb: () => void): void;
  /** Hardware back button. The callback returns true when it consumed the press. */
  onBack(cb: () => boolean): void;

  /** Resolves true when the player watched the whole rewarded ad. */
  showRewardedAd(): Promise<boolean>;
  adsAvailable(): boolean;

  purchase(sku: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<string[]>;
  price(sku: string): string | null;
  purchasesAvailable(): boolean;

  haptic(kind: HapticKind): void;
  scheduleReminder(id: number, title: string, body: string, at: Date): Promise<void>;
  cancelReminders(): Promise<void>;
  requestReview(): Promise<void>;
  openUrl(url: string): void;
  share(text: string): Promise<void>;
}

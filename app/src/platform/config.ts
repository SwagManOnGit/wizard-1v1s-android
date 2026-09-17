// Ids and URLs you fill in once the accounts exist. Everything defaults to Google's public test ids,
// so the app runs end to end before AdMob, Play Billing or the server are set up.

export const CONFIG = {
  /** Duel server. Set VITE_SERVER_URL at build time (see docs/SERVER.md). */
  serverUrl: (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:2567',
  admob: {
    /** Google's sample rewarded unit; replace with your own from the AdMob console. */
    rewardedAdId: (import.meta.env.VITE_ADMOB_REWARDED as string | undefined) ?? 'ca-app-pub-3940256099942544/5224354917',
    /** Keep true until the real ad unit is in place: test ads are safe, live ads on a test device are not. */
    testing: (import.meta.env.VITE_ADMOB_TESTING as string | undefined) !== 'false',
  },
  skus: {
    coinsSmall: 'wizard_coins_small',
    coinsLarge: 'wizard_coins_large',
    doubleCoins: 'wizard_double_coins',
    noAds: 'wizard_no_ads',
    hatPack: 'wizard_hat_pack',
  },
  /** Coins granted by each consumable purchase and the rewarded ad base amount. */
  coinsSmall: 2000,
  coinsLarge: 12000,
  privacyUrl: 'https://swagmanongit.github.io/wizard-1v1s-android/privacy.html',
  storeUrl: 'https://play.google.com/store/apps/details?id=com.swaggames.wizard1v1s',
  version: '0.1.0',
};

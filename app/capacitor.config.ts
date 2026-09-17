import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.swaggames.wizard1v1s',
  appName: 'Wizard 1v1s',
  webDir: 'dist',
  backgroundColor: '#120c34',
  android: {
    allowMixedContent: false,
    backgroundColor: '#120c34',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0 },
    LocalNotifications: { iconColor: '#ffcc33' },
    StatusBar: { style: 'DARK', backgroundColor: '#120c34' },
  },
};

export default config;

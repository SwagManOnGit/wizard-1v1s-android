import { Capacitor } from '@capacitor/core';
import type { Platform } from './types';
import { WebPlatform } from './web';
import { AndroidPlatform } from './android';

export const platform: Platform = Capacitor.isNativePlatform() ? new AndroidPlatform() : new WebPlatform();
export const webPlatform: WebPlatform | null = platform instanceof WebPlatform ? platform : null;
export type { Platform } from './types';
export { CONFIG } from './config';

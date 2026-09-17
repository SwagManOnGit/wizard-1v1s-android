import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// base './' keeps asset paths relative so the same build runs on GitHub Pages and inside the Capacitor WebView.
export default defineConfig({
  base: './',
  assetsInclude: ['**/*.glb'],
  resolve: {
    alias: { '@wizard/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) },
  },
  build: {
    target: 'es2018',
    assetsInlineLimit: 8192,
    modulePreload: { polyfill: false },
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], capacitor: ['@capacitor/core', '@capacitor/app', '@capacitor/preferences', '@capacitor/haptics', '@capacitor/local-notifications', '@capacitor/browser', '@capacitor/status-bar', '@capacitor-community/admob'], net: ['colyseus.js'] },
      },
    },
  },
  server: { port: 5175, fs: { allow: ['..'] } },
});

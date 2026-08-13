import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { appVersion } from './build-version';

const repoData = fileURLToPath(new URL('../../data', import.meta.url));

export default defineConfig({
  // Relative asset URLs, so the built bundle works when opened from disk and
  // when served from a sub-path — not only from the root of a domain.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'BIP-39 Explorer',
        short_name: 'BIP-39',
        description:
          'An offline explorer for the 2048-word BIP-39 English list: search by spelling, sound or meaning.',
        theme_color: '#4ecdc4',
        background_color: '#fafafa',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The semantic index rides inside the JS bundle, which pushes the
        // precache entry well past Workbox's 2 MB default. Precaching it is
        // the whole point — an installed copy has to work with the network
        // switched off.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
    }),
  ],
  resolve: {
    alias: { '@data': repoData },
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  build: {
    // One chunk. The index dominates the bundle anyway, and a single file is
    // what lets scripts/bundle-single.mjs inline the whole app into one HTML
    // page that runs from a file:// URL.
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
    chunkSizeWarningLimit: 1500,
  },
});

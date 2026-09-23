import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Updates install themselves. With 'prompt' the notice renders inside the
      // app, so anyone stuck on a failing boot could never reach the fix that
      // unsticks them. This is a single-person journal; there is no shared
      // session to disrupt by activating a new worker.
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*', 'icons/*'],
      manifest: {
        name: 'The Museum of My Mind',
        short_name: 'Museum',
        description: 'A private museum for your goals, ideas, notes, and memories.',
        theme_color: '#0a0b10',
        background_color: '#0a0b10',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ico}'],
        navigateFallback: '/index.html',
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});

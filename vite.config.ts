/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  build: {
    // Three.js (Audio Scout) is lazy-loaded and legitimately large.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
          query: ['@tanstack/react-query', '@tanstack/react-query-persist-client', '@tanstack/query-async-storage-persister', 'idb-keyval'],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'Backpack — Travel Companion',
        short_name: 'Backpack',
        description: 'Offline-first travel, road-trip and parking companion: weather, maps, parking, transit, currency, translation, music, SOS and a private vault.',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['travel', 'navigation', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
        shortcuts: [
          { name: 'Emergency SOS', url: '/?sos=1', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Find parking', url: '/?tab=map&mode=parking', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Departures', url: '/?tab=transit', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Camera', url: '/?action=camera', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('tile.openstreetmap.org') || url.hostname.endsWith('basemaps.cartocdn.com'),
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => /open-meteo\.com|openweathermap\.org/.test(url.hostname),
            handler: 'NetworkFirst',
            options: { cacheName: 'weather', networkTimeoutSeconds: 6, expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 } },
          },
          {
            urlPattern: ({ url }) => /maps\.googleapis\.com|maps\.gstatic\.com/.test(url.hostname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-maps', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
          {
            urlPattern: ({ url }) => /mzstatic\.com|scdn\.co/.test(url.hostname),
            handler: 'CacheFirst',
            options: { cacheName: 'album-art', expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => /cdn\.jsdelivr\.net|tessdata/.test(url.href),
            handler: 'CacheFirst',
            options: { cacheName: 'ocr-models', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 90 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})

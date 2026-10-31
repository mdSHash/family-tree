import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'og.png'],
      manifest: {
        name: 'شجرة العيلة',
        short_name: 'شجرة العيلة',
        description: 'سجّل عيلتك كلها، الأجداد والأحفاد، والشجرة بتترتب لوحدها.',
        lang: 'ar', dir: 'rtl',
        start_url: '/', scope: '/', display: 'standalone', orientation: 'any',
        background_color: '#E9EDE7', theme_color: '#1F3A31',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i, handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 30, maxAgeSeconds: 31536000 }, cacheableResponse: { statuses: [0, 200] } } },
          { urlPattern: /\/storage\/v1\/object\/public\/photos\/.*/i, handler: 'CacheFirst',
            options: { cacheName: 'photos', expiration: { maxEntries: 2000, maxAgeSeconds: 31536000 }, cacheableResponse: { statuses: [0, 200] } } },
        ],
      },
    }),
  ],
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Capacitor serves the bundled assets from https://localhost/, so it must
// use a root base path. GitHub Pages instead serves under /PsyManager/.
// `vite build --mode capacitor` (used by the cap:sync / android:build
// scripts) opts out of the GitHub Pages prefix and the PWA service worker.
export default defineConfig(({ mode, command }) => {
  const isCapacitorBuild = mode === 'capacitor'
  const isProduction = command === 'build' && mode !== 'development'

  return {
    base: isProduction && !isCapacitorBuild ? '/PsyManager/' : '/',
    plugins: [
      react(),
      // Skip the PWA service worker in Capacitor builds: the WebView serves
      // assets from https://localhost/ and the SW would only get in the way
      // (the native app already handles offline behavior via cache +
      // persisted query state).
      ...(isCapacitorBuild
        ? []
        : [
            VitePWA({
              registerType: 'autoUpdate',
              includeAssets: ['favicon.svg', '404.html'],
              manifest: {
                name: 'PsyManager',
                short_name: 'PsyManager',
                description: 'Gestionale completo per psicologi e terapeuti',
                theme_color: '#1e293b',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait-primary',
                scope: '/PsyManager/',
                start_url: '/PsyManager/',
                icons: [
                  {
                    src: 'pwa-192x192.svg',
                    sizes: '192x192',
                    type: 'image/svg+xml',
                    purpose: 'any',
                  },
                  {
                    src: 'pwa-512x512.svg',
                    sizes: '512x512',
                    type: 'image/svg+xml',
                    purpose: 'any maskable',
                  },
                ],
              },
              workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
                runtimeCaching: [
                  {
                    urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'google-fonts-cache',
                      expiration: {
                        maxEntries: 10,
                        maxAgeSeconds: 60 * 60 * 24 * 365,
                      },
                    },
                  },
                  {
                    urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'gstatic-fonts-cache',
                      expiration: {
                        maxEntries: 10,
                        maxAgeSeconds: 60 * 60 * 24 * 365,
                      },
                    },
                  },
                ],
              },
              devOptions: {
                enabled: false,
              },
            }),
          ]),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // In Capacitor builds the PWA plugin isn't loaded, so the
        // `virtual:pwa-register` module doesn't exist. Point it at a stub
        // that exposes a no-op `registerSW` so PWAUpdatePrompt still builds.
        ...(isCapacitorBuild
          ? {
              'virtual:pwa-register': path.resolve(
                __dirname,
                './src/lib/pwa-register-stub.ts'
              ),
            }
          : {}),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    server: {
      port: 3000,
      strictPort: false,
    },
  }
})

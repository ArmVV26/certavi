import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// The version shown in Settings → About is the one in package.json (see src/app/appInfo.ts).
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

// Fixed ports with strictPort: if a port is busy, fail loudly instead of silently picking another.
// See .claude/rules/processes-windows.md.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    // Service worker + manifest (ADR-0005). Only the build output is precached; `/api/**` is never
    // cached. The app registers the worker itself (src/app/pwa/useAppUpdate.ts) and asks the user
    // before updating, so a workout in progress is never reloaded.
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        id: '/',
        name: 'Certavi',
        short_name: 'Certavi',
        description: 'Offline-first strength training log',
        lang: 'es',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        // Same as --bg (light) in src/theme/tokens.css.
        theme_color: '#f4f5f7',
        background_color: '#f4f5f7',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico}'],
        navigateFallback: 'index.html',
        // Sync talks to the network, never to the cache (ADR-0005).
        navigateFallbackDenylist: [/^\/api\//, /^\/\.netlify\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    restoreMocks: true,
    // The service worker registration is a virtual module of vite-plugin-pwa; Vitest cannot load it.
    alias: {
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwaRegisterStub.ts', import.meta.url),
      ),
    },
    // CSS is stubbed in tests by default; tokens.test.ts reads tokens.css with ?raw.
    css: { include: [/tokens\.css/] },
    // Two projects: the pure domain runs in Node, so any use of the DOM there fails;
    // everything else (UI, i18n, theme, data) runs in jsdom with the RTL setup.
    projects: [
      {
        extends: true,
        test: {
          name: 'domain',
          environment: 'node',
          include: ['src/domain/**/*.test.ts'],
        },
      },
      {
        // The sync server (server/) and its Netlify adapter run in Node, like in production.
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/**/*.test.ts', 'netlify/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          // Several findBy… waits (up to 5 s each, see setup.ts) must fit in one test.
          testTimeout: 15_000,
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/domain/**'],
        },
      },
    ],
    // `npm run test:coverage` (also in CI): fails if the pure domain, the data layer (local
    // database, repositories, importers, exporters) or the sync server drops below 90 %, each on
    // its own. netlify/functions only holds thin adapters and is not measured.
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts', 'src/data/**/*.{ts,tsx}', 'server/**/*.ts'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'server/**/*.test.ts',
        'src/domain/testing/**',
        'src/data/**/testing.ts',
        'server/**/testing.ts',
      ],
      reporter: ['text-summary', 'html'],
      thresholds: {
        'src/domain/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'src/data/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'server/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});

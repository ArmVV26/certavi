import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Fixed ports with strictPort: if a port is busy, fail loudly instead of silently picking another.
// See .claude/rules.md → "Processes and ports".
export default defineConfig({
  plugins: [react()],
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
      reporter: ['text', 'html'],
      thresholds: {
        'src/domain/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'src/data/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'server/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});

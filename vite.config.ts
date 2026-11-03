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
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/domain/**'],
        },
      },
    ],
    // `npm run test:coverage` (also in CI): fails if the pure domain drops below 90 %.
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/**/*.test.ts', 'src/domain/testing/**'],
      reporter: ['text', 'html'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});

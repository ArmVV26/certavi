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
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    // CSS is stubbed in tests by default; tokens.test.ts reads tokens.css with ?raw.
    css: { include: [/tokens\.css/] },
  },
});

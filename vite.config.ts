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
  },
});

// Global setup for Vitest: adds jest-dom matchers (toBeInTheDocument, toHaveTextContent…),
// a fake matchMedia (jsdom has none), an in-memory IndexedDB (fake-indexeddb) and a clean DOM +
// storage after each test. Each test opens its own database (openTestDatabase in render.tsx).
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';
import { installMatchMedia, resetMatchMedia } from './matchMedia';

installMatchMedia();

// findBy… / waitFor wait up to 5 s instead of 1 s. Screens read IndexedDB live, and under
// `test:coverage` (v8 instrumentation, every worker busy) a write → live query → re-render can
// take more than a second. Fast tests stay fast: the wait ends as soon as the UI is ready.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  resetMatchMedia();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.lang = 'es';
  for (const meta of document.head.querySelectorAll('meta[name="theme-color"]')) meta.remove();
});

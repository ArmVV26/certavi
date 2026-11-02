// Global setup for Vitest: adds jest-dom matchers (toBeInTheDocument, toHaveTextContent…),
// a fake matchMedia (jsdom has none) and a clean DOM + storage after each test.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { installMatchMedia, resetMatchMedia } from './matchMedia';

installMatchMedia();

afterEach(() => {
  cleanup();
  resetMatchMedia();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.lang = 'es';
  for (const meta of document.head.querySelectorAll('meta[name="theme-color"]')) meta.remove();
});

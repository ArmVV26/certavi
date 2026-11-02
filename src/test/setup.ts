// Global setup for Vitest: adds jest-dom matchers (toBeInTheDocument, toHaveTextContent…)
// and unmounts rendered components after each test.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// The domain must stay pure: its tests run in Node (vitest project "domain"), without a DOM.
import { describe, expect, it } from 'vitest';

describe('domain test environment', () => {
  it('has no DOM or browser storage', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
    expect(typeof localStorage).toBe('undefined');
  });
});

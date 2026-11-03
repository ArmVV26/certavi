import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSyncEngine } from './SyncContext';

describe('useSyncEngine', () => {
  it('fails clearly outside the provider', () => {
    function Probe() {
      useSyncEngine();
      return null;
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow('useSyncEngine must be used inside <SyncProvider>');
  });
});

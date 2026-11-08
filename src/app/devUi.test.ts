import { afterEach, describe, expect, it, vi } from 'vitest';

// Vitest always runs with DEV on, so the production build is simulated by stubbing the same
// variables Vite replaces at build time. Two copies of the condition exist on purpose (see
// routes.tsx: the bundler has to see it written out); this keeps them from drifting apart.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load(mode: 'development' | 'production' | 'e2e') {
  vi.stubEnv('MODE', mode);
  vi.stubEnv('DEV', mode === 'development');
  vi.stubEnv('PROD', mode !== 'development');
  vi.resetModules();
  const [{ DEV_UI_ENABLED }, { routes }] = await Promise.all([
    import('./devUi'),
    import('./routes'),
  ]);
  const pages = routes[0]?.children?.[0]?.children ?? [];
  return { enabled: DEV_UI_ENABLED, hasRoute: pages.some((route) => route.path === 'dev/ui') };
}

describe('the component catalog (/dev/ui)', () => {
  it('is not in the production build: no route and no link', async () => {
    expect(await load('production')).toEqual({ enabled: false, hasRoute: false });
  });

  it.each(['development', 'e2e'] as const)('is available in %s', async (mode) => {
    expect(await load(mode)).toEqual({ enabled: true, hasRoute: true });
  });
});

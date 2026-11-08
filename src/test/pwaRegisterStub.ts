// Stand-in for `virtual:pwa-register/react` in Vitest (aliased in vite.config.ts): the virtual
// module only exists inside vite-plugin-pwa's build. Same shape as the real hook, no service
// worker. Tests of the update logic mock the module itself (src/app/pwa/useAppUpdate.test.ts).
export function useRegisterSW() {
  const noop = () => undefined;
  return {
    needRefresh: [false, noop] as const,
    offlineReady: [false, noop] as const,
    updateServiceWorker: () => Promise.resolve(),
  };
}

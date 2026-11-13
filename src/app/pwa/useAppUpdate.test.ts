import { act, renderHook } from '@testing-library/react';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UPDATE_CHECK_INTERVAL_MS, useAppUpdate } from './useAppUpdate';

const sw = vi.hoisted(() => ({
  options: undefined as RegisterSWOptions | undefined,
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(() => Promise.resolve()),
  needRefresh: false,
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options?: RegisterSWOptions) => {
    sw.options = options;
    return {
      needRefresh: [sw.needRefresh, sw.setNeedRefresh],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: sw.updateServiceWorker,
    };
  },
}));

function fakeRegistration(installing: ServiceWorker | null = null) {
  const update = vi.fn(() => Promise.resolve());
  return { registration: { installing, update } as unknown as ServiceWorkerRegistration, update };
}

function register(registration: ServiceWorkerRegistration) {
  act(() => {
    sw.options?.onRegisteredSW?.('/sw.js', registration);
  });
}

function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useAppUpdate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sw.needRefresh = false;
    sw.options = undefined;
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports the waiting version and hides the prompt on dismiss', () => {
    sw.needRefresh = true;
    const { result } = renderHook(() => useAppUpdate());
    expect(result.current.updateAvailable).toBe(true);

    result.current.dismiss();
    expect(sw.setNeedRefresh).toHaveBeenCalledWith(false);
  });

  it('activates the waiting version and reloads on update', () => {
    const { result } = renderHook(() => useAppUpdate());
    result.current.update();
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('asks to activate the new version once, even if update is tapped again', async () => {
    const { result } = renderHook(() => useAppUpdate());
    sw.updateServiceWorker.mockClear();
    result.current.update();
    result.current.update();
    expect(sw.updateServiceWorker).toHaveBeenCalledTimes(1);

    // A failed activation can be tried again.
    sw.updateServiceWorker.mockClear();
    sw.updateServiceWorker.mockImplementationOnce(() => Promise.reject(new Error('failed')));
    const second = renderHook(() => useAppUpdate());
    second.result.current.update();
    await vi.advanceTimersByTimeAsync(0);
    second.result.current.update();
    expect(sw.updateServiceWorker).toHaveBeenCalledTimes(2);
  });

  it('looks for a new version every hour', () => {
    renderHook(() => useAppUpdate());
    const { registration, update } = fakeRegistration();
    register(registration);

    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS - 1);
    expect(update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('looks for a new version when the user comes back to the app, not when it is hidden', () => {
    renderHook(() => useAppUpdate());
    const { registration, update } = fakeRegistration();
    register(registration);

    setVisibility('hidden');
    expect(update).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('does not check offline, while another version installs or before registering', () => {
    renderHook(() => useAppUpdate());
    setVisibility('visible'); // not registered yet: nothing to check, nothing thrown

    const { registration, update } = fakeRegistration();
    register(registration);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    setVisibility('visible');
    expect(update).not.toHaveBeenCalled();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const installing = fakeRegistration({} as ServiceWorker);
    register(installing.registration);
    setVisibility('visible');
    expect(installing.update).not.toHaveBeenCalled();
  });

  it('survives a failed check and stops checking when unmounted', async () => {
    const { unmount } = renderHook(() => useAppUpdate());
    const failing = fakeRegistration();
    failing.update.mockRejectedValueOnce(new Error('network'));
    register(failing.registration);

    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(failing.update).toHaveBeenCalledTimes(1);

    unmount();
    setVisibility('visible');
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(failing.update).toHaveBeenCalledTimes(1);
  });
});

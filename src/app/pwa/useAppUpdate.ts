import { useCallback, useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** How often an app that stays open looks for a new version (ADR-0005). */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export interface AppUpdate {
  /** A new version is installed and waiting for the user's go-ahead. */
  updateAvailable: boolean;
  /** Activates the waiting version and reloads the page. Data on the device is untouched. */
  update: () => void;
  /** Hides the prompt for this page load; the new version keeps waiting. */
  dismiss: () => void;
}

/** Looks for a new service worker; skipped offline, while one is installing or on any failure. */
async function checkForUpdate(registration: ServiceWorkerRegistration | undefined) {
  if (!registration || registration.installing || !navigator.onLine) return;
  try {
    await registration.update();
  } catch {
    // A failed check is not an error for the user: it is retried at the next trigger.
  }
}

/**
 * Registers the service worker and tells whether a new version is waiting. It is the only place
 * that knows `virtual:pwa-register`, so the UI and its tests depend on this adapter, not on the
 * plugin. The browser already checks `sw.js` on every navigation; an installed app can stay
 * open for days, so it is also checked when the user comes back to the app and every hour.
 */
export function useAppUpdate(): AppUpdate {
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registered) {
      registration.current = registered;
    },
  });

  useEffect(() => {
    const check = () => {
      void checkForUpdate(registration.current);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const timer = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(timer);
    };
  }, []);

  // Activating takes a moment: a second tap must not ask again. If it fails, tapping works again.
  const activating = useRef(false);
  const update = useCallback(() => {
    if (activating.current) return;
    activating.current = true;
    updateServiceWorker(true).then(undefined, () => {
      activating.current = false;
    });
  }, [updateServiceWorker]);
  const dismiss = useCallback(() => {
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  return { updateAvailable: needRefresh, update, dismiss };
}

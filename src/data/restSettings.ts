// Settings of the rest timer. The rest times sync between devices (the `settings` record); sound
// and vibration belong to this device only (localStorage, like the theme).
import { DEFAULT_REST, SEED_SETTINGS, SETTINGS_ID, type SyncedSettings } from '../domain';
import { isLive, type CertaviDb } from './db';
import {
  removeDeviceSetting,
  writeDeviceSetting,
  type ReadableStorage,
  type WritableStorage,
} from './deviceStorage';
import { createRepository, type RepositoryOptions } from './repository';

export type RestTimes = SyncedSettings['rest'];

/** The rest times in use; the defaults while the settings record does not exist yet. */
export async function readRestTimes(db: CertaviDb): Promise<RestTimes> {
  const row = await db.settings.get(SETTINGS_ID);
  return row && isLive(row) ? row.rest : { ...DEFAULT_REST };
}

/**
 * Saves the rest times, keeping the rest of the settings. Throws (and saves nothing) when a time
 * is not a whole number of seconds from 15 to 900.
 */
export function saveRestTimes(
  db: CertaviDb,
  rest: RestTimes,
  options: RepositoryOptions = {},
): Promise<SyncedSettings> {
  const settings = createRepository(db, 'settings', options);
  return db.transaction('rw', [db.settings, db.pending, db.meta], async () => {
    const current = await settings.get(SETTINGS_ID);
    return settings.put({
      id: SETTINGS_ID,
      planStart: current?.planStart ?? SEED_SETTINGS.planStart,
      rest,
    });
  });
}

export const REST_SOUND_STORAGE_KEY = 'certavi.restSound';
export const REST_VIBRATION_STORAGE_KEY = 'certavi.restVibration';

/** Sound and vibration of the rest timer on this device. */
export interface RestAlerts {
  sound: boolean;
  vibration: boolean;
}

export const DEFAULT_REST_ALERTS: RestAlerts = { sound: true, vibration: false };

function readFlag(storage: ReadableStorage | null, key: string, fallback: boolean): boolean {
  try {
    const value = storage?.getItem(key);
    if (value === 'on') return true;
    if (value === 'off') return false;
  } catch {
    // Storage can throw (private mode): use the default.
  }
  return fallback;
}

export function readRestAlerts(storage: ReadableStorage | null): RestAlerts {
  return {
    sound: readFlag(storage, REST_SOUND_STORAGE_KEY, DEFAULT_REST_ALERTS.sound),
    vibration: readFlag(storage, REST_VIBRATION_STORAGE_KEY, DEFAULT_REST_ALERTS.vibration),
  };
}

/** Saves the given flags. Returns false if storage is unavailable. */
export function writeRestAlerts(storage: WritableStorage | null, patch: Partial<RestAlerts>) {
  let ok = true;
  if (patch.sound !== undefined) {
    ok = writeDeviceSetting(storage, REST_SOUND_STORAGE_KEY, patch.sound ? 'on' : 'off') && ok;
  }
  if (patch.vibration !== undefined) {
    ok =
      writeDeviceSetting(storage, REST_VIBRATION_STORAGE_KEY, patch.vibration ? 'on' : 'off') && ok;
  }
  return ok;
}

/** Forgets the saved flags, back to the defaults. */
export function resetRestAlerts(storage: Pick<Storage, 'removeItem'> | null): void {
  removeDeviceSetting(storage, REST_SOUND_STORAGE_KEY);
  removeDeviceSetting(storage, REST_VIBRATION_STORAGE_KEY);
}

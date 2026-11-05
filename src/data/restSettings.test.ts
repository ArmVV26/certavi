import { describe, expect, it } from 'vitest';
import { SETTINGS_ID } from '../domain';
import { openTestDatabase } from '../test/render';
import {
  DEFAULT_REST_ALERTS,
  REST_SOUND_STORAGE_KEY,
  REST_VIBRATION_STORAGE_KEY,
  readRestAlerts,
  readRestTimes,
  resetRestAlerts,
  saveRestTimes,
  writeRestAlerts,
} from './restSettings';
import { ensureSeed } from './seed';

let clock = 1_000;
const now = () => (clock += 1);

describe('rest times', () => {
  it('are the defaults before the settings exist', async () => {
    const db = openTestDatabase();
    expect(await readRestTimes(db)).toEqual({ compound: 180, isolation: 120 });
  });

  it('are saved, read back and queued to sync', async () => {
    const db = openTestDatabase();
    await ensureSeed(db);
    await saveRestTimes(db, { compound: 200, isolation: 90 }, { now });
    expect(await readRestTimes(db)).toEqual({ compound: 200, isolation: 90 });
    expect(await db.pending.get(SETTINGS_ID)).toMatchObject({ type: 'settings' });
  });

  it('are saved even if the settings record was never created, and keep the plan start', async () => {
    const db = openTestDatabase();
    await saveRestTimes(db, { compound: 150, isolation: 60 }, { now });
    expect(await readRestTimes(db)).toEqual({ compound: 150, isolation: 60 });

    const stored = await db.settings.get(SETTINGS_ID);
    if (!stored || 'deleted' in stored) throw new Error('settings missing');
    await db.settings.put({ ...stored, planStart: '2026-11-02' });
    const saved = await saveRestTimes(db, { compound: 160, isolation: 70 }, { now });
    expect(saved.planStart).toBe('2026-11-02');
  });

  it('refuse a time outside 15–900 s and save nothing', async () => {
    const db = openTestDatabase();
    await ensureSeed(db);
    await expect(saveRestTimes(db, { compound: 10, isolation: 120 })).rejects.toThrow();
    await expect(saveRestTimes(db, { compound: 180, isolation: 901 })).rejects.toThrow();
    await expect(saveRestTimes(db, { compound: 180.5, isolation: 120 })).rejects.toThrow();
    expect(await readRestTimes(db)).toEqual({ compound: 180, isolation: 120 });
  });

  it('ignore a deleted settings record', async () => {
    const db = openTestDatabase();
    await db.settings.put({ id: SETTINGS_ID, type: 'settings', updatedAt: 5, deleted: true });
    expect(await readRestTimes(db)).toEqual({ compound: 180, isolation: 120 });
  });
});

describe('rest alerts (this device only)', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
      data,
    };
  };

  it('are sound on and vibration off at first', () => {
    expect(readRestAlerts(memory())).toEqual(DEFAULT_REST_ALERTS);
    expect(readRestAlerts(null)).toEqual({ sound: true, vibration: false });
  });

  it('are saved one by one and read back', () => {
    const storage = memory();
    expect(writeRestAlerts(storage, { sound: false })).toBe(true);
    expect(readRestAlerts(storage)).toEqual({ sound: false, vibration: false });
    expect(writeRestAlerts(storage, { vibration: true })).toBe(true);
    expect(readRestAlerts(storage)).toEqual({ sound: false, vibration: true });
    expect(storage.data.get(REST_SOUND_STORAGE_KEY)).toBe('off');
    expect(storage.data.get(REST_VIBRATION_STORAGE_KEY)).toBe('on');
  });

  it('fall back to the defaults for garbage and survive a storage that throws', () => {
    const storage = memory();
    storage.setItem(REST_SOUND_STORAGE_KEY, 'maybe');
    expect(readRestAlerts(storage).sound).toBe(true);
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readRestAlerts(broken)).toEqual(DEFAULT_REST_ALERTS);
    expect(writeRestAlerts(broken, { sound: false })).toBe(false);
    expect(writeRestAlerts(null, { sound: false })).toBe(false);
  });

  it('can be reset', () => {
    const storage = memory();
    writeRestAlerts(storage, { sound: false, vibration: true });
    resetRestAlerts(storage);
    expect(readRestAlerts(storage)).toEqual(DEFAULT_REST_ALERTS);
  });
});

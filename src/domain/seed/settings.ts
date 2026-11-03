// Default synced settings, written on first start like the rest of the seed.
import { SEED_UPDATED_AT } from '../model/envelope';
import { DEFAULT_REST, SETTINGS_ID, type SyncedSettings } from '../model/settings';

export const SEED_SETTINGS: SyncedSettings = {
  id: SETTINGS_ID,
  type: 'settings',
  updatedAt: SEED_UPDATED_AT,
  rest: { ...DEFAULT_REST },
  planStart: null,
};

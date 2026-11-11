// Settings are split in two: what syncs between devices and what belongs to this device only.
import { z } from 'zod';
import { envelopeShape, isoDateSchema } from './envelope';

/** Synced settings: a single record with a fixed id. */
export const SETTINGS_ID = 'settings';

export const syncedSettingsSchema = z.object({
  ...envelopeShape('settings'),
  id: z.literal(SETTINGS_ID),
  /** Rest timer defaults, in seconds. */
  rest: z.object({
    compound: z.number().int().min(15).max(900),
    isolation: z.number().int().min(15).max(900),
  }),
  /** Monday of week 1 of the current plan (used to number weeks); null if not set. */
  planStart: isoDateSchema.nullable(),
});
export type SyncedSettings = z.infer<typeof syncedSettingsSchema>;

/**
 * Device-only settings. Never synced: they live in local storage (src/data/deviceStorage.ts).
 * Listed here so the whole Settings model is in one place.
 */
export const deviceSettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  /** No-colour ("zero dopamine") mode: greys only, on top of the light or dark theme. */
  mono: z.boolean(),
  locale: z.enum(['es', 'en']),
  sound: z.boolean(),
  vibration: z.boolean(),
  /** The sync key (CLAVE_SYNC) typed on this device; never logged or synced. */
  syncKey: z.string().optional(),
});
/** @public Device-only settings; the type is part of the domain API. */
export type DeviceSettings = z.infer<typeof deviceSettingsSchema>;

export const DEFAULT_REST = { compound: 180, isolation: 120 } as const;

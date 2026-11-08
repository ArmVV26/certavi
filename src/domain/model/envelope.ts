// The envelope every synced record carries (docs/api/sync-v1.md §4) and shared field schemas.
import { z } from 'zod';

export const RECORD_TYPES = [
  'exercise',
  'routine',
  'weekPlan',
  'session',
  'set',
  'note',
  'activity',
  'bodyWeight',
  'block',
  'blockLog',
  'weeklyMetric',
  'settings',
] as const;
export type RecordType = (typeof RECORD_TYPES)[number];
export const recordTypeSchema = z.enum(RECORD_TYPES);

/** Stable id, unique across all record types (1–120 chars, as the server requires). */
export const recordIdSchema = z.string().min(1).max(120);

/** Milliseconds since the epoch. */
export const timestampSchema = z.number().nonnegative();

/** `updatedAt` of seed records: any edit by the user (or any server copy) wins over them. */
export const SEED_UPDATED_AT = 0;

/** Calendar day as 'YYYY-MM-DD' (local date, no time zone). */
export const isoDateSchema = z.iso.date();

/** Envelope fields for a record of type `T`. `serverSeq` is set by the server only. */
export function envelopeShape<T extends RecordType>(type: T) {
  return {
    id: recordIdSchema,
    type: z.literal(type),
    updatedAt: timestampSchema,
    deleted: z.literal(true).optional(),
    serverSeq: z.number().int().nonnegative().optional(),
  };
}

export const syncEnvelopeSchema = z.object({
  id: recordIdSchema,
  type: recordTypeSchema,
  updatedAt: timestampSchema,
  deleted: z.literal(true).optional(),
  serverSeq: z.number().int().nonnegative().optional(),
});
/** @public Part of the domain API (CLAUDE.md §5) even though no module imports it yet. */
export type SyncEnvelope = z.infer<typeof syncEnvelopeSchema>;

/** A soft-deleted record: only the envelope travels, the payload may be gone. */
export const tombstoneSchema = syncEnvelopeSchema.extend({ deleted: z.literal(true) });
export type Tombstone = z.infer<typeof tombstoneSchema>;

/**
 * User-facing text: an i18n key for seed data, or raw text typed by the user.
 * The domain never translates; the UI resolves `{ key }` with i18next.
 */
export const textRefSchema = z.union([
  z.strictObject({ key: z.string().min(1) }),
  z.strictObject({ text: z.string() }),
]);
export type TextRef = z.infer<typeof textRefSchema>;

export const textKey = (key: string): TextRef => ({ key });
export const plainText = (text: string): TextRef => ({ text });

// One schema per record type, and a parser for any record coming from storage, sync or import.
import type { z } from 'zod';
import { activitySchema, bodyWeightSchema } from './activity';
import { blockLogSchema, optionalBlockSchema, weeklyMetricSchema } from './block';
import { tombstoneSchema, type RecordType, type Tombstone } from './envelope';
import { exerciseSchema } from './exercise';
import { routineSchema } from './routine';
import { exerciseNoteSchema, setEntrySchema, workoutSessionSchema } from './session';
import { syncedSettingsSchema } from './settings';
import { weekPlanSchema } from './weekPlan';

export const RECORD_SCHEMAS = {
  exercise: exerciseSchema,
  routine: routineSchema,
  weekPlan: weekPlanSchema,
  session: workoutSessionSchema,
  set: setEntrySchema,
  note: exerciseNoteSchema,
  activity: activitySchema,
  bodyWeight: bodyWeightSchema,
  block: optionalBlockSchema,
  blockLog: blockLogSchema,
  weeklyMetric: weeklyMetricSchema,
  settings: syncedSettingsSchema,
} as const satisfies Record<RecordType, z.ZodType>;

/** A live record of any type. */
export type DomainRecord = z.infer<(typeof RECORD_SCHEMAS)[RecordType]>;

/** The live record of one type, e.g. `RecordOf<'session'>` is a `WorkoutSession`. */
export type RecordOf<K extends RecordType> = z.infer<(typeof RECORD_SCHEMAS)[K]>;

export type ParseResult =
  | { ok: true; record: DomainRecord | Tombstone }
  | { ok: false; error: z.ZodError | 'unknown-type' };

function isRecordType(value: unknown): value is RecordType {
  return typeof value === 'string' && Object.hasOwn(RECORD_SCHEMAS, value);
}

/**
 * Validates `raw` against the schema of its `type`. Soft-deleted records only need a valid
 * envelope: their payload may already be gone.
 */
export function parseRecord(raw: unknown): ParseResult {
  const type = (raw as { type?: unknown } | null)?.type;
  if (!isRecordType(type)) return { ok: false, error: 'unknown-type' };
  if ((raw as { deleted?: unknown }).deleted === true) {
    const result = tombstoneSchema.safeParse(raw);
    return result.success ? { ok: true, record: result.data } : { ok: false, error: result.error };
  }
  const result = RECORD_SCHEMAS[type].safeParse(raw);
  return result.success ? { ok: true, record: result.data } : { ok: false, error: result.error };
}

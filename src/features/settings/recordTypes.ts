import type { RecordType } from '../../domain';

/** Record types in the order Settings lists them. Synced settings come last (import only). */
export const LISTED_TYPES = [
  'exercise',
  'routine',
  'session',
  'set',
  'note',
  'activity',
  'bodyWeight',
  'weekPlan',
  'block',
  'blockLog',
  'weeklyMetric',
  'settings',
] as const satisfies readonly RecordType[];

/** The counts list leaves out synced settings: they are a single record. */
export const COUNTED_TYPES = LISTED_TYPES.filter(
  (type): type is Exclude<RecordType, 'settings'> => type !== 'settings',
);

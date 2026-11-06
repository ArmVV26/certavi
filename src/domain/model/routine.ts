import { z } from 'zod';
import { envelopeShape, recordIdSchema, textRefSchema } from './envelope';
import { weekdaySchema } from './enums';
import { setSchemeSchema } from './scheme';

/** One exercise in a routine or in a session plan. */
export const planItemSchema = z.object({
  exerciseId: recordIdSchema,
  scheme: setSchemeSchema,
  note: textRefSchema.optional(),
  /** Optional exercises are dropped in deload weeks. */
  optional: z.boolean(),
  /**
   * Session plans only: the exercise is not part of the session's routine (added by hand, or
   * kept when the routine was changed). Absent in routines and in free sessions.
   */
  added: z.literal(true).optional(),
});
export type PlanItem = z.infer<typeof planItemSchema>;

export const routineSchema = z.object({
  ...envelopeShape('routine'),
  name: textRefSchema,
  items: z.array(planItemSchema),
  /** Day the routine is proposed on; null for routines without a fixed day. */
  weekday: weekdaySchema.nullable(),
  custom: z.boolean(),
});
export type Routine = z.infer<typeof routineSchema>;

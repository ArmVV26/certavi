// Other activities (football, swimming…) and weekly body weight.
import { z } from 'zod';
import { envelopeShape, isoDateSchema } from './envelope';
import { activityKindSchema } from './enums';
import { mondaySchema } from './weekPlan';

export const activitySchema = z.object({
  ...envelopeShape('activity'),
  date: isoDateSchema,
  kind: activityKindSchema,
  minutes: z.number().int().nonnegative(),
  note: z.string(),
});
export type Activity = z.infer<typeof activitySchema>;

export const bodyWeightSchema = z.object({
  ...envelopeShape('bodyWeight'),
  week: mondaySchema,
  kg: z.number().positive().max(500),
});
export type BodyWeight = z.infer<typeof bodyWeightSchema>;

/** One body-weight record per week. */
export const bodyWeightId = (monday: string) => `bw_${monday}`;

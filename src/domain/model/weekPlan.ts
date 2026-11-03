import { z } from 'zod';
import { isMonday } from '../dates';
import { envelopeShape, isoDateSchema, timestampSchema } from './envelope';
import { muscleGroupSchema, weekSizeSchema } from './enums';

export const mondaySchema = isoDateSchema.refine(isMonday, { message: 'Must be a Monday' });

/** Planned sets for every muscle group (all groups present, possibly 0). */
export const groupCountsSchema = z.record(muscleGroupSchema, z.number().int().nonnegative());

export const weekPlanSchema = z.object({
  ...envelopeShape('weekPlan'),
  week: mondaySchema,
  /** Hiking on Sunday: Lower A moves to Thursday (or Friday if there is no football). */
  hiking: z.boolean(),
  deload: z.boolean(),
  /** Sessions planned this week: 5 (normal), 4 or 3 (short week). */
  size: weekSizeSchema,
  /** Frozen when the week is closed; absent while the week is open. */
  plannedSetsByGroup: groupCountsSchema.optional(),
  closedAt: timestampSchema.optional(),
});
export type WeekPlan = z.infer<typeof weekPlanSchema>;

export const weekPlanId = (monday: string) => `week_${monday}`;

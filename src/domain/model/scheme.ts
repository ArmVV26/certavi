// SetScheme: the planned sets of one exercise, e.g. "1 aprox + 1 + 2" = three blocks.
import { z } from 'zod';
import { schemeBlockKindSchema } from './enums';

/**
 * Rep range as written in the routine: '6-8', '12' (fixed), '~10' (about ten) or '' (no target,
 * used by approach sets).
 */
export const repRangeSchema = z.string().regex(/^(|~?\d{1,3}|\d{1,3}-\d{1,3})$/);
export type RepRange = z.infer<typeof repRangeSchema>;

/** Target reps in reserve: '1-2', '3', or '' when the routine sets none. */
export const rirRangeSchema = z.string().regex(/^(|\d|\d-\d)$/);
export type RirRange = z.infer<typeof rirRangeSchema>;

export const schemeBlockSchema = z.object({
  kind: schemeBlockKindSchema,
  reps: repRangeSchema,
  count: z.number().int().min(1).max(20),
});
export type SchemeBlock = z.infer<typeof schemeBlockSchema>;

export const setSchemeSchema = z.object({
  blocks: z.array(schemeBlockSchema).min(1),
  rir: rirRangeSchema,
});
export type SetScheme = z.infer<typeof setSchemeSchema>;

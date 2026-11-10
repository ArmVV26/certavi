import { z } from 'zod';
import { envelopeShape, textRefSchema } from './envelope';
import { equipmentSchema, exerciseKindSchema, muscleGroupSchema } from './enums';
import { setSchemeSchema } from './scheme';

/** Limits of the machine settings ("Backrest" → "3"), enforced by the schema and the form. */
export const SETUP_LIMITS = { maxItems: 4, maxLabel: 24, maxValue: 12 } as const;

export const exerciseSetupItemSchema = z.object({
  label: z.string().trim().min(1).max(SETUP_LIMITS.maxLabel),
  value: z.string().trim().min(1).max(SETUP_LIMITS.maxValue),
});
export type ExerciseSetupItem = z.infer<typeof exerciseSetupItemSchema>;

export const exerciseSchema = z.object({
  ...envelopeShape('exercise'),
  /** i18n key for the seed catalog, raw text for exercises the user creates. */
  name: textRefSchema,
  primaryGroup: muscleGroupSchema,
  secondaryMuscles: z.array(muscleGroupSchema),
  equipment: equipmentSchema,
  kind: exerciseKindSchema,
  unilateral: z.boolean(),
  supportsStraps: z.boolean(),
  supportsBand: z.boolean(),
  /** Band colour preselected for new sets (e.g. 'purple' for the banded hack squat). */
  defaultBand: z.string().min(1).optional(),
  defaultScheme: setSchemeSchema,
  /** Weight step in kg used by the progression rule. */
  increment: z.number().positive(),
  /** Created by the user (true) or part of the seed catalog (false). */
  custom: z.boolean(),
  archived: z.boolean(),
  /** Positions of the bench or machine (backrest, seat…), shown in the session. Absent = none. */
  setup: z.array(exerciseSetupItemSchema).max(SETUP_LIMITS.maxItems).optional(),
});
export type Exercise = z.infer<typeof exerciseSchema>;

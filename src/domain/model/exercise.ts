import { z } from 'zod';
import { envelopeShape, textRefSchema } from './envelope';
import { equipmentSchema, exerciseKindSchema, muscleGroupSchema } from './enums';
import { setSchemeSchema } from './scheme';

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
});
export type Exercise = z.infer<typeof exerciseSchema>;

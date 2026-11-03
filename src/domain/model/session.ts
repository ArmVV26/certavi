// A workout session, the sets logged in it and the per-exercise notes.
import { z } from 'zod';
import { envelopeShape, isoDateSchema, recordIdSchema, timestampSchema } from './envelope';
import { exclusionReasonSchema, setKindSchema } from './enums';
import { planItemSchema } from './routine';

export const workoutSessionSchema = z.object({
  ...envelopeShape('session'),
  date: isoDateSchema,
  /** null = free session (no routine). */
  routineId: recordIdSchema.nullable(),
  startedAt: timestampSchema.nullable(),
  endedAt: timestampSchema.nullable(),
  /** Copy of the routine when the session started. Editing it never touches the routine. */
  items: z.array(planItemSchema),
  note: z.string(),
  /** "How do you feel?" 1–5, null if not answered. */
  readiness: z.number().int().min(1).max(5).nullable(),
});
export type WorkoutSession = z.infer<typeof workoutSessionSchema>;

export const setEntrySchema = z.object({
  ...envelopeShape('set'),
  sessionId: recordIdSchema,
  exerciseId: recordIdSchema,
  kind: setKindSchema,
  /**
   * Position of the set among the sets of the same exercise and kind group: planned sets use
   * their slot in the scheme; warm-ups and extra sets are numbered in order.
   */
  slot: z.number().int().nonnegative(),
  /** kg; 0 is valid (empty machine, bodyweight without ballast). */
  weight: z.number().nonnegative(),
  reps: z.number().int().nonnegative(),
  rir: z.number().int().min(0).max(10).nullable(),
  straps: z.boolean().optional(),
  /** Band colour, when the exercise uses one. */
  band: z.string().min(1).optional(),
  completedAt: timestampSchema,
});
export type SetEntry = z.infer<typeof setEntrySchema>;

export const exerciseNoteSchema = z.object({
  ...envelopeShape('note'),
  sessionId: recordIdSchema,
  exerciseId: recordIdSchema,
  text: z.string(),
  /** Machine busy, missing plates, another band…: this exercise does not decide progression. */
  excludeFromProgression: z.boolean().optional(),
  reason: exclusionReasonSchema.optional(),
});
export type ExerciseNote = z.infer<typeof exerciseNoteSchema>;

/** Note ids are derived so there is at most one note per exercise and session. */
export const exerciseNoteId = (sessionId: string, exerciseId: string) =>
  `note_${sessionId}_${exerciseId}`;

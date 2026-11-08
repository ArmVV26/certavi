// Closed sets of values used across the domain. Each one is an `as const` tuple (no TS enums:
// `erasableSyntaxOnly`), its union type and a zod schema built from the same tuple.
import { z } from 'zod';

/** Muscle groups used for the weekly set count. */
export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'quads',
  'hamstrings-glutes',
  'triceps',
  'biceps',
  'calves',
  'core',
  'forearms',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];
export const muscleGroupSchema = z.enum(MUSCLE_GROUPS);

/** Groups trained on leg days. Compound lifts here progress in +5 kg steps by default. */
export const LOWER_BODY_GROUPS: readonly MuscleGroup[] = ['quads', 'hamstrings-glutes', 'calves'];

export function isLowerBody(group: MuscleGroup): boolean {
  return LOWER_BODY_GROUPS.includes(group);
}

/** plate-loaded = discos · selectorized = placas (pin) · cable = polea. */
export const EQUIPMENT = [
  'plate-loaded',
  'selectorized',
  'dumbbell',
  'cable',
  'barbell',
  'bodyweight',
  'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];
export const equipmentSchema = z.enum(EQUIPMENT);

export const EXERCISE_KINDS = ['compound', 'isolation'] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];
export const exerciseKindSchema = z.enum(EXERCISE_KINDS);

/** Kinds of planned working sets: what a routine's scheme is made of. */
export const PLANNED_KINDS = ['approach', 'top', 'backoff', 'straight', 'bilbo'] as const;
export type PlannedKind = (typeof PLANNED_KINDS)[number];

/**
 * Kinds of a set row: the planned kinds plus warm-up, dropset and extra. The same kinds label
 * the logged sets.
 */
export const SET_KINDS = ['warmup', ...PLANNED_KINDS, 'dropset', 'extra'] as const;
export type SetKind = (typeof SET_KINDS)[number];
export const setKindSchema = z.enum(SET_KINDS);

/**
 * Kinds a scheme block can have. A routine only uses the planned kinds; a session also adds
 * warm-up, dropset and extra rows to its copy of the scheme, so every row of an exercise
 * (and not only the planned ones) has a position. It is the same set as `SetKind`.
 */
export type SchemeBlockKind = SetKind;

/** A planned working set (counts for the plan and for the session progress). */
export function isPlannedKind(kind: SetKind): kind is PlannedKind {
  return (PLANNED_KINDS as readonly SetKind[]).includes(kind);
}

export const BLOCK_TYPES = ['mobility', 'stretching', 'rehab'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
export const blockTypeSchema = z.enum(BLOCK_TYPES);

export const ACTIVITY_KINDS = [
  'football',
  'swimming',
  'hiking',
  'mobility',
  'cycling',
  'other',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export const activityKindSchema = z.enum(ACTIVITY_KINDS);

/** Why a logged exercise does not count for progression decisions. */
export const EXCLUSION_REASONS = ['machine-busy', 'missing-plates', 'other-band', 'other'] as const;
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];
export const exclusionReasonSchema = z.enum(EXCLUSION_REASONS);

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const weekdaySchema = z.literal(WEEKDAYS);

/** Sessions planned in a week: normal (5) or short (4 or 3). */
export const WEEK_SIZES = [5, 4, 3] as const;
export type WeekSize = (typeof WEEK_SIZES)[number];
export const weekSizeSchema = z.literal(WEEK_SIZES);

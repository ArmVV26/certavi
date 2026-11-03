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

/** Kinds of planned sets in a scheme. Warm-ups and extra sets are never planned. */
export const SCHEME_BLOCK_KINDS = ['approach', 'top', 'backoff', 'straight', 'bilbo'] as const;
export type SchemeBlockKind = (typeof SCHEME_BLOCK_KINDS)[number];
export const schemeBlockKindSchema = z.enum(SCHEME_BLOCK_KINDS);

/** Kinds of logged sets: the planned kinds plus warm-up and extra. */
export const SET_KINDS = ['warmup', ...SCHEME_BLOCK_KINDS, 'extra'] as const;
export type SetKind = (typeof SET_KINDS)[number];
export const setKindSchema = z.enum(SET_KINDS);

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

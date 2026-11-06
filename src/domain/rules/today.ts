// Small rules behind the Today screen: deload reminder, plan week number and body weight.
import { daysBetween, mondayOf } from '../dates';
import type { BodyWeight } from '../model/activity';

/** Weeks in a row without a deload after which Today suggests one (one every 6–8). */
export const DELOAD_REMINDER_WEEKS = 6;

export function needsDeloadReminder(weeksSinceDeload: number, deloadThisWeek: boolean): boolean {
  return !deloadThisWeek && weeksSinceDeload >= DELOAD_REMINDER_WEEKS;
}

/** Week number of `date` in the plan that starts on `planStart` (1 = first week), or null. */
export function planWeekNumber(planStart: string | null, date: string): number | null {
  if (planStart === null) return null;
  const days = daysBetween(mondayOf(planStart), mondayOf(date));
  return days < 0 ? null : days / 7 + 1;
}

/** Accepted range of an average body weight, in kg. */
export const BODY_WEIGHT_RANGE = { min: 20, max: 300 } as const;

export function isValidBodyWeight(kg: number | null): kg is number {
  return kg !== null && kg >= BODY_WEIGHT_RANGE.min && kg <= BODY_WEIGHT_RANGE.max;
}

/** The latest body weight saved for a week before `monday`. */
export function previousBodyWeight<T extends Pick<BodyWeight, 'week'>>(
  records: readonly T[],
  monday: string,
): T | undefined {
  return records
    .filter((r) => r.week < monday)
    .sort((a, b) => (a.week < b.week ? 1 : a.week > b.week ? -1 : 0))[0];
}

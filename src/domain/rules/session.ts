// Creating a workout session and reading a session plan.
import { parseIsoDate } from '../dates';
import type { PlanItem, Routine } from '../model/routine';
import type { WorkoutSession } from '../model/session';
import { deloadItems } from './deload';
import { countPlanSets } from './scheme';

/** A session logged for another day is stored as finished, from 18:00 to 19:15 of that day. */
export const PAST_SESSION_START_HOUR = 18;
export const PAST_SESSION_MINUTES = 75;

/** The plan a new session starts with: a copy of the routine, reduced in a deload week. */
export function sessionItems(items: readonly PlanItem[], deload: boolean): PlanItem[] {
  const copy = structuredClone(items) as PlanItem[];
  return deload ? deloadItems(copy) : copy;
}

export interface NewSessionInput {
  id: string;
  date: string;
  /** null = free session, with no exercises. */
  routine: Pick<Routine, 'id' | 'items'> | null;
  /** The device's current date. */
  today: string;
  /** Current time in ms. */
  now: number;
  /** The date's week is a deload week. */
  deload: boolean;
}

/**
 * A new session (without `updatedAt`, which the repository sets). Today's session starts now
 * and is in progress; a session for another day is created finished (18:00–19:15).
 */
export function newSession(input: NewSessionInput): Omit<WorkoutSession, 'updatedAt'> {
  let startedAt = input.now;
  let endedAt: number | null = null;
  if (input.date !== input.today) {
    const start = parseIsoDate(input.date);
    start.setHours(PAST_SESSION_START_HOUR, 0, 0, 0);
    startedAt = start.getTime();
    endedAt = startedAt + PAST_SESSION_MINUTES * 60_000;
  }
  return {
    id: input.id,
    type: 'session',
    date: input.date,
    routineId: input.routine?.id ?? null,
    startedAt,
    endedAt,
    items: input.routine ? sessionItems(input.routine.items, input.deload) : [],
    note: '',
    readiness: null,
  };
}

/** The first session of `date` with that routine (null = free session), oldest first. */
export function findSession<T extends Pick<WorkoutSession, 'date' | 'routineId' | 'startedAt'>>(
  sessions: readonly T[],
  date: string,
  routineId: string | null,
): T | undefined {
  return [...sessions]
    .filter((s) => s.date === date && s.routineId === routineId)
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))[0];
}

export function isInProgress(session: Pick<WorkoutSession, 'endedAt'>): boolean {
  return session.endedAt === null;
}

export interface PlanCounts {
  exercises: number;
  sets: number;
}

/** "7 exercises · 19 sets". */
export function planCounts(items: readonly PlanItem[]): PlanCounts {
  return { exercises: items.length, sets: countPlanSets(items) };
}

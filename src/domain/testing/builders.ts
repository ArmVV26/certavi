// Synthetic records for domain tests. Never real data.
import type { SetEntry, WorkoutSession } from '../model/session';
import type { WeekPlan } from '../model/weekPlan';
import { weekPlanId } from '../model/weekPlan';

export function makeSession(
  fields: Pick<WorkoutSession, 'id' | 'date'> & Partial<WorkoutSession>,
): WorkoutSession {
  return {
    type: 'session',
    updatedAt: 1,
    routineId: null,
    startedAt: null,
    endedAt: null,
    items: [],
    note: '',
    readiness: null,
    ...fields,
  };
}

let setCounter = 0;

export function makeSet(
  fields: Pick<SetEntry, 'sessionId' | 'exerciseId'> & Partial<SetEntry>,
): SetEntry {
  setCounter += 1;
  return {
    id: `set-${String(setCounter)}`,
    type: 'set',
    updatedAt: 1,
    kind: 'straight',
    slot: 0,
    weight: 50,
    reps: 10,
    rir: 2,
    completedAt: 1,
    ...fields,
  };
}

export function makeWeekPlan(fields: Pick<WeekPlan, 'week'> & Partial<WeekPlan>): WeekPlan {
  return {
    id: weekPlanId(fields.week),
    type: 'weekPlan',
    updatedAt: 1,
    hiking: false,
    deload: false,
    size: 5,
    ...fields,
  };
}

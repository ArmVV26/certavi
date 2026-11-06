// Editing a session after it started: its exercises, its date and hours, its routine.
// Everything here works on the session's own copy of the plan; the routine never changes.
import { parseIsoDate } from '../dates';
import type { Exercise } from '../model/exercise';
import type { PlanItem, Routine } from '../model/routine';
import { sessionItems } from './session';

/** The exercise is not in the plan yet, so it can be added. */
export function canAddExercise(items: readonly PlanItem[], exerciseId: string): boolean {
  return !items.some((item) => item.exerciseId === exerciseId);
}

/**
 * The plan with `exercise` at the end, with a copy of its default scheme. `outsideRoutine` marks
 * it "added" (a session of a routine); null when it is already in the plan.
 */
export function addExerciseItem(
  items: readonly PlanItem[],
  exercise: Pick<Exercise, 'id' | 'defaultScheme'>,
  outsideRoutine: boolean,
): PlanItem[] | null {
  if (!canAddExercise(items, exercise.id)) return null;
  const item: PlanItem = {
    exerciseId: exercise.id,
    scheme: structuredClone(exercise.defaultScheme),
    optional: false,
    ...(outsideRoutine ? { added: true as const } : {}),
  };
  return [...items, item];
}

/** The plan with the exercise one place up (-1) or down (+1); null when it cannot move. */
export function moveExerciseItem(
  items: readonly PlanItem[],
  exerciseId: string,
  direction: -1 | 1,
): PlanItem[] | null {
  const from = items.findIndex((item) => item.exerciseId === exerciseId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= items.length) return null;
  const moved = [...items];
  const [item] = moved.splice(from, 1);
  if (!item) return null;
  moved.splice(to, 0, item);
  return moved;
}

/** The plan without the exercise; null when it is not there. */
export function removeExerciseItem(
  items: readonly PlanItem[],
  exerciseId: string,
): PlanItem[] | null {
  const rest = items.filter((item) => item.exerciseId !== exerciseId);
  return rest.length === items.length ? null : rest;
}

/** The plan with the item put back at `index` (clamped); null when the exercise is already there. */
export function restoreExerciseItem(
  items: readonly PlanItem[],
  item: PlanItem,
  index: number,
): PlanItem[] | null {
  if (!canAddExercise(items, item.exerciseId)) return null;
  const restored = [...items];
  restored.splice(Math.min(Math.max(index, 0), restored.length), 0, item);
  return restored;
}

export interface ChangeRoutineInput {
  /** The session's current plan. */
  items: readonly PlanItem[];
  /** Exercises of the plan that have saved sets or a note: they are never dropped. */
  withData: ReadonlySet<string>;
  /** The new routine; null = free session. */
  routine: Pick<Routine, 'items'> | null;
  /** The session's week is a deload week. */
  deload: boolean;
}

function withoutAdded(item: PlanItem): PlanItem {
  const copy = { ...item };
  delete copy.added;
  return copy;
}

/**
 * The plan after changing the routine of a session: the new routine's exercises in its order
 * (an exercise that is in both and has data keeps its rows, otherwise it takes the new scheme),
 * then the exercises with data that the new routine does not have (tagged "added" when there is a
 * routine). Exercises without data that are not in the new routine go away. No exercise with
 * saved data is ever lost.
 */
export function changeRoutineItems(input: ChangeRoutineInput): PlanItem[] {
  const { items, withData, routine, deload } = input;
  const keptOld = (item: PlanItem) => withData.has(item.exerciseId);
  if (!routine) return items.filter(keptOld).map(withoutAdded);

  const fromRoutine = sessionItems(routine.items, deload);
  const inPlan = new Set(fromRoutine.map((item) => item.exerciseId));
  const inRoutine = new Set(routine.items.map((item) => item.exerciseId));
  const old = new Map(items.map((item) => [item.exerciseId, item]));

  const result = fromRoutine.map((item) => {
    const previous = old.get(item.exerciseId);
    return previous && keptOld(previous) ? withoutAdded(previous) : item;
  });
  for (const item of items) {
    if (inPlan.has(item.exerciseId) || !keptOld(item)) continue;
    result.push(inRoutine.has(item.exerciseId) ? withoutAdded(item) : { ...item, added: true });
  }
  return result;
}

export type SessionTimesError = 'future' | 'endBeforeStart' | 'invalid';

export interface SessionTimesInput {
  /** ISO date 'YYYY-MM-DD'. */
  date: string;
  /** The device's current date. */
  today: string;
  /** 'HH:MM'. */
  start: string;
  /** 'HH:MM', or null while the session is in progress. */
  end: string | null;
}

export type SessionTimesResult =
  { ok: true; startedAt: number; endedAt: number | null } | { ok: false; error: SessionTimesError };

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function atTime(date: string, time: string): number | null {
  const match = TIME.exec(time);
  if (!match) return null;
  const moment = parseIsoDate(date);
  moment.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return moment.getTime();
}

/**
 * Validates the edited date and hours and turns them into timestamps: the date cannot be after
 * today, and the end cannot be earlier than the start.
 */
export function sessionTimes(input: SessionTimesInput): SessionTimesResult {
  if (!ISO_DATE.test(input.date)) return { ok: false, error: 'invalid' };
  if (input.date > input.today) return { ok: false, error: 'future' };
  const startedAt = atTime(input.date, input.start);
  if (startedAt === null) return { ok: false, error: 'invalid' };
  if (input.end === null) return { ok: true, startedAt, endedAt: null };
  const endedAt = atTime(input.date, input.end);
  if (endedAt === null) return { ok: false, error: 'invalid' };
  if (endedAt < startedAt) return { ok: false, error: 'endBeforeStart' };
  return { ok: true, startedAt, endedAt };
}

/** 'HH:MM' of a timestamp in local time, for the time fields. */
export function timeOfDay(timestamp: number): string {
  const moment = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(moment.getHours())}:${pad(moment.getMinutes())}`;
}

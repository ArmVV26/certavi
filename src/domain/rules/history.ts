// Exercise history built from the training log, and the "last time" reference for progression.
import { mondayOf } from '../dates';
import type { ExerciseNote, SetEntry, WorkoutSession } from '../model/session';
import type { WeekPlan } from '../model/weekPlan';
import { compareSets, isEffectiveSet } from './sets';

/** Everything the rules read. Callers pass live (non-deleted) records only. */
export interface TrainingLog {
  sessions: readonly WorkoutSession[];
  sets: readonly SetEntry[];
  notes?: readonly ExerciseNote[];
  weekPlans?: readonly WeekPlan[];
}

export interface HistoryEntry {
  session: WorkoutSession;
  /** Effective sets of the exercise in this session, in display order. */
  sets: SetEntry[];
  /** The session falls in a deload week. */
  deload: boolean;
  /** Marked "does not count" (machine busy, missing plates, another band…). */
  excluded: boolean;
}

/** Chronological order: by date, then by start time. */
export function compareSessions(a: WorkoutSession, b: WorkoutSession): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return (a.startedAt ?? 0) - (b.startedAt ?? 0);
}

/** Mondays of the deload weeks in the log. */
export function deloadWeeks(weekPlans: readonly WeekPlan[] = []): Set<string> {
  return new Set(weekPlans.filter((w) => w.deload).map((w) => w.week));
}

export function isDeloadDate(date: string, weeks: ReadonlySet<string>): boolean {
  return weeks.has(mondayOf(date));
}

/** Sessions with effective sets of `exerciseId`, oldest first. */
export function exerciseHistory(exerciseId: string, log: TrainingLog): HistoryEntry[] {
  const deload = deloadWeeks(log.weekPlans);
  const excluded = new Set(
    (log.notes ?? [])
      .filter((n) => n.exerciseId === exerciseId && n.excludeFromProgression === true)
      .map((n) => n.sessionId),
  );
  const bySession = new Map<string, SetEntry[]>();
  for (const set of log.sets) {
    if (set.exerciseId !== exerciseId || !isEffectiveSet(set)) continue;
    const list = bySession.get(set.sessionId);
    if (list) list.push(set);
    else bySession.set(set.sessionId, [set]);
  }
  return [...log.sessions].sort(compareSessions).flatMap((session) => {
    const sets = bySession.get(session.id);
    if (!sets) return [];
    return [
      {
        session,
        sets: [...sets].sort(compareSets),
        deload: isDeloadDate(session.date, deload),
        excluded: excluded.has(session.id),
      },
    ];
  });
}

/**
 * The session that serves as "last time" for `exerciseId` in `current`:
 * the latest earlier session that counts (not marked "does not count"). Deload sessions are used
 * only if there is no normal one. If there is nothing before `current`'s date, falls back to the
 * latest one after it (registering a past session).
 */
export function lastReference(
  exerciseId: string,
  log: TrainingLog,
  current: Pick<WorkoutSession, 'id' | 'date'>,
): HistoryEntry | null {
  const counted = exerciseHistory(exerciseId, log).filter(
    (h) => h.session.id !== current.id && !h.excluded,
  );
  const normal = counted.filter((h) => !h.deload);
  const pool = normal.length > 0 ? normal : counted;
  const prior = pool.filter((h) => h.session.date <= current.date);
  return prior.at(-1) ?? pool.at(-1) ?? null;
}

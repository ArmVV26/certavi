// Personal records and best marks of an exercise. Deload weeks, warm-ups and approach sets
// never set records.
import type { Exercise } from '../model/exercise';
import type { SetEntry } from '../model/session';
import type { HistoryEntry } from './history';
import { bestE1rm, countsForStrength, epley1rm, volume } from './sets';

export interface DatedSet {
  set: SetEntry;
  date: string;
  sessionId: string;
}

export interface RepRecord {
  reps: number;
  weight: number;
  date: string;
  sessionId: string;
}

export interface ExerciseStats {
  /** Sessions, effective sets and reps over the whole history (deloads included). */
  sessions: number;
  sets: number;
  reps: number;
  /** Best marks, from non-deload sessions only. */
  bestE1rm: (DatedSet & { value: number }) | null;
  maxWeight: (DatedSet & { weight: number }) | null;
  bestVolume: { volume: number; date: string; sessionId: string } | null;
  maxReps: number;
  repRecords: RepRecord[];
}

export function exerciseStats(history: readonly HistoryEntry[]): ExerciseStats {
  const stats: ExerciseStats = {
    sessions: history.length,
    sets: 0,
    reps: 0,
    bestE1rm: null,
    maxWeight: null,
    bestVolume: null,
    maxReps: 0,
    repRecords: [],
  };
  const byReps = new Map<number, RepRecord>();
  for (const entry of history) {
    stats.sets += entry.sets.length;
    stats.reps += entry.sets.reduce((sum, s) => sum + s.reps, 0);
    if (entry.deload) continue;
    const { date } = entry.session;
    const sessionId = entry.session.id;

    const vol = volume(entry.sets);
    if (vol > (stats.bestVolume?.volume ?? 0)) stats.bestVolume = { volume: vol, date, sessionId };

    for (const set of entry.sets) {
      if (!countsForStrength(set)) continue;
      const e = epley1rm(set.weight, set.reps);
      if (e > (stats.bestE1rm?.value ?? 0)) stats.bestE1rm = { set, date, sessionId, value: e };
      if (set.weight > (stats.maxWeight?.weight ?? -1)) {
        stats.maxWeight = { set, date, sessionId, weight: set.weight };
      }
      stats.maxReps = Math.max(stats.maxReps, set.reps);
      const current = byReps.get(set.reps);
      if (!current || set.weight > current.weight) {
        byReps.set(set.reps, { reps: set.reps, weight: set.weight, date, sessionId });
      }
    }
  }
  stats.repRecords = repRecords([...byReps.values()]);
  return stats;
}

/**
 * Best weight for each rep count, keeping only marks that no higher rep count beats or ties
 * on weight (as Hevy does): 100 × 5 hides 95 × 3.
 */
export function repRecords(bestByReps: readonly RepRecord[]): RepRecord[] {
  const sorted = [...bestByReps].sort((a, b) => a.reps - b.reps);
  return sorted.filter((r) => !sorted.some((o) => o.reps > r.reps && o.weight >= r.weight));
}

export interface RecordEvent {
  exerciseId: string;
  date: string;
  sessionId: string;
  kind: 'weight' | 'e1rm';
  value: number;
  previous: number;
  set?: SetEntry;
}

/**
 * Sessions that beat the previous best weight or (otherwise) estimated 1RM. The first session
 * of an exercise only sets the baseline. Bodyweight exercises have no weight records.
 */
export function recordEvents(
  exercise: Pick<Exercise, 'id' | 'equipment'>,
  history: readonly HistoryEntry[],
): RecordEvent[] {
  if (exercise.equipment === 'bodyweight') return [];
  const events: RecordEvent[] = [];
  let maxWeight = 0;
  let maxE1rm = 0;
  let first = true;
  for (const entry of history) {
    if (entry.deload) continue;
    const sets = entry.sets.filter(countsForStrength);
    if (sets.length === 0) continue;
    const best = bestE1rm(sets);
    const weight = Math.max(...sets.map((s) => s.weight));
    const e = best?.value ?? 0;
    const base = { exerciseId: exercise.id, date: entry.session.date, sessionId: entry.session.id };
    if (!first) {
      if (weight > maxWeight) {
        events.push({ ...base, kind: 'weight', value: weight, previous: maxWeight });
      } else if (best && e > maxE1rm + 0.01) {
        events.push({ ...base, kind: 'e1rm', value: e, previous: maxE1rm, set: best.set });
      }
    }
    maxWeight = Math.max(maxWeight, weight);
    maxE1rm = Math.max(maxE1rm, e);
    first = false;
  }
  return events;
}

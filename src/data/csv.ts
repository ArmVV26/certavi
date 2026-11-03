// CSV exports for Excel in Spanish: UTF-8 BOM, `;` separator, decimal comma, CRLF.
// Same columns as gym_app, so existing spreadsheets keep working. Texts come from the caller
// (already translated), so this module stays free of i18n.
import {
  countsForStrength,
  epley1rm,
  isEffectiveSet,
  toIsoDate,
  type ActivityKind,
  type Exercise,
  type ExerciseNote,
  type Routine,
  type SetEntry,
  type SetKind,
  type TextRef,
  type WorkoutSession,
} from '../domain';
import { isLive, type CertaviDb } from './db';
import type { ExportFile } from './exportFile';

export type CsvValue = string | number | boolean | null | undefined;

export interface CsvLabels {
  yes: string;
  no: string;
  /** Resolves seed i18n keys and user text. */
  text: (ref: TextRef) => string;
  setKind: (kind: SetKind) => string;
  activityKind: (kind: ActivityKind) => string;
  freeSession: string;
  setsHeader: readonly string[];
  activityHeader: readonly string[];
  /** Values of the "type" column of the activity CSV. */
  activityRow: string;
  weightRow: string;
}

const BOM = '\uFEFF';
const MIME = 'text/csv;charset=utf-8';

function cell(value: CsvValue, labels: Pick<CsvLabels, 'yes' | 'no'>): string {
  if (value === null || value === undefined) return '';
  const text =
    typeof value === 'boolean'
      ? value
        ? labels.yes
        : labels.no
      : typeof value === 'number'
        ? String(value).replace('.', ',')
        : value;
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Rows → CSV text for Excel in Spanish. */
export function toCsv(
  rows: readonly (readonly CsvValue[])[],
  labels: Pick<CsvLabels, 'yes' | 'no'>,
): string {
  return BOM + rows.map((row) => row.map((v) => cell(v, labels)).join(';')).join('\r\n');
}

/** Warm-ups first, then the planned sets, then extra sets; by slot inside each group. */
const KIND_RANK: Readonly<Record<SetKind, number>> = {
  warmup: 0,
  approach: 1,
  top: 1,
  backoff: 1,
  straight: 1,
  bilbo: 1,
  extra: 2,
};

const byDateThenStart = (a: WorkoutSession, b: WorkoutSession) =>
  a.date.localeCompare(b.date) || (a.startedAt ?? 0) - (b.startedAt ?? 0);

/** Sets of one session in display order: exercises as in the session, then by kind and slot. */
function orderSets(session: WorkoutSession, sets: readonly SetEntry[]): SetEntry[] {
  const order = session.items.map((i) => i.exerciseId);
  const position = (exerciseId: string) => {
    const index = order.indexOf(exerciseId);
    return index === -1 ? order.length : index;
  };
  const firstDone = new Map<string, number>();
  for (const set of sets) {
    firstDone.set(
      set.exerciseId,
      Math.min(firstDone.get(set.exerciseId) ?? Infinity, set.completedAt),
    );
  }
  return [...sets].sort(
    (a, b) =>
      position(a.exerciseId) - position(b.exerciseId) ||
      (firstDone.get(a.exerciseId) ?? 0) - (firstDone.get(b.exerciseId) ?? 0) ||
      a.exerciseId.localeCompare(b.exerciseId) ||
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      a.slot - b.slot,
  );
}

/** Every logged set, one row each (`certavi-sets-<today>.csv`). */
export async function exportSetsCsv(
  db: CertaviDb,
  labels: CsvLabels,
  now: Date = new Date(),
): Promise<ExportFile> {
  const [sessions, sets, notes, exercises, routines] = await db.transaction(
    'r',
    [db.sessions, db.sets, db.notes, db.exercises, db.routines],
    () =>
      Promise.all([
        db.sessions.toArray(),
        db.sets.toArray(),
        db.notes.toArray(),
        db.exercises.toArray(),
        db.routines.toArray(),
      ]),
  );
  const exerciseName = new Map(
    exercises.filter(isLive).map((e: Exercise) => [e.id, labels.text(e.name)]),
  );
  const routineName = new Map(
    routines.filter(isLive).map((r: Routine) => [r.id, labels.text(r.name)]),
  );
  const noteText = new Map(
    notes.filter(isLive).map((n: ExerciseNote) => [`${n.sessionId}|${n.exerciseId}`, n.text]),
  );
  const setsBySession = new Map<string, SetEntry[]>();
  for (const set of sets.filter(isLive)) {
    setsBySession.set(set.sessionId, [...(setsBySession.get(set.sessionId) ?? []), set]);
  }

  const rows: CsvValue[][] = [[...labels.setsHeader]];
  for (const session of sessions.filter(isLive).sort(byDateThenStart)) {
    const name =
      session.routineId === null
        ? labels.freeSession
        : (routineName.get(session.routineId) ?? session.routineId);
    const perExercise = new Map<string, number>();
    orderSets(session, setsBySession.get(session.id) ?? []).forEach((set, i) => {
      const order = (perExercise.get(set.exerciseId) ?? 0) + 1;
      perExercise.set(set.exerciseId, order);
      const e1rm = countsForStrength(set)
        ? Math.round(epley1rm(set.weight, set.reps) * 10) / 10
        : 0;
      rows.push([
        session.date,
        name,
        exerciseName.get(set.exerciseId) ?? set.exerciseId,
        labels.setKind(set.kind),
        order,
        set.weight,
        set.reps,
        set.rir,
        set.straps,
        set.band,
        e1rm > 0 ? e1rm : '',
        isEffectiveSet(set),
        noteText.get(`${session.id}|${set.exerciseId}`),
        i === 0 ? session.note : '',
      ]);
    });
  }
  return {
    fileName: `certavi-sets-${toIsoDate(now)}.csv`,
    mimeType: MIME,
    content: toCsv(rows, labels),
  };
}

/** Activities, then weekly body weights (`certavi-activity-weight-<today>.csv`). */
export async function exportActivityWeightCsv(
  db: CertaviDb,
  labels: CsvLabels,
  now: Date = new Date(),
): Promise<ExportFile> {
  const [activities, weights] = await db.transaction('r', [db.activities, db.bodyWeights], () =>
    Promise.all([db.activities.toArray(), db.bodyWeights.toArray()]),
  );
  const rows: CsvValue[][] = [[...labels.activityHeader]];
  for (const a of activities.filter(isLive).sort((x, y) => x.date.localeCompare(y.date))) {
    rows.push([a.date, labels.activityRow, labels.activityKind(a.kind), a.minutes, '', a.note]);
  }
  for (const w of weights.filter(isLive).sort((x, y) => x.week.localeCompare(y.week))) {
    rows.push([w.week, labels.weightRow, '', '', w.kg, '']);
  }
  return {
    fileName: `certavi-activity-weight-${toIsoDate(now)}.csv`,
    mimeType: MIME,
    content: toCsv(rows, labels),
  };
}

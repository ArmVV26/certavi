import { describe, expect, it } from 'vitest';
import {
  SEED_EXERCISES,
  SEED_ROUTINES_BY_ID,
  exerciseNoteId,
  weekPlanId,
  schemeRows,
  type SetEntry,
} from '../domain';
import { openTestDatabase } from '../test/render';
import type { CertaviDb } from './db';
import { createRepositories } from './repository';
import { ensureSeed } from './seed';
import {
  RowNotFoundError,
  SessionNotFoundError,
  UndoConflictError,
  addRow,
  deleteSession,
  logSet,
  removeSessionRow,
  restoreRow,
  restoreSession,
  saveExerciseNote,
  setRowType,
} from './sessionLog';
import {
  ExerciseAlreadyInSessionError,
  ExerciseNotFoundError,
  InvalidSessionTimesError,
  addExercise,
  changeSessionRoutine,
  moveExercise,
  removeExercise,
  restoreExercise,
  updateSessionTimes,
} from './sessionTools';
import { RoutineNotFoundError, readSession, startSession } from './sessions';

let clock = new Date(2026, 10, 4, 9, 30).getTime();
const now = () => {
  clock += 1;
  return clock;
};

const push = SEED_ROUTINES_BY_ID.get('push');
const pull = SEED_ROUTINES_BY_ID.get('pull');
if (!push || !pull) throw new Error('seed routines missing');
const pushIds = push.items.map((i) => i.exerciseId);
const pullIds = pull.items.map((i) => i.exerciseId);
const outsidePush = SEED_EXERCISES.find((e) => !pushIds.includes(e.id) && !e.archived);
if (!outsidePush) throw new Error('no exercise outside Push');
const onlyInPush = pushIds.find((id) => !pullIds.includes(id));
if (!onlyInPush) throw new Error('every Push exercise is in Pull');

async function setup(routineId: string | null = 'push') {
  const db = openTestDatabase();
  await ensureSeed(db);
  const { session } = await startSession(
    db,
    { date: '2026-11-04', routineId, today: '2026-11-04' },
    { now },
  );
  const live = async (): Promise<SetEntry[]> =>
    (await db.sets.toArray()).filter((s): s is SetEntry => !('deleted' in s));
  const current = async () => {
    const view = await readSession(db, session.id);
    if (!view) throw new Error('session missing');
    return view.session;
  };
  const log = (exerciseId: string, slot: number) =>
    logSet(db, { sessionId: session.id, exerciseId, slot, weight: 60, reps: 8, rir: 2 }, { now });
  return { db, session, live, current, log };
}

const ids = (items: readonly { exerciseId: string }[]) => items.map((i) => i.exerciseId);

describe('addExercise', () => {
  it('adds the exercise at the end of a routine session, tagged as added, and queues it', async () => {
    const { db, session, current } = await setup();
    const updated = await addExercise(db, session.id, outsidePush.id, { now });
    expect(ids(updated.items)).toEqual([...pushIds, outsidePush.id]);
    expect(updated.items.at(-1)).toMatchObject({ added: true, optional: false });
    expect(updated.items.at(-1)?.scheme).toEqual(outsidePush.defaultScheme);
    expect(ids((await current()).items)).toContain(outsidePush.id);
    expect(await db.pending.get(session.id)).toBeDefined();
  });

  it('does not tag it in a free session', async () => {
    const { db, session } = await setup(null);
    const updated = await addExercise(db, session.id, outsidePush.id, { now });
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0]?.added).toBeUndefined();
  });

  it('does not change the routine', async () => {
    const { db, session } = await setup();
    await addExercise(db, session.id, outsidePush.id, { now });
    const repos = createRepositories(db);
    expect(ids((await repos.routine.get('push'))?.items ?? [])).toEqual(pushIds);
  });

  it('refuses an exercise that is already there, an unknown one and an unknown session', async () => {
    const { db, session } = await setup();
    await expect(addExercise(db, session.id, pushIds[0] ?? '')).rejects.toBeInstanceOf(
      ExerciseAlreadyInSessionError,
    );
    await expect(addExercise(db, session.id, 'nope')).rejects.toBeInstanceOf(ExerciseNotFoundError);
    await expect(addExercise(db, 'ses_nope', outsidePush.id)).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );
  });
});

describe('moveExercise', () => {
  it('swaps the exercise with its neighbour and keeps its sets', async () => {
    const { db, session, current, log, live } = await setup();
    const [first, second] = pushIds;
    if (!first || !second) throw new Error('Push has fewer than two exercises');
    await log(first, 0);
    expect(await moveExercise(db, session.id, first, 1, { now })).toBe(true);
    expect(ids((await current()).items).slice(0, 2)).toEqual([second, first]);
    expect((await live()).map((s) => s.exerciseId)).toEqual([first]);
  });

  it('returns false at the ends and for an unknown exercise', async () => {
    const { db, session, current } = await setup();
    const before = await current();
    expect(await moveExercise(db, session.id, pushIds[0] ?? '', -1)).toBe(false);
    expect(await moveExercise(db, session.id, pushIds.at(-1) ?? '', 1)).toBe(false);
    expect(await moveExercise(db, session.id, 'nope', 1)).toBe(false);
    expect(await current()).toEqual(before);
  });
});

describe('removeExercise and restoreExercise', () => {
  it('removes the exercise with its sets and note, and Undo brings them back in place', async () => {
    const { db, session, current, log, live } = await setup();
    const target = pushIds[1] ?? '';
    await log(target, 0);
    await log(target, 1);
    await saveExerciseNote(
      db,
      {
        sessionId: session.id,
        exerciseId: target,
        text: 'machine busy',
        excludeFromProgression: false,
      },
      { now },
    );
    const undo = await removeExercise(db, session.id, target, { now });

    expect(undo).toMatchObject({ kind: 'exercise', index: 1 });
    expect(undo.sets).toHaveLength(2);
    expect(undo.note?.text).toBe('machine busy');
    expect(ids((await current()).items)).not.toContain(target);
    expect(await live()).toHaveLength(0);
    expect(await db.notes.get(exerciseNoteId(session.id, target))).toMatchObject({ deleted: true });

    await restoreExercise(db, undo, { now });
    expect(ids((await current()).items)).toEqual(pushIds);
    expect(await live()).toHaveLength(2);
    expect(await db.notes.get(exerciseNoteId(session.id, target))).toMatchObject({
      text: 'machine busy',
    });
    const view = await readSession(db, session.id);
    expect(view?.sets.map((s) => s.slot).sort()).toEqual([0, 1]);
  });

  it('refuses to restore when the exercise was added again or the session is gone', async () => {
    const { db, session } = await setup();
    const target = pushIds[1] ?? '';
    const undo = await removeExercise(db, session.id, target, { now });
    await addExercise(db, session.id, target, { now });
    await expect(restoreExercise(db, undo, { now })).rejects.toBeInstanceOf(UndoConflictError);

    await deleteSession(db, session.id, { now });
    await expect(restoreExercise(db, undo, { now })).rejects.toBeInstanceOf(UndoConflictError);
  });

  it('refuses to remove an exercise that is not in the session', async () => {
    const { db, session } = await setup();
    await expect(removeExercise(db, session.id, 'nope')).rejects.toBeInstanceOf(RowNotFoundError);
  });

  it('can empty a routine session', async () => {
    const { db, session, current } = await setup();
    for (const id of pushIds) await removeExercise(db, session.id, id, { now });
    expect((await current()).items).toEqual([]);
  });
});

describe('changeSessionRoutine', () => {
  it('follows the new routine and keeps the exercises that have data, tagged', async () => {
    const { db, session, log } = await setup();
    await log(onlyInPush, 0);
    const updated = await changeSessionRoutine(db, session.id, 'pull', { now });
    expect(updated.routineId).toBe('pull');
    expect(ids(updated.items)).toEqual([...pullIds, onlyInPush]);
    expect(updated.items.at(-1)?.added).toBe(true);
    expect(updated.items.slice(0, -1).some((i) => i.added)).toBe(false);
    const view = await readSession(db, session.id);
    expect(view?.sets).toHaveLength(1);
    expect(view?.routine?.id).toBe('pull');
  });

  it('keeps the rows of a common exercise that has data', async () => {
    const { db, session, log } = await setup();
    const upperIds = SEED_ROUTINES_BY_ID.get('upper')?.items.map((i) => i.exerciseId) ?? [];
    const common = pushIds.find((id) => upperIds.includes(id));
    expect(common).toBeDefined();
    if (!common) return;
    await addRow(db, session.id, common, 'warmup', { now });
    await log(common, 0);
    const before = (await readSession(db, session.id))?.session.items.find(
      (i) => i.exerciseId === common,
    );
    const updated = await changeSessionRoutine(db, session.id, 'upper', { now });
    const after = updated.items.find((i) => i.exerciseId === common);
    expect(after?.scheme).toEqual(before?.scheme);
    expect(schemeRows(after?.scheme ?? { blocks: [], rir: '' })[0]?.kind).toBe('warmup');
    expect(after?.added).toBeUndefined();
  });

  it('keeps an exercise that only has a note', async () => {
    const { db, session } = await setup();
    await saveExerciseNote(
      db,
      { sessionId: session.id, exerciseId: onlyInPush, text: 'x', excludeFromProgression: false },
      { now },
    );
    const updated = await changeSessionRoutine(db, session.id, 'pull', { now });
    expect(ids(updated.items)).toContain(onlyInPush);
  });

  it('turns into a free session keeping only what has data, without tags', async () => {
    const { db, session, log } = await setup();
    await log(onlyInPush, 0);
    const updated = await changeSessionRoutine(db, session.id, null, { now });
    expect(updated.routineId).toBeNull();
    expect(ids(updated.items)).toEqual([onlyInPush]);
    expect(updated.items[0]?.added).toBeUndefined();
  });

  it('does nothing for the same routine and refuses an unknown one', async () => {
    const { db, session, current } = await setup();
    const before = await current();
    expect(await changeSessionRoutine(db, session.id, 'push', { now })).toEqual(before);
    await expect(changeSessionRoutine(db, session.id, 'nope')).rejects.toBeInstanceOf(
      RoutineNotFoundError,
    );
    await expect(changeSessionRoutine(db, 'ses_nope', 'pull')).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );
  });

  it('reduces the new routine in a deload week', async () => {
    const { db, session } = await setup();
    const repos = createRepositories(db, { now });
    await repos.weekPlan.put({
      id: weekPlanId('2026-11-02'),
      week: '2026-11-02',
      hiking: false,
      deload: true,
      size: 5,
    });
    const updated = await changeSessionRoutine(db, session.id, 'pull', { now });
    expect((await readSession(db, session.id))?.deload).toBe(true);
    const optional = pull.items.filter((i) => i.optional).map((i) => i.exerciseId);
    expect(optional.length).toBeGreaterThan(0);
    expect(ids(updated.items).some((id) => optional.includes(id))).toBe(false);
  });
});

describe('updateSessionTimes', () => {
  it('moves a finished session to another date and hours', async () => {
    const { db, session } = await setup();
    await createRepositories(db, { now }).session.put({
      ...session,
      endedAt: (session.startedAt ?? 0) + 60_000,
    });
    const updated = await updateSessionTimes(
      db,
      session.id,
      { date: '2026-11-03', start: '17:30', end: '18:45' },
      '2026-11-04',
      { now },
    );
    expect(updated.date).toBe('2026-11-03');
    expect(updated.startedAt).toBe(new Date(2026, 10, 3, 17, 30).getTime());
    expect(updated.endedAt).toBe(new Date(2026, 10, 3, 18, 45).getTime());
  });

  it('ignores the end while the session is in progress', async () => {
    const { db, session } = await setup();
    const updated = await updateSessionTimes(
      db,
      session.id,
      { date: '2026-11-04', start: '08:00', end: '09:00' },
      '2026-11-04',
      { now },
    );
    expect(updated.endedAt).toBeNull();
    expect(updated.startedAt).toBe(new Date(2026, 10, 4, 8, 0).getTime());
  });

  it('saves nothing when the date is in the future or the end is earlier', async () => {
    const { db, session } = await setup();
    await createRepositories(db, { now }).session.put({
      ...session,
      endedAt: (session.startedAt ?? 0) + 60_000,
    });
    const before = await db.sessions.get(session.id);
    const patch = { date: '2026-11-04', start: '10:00', end: '11:00' };
    await expect(
      updateSessionTimes(db, session.id, { ...patch, date: '2026-11-05' }, '2026-11-04'),
    ).rejects.toMatchObject({ reason: 'future' });
    await expect(
      updateSessionTimes(db, session.id, { ...patch, end: '09:59' }, '2026-11-04'),
    ).rejects.toMatchObject({ reason: 'endBeforeStart' });
    await expect(
      updateSessionTimes(db, session.id, { ...patch, end: null }, '2026-11-04'),
    ).rejects.toBeInstanceOf(InvalidSessionTimesError);
    expect(await db.sessions.get(session.id)).toEqual(before);
  });

  it('refuses an unknown session', async () => {
    const { db } = await setup();
    await expect(
      updateSessionTimes(
        db,
        'ses_nope',
        { date: '2026-11-04', start: '10:00', end: null },
        '2026-11-04',
      ),
    ).rejects.toBeInstanceOf(SessionNotFoundError);
  });
});

describe('Undo of a removed row', () => {
  async function rowsOf(db: CertaviDb, sessionId: string, exerciseId: string) {
    const view = await readSession(db, sessionId);
    const item = view?.session.items.find((i) => i.exerciseId === exerciseId);
    return item ? schemeRows(item.scheme) : [];
  }

  it('puts the row back at its position with its set, and the rows below move down', async () => {
    const { db, session, log } = await setup();
    const exerciseId = pushIds[0] ?? '';
    const rows = await rowsOf(db, session.id, exerciseId);
    expect(rows.length).toBeGreaterThan(2);
    await log(exerciseId, 1);
    await log(exerciseId, 2);

    const removal = await removeSessionRow(db, session.id, exerciseId, 1, { now });
    expect(removal.undo).toMatchObject({ kind: 'row', slot: 1, row: rows[1] });
    expect(removal.undo.sets).toHaveLength(1);
    expect(await rowsOf(db, session.id, exerciseId)).toHaveLength(rows.length - 1);

    const edit = await restoreRow(db, removal.undo, { now });
    expect(await rowsOf(db, session.id, exerciseId)).toEqual(rows);
    const view = await readSession(db, session.id);
    expect(view?.sets.map((s) => s.slot).sort()).toEqual([1, 2]);
    expect(edit.remap(1)).toBe(2);
    expect(edit.remap(0)).toBe(0);
  });

  it('restores an empty row too, and keeps its kind after a type change', async () => {
    const { db, session } = await setup();
    const exerciseId = pushIds[0] ?? '';
    await setRowType(db, session.id, exerciseId, 1, 'dropset', { now });
    const rows = await rowsOf(db, session.id, exerciseId);
    const removal = await removeSessionRow(db, session.id, exerciseId, 1, { now });
    expect(removal.undo.sets).toEqual([]);
    await restoreRow(db, removal.undo, { now });
    expect(await rowsOf(db, session.id, exerciseId)).toEqual(rows);
  });

  it('restores a stray logged set whose row was already gone', async () => {
    const { db, session, live } = await setup();
    const exerciseId = pushIds[0] ?? '';
    const rows = await rowsOf(db, session.id, exerciseId);
    const stray = rows.length + 3;
    await createRepositories(db, { now }).set.put({
      id: 'set_stray',
      sessionId: session.id,
      exerciseId,
      kind: 'extra',
      slot: stray,
      weight: 10,
      reps: 5,
      rir: null,
      completedAt: 1,
    });
    const removal = await removeSessionRow(db, session.id, exerciseId, stray, { now });
    expect(removal.undo.row).toBeNull();
    expect(await live()).toHaveLength(0);
    await restoreRow(db, removal.undo, { now });
    expect((await live()).map((s) => s.id)).toEqual(['set_stray']);
    expect(await rowsOf(db, session.id, exerciseId)).toEqual(rows);
  });

  it('refuses when the exercise or the session is gone', async () => {
    const { db, session } = await setup();
    const exerciseId = pushIds[0] ?? '';
    const removal = await removeSessionRow(db, session.id, exerciseId, 0, { now });
    await removeExercise(db, session.id, exerciseId, { now });
    await expect(restoreRow(db, removal.undo, { now })).rejects.toBeInstanceOf(UndoConflictError);
  });

  it('removes a row only if there is one', async () => {
    const { db, session } = await setup();
    await expect(
      removeSessionRow(db, session.id, pushIds[0] ?? '', 99, { now }),
    ).rejects.toBeInstanceOf(RowNotFoundError);
  });
});

describe('Undo of a deleted session', () => {
  it('brings back the session with its sets and notes', async () => {
    const { db, session, log, live } = await setup();
    const exerciseId = pushIds[0] ?? '';
    await log(exerciseId, 0);
    await saveExerciseNote(
      db,
      { sessionId: session.id, exerciseId, text: 'note', excludeFromProgression: false },
      { now },
    );
    const undo = await deleteSession(db, session.id, { now });
    if (!undo) throw new Error('nothing to undo');
    expect(undo).toMatchObject({ kind: 'session' });
    expect(undo.sets).toHaveLength(1);
    expect(undo.notes).toHaveLength(1);
    expect(await readSession(db, session.id)).toBeNull();
    expect(await live()).toHaveLength(0);

    await restoreSession(db, undo, { now });
    const view = await readSession(db, session.id);
    expect(view?.session.items).toEqual(session.items);
    expect(view?.sets).toHaveLength(1);
    expect(view?.notes[0]?.text).toBe('note');
    expect(await db.pending.get(session.id)).toBeDefined();
  });

  it('has nothing to undo when the session does not exist', async () => {
    const { db, session } = await setup();
    expect(await deleteSession(db, 'ses_nope', { now })).toBeNull();
    expect(await readSession(db, session.id)).not.toBeNull();
  });

  it('does not fail when the session was already deleted', async () => {
    const { db, session } = await setup();
    await deleteSession(db, session.id, { now });
    expect(await deleteSession(db, session.id, { now })).toBeNull();
  });
});

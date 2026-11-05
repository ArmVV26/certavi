import { describe, expect, it } from 'vitest';
import { makeSession, makeSet } from '../domain/testing/builders';
import { schemeRows, type SetEntry } from '../domain';
import { openTestDatabase } from '../test/render';
import type { CertaviDb } from './db';
import { createRepositories } from './repository';
import { ensureSeed } from './seed';
import {
  RowNotFoundError,
  SessionNotFoundError,
  addRow,
  applyStrapsBand,
  deleteSession,
  finishSession,
  logSet,
  normalizeLegacySessions,
  removeSessionRow,
  reopenSession,
  saveExerciseNote,
  setRowType,
  unlogSet,
  updateSessionFields,
} from './sessionLog';
import { readSession, startSession } from './sessions';

let clock = new Date(2026, 10, 4, 9, 30).getTime();
const now = () => {
  clock += 1;
  return clock;
};

async function currentRows(db: CertaviDb, sessionId: string) {
  const view = await readSession(db, sessionId);
  const scheme = view?.session.items[0]?.scheme;
  return scheme ? schemeRows(scheme) : [];
}

async function setup() {
  const db = openTestDatabase();
  await ensureSeed(db);
  const repos = createRepositories(db, { now });
  const { session } = await startSession(
    db,
    { date: '2026-11-04', routineId: 'push', today: '2026-11-04' },
    { now },
  );
  const item = session.items[0];
  if (!item) throw new Error('the routine has no exercises');
  const exerciseId = item.exerciseId;
  const rows = schemeRows(item.scheme);
  const liveSets = async () =>
    (await db.sets.toArray()).filter((s): s is SetEntry => !('deleted' in s));
  const sorted = async () => (await liveSets()).sort((a, b) => a.slot - b.slot);
  const log = (slot: number, extra: Partial<Parameters<typeof logSet>[1]> = {}) =>
    logSet(
      db,
      { sessionId: session.id, exerciseId, slot, weight: 60, reps: 8, rir: 2, ...extra },
      { now },
    );
  return { db, repos, session, exerciseId, rows, liveSets, sorted, log };
}

describe('logSet and unlogSet', () => {
  it('logs a set with the kind of its row and queues it', async () => {
    const { db, session, exerciseId, rows, log } = await setup();
    const set = await log(0, { straps: true, band: 'red' });
    expect(set).toMatchObject({
      sessionId: session.id,
      exerciseId,
      kind: rows[0]?.kind,
      slot: 0,
      weight: 60,
      reps: 8,
      rir: 2,
      straps: true,
      band: 'red',
    });
    expect(set.id).toMatch(/^set_/);
    expect(await db.pending.get(set.id)).toMatchObject({ type: 'set' });
  });

  it('corrects the set of a row instead of adding another, keeping time and extras', async () => {
    const { db, log } = await setup();
    const first = await log(1, { straps: false, band: 'blue' });
    const again = await log(1, { weight: 0, reps: 10, rir: null });
    expect(again).toMatchObject({
      id: first.id,
      weight: 0,
      reps: 10,
      rir: null,
      completedAt: first.completedAt,
      straps: false,
      band: 'blue',
    });
    expect(await db.sets.count()).toBe(1);
    const noBand = await log(1, { band: '' });
    expect(noBand.band).toBeUndefined();
  });

  it('refuses rows that do not exist', async () => {
    const { db, session, exerciseId, log } = await setup();
    await expect(log(99)).rejects.toBeInstanceOf(RowNotFoundError);
    await expect(
      logSet(db, {
        sessionId: session.id,
        exerciseId: 'nope',
        slot: 0,
        weight: 1,
        reps: 1,
        rir: null,
      }),
    ).rejects.toBeInstanceOf(RowNotFoundError);
    await expect(
      logSet(db, { sessionId: 'nope', exerciseId, slot: 0, weight: 1, reps: 1, rir: null }),
    ).rejects.toBeInstanceOf(SessionNotFoundError);
    expect(await db.sets.count()).toBe(0);
  });

  it('takes the set out of its row and leaves the row', async () => {
    const { db, session, exerciseId, sorted, log } = await setup();
    await log(0);
    await log(1);
    await unlogSet(db, session.id, exerciseId, 0);
    expect((await sorted()).map((s) => s.slot)).toEqual([1]);
    const view = await readSession(db, session.id);
    expect(view?.session.items[0]?.scheme).toEqual(session.items[0]?.scheme);
  });
});

describe('rows', () => {
  it('adds a warm-up on top and moves the logged sets down', async () => {
    const { db, session, exerciseId, sorted, log, rows: before } = await setup();
    await log(0);
    await log(2);
    const edit = await addRow(db, session.id, exerciseId, 'warmup', { now });
    expect(edit.remap(0)).toBe(1);
    expect((await sorted()).map((s) => s.slot)).toEqual([1, 3]);
    const rows = await currentRows(db, session.id);
    expect(rows[0]?.kind).toBe('warmup');
    expect(rows).toHaveLength(before.length + 1);
  });

  it('adds an extra set at the bottom', async () => {
    const { db, session, exerciseId, rows, log } = await setup();
    await addRow(db, session.id, exerciseId, 'extra', { now });
    const extra = await log(rows.length, { weight: 20, reps: 12 });
    expect(extra.kind).toBe('extra');
    await expect(addRow(db, session.id, 'nope', 'extra')).rejects.toBeInstanceOf(RowNotFoundError);
  });

  it('removes a row with its set; the rows below move up with their sets', async () => {
    const { db, session, exerciseId, rows, sorted, log } = await setup();
    await log(0);
    await log(1);
    await log(2, { weight: 50 });
    await removeSessionRow(db, session.id, exerciseId, 1, { now });
    const left = await sorted();
    expect(left.map((s) => [s.slot, s.weight])).toEqual([
      [0, 60],
      [1, 50],
    ]);
    expect(await currentRows(db, session.id)).toHaveLength(rows.length - 1);
    const routine = await db.routines.get('push');
    expect(routine && 'items' in routine && routine.items[0]?.scheme).toEqual(
      session.items[0]?.scheme,
    );
  });

  it('removes a logged set whose row is already gone, and refuses when there is nothing', async () => {
    const { db, repos, session, exerciseId, sorted, rows } = await setup();
    await repos.set.put(makeSet({ sessionId: session.id, exerciseId, slot: 40, id: 'stray' }));
    await removeSessionRow(db, session.id, exerciseId, 40, { now });
    expect(await sorted()).toEqual([]);
    await expect(removeSessionRow(db, session.id, exerciseId, 41)).rejects.toBeInstanceOf(
      RowNotFoundError,
    );
    expect(rows.length).toBeGreaterThan(1);
  });

  it('changes the type of a row in place, with its logged set', async () => {
    const { db, session, exerciseId, rows, sorted, log } = await setup();
    await log(1);
    await setRowType(db, session.id, exerciseId, 1, 'warmup', { now });
    expect((await sorted()).map((s) => s.kind)).toEqual(['warmup']);
    expect((await currentRows(db, session.id))[1]?.kind).toBe('warmup');
    await setRowType(db, session.id, exerciseId, 1, 'dropset', { now });
    expect((await sorted()).map((s) => s.kind)).toEqual(['dropset']);
    await setRowType(db, session.id, exerciseId, 1, 'effective', { now });
    expect((await sorted()).map((s) => s.kind)).toEqual(['straight']);
    await setRowType(db, session.id, exerciseId, 1, 'effective', { now });
    expect(await currentRows(db, session.id)).toHaveLength(rows.length);
    await expect(setRowType(db, session.id, exerciseId, 90, 'warmup')).rejects.toBeInstanceOf(
      RowNotFoundError,
    );
  });

  it('changes the type of an empty row', async () => {
    const { db, session, exerciseId } = await setup();
    await setRowType(db, session.id, exerciseId, 0, 'dropset', { now });
    expect((await currentRows(db, session.id))[0]?.kind).toBe('dropset');
    expect(await db.sets.count()).toBe(0);
  });
});

describe('straps and band', () => {
  it('sets them on every logged set of the exercise and counts them', async () => {
    const { session, exerciseId, db, log, sorted } = await setup();
    await log(0, { straps: true, band: 'red' });
    await log(1, { straps: true });
    expect(await applyStrapsBand(db, session.id, exerciseId, { straps: false }, { now })).toBe(2);
    expect((await sorted()).map((s) => [s.straps, s.band])).toEqual([
      [false, 'red'],
      [false, undefined],
    ]);
    await applyStrapsBand(db, session.id, exerciseId, { band: 'blue' }, { now });
    await applyStrapsBand(db, session.id, exerciseId, { band: '' }, { now });
    expect((await sorted()).every((s) => s.band === undefined)).toBe(true);
  });

  it('does nothing when nothing is logged', async () => {
    const { session, exerciseId, db } = await setup();
    expect(await applyStrapsBand(db, session.id, exerciseId, { straps: true })).toBe(0);
  });
});

describe('notes and session fields', () => {
  it('saves, changes and deletes the note of an exercise', async () => {
    const { db, session, exerciseId } = await setup();
    const input = { sessionId: session.id, exerciseId, text: 'Otra máquina' };
    await saveExerciseNote(
      db,
      { ...input, excludeFromProgression: true, reason: 'machine-busy' },
      { now },
    );
    expect(await db.notes.get(`note_${session.id}_${exerciseId}`)).toMatchObject({
      text: 'Otra máquina',
      excludeFromProgression: true,
      reason: 'machine-busy',
    });
    await saveExerciseNote(db, { ...input, excludeFromProgression: false }, { now });
    const note = await db.notes.get(`note_${session.id}_${exerciseId}`);
    expect(note).toMatchObject({ text: 'Otra máquina' });
    expect(note && 'excludeFromProgression' in note).toBe(false);
    await saveExerciseNote(db, { ...input, text: '  ', excludeFromProgression: true }, { now });
    expect(await db.notes.get(`note_${session.id}_${exerciseId}`)).toMatchObject({
      excludeFromProgression: true,
    });
    await saveExerciseNote(db, { ...input, text: '', excludeFromProgression: false }, { now });
    expect(await db.notes.get(`note_${session.id}_${exerciseId}`)).toMatchObject({
      deleted: true,
    });
    await expect(
      saveExerciseNote(db, { ...input, sessionId: 'nope', excludeFromProgression: false }),
    ).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it('updates the session note and readiness', async () => {
    const { db, session } = await setup();
    expect(
      await updateSessionFields(db, session.id, { note: 'ok', readiness: 4 }, { now }),
    ).toMatchObject({
      note: 'ok',
      readiness: 4,
    });
    expect(await updateSessionFields(db, session.id, { readiness: null }, { now })).toMatchObject({
      note: 'ok',
      readiness: null,
    });
    await expect(updateSessionFields(db, 'nope', { note: 'x' })).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );
  });
});

describe('finishing, reopening and deleting', () => {
  it('finishes today now and a past day 75 minutes after it started', async () => {
    const { db, session } = await setup();
    const done = await finishSession(db, session.id, '2026-11-04', { now });
    expect(done.session.endedAt).toBeGreaterThan(session.startedAt ?? 0);
    expect(done.records).toBe(0);
    expect((await reopenSession(db, session.id, { now })).endedAt).toBeNull();

    const past = makeSession({ id: 'past', date: '2026-11-02', startedAt: 1000, routineId: null });
    await createRepositories(db, { now }).session.put(past);
    const finished = await finishSession(db, 'past', '2026-11-04', { now });
    expect(finished.session.endedAt).toBe(1000 + 75 * 60_000);
    await expect(finishSession(db, 'nope', '2026-11-04')).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );
    await expect(reopenSession(db, 'nope')).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it('counts the records the session set', async () => {
    const { db, repos, session, exerciseId, log } = await setup();
    await repos.session.put(makeSession({ id: 'before', date: '2026-11-02', routineId: null }));
    await repos.set.put(
      makeSet({ id: 'b1', sessionId: 'before', exerciseId, kind: 'top', weight: 50, reps: 8 }),
    );
    await repos.set.put(
      makeSet({
        id: 'b2',
        sessionId: 'before',
        exerciseId: 'other',
        kind: 'top',
        weight: 5,
        reps: 8,
      }),
    );
    await log(1, { weight: 80, reps: 8 });
    const { records } = await finishSession(db, session.id, '2026-11-04', { now });
    expect(records).toBe(1);
  });

  it('deletes the session with its sets and notes', async () => {
    const { db, session, exerciseId, log } = await setup();
    await log(0);
    await saveExerciseNote(
      db,
      { sessionId: session.id, exerciseId, text: 'x', excludeFromProgression: false },
      { now },
    );
    await deleteSession(db, session.id, { now });
    expect(await readSession(db, session.id)).toBeNull();
    expect((await db.sets.toArray()).every((s) => 'deleted' in s)).toBe(true);
    expect((await db.notes.toArray()).every((n) => 'deleted' in n)).toBe(true);
    expect(await db.pending.count()).toBeGreaterThan(0);
  });
});

describe('what the session screen reads', () => {
  it('returns sets, notes, last time and the deload flag', async () => {
    const { db, repos, session, exerciseId } = await setup();
    await repos.session.put(makeSession({ id: 'old', date: '2026-10-28', routineId: null }));
    await repos.set.put(
      makeSet({ id: 'o1', sessionId: 'old', exerciseId, kind: 'top', weight: 62.5, reps: 8 }),
    );
    await repos.set.put(makeSet({ id: 'o2', sessionId: 'old', exerciseId: 'x', weight: 1 }));
    await repos.weekPlan.put({
      id: 'week_2026-11-02',
      week: '2026-11-02',
      hiking: false,
      deload: true,
      size: 5,
    });
    await saveExerciseNote(
      db,
      { sessionId: session.id, exerciseId, text: 'n', excludeFromProgression: false },
      { now },
    );
    const view = await readSession(db, session.id);
    expect(view?.references.get(exerciseId)?.sets[0]?.weight).toBe(62.5);
    expect(view?.references.size).toBe(1);
    expect(view?.notes).toHaveLength(1);
    expect(view?.sets).toEqual([]);
    expect(view?.deload).toBe(true);
  });
});

describe('sessions imported from gym_app', () => {
  it('brings warm-ups and extra sets into one list, once', async () => {
    const { db, repos, session, exerciseId, rows, sorted } = await setup();
    const at = { sessionId: session.id, exerciseId };
    await repos.set.putMany([
      makeSet({ ...at, id: 'st_w1', kind: 'warmup', slot: 1 }),
      makeSet({ ...at, id: 'st_p1', kind: rows[1]?.kind, slot: 1 }),
      makeSet({ ...at, id: 'st_x1', kind: 'extra', slot: 1 }),
    ]);
    expect(await normalizeLegacySessions(db, { now })).toBe(1);
    const newRows = await currentRows(db, session.id);
    expect(newRows[0]?.kind).toBe('warmup');
    expect(newRows.at(-1)?.kind).toBe('extra');
    expect((await sorted()).map((s) => [s.id, s.slot])).toEqual([
      ['st_w1', 0],
      ['st_p1', 2],
      ['st_x1', rows.length + 1],
    ]);
    expect(await normalizeLegacySessions(db, { now })).toBe(0);
  });

  it('leaves sessions without legacy sets alone, including deleted ones', async () => {
    const { db, repos, session } = await setup();
    await repos.session.remove(session.id);
    expect(await normalizeLegacySessions(db)).toBe(0);
  });
});

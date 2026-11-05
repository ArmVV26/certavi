// Writing an active session: logging sets, rows, notes, finishing and deleting. Every function is
// one transaction that updates the records and the pending queue together (ADR-0002).
import {
  addExtraRow,
  addWarmupRow,
  changeRowKind,
  displayRows,
  effectiveKindFor,
  exerciseHistory,
  exerciseNoteId,
  normalizeLegacyRows,
  PAST_SESSION_MINUTES,
  recordEvents,
  remapSets,
  removeRow,
  schemeRows,
  type ExclusionReason,
  type PlanItem,
  type RowEdit,
  type SetEntry,
  type WorkoutSession,
} from '../domain';
import { isLive, type CertaviDb } from './db';
import { ID_PREFIX, newId } from './ids';
import { createRepository, type RepositoryOptions } from './repository';

export class SessionNotFoundError extends Error {
  readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
    this.sessionId = sessionId;
  }
}

export class RowNotFoundError extends Error {
  constructor(sessionId: string, exerciseId: string, slot: number) {
    super(`No row ${String(slot)} for ${exerciseId} in session ${sessionId}`);
    this.name = 'RowNotFoundError';
  }
}

const tables = (db: CertaviDb) => [db.sessions, db.sets, db.notes, db.pending, db.meta];

interface Loaded {
  session: WorkoutSession;
  index: number;
  item: PlanItem;
  /** Live sets of this exercise in this session. */
  sets: SetEntry[];
}

async function loadExercise(db: CertaviDb, sessionId: string, exerciseId: string): Promise<Loaded> {
  const session = await db.sessions.get(sessionId);
  if (!session || !isLive(session)) throw new SessionNotFoundError(sessionId);
  const index = session.items.findIndex((item) => item.exerciseId === exerciseId);
  const item = session.items[index];
  if (!item) throw new RowNotFoundError(sessionId, exerciseId, -1);
  const rows = await db.sets.where('sessionId').equals(sessionId).toArray();
  return {
    session,
    index,
    item,
    sets: rows.filter((s): s is SetEntry => isLive(s) && s.exerciseId === exerciseId),
  };
}

const atSlot = (sets: readonly SetEntry[], slot: number) => sets.filter((s) => s.slot === slot);
const newest = (sets: readonly SetEntry[]) =>
  [...sets].sort((a, b) => b.updatedAt - a.updatedAt)[0];

export interface LogSetInput {
  sessionId: string;
  exerciseId: string;
  slot: number;
  weight: number;
  reps: number;
  rir: number | null;
  /** Omitted: keep what the set already has. */
  straps?: boolean;
  /** Omitted: keep what the set already has; '' means no band. */
  band?: string;
}

/** Logs (or corrects) the set of a row. The kind is the row's; the first time stays. */
export function logSet(
  db: CertaviDb,
  input: LogSetInput,
  { now = Date.now }: RepositoryOptions = {},
): Promise<SetEntry> {
  const sets = createRepository(db, 'set', { now });
  return db.transaction('rw', tables(db), async () => {
    const { item, sets: mine } = await loadExercise(db, input.sessionId, input.exerciseId);
    const existing = newest(atSlot(mine, input.slot));
    const kind = existing?.kind ?? schemeRows(item.scheme)[input.slot]?.kind;
    if (!kind) throw new RowNotFoundError(input.sessionId, input.exerciseId, input.slot);
    const straps = input.straps ?? existing?.straps;
    const band = input.band === undefined ? existing?.band : input.band || undefined;
    return sets.put({
      id: existing?.id ?? newId(ID_PREFIX.set, now()),
      sessionId: input.sessionId,
      exerciseId: input.exerciseId,
      kind,
      slot: input.slot,
      weight: input.weight,
      reps: input.reps,
      rir: input.rir,
      ...(straps === undefined ? {} : { straps }),
      ...(band === undefined ? {} : { band }),
      completedAt: existing?.completedAt ?? now(),
    });
  });
}

/** Takes the logged set out of a row; the row stays, empty. */
export function unlogSet(
  db: CertaviDb,
  sessionId: string,
  exerciseId: string,
  slot: number,
  options: RepositoryOptions = {},
): Promise<void> {
  const sets = createRepository(db, 'set', options);
  return db.transaction('rw', tables(db), async () => {
    const { sets: mine } = await loadExercise(db, sessionId, exerciseId);
    for (const set of atSlot(mine, slot)) await sets.remove(set.id);
  });
}

/** Stores a new scheme for an exercise of the session and moves its logged sets to follow it. */
async function applyRowEdit(
  db: CertaviDb,
  loaded: Loaded,
  edit: RowEdit,
  options: RepositoryOptions,
): Promise<void> {
  const sessions = createRepository(db, 'session', options);
  const sets = createRepository(db, 'set', options);
  const items = loaded.session.items.map((item, i) =>
    i === loaded.index ? { ...item, scheme: edit.scheme } : item,
  );
  await sessions.put({ ...loaded.session, items });
  const { moved, removed } = remapSets(loaded.sets, edit.remap);
  for (const set of removed) await sets.remove(set.id);
  if (moved.length > 0) await sets.putMany(moved);
}

/** Adds a warm-up row at the top or an extra row at the bottom of an exercise. */
export function addRow(
  db: CertaviDb,
  sessionId: string,
  exerciseId: string,
  kind: 'warmup' | 'extra',
  options: RepositoryOptions = {},
): Promise<RowEdit> {
  return db.transaction('rw', tables(db), async () => {
    const loaded = await loadExercise(db, sessionId, exerciseId);
    const { scheme } = loaded.item;
    const edit = kind === 'warmup' ? addWarmupRow(scheme) : addExtraRow(scheme);
    await applyRowEdit(db, loaded, edit, options);
    return edit;
  });
}

/** Removes a row (and its logged set) from the session; the routine does not change. */
export function removeSessionRow(
  db: CertaviDb,
  sessionId: string,
  exerciseId: string,
  slot: number,
  options: RepositoryOptions = {},
): Promise<RowEdit> {
  return db.transaction('rw', tables(db), async () => {
    const loaded = await loadExercise(db, sessionId, exerciseId);
    const { scheme } = loaded.item;
    const edit = removeRow(scheme, slot);
    if (edit) {
      await applyRowEdit(db, loaded, edit, options);
      return edit;
    }
    // A logged set whose row is gone can still be removed.
    const stray = atSlot(loaded.sets, slot);
    if (stray.length === 0) throw new RowNotFoundError(sessionId, exerciseId, slot);
    const sets = createRepository(db, 'set', options);
    for (const set of stray) await sets.remove(set.id);
    return { scheme, remap: (s) => s };
  });
}

export type RowType = 'warmup' | 'effective' | 'dropset';

/** Changes the type of a row without moving it; a logged set follows. */
export function setRowType(
  db: CertaviDb,
  sessionId: string,
  exerciseId: string,
  slot: number,
  type: RowType,
  options: RepositoryOptions = {},
): Promise<void> {
  const sets = createRepository(db, 'set', options);
  return db.transaction('rw', tables(db), async () => {
    const loaded = await loadExercise(db, sessionId, exerciseId);
    const { item } = loaded;
    const rows = displayRows({ scheme: item.scheme, sets: loaded.sets, reference: null });
    const row = rows.find((r) => r.slot === slot);
    if (!row) throw new RowNotFoundError(sessionId, exerciseId, slot);
    const kind = type === 'effective' ? effectiveKindFor(row.kind) : type;
    if (kind === row.kind) return;
    const edit = changeRowKind(item.scheme, slot, kind);
    if (edit) await applyRowEdit(db, loaded, edit, options);
    const logged = atSlot(loaded.sets, slot);
    if (logged.length > 0) await sets.putMany(logged.map((s) => ({ ...s, kind })));
  });
}

/**
 * Sets straps and/or band on every logged set of an exercise in the session.
 * Returns how many sets changed.
 */
export function applyStrapsBand(
  db: CertaviDb,
  sessionId: string,
  exerciseId: string,
  patch: { straps?: boolean; band?: string },
  options: RepositoryOptions = {},
): Promise<number> {
  const sets = createRepository(db, 'set', options);
  return db.transaction('rw', tables(db), async () => {
    const { sets: mine } = await loadExercise(db, sessionId, exerciseId);
    const changed = mine.map((set) => {
      const { band: oldBand, ...rest } = set;
      const band = patch.band === undefined ? oldBand : patch.band || undefined;
      return {
        ...rest,
        ...(patch.straps === undefined ? {} : { straps: patch.straps }),
        ...(band === undefined ? {} : { band }),
      };
    });
    if (changed.length > 0) await sets.putMany(changed);
    return changed.length;
  });
}

export interface NoteInput {
  sessionId: string;
  exerciseId: string;
  text: string;
  excludeFromProgression: boolean;
  reason?: ExclusionReason;
}

/** Saves the note of an exercise; an empty note that excludes nothing is deleted. */
export function saveExerciseNote(
  db: CertaviDb,
  input: NoteInput,
  options: RepositoryOptions = {},
): Promise<void> {
  const notes = createRepository(db, 'note', options);
  const id = exerciseNoteId(input.sessionId, input.exerciseId);
  return db.transaction('rw', tables(db), async () => {
    const session = await db.sessions.get(input.sessionId);
    if (!session || !isLive(session)) throw new SessionNotFoundError(input.sessionId);
    if (input.text.trim() === '' && !input.excludeFromProgression) {
      await notes.remove(id);
      return;
    }
    await notes.put({
      id,
      sessionId: input.sessionId,
      exerciseId: input.exerciseId,
      text: input.text,
      ...(input.excludeFromProgression
        ? { excludeFromProgression: true, ...(input.reason ? { reason: input.reason } : {}) }
        : {}),
    });
  });
}

/** Changes the note and/or the "how do you feel" answer of the session. */
export function updateSessionFields(
  db: CertaviDb,
  sessionId: string,
  patch: { note?: string; readiness?: number | null },
  options: RepositoryOptions = {},
): Promise<WorkoutSession> {
  const sessions = createRepository(db, 'session', options);
  return db.transaction('rw', tables(db), async () => {
    const session = await sessions.get(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    return sessions.put({ ...session, ...patch });
  });
}

export interface FinishResult {
  session: WorkoutSession;
  /** Records the session set (never in a deload week). */
  records: number;
}

/**
 * Finishes the session: today's ends now, a session of another day ends 75 minutes after it
 * started. Returns how many records it set.
 */
export function finishSession(
  db: CertaviDb,
  sessionId: string,
  today: string,
  { now = Date.now }: RepositoryOptions = {},
): Promise<FinishResult> {
  const sessions = createRepository(db, 'session', { now });
  return db.transaction('rw', [...tables(db), db.exercises, db.weekPlans], async () => {
    const current = await sessions.get(sessionId);
    if (!current) throw new SessionNotFoundError(sessionId);
    const endedAt =
      current.date === today ? now() : (current.startedAt ?? now()) + PAST_SESSION_MINUTES * 60_000;
    const session = await sessions.put({ ...current, endedAt });
    return { session, records: await countRecords(db, session) };
  });
}

async function countRecords(db: CertaviDb, session: WorkoutSession): Promise<number> {
  const sessions = (await db.sessions.toArray()).filter((s) => isLive(s));
  const notes = (await db.notes.toArray()).filter((n) => isLive(n));
  const weekPlans = (await db.weekPlans.toArray()).filter((w) => isLive(w));
  const exercises = (await db.exercises.toArray()).filter((e) => isLive(e));
  let records = 0;
  for (const exercise of exercises) {
    if (!session.items.some((item) => item.exerciseId === exercise.id)) continue;
    const sets = (await db.sets.where('exerciseId').equals(exercise.id).toArray()).filter((s) =>
      isLive(s),
    );
    const history = exerciseHistory(exercise.id, { sessions, sets, notes, weekPlans });
    records += recordEvents(exercise, history).filter((e) => e.sessionId === session.id).length;
  }
  return records;
}

/** Marks a finished session as in progress again. */
export function reopenSession(
  db: CertaviDb,
  sessionId: string,
  options: RepositoryOptions = {},
): Promise<WorkoutSession> {
  const sessions = createRepository(db, 'session', options);
  return db.transaction('rw', tables(db), async () => {
    const session = await sessions.get(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    return sessions.put({ ...session, endedAt: null });
  });
}

/** Deletes the session with its sets and notes (soft: the deletions sync). */
export function deleteSession(
  db: CertaviDb,
  sessionId: string,
  options: RepositoryOptions = {},
): Promise<void> {
  const sessions = createRepository(db, 'session', options);
  const sets = createRepository(db, 'set', options);
  const notes = createRepository(db, 'note', options);
  return db.transaction('rw', tables(db), async () => {
    for (const set of await db.sets.where('sessionId').equals(sessionId).toArray()) {
      await sets.remove(set.id);
    }
    for (const note of await db.notes.where('sessionId').equals(sessionId).toArray()) {
      await notes.remove(note.id);
    }
    await sessions.remove(sessionId);
  });
}

/**
 * Sessions imported from gym_app number their sets by group (warm-up, planned, extra). This puts
 * every row of every such session in one list (see `normalizeLegacyRows`). Safe to run again.
 * Returns how many exercises changed.
 */
export function normalizeLegacySessions(
  db: CertaviDb,
  options: RepositoryOptions = {},
): Promise<number> {
  const sessions = createRepository(db, 'session', options);
  const sets = createRepository(db, 'set', options);
  return db.transaction('rw', tables(db), async () => {
    let changed = 0;
    for (const row of await db.sessions.toArray()) {
      if (!isLive(row)) continue;
      const logged = (await db.sets.where('sessionId').equals(row.id).toArray()).filter((s) =>
        isLive(s),
      );
      let items = row.items;
      const moved: SetEntry[] = [];
      for (const [i, item] of row.items.entries()) {
        const result = normalizeLegacyRows(
          item,
          logged.filter((s) => s.exerciseId === item.exerciseId),
        );
        if (!result) continue;
        items = items.map((it, j) => (j === i ? result.item : it));
        moved.push(...result.sets);
        changed += 1;
      }
      if (items === row.items) continue;
      await sessions.put({ ...row, items });
      if (moved.length > 0) await sets.putMany(moved);
    }
    return changed;
  });
}

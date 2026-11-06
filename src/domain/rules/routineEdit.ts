// Editing a routine: the sets of each exercise, the notes, and the checks that decide whether the
// edited routine can be saved. The exercises themselves are added, moved and removed with the
// helpers of sessionEdit.ts (a routine and a session plan are both lists of `PlanItem`).
//
// The editor works on a draft in which the text fields hold exactly what the user typed, so the
// draft can be invalid until `validateRoutineItems` says otherwise.
import { plainText, type TextRef } from '../model/envelope';
import { PLANNED_KINDS, isPlannedKind, type PlannedKind } from '../model/enums';
import type { PlanItem, Routine } from '../model/routine';
import { repRangeSchema, rirRangeSchema, type SetScheme } from '../model/scheme';
import { SEED_ROUTINES_BY_ID } from '../seed';
import { changeRowKind, removeRow, rowsToScheme, schemeRows, type SchemeRow } from './rows';
import { MAX_BLOCK_COUNT, countPlanSets, parseRepRange } from './scheme';

/** Most sets one exercise can have in a routine. */
export const MAX_ROUTINE_SETS = MAX_BLOCK_COUNT;

/** The kinds a set of a routine can have. */
export const ROUTINE_SET_KINDS = PLANNED_KINDS;

/** The sets of a scheme, one entry per set, in order. */
export function routineRows(scheme: SetScheme): SchemeRow[] {
  return schemeRows(scheme);
}

/**
 * The scheme with one more set at the end: a copy of the last one (a top set is followed by a
 * back-off set). null when the exercise already has `MAX_ROUTINE_SETS`.
 */
export function addRoutineRow(scheme: SetScheme): SetScheme | null {
  const rows = schemeRows(scheme);
  if (rows.length >= MAX_ROUTINE_SETS) return null;
  const last = rows.at(-1);
  const next: SchemeRow = !last
    ? { kind: 'straight', reps: '' }
    : { kind: last.kind === 'top' ? 'backoff' : last.kind, reps: last.reps };
  return rowsToScheme([...rows, next], scheme.rir);
}

/** The scheme without the set at `index`; null when there is no such set or it is the only one. */
export function removeRoutineRow(scheme: SetScheme, index: number): SetScheme | null {
  return removeRow(scheme, index)?.scheme ?? null;
}

/** The scheme with the set at `index` changed to `kind`; null when there is no such set. */
export function setRoutineRowKind(
  scheme: SetScheme,
  index: number,
  kind: PlannedKind,
): SetScheme | null {
  return changeRowKind(scheme, index, kind)?.scheme ?? null;
}

/** The scheme with the reps text of the set at `index` replaced; null when there is no such set. */
export function setRoutineRowReps(
  scheme: SetScheme,
  index: number,
  reps: string,
): SetScheme | null {
  const rows = schemeRows(scheme);
  const row = rows[index];
  if (!row) return null;
  rows[index] = { kind: row.kind, reps };
  return rowsToScheme(rows, scheme.rir);
}

export function setSchemeRir(scheme: SetScheme, rir: string): SetScheme {
  return { blocks: scheme.blocks, rir };
}

/** The item with its scheme replaced. */
export function withScheme(item: PlanItem, scheme: SetScheme): PlanItem {
  return { ...item, scheme };
}

/**
 * The item with the note replaced. A text is kept exactly as typed (the editor shows it back, so
 * it must not lose a trailing space); an empty text or null removes the note.
 */
export function withNote(item: PlanItem, note: TextRef | string | null): PlanItem {
  const rest = { ...item };
  delete rest.note;
  const ref = typeof note === 'string' ? (note === '' ? null : plainText(note)) : note;
  return ref ? { ...rest, note: ref } : rest;
}

/**
 * The draft as it will be saved: spaces are removed from the reps and the RIR ("6 - 8" is "6-8"),
 * notes are trimmed and an empty one is dropped. The structure is not changed.
 */
export function normalizeRoutineItems(items: readonly PlanItem[]): PlanItem[] {
  const squash = (text: string) => text.replace(/\s+/g, '');
  return items.map((item) => {
    const scheme: SetScheme = {
      blocks: item.scheme.blocks.map((block) => ({ ...block, reps: squash(block.reps) })),
      rir: squash(item.scheme.rir),
    };
    const clean = withScheme(item, scheme);
    return item.note && 'text' in item.note ? withNote(clean, item.note.text.trim()) : clean;
  });
}

export type RoutineIssueCode =
  | 'no-exercises'
  | 'duplicate-exercise'
  | 'no-sets'
  | 'reps-required'
  | 'reps-invalid'
  | 'rir-invalid';

export interface RoutineIssue {
  code: RoutineIssueCode;
  /** The exercise the issue is in; null for the routine as a whole. */
  exerciseId: string | null;
  /** 0-based index of the set (for the reps issues); null otherwise. */
  row: number | null;
}

/** '6-8', '8', '~10' are valid; '' is valid only as the reps of an approach set (checked apart). */
function repsAreValid(reps: string): boolean {
  if (!repRangeSchema.safeParse(reps).success) return false;
  const bounds = parseRepRange(reps);
  return bounds === null || (bounds.min >= 1 && bounds.min <= bounds.max);
}

function rirIsValid(rir: string): boolean {
  if (!rirRangeSchema.safeParse(rir).success) return false;
  const [from, to] = rir.split('-').map(Number);
  return from === undefined || to === undefined || from <= to;
}

/**
 * Everything wrong with the routine, in order. Empty = it can be saved. A routine needs an
 * exercise; an exercise appears once, has at least one set, a valid rep target on every set that
 * is not an approach set, and a valid RIR.
 */
export function validateRoutineItems(items: readonly PlanItem[]): RoutineIssue[] {
  const issues: RoutineIssue[] = [];
  if (items.length === 0) issues.push({ code: 'no-exercises', exerciseId: null, row: null });
  const seen = new Set<string>();
  for (const item of items) {
    const exerciseId = item.exerciseId;
    if (seen.has(exerciseId)) issues.push({ code: 'duplicate-exercise', exerciseId, row: null });
    seen.add(exerciseId);
    const rows = schemeRows(item.scheme);
    if (rows.length === 0) issues.push({ code: 'no-sets', exerciseId, row: null });
    rows.forEach((row, index) => {
      if (!isPlannedKind(row.kind)) return;
      if (row.reps === '' && row.kind !== 'approach') {
        issues.push({ code: 'reps-required', exerciseId, row: index });
      } else if (!repsAreValid(row.reps)) {
        issues.push({ code: 'reps-invalid', exerciseId, row: index });
      }
    });
    if (!rirIsValid(item.scheme.rir)) issues.push({ code: 'rir-invalid', exerciseId, row: null });
  }
  return issues;
}

/** Same exercise, scheme (set by set), note and optional flag. */
function sameItem(a: PlanItem, b: PlanItem): boolean {
  if (a.exerciseId !== b.exerciseId || a.optional !== b.optional) return false;
  if (a.scheme.rir !== b.scheme.rir) return false;
  const noteA = a.note ? JSON.stringify(a.note) : '';
  const noteB = b.note ? JSON.stringify(b.note) : '';
  if (noteA !== noteB) return false;
  const rowsA = schemeRows(a.scheme);
  const rowsB = schemeRows(b.scheme);
  return (
    rowsA.length === rowsB.length &&
    rowsA.every((row, i) => row.kind === rowsB[i]?.kind && row.reps === rowsB[i].reps)
  );
}

/** The two plans have the same exercises, in the same order, with the same sets, notes and flags. */
export function sameItems(a: readonly PlanItem[], b: readonly PlanItem[]): boolean {
  return a.length === b.length && a.every((item, i) => b[i] !== undefined && sameItem(item, b[i]));
}

/** The routine is one of the six that come with the app, so it can be restored. */
export function isSeedRoutine(routineId: string): boolean {
  return SEED_ROUTINES_BY_ID.has(routineId);
}

/** The routine is one of the originals and its exercises or sets differ from the original ones. */
export function differsFromSeed(routine: Pick<Routine, 'id' | 'items'>): boolean {
  const seed = SEED_ROUTINES_BY_ID.get(routine.id);
  return seed !== undefined && !sameItems(seed.items, routine.items);
}

export interface RoutineSummary {
  exercises: number;
  /** Planned sets, approach sets included. */
  sets: number;
}

export function routineSummary(items: readonly PlanItem[]): RoutineSummary {
  return { exercises: items.length, sets: countPlanSets(items) };
}

/** The routines in the order of their day (Monday first); the ones without a day come last. */
export function sortRoutines<T extends Pick<Routine, 'id' | 'weekday'>>(
  routines: readonly T[],
): T[] {
  return [...routines].sort(
    (a, b) => (a.weekday ?? 8) - (b.weekday ?? 8) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

// The rows of an exercise in an active session (what the user sees as "sets"), as in Hevy.
//
// A session keeps its own copy of each exercise's scheme (`WorkoutSession.items`). In that copy
// every row has a position, its slot: the routine gives the first rows, and for that day only the
// user can add a warm-up or an extra set, remove a row or change the type of a row. A logged set
// belongs to the row with its slot. None of this touches the routine.
import { isPlannedKind, type SetKind } from '../model/enums';
import type { PlanItem } from '../model/routine';
import type { RepRange, RirRange, SetScheme } from '../model/scheme';
import type { SetEntry } from '../model/session';
import { MAX_BLOCK_COUNT } from './scheme';
import { compareSets, isEffectiveSet } from './sets';

export interface SchemeRow {
  kind: SetKind;
  reps: RepRange;
}

/** One entry per row, in order. */
export function schemeRows(scheme: SetScheme): SchemeRow[] {
  return scheme.blocks.flatMap((block) =>
    Array.from({ length: block.count }, () => ({ kind: block.kind, reps: block.reps })),
  );
}

/** The inverse of `schemeRows`: consecutive equal rows become one block (at most 20 each). */
export function rowsToScheme(rows: readonly SchemeRow[], rir: RirRange): SetScheme {
  const blocks: SetScheme['blocks'] = [];
  for (const row of rows) {
    const last = blocks.at(-1);
    if (last && last.kind === row.kind && last.reps === row.reps && last.count < MAX_BLOCK_COUNT) {
      last.count += 1;
    } else {
      blocks.push({ kind: row.kind, reps: row.reps, count: 1 });
    }
  }
  return { blocks, rir };
}

/** A change to the rows and how the slots of the logged sets follow it. */
export interface RowEdit {
  scheme: SetScheme;
  /** New slot of a set that was at `slot`; null when its row is gone. */
  remap: (slot: number) => number | null;
}

const identity = (slot: number) => slot;

/** Kinds whose rows carry no rep target. */
const NO_TARGET: readonly SetKind[] = ['warmup', 'dropset', 'extra'];

/** A warm-up row after the warm-ups already there, above the rest. */
export function addWarmupRow(scheme: SetScheme): RowEdit {
  const rows = schemeRows(scheme);
  let at = 0;
  while (rows[at]?.kind === 'warmup') at += 1;
  rows.splice(at, 0, { kind: 'warmup', reps: '' });
  return {
    scheme: rowsToScheme(rows, scheme.rir),
    remap: (slot) => (slot >= at ? slot + 1 : slot),
  };
}

/** An extra set row at the bottom. */
export function addExtraRow(scheme: SetScheme): RowEdit {
  const rows = [...schemeRows(scheme), { kind: 'extra' as const, reps: '' as const }];
  return { scheme: rowsToScheme(rows, scheme.rir), remap: identity };
}

/**
 * Removes the row at `slot`; the rows below move up. null when there is no such row or it is the
 * only one (a scheme always has at least one block).
 */
export function removeRow(scheme: SetScheme, slot: number): RowEdit | null {
  const rows = schemeRows(scheme);
  if (rows.length <= 1 || !Number.isInteger(slot) || slot < 0 || slot >= rows.length) return null;
  rows.splice(slot, 1);
  return {
    scheme: rowsToScheme(rows, scheme.rir),
    remap: (old) => (old === slot ? null : old > slot ? old - 1 : old),
  };
}

/** Changes the type of the row at `slot`; the row stays in place. null when there is no such row. */
export function changeRowKind(scheme: SetScheme, slot: number, kind: SetKind): RowEdit | null {
  const rows = schemeRows(scheme);
  const row = rows[slot];
  if (!row) return null;
  rows[slot] = { kind, reps: NO_TARGET.includes(kind) ? '' : row.reps };
  return { scheme: rowsToScheme(rows, scheme.rir), remap: identity };
}

/**
 * The kind a row takes when the user chooses "effective": a row that already is keeps its kind;
 * a warm-up or dropset becomes a plain set (Top and Back-off only come from the routine).
 */
export function effectiveKindFor(current: SetKind): SetKind {
  return current === 'warmup' || current === 'dropset' ? 'straight' : current;
}

export interface RemappedSets<T extends Pick<SetEntry, 'slot'>> {
  /** Sets whose slot changed, with the new slot. */
  moved: T[];
  /** Sets whose row is gone. */
  removed: T[];
}

export function remapSets<T extends Pick<SetEntry, 'slot'>>(
  sets: readonly T[],
  remap: RowEdit['remap'],
): RemappedSets<T> {
  const moved: T[] = [];
  const removed: T[] = [];
  for (const set of sets) {
    const slot = remap(set.slot);
    if (slot === null) removed.push(set);
    else if (slot !== set.slot) moved.push({ ...set, slot });
  }
  return { moved, removed };
}

export interface DisplayRow {
  slot: number;
  kind: SetKind;
  /** Target reps of the row ('6-8'), '' when it has none. */
  reps: RepRange;
  /** The logged set of this row; null while it is empty. */
  set: SetEntry | null;
  /** 1, 2, 3… among the rows that are not warm-ups or dropsets; null for those. */
  number: number | null;
  /** What the same row was last time; null when there is nothing. */
  previous: { weight: number; reps: number } | null;
}

export interface DisplayRowsInput {
  scheme: SetScheme;
  /** Live sets of this exercise in this session. */
  sets: readonly SetEntry[];
  /** Effective sets of the reference session ("last time"), if any. */
  reference: readonly SetEntry[] | null;
}

/** Newest wins when two devices logged the same row. */
function newestPerSlot(sets: readonly SetEntry[]): Map<number, SetEntry> {
  const bySlot = new Map<number, SetEntry>();
  for (const set of sets) {
    const current = bySlot.get(set.slot);
    if (!current || set.updatedAt > current.updatedAt) bySlot.set(set.slot, set);
  }
  return bySlot;
}

/**
 * The rows to show: the scheme's rows, then any logged set whose row is gone (so nothing a
 * device logged ever disappears from the screen). A logged set decides the kind of its row.
 */
export function displayRows({ scheme, sets, reference }: DisplayRowsInput): DisplayRow[] {
  const planned = schemeRows(scheme);
  const bySlot = newestPerSlot(sets);
  const stray = [...bySlot.values()].filter((s) => s.slot >= planned.length).sort(compareSets);
  const base = [
    ...planned.map((row, slot) => ({ slot, kind: row.kind, reps: row.reps })),
    ...stray.map((s) => ({ slot: s.slot, kind: s.kind, reps: '' })),
  ];

  const ref = (reference ?? []).filter(isEffectiveSet).sort(compareSets);
  const seen = new Map<SetKind, number>();
  let number = 0;
  return base.map((row) => {
    const set = bySlot.get(row.slot) ?? null;
    const kind = set?.kind ?? row.kind;
    const index = seen.get(kind) ?? 0;
    seen.set(kind, index + 1);
    const counts = kind !== 'warmup' && kind !== 'dropset';
    if (counts) number += 1;
    const same = ref.filter((s) => s.kind === kind);
    const match = kind === 'warmup' ? undefined : (same[index] ?? same.at(-1) ?? ref.at(-1));
    return {
      slot: row.slot,
      kind,
      reps: row.reps,
      set,
      number: counts ? number : null,
      previous: match ? { weight: match.weight, reps: match.reps } : null,
    };
  });
}

export interface Progress {
  done: number;
  total: number;
}

/** Planned working rows of an exercise and how many are logged. */
export function exerciseProgress(rows: readonly DisplayRow[]): Progress {
  const working = rows.filter((r) => isPlannedKind(r.kind));
  return { done: working.filter((r) => r.set !== null).length, total: working.length };
}

/** An exercise is complete when it has working rows and all of them are logged. */
export function isExerciseComplete(progress: Progress): boolean {
  return progress.total > 0 && progress.done === progress.total;
}

/** Progress of a whole session: "h of m done". */
export function sessionProgress(items: readonly PlanItem[], sets: readonly SetEntry[]): Progress {
  const total: Progress = { done: 0, total: 0 };
  for (const item of items) {
    const mine = sets.filter((s) => s.exerciseId === item.exerciseId);
    const progress = exerciseProgress(
      displayRows({ scheme: item.scheme, sets: mine, reference: null }),
    );
    total.done += progress.done;
    total.total += progress.total;
  }
  return total;
}

export interface RowRef {
  exerciseId: string;
  slot: number;
}

/**
 * The next working row without a saved set, in screen order: after `from` if given, otherwise
 * (or when nothing is left after it) from the start. null when every working row is saved.
 * It is the "Siguiente" of the rest timer.
 */
export function nextOpenRow(
  items: readonly PlanItem[],
  sets: readonly SetEntry[],
  from?: RowRef,
): RowRef | null {
  const open: RowRef[] = items.flatMap((item) => {
    const mine = sets.filter((s) => s.exerciseId === item.exerciseId);
    return displayRows({ scheme: item.scheme, sets: mine, reference: null })
      .filter((row) => isPlannedKind(row.kind) && row.set === null)
      .map((row) => ({ exerciseId: item.exerciseId, slot: row.slot }));
  });
  if (from) {
    const order = new Map(items.map((item, index) => [item.exerciseId, index]));
    const position = (ref: RowRef) => (order.get(ref.exerciseId) ?? 0) * 1000 + ref.slot;
    const after = open.find((ref) => position(ref) > position(from));
    if (after) return after;
  }
  return open[0] ?? null;
}

export interface RowInput {
  weight: number | null;
  reps: number | null;
}

export type ResolvedRow =
  { ok: true; weight: number; reps: number } | { ok: false; field: 'weight' | 'reps' };

/**
 * What ✓ saves. With nothing typed it takes the values of "Anterior"; otherwise what was typed,
 * where an empty weight is 0 for bodyweight exercises and invalid for the rest. 0 kg is valid.
 */
export function resolveRowInput(
  input: RowInput,
  previous: { weight: number; reps: number } | null,
  bodyweight: boolean,
): ResolvedRow {
  if (input.weight === null && input.reps === null && previous) {
    return { ok: true, weight: previous.weight, reps: previous.reps };
  }
  const weight = input.weight ?? (bodyweight ? 0 : null);
  if (weight === null || !Number.isFinite(weight) || weight < 0)
    return { ok: false, field: 'weight' };
  const reps = input.reps;
  if (reps === null || !Number.isInteger(reps) || reps <= 0) return { ok: false, field: 'reps' };
  return { ok: true, weight, reps };
}

export interface StrapsBand {
  straps: boolean;
  band: string;
}

/**
 * Straps and band an exercise starts with: those of the last working set logged in this session,
 * else of last time, else straps on and the exercise's default band.
 */
export function strapsBandDefaults(
  defaultBand: string | undefined,
  saved: readonly SetEntry[],
  reference: readonly SetEntry[] | null,
): StrapsBand {
  const last =
    [...saved]
      .filter((s) => s.kind !== 'warmup')
      .sort(compareSets)
      .at(-1) ?? [...(reference ?? [])].sort(compareSets).at(-1);
  return last
    ? { straps: last.straps !== false, band: last.band ?? '' }
    : { straps: true, band: defaultBand ?? '' };
}

/** Bands used before for an exercise, for the suggestions of the band field. */
export function knownBands(sets: readonly Pick<SetEntry, 'band'>[]): string[] {
  return [...new Set(sets.flatMap((s) => (s.band ? [s.band] : [])))].sort();
}

/**
 * Sessions imported from gym_app number warm-ups (`w1`), planned sets (`p0`) and extras (`x1`)
 * apart, and their scheme only has the planned rows. This puts every row in one list — warm-ups
 * first, then the planned rows, then the extras — and gives the sets their new slots.
 * Returns null when the exercise is already in the current form (idempotent).
 */
export function normalizeLegacyRows(
  item: PlanItem,
  sets: readonly SetEntry[],
): { item: PlanItem; sets: SetEntry[] } | null {
  const rows = schemeRows(item.scheme);
  const hasRowKinds = rows.some((r) => !isPlannedKind(r.kind));
  const warmups = sets.filter((s) => s.kind === 'warmup').sort(compareSets);
  const extras = sets
    .filter((s) => s.kind === 'extra' || (isPlannedKind(s.kind) && s.slot >= rows.length))
    .sort(compareSets);
  if (hasRowKinds || (warmups.length === 0 && extras.length === 0)) return null;

  const planned = sets.filter((s) => isPlannedKind(s.kind) && s.slot < rows.length);
  const before = [...warmups, ...planned, ...extras];
  const after = [
    ...warmups.map((s, i) => ({ ...s, slot: i })),
    ...planned.map((s) => ({ ...s, slot: warmups.length + s.slot })),
    ...extras.map((s, i) => ({ ...s, slot: warmups.length + rows.length + i })),
  ];
  const newRows: SchemeRow[] = [
    ...warmups.map(() => ({ kind: 'warmup' as const, reps: '' as const })),
    ...rows,
    ...extras.map((s) => ({ kind: s.kind, reps: '' as const })),
  ];
  return {
    item: { ...item, scheme: rowsToScheme(newRows, item.scheme.rir) },
    sets: after.filter((s, i) => s.slot !== before[i]?.slot),
  };
}

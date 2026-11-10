// Machine settings of an exercise ("Backrest 3 · Seat 5"): the rows the editor works with, their
// validation and the list stored in the exercise.
import { SETUP_LIMITS, type ExerciseSetupItem } from '../model/exercise';

/** One row of the editor; both fields may still be empty or have spaces around them. */
export interface SetupDraftRow {
  label: string;
  value: string;
}

export type SetupErrorCode =
  'label-empty' | 'value-empty' | 'label-too-long' | 'value-too-long' | 'too-many';

export interface SetupError {
  /** Position of the wrong row in the draft. */
  row: number;
  field: 'label' | 'value';
  code: SetupErrorCode;
}

export type SetupResult =
  { ok: true; setup: ExerciseSetupItem[] } | { ok: false; errors: SetupError[] };

/** The editor rows of the settings an exercise has (none gives no rows). */
export function setupDraftOf(setup: readonly ExerciseSetupItem[] | undefined): SetupDraftRow[] {
  return (setup ?? []).map(({ label, value }) => ({ label, value }));
}

/**
 * Cleans the rows of the editor: trims them, drops the ones left empty and checks the rest.
 * More than the allowed number of rows is reported as `too-many` (the editor never gets there).
 */
export function normalizeSetup(rows: readonly SetupDraftRow[]): SetupResult {
  const errors: SetupError[] = [];
  const setup: ExerciseSetupItem[] = [];
  rows.forEach((row, index) => {
    const label = row.label.trim();
    const value = row.value.trim();
    if (label === '' && value === '') return;
    if (label === '') errors.push({ row: index, field: 'label', code: 'label-empty' });
    else if (label.length > SETUP_LIMITS.maxLabel) {
      errors.push({ row: index, field: 'label', code: 'label-too-long' });
    }
    if (value === '') errors.push({ row: index, field: 'value', code: 'value-empty' });
    else if (value.length > SETUP_LIMITS.maxValue) {
      errors.push({ row: index, field: 'value', code: 'value-too-long' });
    }
    setup.push({ label, value });
  });
  if (setup.length > SETUP_LIMITS.maxItems) {
    errors.push({ row: SETUP_LIMITS.maxItems, field: 'label', code: 'too-many' });
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, setup };
}

/** "Backrest 3 · Seat 5": the settings on one line. */
export function setupLine(setup: readonly ExerciseSetupItem[]): string {
  return setup.map(({ label, value }) => `${label} ${value}`).join(' · ');
}

/** True when both lists hold the same settings in the same order. */
export function sameSetup(
  a: readonly ExerciseSetupItem[] | undefined,
  b: readonly ExerciseSetupItem[] | undefined,
): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return (
    left.length === right.length &&
    left.every((item, i) => {
      const other = right[i];
      return other !== undefined && item.label === other.label && item.value === other.value;
    })
  );
}

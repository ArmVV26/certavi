/** Ids of the fields of the routine editor that the page moves the focus to when saving fails. */
export const repsFieldId = (exerciseId: string, row: number) =>
  `routine-reps-${exerciseId}-${String(row)}`;
export const rirFieldId = (exerciseId: string) => `routine-rir-${exerciseId}`;

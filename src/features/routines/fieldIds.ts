/** Ids of the fields of the routine editor that the page moves the focus to when saving fails. */
export const repsFieldId = (exerciseId: string, row: number) =>
  `routine-reps-${exerciseId}-${String(row)}`;
export const rirFieldId = (exerciseId: string) => `routine-rir-${exerciseId}`;
/** Heading of the card of an exercise: the jump chips scroll to it and focus it. */
export const exerciseTitleId = (exerciseId: string) => `routine-exercise-${exerciseId}`;

/** Id of the weight or reps field of a row, so the screen can move the focus to it. */
export const fieldId = (exerciseId: string, slot: number, field: 'weight' | 'reps') =>
  `set-${exerciseId}-${String(slot)}-${field}`;

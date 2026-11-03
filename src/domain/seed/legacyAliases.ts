// gym_app exercise ids that no longer exist in the catalog and the exercise they merge into.

export const LEGACY_EXERCISE_ALIASES: Readonly<Record<string, string>> = {
  // "Abdomen (elevaciones o crunch)" was the same exercise as the machine crunch.
  abdomen: 'crunch-maquina',
};

/** The current id for a (possibly legacy) exercise id. */
export function resolveExerciseId(id: string): string {
  return Object.hasOwn(LEGACY_EXERCISE_ALIASES, id) ? (LEGACY_EXERCISE_ALIASES[id] ?? id) : id;
}

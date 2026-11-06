import { useCallback, useState } from 'react';
import { EMPTY_EXERCISE_FILTER, type ExerciseFilter } from '../../domain';

/** The filter of an exercise list: starts empty and changes one part at a time. */
export function useExerciseFilter() {
  const [filter, setFilter] = useState<ExerciseFilter>(EMPTY_EXERCISE_FILTER);
  const change = useCallback((patch: Partial<ExerciseFilter>) => {
    setFilter((current) => ({ ...current, ...patch }));
  }, []);
  return { filter, change };
}

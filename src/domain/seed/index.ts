import type { Exercise } from '../model/exercise';
import type { Routine } from '../model/routine';
import { SEED_EXERCISES } from './catalog';
import { SEED_ROUTINES } from './routines';

export * from './blocks';
export * from './catalog';
export * from './legacyAliases';
export * from './routines';
export * from './settings';

export const SEED_EXERCISES_BY_ID: ReadonlyMap<string, Exercise> = new Map(
  SEED_EXERCISES.map((e) => [e.id, e]),
);

export const SEED_ROUTINES_BY_ID: ReadonlyMap<string, Routine> = new Map(
  SEED_ROUTINES.map((r) => [r.id, r]),
);

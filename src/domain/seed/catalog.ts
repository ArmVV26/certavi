// Seed exercise catalog. Ids are gym_app's (history must survive renames) plus `hack-banda`.
// gym_app's `abdomen` is not here: it merges into `crunch-maquina` (see legacyAliases.ts).
// Equipment and straps follow context.md §4.3 as confirmed on 2026-11-03.
import { SEED_UPDATED_AT, textKey } from '../model/envelope';
import { isLowerBody, type Equipment, type ExerciseKind, type MuscleGroup } from '../model/enums';
import type { Exercise } from '../model/exercise';
import type { Routine } from '../model/routine';
import type { SetScheme } from '../model/scheme';
import { SEED_ROUTINES, straightSets, topBackoff } from './routines';

interface ExerciseSpec {
  id: string;
  group: MuscleGroup;
  equipment: Equipment;
  kind: ExerciseKind;
  secondary?: MuscleGroup[];
  unilateral?: boolean;
  straps?: boolean;
  band?: boolean;
  defaultBand?: string;
  /** Overrides the default increment (see `defaultIncrement`). */
  increment?: number;
  /** Default scheme for exercises that are in no seed routine (gym_app's `plan`). */
  scheme?: SetScheme;
}

const C = 'compound';
const I = 'isolation';

// One line per exercise reads as a table; Prettier would spread each object over many lines.
// prettier-ignore
export const EXERCISE_SPECS: readonly ExerciseSpec[] = [
  // Chest
  { id: 'press-inclinado-mancuernas', group: 'chest', equipment: 'dumbbell', kind: C, secondary: ['shoulders', 'triceps'] },
  { id: 'press-pecho-vertical', group: 'chest', equipment: 'selectorized', kind: C, secondary: ['shoulders', 'triceps'] },
  { id: 'press-vertical-pie', group: 'chest', equipment: 'plate-loaded', kind: C, secondary: ['shoulders', 'triceps'] },
  { id: 'press-inclinado-maquina', group: 'chest', equipment: 'plate-loaded', kind: C, secondary: ['shoulders', 'triceps'] },
  { id: 'bilbo-banca', group: 'chest', equipment: 'barbell', kind: C, secondary: ['shoulders', 'triceps'], scheme: { blocks: [{ kind: 'bilbo', reps: '20-30', count: 1 }], rir: '1-2' } },
  { id: 'aperturas-maquina', group: 'chest', equipment: 'selectorized', kind: I, secondary: ['shoulders'] },
  // Shoulders
  { id: 'press-hombro-inclinado', group: 'shoulders', equipment: 'plate-loaded', kind: C, secondary: ['chest', 'triceps'] },
  { id: 'press-militar-discos', group: 'shoulders', equipment: 'plate-loaded', kind: C, secondary: ['triceps'] },
  { id: 'laterales-maquina', group: 'shoulders', equipment: 'plate-loaded', kind: I },
  { id: 'laterales-placas', group: 'shoulders', equipment: 'selectorized', kind: I, scheme: straightSets('12-15', 3) },
  { id: 'laterales-polea', group: 'shoulders', equipment: 'cable', kind: I },
  { id: 'vuelos-posteriores', group: 'shoulders', equipment: 'selectorized', kind: I, secondary: ['back'] },
  // Triceps
  { id: 'triceps-v', group: 'triceps', equipment: 'cable', kind: I },
  { id: 'triceps-overhead-polea', group: 'triceps', equipment: 'cable', kind: I },
  { id: 'triceps-katana', group: 'triceps', equipment: 'cable', kind: I, unilateral: true },
  { id: 'triceps-polea-uni', group: 'triceps', equipment: 'cable', kind: I, unilateral: true },
  // Back
  { id: 'jalon-pecho', group: 'back', equipment: 'selectorized', kind: C, secondary: ['biceps'], straps: true },
  { id: 'jalon-cerrado', group: 'back', equipment: 'selectorized', kind: C, secondary: ['biceps'], straps: true },
  { id: 'remo-t', group: 'back', equipment: 'plate-loaded', kind: C, secondary: ['biceps', 'shoulders', 'forearms'], straps: true },
  { id: 'remo-bajo', group: 'back', equipment: 'selectorized', kind: C, secondary: ['biceps', 'shoulders'], straps: true },
  { id: 'remo-bajo-discos', group: 'back', equipment: 'plate-loaded', kind: C, secondary: ['biceps', 'shoulders'], straps: true, scheme: { blocks: [{ kind: 'top', reps: '8-10', count: 1 }, { kind: 'backoff', reps: '10-12', count: 2 }], rir: '1-2' } },
  { id: 'remo-alto-isolateral', group: 'back', equipment: 'plate-loaded', kind: C, secondary: ['shoulders', 'biceps', 'forearms'], straps: true, scheme: topBackoff(1) },
  { id: 'dominadas', group: 'back', equipment: 'bodyweight', kind: C, secondary: ['biceps', 'forearms'], band: true, scheme: straightSets('~10', 3) },
  // Biceps and forearms
  { id: 'curl-inclinado', group: 'biceps', equipment: 'dumbbell', kind: I, secondary: ['forearms'] },
  { id: 'curl-martillo-polea', group: 'biceps', equipment: 'cable', kind: I, secondary: ['forearms'] },
  { id: 'curl-predicador', group: 'biceps', equipment: 'plate-loaded', kind: I },
  { id: 'curl-muneca', group: 'forearms', equipment: 'selectorized', kind: I },
  // Core
  { id: 'crunch-maquina', group: 'core', equipment: 'selectorized', kind: I },
  // Quads
  { id: 'hack-banda', group: 'quads', equipment: 'plate-loaded', kind: C, secondary: ['hamstrings-glutes'], band: true, defaultBand: 'purple' },
  { id: 'hack-squat', group: 'quads', equipment: 'plate-loaded', kind: C, secondary: ['hamstrings-glutes'], scheme: { blocks: [{ kind: 'approach', reps: '', count: 1 }, { kind: 'top', reps: '6-8', count: 1 }, { kind: 'backoff', reps: '8-10', count: 2 }], rir: '1-2' } },
  { id: 'prensa', group: 'quads', equipment: 'plate-loaded', kind: C, secondary: ['hamstrings-glutes'] },
  { id: 'prensa-pendular-uni', group: 'quads', equipment: 'plate-loaded', kind: C, secondary: ['hamstrings-glutes'], unilateral: true },
  { id: 'bilbo-prensa', group: 'quads', equipment: 'plate-loaded', kind: C, secondary: ['hamstrings-glutes'], scheme: { blocks: [{ kind: 'bilbo', reps: '20-30', count: 1 }], rir: '1-2' } },
  { id: 'extension-pierna', group: 'quads', equipment: 'plate-loaded', kind: I },
  { id: 'extension-pierna-placas', group: 'quads', equipment: 'selectorized', kind: I, scheme: straightSets('12-20', 3) },
  // Hamstrings and glutes
  { id: 'rdl-maquina', group: 'hamstrings-glutes', equipment: 'plate-loaded', kind: C, secondary: ['back', 'forearms'], straps: true },
  { id: 'hip-thrust', group: 'hamstrings-glutes', equipment: 'plate-loaded', kind: C, secondary: ['quads'] },
  { id: 'hip-thrust-maquina', group: 'hamstrings-glutes', equipment: 'plate-loaded', kind: C, secondary: ['quads'] },
  { id: 'curl-femoral-pie', group: 'hamstrings-glutes', equipment: 'plate-loaded', kind: I, unilateral: true },
  { id: 'curl-femoral-tumbado', group: 'hamstrings-glutes', equipment: 'plate-loaded', kind: I },
  { id: 'curl-femoral-sentado', group: 'hamstrings-glutes', equipment: 'plate-loaded', kind: I },
  { id: 'abduccion', group: 'hamstrings-glutes', equipment: 'selectorized', kind: I },
  { id: 'aduccion', group: 'hamstrings-glutes', equipment: 'selectorized', kind: I },
  // Calves
  { id: 'gemelo-hack', group: 'calves', equipment: 'plate-loaded', kind: I, increment: 5 },
  { id: 'gemelo-sentado-discos', group: 'calves', equipment: 'plate-loaded', kind: I, scheme: straightSets('12-20', 3) },
];

/**
 * Default weight step (decided 2026-11-03): dumbbells +2 kg; leg compounds +5 kg; everything
 * else (upper body, leg isolations) +2.5 kg. Each exercise can override it.
 */
export function defaultIncrement(spec: Pick<ExerciseSpec, 'group' | 'equipment' | 'kind'>): number {
  if (spec.equipment === 'dumbbell') return 2;
  if (spec.kind === 'compound' && isLowerBody(spec.group)) return 5;
  return 2.5;
}

/** Scheme for an exercise added to a session or routine when it has no scheme of its own. */
export function fallbackScheme(spec: Pick<ExerciseSpec, 'equipment' | 'kind'>): SetScheme {
  if (spec.equipment === 'bodyweight') return straightSets('~10', 3);
  return spec.kind === 'compound' ? topBackoff(2) : straightSets('10-15', 3);
}

/** gym_app order for "first routine that has this exercise". */
const SCHEME_SOURCE_ORDER = ['push', 'pull', 'lowerB', 'upper', 'lowerA', 'lowerFull'];

function schemeFromRoutines(id: string, routines: readonly Routine[]): SetScheme | undefined {
  for (const routineId of SCHEME_SOURCE_ORDER) {
    const found = routines.find((r) => r.id === routineId)?.items.find((i) => i.exerciseId === id);
    if (found) return found.scheme;
  }
  return undefined;
}

export function buildExercise(spec: ExerciseSpec, routines: readonly Routine[]): Exercise {
  return {
    id: spec.id,
    type: 'exercise',
    updatedAt: SEED_UPDATED_AT,
    name: textKey(`exercises.names.${spec.id}`),
    primaryGroup: spec.group,
    secondaryMuscles: spec.secondary ?? [],
    equipment: spec.equipment,
    kind: spec.kind,
    unilateral: spec.unilateral ?? false,
    supportsStraps: spec.straps ?? false,
    supportsBand: spec.band ?? false,
    ...(spec.defaultBand ? { defaultBand: spec.defaultBand } : {}),
    defaultScheme: structuredClone(
      schemeFromRoutines(spec.id, routines) ?? spec.scheme ?? fallbackScheme(spec),
    ),
    increment: spec.increment ?? defaultIncrement(spec),
    custom: false,
    archived: false,
  };
}

export const SEED_EXERCISES: readonly Exercise[] = EXERCISE_SPECS.map((spec) =>
  buildExercise(spec, SEED_ROUTINES),
);

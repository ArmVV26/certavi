import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS, type MuscleGroup } from '../model/enums';
import { parseRecord } from '../model/records';
import { countPlanSets } from '../rules/scheme';
import { livePlan } from '../rules/weekPlan';
import { plannedSetsByGroup, totalSets } from '../rules/weeklySets';
import {
  ANKLE_REHAB_BLOCK,
  defaultIncrement,
  fallbackScheme,
  LEGACY_EXERCISE_ALIASES,
  LEGACY_FREE_ROUTINE_ID,
  resolveExerciseId,
  SEED_BLOCKS,
  SEED_EXERCISES,
  SEED_EXERCISES_BY_ID,
  SEED_ROUTINES,
  SEED_ROUTINES_BY_ID,
  SEED_SETTINGS,
  STRETCHING_BLOCK,
} from './index';

/** Every exercise id in gym_app v1.5.1 (public/js/routine.js), `abdomen` included. */
const GYM_APP_EXERCISE_IDS = [
  'press-inclinado-mancuernas',
  'press-pecho-vertical',
  'bilbo-banca',
  'aperturas-maquina',
  'press-hombro-inclinado',
  'laterales-maquina',
  'laterales-placas',
  'press-vertical-pie',
  'press-inclinado-maquina',
  'triceps-polea-uni',
  'triceps-v',
  'triceps-overhead-polea',
  'dominadas',
  'remo-t',
  'remo-bajo',
  'vuelos-posteriores',
  'curl-inclinado',
  'curl-martillo-polea',
  'curl-muneca',
  'crunch-maquina',
  'abduccion',
  'aduccion',
  'rdl-maquina',
  'hip-thrust',
  'prensa-pendular-uni',
  'curl-femoral-pie',
  'extension-pierna',
  'extension-pierna-placas',
  'gemelo-sentado-discos',
  'curl-femoral-tumbado',
  'curl-femoral-sentado',
  'hip-thrust-maquina',
  'gemelo-hack',
  'jalon-pecho',
  'jalon-cerrado',
  'remo-bajo-discos',
  'remo-alto-isolateral',
  'press-militar-discos',
  'laterales-polea',
  'curl-predicador',
  'triceps-katana',
  'abdomen',
  'hack-squat',
  'prensa',
  'bilbo-prensa',
];

/** rutina-actual.md, "Series semanales planificadas (semana de 5 sesiones)". */
const PLANNED_WEEK: Record<MuscleGroup, number> = {
  quads: 16,
  'hamstrings-glutes': 15,
  back: 14,
  chest: 13,
  shoulders: 13,
  triceps: 8,
  biceps: 8,
  calves: 8,
  core: 6,
  forearms: 3,
};

const ex = (id: string) => {
  const found = SEED_EXERCISES_BY_ID.get(id);
  if (!found) throw new Error(`missing seed exercise ${id}`);
  return found;
};

const routineItems = (id: string) => SEED_ROUTINES_BY_ID.get(id)?.items ?? [];

describe('seed catalog', () => {
  it('keeps every gym_app id except abdomen, which merges into crunch-maquina', () => {
    for (const id of GYM_APP_EXERCISE_IDS) {
      expect(SEED_EXERCISES_BY_ID.has(resolveExerciseId(id)), id).toBe(true);
    }
    expect(SEED_EXERCISES_BY_ID.has('abdomen')).toBe(false);
    expect(LEGACY_EXERCISE_ALIASES).toEqual({ abdomen: 'crunch-maquina' });
  });

  it('adds the banded hack squat as a new exercise with a purple band', () => {
    expect(GYM_APP_EXERCISE_IDS).not.toContain('hack-banda');
    expect(ex('hack-banda')).toMatchObject({
      supportsBand: true,
      defaultBand: 'purple',
      primaryGroup: 'quads',
    });
    expect(SEED_EXERCISES).toHaveLength(45);
  });

  it('keeps out-of-routine exercises visible (pull-ups, hack squat, Bilbo)', () => {
    for (const id of ['dominadas', 'hack-squat', 'bilbo-banca', 'bilbo-prensa']) {
      expect(ex(id).archived, id).toBe(false);
      expect(
        SEED_ROUTINES.some((r) => r.items.some((i) => i.exerciseId === id)),
        id,
      ).toBe(false);
    }
    expect(ex('bilbo-banca').equipment).toBe('barbell');
    expect(ex('bilbo-prensa').equipment).toBe('plate-loaded');
    expect(ex('hack-squat').equipment).toBe('plate-loaded');
  });

  it('names seed exercises with i18n keys', () => {
    for (const e of SEED_EXERCISES) {
      expect(e.name).toEqual({ key: `exercises.names.${e.id}` });
      expect(e.custom).toBe(false);
    }
  });

  it('follows the equipment of table 4.3', () => {
    const expected: Record<string, string> = {
      'press-inclinado-mancuernas': 'dumbbell',
      'press-pecho-vertical': 'selectorized',
      'press-vertical-pie': 'plate-loaded',
      'press-inclinado-maquina': 'plate-loaded',
      'aperturas-maquina': 'selectorized',
      'press-hombro-inclinado': 'plate-loaded',
      'laterales-maquina': 'plate-loaded',
      'laterales-placas': 'selectorized',
      'laterales-polea': 'cable',
      'triceps-katana': 'cable',
      'jalon-pecho': 'selectorized',
      'jalon-cerrado': 'selectorized',
      'remo-t': 'plate-loaded',
      'remo-bajo': 'selectorized',
      'vuelos-posteriores': 'selectorized',
      'curl-predicador': 'plate-loaded',
      'curl-muneca': 'selectorized',
      'crunch-maquina': 'selectorized',
      'rdl-maquina': 'plate-loaded',
      'hip-thrust-maquina': 'plate-loaded',
      'curl-femoral-tumbado': 'plate-loaded',
      'extension-pierna': 'plate-loaded',
      'extension-pierna-placas': 'selectorized',
      dominadas: 'bodyweight',
    };
    for (const [id, equipment] of Object.entries(expected))
      expect(ex(id).equipment, id).toBe(equipment);
  });

  it('offers straps on every back exercise except pull-ups, and on the Romanian deadlift', () => {
    const withStraps = SEED_EXERCISES.filter((e) => e.supportsStraps)
      .map((e) => e.id)
      .sort();
    const backButPullUps = SEED_EXERCISES.filter(
      (e) => e.primaryGroup === 'back' && e.id !== 'dominadas',
    ).map((e) => e.id);
    expect(withStraps).toEqual([...backButPullUps, 'rdl-maquina'].sort());
  });

  it('uses the agreed increments: dumbbells 2, leg compounds and calf hack 5, the rest 2.5', () => {
    expect(ex('press-inclinado-mancuernas').increment).toBe(2);
    expect(ex('curl-inclinado').increment).toBe(2);
    for (const id of [
      'prensa',
      'hack-banda',
      'rdl-maquina',
      'hip-thrust',
      'prensa-pendular-uni',
      'gemelo-hack',
    ]) {
      expect(ex(id).increment, id).toBe(5);
    }
    for (const id of [
      'extension-pierna',
      'curl-femoral-pie',
      'aduccion',
      'gemelo-sentado-discos',
      'remo-t',
      'press-militar-discos',
    ]) {
      expect(ex(id).increment, id).toBe(2.5);
    }
    expect(defaultIncrement({ group: 'quads', equipment: 'dumbbell', kind: 'compound' })).toBe(2);
  });

  it('takes the default scheme from the first routine, then gym_app, then the kind', () => {
    expect(ex('gemelo-hack').defaultScheme).toEqual(routineItems('lowerB')[0]?.scheme);
    expect(ex('press-inclinado-mancuernas').defaultScheme.blocks[1]?.count).toBe(2); // Push, not Upper
    expect(ex('laterales-placas').defaultScheme.blocks).toEqual([
      { kind: 'straight', reps: '12-15', count: 3 },
    ]);
    expect(ex('dominadas').defaultScheme.blocks).toEqual([
      { kind: 'straight', reps: '~10', count: 3 },
    ]);
    expect(ex('curl-femoral-tumbado').defaultScheme).toEqual(
      fallbackScheme({ equipment: 'plate-loaded', kind: 'isolation' }),
    );
    expect(ex('hip-thrust-maquina').defaultScheme.blocks.map((b) => b.kind)).toEqual([
      'top',
      'backoff',
    ]);
    expect(fallbackScheme({ equipment: 'bodyweight', kind: 'compound' }).blocks[0]?.reps).toBe(
      '~10',
    );
  });

  it('gives each exercise its own copy of the default scheme', () => {
    expect(ex('gemelo-hack').defaultScheme).not.toBe(routineItems('lowerB')[0]?.scheme);
  });
});

describe('seed routines', () => {
  it('has the six routines of rutina-actual.md on their days', () => {
    expect(SEED_ROUTINES.map((r) => [r.id, r.weekday])).toEqual([
      ['push', 1],
      ['pull', 2],
      ['lowerB', 3],
      ['upper', 5],
      ['lowerA', 7],
      ['lowerFull', null],
    ]);
    expect(SEED_ROUTINES_BY_ID.has(LEGACY_FREE_ROUTINE_ID)).toBe(false);
  });

  it('only uses exercises from the catalog', () => {
    for (const r of SEED_ROUTINES) {
      for (const i of r.items)
        expect(SEED_EXERCISES_BY_ID.has(i.exerciseId), `${r.id}: ${i.exerciseId}`).toBe(true);
    }
  });

  it('has the planned sets of each session', () => {
    const counts = Object.fromEntries(SEED_ROUTINES.map((r) => [r.id, countPlanSets(r.items)]));
    expect(counts).toEqual({
      push: 19,
      pull: 23,
      lowerB: 21,
      upper: 23,
      lowerA: 18,
      lowerFull: 21,
    });
  });

  it('replaces pull-ups with pulldowns in Pull and Upper', () => {
    expect(routineItems('pull')[0]?.exerciseId).toBe('jalon-pecho');
    expect(
      routineItems('upper')
        .map((i) => i.exerciseId)
        .slice(0, 3),
    ).toEqual(['jalon-cerrado', 'press-inclinado-mancuernas', 'jalon-pecho']);
  });

  it('starts every leg day with the calf raise and plans the banded hack with an approach set', () => {
    for (const id of ['lowerA', 'lowerB', 'lowerFull'])
      expect(routineItems(id)[0]?.exerciseId).toBe('gemelo-hack');
    const hack = routineItems('lowerA').find((i) => i.exerciseId === 'hack-banda');
    expect(hack?.scheme.blocks.map((b) => [b.kind, b.reps, b.count])).toEqual([
      ['approach', '', 1],
      ['top', '6-8', 1],
      ['backoff', '8-10', 2],
    ]);
  });

  it('marks only the wrist curl as optional', () => {
    const optional = SEED_ROUTINES.flatMap((r) =>
      r.items.filter((i) => i.optional).map((i) => i.exerciseId),
    );
    expect(optional).toEqual(['curl-muneca']);
  });
});

describe('planned weekly sets (rutina-actual.md)', () => {
  const plans = (ids: string[]) => ids.map(routineItems);

  it('adds up to 104 in a normal 5-session week', () => {
    const plan = livePlan({ size: 5, deload: false }, SEED_ROUTINES_BY_ID, SEED_EXERCISES_BY_ID);
    expect(plan.total).toBe(104);
  });

  it('matches the table group by group', () => {
    const plan = livePlan({ size: 5, deload: false }, SEED_ROUTINES_BY_ID, SEED_EXERCISES_BY_ID);
    for (const g of MUSCLE_GROUPS) expect(plan.groups[g], g).toBe(PLANNED_WEEK[g]);
    expect(totalSets(PLANNED_WEEK)).toBe(104);
  });

  it('needs the approach set of the banded hack to reach 16 quad sets', () => {
    const withoutApproach = plans(['push', 'pull', 'lowerB', 'upper', 'lowerA']).map((items) =>
      items.map((i) => ({
        ...i,
        scheme: { ...i.scheme, blocks: i.scheme.blocks.filter((b) => b.kind !== 'approach') },
      })),
    );
    expect(plannedSetsByGroup(withoutApproach, SEED_EXERCISES_BY_ID).quads).toBe(15);
  });

  it('plans 81 sets with 4 sessions and 63 with 3', () => {
    expect(
      livePlan({ size: 4, deload: false }, SEED_ROUTINES_BY_ID, SEED_EXERCISES_BY_ID).total,
    ).toBe(81);
    expect(
      livePlan({ size: 3, deload: false }, SEED_ROUTINES_BY_ID, SEED_EXERCISES_BY_ID).total,
    ).toBe(63);
  });

  it('plans 62 sets in a deload week', () => {
    expect(
      livePlan({ size: 5, deload: true }, SEED_ROUTINES_BY_ID, SEED_EXERCISES_BY_ID).total,
    ).toBe(62);
  });
});

describe('seed blocks', () => {
  it('has the ankle rehab block with its items, pain metrics and wall test', () => {
    expect(ANKLE_REHAB_BLOCK.items).toHaveLength(8);
    expect(
      ANKLE_REHAB_BLOCK.items.filter((i) => i.timesPerWeek === '3-5').map((i) => i.id),
    ).toEqual(['heel-raise', 'split-heel-raise', 'pogos']);
    expect(ANKLE_REHAB_BLOCK.metrics.map((m) => [m.id, m.min, m.max, m.threshold])).toEqual([
      ['stairs', 0, 10, 3],
      ['max-pain', 0, 10, 3],
      ['pogos', 0, 10, 3],
    ]);
    expect(ANKLE_REHAB_BLOCK.weeklyMetrics[0]?.parts.map((p) => p.id)).toEqual(['left', 'right']);
    expect(ANKLE_REHAB_BLOCK.days).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('creates the stretching block empty and inactive', () => {
    expect(STRETCHING_BLOCK).toMatchObject({ items: [], active: false, blockType: 'stretching' });
  });
});

describe('all seed records', () => {
  const all = [...SEED_EXERCISES, ...SEED_ROUTINES, ...SEED_BLOCKS, SEED_SETTINGS];

  it('pass their zod schema', () => {
    for (const record of all) {
      const result = parseRecord(record);
      expect(result.ok, record.id).toBe(true);
    }
  });

  it('have ids unique across all types and updatedAt 0, so any user edit wins', () => {
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
    expect(all.every((r) => r.updatedAt === 0)).toBe(true);
  });
});

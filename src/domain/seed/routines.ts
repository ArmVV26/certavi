// Seed routines from rutina-actual.md (cycle 2 Nov – 20 Dec 2026). Routine ids are the gym_app
// template ids, so the importer maps sessions without a lookup table.
import { SEED_UPDATED_AT, textKey } from '../model/envelope';
import type { Weekday } from '../model/enums';
import type { PlanItem, Routine } from '../model/routine';
import type { RepRange, RirRange, SchemeBlock, SetScheme } from '../model/scheme';

const approach = (): SchemeBlock => ({ kind: 'approach', reps: '', count: 1 });
const top = (reps: RepRange): SchemeBlock => ({ kind: 'top', reps, count: 1 });
const backoff = (reps: RepRange, count: number): SchemeBlock => ({ kind: 'backoff', reps, count });
const straight = (reps: RepRange, count: number): SchemeBlock => ({
  kind: 'straight',
  reps,
  count,
});

const scheme = (rir: RirRange, ...blocks: SchemeBlock[]): SetScheme => ({ blocks, rir });

/** 1 top set + `n` back-off sets (6-8 / 8-10, RIR 1-2), the standard compound scheme. */
export const topBackoff = (n: number) => scheme('1-2', top('6-8'), backoff('8-10', n));
export const straightSets = (reps: RepRange, count: number, rir: RirRange = '1-2') =>
  scheme(rir, straight(reps, count));

const item = (
  exerciseId: string,
  setScheme: SetScheme,
  extra: { note?: string; optional?: boolean } = {},
): PlanItem => ({
  exerciseId,
  scheme: setScheme,
  optional: extra.optional ?? false,
  ...(extra.note ? { note: textKey(`routines.notes.${extra.note}`) } : {}),
});

const calf = () => item('gemelo-hack', straightSets('10-12', 4, '2-3'), { note: 'calf' });
const bandedHack = () =>
  item('hack-banda', scheme('1-2', approach(), top('6-8'), backoff('8-10', 2)), {
    note: 'bandedHack',
  });

function routine(id: string, weekday: Weekday | null, items: PlanItem[]): Routine {
  return {
    id,
    type: 'routine',
    updatedAt: SEED_UPDATED_AT,
    name: textKey(`routines.names.${id}`),
    items,
    weekday,
    custom: false,
  };
}

export const SEED_ROUTINES: readonly Routine[] = [
  routine('push', 1, [
    item('press-inclinado-mancuernas', topBackoff(2)),
    item('press-pecho-vertical', topBackoff(2)),
    item('aperturas-maquina', straightSets('10-15', 3)),
    item('press-hombro-inclinado', topBackoff(1)),
    item('laterales-maquina', straightSets('12-15', 3)),
    item('triceps-v', straightSets('10-15', 3)),
    item('triceps-overhead-polea', straightSets('12-15', 2)),
  ]),
  routine('pull', 2, [
    item('jalon-pecho', topBackoff(2)),
    item('remo-t', topBackoff(2)),
    item('remo-bajo', scheme('1-2', top('8-10'), backoff('10-12', 2))),
    item('vuelos-posteriores', straightSets('12-15', 3)),
    item('curl-inclinado', scheme('1-2', top('8-12'), backoff('8-12', 2)), {
      note: 'inclineCurl',
    }),
    item('curl-martillo-polea', straightSets('10-15', 2)),
    item('curl-muneca', straightSets('12-20', 3), { optional: true }),
    item('crunch-maquina', straightSets('10-15', 3), { note: 'crunch' }),
  ]),
  routine('lowerB', 3, [
    calf(),
    item('abduccion', straightSets('12-15', 2)),
    item('rdl-maquina', topBackoff(2)),
    item('hip-thrust', topBackoff(2)),
    item('prensa-pendular-uni', straightSets('10-12', 3)),
    item('curl-femoral-pie', straightSets('10-15', 3)),
    item('extension-pierna', straightSets('12-20', 3)),
  ]),
  routine('upper', 5, [
    item('jalon-cerrado', topBackoff(2)),
    item('press-inclinado-mancuernas', topBackoff(1)),
    item('jalon-pecho', topBackoff(1)),
    item('press-pecho-vertical', topBackoff(1)),
    item('press-militar-discos', topBackoff(1)),
    item('laterales-polea', straightSets('12-15', 3)),
    item('triceps-katana', straightSets('10-15', 3)),
    item('curl-predicador', straightSets('10-15', 3)),
    item('crunch-maquina', straightSets('10-15', 3)),
  ]),
  routine('lowerA', 7, [
    calf(),
    item('aduccion', straightSets('10-15', 2, '2-3')),
    bandedHack(),
    item('curl-femoral-pie', straightSets('12-15', 2, '2-3')),
    item('prensa', topBackoff(2), { note: 'legPress' }),
    item('extension-pierna', straightSets('12-20', 3)),
  ]),
  routine('lowerFull', null, [
    calf(),
    item('aduccion', straightSets('12-15', 2)),
    bandedHack(),
    item('rdl-maquina', topBackoff(2)),
    item('prensa', straightSets('8-10', 3)),
    item('curl-femoral-pie', straightSets('10-15', 3)),
    item('extension-pierna', straightSets('12-20', 2)),
  ]),
];

/** gym_app's free session template: in Certavi a free session has `routineId: null`. */
export const LEGACY_FREE_ROUTINE_ID = 'libre';

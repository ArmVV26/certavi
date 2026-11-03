import { describe, expect, it } from 'vitest';
import sample from '../../../tests/fixtures/gym-app-sample.json?raw';
import {
  ANKLE_REHAB_BLOCK,
  SEED_EXERCISES_BY_ID,
  SEED_ROUTINES_BY_ID,
  type DomainRecord,
  type RecordOf,
  type RecordType,
} from '../../domain';
import { readGymAppExport } from './gymApp';

function readSample() {
  const result = readGymAppExport(sample);
  if (!result.ok) throw new Error('sample did not read');
  return result;
}

const ofType = <K extends RecordType>(records: readonly DomainRecord[], type: K) =>
  records.filter((r): r is RecordOf<K> => r.type === type);

const byId = (records: readonly DomainRecord[], id: string) => {
  const record = records.find((r) => r.id === id);
  if (!record) throw new Error(`missing ${id}`);
  return record;
};

const SES_A = 'ses_mg8x1k2a3b4c5d6e7f';
const SES_FREE = 'ses_mg9a0b1c2d3e4f5g6h';
const SES_OLD = 'ses_mg1z2y3x4w5v6u7t8s';

describe('gym_app import: counts', () => {
  it('turns every record type of the sample into Certavi records, and the numbers add up', () => {
    const { records, ignored, invalid } = readSample();
    const counts: Partial<Record<RecordType, number>> = {};
    for (const r of records) counts[r.type] = (counts[r.type] ?? 0) + 1;

    expect(counts).toEqual({
      session: 3,
      set: 11,
      note: 2,
      activity: 2,
      bodyWeight: 2,
      weekPlan: 2,
      routine: 1,
      exercise: 2,
      block: 1,
      blockLog: 2,
      weeklyMetric: 1,
    });
    expect(records).toHaveLength(29);
    // 2 deleted records, cfg_exp_brazos and 2 migration markers.
    expect(ignored).toBe(5);
    expect(invalid).toBe(0);
  });
});

describe('gym_app import: sessions, sets and notes', () => {
  it('maps a routine session with its plan, readiness and note', () => {
    const session = byId(readSample().records, SES_A) as RecordOf<'session'>;
    expect(session).toMatchObject({
      type: 'session',
      updatedAt: 1792400000100,
      date: '2026-10-19',
      routineId: 'push',
      startedAt: 1792400000000,
      endedAt: 1792404000000,
      readiness: 4,
      note: 'Buena sesión; con energía',
    });
    expect(session).not.toHaveProperty('serverSeq');
    expect(session.items[0]).toEqual({
      exerciseId: 'press-inclinado-mancuernas',
      scheme: {
        blocks: [
          { kind: 'approach', reps: '', count: 1 },
          { kind: 'top', reps: '6-8', count: 1 },
          { kind: 'backoff', reps: '8-10', count: 2 },
        ],
        rir: '1-2',
      },
      note: { text: 'Bajar lento' },
      optional: false,
    });
    expect(session.items[1]).toMatchObject({
      exerciseId: 'crunch-maquina',
      scheme: { blocks: [{ kind: 'straight', reps: '12-15', count: 1 }] },
      optional: true,
    });
  });

  it('turns "libre" into a free session and fills old sessions from the seed routine', () => {
    const { records } = readSample();
    expect(byId(records, SES_FREE)).toMatchObject({ routineId: null, readiness: null, note: '' });
    const old = byId(records, SES_OLD) as RecordOf<'session'>;
    expect(old.routineId).toBe('lowerB');
    expect(old.endedAt).toBeNull();
    expect(old.items).toEqual(SEED_ROUTINES_BY_ID.get('lowerB')?.items);
  });

  it('maps set kinds, slots, straps, bands and the "abdomen" alias', () => {
    const sets = ofType(readSample().records, 'set').filter((s) => s.sessionId === SES_A);
    expect(sets.map((s) => [s.exerciseId, s.kind, s.slot, s.weight, s.reps, s.rir])).toEqual([
      ['press-inclinado-mancuernas', 'warmup', 1, 10, 10, null],
      ['press-inclinado-mancuernas', 'approach', 0, 20, 6, null],
      ['press-inclinado-mancuernas', 'top', 1, 30, 8, 1],
      ['press-inclinado-mancuernas', 'backoff', 2, 27.5, 10, 2],
      ['press-inclinado-mancuernas', 'backoff', 3, 27.5, 9, null],
      ['crunch-maquina', 'straight', 0, 40, 15, 2],
      ['crunch-maquina', 'extra', 1, 40, 12, 1],
    ]);
    const free = ofType(readSample().records, 'set').filter((s) => s.sessionId === SES_FREE);
    expect(free.map((s) => [s.exerciseId, s.straps, s.band])).toEqual([
      ['remo-t', true, undefined],
      ['remo-t', false, undefined],
      ['dominadas', undefined, 'morada'],
    ]);
    expect(free[0]?.completedAt).toBe(1792570100000);
  });

  it('gives notes the Certavi id, with the alias applied', () => {
    const notes = ofType(readSample().records, 'note');
    expect(notes.map((n) => [n.id, n.exerciseId, n.text])).toEqual([
      [`note_${SES_A}_press-inclinado-mancuernas`, 'press-inclinado-mancuernas', 'Hombro bien'],
      [`note_${SES_A}_crunch-maquina`, 'crunch-maquina', 'Lento, "sin tirones"'],
    ]);
  });
});

describe('gym_app import: other records', () => {
  it('maps activities (unknown minutes become 0) and weekly body weight', () => {
    const { records } = readSample();
    expect(ofType(records, 'activity').map((a) => [a.kind, a.minutes, a.note])).toEqual([
      ['football', 60, 'Pachanga'],
      ['hiking', 0, ''],
    ]);
    expect(byId(records, 'bw_2026-10-19')).toMatchObject({ week: '2026-10-19', kg: 80.5 });
  });

  it('keeps the frozen plan of a closed week and the flags of an open one', () => {
    const { records } = readSample();
    expect(byId(records, 'week_2026-10-12')).toMatchObject({
      hiking: false,
      deload: false,
      size: 5,
      closedAt: 1792400000000,
      plannedSetsByGroup: {
        chest: 13,
        back: 14,
        shoulders: 13,
        quads: 16,
        'hamstrings-glutes': 15,
        triceps: 8,
        biceps: 8,
        calves: 8,
        core: 6,
        forearms: 3,
      },
    });
    const open = byId(records, 'week_2026-10-19');
    expect(open).toMatchObject({ hiking: true, deload: false, size: 5 });
    expect(open).not.toHaveProperty('plannedSetsByGroup');
    expect(open).not.toHaveProperty('closedAt');
  });

  it('turns a routine override into the routine itself', () => {
    const push = byId(readSample().records, 'push') as RecordOf<'routine'>;
    const seed = SEED_ROUTINES_BY_ID.get('push');
    expect(push).toMatchObject({ name: seed?.name, weekday: seed?.weekday, custom: false });
    expect(push.updatedAt).toBe(1791000000000);
    expect(push.items.map((i) => i.exerciseId)).toEqual([
      'press-inclinado-mancuernas',
      'aperturas-maquina',
      'crunch-maquina',
    ]);
  });

  it('turns per-exercise increments into the exercise increment', () => {
    const { records } = readSample();
    expect(byId(records, 'remo-t')).toEqual({
      ...SEED_EXERCISES_BY_ID.get('remo-t'),
      increment: 5,
      updatedAt: 1791100000000,
    });
    expect(byId(records, 'crunch-maquina')).toMatchObject({ increment: 1.25 });
  });

  it('turns recovery days, wall tests and recovery settings into the ankle rehab block', () => {
    const { records } = readSample();
    expect(byId(records, 'blocklog_block-ankle-rehab_2026-10-20')).toEqual({
      id: 'blocklog_block-ankle-rehab_2026-10-20',
      type: 'blockLog',
      updatedAt: 1792480000001,
      date: '2026-10-20',
      blockId: 'block-ankle-rehab',
      done: {
        'foam-roll': true,
        'wall-ankle': true,
        'ankle-sit': true,
        'band-mobilization': true,
        'box-drop': true,
        'heel-raise': true,
        'split-heel-raise': false,
        pogos: true,
      },
      metrics: { stairs: 2, 'max-pain': 3 },
      note: 'Algo de rigidez por la mañana',
    });
    expect(byId(records, 'blocklog_block-ankle-rehab_2026-10-21')).toMatchObject({
      metrics: { stairs: 1 },
      note: '',
    });
    expect(byId(records, 'wmetric_block-ankle-rehab_wall-test_2026-10-19')).toMatchObject({
      week: '2026-10-19',
      metricId: 'wall-test',
      values: { left: 10.5, right: 9 },
    });
    expect(byId(records, ANKLE_REHAB_BLOCK.id)).toEqual({
      ...ANKLE_REHAB_BLOCK,
      updatedAt: 1790000000000,
      active: true,
      startDate: '2026-10-01',
      reviewDate: '2026-10-20',
    });
  });
});

describe('gym_app import: file checks and odd records', () => {
  const file = (records: unknown[]) => JSON.stringify({ app: 'winter-arc', version: 2, records });
  const set = (fields: Record<string, unknown> = {}) => ({
    id: 'st_s_remo-t_p0',
    t: 'set',
    u: 10,
    sid: 's',
    ex: 'remo-t',
    slot: 'p0',
    kind: 'work',
    w: 50,
    r: 10,
    rir: 2,
    at: 9,
    ...fields,
  });

  it('rejects files that are not a gym_app full copy', () => {
    expect(readGymAppExport('not json').ok).toBe(false);
    expect(readGymAppExport('{"app":"certavi","format":1,"records":[]}').ok).toBe(false);
    expect(readGymAppExport('{"records":"nope"}').ok).toBe(false);
    expect(readGymAppExport('42').ok).toBe(false);
  });

  it('accepts a bare array of records, as gym_app did', () => {
    const result = readGymAppExport(JSON.stringify([set()]));
    expect(result.ok && result.records.map((r) => r.id)).toEqual(['st_s_remo-t_p0']);
  });

  it('counts malformed records as invalid and unknown types as ignored', () => {
    const result = readGymAppExport(
      file([
        set({ id: 'bad-reps', r: -1 }),
        set({ id: 'bad-slot', slot: 'q1' }),
        set({ id: 'bad-kind', kind: 'drop' }),
        { id: 'no-time', t: 'set' },
        'not an object',
        { id: 'x', t: 'future-type', u: 1 },
        { id: 'tpl_nope', t: 'tpl', u: 1, tpl: 'nope', items: [] },
        { id: 'exc_nope', t: 'excfg', u: 1, ex: 'nope', step: 2 },
        {
          id: 'tpl_bad',
          t: 'tpl',
          u: 1,
          tpl: 'pull',
          items: [{ ex: 'remo-t', plan: [['drop', '8', 1]], rir: '1-2' }],
        },
      ]),
    );
    expect(result).toEqual({ ok: true, records: [], ignored: 3, invalid: 6 });
  });

  it('drops a target RIR that Certavi cannot read and an empty band', () => {
    const result = readGymAppExport(
      file([
        {
          id: 'tpl_pull',
          t: 'tpl',
          u: 5,
          tpl: 'pull',
          items: [{ ex: 'remo-t', plan: [['work', '8-10', 3]], rir: 'muy duro' }],
        },
        set({ band: '', straps: null, rir: undefined, at: undefined }),
      ]),
    );
    if (!result.ok) throw new Error('should read');
    const pull = byId(result.records, 'pull') as RecordOf<'routine'>;
    expect(pull.items[0]?.scheme.rir).toBe('');
    const entry = byId(result.records, 'st_s_remo-t_p0');
    expect(entry).not.toHaveProperty('band');
    expect(entry).not.toHaveProperty('straps');
    expect(entry).toMatchObject({ rir: null, completedAt: 10 });
  });

  it('keeps the newest when two records map to the same Certavi id', () => {
    const result = readGymAppExport(
      file([
        { id: 'nt_s_abdomen', t: 'note', u: 7, sid: 's', ex: 'abdomen', text: 'old' },
        { id: 'nt_s_crunch-maquina', t: 'note', u: 9, sid: 's', ex: 'crunch-maquina', text: 'new' },
        { id: 'nt_s_x', t: 'note', u: 3, sid: 's', ex: 'abdomen', text: 'older' },
      ]),
    );
    expect(result.ok && result.records.map((r) => [r.id, (r as RecordOf<'note'>).text])).toEqual([
      ['note_s_crunch-maquina', 'new'],
    ]);
  });

  it('keeps the default block state when the recovery settings omit it', () => {
    const result = readGymAppExport(file([{ id: 'cfg_recovery', t: 'cfg', u: 3 }]));
    expect(result.ok && result.records[0]).toEqual({ ...ANKLE_REHAB_BLOCK, updatedAt: 3 });
  });

  it('reads sessions and recovery days with missing optional fields', () => {
    const result = readGymAppExport(
      file([
        { id: 'ses_x', t: 'session', u: 4, date: '2026-10-20', tpl: 'nope' },
        { id: 'rec_2026-10-22', t: 'rec', u: 5, date: '2026-10-22' },
        { id: 'act_x', t: 'act', u: 6, date: '2026-10-22', kind: 'padel' },
        { id: 'wall_2026-10-19', t: 'wall', u: 7, week: '2026-10-19', left: 8 },
      ]),
    );
    if (!result.ok) throw new Error('should read');
    expect(byId(result.records, 'ses_x')).toMatchObject({ routineId: 'nope', items: [] });
    expect(byId(result.records, 'blocklog_block-ankle-rehab_2026-10-22')).toMatchObject({
      done: {},
      metrics: {},
    });
    expect(byId(result.records, 'act_x')).toMatchObject({ kind: 'other', note: '' });
    expect(byId(result.records, 'wmetric_block-ankle-rehab_wall-test_2026-10-19')).toMatchObject({
      values: { left: 8 },
    });
  });
});

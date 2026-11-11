import { describe, expect, it } from 'vitest';
import { makeSession, makeSet, makeWeekPlan } from '../testing/builders';
import { activitySchema, bodyWeightId, bodyWeightSchema } from './activity';
import { ANKLE_REHAB_BLOCK } from '../seed/blocks';
import {
  blockLogId,
  blockMetricSchema,
  optionalBlockSchema,
  weeklyMetricId,
  weeklyMetricSchema,
} from './block';
import { isLowerBody, SET_KINDS, weekdaySchema, weekSizeSchema } from './enums';
import { plainText, textKey, textRefSchema, tombstoneSchema } from './envelope';
import { parseRecord, RECORD_SCHEMAS } from './records';
import { repRangeSchema, rirRangeSchema, setSchemeSchema } from './scheme';
import { exerciseNoteId, exerciseNoteSchema, setEntrySchema } from './session';
import { DEFAULT_REST, deviceSettingsSchema, SETTINGS_ID, syncedSettingsSchema } from './settings';
import { weekPlanId, weekPlanSchema } from './weekPlan';

describe('enums', () => {
  it('lists warm-up first and extra last among set kinds', () => {
    expect(SET_KINDS[0]).toBe('warmup');
    expect(SET_KINDS.at(-1)).toBe('extra');
  });

  it('treats quads, hamstrings-glutes and calves as lower body', () => {
    expect(isLowerBody('quads')).toBe(true);
    expect(isLowerBody('calves')).toBe(true);
    expect(isLowerBody('back')).toBe(false);
  });

  it('accepts weekdays 1–7 and week sizes 3–5 only', () => {
    expect(weekdaySchema.safeParse(7).success).toBe(true);
    expect(weekdaySchema.safeParse(0).success).toBe(false);
    expect(weekSizeSchema.safeParse(4).success).toBe(true);
    expect(weekSizeSchema.safeParse(6).success).toBe(false);
  });
});

describe('text references', () => {
  it('is either an i18n key or raw text, never both', () => {
    expect(textRefSchema.safeParse(textKey('a.b')).success).toBe(true);
    expect(textRefSchema.safeParse(plainText('Mi ejercicio')).success).toBe(true);
    expect(textRefSchema.safeParse({ key: 'a', text: 'b' }).success).toBe(false);
    expect(textRefSchema.safeParse({ key: '' }).success).toBe(false);
  });
});

describe('set schemes', () => {
  it.each(['6-8', '12', '~10', '', '20-30'])('accepts rep range %j', (r) => {
    expect(repRangeSchema.safeParse(r).success).toBe(true);
  });

  it.each(['6-', '-8', '~', 'ten', '6–8'])('rejects rep range %j', (r) => {
    expect(repRangeSchema.safeParse(r).success).toBe(false);
  });

  it('accepts RIR targets like 1-2, 3 or none', () => {
    for (const r of ['1-2', '3', '']) expect(rirRangeSchema.safeParse(r).success).toBe(true);
    expect(rirRangeSchema.safeParse('1-2-3').success).toBe(false);
  });

  it('needs at least one block with a positive count', () => {
    expect(setSchemeSchema.safeParse({ blocks: [], rir: '1-2' }).success).toBe(false);
    const zero = { blocks: [{ kind: 'top', reps: '6-8', count: 0 }], rir: '' };
    expect(setSchemeSchema.safeParse(zero).success).toBe(false);
  });
});

describe('records', () => {
  it('validates a set, allowing 0 kg and no RIR', () => {
    const set = makeSet({ sessionId: 's1', exerciseId: 'prensa', weight: 0, rir: null });
    expect(setEntrySchema.safeParse(set).success).toBe(true);
    expect(setEntrySchema.safeParse({ ...set, weight: -1 }).success).toBe(false);
    expect(setEntrySchema.safeParse({ ...set, reps: 2.5 }).success).toBe(false);
  });

  it('only accepts Mondays as weeks', () => {
    const plan = makeWeekPlan({ week: '2026-11-02' });
    expect(weekPlanSchema.safeParse(plan).success).toBe(true);
    expect(weekPlanSchema.safeParse({ ...plan, week: '2026-11-03' }).success).toBe(false);
    const bw = { id: bodyWeightId('2026-11-03'), type: 'bodyWeight', updatedAt: 1 };
    expect(bodyWeightSchema.safeParse({ ...bw, week: '2026-11-03', kg: 80 }).success).toBe(false);
  });

  it('requires every muscle group in a frozen plan', () => {
    const plan = makeWeekPlan({ week: '2026-11-02' });
    expect(weekPlanSchema.safeParse({ ...plan, plannedSetsByGroup: { chest: 13 } }).success).toBe(
      false,
    );
  });

  it('marks a note as not counting for progression, with a reason', () => {
    const note = {
      id: exerciseNoteId('s1', 'hack-banda'),
      type: 'note',
      updatedAt: 1,
      sessionId: 's1',
      exerciseId: 'hack-banda',
      text: 'Banda verde',
      excludeFromProgression: true,
      reason: 'other-band',
    };
    expect(exerciseNoteSchema.parse(note).id).toBe('note_s1_hack-banda');
    expect(exerciseNoteSchema.safeParse({ ...note, reason: 'tired' }).success).toBe(false);
  });

  it('rejects a block metric whose min is not below its max', () => {
    const metric = { id: 'stairs', name: textKey('x'), min: 10, max: 0 };
    expect(blockMetricSchema.safeParse(metric).success).toBe(false);
  });

  it('accepts optional start and review dates on a block, as ISO dates', () => {
    const block = { ...ANKLE_REHAB_BLOCK, startDate: '2026-10-01', reviewDate: '2026-10-20' };
    expect(optionalBlockSchema.safeParse(block).success).toBe(true);
    expect(optionalBlockSchema.safeParse(ANKLE_REHAB_BLOCK).success).toBe(true);
    expect(optionalBlockSchema.safeParse({ ...block, reviewDate: '20/10/2026' }).success).toBe(
      false,
    );
  });

  it('builds stable ids for per-day and per-week records', () => {
    expect(weekPlanId('2026-11-02')).toBe('week_2026-11-02');
    expect(bodyWeightId('2026-11-02')).toBe('bw_2026-11-02');
    expect(blockLogId('b', '2026-11-03')).toBe('blocklog_b_2026-11-03');
    expect(weeklyMetricId('b', 'wall-test', '2026-11-02')).toBe('wmetric_b_wall-test_2026-11-02');
    const metric = {
      id: weeklyMetricId('b', 'wall-test', '2026-11-02'),
      type: 'weeklyMetric',
      updatedAt: 1,
      week: '2026-11-02',
      blockId: 'b',
      metricId: 'wall-test',
      values: { left: 11, right: 9.5 },
    };
    expect(weeklyMetricSchema.safeParse(metric).success).toBe(true);
  });

  it('keeps synced and device-only settings apart', () => {
    const synced = {
      id: SETTINGS_ID,
      type: 'settings',
      updatedAt: 1,
      rest: { ...DEFAULT_REST },
      planStart: '2026-11-02',
    };
    expect(syncedSettingsSchema.safeParse(synced).success).toBe(true);
    expect(syncedSettingsSchema.safeParse({ ...synced, id: 'other' }).success).toBe(false);
    expect('theme' in syncedSettingsSchema.shape).toBe(false);
    expect('syncKey' in syncedSettingsSchema.shape).toBe(false);
    expect('mono' in syncedSettingsSchema.shape).toBe(false);
    const device = { theme: 'system', mono: false, locale: 'es', sound: true, vibration: false };
    expect(deviceSettingsSchema.safeParse(device).success).toBe(true);
  });
});

describe('parseRecord', () => {
  it('has a schema for every record type, each checking its own type', () => {
    for (const [type, schema] of Object.entries(RECORD_SCHEMAS)) {
      expect(schema.shape.type.value).toBe(type);
    }
  });

  it('validates a record against the schema of its type', () => {
    const session = makeSession({ id: 's1', date: '2026-11-02' });
    const result = parseRecord(session);
    expect(result.ok).toBe(true);
    expect(parseRecord({ ...session, readiness: 9 }).ok).toBe(false);
  });

  it('drops unknown fields but keeps serverSeq', () => {
    const activity = {
      id: 'act-1',
      type: 'activity',
      updatedAt: 5,
      serverSeq: 12,
      date: '2026-11-07',
      kind: 'football',
      minutes: 60,
      note: '',
      extra: 'dropped',
    };
    const result = parseRecord(activity);
    expect(result).toMatchObject({ ok: true, record: { serverSeq: 12 } });
    expect(result.ok && 'extra' in result.record).toBe(false);
    expect(activitySchema.safeParse({ ...activity, kind: 'tennis' }).success).toBe(false);
  });

  it('accepts a soft-deleted record with only its envelope', () => {
    const result = parseRecord({ id: 'note_x', type: 'note', updatedAt: 9, deleted: true });
    expect(result).toEqual({
      ok: true,
      record: { id: 'note_x', type: 'note', updatedAt: 9, deleted: true },
    });
    expect(parseRecord({ id: '', type: 'note', updatedAt: 9, deleted: true }).ok).toBe(false);
    expect(tombstoneSchema.safeParse({ id: 'x', type: 'set', updatedAt: 1 }).success).toBe(false);
  });

  it.each([null, 42, {}, { type: 'wk' }, { type: 'toString' }])(
    'rejects unknown types: %j',
    (raw) => {
      expect(parseRecord(raw)).toEqual({ ok: false, error: 'unknown-type' });
    },
  );
});

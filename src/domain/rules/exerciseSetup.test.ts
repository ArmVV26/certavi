import { describe, expect, it } from 'vitest';
import { SETUP_LIMITS, exerciseSchema } from '../model/exercise';
import { SEED_EXERCISES_BY_ID } from '../seed';
import { normalizeSetup, sameSetup, setupDraftOf, setupLine } from './exerciseSetup';

describe('normalizeSetup', () => {
  it('trims the rows and drops the empty ones', () => {
    expect(
      normalizeSetup([
        { label: '  Respaldo ', value: ' 3' },
        { label: '', value: '  ' },
        { label: 'Asiento', value: '5 ' },
      ]),
    ).toEqual({
      ok: true,
      setup: [
        { label: 'Respaldo', value: '3' },
        { label: 'Asiento', value: '5' },
      ],
    });
  });

  it('gives no settings for no rows', () => {
    expect(normalizeSetup([])).toEqual({ ok: true, setup: [] });
  });

  it('asks for the missing half of a row', () => {
    expect(
      normalizeSetup([
        { label: '', value: '3' },
        { label: 'Asiento', value: ' ' },
      ]),
    ).toEqual({
      ok: false,
      errors: [
        { row: 0, field: 'label', code: 'label-empty' },
        { row: 1, field: 'value', code: 'value-empty' },
      ],
    });
  });

  it('refuses text over the limits', () => {
    const result = normalizeSetup([
      {
        label: 'x'.repeat(SETUP_LIMITS.maxLabel + 1),
        value: 'y'.repeat(SETUP_LIMITS.maxValue + 1),
      },
    ]);
    expect(result).toEqual({
      ok: false,
      errors: [
        { row: 0, field: 'label', code: 'label-too-long' },
        { row: 0, field: 'value', code: 'value-too-long' },
      ],
    });
    expect(
      normalizeSetup([
        { label: 'x'.repeat(SETUP_LIMITS.maxLabel), value: 'y'.repeat(SETUP_LIMITS.maxValue) },
      ]).ok,
    ).toBe(true);
  });

  it('refuses more rows than the limit', () => {
    const rows = Array.from({ length: SETUP_LIMITS.maxItems + 1 }, (_, i) => ({
      label: `A${String(i)}`,
      value: '1',
    }));
    expect(normalizeSetup(rows.slice(0, SETUP_LIMITS.maxItems)).ok).toBe(true);
    expect(normalizeSetup(rows)).toEqual({
      ok: false,
      errors: [{ row: SETUP_LIMITS.maxItems, field: 'label', code: 'too-many' }],
    });
  });
});

describe('setup helpers', () => {
  it('turns settings into editor rows and into one line', () => {
    const setup = [
      { label: 'Respaldo', value: '3' },
      { label: 'Asiento', value: '5' },
    ];
    expect(setupDraftOf(setup)).toEqual(setup);
    expect(setupDraftOf(undefined)).toEqual([]);
    expect(setupLine(setup)).toBe('Respaldo 3 · Asiento 5');
  });

  it('compares settings, treating none and an empty list as the same', () => {
    const a = [{ label: 'Pin', value: '7' }];
    expect(sameSetup(a, [{ label: 'Pin', value: '7' }])).toBe(true);
    expect(sameSetup(a, [{ label: 'Pin', value: '8' }])).toBe(false);
    expect(sameSetup(a, undefined)).toBe(false);
    expect(sameSetup(undefined, [])).toBe(true);
  });
});

describe('exercise schema and setup', () => {
  const base = SEED_EXERCISES_BY_ID.get('remo-t');

  it('accepts exercises with and without settings', () => {
    expect(exerciseSchema.safeParse(base).success).toBe(true);
    const withSetup = { ...base, setup: [{ label: 'Pin', value: '7' }] };
    expect(exerciseSchema.parse(withSetup).setup).toEqual([{ label: 'Pin', value: '7' }]);
  });

  it('rejects settings outside the limits', () => {
    const parse = (setup: unknown) => exerciseSchema.safeParse({ ...base, setup }).success;
    expect(parse([{ label: '', value: '1' }])).toBe(false);
    expect(parse([{ label: 'A', value: 'x'.repeat(SETUP_LIMITS.maxValue + 1) }])).toBe(false);
    expect(parse(Array.from({ length: 5 }, () => ({ label: 'A', value: '1' })))).toBe(false);
  });
});

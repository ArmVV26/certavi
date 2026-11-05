import { describe, expect, it } from 'vitest';
import type { PlanItem } from '../model/routine';
import type { SetScheme } from '../model/scheme';
import { makeSet } from '../testing/builders';
import {
  addExtraRow,
  addWarmupRow,
  changeRowKind,
  displayRows,
  effectiveKindFor,
  exerciseProgress,
  isExerciseComplete,
  knownBands,
  normalizeLegacyRows,
  removeRow,
  remapSets,
  resolveRowInput,
  rowsToScheme,
  schemeRows,
  sessionProgress,
  strapsBandDefaults,
} from './rows';

const hack: SetScheme = {
  blocks: [
    { kind: 'approach', reps: '', count: 1 },
    { kind: 'top', reps: '6-8', count: 1 },
    { kind: 'backoff', reps: '8-10', count: 2 },
  ],
  rir: '1-2',
};

const kinds = (scheme: SetScheme) => schemeRows(scheme).map((r) => r.kind);
const base = { sessionId: 's', exerciseId: 'e' };

describe('rows of a scheme', () => {
  it('flattens blocks and joins equal neighbours again', () => {
    const rows = schemeRows(hack);
    expect(rows).toHaveLength(4);
    expect(rowsToScheme(rows, '1-2')).toEqual(hack);
  });

  it('splits runs longer than a block can hold', () => {
    const rows = Array.from({ length: 25 }, () => ({ kind: 'extra' as const, reps: '' as const }));
    expect(rowsToScheme(rows, '').blocks.map((b) => b.count)).toEqual([20, 5]);
  });
});

describe('editing rows', () => {
  it('adds a warm-up above the working rows and pushes their slots down', () => {
    const edit = addWarmupRow(hack);
    expect(kinds(edit.scheme)).toEqual(['warmup', 'approach', 'top', 'backoff', 'backoff']);
    expect([0, 1, 3].map(edit.remap)).toEqual([1, 2, 4]);
  });

  it('adds the next warm-up after the ones already there', () => {
    const once = addWarmupRow(hack).scheme;
    const twice = addWarmupRow(once);
    expect(kinds(twice.scheme).slice(0, 3)).toEqual(['warmup', 'warmup', 'approach']);
    expect([0, 1, 2].map(twice.remap)).toEqual([0, 2, 3]);
  });

  it('adds an extra set at the bottom without moving anything', () => {
    const edit = addExtraRow(hack);
    expect(kinds(edit.scheme).at(-1)).toBe('extra');
    expect([0, 3].map(edit.remap)).toEqual([0, 3]);
  });

  it('removes a row, moving the ones below up and dropping its own set', () => {
    const edit = removeRow(hack, 1);
    expect(kinds(edit?.scheme ?? hack)).toEqual(['approach', 'backoff', 'backoff']);
    expect([0, 1, 2, 3].map((slot) => edit?.remap(slot))).toEqual([0, null, 1, 2]);
  });

  it('refuses to remove a missing row or the only one', () => {
    expect(removeRow(hack, 9)).toBeNull();
    expect(removeRow(hack, -1)).toBeNull();
    expect(removeRow({ blocks: [{ kind: 'extra', reps: '', count: 1 }], rir: '' }, 0)).toBeNull();
  });

  it('changes the kind of a row in place, dropping the rep target of rows that have none', () => {
    const edit = changeRowKind(hack, 1, 'warmup');
    expect(kinds(edit?.scheme ?? hack)).toEqual(['approach', 'warmup', 'backoff', 'backoff']);
    expect(schemeRows(edit?.scheme ?? hack)[1]?.reps).toBe('');
    expect(edit?.remap(2)).toBe(2);
    const keep = changeRowKind(hack, 2, 'straight');
    expect(schemeRows(keep?.scheme ?? hack)[2]).toEqual({ kind: 'straight', reps: '8-10' });
    expect(changeRowKind(hack, 7, 'dropset')).toBeNull();
  });

  it('turns a warm-up or dropset into a plain set and keeps any other kind', () => {
    expect(effectiveKindFor('warmup')).toBe('straight');
    expect(effectiveKindFor('dropset')).toBe('straight');
    expect(effectiveKindFor('top')).toBe('top');
    expect(effectiveKindFor('extra')).toBe('extra');
  });

  it('follows the slots of logged sets', () => {
    const sets = [0, 1, 2, 3].map((slot) => makeSet({ ...base, slot }));
    const edit = removeRow(hack, 1);
    const { moved, removed } = remapSets(sets, edit?.remap ?? ((s) => s));
    expect(removed.map((s) => s.slot)).toEqual([1]);
    expect(moved.map((s) => s.slot)).toEqual([1, 2]);
  });
});

describe('display rows', () => {
  const reference = [
    makeSet({ ...base, kind: 'approach', slot: 0, weight: 40, reps: 5 }),
    makeSet({ ...base, kind: 'top', slot: 1, weight: 62.5, reps: 8 }),
    makeSet({ ...base, kind: 'backoff', slot: 2, weight: 57.5, reps: 10 }),
    makeSet({ ...base, kind: 'warmup', slot: 3, weight: 20, reps: 10 }),
  ];

  it('numbers the effective rows and leaves warm-ups and dropsets without a number', () => {
    const scheme = changeRowKind(addWarmupRow(hack).scheme, 3, 'dropset')?.scheme ?? hack;
    const rows = displayRows({ scheme, sets: [], reference: null });
    expect(rows.map((r) => `${r.kind}:${String(r.number)}`)).toEqual([
      'warmup:null',
      'approach:1',
      'top:2',
      'dropset:null',
      'backoff:3',
    ]);
  });

  it('shows what the same row was last time, falling back to the last set of that kind', () => {
    const rows = displayRows({ scheme: hack, sets: [], reference });
    expect(rows.map((r) => r.previous)).toEqual([
      { weight: 40, reps: 5 },
      { weight: 62.5, reps: 8 },
      { weight: 57.5, reps: 10 },
      { weight: 57.5, reps: 10 },
    ]);
  });

  it('falls back to the last effective set, and has nothing for warm-ups or without a last time', () => {
    const scheme = addWarmupRow(addExtraRow(hack).scheme).scheme;
    const rows = displayRows({ scheme, sets: [], reference });
    expect(rows[0]?.previous).toBeNull();
    expect(rows.at(-1)?.kind).toBe('extra');
    expect(rows.at(-1)?.previous).toEqual({ weight: 57.5, reps: 10 });
    expect(displayRows({ scheme: hack, sets: [], reference: null }).every((r) => !r.previous)).toBe(
      true,
    );
  });

  it('pairs logged sets with their row and lets the logged kind decide', () => {
    const logged = makeSet({ ...base, kind: 'dropset', slot: 2, weight: 50, reps: 9 });
    const rows = displayRows({ scheme: hack, sets: [logged], reference: null });
    expect(rows[2]?.set).toBe(logged);
    expect(rows[2]?.kind).toBe('dropset');
    expect(rows[2]?.number).toBeNull();
  });

  it('keeps the newest set when two devices logged the same row', () => {
    const old = makeSet({ ...base, slot: 1, updatedAt: 5, reps: 6 });
    const recent = makeSet({ ...base, slot: 1, updatedAt: 9, reps: 8 });
    const rows = displayRows({ scheme: hack, sets: [old, recent], reference: null });
    expect(rows[1]?.set?.reps).toBe(8);
  });

  it('still shows a logged set whose row is gone, after the others', () => {
    const lost = makeSet({ ...base, kind: 'extra', slot: 6 });
    const rows = displayRows({ scheme: hack, sets: [lost], reference: null });
    expect(rows).toHaveLength(5);
    expect(rows.at(-1)).toMatchObject({ slot: 6, kind: 'extra', set: lost });
  });
});

describe('progress', () => {
  it('counts working rows only', () => {
    const scheme = changeRowKind(addExtraRow(addWarmupRow(hack).scheme).scheme, 2, 'dropset');
    const sets = [
      makeSet({ ...base, kind: 'warmup', slot: 0 }),
      makeSet({ ...base, kind: 'approach', slot: 1 }),
      makeSet({ ...base, kind: 'extra', slot: 5 }),
    ];
    const rows = displayRows({ scheme: scheme?.scheme ?? hack, sets, reference: null });
    expect(exerciseProgress(rows)).toEqual({ done: 1, total: 3 });
    expect(isExerciseComplete(exerciseProgress(rows))).toBe(false);
  });

  it('is complete when every working row is logged, never when there are none', () => {
    expect(isExerciseComplete({ done: 4, total: 4 })).toBe(true);
    expect(isExerciseComplete({ done: 0, total: 0 })).toBe(false);
  });

  it('adds up the exercises of a session', () => {
    const items: PlanItem[] = [
      { exerciseId: 'e', scheme: hack, optional: false },
      { exerciseId: 'f', scheme: hack, optional: false },
    ];
    const sets = [
      makeSet({ ...base, slot: 0 }),
      makeSet({ ...base, exerciseId: 'f', slot: 1 }),
      makeSet({ ...base, exerciseId: 'f', slot: 2 }),
    ];
    expect(sessionProgress(items, sets)).toEqual({ done: 3, total: 8 });
  });
});

describe('what ✓ saves', () => {
  const previous = { weight: 62.5, reps: 8 };

  it('takes "Anterior" when nothing was typed', () => {
    expect(resolveRowInput({ weight: null, reps: null }, previous, false)).toEqual({
      ok: true,
      ...previous,
    });
  });

  it('takes what was typed, with 0 kg valid', () => {
    expect(resolveRowInput({ weight: 0, reps: 10 }, previous, false)).toEqual({
      ok: true,
      weight: 0,
      reps: 10,
    });
  });

  it('marks the missing field when there is nothing to fall back on', () => {
    expect(resolveRowInput({ weight: null, reps: null }, null, false)).toEqual({
      ok: false,
      field: 'weight',
    });
    expect(resolveRowInput({ weight: 60, reps: null }, null, false)).toEqual({
      ok: false,
      field: 'reps',
    });
    expect(resolveRowInput({ weight: 60, reps: 0 }, previous, false)).toEqual({
      ok: false,
      field: 'reps',
    });
    expect(resolveRowInput({ weight: 60, reps: 2.5 }, previous, false)).toEqual({
      ok: false,
      field: 'reps',
    });
    expect(resolveRowInput({ weight: -1, reps: 5 }, previous, false)).toEqual({
      ok: false,
      field: 'weight',
    });
  });

  it('treats an empty weight as 0 for bodyweight exercises', () => {
    expect(resolveRowInput({ weight: null, reps: 8 }, null, true)).toEqual({
      ok: true,
      weight: 0,
      reps: 8,
    });
    expect(resolveRowInput({ weight: null, reps: null }, null, true)).toEqual({
      ok: false,
      field: 'reps',
    });
  });
});

describe('straps and band', () => {
  it('starts from the last working set of the session, then last time, then the defaults', () => {
    const saved = [
      makeSet({ ...base, kind: 'warmup', slot: 0, straps: true }),
      makeSet({ ...base, slot: 1, straps: false, band: 'red' }),
    ];
    expect(strapsBandDefaults('purple', saved, null)).toEqual({ straps: false, band: 'red' });
    const last = [makeSet({ ...base, slot: 0, straps: true, band: 'blue' })];
    expect(strapsBandDefaults('purple', [], last)).toEqual({ straps: true, band: 'blue' });
    expect(strapsBandDefaults('purple', [], null)).toEqual({ straps: true, band: 'purple' });
    expect(strapsBandDefaults(undefined, [], null)).toEqual({ straps: true, band: '' });
  });

  it('lists the bands used before once, sorted', () => {
    expect(knownBands([{ band: 'red' }, {}, { band: 'blue' }, { band: 'red' }])).toEqual([
      'blue',
      'red',
    ]);
  });
});

describe('legacy numbering (gym_app import)', () => {
  const item: PlanItem = { exerciseId: 'e', scheme: hack, optional: false };

  it('puts warm-ups first and extras last, and moves the sets to their new slots', () => {
    const sets = [
      makeSet({ ...base, kind: 'warmup', slot: 1 }),
      makeSet({ ...base, kind: 'warmup', slot: 2 }),
      makeSet({ ...base, kind: 'top', slot: 1 }),
      makeSet({ ...base, kind: 'extra', slot: 1 }),
      makeSet({ ...base, kind: 'backoff', slot: 5 }),
    ];
    const result = normalizeLegacyRows(item, sets);
    expect(kinds(result?.item.scheme ?? hack)).toEqual([
      'warmup',
      'warmup',
      'approach',
      'top',
      'backoff',
      'backoff',
      'extra',
      'backoff',
    ]);
    const slotOf = (kind: string, from: number) =>
      result?.sets.find((s) => s.kind === kind && s.slot !== from)?.slot;
    expect(slotOf('top', 1)).toBe(3);
    expect(result?.sets.map((s) => s.slot).sort()).toEqual([0, 1, 3, 6, 7]);
  });

  it('is idempotent and ignores exercises already in the current form', () => {
    const sets = [makeSet({ ...base, kind: 'warmup', slot: 1 })];
    const first = normalizeLegacyRows(item, sets);
    const again = normalizeLegacyRows(first?.item ?? item, first?.sets ?? []);
    expect(again).toBeNull();
    expect(normalizeLegacyRows(item, [makeSet({ ...base, kind: 'top', slot: 1 })])).toBeNull();
    expect(normalizeLegacyRows(item, [])).toBeNull();
  });

  it('only reports the sets that actually moved', () => {
    const result = normalizeLegacyRows(item, [makeSet({ ...base, kind: 'extra', slot: 1 })]);
    expect(result?.sets.map((s) => s.slot)).toEqual([4]);
    const planned = [
      makeSet({ ...base, kind: 'top', slot: 1 }),
      makeSet({ ...base, kind: 'extra' }),
    ];
    expect(normalizeLegacyRows(item, planned)?.sets.map((s) => s.kind)).toEqual(['extra']);
  });
});

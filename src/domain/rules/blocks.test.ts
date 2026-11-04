import { describe, expect, it } from 'vitest';
import { ANKLE_REHAB_BLOCK, SEED_BLOCKS, STRETCHING_BLOCK } from '../seed/blocks';
import {
  applyBlockLogPatch,
  blocksForDay,
  doneCount,
  emptyBlockLog,
  isAboveThreshold,
} from './blocks';

describe('blocksForDay', () => {
  it('returns the active ankle block every day and never the empty stretching block', () => {
    expect(blocksForDay(SEED_BLOCKS, '2026-11-04').map((b) => b.id)).toEqual([
      ANKLE_REHAB_BLOCK.id,
    ]);
  });

  it('skips inactive blocks, other weekdays and blocks with nothing in them', () => {
    const mondayOnly = { ...ANKLE_REHAB_BLOCK, id: 'monday', days: [1 as const] };
    const inactive = { ...ANKLE_REHAB_BLOCK, id: 'inactive', active: false };
    const empty = { ...STRETCHING_BLOCK, active: true, days: [3 as const] };
    const metricsOnly = { ...ANKLE_REHAB_BLOCK, id: 'metrics', items: [] };
    const blocks = [mondayOnly, inactive, empty, metricsOnly];
    expect(blocksForDay(blocks, '2026-11-04').map((b) => b.id)).toEqual(['metrics']);
    expect(blocksForDay(blocks, '2026-11-02').map((b) => b.id)).toEqual(['monday', 'metrics']);
  });
});

describe('block logs', () => {
  const empty = emptyBlockLog(ANKLE_REHAB_BLOCK.id, '2026-11-04');

  it('starts empty with the derived id', () => {
    expect(empty).toEqual({
      id: 'blocklog_block-ankle-rehab_2026-11-04',
      type: 'blockLog',
      date: '2026-11-04',
      blockId: ANKLE_REHAB_BLOCK.id,
      done: {},
      metrics: {},
      note: '',
    });
  });

  it('ticks and unticks items', () => {
    const ticked = applyBlockLogPatch(empty, { done: { itemId: 'foam-roll', value: true } });
    expect(ticked.done).toEqual({ 'foam-roll': true });
    expect(doneCount(ANKLE_REHAB_BLOCK, ticked)).toBe(1);
    const unticked = applyBlockLogPatch(ticked, { done: { itemId: 'foam-roll', value: false } });
    expect(doneCount(ANKLE_REHAB_BLOCK, unticked)).toBe(0);
    expect(doneCount(ANKLE_REHAB_BLOCK, undefined)).toBe(0);
  });

  it('sets and clears metrics', () => {
    const set = applyBlockLogPatch(empty, { metric: { metricId: 'stairs', value: 4 } });
    expect(set.metrics).toEqual({ stairs: 4 });
    const cleared = applyBlockLogPatch(set, { metric: { metricId: 'stairs', value: null } });
    expect(cleared.metrics).toEqual({});
    expect(set.metrics).toEqual({ stairs: 4 });
  });

  it('replaces the note', () => {
    expect(applyBlockLogPatch(empty, { note: 'Bien' }).note).toBe('Bien');
  });
});

describe('isAboveThreshold', () => {
  const metric = { threshold: 3 };

  it('warns only above the threshold', () => {
    expect(isAboveThreshold(metric, 3)).toBe(false);
    expect(isAboveThreshold(metric, 4)).toBe(true);
    expect(isAboveThreshold(metric, undefined)).toBe(false);
    expect(isAboveThreshold({}, 9)).toBe(false);
  });
});

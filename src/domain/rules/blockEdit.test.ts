import { describe, expect, it } from 'vitest';
import { plainText, textKey } from '../model/envelope';
import { ANKLE_REHAB_BLOCK, STRETCHING_BLOCK } from '../seed/blocks';
import {
  blockFromDraft,
  daysOf,
  draftFromBlock,
  emptyItemDraft,
  emptyMetricDraft,
  localIdFrom,
  moveInList,
  newBlockDraft,
  validateBlockDraft,
} from './blockEdit';

/** What the app does to read a key: the key itself stands for its translation. */
const text = (ref: { key: string } | { text: string }) =>
  'key' in ref ? `«${ref.key}»` : ref.text;

describe('newBlockDraft', () => {
  it('starts empty, active and proposed every day', () => {
    expect(newBlockDraft()).toMatchObject({
      name: '',
      active: true,
      days: [1, 2, 3, 4, 5, 6, 7],
      items: [],
      metrics: [],
    });
  });
});

describe('validateBlockDraft', () => {
  const valid = { ...newBlockDraft(), name: 'Movilidad de cadera' };

  it('accepts a named block with nothing else', () => {
    expect(validateBlockDraft(valid)).toEqual([]);
  });

  it('asks for a name no longer than the limit', () => {
    expect(validateBlockDraft({ ...valid, name: '  ' })).toEqual([
      { field: 'name', code: 'empty' },
    ]);
    expect(validateBlockDraft({ ...valid, name: 'x'.repeat(61) })).toEqual([
      { field: 'name', code: 'too-long' },
    ]);
  });

  it('checks every item: name, length and times per week', () => {
    const items = [
      { ...emptyItemDraft('a'), name: '' },
      { ...emptyItemDraft('b'), name: 'Puente', timesPerWeek: 'abc' },
      { ...emptyItemDraft('c'), name: 'Gato', dose: 'x'.repeat(61) },
      { ...emptyItemDraft('d'), name: 'Bien', timesPerWeek: '3-5' },
      { ...emptyItemDraft('e'), name: 'Bien también', timesPerWeek: '3' },
    ];
    expect(validateBlockDraft({ ...valid, items })).toEqual([
      { field: 'itemName', code: 'empty', key: 'a' },
      { field: 'timesPerWeek', code: 'invalid', key: 'b' },
      { field: 'itemName', code: 'too-long', key: 'c' },
    ]);
  });

  it('checks every metric: name and an integer limit from 0 to 9', () => {
    const metrics = [
      { ...emptyMetricDraft('a'), name: '' },
      { ...emptyMetricDraft('b'), name: 'Dolor', limit: '12' },
      { ...emptyMetricDraft('c'), name: 'Dolor', limit: '2.5' },
      { ...emptyMetricDraft('d'), name: 'x'.repeat(81) },
      { ...emptyMetricDraft('e'), name: 'Dolor', limit: '0' },
      { ...emptyMetricDraft('f'), name: 'Dolor' },
    ];
    expect(validateBlockDraft({ ...valid, metrics })).toEqual([
      { field: 'metricName', code: 'empty', key: 'a' },
      { field: 'limit', code: 'range', key: 'b' },
      { field: 'limit', code: 'range', key: 'c' },
      { field: 'metricName', code: 'too-long', key: 'd' },
    ]);
  });
});

describe('draftFromBlock and blockFromDraft', () => {
  it('rebuild the same block when nothing was edited, keeping the i18n keys', () => {
    const draft = draftFromBlock(ANKLE_REHAB_BLOCK, text);
    expect(draft.name).toBe('«blocks.names.ankleRehab»');
    const rebuilt = blockFromDraft(draft, ANKLE_REHAB_BLOCK.id, ANKLE_REHAB_BLOCK);
    expect({ ...rebuilt, type: 'block', updatedAt: 0 }).toEqual(ANKLE_REHAB_BLOCK);
  });

  it('turns a text that was edited into plain text and keeps the ids', () => {
    const draft = draftFromBlock(ANKLE_REHAB_BLOCK, text);
    const items = draft.items.map((item) =>
      item.id === 'foam-roll' ? { ...item, name: ' Rodillo ', dose: '' } : item,
    );
    const block = blockFromDraft({ ...draft, items }, ANKLE_REHAB_BLOCK.id, ANKLE_REHAB_BLOCK);
    const foam = block.items.find((item) => item.id === 'foam-roll');
    expect(foam).toEqual({ id: 'foam-roll', name: plainText('Rodillo') });
    expect(block.items.find((item) => item.id === 'wall-ankle')?.name).toEqual(
      textKey('blocks.items.wallAnkle'),
    );
  });

  it('keeps what the form does not show: type, weekly values and where the block came from', () => {
    const draft = { ...draftFromBlock(ANKLE_REHAB_BLOCK, text), blockType: 'mobility' as const };
    const block = blockFromDraft(draft, ANKLE_REHAB_BLOCK.id, ANKLE_REHAB_BLOCK);
    expect(block.blockType).toBe('rehab');
    expect(block.weeklyMetrics).toEqual(ANKLE_REHAB_BLOCK.weeklyMetrics);
    expect(block.custom).toBe(false);
  });

  it('builds a new block from the form with ids made from the names', () => {
    const draft = {
      ...newBlockDraft(),
      name: ' Movilidad de cadera ',
      blockType: 'mobility' as const,
      days: [5, 1, 3] as ReturnType<typeof newBlockDraft>['days'],
      startDate: '2026-11-02',
      reviewDate: '',
      items: [
        { ...emptyItemDraft('n1'), name: 'Sentadilla profunda', dose: '3 × 30 s' },
        { ...emptyItemDraft('n2'), name: 'Sentadilla profunda', timesPerWeek: '3-5' },
      ],
      metrics: [{ ...emptyMetricDraft('m1'), name: 'Dolor', limit: '3' }],
    };
    expect(blockFromDraft(draft, 'blk_1')).toEqual({
      id: 'blk_1',
      name: { text: 'Movilidad de cadera' },
      blockType: 'mobility',
      items: [
        {
          id: 'sentadilla-profunda',
          name: { text: 'Sentadilla profunda' },
          dose: { text: '3 × 30 s' },
        },
        { id: 'sentadilla-profunda-2', name: { text: 'Sentadilla profunda' }, timesPerWeek: '3-5' },
      ],
      days: [1, 3, 5],
      metrics: [{ id: 'dolor', name: { text: 'Dolor' }, min: 0, max: 10, threshold: 3 }],
      weeklyMetrics: [],
      active: true,
      custom: true,
      startDate: '2026-11-02',
    });
  });

  it('reads the empty stretching block as an empty draft', () => {
    const draft = draftFromBlock(STRETCHING_BLOCK, text);
    expect(draft).toMatchObject({ active: false, days: [], items: [], metrics: [] });
  });
});

describe('localIdFrom', () => {
  it('makes a slug without accents and never starts with a digit', () => {
    expect(localIdFrom('Elevación de talón', new Set(), 'item')).toBe('elevacion-de-talon');
    expect(localIdFrom('3 × 10', new Set(), 'item')).toBe('item-3-10');
    expect(localIdFrom('???', new Set(), 'metric')).toBe('metric');
  });

  it('adds a number when the id is taken and keeps it short', () => {
    expect(localIdFrom('Gato', new Set(['gato', 'gato-2']), 'item')).toBe('gato-3');
    expect(localIdFrom('a'.repeat(60), new Set(), 'item').length).toBeLessThanOrEqual(30);
  });
});

describe('moveInList', () => {
  it('moves an element one place and leaves the list alone at the ends', () => {
    expect(moveInList(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveInList(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveInList(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveInList(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
    expect(moveInList(['a'], 5, 1)).toEqual(['a']);
  });
});

describe('daysOf', () => {
  it('says every day, none or the sorted list', () => {
    expect(daysOf([1, 2, 3, 4, 5, 6, 7])).toEqual({ kind: 'all' });
    expect(daysOf([])).toEqual({ kind: 'none' });
    expect(daysOf([5, 1, 3])).toEqual({ kind: 'some', days: [1, 3, 5] });
  });
});

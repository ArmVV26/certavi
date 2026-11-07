import { describe, expect, it } from 'vitest';
import {
  ANKLE_REHAB_BLOCK,
  ANKLE_REHAB_BLOCK_ID,
  STRETCHING_BLOCK_ID,
  draftFromBlock,
  emptyItemDraft,
  newBlockDraft,
  SEED_ROUTINES_BY_ID,
  textKey,
  type BlockDraft,
  type OptionalBlock,
  type PlanItem,
} from '../domain';
import { makeSession, makeSet } from '../domain/testing/builders';
import { openTestDatabase } from '../test/render';
import {
  BlockNotFoundError,
  InvalidBlockError,
  createBlock,
  readBlockTracking,
  readBlocks,
  saveWeeklyValues,
  updateBlock,
} from './blocks';
import { createRepositories } from './repository';
import { ensureSeed } from './seed';
import { readSession } from './sessions';
import { updateBlockLog } from './today';

let clock = 1_800_000_000_000;
const now = () => {
  clock += 1;
  return clock;
};

async function setup() {
  const db = openTestDatabase();
  await ensureSeed(db);
  return { db, repos: createRepositories(db, { now }) };
}

const text = (ref: { key: string } | { text: string }) => ('key' in ref ? ref.key : ref.text);
const draftOf = (block: OptionalBlock): BlockDraft => draftFromBlock(block, text);

describe('readBlocks', () => {
  it('lists the live blocks with the active ones first', async () => {
    const { db, repos } = await setup();
    expect((await readBlocks(db)).map((b) => b.id)).toEqual([
      ANKLE_REHAB_BLOCK_ID,
      STRETCHING_BLOCK_ID,
    ]);
    await repos.block.put({ ...ANKLE_REHAB_BLOCK, active: false });
    await repos.block.put({ ...ANKLE_REHAB_BLOCK, id: 'blk_x', active: true, custom: true });
    await repos.block.remove(STRETCHING_BLOCK_ID);
    expect((await readBlocks(db)).map((b) => b.id)).toEqual(['blk_x', ANKLE_REHAB_BLOCK_ID]);
  });
});

describe('createBlock', () => {
  it('writes a custom block and queues it for sync', async () => {
    const { db } = await setup();
    const draft = {
      ...newBlockDraft(),
      name: 'Movilidad de cadera',
      items: [{ ...emptyItemDraft('n'), name: 'Sentadilla profunda', dose: '3 × 30 s' }],
    };
    const block = await createBlock(db, draft, { now });
    expect(block).toMatchObject({
      custom: true,
      active: true,
      name: { text: 'Movilidad de cadera' },
    });
    expect(block.id).toMatch(/^blk_/);
    expect(block.items[0]?.id).toBe('sentadilla-profunda');
    expect((await db.pending.toArray()).map((p) => p.id)).toContain(block.id);
  });

  it('throws InvalidBlockError and writes nothing when the draft is not valid', async () => {
    const { db } = await setup();
    const before = await db.blocks.count();
    const error = await createBlock(db, newBlockDraft()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvalidBlockError);
    expect((error as InvalidBlockError).errors).toEqual([{ field: 'name', code: 'empty' }]);
    expect(await db.blocks.count()).toBe(before);
  });
});

describe('updateBlock', () => {
  it('edits the seed block keeping its keys, and the update survives the next seed', async () => {
    const { db } = await setup();
    const draft = draftOf(ANKLE_REHAB_BLOCK);
    const saved = await updateBlock(
      db,
      ANKLE_REHAB_BLOCK_ID,
      {
        ...draft,
        active: false,
        items: draft.items.filter((item) => item.id !== 'pogos'),
      },
      { now },
    );
    expect(saved.name).toEqual(textKey('blocks.names.ankleRehab'));
    expect(saved.items).toHaveLength(7);
    expect(saved.active).toBe(false);
    expect(saved.custom).toBe(false);
    expect(saved.blockType).toBe('rehab');

    await ensureSeed(db);
    expect((await readBlocks(db)).find((b) => b.id === ANKLE_REHAB_BLOCK_ID)?.active).toBe(false);
  });

  it('fills in the empty stretching block', async () => {
    const { db } = await setup();
    const draft = {
      ...draftOf((await readBlocks(db)).find((b) => b.id === STRETCHING_BLOCK_ID) as OptionalBlock),
      active: true,
      days: [1 as const, 3 as const],
      items: [{ ...emptyItemDraft('a'), name: 'Isquios' }],
    };
    const saved = await updateBlock(db, STRETCHING_BLOCK_ID, draft, { now });
    expect(saved).toMatchObject({ active: true, days: [1, 3], blockType: 'stretching' });
  });

  it('throws when the block does not exist or the draft is invalid', async () => {
    const { db } = await setup();
    await expect(updateBlock(db, 'nope', newBlockDraft())).rejects.toBeInstanceOf(
      BlockNotFoundError,
    );
    await expect(
      updateBlock(db, ANKLE_REHAB_BLOCK_ID, { ...draftOf(ANKLE_REHAB_BLOCK), name: '' }),
    ).rejects.toBeInstanceOf(InvalidBlockError);
  });
});

describe('weekly values', () => {
  const input = { blockId: ANKLE_REHAB_BLOCK_ID, metricId: 'wall-test', week: '2026-11-02' };

  it('saves one record per block, metric and week and merges the parts', async () => {
    const { db } = await setup();
    await saveWeeklyValues(db, { ...input, values: { left: 9.5, right: null } }, { now });
    const second = await saveWeeklyValues(db, { ...input, values: { right: 11 } }, { now });
    expect(second?.values).toEqual({ left: 9.5, right: 11 });
    const tracking = await readBlockTracking(db, ANKLE_REHAB_BLOCK_ID);
    expect(tracking.weekly).toHaveLength(1);
    expect(tracking.weekly[0]?.id).toBe('wmetric_block-ankle-rehab_wall-test_2026-11-02');
  });

  it('replaces a value and removes the record when no part is left', async () => {
    const { db } = await setup();
    await saveWeeklyValues(db, { ...input, values: { left: 9, right: 10 } }, { now });
    await saveWeeklyValues(db, { ...input, values: { right: 12 } }, { now });
    expect((await readBlockTracking(db, ANKLE_REHAB_BLOCK_ID)).weekly[0]?.values).toEqual({
      left: 9,
      right: 12,
    });
    const gone = await saveWeeklyValues(
      db,
      { ...input, values: { left: null, right: null } },
      { now },
    );
    expect(gone).toBeUndefined();
    expect((await readBlockTracking(db, ANKLE_REHAB_BLOCK_ID)).weekly).toEqual([]);
  });
});

describe('readBlockTracking', () => {
  it('reads a block with its live logs and weekly values only', async () => {
    const { db } = await setup();
    await updateBlockLog(db, ANKLE_REHAB_BLOCK_ID, '2026-11-02', {
      metric: { metricId: 'stairs', value: 2 },
    });
    await updateBlockLog(db, ANKLE_REHAB_BLOCK_ID, '2026-11-03', {
      metric: { metricId: 'stairs', value: 4 },
    });
    await updateBlockLog(db, STRETCHING_BLOCK_ID, '2026-11-03', { note: 'otro bloque' });
    await createRepositories(db).blockLog.remove('blocklog_block-ankle-rehab_2026-11-03');
    await saveWeeklyValues(db, {
      blockId: STRETCHING_BLOCK_ID,
      metricId: 'x',
      week: '2026-11-02',
      values: { a: 1 },
    });

    const tracking = await readBlockTracking(db, ANKLE_REHAB_BLOCK_ID);
    expect(tracking.block?.id).toBe(ANKLE_REHAB_BLOCK_ID);
    expect(tracking.logs.map((l) => l.date)).toEqual(['2026-11-02']);
    expect(tracking.weekly).toEqual([]);
  });

  it('has no block for an unknown or deleted id', async () => {
    const { db, repos } = await setup();
    expect((await readBlockTracking(db, 'nope')).block).toBeUndefined();
    await repos.block.remove(STRETCHING_BLOCK_ID);
    expect((await readBlockTracking(db, STRETCHING_BLOCK_ID)).block).toBeUndefined();
  });
});

describe('readSession: rehab context', () => {
  const calfItem = SEED_ROUTINES_BY_ID.get('lowerA')?.items[0] as PlanItem;

  async function withCalf() {
    const { db, repos } = await setup();
    await repos.session.putMany([
      makeSession({ id: 'ref', date: '2026-11-02', items: [calfItem] }),
      makeSession({ id: 'next', date: '2026-11-05', items: [calfItem] }),
    ]);
    await repos.set.putMany(
      [12, 12, 12, 12].map((reps, slot) =>
        makeSet({ sessionId: 'ref', exerciseId: 'gemelo-hack', weight: 60, reps, slot }),
      ),
    );
    return { db, repos };
  }

  it('carries the pain logged after the last time the calf was done', async () => {
    const { db } = await withCalf();
    expect((await readSession(db, 'next'))?.rehab).toEqual({ stairsPain: undefined, limit: 3 });
    await updateBlockLog(db, ANKLE_REHAB_BLOCK_ID, '2026-11-03', {
      metric: { metricId: 'stairs', value: 2 },
    });
    expect((await readSession(db, 'next'))?.rehab).toEqual({ stairsPain: 2, limit: 3 });
  });

  it('is undefined with the rehab block inactive or when the calf has no reference', async () => {
    const { db, repos } = await withCalf();
    await repos.block.put({ ...ANKLE_REHAB_BLOCK, active: false });
    expect((await readSession(db, 'next'))?.rehab).toBeUndefined();
    expect((await readSession(db, 'ref'))?.rehab).toBeUndefined();
  });
});

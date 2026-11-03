import { describe, expect, it } from 'vitest';
import {
  ANKLE_REHAB_BLOCK_ID,
  SEED_BLOCKS,
  SEED_EXERCISES,
  SEED_ROUTINES,
  SEED_SETTINGS,
} from '../domain';
import { openTestDatabase } from '../test/render';
import { createRepositories } from './repository';
import { ensureSeed } from './seed';

const SEED_TOTAL = SEED_EXERCISES.length + SEED_ROUTINES.length + SEED_BLOCKS.length + 1;

describe('ensureSeed', () => {
  it('writes the catalog, routines, blocks and default settings, outside the queue', async () => {
    const db = openTestDatabase();

    expect(await ensureSeed(db)).toBe(SEED_TOTAL);

    expect(await db.exercises.count()).toBe(45);
    expect(await db.routines.count()).toBe(6);
    expect(await db.blocks.count()).toBe(2);
    expect(await db.settings.get('settings')).toEqual(SEED_SETTINGS);
    expect(await db.pending.count()).toBe(0);
  });

  it('is idempotent: a second start writes nothing', async () => {
    const db = openTestDatabase();
    await ensureSeed(db);
    expect(await ensureSeed(db)).toBe(0);
    expect(await db.exercises.count()).toBe(45);
  });

  it('never overwrites a record the user edited', async () => {
    const db = openTestDatabase();
    await ensureSeed(db);
    const repos = createRepositories(db, { now: () => 5 });
    const push = await repos.routine.get('push');
    if (!push) throw new Error('push routine missing');
    await repos.routine.put({ ...push, items: push.items.slice(1) });

    expect(await ensureSeed(db)).toBe(0);
    expect((await repos.routine.get('push'))?.items).toHaveLength(push.items.length - 1);
  });

  it('never brings back a seed record the user deleted', async () => {
    const db = openTestDatabase();
    await ensureSeed(db);
    await createRepositories(db).block.remove(ANKLE_REHAB_BLOCK_ID);

    expect(await ensureSeed(db)).toBe(0);
    expect((await db.blocks.get(ANKLE_REHAB_BLOCK_ID))?.deleted).toBe(true);
  });

  it('refreshes seed records that were never edited when the app ships a new version', async () => {
    const db = openTestDatabase();
    await ensureSeed(db);
    const first = SEED_EXERCISES[0];
    if (!first) throw new Error('empty catalog');
    await db.exercises.put({ ...first, increment: 99 }); // as an older app version left it

    expect(await ensureSeed(db)).toBe(1);
    expect(await db.exercises.get(first.id)).toEqual(first);
  });
});

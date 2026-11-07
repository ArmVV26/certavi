import { describe, expect, it } from 'vitest';
import { makeSession, makeSet } from '../domain/testing/builders';
import { openTestDatabase } from '../test/render';
import { readProgress } from './progress';
import { createRepositories } from './repository';
import { ensureSeed } from './seed';

describe('readProgress', () => {
  it('reads the live log: no deleted sessions, no sets of deleted sessions', async () => {
    const db = openTestDatabase();
    await ensureSeed(db);
    const repos = createRepositories(db);
    await repos.session.putMany([
      makeSession({ id: 'a', date: '2026-11-03' }),
      makeSession({ id: 'gone', date: '2026-11-04' }),
    ]);
    await repos.set.putMany([
      makeSet({ id: 's1', sessionId: 'a', exerciseId: 'x' }),
      makeSet({ id: 's2', sessionId: 'gone', exerciseId: 'x' }),
      makeSet({ id: 's3', sessionId: 'a', exerciseId: 'x' }),
    ]);
    await repos.session.remove('gone');
    await repos.set.remove('s3');
    await repos.activity.put({
      id: 'act',
      date: '2026-11-03',
      kind: 'football',
      minutes: 60,
      note: '',
    });
    await repos.bodyWeight.put({ id: 'bw_2026-11-02', week: '2026-11-02', kg: 82 });

    const data = await readProgress(db);
    expect(data.sessions.map((s) => s.id)).toEqual(['a']);
    expect(data.sets.map((s) => s.id)).toEqual(['s1']);
    expect(data.activities).toHaveLength(1);
    expect(data.bodyWeights.map((b) => b.kg)).toEqual([82]);
    expect(data.routines.length).toBeGreaterThan(0);
    expect(data.exercises.length).toBeGreaterThan(0);
    expect(data.weekPlans).toEqual([]);
    expect(data.settings).toBeDefined();
  });

  it('has no settings on an empty database', async () => {
    const data = await readProgress(openTestDatabase());
    expect(data.settings).toBeUndefined();
    expect(data.sessions).toEqual([]);
  });
});

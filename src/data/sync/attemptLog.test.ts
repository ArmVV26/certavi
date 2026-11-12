import { describe, expect, it } from 'vitest';
import { ATTEMPT_LOG_SIZE } from '../../domain';
import { openTestDatabase } from '../../test/render';
import type { NewSyncLogEntry } from '../db';
import { addAttempt, lastSuccessAt, readAttempts } from './attemptLog';

const attempt = (at: number, ok = true): NewSyncLogEntry => ({
  at,
  sent: 1,
  received: 2,
  durationMs: 30,
  trigger: 'manual',
  ...(ok ? { ok: true } : { ok: false, error: 'network' }),
});

describe('attempt log', () => {
  it('keeps the 40 most recent attempts, newest first', async () => {
    const db = openTestDatabase();
    for (let i = 1; i <= ATTEMPT_LOG_SIZE + 5; i++) await addAttempt(db, attempt(i));

    const attempts = await readAttempts(db);

    expect(attempts).toHaveLength(ATTEMPT_LOG_SIZE);
    expect(attempts[0]?.at).toBe(ATTEMPT_LOG_SIZE + 5);
    expect(attempts.at(-1)?.at).toBe(6);
  });

  it('knows the time of the last attempt that worked', async () => {
    const db = openTestDatabase();
    expect(await lastSuccessAt(db)).toBeNull();
    await addAttempt(db, attempt(10));
    await addAttempt(db, attempt(20, false));
    expect(await lastSuccessAt(db)).toBe(10);
  });

  it('reads a failure stored without its code (older versions) as an internal error', async () => {
    const db = openTestDatabase();
    // The stored shape used to allow it; the type no longer does.
    await db.syncLog.add({
      at: 1,
      ok: false,
      sent: 0,
      received: 0,
      durationMs: 1,
      trigger: 'manual',
    } as never);
    expect((await readAttempts(db))[0]).toMatchObject({ ok: false, error: 'client-error' });
  });
});

import { describe, expect, it } from 'vitest';
import { ATTEMPT_LOG_SIZE } from '../../domain';
import { openTestDatabase } from '../../test/render';
import { addAttempt, lastSuccessAt, readAttempts } from './attemptLog';

const attempt = (at: number, ok = true) => ({
  at,
  ok,
  sent: 1,
  received: 2,
  durationMs: 30,
  trigger: 'manual' as const,
  ...(ok ? {} : { error: 'network' }),
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
});

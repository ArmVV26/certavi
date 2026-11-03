// Monotonic clock for `updatedAt` (docs/api/sync-v1.md §8): max(now, last + 1), persisted.
import type { CertaviDb } from './db';

const CLOCK_KEY = 'clock';

/**
 * Reserves `count` consecutive timestamps, all later than any handed out before on this device,
 * and returns the first one (the others are `first + 1`, `first + 2`…). Must run inside a
 * read-write transaction that includes `db.meta`, so the clock moves with the records it stamps.
 */
export async function reserveTimestamps(
  db: CertaviDb,
  count: number,
  now: number = Date.now(),
): Promise<number> {
  const last = (await db.meta.get(CLOCK_KEY))?.value ?? 0;
  const first = Math.max(now, last + 1);
  if (count > 0) await db.meta.put({ key: CLOCK_KEY, value: first + count - 1 });
  return first;
}

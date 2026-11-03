// What an import file turns into before anything is saved: valid Certavi records + counts.
import type { DomainRecord } from '../domain';

export type ImportFile =
  | {
      ok: true;
      /** Valid records, one per id. */
      records: DomainRecord[];
      /** Records that do not map to Certavi: deleted ones, internal settings… */
      ignored: number;
      /** Records that could not be read or did not pass validation. */
      invalid: number;
    }
  | { ok: false };

/** One record per id: the newest wins (two gym_app records can map to the same Certavi id). */
export function dedupeNewest(records: readonly DomainRecord[]): DomainRecord[] {
  const byId = new Map<string, DomainRecord>();
  for (const record of records) {
    const current = byId.get(record.id);
    if (!current || record.updatedAt > current.updatedAt) byId.set(record.id, record);
  }
  return [...byId.values()];
}

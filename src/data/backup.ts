// Certavi's own JSON backups: the full copy, one session or one week. They hold plain records
// (with the sync envelope) and import back through readBackup + applyImport.
import { z } from 'zod';
import {
  addDays,
  bodyWeightId,
  parseRecord,
  RECORD_TYPES,
  toIsoDate,
  weekPlanId,
  type DomainRecord,
  type RecordOf,
  type RecordType,
} from '../domain';
import { isLive, recordTables, tableOf, type CertaviDb, type StoredRecord } from './db';
import type { ExportFile } from './exportFile';
import { dedupeNewest, type ImportFile } from './importFile';

export const BACKUP_APP = 'certavi';
export const BACKUP_FORMAT = 1;

export type BackupKind = 'full' | 'session' | 'week';

export interface Backup {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  kind: BackupKind;
  exportedAt: string;
  records: DomainRecord[];
}

const backupFileSchema = z.looseObject({
  app: z.literal(BACKUP_APP),
  format: z.literal(BACKUP_FORMAT),
  records: z.array(z.unknown()),
});

/** Records leave the device without the server sequence (it belongs to the sync state). */
function forExport(record: DomainRecord): DomainRecord {
  const copy = { ...record };
  delete copy.serverSeq;
  return copy;
}

function backupFile(
  kind: BackupKind,
  records: readonly DomainRecord[],
  fileName: string,
  now: Date,
): ExportFile {
  const value: Backup = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    kind,
    exportedAt: now.toISOString(),
    records: records.map(forExport),
  };
  return { fileName, mimeType: 'application/json', content: JSON.stringify(value, null, 1) };
}

/** A full backup made of `records` (e.g. a server backup downloaded from Settings). */
export function fullBackupFile(
  records: readonly DomainRecord[],
  fileName: string,
  now: Date = new Date(),
): ExportFile {
  return backupFile('full', records, fileName, now);
}

/** Live rows only: tombstones never leave the device in a backup. */
function live<K extends RecordType>(rows: readonly (StoredRecord<K> | undefined)[]): RecordOf<K>[] {
  return rows.filter((row): row is RecordOf<K> => row !== undefined && isLive(row));
}

/** Every live record on this device: `certavi-backup-<today>.json`. */
export function exportAll(db: CertaviDb, now: Date = new Date()): Promise<ExportFile> {
  return db.transaction('r', recordTables(db), async () => {
    const groups = await Promise.all(
      RECORD_TYPES.map(async (type) => (await tableOf(db, type).toArray()).filter(isLive)),
    );
    const records = groups.flat() as DomainRecord[];
    return backupFile('full', records, `certavi-backup-${toIsoDate(now)}.json`, now);
  });
}

async function setsAndNotes(db: CertaviDb, sessionIds: readonly string[]) {
  const [sets, notes] = await Promise.all([
    db.sets.where('sessionId').anyOf(sessionIds).toArray(),
    db.notes.where('sessionId').anyOf(sessionIds).toArray(),
  ]);
  return [...live(sets), ...live(notes)];
}

/** One session with its sets and notes (`certavi-session-<date>-<id>.json`); null if missing. */
export function exportSession(
  db: CertaviDb,
  sessionId: string,
  now: Date = new Date(),
): Promise<ExportFile | null> {
  return db.transaction('r', recordTables(db), async () => {
    const [session] = live([await db.sessions.get(sessionId)]);
    if (!session) return null;
    const records = [session, ...(await setsAndNotes(db, [sessionId]))];
    return backupFile(
      'session',
      records,
      `certavi-session-${session.date}-${session.id}.json`,
      now,
    );
  });
}

/**
 * One week, Monday to Sunday (`certavi-week-<monday>.json`): its plan and body weight, the
 * sessions with their sets and notes, activities, block logs and weekly metrics.
 */
export function exportWeek(
  db: CertaviDb,
  monday: string,
  now: Date = new Date(),
): Promise<ExportFile> {
  const sunday = addDays(monday, 6);
  return db.transaction('r', recordTables(db), async () => {
    const [plan, weight, sessions, activities, blockLogs, weeklyMetrics] = await Promise.all([
      db.weekPlans.get(weekPlanId(monday)),
      db.bodyWeights.get(bodyWeightId(monday)),
      db.sessions.where('date').between(monday, sunday, true, true).toArray(),
      db.activities.where('date').between(monday, sunday, true, true).toArray(),
      db.blockLogs.where('date').between(monday, sunday, true, true).toArray(),
      db.weeklyMetrics.where('week').equals(monday).toArray(),
    ]);
    const liveSessions = live(sessions);
    const records: DomainRecord[] = [
      ...live([plan, weight]),
      ...liveSessions,
      ...(await setsAndNotes(
        db,
        liveSessions.map((s) => s.id),
      )),
      ...live(activities),
      ...live(blockLogs),
      ...live(weeklyMetrics),
    ];
    return backupFile('week', records, `certavi-week-${monday}.json`, now);
  });
}

/** Reads a Certavi backup file. Deleted records are ignored; malformed ones count as invalid. */
export function readBackup(text: string): ImportFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false };
  }
  const file = backupFileSchema.safeParse(json);
  if (!file.success) return { ok: false };
  const records: DomainRecord[] = [];
  let ignored = 0;
  let invalid = 0;
  for (const raw of file.data.records) {
    const parsed = parseRecord(raw);
    if (!parsed.ok) invalid += 1;
    else if (parsed.record.deleted === true) ignored += 1;
    else records.push(parsed.record);
  }
  return { ok: true, records: dedupeNewest(records), ignored, invalid };
}

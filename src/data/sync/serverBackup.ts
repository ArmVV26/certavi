// A server backup as a file the user can keep: a regular Certavi full backup, so "Import Certavi
// backup" accepts it (ADR-0004 §9).
import { parseRecord, type BackupFile, type DomainRecord } from '../../domain';
import { fullBackupFile } from '../backup';
import type { ExportFile } from '../exportFile';

export function serverBackupFile(backup: BackupFile, now: Date = new Date()): ExportFile {
  const records: DomainRecord[] = [];
  for (const raw of backup.records) {
    const result = parseRecord(raw);
    // Backups made by this app hold live records only; tombstones and unknown data stay out.
    if (result.ok && result.record.deleted !== true) records.push(result.record);
  }
  return fullBackupFile(records, `certavi-server-backup-${backup.date}.json`, now);
}

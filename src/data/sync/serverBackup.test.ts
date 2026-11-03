import { describe, expect, it } from 'vitest';
import type { BackupFile } from '../../domain';
import { makeSession } from '../../domain/testing/builders';
import { readBackup } from '../backup';
import { serverBackupFile } from './serverBackup';

describe('serverBackupFile', () => {
  it('is a Certavi full backup of the live records, which the importer accepts', () => {
    const session = makeSession({ id: 'a', date: '2026-11-02', updatedAt: 10 });
    const backup: BackupFile = {
      date: '2026-11-02',
      records: [
        { ...session, serverSeq: 1 },
        { id: 'b', type: 'session', updatedAt: 11, deleted: true, serverSeq: 2 },
        { id: 'c', type: 'future-type', updatedAt: 12, serverSeq: 3 },
      ],
    };

    const file = serverBackupFile(backup, new Date('2026-11-03T10:00:00Z'));

    expect(file.fileName).toBe('certavi-server-backup-2026-11-02.json');
    expect(file.mimeType).toBe('application/json');
    expect(JSON.parse(file.content)).toMatchObject({
      app: 'certavi',
      format: 1,
      kind: 'full',
      exportedAt: '2026-11-03T10:00:00.000Z',
    });
    const read = readBackup(file.content);
    expect(read.ok && read.records).toEqual([session]);
  });
});

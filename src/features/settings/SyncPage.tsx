import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { BackupSummary } from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import type { ExportFile } from '../../data/exportFile';
import { readAttempts } from '../../data/sync/attemptLog';
import { serverBackupFile } from '../../data/sync/serverBackup';
import { useSyncEngine, useSyncState } from '../../data/sync/SyncContext';
import { toSyncError } from '../../data/sync/transport';
import { formatDate, formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import type { Locale } from '../../i18n/locale';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { cx } from '../../ui/cx';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/ToastContext';
import { downloadFile } from '../../ui/download';
import styles from './SyncPage.module.css';
import { errorKeyOf } from './syncText';

/** A backup date ('YYYY-MM-DD') in long format, read as a calendar day (no time zone). */
function longDate(date: string, locale: Locale): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return formatDate(new Date(year, month - 1, day), locale);
}

interface SyncPageProps {
  /** Injectable for tests. */
  download?: (file: ExportFile) => void;
}

/** `/settings/sync`: the attempt log and the server backups. */
export function SyncPage({ download = downloadFile }: SyncPageProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <Link to="/settings" className={styles.back}>
        <Icon name="back" size={20} />
        <span>{t('settings.sync.back')}</span>
      </Link>
      <AttemptLog />
      <ServerBackups download={download} />
    </div>
  );
}

function AttemptLog() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const db = useDatabase();
  const attempts = useLiveQuery(() => readAttempts(db), [db]);
  const number = (value: number) => formatNumber(value, locale);

  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('settings.sync.log')}</h2>
      <p className={styles.muted}>{t('settings.sync.logIntro')}</p>
      {attempts?.length === 0 && <p>{t('settings.sync.logEmpty')}</p>}
      {attempts && attempts.length > 0 && (
        <ol className={styles.list}>
          {attempts.map((attempt) => (
            <li key={attempt.id} className={styles.item}>
              <div className={styles.itemHead}>
                <span>
                  {formatDate(new Date(attempt.at), locale, {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  })}
                </span>
                <span className={cx(styles.result, attempt.ok ? styles.ok : styles.failed)}>
                  {attempt.ok
                    ? t('settings.sync.ok')
                    : t(errorKeyOf(attempt.error ?? 'client-error'))}
                </span>
              </div>
              <span className={styles.muted}>
                {t('settings.sync.logDetails', {
                  sent: number(attempt.sent),
                  received: number(attempt.received),
                  seconds: formatNumber(attempt.durationMs / 1000, locale, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }),
                })}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

type BackupsState =
  | { kind: 'loading' }
  | { kind: 'ready'; backups: BackupSummary[] }
  | { kind: 'failed'; messageKey: ReturnType<typeof errorKeyOf> };

function ServerBackups({ download }: { download: (file: ExportFile) => void }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const engine = useSyncEngine();
  const { hasKey } = useSyncState();
  const toast = useToast();
  const [list, setList] = useState<BackupsState>({ kind: 'loading' });
  /** Bumped by "Refresh" to load the list again. */
  const [version, setVersion] = useState(0);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hasKey) return;
    let active = true;
    engine.listBackups().then(
      ({ backups }) => {
        if (active) setList({ kind: 'ready', backups });
      },
      (error: unknown) => {
        if (active) setList({ kind: 'failed', messageKey: errorKeyOf(toSyncError(error).code) });
      },
    );
    return () => {
      active = false;
    };
  }, [engine, hasKey, version]);

  function refresh() {
    setList({ kind: 'loading' });
    setVersion((v) => v + 1);
  }

  async function downloadBackup(date: string) {
    try {
      download(serverBackupFile(await engine.getBackup(date)));
    } catch (error) {
      toast.show({ message: t(errorKeyOf(toSyncError(error).code)), tone: 'danger' });
    }
  }

  async function restore(date: string) {
    setRestoring(null);
    setBusy(true);
    try {
      const changed = await engine.restore(date);
      toast.show({
        message: t('settings.sync.restored', { total: formatNumber(changed, locale) }),
        tone: 'success',
      });
    } catch {
      toast.show({ message: t('settings.sync.restoreFailed'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('settings.sync.backups')}</h2>
      <p className={styles.muted}>{t('settings.sync.backupsIntro')}</p>
      {!hasKey ? (
        <p>{t('settings.sync.backupsNoKey')}</p>
      ) : (
        <>
          {list.kind === 'loading' && <p role="status">{t('settings.sync.backupsLoading')}</p>}
          {list.kind === 'failed' && <p className={styles.failed}>{t(list.messageKey)}</p>}
          {list.kind === 'ready' && list.backups.length === 0 && (
            <p>{t('settings.sync.backupsEmpty')}</p>
          )}
          {list.kind === 'ready' && list.backups.length > 0 && (
            <ul className={styles.list}>
              {list.backups.map((backup) => {
                const date = longDate(backup.date, locale);
                return (
                  <li key={backup.date} className={styles.item}>
                    <div className={styles.itemHead}>
                      <span className={styles.date}>{date}</span>
                      <span className={styles.muted}>
                        {backup.count === null
                          ? t('settings.sync.recordsUnknown')
                          : t('settings.sync.records', {
                              count: backup.count,
                              total: formatNumber(backup.count, locale),
                            })}
                      </span>
                    </div>
                    <div className={styles.actions}>
                      <Button
                        variant="secondary"
                        icon="download"
                        aria-label={t('settings.sync.downloadLabel', { date })}
                        onClick={() => {
                          void downloadBackup(backup.date);
                        }}
                      >
                        {t('settings.sync.download')}
                      </Button>
                      <Button
                        variant="secondary"
                        icon="refresh"
                        disabled={busy}
                        aria-label={t('settings.sync.restoreLabel', { date })}
                        onClick={() => {
                          setRestoring(backup.date);
                        }}
                      >
                        {t('settings.sync.restore')}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div>
            <Button variant="secondary" disabled={list.kind === 'loading'} onClick={refresh}>
              {t('settings.sync.refresh')}
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={restoring !== null}
        title={t('settings.sync.restoreTitle', {
          date: restoring === null ? '' : longDate(restoring, locale),
        })}
        message={t('settings.sync.restoreMessage')}
        confirmLabel={t('settings.sync.restore')}
        cancelLabel={t('settings.sync.cancel')}
        destructive
        onConfirm={() => {
          if (restoring !== null) void restore(restoring);
        }}
        onCancel={() => {
          setRestoring(null);
        }}
      />
    </Card>
  );
}

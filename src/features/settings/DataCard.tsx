import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecordType } from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import { getStorageStatus, type StorageLike, type StorageStatus } from '../../data/persistence';
import { countLiveRecords, countPending } from '../../data/queries';
import { formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { Card } from '../../ui/Card';
import styles from './DataCard.module.css';

/** Rows shown, in order. Synced settings are a single record and are not listed. */
const COUNTED_TYPES = [
  'exercise',
  'routine',
  'session',
  'set',
  'note',
  'activity',
  'bodyWeight',
  'weekPlan',
  'block',
  'blockLog',
  'weeklyMetric',
] as const satisfies readonly Exclude<RecordType, 'settings'>[];

const STORAGE_KEY = {
  persisted: 'persisted',
  'not-persisted': 'notPersisted',
  unsupported: 'unsupported',
} as const satisfies Record<StorageStatus, string>;

function useStorageStatus(storage: StorageLike | undefined): StorageStatus | 'checking' {
  const [status, setStatus] = useState<StorageStatus | 'checking'>('checking');
  useEffect(() => {
    let active = true;
    void getStorageStatus(storage).then((value) => {
      if (active) setStatus(value);
    });
    return () => {
      active = false;
    };
  }, [storage]);
  return status;
}

interface DataCardProps {
  /** `navigator.storage` by default; injectable for tests. */
  storage?: StorageLike;
}

/** What is stored on this device: counts per record type, pending sync and storage status. */
export function DataCard({ storage = navigator.storage }: DataCardProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const db = useDatabase();
  const summary = useLiveQuery(
    async () => ({ counts: await countLiveRecords(db), pending: await countPending(db) }),
    [db],
  );
  const storageStatus = useStorageStatus(storage);
  const number = (value: number) => formatNumber(value, locale);

  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('settings.data.title')}</h2>
      <p className={styles.intro}>{t('settings.data.intro')}</p>
      {summary ? (
        <dl className={styles.list} aria-label={t('settings.data.listLabel')}>
          {COUNTED_TYPES.map((type) => (
            <div key={type} className={styles.row}>
              <dt>{t(`settings.data.types.${type}`)}</dt>
              <dd className={styles.value}>{number(summary.counts[type])}</dd>
            </div>
          ))}
          <div className={styles.row}>
            <dt>{t('settings.data.pending')}</dt>
            <dd className={styles.value}>{number(summary.pending)}</dd>
          </div>
        </dl>
      ) : (
        <p className={styles.intro}>{t('settings.data.loading')}</p>
      )}
      <dl className={styles.list}>
        <div className={styles.row}>
          <dt>{t('settings.data.storage')}</dt>
          <dd className={styles.status}>
            {t(
              `settings.data.storageStatus.${storageStatus === 'checking' ? 'checking' : STORAGE_KEY[storageStatus]}`,
            )}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

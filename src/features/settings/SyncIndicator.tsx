import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useSyncState } from '../../data/sync/SyncContext';
import { formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { cx } from '../../ui/cx';
import { Icon } from '../../ui/Icon';
import { VisuallyHidden } from '../../ui/VisuallyHidden';
import styles from './SyncIndicator.module.css';
import { SYNC_ICON, syncLabelOf } from './syncText';

/** Header link to Settings showing the sync state and how many changes are waiting. */
export function SyncIndicator() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const state = useSyncState();
  const label = syncLabelOf(state);
  const status = t(`sync.status.${label}`);
  const pending = formatNumber(state.pending, locale);
  const name =
    state.pending > 0
      ? t('sync.indicatorPending', { status, pending })
      : t('sync.indicator', { status });
  // Announced once when it starts failing; silent while syncing normally.
  const announcement = label === 'offline' || label === 'error' ? name : '';

  return (
    <>
      <Link to="/settings" className={cx(styles.indicator, styles[label])} aria-label={name}>
        <Icon name={SYNC_ICON[label]} size={22} className={styles.icon} />
        {state.pending > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {pending}
          </span>
        )}
      </Link>
      <span role="status">
        <VisuallyHidden>{announcement}</VisuallyHidden>
      </span>
    </>
  );
}

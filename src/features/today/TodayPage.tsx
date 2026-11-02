import { useTranslation } from 'react-i18next';
import { formatDate } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { EmptyState } from '../../ui/EmptyState';
import { Tag } from '../../ui/Tag';
import styles from './TodayPage.module.css';

export function TodayPage() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const today = formatDate(new Date(), locale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className={styles.page}>
      <p className={styles.date}>{today}</p>
      <EmptyState
        icon="today"
        title={t('pages.today.title')}
        description={t('pages.today.text')}
        action={<Tag tone="accent">{t('pages.comingSoon')}</Tag>}
      />
    </div>
  );
}

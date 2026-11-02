import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../ui/EmptyState';
import { Tag } from '../../ui/Tag';

export function CalendarPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon="calendar"
      title={t('pages.calendar.title')}
      description={t('pages.calendar.text')}
      action={<Tag tone="accent">{t('pages.comingSoon')}</Tag>}
    />
  );
}

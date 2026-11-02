import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../ui/EmptyState';
import { Tag } from '../../ui/Tag';

export function RoutinesPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon="routines"
      title={t('pages.routines.title')}
      description={t('pages.routines.text')}
      action={<Tag tone="accent">{t('pages.comingSoon')}</Tag>}
    />
  );
}

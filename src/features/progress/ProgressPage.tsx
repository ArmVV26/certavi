import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../ui/EmptyState';
import { Tag } from '../../ui/Tag';

export function ProgressPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon="progress"
      title={t('pages.progress.title')}
      description={t('pages.progress.text')}
      action={<Tag tone="accent">{t('pages.comingSoon')}</Tag>}
    />
  );
}

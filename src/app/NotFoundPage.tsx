import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClasses } from '../ui/buttonClasses';
import { EmptyState } from '../ui/EmptyState';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon="info"
      title={t('notFound.title')}
      description={t('notFound.text')}
      action={
        <Link to="/" className={buttonClasses({ variant: 'secondary' })}>
          {t('notFound.back')}
        </Link>
      }
    />
  );
}

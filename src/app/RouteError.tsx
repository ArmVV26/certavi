import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useRouteError } from 'react-router';
import { Button } from '../ui/Button';
import { buttonClasses } from '../ui/buttonClasses';
import { EmptyState } from '../ui/EmptyState';
import styles from './ErrorScreens.module.css';

/**
 * What a screen shows when it cannot be rendered: a code error, a read from the database that
 * failed, or (since screens load on demand) a file that could not be downloaded, typically with
 * no network or just after a new version was published. The header and tab bar stay usable.
 */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  useEffect(() => {
    console.error('Screen failed', error);
  }, [error]);

  return (
    <EmptyState
      icon="warning"
      title={t('errors.routeTitle')}
      description={t('errors.routeText')}
      action={
        <div className={styles.actions}>
          <Button
            onClick={() => {
              window.location.reload();
            }}
          >
            {t('errors.retry')}
          </Button>
          <Link to="/" className={buttonClasses({ variant: 'secondary' })}>
            {t('notFound.back')}
          </Link>
        </div>
      }
    />
  );
}

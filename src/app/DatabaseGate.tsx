import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import styles from './ErrorScreens.module.css';

interface DatabaseGateProps {
  /** Resolves to false when the local database could not be started (see main.tsx). */
  started: Promise<boolean>;
  children: ReactNode;
}

/**
 * The app renders right away (screens read the database live and fill in as the seed is
 * written); if starting the database fails, nothing can be saved or shown, so it is replaced by
 * a message instead of a screen that looks empty.
 */
export function DatabaseGate({ started, children }: DatabaseGateProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    void started.then((ok) => {
      if (current && !ok) setFailed(true);
    });
    return () => {
      current = false;
    };
  }, [started]);

  return failed ? <DatabaseError /> : children;
}

function DatabaseError() {
  const { t } = useTranslation();
  return (
    <main className={styles.screen}>
      <EmptyState
        icon="warning"
        title={t('errors.databaseTitle')}
        description={t('errors.databaseText')}
        action={
          <Button
            onClick={() => {
              window.location.reload();
            }}
          >
            {t('errors.retry')}
          </Button>
        }
      />
    </main>
  );
}

import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import styles from './UpdatePrompt.module.css';
import { useAppUpdate } from './useAppUpdate';

/**
 * Banner under the header when a new version of the app is waiting. It stays until the user
 * answers (a toast would vanish in a few seconds, and nobody looks at the phone between sets);
 * the page is never reloaded without the user's go-ahead.
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const { updateAvailable, update, dismiss } = useAppUpdate();

  if (!updateAvailable) return null;
  return (
    <div className={styles.prompt} role="status">
      <Icon name="refresh" size={20} />
      <p className={styles.message}>{t('pwa.updateAvailable')}</p>
      <div className={styles.actions}>
        <Button size="md" onClick={update}>
          {t('pwa.update')}
        </Button>
        <Button size="md" variant="ghost" onClick={dismiss}>
          {t('pwa.later')}
        </Button>
      </div>
    </div>
  );
}

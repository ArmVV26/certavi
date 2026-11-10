import { useTranslation } from 'react-i18next';
import { APP_VERSION, REPOSITORY_URL } from '../../app/appInfo';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { Logo } from '../../ui/Logo';
import styles from './AboutCard.module.css';

/** "Acerca de": the logo, the name, the version and a link to the source code. */
export function AboutCard() {
  const { t } = useTranslation();
  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('settings.about.title')}</h2>
      <div className={styles.identity}>
        <Logo size={48} />
        <div className={styles.text}>
          <p className={styles.name}>Certavi</p>
          <p className={styles.version}>{t('settings.about.version', { version: APP_VERSION })}</p>
        </div>
      </div>
      <a className={styles.link} href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
        <span>{t('settings.about.source')}</span>
        <Icon name="chevronRight" size={20} />
      </a>
    </Card>
  );
}

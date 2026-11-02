import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useLocale } from '../../i18n/LocaleContext';
import { LOCALES } from '../../i18n/locale';
import { THEME_PREFERENCES } from '../../theme/theme';
import { THEME_ICON } from '../../theme/themeIcon';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { Segmented } from '../../ui/Segmented';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  const { t } = useTranslation();
  const { preference, setPreference } = useTheme();
  const { locale, setLocale } = useLocale();

  return (
    <div className={styles.page}>
      <Card element="section">
        <h2 className={styles.heading}>{t('settings.appearance')}</h2>
        <Segmented
          legend={t('settings.theme')}
          value={preference}
          onChange={setPreference}
          options={THEME_PREFERENCES.map((value) => ({
            value,
            label: t(`theme.${value}`),
            icon: THEME_ICON[value],
          }))}
        />
        <Segmented
          legend={t('settings.language')}
          value={locale}
          onChange={setLocale}
          options={LOCALES.map((value) => ({
            value,
            label: t(`settings.languageNames.${value}`),
          }))}
        />
      </Card>

      <Card element="section">
        <h2 className={styles.heading}>{t('settings.developer')}</h2>
        <Link to="/dev/ui" className={styles.row}>
          <span>{t('settings.uiCatalog')}</span>
          <Icon name="chevronRight" size={20} />
        </Link>
      </Card>
    </div>
  );
}

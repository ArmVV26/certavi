import { useTranslation } from 'react-i18next';
import { IconButton } from '../ui/IconButton';
import { THEME_ICON } from './themeIcon';
import { useTheme } from './ThemeContext';

/** Header button: automatic → light → dark → automatic. Its label says the current theme. */
export function ThemeToggle() {
  const { t } = useTranslation();
  const { preference, cyclePreference } = useTheme();
  return (
    <IconButton
      icon={THEME_ICON[preference]}
      label={t(`theme.toggle.${preference}`)}
      variant="filled"
      onClick={cyclePreference}
    />
  );
}

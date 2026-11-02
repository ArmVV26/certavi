import type { IconName } from '../ui/Icon';
import type { ThemePreference } from './theme';

/** Icon for each theme preference (header button and Settings). */
export const THEME_ICON: Readonly<Record<ThemePreference, IconName>> = {
  system: 'themeAuto',
  light: 'sun',
  dark: 'moon',
};

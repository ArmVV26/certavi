import { addDays, parseIsoDate } from '../../domain';
import { formatDateRange } from '../../i18n/format';
import type { Locale } from '../../i18n/locale';

/** "2–8 nov": Monday to Sunday of the week that starts on `monday`. */
export function weekRange(monday: string, locale: Locale): string {
  return formatDateRange(parseIsoDate(monday), parseIsoDate(addDays(monday, 6)), locale);
}

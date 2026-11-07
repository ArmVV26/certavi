import type { TFunction } from 'i18next';
import { daysOf, type OptionalBlock, type Weekday } from '../../domain';
import { formatDate } from '../../i18n/format';
import type { Locale } from '../../i18n/locale';

/** The date of a weekday in a fixed Monday-first week, to name it with `Intl`. */
const dayOfWeek = (weekday: Weekday) => new Date(2026, 10, 1 + weekday);

/** "lunes" / "Monday". */
export const weekdayLong = (weekday: Weekday, locale: Locale) =>
  formatDate(dayOfWeek(weekday), locale, { weekday: 'long' });

/** "L" / "M": the initial the day buttons show. */
export const weekdayNarrow = (weekday: Weekday, locale: Locale) =>
  formatDate(dayOfWeek(weekday), locale, { weekday: 'narrow' });

/** "8 ejercicios · todos los días", "Sin ejercicios · L, X, V"… */
export function blockSummary(
  t: TFunction,
  locale: Locale,
  block: Pick<OptionalBlock, 'items' | 'days'>,
): string {
  const exercises =
    block.items.length === 0
      ? t('blocksPage.noExercises')
      : t('blocksPage.exercises', { count: block.items.length });
  const days = daysOf(block.days);
  const when =
    days.kind === 'all'
      ? t('blocksPage.daysAll')
      : days.kind === 'none'
        ? t('blocksPage.daysNone')
        : days.days.map((day) => weekdayNarrow(day, locale)).join(', ');
  return t('blocksPage.summary', { exercises, days: when });
}

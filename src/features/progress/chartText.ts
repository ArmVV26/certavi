// Small helpers the progress charts share: numbers, dates and the x position of a day.
import { daysBetween, parseIsoDate } from '../../domain';
import { formatDate, formatNumber } from '../../i18n/format';
import type { Locale } from '../../i18n/locale';

/** Days since a fixed date: the horizontal position of a dated point. */
export function dayIndex(date: string): number {
  return daysBetween('2000-01-01', date);
}

/** A number with at most one decimal: "82,5". */
export function oneDecimal(value: number, locale: Locale): string {
  return formatNumber(value, locale, { maximumFractionDigits: 1 });
}

/** "12 nov" / "12 Nov". */
export function shortDate(date: string, locale: Locale): string {
  return formatDate(parseIsoDate(date), locale, { day: 'numeric', month: 'short' });
}

/** "2/11": day/month of a Monday, the label under a weekly column. */
export function dayMonth(date: string): string {
  const [, month = '', day = ''] = date.split('-');
  return `${String(Number(day))}/${String(Number(month))}`;
}

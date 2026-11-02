// Locale-aware formatting and parsing of numbers and dates (Spanish: decimal comma).
import { INTL_LOCALE } from './locale';
import type { Locale } from './locale';

export function formatNumber(
  value: number,
  locale: Locale,
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 2 },
): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], options).format(value);
}

export function formatDate(
  date: Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'long' },
): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], options).format(date);
}

/**
 * Number typed by the user, with a comma or a point as the decimal separator ("27,5", "27.5").
 * Returns null for empty or incomplete input ("", "-", ","). No thousands separators: weights,
 * reps and minutes never need them, and "1.000" would be ambiguous.
 */
export function parseDecimal(input: string): number | null {
  const text = input.trim().replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** True while the text can still become a number (used to filter keystrokes). */
export function isPartialDecimal(input: string, allowNegative: boolean): boolean {
  const pattern = allowNegative ? /^-?\d*[.,]?\d*$/ : /^\d*[.,]?\d*$/;
  return pattern.test(input);
}

/** Rounds to `digits` decimals without floating-point noise (27.499999 → 27.5). */
export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

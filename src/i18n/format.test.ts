import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateRange,
  formatNumber,
  isPartialDecimal,
  parseDecimal,
  roundTo,
} from './format';

describe('formatNumber', () => {
  it('uses a decimal comma in Spanish and a point in English', () => {
    expect(formatNumber(27.5, 'es')).toBe('27,5');
    expect(formatNumber(27.5, 'en')).toBe('27.5');
  });

  it('drops trailing zeros and keeps up to two decimals by default', () => {
    expect(formatNumber(30, 'es')).toBe('30');
    expect(formatNumber(2.125, 'es')).toBe('2,13');
  });

  it('formats 0 as a real value', () => {
    expect(formatNumber(0, 'es')).toBe('0');
  });

  it('accepts Intl options', () => {
    expect(formatNumber(1.5, 'es', { minimumFractionDigits: 2 })).toBe('1,50');
  });
});

describe('formatDate', () => {
  const date = new Date(2026, 10, 2); // Monday 2 November 2026, local time

  it('formats in Spanish and English', () => {
    expect(formatDate(date, 'es')).toBe('2 de noviembre de 2026');
    expect(formatDate(date, 'en')).toBe('2 November 2026');
  });

  it('accepts Intl options', () => {
    const options = { weekday: 'long', day: 'numeric', month: 'long' } as const;
    expect(formatDate(date, 'es', options)).toBe('lunes, 2 de noviembre');
    expect(formatDate(date, 'en', options)).toBe('Monday 2 November');
  });
});

describe('formatDateRange', () => {
  it('formats a week in Spanish and English, within and across months', () => {
    // Intl uses thin and narrow no-break spaces around the dash; compare with plain spaces.
    const range = (a: Date, b: Date, l: 'es' | 'en') =>
      formatDateRange(a, b, l).replace(/\s/g, ' ');
    expect(range(new Date(2026, 10, 2), new Date(2026, 10, 8), 'es')).toBe('2–8 nov');
    expect(range(new Date(2026, 10, 2), new Date(2026, 10, 8), 'en')).toBe('2 – 8 Nov');
    expect(range(new Date(2026, 9, 26), new Date(2026, 10, 1), 'es')).toBe('26 oct – 1 nov');
  });
});

describe('parseDecimal', () => {
  it.each([
    ['27,5', 27.5],
    ['27.5', 27.5],
    ['0', 0],
    ['0,0', 0],
    [' 12 ', 12],
    [',5', 0.5],
    ['27,', 27],
    ['-2,5', -2.5],
  ])('parses %j as %d', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it.each(['', '  ', '-', ',', 'abc', '1,2,3', '1.000,5', '2e3'])('rejects %j', (input) => {
    expect(parseDecimal(input)).toBeNull();
  });
});

describe('isPartialDecimal', () => {
  it('accepts text that can still become a number', () => {
    for (const text of ['', '2', '27,', '27,5', ',5', '27.5']) {
      expect(isPartialDecimal(text, false), text).toBe(true);
    }
  });

  it('rejects letters, a second separator and a minus when negatives are not allowed', () => {
    expect(isPartialDecimal('2a', false)).toBe(false);
    expect(isPartialDecimal('2,5,', false)).toBe(false);
    expect(isPartialDecimal('-2', false)).toBe(false);
    expect(isPartialDecimal('-2', true)).toBe(true);
  });
});

describe('roundTo', () => {
  it('removes floating-point noise', () => {
    expect(roundTo(0.1 + 0.2, 2)).toBe(0.3);
    expect(roundTo(27.499999, 2)).toBe(27.5);
    expect(roundTo(2.345, 2)).toBe(2.35);
  });
});

import { describe, expect, it } from 'vitest';
import { LOCALE_STORAGE_KEY, isLocale, readLocale, toLocale, writeLocale } from './locale';

describe('locale', () => {
  it('recognises only the supported languages', () => {
    expect(isLocale('es')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('maps language tags to a supported locale, Spanish by default', () => {
    expect(toLocale('en-US')).toBe('en');
    expect(toLocale('es')).toBe('es');
    expect(toLocale('fr-FR')).toBe('es');
    expect(toLocale(undefined)).toBe('es');
  });

  it('defaults to Spanish and remembers the chosen language', () => {
    expect(readLocale(localStorage)).toBe('es');
    expect(writeLocale(localStorage, 'en')).toBe(true);
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(readLocale(localStorage)).toBe('en');
  });

  it('ignores an invalid saved language', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'de');
    expect(readLocale(localStorage)).toBe('es');
  });
});

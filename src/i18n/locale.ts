// App language. Spanish by default; English optional. Device-only setting (never synced).
import { readDeviceSetting, writeDeviceSetting } from '../data/deviceStorage';
import type { ReadableStorage, WritableStorage } from '../data/deviceStorage';

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'es';
export const LOCALE_STORAGE_KEY = 'certavi.locale';

/** BCP 47 tags used with Intl: Spain for Spanish, British English (day-month order, metric). */
export const INTL_LOCALE: Readonly<Record<Locale, string>> = {
  es: 'es-ES',
  en: 'en-GB',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Maps any language tag (e.g. "en-US") to a supported locale, defaulting to Spanish. */
export function toLocale(language: string | undefined): Locale {
  const base = language?.split('-')[0];
  return isLocale(base) ? base : DEFAULT_LOCALE;
}

export function readLocale(storage: ReadableStorage | null): Locale {
  return readDeviceSetting(storage, LOCALE_STORAGE_KEY, isLocale, DEFAULT_LOCALE);
}

export function writeLocale(storage: WritableStorage | null, locale: Locale): boolean {
  return writeDeviceSetting(storage, LOCALE_STORAGE_KEY, locale);
}

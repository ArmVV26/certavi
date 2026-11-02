// i18next setup. Resources are bundled (no network), so initialisation is synchronous.
import i18next from 'i18next';
import type { i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import es from './es.json';
import { DEFAULT_LOCALE, LOCALES } from './locale';
import type { Locale } from './locale';

export const resources = {
  es: { translation: es },
  en: { translation: en },
} as const;

/** A fresh, ready-to-use i18next instance (one per app; tests create their own). */
export function createI18n(locale: Locale): I18n {
  const instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: LOCALES,
    initAsync: false,
    // React already escapes output.
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}

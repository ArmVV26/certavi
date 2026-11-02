import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { i18n as I18n } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { getLocalStorage } from '../data/deviceStorage';
import { createI18n } from './index';
import { LocaleContext } from './LocaleContext';
import type { LocaleContextValue } from './LocaleContext';
import { readLocale, toLocale, writeLocale } from './locale';
import type { Locale } from './locale';

interface I18nProviderProps {
  children: ReactNode;
  /** Tests pass their own instance; the app creates one from the saved language. */
  i18n?: I18n;
}

export function I18nProvider({ children, i18n }: I18nProviderProps) {
  const [instance] = useState(() => i18n ?? createI18n(readLocale(getLocalStorage(window))));
  const [locale, setLocaleState] = useState<Locale>(() => toLocale(instance.language));

  // Screen readers and hyphenation need the right <html lang>.
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      void instance.changeLanguage(next);
      setLocaleState(next);
      writeLocale(getLocalStorage(window), next);
    },
    [instance],
  );

  const value = useMemo<LocaleContextValue>(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <I18nextProvider i18n={instance}>
      <LocaleContext value={value}>{children}</LocaleContext>
    </I18nextProvider>
  );
}

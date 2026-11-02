// Renders UI with the app providers (theme, language, toasts), as the app does.
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { createI18n } from '../i18n';
import { I18nProvider } from '../i18n/I18nProvider';
import type { Locale } from '../i18n/locale';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ToastProvider } from '../ui/ToastProvider';

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  locale?: Locale;
}

export function renderWithProviders(
  ui: ReactElement,
  { locale = 'es', ...options }: RenderWithProvidersOptions = {},
) {
  const i18n = createI18n(locale);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider>
        <I18nProvider i18n={i18n}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    );
  }
  return { i18n, ...render(ui, { wrapper: Wrapper, ...options }) };
}

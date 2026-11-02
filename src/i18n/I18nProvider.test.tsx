import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTranslation } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from './I18nProvider';
import { useLocale } from './LocaleContext';
import { LOCALE_STORAGE_KEY } from './locale';

function Probe() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  return (
    <div>
      <p>{t('nav.today')}</p>
      <button
        type="button"
        onClick={() => {
          setLocale(locale === 'es' ? 'en' : 'es');
        }}
      >
        {t('settings.language')}
      </button>
    </div>
  );
}

describe('I18nProvider', () => {
  it('starts in Spanish and sets <html lang="es">', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByText('Hoy')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('es');
  });

  it('switches to English, updates <html lang> and remembers it', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Idioma' }));

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Language' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
  });

  it('restores the saved language on start (reload)', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });
});

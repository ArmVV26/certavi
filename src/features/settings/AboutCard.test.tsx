import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, REPOSITORY_URL } from '../../app/appInfo';
import { renderWithProviders } from '../../test/render';
import { AboutCard } from './AboutCard';

describe('AboutCard', () => {
  it('shows the name, the version of package.json and a link to the source', () => {
    renderWithProviders(<AboutCard />);
    expect(screen.getByRole('heading', { name: 'Acerca de' })).toBeInTheDocument();
    expect(screen.getByText('Certavi')).toBeInTheDocument();
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    expect(screen.getByText(`Versión ${APP_VERSION}`)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: 'Código fuente en GitHub' });
    expect(link).toHaveAttribute('href', REPOSITORY_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('is written in English too', () => {
    renderWithProviders(<AboutCard />, { locale: 'en' });
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByText(`Version ${APP_VERSION}`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Source code on GitHub' })).toBeInTheDocument();
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { formatDate } from '../i18n/format';
import { setSystemDark } from '../test/matchMedia';
import { openTestDatabase } from '../test/render';
import { renderApp } from '../test/renderApp';
import { App } from './App';
import { Providers } from './Providers';

const heading = () => screen.getByRole('heading', { level: 1 });
const nav = () => screen.getByRole('navigation', { name: 'Principal' });

describe('App', () => {
  it('opens on Today with the providers and the browser router', () => {
    render(
      <Providers db={openTestDatabase()}>
        <App />
      </Providers>,
    );
    expect(heading()).toHaveTextContent('Hoy');
  });
});

describe('app shell', () => {
  it('shows Today first, in Spanish, with the date in Spanish', () => {
    renderApp('/');

    expect(heading()).toHaveTextContent('Hoy');
    expect(document.title).toBe('Hoy · Certavi');
    const date = formatDate(new Date(), 'es', { weekday: 'long', day: 'numeric', month: 'long' });
    expect(screen.getByText(date)).toBeInTheDocument();
  });

  it('has a main navigation with the five sections and marks the current one', () => {
    renderApp('/');
    const links = within(nav()).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual([
      'Hoy',
      'Calendario',
      'Rutinas',
      'Progreso',
      'Ajustes',
    ]);
    expect(within(nav()).getByRole('link', { name: 'Hoy' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it.each([
    ['/calendar', 'Calendario'],
    ['/routines', 'Rutinas'],
    ['/progress', 'Progreso'],
    ['/settings', 'Ajustes'],
    ['/dev/ui', 'Componentes'],
  ])('%s shows the title "%s"', (path, title) => {
    renderApp(path);
    expect(heading()).toHaveTextContent(title);
    expect(document.title).toBe(`${title} · Certavi`);
  });

  it('navigates with the tab bar and moves focus to the new title', async () => {
    const user = userEvent.setup();
    renderApp('/');

    await user.click(within(nav()).getByRole('link', { name: 'Calendario' }));

    expect(heading()).toHaveTextContent('Calendario');
    expect(heading()).toHaveFocus();
    expect(within(nav()).getByRole('link', { name: 'Calendario' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav()).getByRole('link', { name: 'Hoy' })).not.toHaveAttribute('aria-current');
  });

  it('does not link the component catalog from the tab bar', () => {
    renderApp('/');
    expect(within(nav()).queryByRole('link', { name: 'Componentes' })).not.toBeInTheDocument();
  });

  it('offers a skip link to the main content', () => {
    renderApp('/');
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('shows a not-found page with a way back to Today', async () => {
    const user = userEvent.setup();
    renderApp('/no-such-page');

    expect(heading()).toHaveTextContent('Página no encontrada');
    await user.click(screen.getByRole('link', { name: 'Volver a Hoy' }));
    expect(heading()).toHaveTextContent('Hoy');
  });
});

describe('language', () => {
  it('switches the whole UI to English from Settings and remembers it', async () => {
    const user = userEvent.setup();
    renderApp('/settings');

    await user.click(screen.getByRole('radio', { name: 'English' }));

    expect(heading()).toHaveTextContent('Settings');
    expect(document.title).toBe('Settings · Certavi');
    expect(document.documentElement.lang).toBe('en');
    const englishNav = screen.getByRole('navigation', { name: 'Main' });
    expect(
      within(englishNav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Today', 'Calendar', 'Routines', 'Progress', 'Settings']);
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(localStorage.getItem('certavi.locale')).toBe('en');
  });

  it('starts in English when English was saved', () => {
    localStorage.setItem('certavi.locale', 'en');
    renderApp('/', { locale: 'en' });
    expect(heading()).toHaveTextContent('Today');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeInTheDocument();
  });
});

describe('theme', () => {
  it('header button cycles automatic → light → dark → automatic', async () => {
    const user = userEvent.setup();
    setSystemDark(true);
    renderApp('/');
    const html = document.documentElement;

    const toggle = screen.getByRole('button', { name: 'Tema automático. Cambiar a claro' });
    expect(html.dataset.theme).toBe('dark');

    await user.click(toggle);
    expect(toggle).toHaveAccessibleName('Tema claro. Cambiar a oscuro');
    expect(html.dataset.theme).toBe('light');

    await user.click(toggle);
    expect(toggle).toHaveAccessibleName('Tema oscuro. Cambiar a automático');
    expect(html.dataset.theme).toBe('dark');

    await user.click(toggle);
    expect(toggle).toHaveAccessibleName('Tema automático. Cambiar a claro');
    expect(html.dataset.theme).toBe('dark');
  });

  it('can be chosen in Settings and stays in sync with the header button', async () => {
    const user = userEvent.setup();
    renderApp('/settings');

    expect(screen.getByRole('radio', { name: 'Automático' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Oscuro' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(
      screen.getByRole('button', { name: 'Tema oscuro. Cambiar a automático' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem('certavi.theme')).toBe('dark');
  });
});

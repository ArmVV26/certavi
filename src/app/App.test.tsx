import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createTestEngine } from '../data/sync/testing';
import { formatDate } from '../i18n/format';
import { setSystemDark } from '../test/matchMedia';
import { openTestDatabase, renderWithProviders } from '../test/render';
import { renderApp } from '../test/renderApp';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { App } from './App';
import { Layout } from './Layout';
import { Providers } from './Providers';
import { preloadScreens, routes } from './routes';

const heading = () => screen.getByRole('heading', { level: 1 });
const nav = () => screen.getByRole('navigation', { name: 'Principal' });

describe('App', () => {
  it('opens on Today with the providers and the browser router', () => {
    const db = openTestDatabase();
    render(
      <Providers db={db} sync={createTestEngine(db, { key: null }).engine}>
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
  ])('%s shows the title "%s"', (path, title) => {
    renderApp(path);
    expect(heading()).toHaveTextContent(title);
    expect(document.title).toBe(`${title} · Certavi`);
  });

  // Every screen but Today and the session is a lazy route: its file is downloaded when it is
  // opened. renderApp loads them beforehand, so this test uses the real route table, untouched.
  it.each([
    ['/calendar', 'Calendario'],
    ['/settings/sync', 'Sincronización'],
    ['/dev/ui', 'Componentes'],
  ])('%s loads its screen on demand', async (path, title) => {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    renderWithProviders(<RouterProvider router={router} />);
    await waitFor(() => {
      expect(heading()).toHaveTextContent(title);
    });
    // The tab title is set by an effect right after the heading is drawn: wait for it too.
    await waitFor(() => {
      expect(document.title).toBe(`${title} · Certavi`);
    });
  });

  it('shows a progress line while the next screen is still loading, so a tap never looks ignored', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <Layout />,
          children: [
            { index: true, element: <p>inicio</p>, handle: { titleKey: 'nav.today' } },
            {
              path: 'calendar',
              handle: { titleKey: 'nav.calendar' },
              lazy: async () => {
                await gate;
                return { Component: () => <p>pantalla del calendario</p> };
              },
            },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );
    renderWithProviders(<RouterProvider router={router} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    await user.click(within(nav()).getByRole('link', { name: 'Calendario' }));
    expect(
      await screen.findByRole('progressbar', { name: 'Abriendo la pantalla' }),
    ).toBeInTheDocument();

    release();
    expect(await screen.findByText('pantalla del calendario')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('can download every screen ahead of time without throwing', () => {
    expect(() => {
      preloadScreens();
    }).not.toThrow();
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

  it('shows the logo as decoration, to the left of the title', () => {
    renderApp('/');
    const header = heading().closest('header');
    const logo = header?.querySelector('svg');
    expect(logo).toHaveAttribute('aria-hidden', 'true');
    // Before the title in reading order, and it adds no name of its own to the header.
    expect(logo?.compareDocumentPosition(heading())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(header as HTMLElement).queryByRole('img')).not.toBeInTheDocument();
    expect(within(header as HTMLElement).queryByRole('link', { name: /certavi/i })).toBeNull();
  });

  it('fades a section in when it opens, but not the first page', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const main = () => screen.getByRole('main');
    expect(main().className).not.toMatch(/arriving/);

    await user.click(within(nav()).getByRole('link', { name: 'Calendario' }));

    expect(main().className).toMatch(/arriving/);
    expect(heading()).toHaveTextContent('Calendario');
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

  it('turns the whole app to greys from a switch in Settings, and keeps the theme button', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    const html = document.documentElement;
    const mono = screen.getByRole('switch', { name: 'Sin color (modo 0 dopamina)' });
    expect(mono).not.toBeChecked();
    expect(mono).toHaveAccessibleDescription(
      'Todo en blanco, negro y gris, sobre el tema claro u oscuro.',
    );

    await user.click(mono);
    expect(mono).toBeChecked();
    expect(html).toHaveAttribute('data-mono');
    expect(localStorage.getItem('certavi.mono')).toBe('on');
    // The theme still cycles on top of it.
    await user.click(screen.getByRole('button', { name: /^Tema .*Cambiar a/ }));
    expect(html).toHaveAttribute('data-mono');

    await user.click(mono);
    expect(html).not.toHaveAttribute('data-mono');
  });
});

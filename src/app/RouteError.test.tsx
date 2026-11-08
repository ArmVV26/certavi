import { screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { RouteError } from './RouteError';
import { Layout } from './Layout';

function renderBrokenScreen(locale: 'es' | 'en' = 'es') {
  const Broken = () => {
    throw new Error('boom');
  };
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Layout />,
        children: [
          { errorElement: <RouteError />, children: [{ index: true, element: <Broken /> }] },
        ],
        handle: { titleKey: 'nav.today' },
      },
    ],
    { initialEntries: ['/'] },
  );
  return renderWithProviders(<RouterProvider router={router} />, { locale });
}

describe('RouteError', () => {
  it('replaces a broken screen with a message and keeps the navigation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderBrokenScreen();
    expect(
      await screen.findByRole('heading', { name: 'No se pudo mostrar esta pantalla' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Volver a Hoy' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeVisible();
  });

  it('is translated to English', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderBrokenScreen('en');
    expect(
      await screen.findByRole('heading', { name: 'This screen could not be shown' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

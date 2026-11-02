// Renders the whole app (real routes and layout) with an in-memory router.
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '../app/routes';
import { renderWithProviders } from './render';
import type { RenderWithProvidersOptions } from './render';

export function renderApp(path = '/', options: RenderWithProvidersOptions = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return { router, ...renderWithProviders(<RouterProvider router={router} />, options) };
}

// Renders the whole app (real routes and layout) with an in-memory router.
import type { RouteObject } from 'react-router';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '../app/routes';
import { renderWithProviders } from './render';
import type { RenderWithProvidersOptions } from './render';

/**
 * The same route table the app uses, with every `lazy` screen already loaded: in production the
 * screens are downloaded on first visit, but tests render synchronously and look for the screen
 * right away. Loading them once, when this module is imported, keeps those tests simple; the lazy
 * loading itself is covered in src/app/App.test.tsx.
 */
async function loadLazyRoutes(list: RouteObject[]): Promise<RouteObject[]> {
  return Promise.all(
    list.map(async (route) => {
      const { lazy, children, ...rest } = route;
      const loaded = typeof lazy === 'function' ? await lazy() : {};
      const resolved = { ...rest, ...loaded } as RouteObject;
      if (children) resolved.children = await loadLazyRoutes(children);
      return resolved;
    }),
  );
}

const loadedRoutes = await loadLazyRoutes(routes);

export function renderApp(path = '/', options: RenderWithProvidersOptions = {}) {
  const router = createMemoryRouter(loadedRoutes, { initialEntries: [path] });
  return { router, ...renderWithProviders(<RouterProvider router={router} />, options) };
}

import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';
import { SessionPage } from '../features/session/SessionPage';
import { TodayPage } from '../features/today/TodayPage';
import { Layout } from './Layout';
import type { RouteHandle } from './navigation';
import { NotFoundPage } from './NotFoundPage';
import { RouteError } from './RouteError';

/**
 * A route whose screen is a separate file, downloaded the first time it is opened (the service
 * worker precaches it, so it also works offline). Today and the session stay in the main file:
 * they are what the app opens on, and the one used in the gym.
 */
function lazyPage<M extends Record<string, ComponentType>>(
  load: () => Promise<M>,
  name: keyof M,
): Pick<RouteObject, 'lazy'> {
  screenLoaders.push(load);
  return { lazy: async () => ({ Component: (await load())[name] }) };
}

const screenLoaders: (() => Promise<unknown>)[] = [];

/**
 * Downloads every screen that is not in the main file, in the background. After this, moving
 * between sections never waits for the network (or for the service worker): in the gym, with no
 * coverage, a tap on a tab must not depend on a file that has not arrived yet. A failed download
 * is ignored here; opening that screen tries again and shows the error if it still fails.
 */
export function preloadScreens(): void {
  for (const load of screenLoaders) load().catch(() => undefined);
}

const handle = (titleKey: RouteHandle['titleKey']): RouteHandle => ({ titleKey });

/** Every screen of the app. Each route's `handle.titleKey` is its header title. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    // A failure in the layout itself (the screens have their own, below): same message, no layout.
    errorElement: <RouteError />,
    // Shown while the first screen's file downloads when the app opens on a lazy route; the page
    // is blank for that moment (the service worker makes it instant once installed).
    HydrateFallback: () => null,
    children: [
      {
        // A pathless route, so a failing screen is replaced by the message while the layout (header
        // and tab bar) stays.
        errorElement: <RouteError />,
        children: [
          { index: true, element: <TodayPage />, handle: handle('nav.today') },
          { path: 'session/:sessionId', element: <SessionPage />, handle: handle('session.title') },
          {
            path: 'calendar',
            ...lazyPage(() => import('../features/calendar/CalendarPage'), 'CalendarPage'),
            handle: handle('nav.calendar'),
          },
          {
            path: 'routines',
            ...lazyPage(() => import('../features/routines/RoutinesPage'), 'RoutinesPage'),
            handle: handle('nav.routines'),
          },
          {
            path: 'routines/:routineId',
            ...lazyPage(() => import('../features/routines/RoutineViewPage'), 'RoutineViewPage'),
            handle: handle('routines.view.title'),
          },
          {
            path: 'routines/:routineId/edit',
            ...lazyPage(
              () => import('../features/routines/RoutineEditorPage'),
              'RoutineEditorPage',
            ),
            handle: handle('routines.edit.title'),
          },
          {
            path: 'exercises',
            ...lazyPage(() => import('../features/exercises/ExercisesPage'), 'ExercisesPage'),
            handle: handle('exercises.title'),
          },
          {
            path: 'exercises/new',
            ...lazyPage(() => import('../features/exercises/ExerciseFormPage'), 'ExerciseFormPage'),
            handle: handle('exercises.form.createTitle'),
          },
          {
            path: 'exercises/:exerciseId',
            ...lazyPage(
              () => import('../features/exercises/ExerciseDetailPage'),
              'ExerciseDetailPage',
            ),
            handle: handle('exercises.detail.title'),
          },
          {
            path: 'exercises/:exerciseId/edit',
            ...lazyPage(() => import('../features/exercises/ExerciseFormPage'), 'ExerciseFormPage'),
            handle: handle('exercises.form.editTitle'),
          },
          {
            path: 'progress',
            ...lazyPage(() => import('../features/progress/ProgressPage'), 'ProgressPage'),
            handle: handle('nav.progress'),
          },
          {
            path: 'settings',
            ...lazyPage(() => import('../features/settings/SettingsPage'), 'SettingsPage'),
            handle: handle('nav.settings'),
          },
          {
            path: 'settings/sync',
            ...lazyPage(() => import('../features/settings/SyncPage'), 'SyncPage'),
            handle: handle('settings.sync.title'),
          },
          {
            path: 'settings/blocks',
            ...lazyPage(() => import('../features/blocks/BlocksPage'), 'BlocksPage'),
            handle: handle('blocksPage.title'),
          },
          {
            path: 'settings/blocks/new',
            ...lazyPage(() => import('../features/blocks/BlockFormPage'), 'BlockFormPage'),
            handle: handle('blocksPage.newTitle'),
          },
          {
            path: 'settings/blocks/:blockId',
            ...lazyPage(() => import('../features/blocks/BlockTrackingPage'), 'BlockTrackingPage'),
            handle: handle('blocksPage.trackingTitle'),
          },
          {
            path: 'settings/blocks/:blockId/edit',
            ...lazyPage(() => import('../features/blocks/BlockFormPage'), 'BlockFormPage'),
            handle: handle('blocksPage.editTitle'),
          },
          // The condition is written out here (not imported from devUi.ts) so the bundler can see it is
          // false in production and drop the catalog's chunk.
          ...(import.meta.env.DEV || import.meta.env.MODE === 'e2e'
            ? [
                {
                  path: 'dev/ui',
                  lazy: () =>
                    import('../features/dev-ui/DevUiPage').then((m) => ({
                      Component: m.DevUiPage,
                    })),
                  handle: handle('devUi.title'),
                },
              ]
            : []),
          { path: '*', element: <NotFoundPage />, handle: handle('notFound.title') },
        ],
      },
    ],
  },
];

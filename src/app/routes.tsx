import type { RouteObject } from 'react-router';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { DevUiPage } from '../features/dev-ui/DevUiPage';
import { ProgressPage } from '../features/progress/ProgressPage';
import { RoutinesPage } from '../features/routines/RoutinesPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { TodayPage } from '../features/today/TodayPage';
import { Layout } from './Layout';
import type { RouteHandle } from './navigation';
import { NotFoundPage } from './NotFoundPage';

const handle = (titleKey: RouteHandle['titleKey']): RouteHandle => ({ titleKey });

/** Every screen of the app. Each route's `handle.titleKey` is its header title. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <TodayPage />, handle: handle('nav.today') },
      { path: 'calendar', element: <CalendarPage />, handle: handle('nav.calendar') },
      { path: 'routines', element: <RoutinesPage />, handle: handle('nav.routines') },
      { path: 'progress', element: <ProgressPage />, handle: handle('nav.progress') },
      { path: 'settings', element: <SettingsPage />, handle: handle('nav.settings') },
      { path: 'dev/ui', element: <DevUiPage />, handle: handle('devUi.title') },
      { path: '*', element: <NotFoundPage />, handle: handle('notFound.title') },
    ],
  },
];

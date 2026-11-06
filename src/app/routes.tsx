import type { RouteObject } from 'react-router';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { DevUiPage } from '../features/dev-ui/DevUiPage';
import { ExerciseDetailPage } from '../features/exercises/ExerciseDetailPage';
import { ExerciseFormPage } from '../features/exercises/ExerciseFormPage';
import { ExercisesPage } from '../features/exercises/ExercisesPage';
import { ProgressPage } from '../features/progress/ProgressPage';
import { RoutineEditorPage } from '../features/routines/RoutineEditorPage';
import { RoutinesPage } from '../features/routines/RoutinesPage';
import { RoutineViewPage } from '../features/routines/RoutineViewPage';
import { SessionPage } from '../features/session/SessionPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { SyncPage } from '../features/settings/SyncPage';
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
      { path: 'session/:sessionId', element: <SessionPage />, handle: handle('session.title') },
      { path: 'calendar', element: <CalendarPage />, handle: handle('nav.calendar') },
      { path: 'routines', element: <RoutinesPage />, handle: handle('nav.routines') },
      {
        path: 'routines/:routineId',
        element: <RoutineViewPage />,
        handle: handle('routines.view.title'),
      },
      {
        path: 'routines/:routineId/edit',
        element: <RoutineEditorPage />,
        handle: handle('routines.edit.title'),
      },
      { path: 'exercises', element: <ExercisesPage />, handle: handle('exercises.title') },
      {
        path: 'exercises/new',
        element: <ExerciseFormPage />,
        handle: handle('exercises.form.createTitle'),
      },
      {
        path: 'exercises/:exerciseId',
        element: <ExerciseDetailPage />,
        handle: handle('exercises.detail.title'),
      },
      {
        path: 'exercises/:exerciseId/edit',
        element: <ExerciseFormPage />,
        handle: handle('exercises.form.editTitle'),
      },
      { path: 'progress', element: <ProgressPage />, handle: handle('nav.progress') },
      { path: 'settings', element: <SettingsPage />, handle: handle('nav.settings') },
      { path: 'settings/sync', element: <SyncPage />, handle: handle('settings.sync.title') },
      { path: 'dev/ui', element: <DevUiPage />, handle: handle('devUi.title') },
      { path: '*', element: <NotFoundPage />, handle: handle('notFound.title') },
    ],
  },
];

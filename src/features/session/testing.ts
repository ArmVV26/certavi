// Helpers for the tests of the session screen: opens a session in the real app.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toIsoDate, type PlanItem } from '../../domain';
import { makeSession } from '../../domain/testing/builders';
import type { CertaviDb } from '../../data/db';
import { createRepositories } from '../../data/repository';
import { ensureSeed } from '../../data/seed';
import type { SyncEngine } from '../../data/sync/engine';
import type { Locale } from '../../i18n/locale';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';

export const plan = (exerciseId: string, scheme: PlanItem['scheme']): PlanItem => ({
  exerciseId,
  scheme,
  optional: false,
});

export const todayIso = () => toIsoDate(new Date());

export interface OpenSessionOptions {
  db?: CertaviDb;
  items: PlanItem[];
  /** Default: today, so the session is "of today". */
  date?: string;
  routineId?: string | null;
  startedAt?: number;
  endedAt?: number | null;
  locale?: Locale;
  sync?: SyncEngine;
}

/** Stores session `s1` and opens it at /session/s1. */
export async function openSession({
  db: given,
  items,
  date = todayIso(),
  routineId = null,
  startedAt,
  endedAt = null,
  locale,
  sync,
}: OpenSessionOptions) {
  const db = given ?? openTestDatabase();
  if (!given) await ensureSeed(db);
  const repos = createRepositories(db);
  await repos.session.put(
    makeSession({
      id: 's1',
      date,
      routineId,
      startedAt: startedAt ?? new Date(`${date}T18:00:00`).getTime(),
      endedAt,
      items,
    }),
  );
  const user = userEvent.setup();
  const app = renderApp('/session/s1', {
    db,
    ...(locale ? { locale } : {}),
    ...(sync ? { sync } : {}),
  });
  await screen.findByRole('heading', { level: 2 });
  return { repos, user, ...app };
}

/** Queries inside the card of one exercise. */
export const cardOf = (name: string) => {
  const article = screen.getByRole('heading', { name, level: 3 }).closest('article');
  if (!article) throw new Error(`no card for ${name}`);
  return within(article);
};

/** Types weight and reps in a row and presses its ✓. */
export async function logRow(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  row: number | string,
  weight = '60',
  reps = '8',
) {
  // `row` is the label of the row: `1` for a normal set, `C1` for a warm-up.
  const scope = cardOf(name);
  await user.type(scope.getByLabelText(`Peso de la serie ${String(row)}`), weight);
  await user.type(scope.getByLabelText(`Repeticiones de la serie ${String(row)}`), reps);
  const buttons = scope.getAllByRole('button', { name: 'Marcar serie hecha' });
  const empty = buttons[0];
  if (!empty) throw new Error('no empty row');
  await user.click(empty);
}

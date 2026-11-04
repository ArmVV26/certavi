import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { makeSession } from '../../domain/testing/builders';
import { createRepositories } from '../../data/repository';
import { ensureSeed } from '../../data/seed';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';

async function seededDb() {
  const db = openTestDatabase();
  await ensureSeed(db);
  return db;
}

describe('SessionPage', () => {
  it('shows a routine session with its date, state and plan', async () => {
    const db = await seededDb();
    const pull = await db.routines.get('pull');
    await createRepositories(db).session.put(
      makeSession({
        id: 's1',
        date: '2026-11-03',
        routineId: 'pull',
        startedAt: new Date(2026, 10, 3, 18, 0).getTime(),
        endedAt: new Date(2026, 10, 3, 19, 15).getTime(),
        items: pull && !pull.deleted ? pull.items : [],
      }),
    );
    renderApp('/session/s1', { db });

    expect(await screen.findByRole('heading', { name: 'Pull', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sesión');
    expect(screen.getByText('martes, 3 de noviembre · 18:00')).toBeInTheDocument();
    expect(screen.getByText('Terminada')).toBeInTheDocument();
    expect(screen.getByText('8 ejercicios · 23 series')).toBeInTheDocument();
    expect(screen.getByText('Remo en T · 3 series')).toBeInTheDocument();
    expect(screen.getByText('(opcional)')).toBeInTheDocument();
    expect(screen.getByText('Registrar series, temporizador y notas.')).toBeInTheDocument();
  });

  it('shows a free session without a start time and without exercises', async () => {
    const db = await seededDb();
    await createRepositories(db).session.put(makeSession({ id: 'free', date: '2026-11-03' }));
    renderApp('/session/free', { db });
    expect(await screen.findByRole('heading', { name: 'Sesión libre' })).toBeInTheDocument();
    expect(screen.getByText('martes, 3 de noviembre')).toBeInTheDocument();
    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(screen.getByText('Sin ejercicios todavía.')).toBeInTheDocument();
  });

  it('falls back to "Sesión libre" when the routine was deleted', async () => {
    const db = await seededDb();
    const repos = createRepositories(db);
    await repos.session.put(makeSession({ id: 's2', date: '2026-11-03', routineId: 'upper' }));
    await repos.routine.remove('upper');
    renderApp('/session/s2', { db });
    expect(await screen.findByRole('heading', { name: 'Sesión libre' })).toBeInTheDocument();
  });

  it('says when the session does not exist and links back to Today', async () => {
    const user = userEvent.setup();
    renderApp('/session/does-not-exist', { db: await seededDb() });
    expect(await screen.findByRole('heading', { name: 'Sesión no encontrada' })).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Volver a Hoy' }));
    expect(await screen.findByRole('heading', { name: 'La sesión de hoy' })).toBeInTheDocument();
  });

  it('reads in English', async () => {
    const db = await seededDb();
    await createRepositories(db).session.put(makeSession({ id: 'free', date: '2026-11-03' }));
    renderApp('/session/free', { db, locale: 'en' });
    expect(await screen.findByRole('heading', { name: 'Free session' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Session');
    expect(screen.getByText('Tuesday 3 November')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });
});

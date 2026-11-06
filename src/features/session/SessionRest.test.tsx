import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { straightSets, topBackoff, type SetEntry } from '../../domain';
import { makeSet } from '../../domain/testing/builders';
import { createTestEngine } from '../../data/sync/testing';
import { openTestDatabase } from '../../test/render';
import { ensureSeed } from '../../data/seed';
import { cardOf, logRow, openSession, plan } from './testing';

beforeEach(() => {
  localStorage.clear();
});

const ITEMS = [plan('remo-t', topBackoff(2)), plan('aperturas-maquina', straightSets('10-15', 2))];

const bar = () => screen.queryByRole('region', { name: 'Descanso' });
const barQueries = () => {
  const region = bar();
  if (!region) throw new Error('the rest bar is not showing');
  return within(region);
};

describe('the rest timer', () => {
  it('starts after a new set with the time of the row, and says what comes next', async () => {
    const { user } = await openSession({ items: ITEMS });
    expect(bar()).not.toBeInTheDocument();

    // Top set of a basic exercise: 180 s + 30 s.
    await logRow(user, 'Remo en T', 1);
    expect(await screen.findByRole('region', { name: 'Descanso' })).toBeInTheDocument();
    expect(barQueries().getByText('3:30')).toBeInTheDocument();
    expect(barQueries().getByText('Siguiente: Remo en T')).toBeInTheDocument();

    // Back-off of a basic exercise: 180 s. Saving again restarts the rest.
    await logRow(user, 'Remo en T', 2);
    await waitFor(() => {
      expect(barQueries().getByText('3:00')).toBeInTheDocument();
    });

    // Any row of an isolation exercise: 120 s.
    await logRow(user, 'Aperturas en máquina', 1);
    await waitFor(() => {
      expect(barQueries().getByText('2:00')).toBeInTheDocument();
    });
    expect(barQueries().getByText('Siguiente: Aperturas en máquina')).toBeInTheDocument();
  });

  it('rests 60 s after a warm-up', async () => {
    const { user } = await openSession({ items: ITEMS });
    await user.click(
      cardOf('Aperturas en máquina').getByRole('button', { name: '+ Calentamiento' }),
    );
    // The repaint goes after the click: wait for the new row before typing in it.
    await cardOf('Aperturas en máquina').findByLabelText('Peso de la serie C1');
    await logRow(user, 'Aperturas en máquina', 'C1', '20', '10');
    expect(await screen.findByText('1:00')).toBeInTheDocument();
  });

  it('starts when ✓ is pressed on an empty row that saves "Anterior"', async () => {
    const { db, user } = await openSession({ items: ITEMS });
    await db.sessions.put({
      id: 'old',
      type: 'session',
      updatedAt: 1,
      date: '2026-10-20',
      routineId: null,
      startedAt: new Date(2026, 9, 20, 18).getTime(),
      endedAt: new Date(2026, 9, 20, 19).getTime(),
      items: ITEMS,
      note: '',
      readiness: null,
    });
    await db.sets.put(
      makeSet({
        sessionId: 'old',
        exerciseId: 'aperturas-maquina',
        slot: 0,
        weight: 40,
        reps: 12,
        completedAt: 1,
      }),
    );
    // The live query refreshes the "Anterior" of the rows.
    await waitFor(() => {
      expect(cardOf('Aperturas en máquina').getAllByText('40 × 12').length).toBeGreaterThan(0);
    });
    const done = cardOf('Aperturas en máquina').getAllByRole('button', {
      name: 'Marcar serie hecha',
    })[0] as HTMLElement;
    await user.click(done);
    expect(await screen.findByText('2:00')).toBeInTheDocument();
  });

  it('changes with −15 s and +15 s, never below 0:15, and closes with ✕', async () => {
    const { user } = await openSession({ items: ITEMS });
    await logRow(user, 'Aperturas en máquina', 1);
    await screen.findByText('2:00');

    await user.click(barQueries().getByRole('button', { name: '+15 s' }));
    expect(barQueries().getByText('2:15')).toBeInTheDocument();
    await user.click(barQueries().getByRole('button', { name: '−15 s' }));
    await user.click(barQueries().getByRole('button', { name: '−15 s' }));
    expect(barQueries().getByText('1:45')).toBeInTheDocument();
    for (let i = 0; i < 8; i += 1) {
      await user.click(barQueries().getByRole('button', { name: '−15 s' }));
    }
    expect(barQueries().getByText('0:15')).toBeInTheDocument();

    await user.click(barQueries().getByRole('button', { name: 'Cerrar descanso' }));
    expect(bar()).not.toBeInTheDocument();
  });

  it('does not start for a session of another day', async () => {
    const { user } = await openSession({ items: ITEMS, date: '2026-11-03' });
    await logRow(user, 'Aperturas en máquina', 1);
    await screen.findByRole('button', { name: 'Serie hecha (pulsa para quitar)' });
    expect(bar()).not.toBeInTheDocument();
  });

  it('does not start for a finished session of today', async () => {
    const db = openTestDatabase();
    await ensureSeed(db);
    const { user } = await openSession({ db, items: ITEMS, endedAt: Date.now() });
    await logRow(user, 'Aperturas en máquina', 1);
    await screen.findByRole('button', { name: 'Serie hecha (pulsa para quitar)' });
    expect(bar()).not.toBeInTheDocument();
  });

  it('does not start again when a saved set is corrected', async () => {
    const { db, user } = await openSession({ items: ITEMS });
    await logRow(user, 'Aperturas en máquina', 1);
    await screen.findByText('2:00');
    // Wait until the set is saved and the row repainted, as a person would see it.
    await screen.findByRole('button', { name: 'Serie hecha (pulsa para quitar)' });
    await user.click(barQueries().getByRole('button', { name: 'Cerrar descanso' }));

    const repsField = () =>
      cardOf('Aperturas en máquina').getByLabelText('Repeticiones de la serie 1');
    await user.clear(repsField());
    await user.type(repsField(), '9');
    await user.tab();
    await waitFor(async () => {
      expect(((await db.sets.toArray()) as SetEntry[])[0]?.reps).toBe(9);
    });
    expect(bar()).not.toBeInTheDocument();
  });

  it('closes when the session is finished', async () => {
    const { user } = await openSession({ items: ITEMS });
    await logRow(user, 'Aperturas en máquina', 1);
    await screen.findByText('2:00');
    await screen.findByRole('button', { name: 'Serie hecha (pulsa para quitar)' });
    await user.click(screen.getByRole('button', { name: 'Terminar sesión' }));
    await screen.findByText('Terminada');
    expect(bar()).not.toBeInTheDocument();
  });

  it('reads in English', async () => {
    const { user } = await openSession({ items: ITEMS, locale: 'en' });
    const scope = cardOf('Machine chest fly');
    await user.type(scope.getByLabelText('Weight of set 1'), '40');
    await user.type(scope.getByLabelText('Reps of set 1'), '12');
    await user.click(scope.getAllByRole('button', { name: 'Mark set done' })[0] as HTMLElement);
    const region = await screen.findByRole('region', { name: 'Rest' });
    expect(within(region).getByRole('button', { name: 'Close rest' })).toBeInTheDocument();
    expect(within(region).getByText('Next: Machine chest fly')).toBeInTheDocument();
  });
});

describe('the "changes from another device" notice', () => {
  const NOTICE = 'Hay cambios de otro dispositivo en esta sesión.';

  async function openSynced() {
    const db = openTestDatabase();
    await ensureSeed(db);
    const { engine, server } = createTestEngine(db);
    const opened = await openSession({
      db,
      items: ITEMS,
      date: '2026-11-03',
      sync: engine,
    });
    // The seed and the session wait in the queue: send them so only later changes are "remote".
    await engine.syncNow();
    return { ...opened, db, engine, server };
  }

  it('appears when another device changes the session, refreshes it and leaves typed values alone', async () => {
    const { user, engine, server } = await openSynced();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    await user.type(cardOf('Remo en T').getByLabelText('Peso de la serie 1'), '77');

    server.push([
      makeSet({
        sessionId: 's1',
        exerciseId: 'aperturas-maquina',
        slot: 0,
        weight: 35,
        reps: 15,
        updatedAt: Date.now() + 60_000,
      }),
    ]);
    await engine.syncNow();

    expect(await screen.findByText(NOTICE)).toBeInTheDocument();
    expect(await screen.findByText('1 de 5 hechas')).toBeInTheDocument();
    expect(cardOf('Remo en T').getByLabelText('Peso de la serie 1')).toHaveValue('77');

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();

    // A later change shows it again.
    server.push([
      makeSet({
        sessionId: 's1',
        exerciseId: 'aperturas-maquina',
        slot: 1,
        weight: 30,
        reps: 15,
        updatedAt: Date.now() + 120_000,
      }),
    ]);
    await engine.syncNow();
    expect(await screen.findByText(NOTICE)).toBeInTheDocument();
  });

  it('also appears when another device deletes a set of the session', async () => {
    const { user, engine, server, db } = await openSynced();
    await logRow(user, 'Aperturas en máquina', 1);
    await screen.findByRole('button', { name: 'Serie hecha (pulsa para quitar)' });
    await engine.syncNow();
    const [set] = (await db.sets.toArray()) as SetEntry[];
    if (!set) throw new Error('no set');

    server.push([{ id: set.id, type: 'set', updatedAt: Date.now() + 60_000, deleted: true }]);
    await engine.syncNow();

    expect(await screen.findByText(NOTICE)).toBeInTheDocument();
    await screen.findByText('0 de 5 hechas');
  });

  it('does not appear for this device own changes or for another session', async () => {
    const { user, engine, server } = await openSynced();
    await logRow(user, 'Aperturas en máquina', 1);
    await screen.findByRole('button', { name: 'Serie hecha (pulsa para quitar)' });
    await engine.syncNow();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();

    server.push([
      makeSet({
        sessionId: 'other-session',
        exerciseId: 'aperturas-maquina',
        updatedAt: Date.now() + 60_000,
      }),
    ]);
    await engine.syncNow();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });
});

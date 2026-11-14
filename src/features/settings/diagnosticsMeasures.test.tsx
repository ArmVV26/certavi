// The timers of Settings → Diagnostics, on the real screens (docs/spec/diagnostics.md §2.2).
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { topBackoff } from '../../domain';
import { makeSession } from '../../domain/testing/builders';
import {
  DIAGNOSTICS_STORAGE_KEY,
  hasMeasurements,
  readMeasurements,
  type DiagnosticMetric,
} from '../../data/diagnostics';
import { createRepositories } from '../../data/repository';
import { ensureSeed } from '../../data/seed';
import { startDatabase } from '../../data/startup';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';

beforeEach(() => {
  localStorage.clear();
});

const switchOn = () => {
  localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, 'on');
};
const measured = (metric: DiagnosticMetric) => readMeasurements(localStorage)[metric];
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function seededDb() {
  const db = openTestDatabase();
  await ensureSeed(db);
  return db;
}

async function openSession() {
  const db = await seededDb();
  await createRepositories(db).session.put(
    makeSession({
      id: 's1',
      date: '2026-11-03',
      routineId: null,
      startedAt: new Date(2026, 10, 3, 18, 0).getTime(),
      endedAt: null,
      items: [{ exerciseId: 'remo-t', scheme: topBackoff(2), optional: false }],
    }),
  );
  const user = userEvent.setup();
  renderApp('/session/s1', { db });
  await screen.findByRole('heading', { level: 2 });
  const card = within(
    screen.getByRole('heading', { name: 'Remo en T', level: 3 }).closest('article') as HTMLElement,
  );
  const done = () => card.getAllByRole('button', { name: 'Marcar serie hecha' })[0] as HTMLElement;
  return { user, card, done };
}

describe('opening the database', () => {
  it('is timed when the switch is on', async () => {
    switchOn();
    await startDatabase(openTestDatabase(), undefined);
    expect(measured('dbOpen')).toHaveLength(1);
  });

  it('is not timed when the switch is off', async () => {
    await startDatabase(openTestDatabase(), undefined);
    expect(hasMeasurements(readMeasurements(localStorage))).toBe(false);
  });
});

describe('Today and Progress', () => {
  it('time how long Today takes to show its content', async () => {
    switchOn();
    renderApp('/', { db: await seededDb() });
    await screen.findByRole('heading', { name: 'La sesión de hoy' });
    await waitFor(() => {
      expect(measured('todayLoad')).toHaveLength(1);
    });
    expect(measured('progressLoad')).toHaveLength(0);
  });

  it('time Progress, also when it only shows its empty message', async () => {
    switchOn();
    renderApp('/progress', { db: await seededDb() });
    await screen.findByText('Todavía no hay datos');
    await waitFor(() => {
      expect(measured('progressLoad')).toHaveLength(1);
    });
    expect(measured('todayLoad')).toHaveLength(0);
  });

  it('measure nothing while the switch is off', async () => {
    renderApp('/progress', { db: await seededDb() });
    await screen.findByText('Todavía no hay datos');
    await pause(50);
    expect(hasMeasurements(readMeasurements(localStorage))).toBe(false);
  });
});

describe('ticking a set', () => {
  it('times from the tap until the saved set is shown', async () => {
    switchOn();
    const { user, card, done } = await openSession();
    await user.type(card.getByLabelText('Peso de la serie 1'), '60');
    await user.type(card.getByLabelText('Repeticiones de la serie 1'), '8');
    await user.click(done());
    await card.findByRole('button', { name: 'Serie hecha (pulsa para quitar)' });
    await waitFor(() => {
      expect(measured('setVisible')).toHaveLength(1);
    });
  });

  it('records nothing when the tap does not save the set', async () => {
    switchOn();
    const { user, done } = await openSession();
    // No weight and no reps, and no earlier set to take them from.
    await user.click(done());
    await pause(50);
    expect(measured('setVisible')).toHaveLength(0);
  });
});

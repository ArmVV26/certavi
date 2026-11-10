import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyGroupCounts } from '../../domain';
import { makeSession, makeSet, makeWeekPlan } from '../../domain/testing/builders';
import { createRepositories } from '../../data/repository';
import { ensureSeed } from '../../data/seed';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';

const download = vi.hoisted(() => ({ downloadFile: vi.fn() }));
vi.mock('../../ui/download', () => download);

/** Only Date is faked: Dexie and React keep their real timers. */
function setToday(year: number, month: number, day: number) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(year, month - 1, day, 9, 30));
}

async function seededDb() {
  const db = openTestDatabase();
  await ensureSeed(db);
  return db;
}

async function openCalendar(options: Parameters<typeof renderApp>[1] = {}) {
  const db = options.db ?? (await seededDb());
  const result = renderApp('/calendar', { ...options, db });
  await screen.findByRole('group', { name: /Calendario del mes|Month calendar/ });
  return { ...result, db, user: userEvent.setup() };
}

/** A day cell by the start of its long name ("lunes, 2 de noviembre" / "Monday 2 November"). */
const cell = (name: RegExp) => screen.getByRole('button', { name });
const week = (name: RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  download.downloadFile.mockClear();
  setToday(2026, 11, 4); // Wednesday
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Calendar · month', () => {
  it('opens on the current month with today marked and nothing selected', async () => {
    await openCalendar();
    expect(screen.getByRole('heading', { name: 'noviembre de 2026', level: 2 })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Ir a hoy' })).not.toBeInTheDocument();
    expect(cell(/miércoles,? 4 de noviembre/)).toHaveAttribute('aria-current', 'date');
    expect(screen.getByText('Nada registrado este mes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument();
  });

  it('lays out six weeks for November 2026, with the neighbouring days dimmed but present', async () => {
    await openCalendar();
    expect(screen.getAllByRole('button', { name: /^Semana / })).toHaveLength(6);
    expect(cell(/lunes,? 26 de octubre/)).toBeInTheDocument();
    expect(cell(/domingo,? 6 de diciembre/)).toBeInTheDocument();
  });

  it('browses months and comes back with "Ir a hoy", selecting today', async () => {
    const { user } = await openCalendar();
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByRole('heading', { name: 'octubre de 2026', level: 2 })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Ir a hoy' }));
    expect(screen.getByRole('heading', { name: 'noviembre de 2026', level: 2 })).toBeVisible();
    expect(
      screen.getByRole('heading', { name: /miércoles,? 4 de noviembre/, level: 2 }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByRole('heading', { name: 'diciembre de 2026', level: 2 })).toBeVisible();
  });

  it('names each day by what it holds and summarises the month', async () => {
    const db = await seededDb();
    const repos = createRepositories(db);
    await repos.session.put(
      makeSession({ id: 's1', date: '2026-11-02', routineId: 'push', startedAt: 1, endedAt: 2 }),
    );
    await repos.activity.put({
      id: 'a1',
      date: '2026-11-04',
      kind: 'football',
      minutes: 60,
      note: '',
    });
    await openCalendar({ db });
    expect(
      await screen.findByRole('button', { name: /lunes,? 2 de noviembre, 1 sesión/ }),
    ).toBeVisible();
    expect(cell(/miércoles,? 4 de noviembre, 1 actividad/)).toBeVisible();
    expect(cell(/martes,? 3 de noviembre, sin registros/)).toBeVisible();
    expect(screen.getByText('1 sesión · 1 actividad')).toBeInTheDocument();
  });

  it('marks special weeks in the name of the week button', async () => {
    const db = await seededDb();
    await createRepositories(db).weekPlan.putMany([
      makeWeekPlan({ week: '2026-11-09', deload: true, size: 4 }),
      makeWeekPlan({ week: '2026-11-16', hiking: true }),
    ]);
    await openCalendar({ db });
    expect(
      await screen.findByRole('button', { name: /^Semana .* · Descarga · 4 sesiones$/ }),
    ).toBeVisible();
    expect(week(/^Semana .* · Senderismo$/)).toBeVisible();
    expect(week(/^Semana 2.{1,5}8 nov$/)).toBeVisible();
  });
});

describe('Calendar · day panel', () => {
  it('shows the plan, the session and the activity of a day, and closes', async () => {
    const db = await seededDb();
    const repos = createRepositories(db);
    await repos.session.put(
      makeSession({ id: 's1', date: '2026-11-02', routineId: 'push', startedAt: 1, endedAt: 2 }),
    );
    await repos.set.putMany([
      makeSet({ sessionId: 's1', exerciseId: 'press-inclinado-mancuernas', slot: 0 }),
      makeSet({ sessionId: 's1', exerciseId: 'press-inclinado-mancuernas', slot: 1 }),
      makeSet({
        sessionId: 's1',
        exerciseId: 'press-inclinado-mancuernas',
        kind: 'warmup',
        slot: 2,
      }),
    ]);
    await repos.activity.put({
      id: 'a1',
      date: '2026-11-02',
      kind: 'football',
      minutes: 60,
      note: 'Liga',
    });
    const { user } = await openCalendar({ db });

    await user.click(
      await screen.findByRole('button', { name: /lunes,? 2 de noviembre, 1 sesión, 1 actividad/ }),
    );
    const panel = screen
      .getByRole('heading', { name: /lunes,? 2 de noviembre/, level: 2 })
      .closest('section') as HTMLElement;
    expect(within(panel).getByText('Plan: Push')).toBeInTheDocument();
    expect(
      within(panel).getByRole('link', { name: 'Push · Terminada · 2 series' }),
    ).toHaveAttribute('href', '/session/s1');
    expect(within(panel).getByText('Fútbol 60 min')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Cerrar' }));
    expect(
      screen.queryByRole('heading', { name: /lunes,? 2 de noviembre/, level: 2 }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument();
  });

  it('shows an empty day and unselects it by pressing the cell again', async () => {
    const { user } = await openCalendar();
    await user.click(cell(/martes,? 3 de noviembre/));
    expect(screen.getByText('Sin sesiones')).toBeInTheDocument();
    expect(screen.getByText('Sin actividades')).toBeInTheDocument();
    expect(screen.getByText('Plan: Pull')).toBeInTheDocument();
    await user.click(cell(/martes,? 3 de noviembre/));
    expect(screen.queryByText('Sin sesiones')).not.toBeInTheDocument();
  });

  it('starts a session on a past day, then reopens the same one', async () => {
    const { user, db } = await openCalendar();
    await user.click(cell(/lunes,? 2 de noviembre/));
    await user.click(screen.getByRole('button', { name: 'Pull' }));
    expect(await screen.findByRole('heading', { name: 'Pull', level: 2 })).toBeVisible();
    const [session] = await db.sessions.toArray();
    expect(session).toMatchObject({ date: '2026-11-02', routineId: 'pull' });

    await user.click(screen.getByRole('link', { name: 'Calendario' }));
    await user.click(await screen.findByRole('button', { name: /lunes,? 2 de noviembre/ }));
    await user.click(screen.getByRole('button', { name: 'Pull' }));
    expect(await screen.findByText('Ya había una sesión «Pull» ese día: la abro.')).toBeVisible();
    expect(await db.sessions.count()).toBe(1);
  });

  it('saves an activity on a past day and shows it in the day', async () => {
    const { user, db } = await openCalendar();
    await user.click(cell(/martes,? 3 de noviembre/));
    await user.click(screen.getByRole('button', { name: 'Natación' }));
    await user.type(screen.getByLabelText('Minutos'), '45');
    await user.click(screen.getByRole('button', { name: 'Guardar actividad' }));

    expect(await screen.findByText('Actividad guardada: Natación')).toBeVisible();
    expect(await screen.findByText('Natación 45 min')).toBeVisible();
    expect(screen.getByLabelText('Minutos')).toHaveValue('');
    expect(await db.activities.toArray()).toMatchObject([
      { date: '2026-11-03', kind: 'swimming', minutes: 45 },
    ]);
    expect(cell(/martes,? 3 de noviembre, 1 actividad/)).toBeVisible();
  });

  it('offers no logging on a future day', async () => {
    const { user } = await openCalendar();
    await user.click(cell(/jueves,? 5 de noviembre/));
    expect(screen.getByText('Plan: Descanso activo')).toBeInTheDocument();
    expect(screen.getByText('No se puede registrar en el futuro.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar actividad' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pull' })).not.toBeInTheDocument();
  });

  it('closes the panel when its day leaves the visible weeks', async () => {
    const { user } = await openCalendar();
    await user.click(cell(/martes,? 3 de noviembre/));
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.queryByText('Sin sesiones')).not.toBeInTheDocument();
  });
});

describe('Calendar · week panel', () => {
  it('changes the options of the current week', async () => {
    const { user, db } = await openCalendar();
    await user.click(week(/^Semana 2.{1,5}8 nov$/));
    const panel = screen
      .getByRole('heading', { name: /^Semana 2.{1,5}8 nov$/, level: 2 })
      .closest('section') as HTMLElement;
    expect(within(panel).getByText('Series efectivas')).toBeInTheDocument();
    await user.click(within(panel).getByRole('switch', { name: 'Semana de descarga' }));
    expect(
      await screen.findByText('Semana de descarga: las sesiones nuevas salen reducidas'),
    ).toBeVisible();
    expect(await db.weekPlans.get('week_2026-11-02')).toMatchObject({ deload: true });
    expect(
      await screen.findByRole('button', { name: /^Semana 2.{1,5}8 nov · Descarga$/ }),
    ).toBeVisible();
  });

  it('closes a finished week on its own and makes its options read-only', async () => {
    const db = await seededDb();
    await createRepositories(db).session.put(
      makeSession({ id: 's1', date: '2026-10-28', routineId: 'push', startedAt: 1, endedAt: 2 }),
    );
    const { user } = await openCalendar({ db });
    const closed = await screen.findByRole('button', {
      name: /^Semana 26 oct.{1,5}1 nov · Cerrada$/,
    });
    expect(
      (await createRepositories(db).weekPlan.get('week_2026-10-26'))?.plannedSetsByGroup,
    ).toBeDefined();

    await user.click(closed);
    expect(screen.getByRole('radio', { name: '3' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Semana de descarga' })).toBeEnabled();
    expect(screen.getByRole('switch', { name: 'Semana con senderismo' })).toBeEnabled();
    expect(screen.getByText(/^Semana cerrada: el plan quedó guardado el /)).toBeInTheDocument();
    // The current week is never closed.
    expect(week(/^Semana 2.{1,5}8 nov$/)).toBeVisible();
  });

  it('marks a closed week as deload and recomputes its planned sets', async () => {
    const db = await seededDb();
    await createRepositories(db).weekPlan.put(
      makeWeekPlan({
        week: '2026-10-26',
        closedAt: 5,
        plannedSetsByGroup: { ...emptyGroupCounts(), chest: 7 },
      }),
    );
    const { user } = await openCalendar({ db });
    await user.click(
      await screen.findByRole('button', { name: /^Semana 26 oct.{1,5}1 nov · Cerrada$/ }),
    );
    expect(screen.getByText('0 / 7')).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Semana de descarga' }));
    expect(
      await screen.findByText('Semana de descarga: las sesiones nuevas salen reducidas'),
    ).toBeVisible();
    expect(
      await screen.findByRole('button', {
        name: /^Semana 26 oct.{1,5}1 nov · Descarga · Cerrada$/,
      }),
    ).toBeVisible();
    expect(screen.queryByText('0 / 7')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3' })).toBeDisabled();
    expect(await db.weekPlans.get('week_2026-10-26')).toMatchObject({ deload: true, closedAt: 5 });
  });

  it('keeps the frozen plan when a routine changes later', async () => {
    const db = await seededDb();
    await createRepositories(db).weekPlan.put(
      makeWeekPlan({ week: '2026-10-26', plannedSetsByGroup: { ...emptyGroupCounts(), chest: 7 } }),
    );
    const { user } = await openCalendar({ db });
    await user.click(
      await screen.findByRole('button', { name: /^Semana 26 oct.{1,5}1 nov · Cerrada$/ }),
    );
    expect(screen.getByText('0 / 7')).toBeInTheDocument();
  });

  it('shows future weeks as read-only', async () => {
    const { user } = await openCalendar();
    await user.click(week(/^Semana 9.{1,5}15 nov$/));
    expect(screen.getByRole('switch', { name: 'Semana de descarga' })).toBeDisabled();
    expect(screen.getAllByText('Todavía no puedes cambiar esta semana.')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Guardar peso' })).not.toBeInTheDocument();
  });

  it('saves the body weight of a past week', async () => {
    const { user, db } = await openCalendar();
    await user.click(week(/^Semana 26 oct.{1,5}1 nov$/));
    await user.type(screen.getByLabelText(/Peso medio/), '76,4');
    await user.click(screen.getByRole('button', { name: 'Guardar peso' }));
    expect(await screen.findByText(/^Peso guardado · /)).toBeVisible();
    expect(await db.bodyWeights.get('bw_2026-10-26')).toMatchObject({ kg: 76.4 });
  });

  it('downloads the JSON of the week', async () => {
    const db = await seededDb();
    await createRepositories(db).session.putMany([
      makeSession({ id: 'in', date: '2026-11-02', routineId: 'push', startedAt: 1, endedAt: 2 }),
      makeSession({ id: 'out', date: '2026-10-28', routineId: 'push', startedAt: 1, endedAt: 2 }),
    ]);
    const { user } = await openCalendar({ db });
    await user.click(week(/^Semana 2.{1,5}8 nov$/));
    await user.click(screen.getByRole('button', { name: 'Descargar JSON de la semana' }));
    await waitFor(() => {
      expect(download.downloadFile).toHaveBeenCalledTimes(1);
    });
    const file = download.downloadFile.mock.calls[0]?.[0] as { fileName: string; content: string };
    expect(file.fileName).toBe('certavi-week-2026-11-02.json');
    const parsed = JSON.parse(file.content) as { records: { type: string; id: string }[] };
    expect(parsed.records.filter((r) => r.type === 'session').map((r) => r.id)).toEqual(['in']);
  });
});

describe('Calendar · English', () => {
  it('reads in English', async () => {
    const { user } = await openCalendar({ locale: 'en' });
    expect(screen.getByRole('heading', { name: 'November 2026', level: 2 })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeVisible();
    expect(screen.getByText('Nothing logged this month')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tuesday,? 3 November/ }));
    expect(screen.getByRole('heading', { name: 'Log on this day' })).toBeVisible();
    expect(screen.getByRole('button', { name: /^Week 2.{1,5}8 Nov$/ })).toBeVisible();
  });
});

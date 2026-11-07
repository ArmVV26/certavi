import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANKLE_REHAB_BLOCK_ID, addDays } from '../../domain';
import { makeSession, makeSet, makeWeekPlan } from '../../domain/testing/builders';
import { createRepositories } from '../../data/repository';
import { ensureSeed } from '../../data/seed';
import { createTestEngine } from '../../data/sync/testing';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';

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

async function openToday(
  options: Parameters<typeof renderApp>[1] = {},
  heading = 'La sesión de hoy',
) {
  const db = options.db ?? (await seededDb());
  const result = renderApp('/', { ...options, db });
  await screen.findByRole('heading', { name: heading });
  return { ...result, db, user: userEvent.setup() };
}

const hero = () =>
  screen.getByRole('heading', { name: 'La sesión de hoy' }).closest('section') as HTMLElement;
const card = (name: string | RegExp) =>
  screen.getByRole('heading', { name }).closest('section') as HTMLElement;

beforeEach(() => {
  setToday(2026, 11, 2); // Monday
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Today · the session of the day', () => {
  it('proposes Push on Monday with its exercises and sets', async () => {
    await openToday();
    expect(within(hero()).getByText('Push')).toBeInTheDocument();
    expect(within(hero()).getByText('7 ejercicios · 19 series')).toBeInTheDocument();
    expect(within(hero()).getByRole('button', { name: 'Empezar Push' })).toBeEnabled();
    expect(within(hero()).getByText('Ver los ejercicios')).toBeInTheDocument();
    expect(
      within(hero()).getByText('Press inclinado con mancuernas · 3 series'),
    ).toBeInTheDocument();
  });

  it('starts the session, opens it and then offers to continue it', async () => {
    const { user, db } = await openToday();
    await user.click(screen.getByRole('button', { name: 'Empezar Push' }));

    expect(await screen.findByRole('heading', { name: 'Push', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sesión');
    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(screen.getByText('7 ejercicios · 19 series')).toBeInTheDocument();
    expect(await db.sessions.count()).toBe(1);

    await user.click(screen.getByRole('link', { name: 'Hoy' }));
    const link = await within(await findHero()).findByRole('link', { name: 'Continuar Push' });
    const session = (await db.sessions.toArray())[0];
    expect(link).toHaveAttribute('href', `/session/${session?.id ?? ''}`);
  });

  it('shows "Sesión hecha" for a finished session', async () => {
    const db = await seededDb();
    await createRepositories(db).session.put(
      makeSession({ id: 's1', date: '2026-11-02', routineId: 'push', startedAt: 1, endedAt: 2 }),
    );
    await openToday({ db });
    expect(
      await within(hero()).findByRole('link', { name: 'Sesión hecha · ver o corregir' }),
    ).toHaveAttribute('href', '/session/s1');
  });

  it('lists the other sessions of today', async () => {
    const db = await seededDb();
    await createRepositories(db).session.putMany([
      makeSession({ id: 'pull', date: '2026-11-02', routineId: 'pull', startedAt: 1 }),
      makeSession({ id: 'free', date: '2026-11-02', routineId: null, startedAt: 2, endedAt: 3 }),
    ]);
    await openToday({ db });
    expect(within(hero()).getByRole('button', { name: 'Empezar Push' })).toBeInTheDocument();
    const pull = await within(hero()).findByRole('link', { name: 'Pull' });
    expect(pull).toHaveAttribute('href', '/session/pull');
    expect(pull.closest('p')).toHaveTextContent('También hoy: Pull (en curso)');
    const free = within(hero()).getByRole('link', { name: 'Sesión libre' });
    expect(free.closest('p')).toHaveTextContent('También hoy: Sesión libre (hecha)');
  });

  it('shows a rest day with quick activities that preselect the activity', async () => {
    setToday(2026, 11, 5); // Thursday
    const { user } = await openToday();
    expect(within(hero()).getByText('Descanso activo')).toBeInTheDocument();
    expect(within(hero()).getByText('Natación o movilidad. No correr.')).toBeInTheDocument();
    const activity = card('Actividad');
    expect(within(activity).getByRole('button', { name: 'Natación' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(within(hero()).getByRole('button', { name: '+ Movilidad' }));
    expect(within(activity).getByRole('button', { name: 'Movilidad' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(activity).getByLabelText('Minutos')).toHaveFocus();
  });

  it('shows the football day on Saturday and a plain rest day without quick activities', async () => {
    setToday(2026, 11, 7);
    await openToday();
    expect(within(hero()).getByText('Fútbol')).toBeInTheDocument();
    expect(within(hero()).getByRole('button', { name: '+ Fútbol' })).toBeInTheDocument();
  });
});

async function findHero() {
  return (await screen.findByRole('heading', { name: 'La sesión de hoy' })).closest(
    'section',
  ) as HTMLElement;
}

describe('Today · this week', () => {
  it('shows the days, the planned sets and the sessions of a normal week', async () => {
    await openToday();
    const week = card(/^Esta semana/);
    const days = within(week).getByRole('list', { name: 'Días de la semana' });
    expect(within(days).getAllByRole('listitem')).toHaveLength(7);
    expect(within(days).getByRole('img', { name: 'lunes 2: Push' })).toHaveAttribute(
      'aria-current',
      'date',
    );
    expect(within(days).getByRole('img', { name: 'jueves 5: Activo' })).toBeInTheDocument();
    expect(within(days).getByRole('img', { name: 'domingo 8: Lower A' })).toBeInTheDocument();
    expect(within(week).getByText('0 / 104')).toBeInTheDocument();
    expect(within(week).getByText('0 de 5')).toBeInTheDocument();
  });

  it('counts effective sets and links a day with one session', async () => {
    const db = await seededDb();
    const repos = createRepositories(db);
    await repos.session.put(makeSession({ id: 's1', date: '2026-11-02', routineId: 'push' }));
    await repos.set.putMany([
      makeSet({ id: 'a', sessionId: 's1', exerciseId: 'press-pecho-vertical' }),
      makeSet({ id: 'b', sessionId: 's1', exerciseId: 'press-pecho-vertical' }),
      makeSet({ id: 'w', sessionId: 's1', exerciseId: 'press-pecho-vertical', kind: 'warmup' }),
    ]);
    await openToday({ db });
    const week = card(/^Esta semana/);
    expect(await within(week).findByText('2 / 104')).toBeInTheDocument();
    expect(within(week).getByText('1 de 5')).toBeInTheDocument();
    expect(within(week).getByRole('link', { name: 'lunes 2: Push, hecho' })).toHaveAttribute(
      'href',
      '/session/s1',
    );
  });

  it('shows activities and several sessions on a day', async () => {
    const db = await seededDb();
    const repos = createRepositories(db);
    await repos.session.putMany([
      makeSession({ id: 's1', date: '2026-11-03', routineId: 'pull', startedAt: 1 }),
      makeSession({ id: 's2', date: '2026-11-03', routineId: null, startedAt: 2 }),
    ]);
    await repos.activity.put({
      id: 'act1',
      date: '2026-11-05',
      kind: 'swimming',
      minutes: 30,
      note: '',
    });
    await openToday({ db });
    const days = within(card(/^Esta semana/)).getByRole('list', { name: 'Días de la semana' });
    expect(
      await within(days).findByRole('img', { name: 'martes 3: Pull + Sesión libre, hecho' }),
    ).toBeInTheDocument();
    expect(
      within(days).getByRole('img', { name: 'jueves 5: Natación, hecho' }),
    ).toBeInTheDocument();
  });

  it('changes the week size: Friday becomes a rest day and the plan shrinks', async () => {
    setToday(2026, 11, 6); // Friday
    const { user, db } = await openToday();
    expect(within(hero()).getByText('Upper')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '4' }));
    expect(await within(hero()).findByText('Descanso')).toBeInTheDocument();
    expect(within(card(/^Esta semana/)).getByText('0 / 81')).toBeInTheDocument();
    expect(within(card(/^Esta semana/)).getByText('0 de 4')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '3' }));
    expect(await within(card(/^Esta semana/)).findByText('0 / 63')).toBeInTheDocument();
    const days = within(card(/^Esta semana/)).getByRole('list', { name: 'Días de la semana' });
    expect(within(days).getByRole('img', { name: 'miércoles 4: Lower Full' })).toBeInTheDocument();
    expect(await db.weekPlans.get('week_2026-11-02')).toMatchObject({ size: 3 });
  });

  it('turns on the hiking week: Wednesday is Lower Full and Sunday is hiking', async () => {
    setToday(2026, 11, 4);
    const { user } = await openToday();
    expect(within(hero()).getByText('Lower B')).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Semana con senderismo' }));
    expect(await within(hero()).findByText('Lower Full')).toBeInTheDocument();
    expect(within(hero()).getByText('Senderismo')).toBeInTheDocument();
    const week = card(/^Esta semana/);
    const days = within(week).getByRole('list', { name: 'Días de la semana' });
    expect(within(days).getByRole('img', { name: 'domingo 8: Monte' })).toBeInTheDocument();
    expect(within(days).getByRole('img', { name: 'jueves 5: Activo' })).toBeInTheDocument();
    expect(within(week).getByText('0 / 86')).toBeInTheDocument();
    expect(within(week).getByText('0 de 4')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Para toda la semana: el miércoles pasa a Lower Full y el domingo es monte.',
      ),
    ).toBeInTheDocument();
  });

  it('turns on the deload week: toast, label and a reduced plan', async () => {
    const { user } = await openToday();
    await user.click(screen.getByRole('switch', { name: 'Semana de descarga' }));
    expect(
      await screen.findByText('Semana de descarga: las sesiones nuevas salen reducidas'),
    ).toBeInTheDocument();
    expect(await within(hero()).findByText('Descarga')).toBeInTheDocument();
    expect(within(hero()).queryByText('7 ejercicios · 19 series')).not.toBeInTheDocument();
    expect(within(card(/^Esta semana/)).getByText('0 / 62')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Activa: las sesiones nuevas salen con la mitad de series y RIR 3-4. No cuentan para récords.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Semana de descarga' }));
    expect(await screen.findByText('Semana normal')).toBeInTheDocument();
  });

  it('shows the plan week number when a plan start is set', async () => {
    const db = await seededDb();
    const settings = await db.settings.get('settings');
    await createRepositories(db).settings.put({
      ...(settings as NonNullable<typeof settings> & { deleted?: never }),
      planStart: '2026-10-19',
    });
    await openToday({ db });
    expect(await within(card(/^Esta semana/)).findByText('Semana 3')).toBeInTheDocument();
  });

  describe('streak', () => {
    /** One session with one set on each date. */
    async function trainedOn(...dates: string[]) {
      const db = await seededDb();
      const repos = createRepositories(db);
      for (const date of dates) {
        await repos.session.put(makeSession({ id: `s-${date}`, date }));
        await repos.set.put(makeSet({ sessionId: `s-${date}`, exerciseId: 'remo-t' }));
      }
      return db;
    }
    const streak = (week: HTMLElement) =>
      within(week).getByText('Racha', { selector: 'dt' }).nextElementSibling?.textContent;

    it('counts the weeks in a row, the current one included', async () => {
      const db = await trainedOn('2026-10-20', '2026-10-27', '2026-11-02');
      await openToday({ db });
      const week = card(/^Esta semana/);
      await waitFor(() => {
        expect(streak(week)).toBe('3 semanas');
      });
    });

    it('is kept while the week has no session yet, and is zero without any', async () => {
      const db = await trainedOn('2026-10-20', '2026-10-27');
      const { unmount } = await openToday({ db });
      await waitFor(() => {
        expect(streak(card(/^Esta semana/))).toBe('2 semanas');
      });
      unmount();

      await openToday();
      await waitFor(() => {
        expect(streak(card(/^Esta semana/))).toBe('0 semanas');
      });
    });

    it('updates when a session is logged', async () => {
      const db = await trainedOn('2026-10-27');
      await openToday({ db });
      await waitFor(() => {
        expect(streak(card(/^Esta semana/))).toBe('1 semana');
      });
      const repos = createRepositories(db);
      await repos.session.put(makeSession({ id: 'now', date: '2026-11-02' }));
      await repos.set.put(makeSet({ sessionId: 'now', exerciseId: 'remo-t' }));
      await waitFor(() => {
        expect(streak(card(/^Esta semana/))).toBe('2 semanas');
      });
    });
  });
});

describe('Today · notices', () => {
  it('asks for a sync key when the device has none', async () => {
    await openToday();
    expect(
      screen.getByText(
        'Este dispositivo aún no tiene la clave de sincronización: lo que apuntes se queda solo aquí.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ponerla en Ajustes' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('does not ask for a key when the device has one', async () => {
    const db = await seededDb();
    const { engine } = createTestEngine(db, { key: 'k'.repeat(32) });
    await openToday({ db, sync: engine });
    expect(screen.queryByRole('link', { name: 'Ponerla en Ajustes' })).not.toBeInTheDocument();
  });

  it('suggests a deload after six weeks in a row and hides it once on', async () => {
    const db = await seededDb();
    const sessions = Array.from({ length: 6 }, (_, i) =>
      makeSession({ id: `w${String(i)}`, date: addDays('2026-11-02', -7 * (i + 1)) }),
    );
    await createRepositories(db).session.putMany(sessions);
    const { user } = await openToday({ db });
    const reminder = await screen.findByText(/^Llevas 6 semanas sin descarga\./);
    expect(reminder).toBeInTheDocument();
    expect(screen.getByText(/Llevas 6 semanas seguidas sin descargar\./)).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Semana de descarga' }));
    await waitFor(() => {
      expect(screen.queryByText(/^Llevas 6 semanas sin descarga\./)).not.toBeInTheDocument();
    });
  });

  it('does not suggest a deload when the last weeks had one', async () => {
    const db = await seededDb();
    const repos = createRepositories(db);
    await repos.session.putMany(
      Array.from({ length: 6 }, (_, i) =>
        makeSession({ id: `w${String(i)}`, date: addDays('2026-11-02', -7 * (i + 1)) }),
      ),
    );
    await repos.weekPlan.put(makeWeekPlan({ week: '2026-10-19', deload: true }));
    await openToday({ db });
    expect(await screen.findByText(/Llevas 1 semana seguida sin descargar\./)).toBeInTheDocument();
    expect(screen.queryByText(/sin descarga\. Lo recomendado/)).not.toBeInTheDocument();
  });
});

describe('Today · another session or day', () => {
  it('starts a free session', async () => {
    const { user } = await openToday();
    const other = card('Otra sesión u otro día');
    await user.click(within(other).getByRole('button', { name: 'Sesión libre' }));
    expect(await screen.findByRole('heading', { name: 'Sesión libre' })).toBeInTheDocument();
    expect(screen.getByText('Sin ejercicios todavía.')).toBeInTheDocument();
  });

  it('logs a past day as finished and reopens it the second time', async () => {
    setToday(2026, 11, 4);
    const { user, db } = await openToday();
    const other = card('Otra sesión u otro día');
    const date = within(other).getByLabelText('Fecha');
    expect(date).toHaveValue('2026-11-04');
    expect(date).toHaveAttribute('max', '2026-11-04');
    fireEvent.change(date, { target: { value: '2026-11-02' } });
    expect(
      within(other).getByText(
        'Se registrará el lunes, 2 de noviembre. Sin temporizador; podrás ajustar la hora.',
      ),
    ).toBeInTheDocument();

    await user.click(within(other).getByRole('button', { name: 'Push' }));
    expect(await screen.findByText('Terminada')).toBeInTheDocument();
    expect(screen.getByText('lunes, 2 de noviembre · 18:00')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Hoy' }));
    const again = (await screen.findByRole('heading', { name: 'Otra sesión u otro día' })).closest(
      'section',
    ) as HTMLElement;
    fireEvent.change(within(again).getByLabelText('Fecha'), { target: { value: '2026-11-02' } });
    await user.click(within(again).getByRole('button', { name: 'Push' }));
    expect(
      await screen.findByText('Ya había una sesión «Push» ese día: la abro.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Terminada')).toBeInTheDocument();
    expect(await db.sessions.count()).toBe(1);
  });

  it('refuses a future date', async () => {
    const { user, db } = await openToday();
    const other = card('Otra sesión u otro día');
    fireEvent.change(within(other).getByLabelText('Fecha'), { target: { value: '2026-11-03' } });
    await user.click(within(other).getByRole('button', { name: 'Pull' }));
    expect(within(other).getByText('No se puede registrar en el futuro.')).toBeInTheDocument();
    expect(await db.sessions.count()).toBe(0);
  });

  it('lists the routines in weekday order, then the free session', async () => {
    await openToday();
    const group = within(card('Otra sesión u otro día')).getByRole('group', {
      name: 'Qué entrenaste',
    });
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Push', 'Pull', 'Lower B', 'Upper', 'Lower A', 'Lower Full', 'Sesión libre']);
  });
});

describe('Today · activity and weight', () => {
  it('saves an activity and lists it', async () => {
    const { user, db } = await openToday();
    const activity = card('Actividad');
    await user.click(within(activity).getByRole('button', { name: 'Natación' }));
    await user.type(within(activity).getByLabelText('Minutos'), '45');
    await user.type(within(activity).getByLabelText('Nota'), 'Piscina');
    await user.click(within(activity).getByRole('button', { name: 'Guardar actividad de hoy' }));

    expect(await screen.findByText('Actividad guardada: Natación')).toBeInTheDocument();
    expect(await within(activity).findByText('Hoy: Natación 45 min')).toBeInTheDocument();
    expect(within(activity).getByLabelText('Minutos')).toHaveValue('');
    expect(await db.activities.toArray()).toMatchObject([
      { kind: 'swimming', minutes: 45, note: 'Piscina', date: '2026-11-02' },
    ]);
    // A routine day without a session shows the activity done, not the planned routine.
    const days = within(card(/^Esta semana/)).getByRole('list', { name: 'Días de la semana' });
    expect(
      await within(days).findByRole('img', { name: 'lunes 2: Natación, hecho' }),
    ).toBeInTheDocument();
  });

  it('saves an activity without minutes as 0 and shows it without minutes', async () => {
    const { user } = await openToday();
    const activity = card('Actividad');
    await user.click(within(activity).getByRole('button', { name: 'Guardar actividad de hoy' }));
    expect(await within(activity).findByText('Hoy: Fútbol')).toBeInTheDocument();
  });

  it('lists activities in the order they were saved, even with the clock stopped', async () => {
    // The fake Date does not move: both activities get ids with the same time.
    const { user } = await openToday();
    const activity = card('Actividad');
    const save = () =>
      user.click(within(activity).getByRole('button', { name: 'Guardar actividad de hoy' }));
    await user.click(within(activity).getByRole('button', { name: 'Natación' }));
    await save();
    expect(await within(activity).findByText('Hoy: Natación')).toBeInTheDocument();
    await user.click(within(activity).getByRole('button', { name: 'Fútbol' }));
    await save();
    expect(await within(activity).findByText('Hoy: Natación · Fútbol')).toBeInTheDocument();
  });

  it('saves this week’s weight, last week’s and shows the previous entry', async () => {
    const { user, db } = await openToday();
    const weight = card('Peso medio de la semana');
    const field = () => within(weight).getByLabelText(/Peso medio/);
    await user.type(field(), '76,4');
    await user.click(within(weight).getByRole('button', { name: 'Guardar peso' }));
    expect(await screen.findByText(/^Peso guardado · 2/)).toBeInTheDocument();
    expect(field()).toHaveValue('76,4');

    await user.click(within(weight).getByRole('button', { name: /^Semana pasada/ }));
    expect(field()).toHaveValue('');
    await user.type(field(), '77');
    await user.click(within(weight).getByRole('button', { name: 'Guardar peso' }));
    await waitFor(async () => {
      expect(await db.bodyWeights.count()).toBe(2);
    });

    await user.click(within(weight).getByRole('button', { name: /^Esta semana/ }));
    expect(field()).toHaveValue('76,4');
    // Intl separates the parts of a date range with special spaces: match any space.
    expect(await within(weight).findByText(/^Último dato anterior \(26\soct/)).toHaveTextContent(
      /: 77 kg$/,
    );
    expect(field()).toHaveAttribute('placeholder', '77');
  });

  it('refuses a weight outside 20–300 kg', async () => {
    const { user, db } = await openToday();
    const weight = card('Peso medio de la semana');
    await user.type(within(weight).getByLabelText(/Peso medio/), '12');
    await user.click(within(weight).getByRole('button', { name: 'Guardar peso' }));
    expect(within(weight).getByText('Escribe un peso entre 20 y 300 kg.')).toBeInTheDocument();
    expect(await db.bodyWeights.count()).toBe(0);
  });
});

describe('Today · blocks of the day', () => {
  it('ticks items, sets and clears a pain value with its warning', async () => {
    const { user, db } = await openToday();
    const block = card('Rehabilitación del tobillo');
    expect(within(block).getByText('Ejercicios · 0/8')).toBeInTheDocument();
    expect(within(block).getAllByText('3 × 10 por pierna · 3-5 días por semana')).toHaveLength(2);
    expect(within(block).getAllByText('2 × 30 s por pierna')).toHaveLength(5);

    await user.click(within(block).getByRole('checkbox', { name: 'Rodillo en gemelo' }));
    expect(await within(block).findByText('Ejercicios · 1/8')).toBeInTheDocument();

    const stairs = within(block).getByRole('group', { name: 'Dolor al bajar escaleras' });
    await user.click(within(stairs).getByRole('button', { name: '4' }));
    expect(await within(stairs).findByRole('button', { name: '4', pressed: true })).toBeVisible();
    expect(
      within(block).getByText('Por encima de 3/10: baja la intensidad de lo que cargue la zona.'),
    ).toBeInTheDocument();
    expect(await db.blockLogs.get(`blocklog_${ANKLE_REHAB_BLOCK_ID}_2026-11-02`)).toMatchObject({
      done: { 'foam-roll': true },
      metrics: { stairs: 4 },
    });

    await user.click(within(stairs).getByRole('button', { name: '4' }));
    await waitFor(() => {
      expect(within(stairs).queryByRole('button', { pressed: true })).not.toBeInTheDocument();
    });
    expect(within(block).queryByText(/^Por encima de 3\/10/)).not.toBeInTheDocument();
  });

  it('saves the note of the day when the field loses focus', async () => {
    const { user, db } = await openToday();
    const block = card('Rehabilitación del tobillo');
    await user.type(within(block).getByLabelText('Nota del día'), 'Sin molestias');
    await user.tab();
    expect(await screen.findByText('Nota guardada')).toBeInTheDocument();
    expect(await db.blockLogs.toArray()).toMatchObject([{ note: 'Sin molestias' }]);
  });

  it('shows the review date of the block', async () => {
    const db = await seededDb();
    const blocks = createRepositories(db).block;
    const ankle = await blocks.get(ANKLE_REHAB_BLOCK_ID);
    if (!ankle) throw new Error('seed block missing');
    await blocks.put({ ...ankle, reviewDate: '2026-11-10' });
    await openToday({ db });
    expect(
      await screen.findByText('Revisión: martes, 10 de noviembre (en 8 días)'),
    ).toBeInTheDocument();
  });
});

describe('Today · English', () => {
  it('reads in English with British dates', async () => {
    await openToday({ locale: 'en' }, "Today's session");
    expect(screen.getByText('Monday 2 November')).toBeInTheDocument();
    expect(screen.getByText('Start Push')).toBeInTheDocument();
    expect(screen.getByText('7 exercises · 19 sets')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^This week/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Another session or day' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Average weekly weight' })).toBeInTheDocument();
    expect(screen.getByText('Exercises · 0/8')).toBeInTheDocument();
  });
});

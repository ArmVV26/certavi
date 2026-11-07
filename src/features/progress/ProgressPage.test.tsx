import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyGroupCounts } from '../../domain';
import type { SetEntry } from '../../domain';
import { makeSession, makeSet, makeWeekPlan } from '../../domain/testing/builders';
import { createRepositories } from '../../data/repository';
import { ensureSeed } from '../../data/seed';
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

function work(sessionId: string, exerciseId: string, weights: number[], reps = 5): SetEntry[] {
  return weights.map((weight, slot) =>
    makeSet({ sessionId, exerciseId, slot, kind: 'top', weight, reps }),
  );
}

/**
 * A cycle that started on Monday 26 Oct 2026, seen on Wednesday 25 Nov:
 * - T-bar row: 100 kg (week 1), 200 kg in a deload week, 105 kg last week, 110 kg today;
 * - incline press: 5 sets yesterday.
 */
async function trainedDb() {
  const db = await seededDb();
  const repos = createRepositories(db);
  await repos.session.putMany([
    makeSession({ id: 'r1', date: '2026-10-27', routineId: 'pull', readiness: 3 }),
    makeSession({ id: 'r0', date: '2026-11-03', routineId: 'pull' }),
    makeSession({ id: 'r2', date: '2026-11-17', routineId: 'pull', readiness: 4 }),
    makeSession({ id: 'p1', date: '2026-11-24', routineId: 'push' }),
    makeSession({ id: 'r3', date: '2026-11-25', routineId: 'pull' }),
  ]);
  await repos.set.putMany([
    ...work('r1', 'remo-t', [100]),
    ...work('r0', 'remo-t', [200]),
    ...work('r2', 'remo-t', [105, 105, 105, 105, 105]),
    ...work('p1', 'press-inclinado-mancuernas', [30, 30, 30, 30, 30], 8),
    ...work('r3', 'remo-t', [110, 110, 110]),
  ]);
  await repos.weekPlan.putMany([
    makeWeekPlan({
      week: '2026-11-02',
      deload: true,
      plannedSetsByGroup: emptyGroupCounts(),
      closedAt: 5,
    }),
    makeWeekPlan({ week: '2026-10-26', plannedSetsByGroup: emptyGroupCounts(), closedAt: 5 }),
    makeWeekPlan({ week: '2026-11-09', plannedSetsByGroup: emptyGroupCounts(), closedAt: 5 }),
    makeWeekPlan({
      week: '2026-11-16',
      plannedSetsByGroup: { ...emptyGroupCounts(), back: 20, chest: 16 },
      closedAt: 5,
    }),
  ]);
  await repos.bodyWeight.putMany([
    { id: 'bw_2026-11-09', week: '2026-11-09', kg: 82.4 },
    { id: 'bw_2026-11-16', week: '2026-11-16', kg: 82 },
    { id: 'bw_2026-11-23', week: '2026-11-23', kg: 81.5 },
  ]);
  return db;
}

async function openProgress(options: Parameters<typeof renderApp>[1] = {}) {
  const db = options.db ?? (await trainedDb());
  const result = renderApp('/progress', { ...options, db });
  await screen.findByRole('heading', { name: /Series por grupo muscular|Sets per muscle group/ });
  return { ...result, db, user: userEvent.setup() };
}

/** The card (section) with the given heading. */
const card = (name: RegExp | string) =>
  screen.getByRole('heading', { name, level: 2 }).closest('section') as HTMLElement;

beforeEach(() => {
  localStorage.clear();
  setToday(2026, 11, 25); // Wednesday
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Progress · empty', () => {
  it('shows an empty state without sessions, and still the body weight if there is any', async () => {
    const db = await seededDb();
    renderApp('/progress', { db });
    expect(await screen.findByText('Todavía no hay datos')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Series por semana' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Peso corporal' })).not.toBeInTheDocument();
  });

  it('keeps the body weight card when only weights were saved', async () => {
    const db = await seededDb();
    await createRepositories(db).bodyWeight.put({
      id: 'bw_2026-11-23',
      week: '2026-11-23',
      kg: 81.5,
    });
    renderApp('/progress', { db });
    expect(await screen.findByText('Todavía no hay datos')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Peso corporal', level: 2 })).toBeVisible();
  });
});

describe('Progress · summary', () => {
  it('shows the week of the cycle, the sets, the sessions and the records of the month', async () => {
    await openProgress();
    const stat = (label: string) =>
      (screen.getByText(label, { selector: 'dt' }).parentElement as HTMLElement).textContent;
    expect(stat('Semana')).toMatch(/^Semana5/); // week 5 of the cycle (it starts on 26 Oct)
    expect(stat('Series')).toMatch(/^Series8 \/ \d+esta semana$/);
    expect(stat('Sesiones')).toBe('Sesiones5en total');
    expect(stat('Récords')).toBe('Récords2este mes'); // 105 and 110 kg
    expect(screen.getByText('esta semana')).toBeInTheDocument();
    expect(screen.getByText('en total')).toBeInTheDocument();
    expect(screen.getByText('este mes')).toBeInTheDocument();
  });
});

describe('Progress · sets per muscle group', () => {
  it('names each group with its sets against the plan', async () => {
    await openProgress();
    const groups = card('Series por grupo muscular');
    expect(within(groups).getByText(/^Pecho: 5 de \d+ series$/)).toBeInTheDocument();
    expect(within(groups).getByText(/^Espalda: 3 de \d+ series$/)).toBeInTheDocument();
    expect(within(groups).getByText(/^Core: 0 de \d+ series/)).toBeInTheDocument();
    expect(within(groups).getAllByRole('listitem').length).toBeGreaterThanOrEqual(10);
    expect(within(groups).getByText(/^Semana \d/)).toBeInTheDocument();
  });

  it('shows last week with its frozen plan and the average of four weeks', async () => {
    const { user } = await openProgress();
    const groups = card('Series por grupo muscular');
    await user.click(within(groups).getByRole('radio', { name: 'Semana pasada' }));
    expect(within(groups).getByText('Espalda: 5 de 20 series')).toBeInTheDocument();
    expect(within(groups).getByText('Pecho: 0 de 16 series')).toBeInTheDocument();
    expect(within(groups).getByText(/^Semana 16.{1,5}22 nov$/)).toBeInTheDocument();

    await user.click(within(groups).getByRole('radio', { name: 'Media de 4 semanas' }));
    // Done (1 + 1 + 0 + 5)/4 → 1,8; plan (0 + 0 + 0 + 20)/4 → 5.
    expect(within(groups).getByText('Espalda: 1,8 de 5 series')).toBeInTheDocument();
    expect(within(groups).getByText(/^4 semanas: /)).toBeInTheDocument();
  });

  it('marks the groups that met the plan and tags a deload week', async () => {
    const db = await trainedDb();
    await createRepositories(db).weekPlan.put(
      makeWeekPlan({
        week: '2026-11-16',
        deload: true,
        plannedSetsByGroup: { ...emptyGroupCounts(), back: 5, chest: 16 },
        closedAt: 5,
      }),
    );
    const { user } = await openProgress({ db });
    const groups = card('Series por grupo muscular');
    await user.click(within(groups).getByRole('radio', { name: 'Semana pasada' }));
    expect(within(groups).getByText('Espalda: 5 de 5 series, plan cumplido')).toBeInTheDocument();
    expect(within(groups).getByText(/· descarga$/)).toBeInTheDocument();
  });
});

describe('Progress · sets per week', () => {
  it('draws twelve weeks and lists them in a table behind "Ver datos"', async () => {
    const { user } = await openProgress();
    const weeks = card('Series por semana');
    expect(
      within(weeks).getByRole('img', {
        name: /gráfica de columnas, 12 semanas, de 0 a \d+ series/,
      }),
    ).toBeInTheDocument();
    await user.click(within(weeks).getByText('Ver datos'));
    const table = within(weeks).getByRole('table', { name: 'Series por semana' });
    expect(within(table).getAllByRole('row')).toHaveLength(13); // head + 12 weeks
    const last = within(table).getByRole('row', { name: /^23.{1,5}29 nov/ });
    // 5 incline press + 3 rows; 2 sessions (24 and 25 Nov).
    expect(
      within(last)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['8', expect.stringMatching(/^\d+$/), '2', '0']);
    const closed = within(table).getByRole('row', { name: /^16.{1,5}22 nov/ });
    expect(
      within(closed)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['5', '36', '1', '0']);
  });

  it('adds the activity minutes of the week', async () => {
    const db = await trainedDb();
    await createRepositories(db).activity.put({
      id: 'a1',
      date: '2026-11-18',
      kind: 'football',
      minutes: 90,
      note: '',
    });
    const { user } = await openProgress({ db });
    const weeks = card('Series por semana');
    await user.click(within(weeks).getByText('Ver datos'));
    const row = within(weeks).getByRole('row', { name: /^16.{1,5}22 nov/ });
    expect(within(row).getAllByRole('cell').at(-1)).toHaveTextContent('90');
  });
});

describe('Progress · by exercise', () => {
  it('starts on the exercise with the latest session, deload sessions not drawn', async () => {
    const { user } = await openProgress();
    const exercise = card('Por ejercicio');
    expect(within(exercise).getByRole('combobox', { name: 'Ejercicio' })).toHaveValue('remo-t');
    expect(
      within(exercise).getByText(/Las semanas de descarga no se dibujan\./),
    ).toBeInTheDocument();
    await user.click(within(exercise).getByText('Ver datos'));
    const table = within(exercise).getByRole('table', { name: 'Remo en T' });
    // r1 (100 kg × 5), r2 (105) and r3 (110): the 200 kg session of the deload week is left out.
    const values = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getByRole('cell').textContent);
    expect(values).toEqual(['116,7 kg', '122,5 kg', '128,3 kg']);
    expect(
      within(exercise).getByRole('img', {
        name: /Remo en T: gráfica de líneas, 3 puntos, de 116,7 kg a 128,3 kg/,
      }),
    ).toBeInTheDocument();
    expect(within(exercise).getByRole('link', { name: /Ver ficha/ })).toHaveAttribute(
      'href',
      '/exercises/remo-t',
    );
  });

  it('changes exercise and remembers the choice', async () => {
    const { user } = await openProgress();
    const exercise = card('Por ejercicio');
    await user.selectOptions(
      within(exercise).getByRole('combobox', { name: 'Ejercicio' }),
      'press-inclinado-mancuernas',
    );
    expect(
      within(exercise).getByRole('img', {
        name: /^Press inclinado con mancuernas: gráfica de líneas, 1 punto/,
      }),
    ).toBeInTheDocument();
    expect(within(exercise).queryByText(/Las semanas de descarga/)).not.toBeInTheDocument();
    expect(localStorage.getItem('certavi.progress.exercise')).toBe('press-inclinado-mancuernas');
  });

  it('opens on the remembered exercise', async () => {
    localStorage.setItem('certavi.progress.exercise', 'press-inclinado-mancuernas');
    await openProgress();
    expect(within(card('Por ejercicio')).getByRole('combobox', { name: 'Ejercicio' })).toHaveValue(
      'press-inclinado-mancuernas',
    );
  });

  it('charts total repetitions for a bodyweight exercise', async () => {
    const db = await trainedDb();
    const repos = createRepositories(db);
    await repos.session.put(makeSession({ id: 'd1', date: '2026-11-26' }));
    await repos.set.putMany([
      makeSet({ sessionId: 'd1', exerciseId: 'dominadas', weight: 0, reps: 8, slot: 0 }),
      makeSet({ sessionId: 'd1', exerciseId: 'dominadas', weight: 0, reps: 7, slot: 1 }),
    ]);
    await openProgress({ db });
    const exercise = card('Por ejercicio');
    expect(within(exercise).getByText('Repeticiones totales por sesión.')).toBeInTheDocument();
    expect(
      within(exercise).getByRole('img', { name: /Dominadas.*de 15 reps a 15 reps/ }),
    ).toBeInTheDocument();
  });
});

describe('Progress · how you arrive', () => {
  it('averages the answers of each week', async () => {
    const { user } = await openProgress();
    const readiness = card('Cómo llegas a entrenar');
    await user.click(within(readiness).getByText('Ver datos'));
    const rows = within(within(readiness).getByRole('table')).getAllByRole('row').slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((c) => c.textContent),
      ),
    ).toEqual([
      ['3', '1'],
      ['4', '1'],
    ]);
    expect(
      within(readiness).getByRole('img', { name: /gráfica de líneas, 2 puntos, de 1 a 5/ }),
    ).toBeInTheDocument();
  });

  it('explains how it will show up when nothing was answered', async () => {
    const db = await seededDb();
    await createRepositories(db).session.put(makeSession({ id: 's1', date: '2026-11-24' }));
    await openProgress({ db });
    expect(
      within(card('Cómo llegas a entrenar')).getByText(/Aparecerá cuando marques/),
    ).toBeInTheDocument();
  });
});

describe('Progress · cycle review', () => {
  it('compares the first two weeks with the last one in the basic lifts', async () => {
    await openProgress();
    const review = card(/Revisión del ciclo/);
    expect(within(review).getByText(/Faltan 12 días\./)).toBeInTheDocument();
    const row = within(review).getByRole('row', { name: /Remo en T/ });
    expect(
      within(row)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['116,7', '128,3', '+10,0 %']);
    expect(within(row).getByRole('link', { name: 'Remo en T' })).toHaveAttribute(
      'href',
      '/exercises/remo-t',
    );
    expect(within(review).getByText(/1 básico sube · 0 planos o bajando/)).toBeInTheDocument();
    expect(
      within(review).getByText(
        /Cómo llegas: 3 las 2 primeras semanas → 4 la última · mejor que al principio/,
      ),
    ).toBeInTheDocument();
    expect(within(review).getByText(/Pesos que suben y llegas con ganas/)).toBeInTheDocument();
  });

  it('is not available before the fourth week', async () => {
    vi.setSystemTime(new Date(2026, 10, 10, 9, 30)); // week 3
    await openProgress();
    const review = card(/Revisión del ciclo/);
    expect(within(review).getByText(/Aparecerá a partir de la cuarta semana/)).toBeInTheDocument();
    expect(within(review).queryByRole('table')).not.toBeInTheDocument();
  });

  it('says so when no basic lift has data in both periods', async () => {
    const db = await seededDb();
    const repos = createRepositories(db);
    await repos.session.putMany([
      makeSession({ id: 'a', date: '2026-10-27' }),
      makeSession({ id: 'b', date: '2026-11-24' }),
    ]);
    await repos.set.putMany(work('a', 'remo-t', [100]));
    await openProgress({ db });
    expect(
      within(card(/Revisión del ciclo/)).getByText(/Todavía no hay básicos/),
    ).toBeInTheDocument();
  });

  it('counts down in the singular and, after the review date, compares without a countdown', async () => {
    vi.setSystemTime(new Date(2026, 11, 6, 9, 30));
    const db = await trainedDb();
    await openProgress({ db });
    expect(within(card(/Revisión del ciclo/)).getByText(/Falta 1 día\./)).toBeInTheDocument();
  });

  it('after the review date, the intro has no countdown', async () => {
    vi.setSystemTime(new Date(2026, 11, 8, 9, 30));
    await openProgress();
    expect(
      within(card(/Revisión del ciclo/)).getByText(/^Comparación entre tus 2 primeras/),
    ).toBeInTheDocument();
  });
});

describe('Progress · records', () => {
  it('lists the latest record events, never from a deload week', async () => {
    await openProgress();
    const records = card('Últimos récords');
    const items = within(records).getAllByRole('link');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Remo en T');
    expect(items[0]).toHaveTextContent(/peso máximo/);
    expect(items[0]).toHaveTextContent('110 kg');
    expect(items[0]).toHaveTextContent('antes 105 kg');
    expect(items[1]).toHaveTextContent('105 kg');
    expect(items[1]).toHaveTextContent('antes 100 kg');
    expect(items[0]).toHaveAttribute('href', '/exercises/remo-t');
  });

  it('says when there are none, and names an estimated 1RM record', async () => {
    const db = await seededDb();
    const repos = createRepositories(db);
    await repos.session.putMany([
      makeSession({ id: 'a', date: '2026-11-03' }),
      makeSession({ id: 'b', date: '2026-11-10' }),
    ]);
    await repos.set.putMany(work('a', 'remo-t', [100], 5));
    await openProgress({ db });
    expect(
      within(card('Últimos récords')).getByText(/aparecen a partir de la segunda sesión/),
    ).toBeInTheDocument();
  });

  it('names a record that improved the estimated 1RM at the same weight', async () => {
    const db = await seededDb();
    const repos = createRepositories(db);
    await repos.session.putMany([
      makeSession({ id: 'a', date: '2026-11-03' }),
      makeSession({ id: 'b', date: '2026-11-10' }),
    ]);
    await repos.set.putMany([...work('a', 'remo-t', [100], 5), ...work('b', 'remo-t', [100], 8)]);
    await openProgress({ db });
    expect(within(card('Últimos récords')).getByText(/1RM estimado \(100×8\)/)).toBeInTheDocument();
  });
});

describe('Progress · body weight', () => {
  it('draws one point per week and lists them', async () => {
    const { user } = await openProgress();
    const weight = card('Peso corporal');
    expect(
      within(weight).getByRole('img', {
        name: /gráfica de líneas, 3 puntos, de 81,5 kg a 82,4 kg/,
      }),
    ).toBeInTheDocument();
    await user.click(within(weight).getByText('Ver datos'));
    const rows = within(within(weight).getByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getByRole('cell').textContent)).toEqual([
      '82,4',
      '82',
      '81,5',
    ]);
  });

  it('suggests where to add the weight when there is none', async () => {
    const db = await seededDb();
    await createRepositories(db).session.put(makeSession({ id: 's1', date: '2026-11-24' }));
    await openProgress({ db });
    expect(within(card('Peso corporal')).getByText(/Aún no hay peso guardado/)).toBeInTheDocument();
  });
});

describe('Progress · English', () => {
  it('speaks English', async () => {
    const { user } = await openProgress({ locale: 'en' });
    expect(screen.getByRole('heading', { name: 'Sets per week', level: 2 })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Latest records', level: 2 })).toBeVisible();
    const groups = card('Sets per muscle group');
    expect(within(groups).getByText(/^Chest: 5 of \d+ sets$/)).toBeInTheDocument();
    await user.click(within(card('Body weight')).getByText('Show data'));
    expect(screen.getByRole('table', { name: 'Body weight per week' })).toBeInTheDocument();
    expect(within(card(/Cycle review/)).getByText(/12 days to go\./)).toBeInTheDocument();
  });
});

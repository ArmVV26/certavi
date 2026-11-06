import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { straightSets, topBackoff, type PlanItem, type SetEntry } from '../../domain';
import { makeSession, makeSet } from '../../domain/testing/builders';
import type { CertaviDb } from '../../data/db';
import { createRepositories } from '../../data/repository';
import { ensureSeed } from '../../data/seed';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';
import type { Locale } from '../../i18n/locale';

beforeEach(() => {
  localStorage.clear();
});

const plan = (exerciseId: string, scheme: PlanItem['scheme'], optional = false): PlanItem => ({
  exerciseId,
  scheme,
  optional,
});

/** Remo en T (straps, top + 2 back-offs), Press de pecho (top + 1) and Dominadas (band). */
const ITEMS: PlanItem[] = [
  plan('remo-t', topBackoff(2)),
  plan('press-pecho-vertical', topBackoff(1)),
  plan('dominadas', straightSets('~10', 3, '1-2')),
];

async function seededDb() {
  const db = openTestDatabase();
  await ensureSeed(db);
  return db;
}

interface Options {
  db?: CertaviDb;
  items?: PlanItem[];
  date?: string;
  endedAt?: number | null;
  locale?: Locale;
  routineId?: string | null;
}

async function open({
  db: given,
  items = ITEMS,
  date = '2026-11-03',
  endedAt = null,
  locale,
  routineId = null,
}: Options = {}) {
  const db = given ?? (await seededDb());
  const repos = createRepositories(db);
  await repos.session.put(
    makeSession({
      id: 's1',
      date,
      routineId,
      startedAt: new Date(2026, 10, 3, 18, 0).getTime(),
      endedAt,
      items,
    }),
  );
  const user = userEvent.setup();
  const app = renderApp('/session/s1', { db, ...(locale ? { locale } : {}) });
  await screen.findByRole('heading', { level: 2 });
  return { repos, user, ...app };
}

const card = (name: string) => {
  const article = screen.getByRole('heading', { name, level: 3 }).closest('article');
  if (!article) throw new Error(`no card for ${name}`);
  return within(article);
};
/** The n-th "mark set done" button of a card. */
interface WithButtons {
  getAllByRole: (role: 'button', options: { name: string }) => HTMLElement[];
}
const doneButton = (scope: WithButtons, index: number) => {
  const button = scope.getAllByRole('button', { name: 'Marcar serie hecha' })[index];
  if (!button) throw new Error(`no ✓ button ${String(index)}`);
  return button;
};
const loggedSets = async (db: CertaviDb) =>
  (await db.sets.toArray())
    .filter((s): s is SetEntry => !('deleted' in s) && s.sessionId === 's1')
    .sort((a, b) => a.slot - b.slot);

describe('the session card', () => {
  it('shows a routine session with its date, state, summary and one card per exercise', async () => {
    const db = await seededDb();
    const pull = await db.routines.get('pull');
    await open({
      db,
      routineId: 'pull',
      endedAt: new Date(2026, 10, 3, 19, 15).getTime(),
      items: pull && !pull.deleted ? pull.items : [],
    });

    expect(screen.getByRole('heading', { name: 'Pull', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sesión');
    expect(screen.getByText('martes, 3 de noviembre · 18:00')).toBeInTheDocument();
    expect(screen.getByText('Terminada')).toBeInTheDocument();
    expect(screen.getByText('8 ejercicios · 23 series')).toBeInTheDocument();
    expect(screen.getByText('0 de 23 hechas')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(8);
    expect(screen.getByRole('heading', { name: 'Remo en T', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('Opcional')).toBeInTheDocument();
    expect(
      screen.getByText('Sesión terminada. Puedes corregir cualquier dato: se guarda al momento.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Series efectivas')).toBeInTheDocument();
  });

  it('shows a free session without exercises, still able to take notes and be finished', async () => {
    await open({ items: [] });
    expect(screen.getByRole('heading', { name: 'Sesión libre' })).toBeInTheDocument();
    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(screen.getByText('Sin ejercicios todavía.')).toBeInTheDocument();
    expect(screen.getByLabelText('Notas de la sesión')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminar sesión' })).toBeInTheDocument();
  });

  it('falls back to "Sesión libre" when the routine was deleted', async () => {
    const db = await seededDb();
    await createRepositories(db).routine.remove('upper');
    await open({ db, routineId: 'upper', items: [] });
    expect(screen.getByRole('heading', { name: 'Sesión libre' })).toBeInTheDocument();
  });

  it('says when the session does not exist and links back to Today', async () => {
    const user = userEvent.setup();
    renderApp('/session/does-not-exist', { db: await seededDb() });
    expect(await screen.findByRole('heading', { name: 'Sesión no encontrada' })).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Volver a Hoy' }));
    expect(await screen.findByRole('heading', { name: 'La sesión de hoy' })).toBeInTheDocument();
  });

  it('reads in English', async () => {
    await open({ locale: 'en' });
    expect(screen.getByRole('heading', { name: 'Free session' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Session');
    expect(screen.getByText('Tuesday 3 November · 18:00')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('0 of 8 done')).toBeInTheDocument();
    expect(screen.getByText('How do you feel?')).toBeInTheDocument();
    expect(card('T-bar row').getAllByRole('button', { name: 'Mark set done' })).toHaveLength(3);
  });

  it('warns about a deload week', async () => {
    const db = await seededDb();
    await createRepositories(db).weekPlan.put({
      id: 'week_2026-11-02',
      week: '2026-11-02',
      hiking: false,
      deload: true,
      size: 5,
    });
    await open({ db });
    expect(screen.getByText(/^Semana de descarga\./)).toBeInTheDocument();
  });
});

describe('logging sets', () => {
  it('logs a typed set, counts it and keeps it', async () => {
    const { db, user } = await open();
    const remo = card('Remo en T');
    await user.type(remo.getByLabelText('Peso de la serie 1'), '60');
    await user.type(remo.getByLabelText('Repeticiones de la serie 1'), '8');
    await user.selectOptions(remo.getByLabelText('RIR de la serie 1'), '2');
    await user.click(doneButton(remo, 0));

    expect(await screen.findByText('1 de 8 hechas')).toBeInTheDocument();
    expect(remo.getAllByRole('button', { name: 'Serie hecha (pulsa para quitar)' })).toHaveLength(
      1,
    );
    const [set] = await loggedSets(db);
    expect(set).toMatchObject({
      exerciseId: 'remo-t',
      slot: 0,
      kind: 'top',
      weight: 60,
      reps: 8,
      rir: 2,
      straps: true,
    });
  });

  it('saves "Anterior" when ✓ is pressed on an empty row', async () => {
    const db = await seededDb();
    const repos = createRepositories(db);
    await repos.session.put(makeSession({ id: 'old', date: '2026-10-27' }));
    await repos.set.putMany([
      makeSet({
        sessionId: 'old',
        exerciseId: 'remo-t',
        kind: 'top',
        slot: 0,
        weight: 62.5,
        reps: 8,
      }),
      makeSet({
        sessionId: 'old',
        exerciseId: 'remo-t',
        kind: 'backoff',
        slot: 1,
        weight: 57.5,
        reps: 10,
      }),
    ]);
    const { user } = await open({ db });
    const remo = card('Remo en T');
    expect(remo.getByText('62,5 × 8')).toBeInTheDocument();
    expect(remo.getAllByText('57,5 × 10')).toHaveLength(2);
    expect(
      remo.getByText(/^Última vez \(27 oct\): 62,5 kg × 8 · 57,5 kg × 10$/),
    ).toBeInTheDocument();
    expect(remo.getByText('Sube a 65 kg')).toBeInTheDocument();

    await user.click(doneButton(remo, 0));
    await waitFor(async () => {
      expect(await loggedSets(db)).toHaveLength(1);
    });
    expect((await loggedSets(db))[0]).toMatchObject({ weight: 62.5, reps: 8, rir: null });
  });

  it('shows "Sin registros previos" and does not save an empty row without a reference', async () => {
    const { db, user } = await open();
    const remo = card('Remo en T');
    expect(remo.getByText('Sin registros previos')).toBeInTheDocument();
    await user.click(doneButton(remo, 0));
    expect(remo.getByLabelText('Peso de la serie 1')).toBeInvalid();
    expect(remo.getByLabelText('Peso de la serie 1')).toHaveFocus();
    expect(await loggedSets(db)).toEqual([]);
    expect(screen.getByText('0 de 8 hechas')).toBeInTheDocument();
  });

  it('accepts 0 kg and rejects missing or zero reps', async () => {
    const { db, user } = await open();
    const press = card('Press de pecho en máquina vertical');
    await user.type(press.getByLabelText('Peso de la serie 1'), '0');
    await user.click(doneButton(press, 0));
    expect(press.getByLabelText('Repeticiones de la serie 1')).toBeInvalid();
    expect(await loggedSets(db)).toEqual([]);
    await user.type(press.getByLabelText('Repeticiones de la serie 1'), '10');
    await user.click(doneButton(press, 0));
    await waitFor(async () => {
      expect(await loggedSets(db)).toHaveLength(1);
    });
    expect((await loggedSets(db))[0]).toMatchObject({ weight: 0, reps: 10 });
  });

  it('takes an empty "Lastre" as 0 kg for bodyweight exercises', async () => {
    const { db, user } = await open();
    const pullups = card('Dominadas');
    await user.type(pullups.getByLabelText('Repeticiones de la serie 1'), '8');
    await user.click(doneButton(pullups, 0));
    await waitFor(async () => {
      expect(await loggedSets(db)).toHaveLength(1);
    });
    expect((await loggedSets(db))[0]).toMatchObject({
      exerciseId: 'dominadas',
      weight: 0,
      reps: 8,
    });
    expect(pullups.getByText('Lastre')).toBeInTheDocument();
  });

  it('corrects a saved set when the field loses focus, and un-saves it after confirming', async () => {
    const { db, user } = await open();
    const remo = card('Remo en T');
    await user.type(remo.getByLabelText('Peso de la serie 1'), '60');
    await user.type(remo.getByLabelText('Repeticiones de la serie 1'), '8');
    await user.click(doneButton(remo, 0));
    await screen.findByText('1 de 8 hechas');

    const reps = remo.getByLabelText('Repeticiones de la serie 1');
    await user.clear(reps);
    await user.type(reps, '9');
    await user.tab();
    await waitFor(async () => {
      expect((await loggedSets(db))[0]?.reps).toBe(9);
    });

    await user.click(remo.getByRole('button', { name: 'Serie hecha (pulsa para quitar)' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Quitar esta serie del registro?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(await loggedSets(db)).toHaveLength(1);
    await user.click(remo.getByRole('button', { name: 'Serie hecha (pulsa para quitar)' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Quitar' }),
    );
    expect(await screen.findByText('0 de 8 hechas')).toBeInTheDocument();
    expect(await loggedSets(db)).toEqual([]);
    expect(remo.getAllByRole('button', { name: 'Marcar serie hecha' })).toHaveLength(3);
  });

  it('suggests the back-off while the top weight is typed, without filling any field', async () => {
    const { user } = await open();
    const remo = card('Remo en T');
    expect(remo.queryByText(/Back-off sugerido/)).not.toBeInTheDocument();
    await user.type(remo.getByLabelText('Peso de la serie 1'), '65');
    expect(remo.getByText('Back-off sugerido: 57,5 kg (−10 % del top)')).toBeInTheDocument();
    expect(remo.getByLabelText('Peso de la serie 2')).toHaveValue('');
  });

  it('folds an exercise when its last working set is saved and unfolds it from the heading', async () => {
    const db = await seededDb();
    const { user } = await open({
      db,
      items: [plan('aperturas-maquina', straightSets('10-15', 2))],
    });
    const aperturas = card('Aperturas en máquina');
    for (const n of [1, 2]) {
      await user.type(aperturas.getByLabelText(`Peso de la serie ${String(n)}`), '30');
      await user.type(aperturas.getByLabelText(`Repeticiones de la serie ${String(n)}`), '12');
      await user.click(doneButton(aperturas, 0));
      await screen.findByText(`${String(n)} de 2 hechas`);
    }
    expect(aperturas.getByText('Completo')).toBeInTheDocument();
    expect(aperturas.getByText('30 × 12 · 30 × 12')).toBeInTheDocument();
    expect(aperturas.queryByLabelText('Peso de la serie 1')).not.toBeInTheDocument();
    await user.click(aperturas.getByRole('button', { name: 'Aperturas en máquina' }));
    expect(aperturas.getByLabelText('Peso de la serie 1')).toHaveValue('30');
  });
});

describe('rows', () => {
  it('adds a warm-up on top with the focus in its weight, outside the progress', async () => {
    const { db, user } = await open();
    const remo = card('Remo en T');
    await user.click(remo.getByRole('button', { name: '+ Calentamiento' }));
    const weight = await remo.findByLabelText('Peso de la serie C1');
    expect(weight).toHaveFocus();
    expect(remo.getAllByText('no cuenta')).toHaveLength(1);
    await user.type(weight, '20');
    await user.type(remo.getByLabelText('Repeticiones de la serie C1'), '10');
    await user.click(doneButton(remo, 0));
    await waitFor(async () => {
      expect(await loggedSets(db)).toHaveLength(1);
    });
    expect((await loggedSets(db))[0]).toMatchObject({ kind: 'warmup', slot: 0, weight: 20 });
    expect(screen.getByText('0 de 8 hechas')).toBeInTheDocument();
    expect(remo.getByLabelText('Peso de la serie 1')).toBeInTheDocument();
  });

  it('shows the warm-up symbol as W in English', async () => {
    const { user } = await open({ locale: 'en' });
    const remo = card('T-bar row');
    await user.click(remo.getByRole('button', { name: '+ Warm-up' }));
    expect(await remo.findByLabelText('Weight of set W1')).toBeInTheDocument();
    expect(remo.getByRole('button', { name: 'Type of set W1: warm-up' })).toHaveTextContent('W');
  });

  it('adds an extra set at the bottom that counts as effective', async () => {
    const { db, user } = await open();
    const remo = card('Remo en T');
    await user.click(remo.getByRole('button', { name: '+ Serie extra' }));
    const weight = await remo.findByLabelText('Peso de la serie 4');
    expect(remo.getByText('Extra')).toBeInTheDocument();
    await user.type(weight, '40');
    await user.type(remo.getByLabelText('Repeticiones de la serie 4'), '12');
    await user.click(doneButton(remo, 3));
    await waitFor(async () => {
      expect(await loggedSets(db)).toHaveLength(1);
    });
    expect((await loggedSets(db))[0]).toMatchObject({ kind: 'extra', slot: 3 });
    expect(screen.getByText('0 de 8 hechas')).toBeInTheDocument();
  });

  it('removes a row of the routine after confirming, moving the rows below up', async () => {
    const { db, user } = await open();
    const remo = card('Remo en T');
    for (const n of [1, 2]) {
      await user.type(remo.getByLabelText(`Peso de la serie ${String(n)}`), String(50 + n));
      await user.type(remo.getByLabelText(`Repeticiones de la serie ${String(n)}`), '8');
      await user.click(doneButton(remo, 0));
      await screen.findByText(`${String(n)} de 8 hechas`);
    }
    await user.click(remo.getByRole('button', { name: 'Quitar serie 2' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Quitar la serie 2?' });
    expect(
      within(dialog).getByText(/Se borrará lo registrado \(52 kg × 8\)\. La rutina no cambia\./),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(await loggedSets(db)).toHaveLength(2);

    await user.click(remo.getByRole('button', { name: 'Quitar serie 2' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Quitar' }),
    );
    expect(await screen.findByText('3 ejercicios · 7 series')).toBeInTheDocument();
    expect((await loggedSets(db)).map((s) => [s.slot, s.weight])).toEqual([[0, 51]]);
    expect(remo.queryByRole('button', { name: 'Quitar serie 3' })).not.toBeInTheDocument();
  });

  it('removes an empty row at once and keeps the last row', async () => {
    const { user } = await open({ items: [plan('aperturas-maquina', straightSets('10-15', 2))] });
    const aperturas = card('Aperturas en máquina');
    await user.click(aperturas.getByRole('button', { name: 'Quitar serie 2' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await screen.findByText('0 de 1 hechas')).toBeInTheDocument();
    expect(aperturas.queryByRole('button', { name: /^Quitar serie/ })).not.toBeInTheDocument();
  });

  it('changes the type of a row without moving it', async () => {
    const { db, user } = await open();
    const remo = card('Remo en T');
    await user.type(remo.getByLabelText('Peso de la serie 2'), '50');
    await user.type(remo.getByLabelText('Repeticiones de la serie 2'), '10');
    await user.click(doneButton(remo, 1));
    await screen.findByText('1 de 8 hechas');

    await user.click(remo.getByRole('button', { name: 'Tipo de la serie 2: efectiva' }));
    const sheet = screen.getByRole('dialog', { name: 'Tipo de serie' });
    expect(within(sheet).getByRole('button', { name: 'Efectiva' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(sheet).getByRole('button', { name: 'Calentamiento' }));

    expect(
      await remo.findByRole('button', { name: 'Tipo de la serie C1: calentamiento' }),
    ).toHaveTextContent('C');
    expect(await screen.findByText('0 de 7 hechas')).toBeInTheDocument();
    expect(remo.getByLabelText('Peso de la serie 1')).toBeInTheDocument();
    expect(remo.getByLabelText('Peso de la serie 2')).toBeInTheDocument();
    expect((await loggedSets(db))[0]).toMatchObject({ kind: 'warmup', slot: 1 });

    await user.click(remo.getByRole('button', { name: 'Tipo de la serie C1: calentamiento' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Dropset' }));
    expect(
      await remo.findByRole('button', { name: 'Tipo de la serie D1: dropset' }),
    ).toHaveTextContent('D');
    await user.click(remo.getByRole('button', { name: 'Tipo de la serie D1: dropset' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Efectiva' }));
    expect(
      await remo.findByRole('button', { name: 'Tipo de la serie 2: efectiva' }),
    ).toBeInTheDocument();
    expect(remo.getByText('Serie')).toBeInTheDocument();
    expect((await loggedSets(db))[0]).toMatchObject({ kind: 'straight', slot: 1 });
  });
});

describe('straps, band and notes', () => {
  it('offers to correct the saved sets when straps change', async () => {
    const { db, user } = await open();
    const remo = card('Remo en T');
    const straps = remo.getByRole('switch', { name: 'Con straps' });
    await user.click(straps);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.click(straps);

    for (const n of [1, 2]) {
      await user.type(remo.getByLabelText(`Peso de la serie ${String(n)}`), '50');
      await user.type(remo.getByLabelText(`Repeticiones de la serie ${String(n)}`), '8');
      await user.click(doneButton(remo, 0));
      await screen.findByText(`${String(n)} de 8 hechas`);
    }
    await user.click(straps);
    const dialog = screen.getByRole('alertdialog', {
      name: '¿Corregir también las 2 series ya guardadas?',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Solo las próximas' }));
    expect((await loggedSets(db)).map((s) => s.straps)).toEqual([true, true]);

    await user.click(straps);
    await user.click(straps);
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Corregir las 2 guardadas',
      }),
    );
    await waitFor(async () => {
      expect((await loggedSets(db)).map((s) => s.straps)).toEqual([false, false]);
    });
  });

  it('offers the band field with the bands used before for bodyweight exercises', async () => {
    const db = await seededDb();
    const repos = createRepositories(db);
    await repos.session.put(makeSession({ id: 'old', date: '2026-10-27' }));
    await repos.set.put(
      makeSet({
        sessionId: 'old',
        exerciseId: 'dominadas',
        slot: 0,
        weight: 0,
        reps: 8,
        band: 'roja',
      }),
    );
    await open({ db });
    const pullups = card('Dominadas');
    expect(pullups.getByLabelText('Banda')).toHaveValue('roja');
    expect(pullups.getByText('Última vez (27 oct): 0 kg × 8')).toBeInTheDocument();
  });

  it('saves the note of an exercise and "does not count", and removes it when emptied', async () => {
    const { db, user } = await open();
    const remo = card('Remo en T');
    await user.click(remo.getByRole('button', { name: 'Nota' }));
    await user.type(remo.getByLabelText('Nota del ejercicio'), 'Máquina distinta');
    await user.click(remo.getByRole('checkbox', { name: 'No cuenta para la progresión' }));
    await user.selectOptions(await remo.findByLabelText('Motivo'), 'Máquina ocupada');
    const id = 'note_s1_remo-t';
    await waitFor(async () => {
      expect(await db.notes.get(id)).toMatchObject({
        text: 'Máquina distinta',
        excludeFromProgression: true,
        reason: 'machine-busy',
      });
    });
    expect(remo.getByRole('button', { name: 'Nota ✎' })).toBeInTheDocument();

    await user.clear(remo.getByLabelText('Nota del ejercicio'));
    await user.click(remo.getByRole('checkbox', { name: 'No cuenta para la progresión' }));
    await waitFor(async () => {
      expect(await db.notes.get(id)).toMatchObject({ deleted: true });
    });
  });

  it('ignores a session marked "does not count" as the last time', async () => {
    const db = await seededDb();
    const repos = createRepositories(db);
    await repos.session.putMany([
      makeSession({ id: 'a', date: '2026-10-20' }),
      makeSession({ id: 'b', date: '2026-10-27' }),
    ]);
    await repos.set.putMany([
      makeSet({ sessionId: 'a', exerciseId: 'remo-t', kind: 'top', slot: 0, weight: 60, reps: 8 }),
      makeSet({ sessionId: 'b', exerciseId: 'remo-t', kind: 'top', slot: 0, weight: 30, reps: 8 }),
    ]);
    await repos.note.put({
      id: 'note_b_remo-t',
      sessionId: 'b',
      exerciseId: 'remo-t',
      text: '',
      excludeFromProgression: true,
    });
    await open({ db });
    expect(card('Remo en T').getByText(/^Última vez \(20 oct\): 60 kg × 8$/)).toBeInTheDocument();
  });
});

describe('the whole session', () => {
  it('records "¿cómo llegas?" and the session note, and clears the answer when pressed again', async () => {
    const { db, user } = await open();
    await user.click(screen.getByRole('button', { name: '4' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '4' })).toHaveAttribute('aria-pressed', 'true');
    });
    await user.type(screen.getByLabelText('Notas de la sesión'), 'Hombro molesto');
    await user.tab();
    await waitFor(async () => {
      const row = await db.sessions.get('s1');
      expect(row && !row.deleted && [row.readiness, row.note]).toEqual([4, 'Hombro molesto']);
    });
    await user.click(screen.getByRole('button', { name: '4' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '4' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('finishes and reopens the session', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Terminar sesión' }));
    expect(await screen.findByText('Terminada')).toBeInTheDocument();
    expect(await screen.findByText('Sesión guardada')).toBeInTheDocument();
    expect(screen.getByText('Series efectivas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Marcar como en curso' }));
    expect(await screen.findByText('En curso')).toBeInTheDocument();
  });

  it('deletes the session after confirming and goes back to Today', async () => {
    const { db, user } = await open();
    await user.click(screen.getByRole('button', { name: 'Eliminar sesión' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Eliminar esta sesión?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(await db.sessions.get('s1')).toMatchObject({ date: '2026-11-03' });

    await user.click(screen.getByRole('button', { name: 'Eliminar sesión' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }),
    );
    expect(await screen.findByRole('heading', { name: 'La sesión de hoy' })).toBeInTheDocument();
    expect(await db.sessions.get('s1')).toMatchObject({ deleted: true });
  });
});

describe('typed values', () => {
  it('survive a re-draw and a reload, and are dropped once saved', async () => {
    const { db, user, unmount } = await open();
    const remo = card('Remo en T');
    await user.type(remo.getByLabelText('Peso de la serie 1'), '60');
    await user.type(remo.getByLabelText('Repeticiones de la serie 1'), '8');
    await user.click(remo.getByRole('button', { name: '+ Serie extra' }));
    await user.type(await remo.findByLabelText('Repeticiones de la serie 4'), '10');

    // A change that arrives from outside redraws the screen without touching what is typed.
    await createRepositories(db).session.put(makeSession({ id: 'other', date: '2026-11-01' }));
    expect(remo.getByLabelText('Peso de la serie 1')).toHaveValue('60');

    unmount();
    renderApp('/session/s1', { db });
    await screen.findByRole('heading', { level: 2 });
    const again = card('Remo en T');
    expect(again.getByLabelText('Peso de la serie 1')).toHaveValue('60');
    expect(again.getByLabelText('Repeticiones de la serie 1')).toHaveValue('8');
    expect(again.getByLabelText('Repeticiones de la serie 4')).toHaveValue('10');
    expect(await loggedSets(db)).toEqual([]);
    expect(screen.getByText('0 de 8 hechas')).toBeInTheDocument();

    await userEvent.click(doneButton(again, 0));
    await waitFor(async () => {
      expect(await loggedSets(db)).toHaveLength(1);
    });
    expect(localStorage.getItem('certavi.draft.s1')).not.toContain('"60"');
  });

  it('are dropped when the session is finished', async () => {
    const { user } = await open();
    await user.type(card('Remo en T').getByLabelText('Peso de la serie 1'), '60');
    expect(localStorage.getItem('certavi.draft.s1')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Terminar sesión' }));
    await screen.findByText('Terminada');
    expect(localStorage.getItem('certavi.draft.s1')).toBeNull();
  });
});

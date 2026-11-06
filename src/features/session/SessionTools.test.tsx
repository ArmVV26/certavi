import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { straightSets, topBackoff, type PlanItem, type SetEntry } from '../../domain';
import { makeSession } from '../../domain/testing/builders';
import type { CertaviDb } from '../../data/db';
import { createRepositories } from '../../data/repository';
import { ensureSeed } from '../../data/seed';
import type { Locale } from '../../i18n/locale';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';

beforeEach(() => {
  localStorage.clear();
});

const plan = (exerciseId: string, scheme: PlanItem['scheme']): PlanItem => ({
  exerciseId,
  scheme,
  optional: false,
});

const ITEMS: PlanItem[] = [
  plan('remo-t', topBackoff(2)),
  plan('press-pecho-vertical', topBackoff(1)),
  plan('aperturas-maquina', straightSets('10-15', 2)),
];

interface Options {
  db?: CertaviDb;
  items?: PlanItem[];
  routineId?: string | null;
  locale?: Locale;
}

async function open({ db: given, items = ITEMS, routineId = null, locale }: Options = {}) {
  const db = given ?? openTestDatabase();
  if (!given) await ensureSeed(db);
  const repos = createRepositories(db);
  await repos.session.put(
    makeSession({
      id: 's1',
      date: '2026-11-03',
      routineId,
      startedAt: new Date(2026, 10, 3, 18, 0).getTime(),
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
const titles = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
const liveSets = async (db: CertaviDb) =>
  (await db.sets.toArray()).filter((s): s is SetEntry => !('deleted' in s) && s.sessionId === 's1');

/** Logs 60 kg × 8 in the first empty row of a card. */
async function logFirstRow(user: ReturnType<typeof userEvent.setup>, name: string, n = 1) {
  const scope = card(name);
  await user.type(scope.getByLabelText(`Peso de la serie ${String(n)}`), '60');
  await user.type(scope.getByLabelText(`Repeticiones de la serie ${String(n)}`), '8');
  await user.click(scope.getAllByRole('button', { name: 'Marcar serie hecha' })[0] as HTMLElement);
  await screen.findByRole('button', { name: 'Serie hecha (pulsa para quitar)' });
}

const sheet = () => screen.getByRole('dialog', { name: 'Añadir ejercicio' });

describe('adding an exercise', () => {
  it('gives a free session its first exercise, without the "outside the routine" tag', async () => {
    const { user } = await open({ items: [] });
    expect(screen.getByText('Sin ejercicios todavía.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Añadir ejercicio' }));
    await user.type(within(sheet()).getByLabelText('Buscar ejercicio'), 'remo en t');
    await user.click(within(sheet()).getByRole('button', { name: /^Remo en T/ }));

    expect(await screen.findByRole('heading', { name: 'Remo en T', level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin ejercicios todavía.')).not.toBeInTheDocument();
    expect(screen.queryByText('Fuera de la rutina')).not.toBeInTheDocument();
    expect(screen.getByText(/^1 ejercicios? · \d+ series?$/)).toBeInTheDocument();
    // The focus is requested once the write is confirmed, a moment after the card appears.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remo en T', expanded: true })).toHaveFocus();
    });
  });

  it('tags an exercise added to a routine session as outside the routine', async () => {
    const { user } = await open({ routineId: 'push', items: [ITEMS[1] as PlanItem] });
    await user.click(screen.getByRole('button', { name: '+ Añadir ejercicio' }));
    await user.type(within(sheet()).getByLabelText('Buscar ejercicio'), 'remo en t');
    await user.click(within(sheet()).getByRole('button', { name: /^Remo en T/ }));
    await screen.findByRole('heading', { name: 'Remo en T', level: 3 });
    expect(card('Remo en T').getByText('Fuera de la rutina')).toBeInTheDocument();
    expect(screen.getAllByText('Fuera de la rutina')).toHaveLength(1);
    expect(titles()).toEqual(['Press de pecho en máquina vertical', 'Remo en T']);
  });

  it('filters by text, group and the toggles, and shows what is already in the session', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: '+ Añadir ejercicio' }));
    const panel = within(sheet());

    // An exercise already in the session cannot be chosen again.
    await user.type(panel.getByLabelText('Buscar ejercicio'), 'remo en t');
    const already = panel.getByRole('button', { name: /^Remo en T/ });
    expect(already).toBeDisabled();
    expect(already).toHaveTextContent('Ya está en la sesión');

    await user.clear(panel.getByLabelText('Buscar ejercicio'));
    await user.type(panel.getByLabelText('Buscar ejercicio'), 'REMO');
    const remos = panel.getAllByRole('button', { name: /^Remo/ });
    expect(remos.length).toBeGreaterThan(1);

    await user.click(panel.getByRole('button', { name: 'Espalda', pressed: false }));
    expect(panel.getByRole('button', { name: 'Espalda', pressed: true })).toBeInTheDocument();
    expect(panel.getAllByRole('button', { name: /^Remo/ }).length).toBe(remos.length);

    // One group at a time: choosing another replaces it and nothing matches "remo" there.
    await user.click(panel.getByRole('button', { name: 'Pecho', pressed: false }));
    expect(panel.getByRole('button', { name: 'Espalda', pressed: false })).toBeInTheDocument();
    expect(panel.getByText('Ningún ejercicio coincide')).toBeInTheDocument();

    // Pressing it again clears the filter.
    await user.click(panel.getByRole('button', { name: 'Pecho', pressed: true }));
    expect(panel.getAllByRole('button', { name: /^Remo/ }).length).toBe(remos.length);

    await user.click(panel.getByRole('button', { name: 'Creados por mí', pressed: false }));
    expect(panel.getByText('Ningún ejercicio coincide')).toBeInTheDocument();
    await user.click(panel.getByRole('button', { name: 'Creados por mí', pressed: true }));

    await user.click(panel.getByRole('button', { name: 'Straps', pressed: false }));
    expect(panel.getAllByRole('button', { name: /^Remo/ }).length).toBeGreaterThan(0);
    await user.click(panel.getByRole('button', { name: 'Straps', pressed: true }));
    await user.click(panel.getByRole('button', { name: 'En alguna rutina', pressed: false }));
    expect(panel.getAllByRole('button', { name: /^Remo/ }).length).toBeGreaterThan(0);
    expect(panel.queryByRole('button', { name: /^Curl de bíceps/ })).not.toBeInTheDocument();
  });

  it('starts without filters every time it opens', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: '+ Añadir ejercicio' }));
    await user.type(within(sheet()).getByLabelText('Buscar ejercicio'), 'zzz');
    expect(within(sheet()).getByText('Ningún ejercicio coincide')).toBeInTheDocument();
    await user.click(within(sheet()).getByRole('button', { name: 'Cerrar' }));
    await user.click(screen.getByRole('button', { name: '+ Añadir ejercicio' }));
    expect(within(sheet()).getByLabelText('Buscar ejercicio')).toHaveValue('');
  });
});

describe('moving exercises', () => {
  it('moves a card down and up, keeping the ends disabled', async () => {
    const { db, user } = await open();
    const [a, b, c] = titles() as [string, string, string];
    expect(screen.getByRole('button', { name: `Subir ${a}` })).toBeDisabled();
    expect(screen.getByRole('button', { name: `Bajar ${c}` })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: `Bajar ${a}` }));
    await waitFor(() => {
      expect(titles()).toEqual([b, a, c]);
    });
    await user.click(screen.getByRole('button', { name: `Subir ${c}` }));
    await waitFor(() => {
      expect(titles()).toEqual([b, c, a]);
    });
    const stored = await db.sessions.get('s1');
    expect(stored && !stored.deleted ? stored.items.map((i) => i.exerciseId) : []).toEqual([
      'press-pecho-vertical',
      'aperturas-maquina',
      'remo-t',
    ]);
  });
});

describe('removing an exercise', () => {
  it('asks first when it has saved sets, and Undo brings it back with them', async () => {
    const { db, user } = await open();
    await logFirstRow(user, 'Remo en T');

    await user.click(card('Remo en T').getByRole('button', { name: 'Quitar ejercicio' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Quitar Remo en T de esta sesión?' });
    expect(within(dialog).getByText(/Se borrará su serie\. La rutina no cambia\./)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(titles()).toContain('Remo en T');

    await user.click(card('Remo en T').getByRole('button', { name: 'Quitar ejercicio' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Quitar' }),
    );
    expect(await screen.findByText('Ejercicio quitado')).toBeInTheDocument();
    await waitFor(() => {
      expect(titles()).not.toContain('Remo en T');
    });
    expect(await liveSets(db)).toHaveLength(0);
    expect(await screen.findByText('2 ejercicios · 4 series')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(await screen.findByText('Ejercicio recuperado')).toBeInTheDocument();
    await waitFor(() => {
      expect(titles()[0]).toBe('Remo en T');
    });
    expect(await liveSets(db)).toHaveLength(1);
    expect(await screen.findByText('1 de 7 hechas')).toBeInTheDocument();
  });

  it('removes an exercise with nothing saved at once, and Undo brings it back', async () => {
    const { user } = await open();
    await user.click(
      card('Aperturas en máquina').getByRole('button', { name: 'Quitar ejercicio' }),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Ejercicio quitado')).toBeInTheDocument();
    await waitFor(() => {
      expect(titles()).not.toContain('Aperturas en máquina');
    });

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    await screen.findByText('Ejercicio recuperado');
    await waitFor(() => {
      expect(titles()).toEqual([
        'Remo en T',
        'Press de pecho en máquina vertical',
        'Aperturas en máquina',
      ]);
    });
  });

  it('says it cannot undo when the exercise was added again meanwhile', async () => {
    const { user } = await open();
    await user.click(
      card('Aperturas en máquina').getByRole('button', { name: 'Quitar ejercicio' }),
    );
    await screen.findByText('Ejercicio quitado');

    await user.click(screen.getByRole('button', { name: '+ Añadir ejercicio' }));
    await user.type(within(sheet()).getByLabelText('Buscar ejercicio'), 'aperturas en m');
    await user.click(within(sheet()).getByRole('button', { name: /^Aperturas en máquina/ }));
    await screen.findByRole('heading', { name: 'Aperturas en máquina', level: 3 });

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(
      await screen.findByText('No se puede deshacer: ya hay datos nuevos'),
    ).toBeInTheDocument();
  });

  it('drops the typed values of the removed exercise', async () => {
    const { user } = await open();
    await user.type(card('Aperturas en máquina').getByLabelText('Peso de la serie 1'), '40');
    expect(localStorage.getItem('certavi.draft.s1')).toContain('aperturas-maquina');
    await user.click(
      card('Aperturas en máquina').getByRole('button', { name: 'Quitar ejercicio' }),
    );
    await screen.findByText('Ejercicio quitado');
    await waitFor(() => {
      expect(localStorage.getItem('certavi.draft.s1')).toBeNull();
    });
  });
});

describe('Undo', () => {
  it('brings back a removed row with its saved set, and the rows below move down again', async () => {
    const { db, user } = await open();
    await logFirstRow(user, 'Remo en T');
    await user.type(card('Remo en T').getByLabelText('Peso de la serie 2'), '50');
    await user.type(card('Remo en T').getByLabelText('Repeticiones de la serie 2'), '9');
    await user.click(
      card('Remo en T').getAllByRole('button', { name: 'Marcar serie hecha' })[0] as HTMLElement,
    );
    await screen.findByText('2 de 7 hechas');

    await user.click(card('Remo en T').getByRole('button', { name: 'Quitar serie 1' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Quitar' }),
    );
    expect(await screen.findByText('Serie quitada')).toBeInTheDocument();
    expect(await screen.findByText('1 de 6 hechas')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(await screen.findByText('Serie recuperada')).toBeInTheDocument();
    expect(await screen.findByText('2 de 7 hechas')).toBeInTheDocument();
    expect((await liveSets(db)).map((s) => [s.slot, s.weight]).sort()).toEqual([
      [0, 60],
      [1, 50],
    ]);
  });

  it('brings back a deleted session from Today', async () => {
    const { db, user } = await open();
    await logFirstRow(user, 'Remo en T');
    await user.click(screen.getByRole('button', { name: 'Eliminar sesión' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }),
    );
    expect(await screen.findByRole('heading', { name: 'La sesión de hoy' })).toBeInTheDocument();
    expect(await screen.findByText('Sesión eliminada')).toBeInTheDocument();
    expect(await db.sessions.get('s1')).toMatchObject({ deleted: true });

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(await screen.findByText('Sesión recuperada')).toBeInTheDocument();
    const stored = await db.sessions.get('s1');
    expect(stored).not.toHaveProperty('deleted');
    expect(await liveSets(db)).toHaveLength(1);
  });
});

describe('in English', () => {
  it('reads the new texts in English', async () => {
    const { user } = await open({ locale: 'en', items: [ITEMS[2] as PlanItem] });
    expect(screen.getByRole('button', { name: '+ Add exercise' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Move .* up$/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove exercise' }));
    expect(await screen.findByText('Exercise removed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Exercise restored')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Add exercise' }));
    const panel = within(screen.getByRole('dialog', { name: 'Add exercise' }));
    expect(panel.getByLabelText('Search exercise')).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Created by me' })).toBeInTheDocument();
  });
});

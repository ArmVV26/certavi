import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES_BY_ID, straightSets, topBackoff, type Exercise } from '../../domain';
import type { CertaviDb } from '../../data/db';
import { createRepositories } from '../../data/repository';
import { ensureSeed } from '../../data/seed';
import type { Locale } from '../../i18n/locale';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';
import { openSession, plan } from '../session/testing';

const MINE: Exercise = {
  ...(SEED_EXERCISES_BY_ID.get('remo-t') as Exercise),
  id: 'exe_mine',
  name: { text: 'Press landmine' },
  primaryGroup: 'shoulders',
  secondaryMuscles: ['triceps'],
  equipment: 'barbell',
  kind: 'compound',
  supportsStraps: false,
  unilateral: false,
  defaultScheme: straightSets('8-12', 4, '2'),
  increment: 2.5,
  custom: true,
  archived: false,
};

async function open(path: string, options: { locale?: Locale; withMine?: boolean } = {}) {
  const db = openTestDatabase();
  await ensureSeed(db);
  const repos = createRepositories(db);
  if (options.withMine) await repos.exercise.put(MINE);
  const user = userEvent.setup();
  const app = renderApp(path, { db, ...(options.locale ? { locale: options.locale } : {}) });
  return { repos, user, ...app };
}

const customOnes = async (db: CertaviDb) =>
  (await db.exercises.toArray()).filter((e): e is Exercise => !('deleted' in e) && e.custom);

type User = ReturnType<typeof userEvent.setup>;

async function fillName(user: User, name: string) {
  await user.type(await screen.findByLabelText('Nombre'), name);
}
const save = async (user: User) => {
  await user.click(await screen.findByRole('button', { name: 'Guardar' }));
};

describe('ExerciseFormPage · create', () => {
  it('creates an exercise and opens its page', async () => {
    const { user, db } = await open('/exercises/new');
    expect(await screen.findByRole('heading', { level: 1, name: 'Crear ejercicio' })).toBeVisible();
    await fillName(user, '  Press landmine ');
    await user.selectOptions(screen.getByLabelText('Grupo principal'), 'Hombro');
    await user.selectOptions(screen.getByLabelText('Equipo'), 'Barra');
    await user.click(screen.getByRole('checkbox', { name: 'Tríceps' }));
    await user.click(screen.getByRole('checkbox', { name: 'Usa straps' }));
    await save(user);

    expect(await screen.findByText('Ejercicio creado')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Press landmine' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Propio')).toBeInTheDocument();

    const [created] = await customOnes(db);
    expect(created).toMatchObject({
      name: { text: 'Press landmine' },
      primaryGroup: 'shoulders',
      secondaryMuscles: ['triceps'],
      equipment: 'barbell',
      kind: 'isolation',
      supportsStraps: true,
      increment: 2.5,
      defaultScheme: { blocks: [{ kind: 'straight', reps: '8-12', count: 3 }], rir: '1-2' },
    });
    expect(await db.pending.get(created?.id ?? '')).toBeDefined();
  });

  it('asks for a name, focuses the field and saves nothing', async () => {
    const { user, db } = await open('/exercises/new');
    await save(user);
    expect(await screen.findByText('Escribe un nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Escribe un nombre');
    expect(await customOnes(db)).toEqual([]);
    expect(screen.getByRole('heading', { level: 1, name: 'Crear ejercicio' })).toBeInTheDocument();
  });

  it('rejects a name already used, ignoring case and accents', async () => {
    const { user, db } = await open('/exercises/new');
    await fillName(user, 'REMO en t');
    await save(user);
    expect(await screen.findByText('Ya existe un ejercicio con ese nombre')).toBeInTheDocument();
    expect(await customOnes(db)).toEqual([]);

    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Aperturas EN maquina');
    await save(user);
    expect(await screen.findByText('Ya existe un ejercicio con ese nombre')).toBeInTheDocument();
  });

  it('shows a message under each wrong field', async () => {
    const { user, db } = await open('/exercises/new');
    await fillName(user, 'Curl zottman');
    await user.clear(screen.getByLabelText('Series'));
    await user.type(screen.getByLabelText('Series'), '0');
    await user.clear(screen.getByLabelText('Repeticiones'));
    await user.type(screen.getByLabelText('Repeticiones'), 'abc');
    await user.clear(screen.getByLabelText('RIR'));
    await user.type(screen.getByLabelText('RIR'), 'x');
    await user.clear(screen.getByLabelText('Incremento (kg)'));
    await user.type(screen.getByLabelText('Incremento (kg)'), '0');
    await save(user);

    expect(await screen.findByText('Las series deben ser de 1 a 10')).toBeInTheDocument();
    expect(screen.getByText('Repeticiones no válidas: usa 10, ~10 u 8-12')).toBeInTheDocument();
    expect(screen.getByText('RIR no válido: usa 2 o 1-2, o déjalo vacío')).toBeInTheDocument();
    expect(screen.getByText('El incremento debe estar entre 0,25 y 50 kg')).toBeInTheDocument();
    expect(screen.getByLabelText('Series')).toHaveFocus();
    expect(await customOnes(db)).toEqual([]);
  });

  it('accepts a decimal comma in the step and an empty RIR', async () => {
    const { user, db } = await open('/exercises/new');
    await fillName(user, 'Curl zottman');
    await user.clear(screen.getByLabelText('RIR'));
    await user.clear(screen.getByLabelText('Incremento (kg)'));
    await user.type(screen.getByLabelText('Incremento (kg)'), '1,25');
    await save(user);
    await screen.findByText('Ejercicio creado');
    const [created] = await customOnes(db);
    expect(created).toMatchObject({ increment: 1.25, defaultScheme: { rir: '' } });
  });

  it('suggests the step for the chosen group, equipment and type until the user types one', async () => {
    const { user } = await open('/exercises/new');
    const step = await screen.findByLabelText('Incremento (kg)');
    expect(step).toHaveValue('2,5');
    await user.selectOptions(screen.getByLabelText('Equipo'), 'Mancuernas');
    expect(step).toHaveValue('2');
    await user.selectOptions(screen.getByLabelText('Equipo'), 'Discos');
    await user.selectOptions(screen.getByLabelText('Grupo principal'), 'Cuádriceps');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'Básico');
    expect(step).toHaveValue('5');

    await user.clear(step);
    await user.type(step, '10');
    await user.selectOptions(screen.getByLabelText('Equipo'), 'Mancuernas');
    expect(step).toHaveValue('10');
  });

  it('does not offer the primary group as a secondary muscle and drops it when chosen', async () => {
    const { user } = await open('/exercises/new');
    await user.click(await screen.findByRole('checkbox', { name: 'Tríceps' }));
    expect(screen.queryByRole('checkbox', { name: 'Pecho' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Grupo principal'), 'Tríceps');
    expect(screen.queryByRole('checkbox', { name: 'Tríceps' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Pecho' })).not.toBeChecked();
  });

  it('goes back to the catalog on Cancelar without saving', async () => {
    const { user, db } = await open('/exercises/new');
    await fillName(user, 'Algo');
    await user.click(screen.getByRole('link', { name: 'Cancelar' }));
    expect(await screen.findByRole('list', { name: 'Ejercicios' })).toBeInTheDocument();
    expect(await customOnes(db)).toEqual([]);
  });

  it('lists the new exercise in the catalog and keeps it after a reload', async () => {
    const { user, db, unmount } = await open('/exercises/new');
    await fillName(user, 'Press landmine');
    await save(user);
    await screen.findByText('Ejercicio creado');
    unmount();
    renderApp('/exercises', { db });
    const row = await screen.findByRole('link', { name: /^Press landmine/ });
    expect(row).toHaveTextContent('Pecho · Otro');
    expect(within(row).getByText('Propio')).toBeInTheDocument();
  });
});

describe('ExerciseFormPage · edit', () => {
  it('shows the current values and saves the changes keeping the id', async () => {
    const { user, repos } = await open('/exercises/exe_mine/edit', { withMine: true });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Editar ejercicio' }),
    ).toBeVisible();
    const name = await screen.findByLabelText('Nombre');
    await waitFor(() => {
      expect(name).toHaveValue('Press landmine');
    });
    expect(screen.getByLabelText('Grupo principal')).toHaveValue('shoulders');
    expect(screen.getByLabelText('Equipo')).toHaveValue('barbell');
    expect(screen.getByRole('checkbox', { name: 'Tríceps' })).toBeChecked();
    expect(screen.getByLabelText('Series')).toHaveValue('4');
    expect(screen.getByLabelText('RIR')).toHaveValue('2');

    await user.clear(name);
    await user.type(name, 'Press landmine a una mano');
    await user.selectOptions(screen.getByLabelText('Equipo'), 'Mancuernas');
    await save(user);

    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Press landmine a una mano' }),
    ).toBeInTheDocument();
    expect(await repos.exercise.get('exe_mine')).toMatchObject({
      name: { text: 'Press landmine a una mano' },
      equipment: 'dumbbell',
      // The step was already the exercise's own: changing the equipment does not touch it.
      increment: 2.5,
    });
  });

  it('lets the exercise keep its own name but not take another one', async () => {
    const { user } = await open('/exercises/exe_mine/edit', { withMine: true });
    await waitFor(() => {
      expect(screen.getByLabelText('Nombre')).toHaveValue('Press landmine');
    });
    await save(user);
    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument();
  });

  it('refuses the name of another exercise', async () => {
    const { user } = await open('/exercises/exe_mine/edit', { withMine: true });
    const name = await screen.findByLabelText('Nombre');
    await waitFor(() => {
      expect(name).toHaveValue('Press landmine');
    });
    await user.clear(name);
    await user.type(name, 'Remo en T');
    await save(user);
    expect(await screen.findByText('Ya existe un ejercicio con ese nombre')).toBeInTheDocument();
  });

  it('sends a seed exercise to its page instead of the form', async () => {
    await open('/exercises/remo-t/edit');
    expect(await screen.findByRole('heading', { level: 2, name: 'Remo en T' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
  });

  it('says so for an exercise that does not exist', async () => {
    await open('/exercises/nope/edit');
    expect(await screen.findByText('No encontramos este ejercicio')).toBeInTheDocument();
  });
});

describe('ExerciseFormPage · from a session', () => {
  const items = [plan('remo-t', topBackoff(2))];

  it('adds the new exercise at the end of the session and goes back to it', async () => {
    const { user, repos } = await openSession({ items });
    await user.click(screen.getByRole('button', { name: '+ Añadir ejercicio' }));
    const sheet = await screen.findByRole('dialog', { name: 'Añadir ejercicio' });
    await user.click(within(sheet).getByRole('button', { name: 'Crear ejercicio' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Crear ejercicio' })).toBeVisible();
    await fillName(user, 'Press landmine');
    await save(user);

    expect(await screen.findByText('Ejercicio creado y añadido a la sesión')).toBeInTheDocument();
    const titles = await screen.findAllByRole('heading', { level: 3 });
    expect(titles.map((h) => h.textContent)).toEqual(['Remo en T', 'Press landmine']);
    const session = await repos.session.get('s1');
    expect(session?.items.map((i) => i.exerciseId)).toHaveLength(2);
    expect(session?.items[1]).toMatchObject({ optional: false });
    expect(session?.items[1]).not.toHaveProperty('added');
  });

  it('goes back to the session on Cancelar without adding anything', async () => {
    const { user, repos } = await openSession({ items });
    await user.click(screen.getByRole('button', { name: '+ Añadir ejercicio' }));
    const sheet = await screen.findByRole('dialog', { name: 'Añadir ejercicio' });
    await user.click(within(sheet).getByRole('button', { name: 'Crear ejercicio' }));
    await user.click(await screen.findByRole('link', { name: 'Cancelar' }));

    expect(await screen.findByRole('heading', { level: 3, name: 'Remo en T' })).toBeInTheDocument();
    expect((await repos.session.get('s1'))?.items).toHaveLength(1);
  });

  it('offers the exercise in the sheet of an open session once created', async () => {
    const { user, repos } = await openSession({ items });
    await repos.exercise.put(MINE);
    await user.click(screen.getByRole('button', { name: '+ Añadir ejercicio' }));
    const sheet = await screen.findByRole('dialog', { name: 'Añadir ejercicio' });
    await user.type(within(sheet).getByLabelText('Buscar ejercicio'), 'landmine');
    expect(within(sheet).getByRole('button', { name: /Press landmine/ })).toHaveTextContent(
      'Hombro · Barra',
    );
  });
});

describe('ExerciseFormPage · English', () => {
  it('speaks English', async () => {
    const { user } = await open('/exercises/new', { locale: 'en' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Create exercise' })).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a name')).toBeInTheDocument();
    expect(screen.getByLabelText('Weight step (kg)')).toHaveValue('2.5');
    expect(screen.getByRole('checkbox', { name: 'Uses straps' })).toBeInTheDocument();
  });
});

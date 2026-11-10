import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES_BY_ID, straightSets, type Exercise } from '../../domain';
import { makeSession, makeSet, makeWeekPlan } from '../../domain/testing/builders';
import { createRepositories } from '../../data/repository';
import { ensureSeed } from '../../data/seed';
import type { Locale } from '../../i18n/locale';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';

const MINE: Exercise = {
  ...(SEED_EXERCISES_BY_ID.get('remo-t') as Exercise),
  id: 'exe_mine',
  name: { text: 'Press landmine' },
  primaryGroup: 'shoulders',
  secondaryMuscles: ['triceps', 'chest'],
  equipment: 'barbell',
  kind: 'compound',
  supportsStraps: false,
  unilateral: true,
  defaultScheme: straightSets('8-12', 4, '1-2'),
  increment: 2.5,
  custom: true,
  archived: false,
};

async function open(id: string, options: { locale?: Locale; mine?: Partial<Exercise> } = {}) {
  const db = openTestDatabase();
  await ensureSeed(db);
  const repos = createRepositories(db);
  await repos.exercise.put({ ...MINE, ...options.mine });
  const user = userEvent.setup();
  const app = renderApp(`/exercises/${id}`, {
    db,
    ...(options.locale ? { locale: options.locale } : {}),
  });
  return { repos, user, ...app };
}

describe('ExerciseDetailPage', () => {
  it('shows the data of a seed exercise that was never logged, with no edit or archive', async () => {
    await open('remo-t');
    expect(await screen.findByRole('heading', { level: 2, name: 'Remo en T' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Ejercicio' })).toBeInTheDocument();
    const facts = within(
      screen.getByRole('heading', { name: 'Datos' }).closest('section') as HTMLElement,
    );
    expect(facts.getByText('Grupo principal').nextSibling).toHaveTextContent('Espalda');
    expect(facts.getByText('Equipo').nextSibling).toHaveTextContent('Discos');
    expect(facts.getByText('Tipo').nextSibling).toHaveTextContent('Básico');
    expect(facts.getByText('Straps').nextSibling).toHaveTextContent('Sí');
    expect(facts.getByText('Unilateral').nextSibling).toHaveTextContent('No');
    expect(facts.getByText('Esquema por defecto').nextSibling).toHaveTextContent(
      '3 series · RIR 1-2',
    );
    expect(screen.getByRole('heading', { name: 'En rutinas' }).nextSibling).toHaveTextContent(
      'Pull',
    );
    expect(screen.getByText('Aún no has registrado este ejercicio')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Récords' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Historial' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archivar' })).not.toBeInTheDocument();
    expect(screen.queryByText('Propio')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Ejercicios' })).toHaveAttribute(
      'href',
      '/exercises',
    );
  });

  it('shows "In no routine" for an exercise that is in none', async () => {
    await open('dominadas');
    expect(await screen.findByText('En ninguna rutina')).toBeInTheDocument();
  });

  it('shows the records and the history, newest first', async () => {
    const { repos } = await open('remo-t');
    await screen.findByRole('heading', { level: 2, name: 'Remo en T' });
    await repos.session.putMany([
      makeSession({ id: 'old', date: '2026-10-26' }),
      makeSession({ id: 'new', date: '2026-11-02' }),
      makeSession({ id: 'deload', date: '2026-10-19' }),
    ]);
    await repos.weekPlan.put(makeWeekPlan({ week: '2026-10-19', deload: true }));
    await repos.set.putMany([
      makeSet({ id: 'a', sessionId: 'old', exerciseId: 'remo-t', weight: 60, reps: 8, slot: 0 }),
      makeSet({ id: 'b', sessionId: 'old', exerciseId: 'remo-t', weight: 55, reps: 10, slot: 1 }),
      makeSet({ id: 'c', sessionId: 'new', exerciseId: 'remo-t', weight: 70, reps: 6 }),
      makeSet({ id: 'd', sessionId: 'deload', exerciseId: 'remo-t', weight: 100, reps: 6 }),
    ]);

    const records = (await screen.findByRole('heading', { name: 'Récords' })).closest(
      'section',
    ) as HTMLElement;
    expect(within(records).getByText('Peso máximo').nextSibling).toHaveTextContent('70 kg × 6');
    expect(within(records).getByText('1RM estimado').nextSibling).toHaveTextContent('84 kg');
    expect(within(records).getByText('Mejor volumen')).toBeInTheDocument();
    expect(within(records).getByText('Mejores marcas por repeticiones')).toBeInTheDocument();
    expect(within(records).getByText('6 reps · 70 kg')).toBeInTheDocument();

    const items = within(
      screen.getByRole('heading', { name: 'Historial' }).closest('section') as HTMLElement,
    ).getAllByRole('link');
    expect(items.map((item) => item.getAttribute('href'))).toEqual([
      '/session/new',
      '/session/old',
      '/session/deload',
    ]);
    expect(items[0]).toHaveTextContent('70 × 6');
    expect(items[1]).toHaveTextContent('60 × 8 · 55 × 10');
    expect(within(items[2] as HTMLElement).getByText('Descarga')).toBeInTheDocument();
  });

  it('charts the evolution of the exercise by metric, leaving out deload sessions', async () => {
    const { repos, user } = await open('remo-t');
    await screen.findByRole('heading', { level: 2, name: 'Remo en T' });
    await repos.session.putMany([
      makeSession({ id: 'old', date: '2026-10-26' }),
      makeSession({ id: 'new', date: '2026-11-02' }),
      makeSession({ id: 'deload', date: '2026-10-19' }),
    ]);
    await repos.weekPlan.put(makeWeekPlan({ week: '2026-10-19', deload: true }));
    await repos.set.putMany([
      makeSet({ id: 'a', sessionId: 'old', exerciseId: 'remo-t', weight: 60, reps: 8, slot: 0 }),
      makeSet({ id: 'b', sessionId: 'old', exerciseId: 'remo-t', weight: 55, reps: 10, slot: 1 }),
      makeSet({ id: 'c', sessionId: 'new', exerciseId: 'remo-t', weight: 70, reps: 6 }),
      makeSet({ id: 'd', sessionId: 'deload', exerciseId: 'remo-t', weight: 100, reps: 6 }),
    ]);

    const evolution = (await screen.findByRole('heading', { name: 'Evolución' })).closest(
      'section',
    ) as HTMLElement;
    const card = within(evolution);
    expect(card.getByRole('radio', { name: '1RM estimado' })).toBeChecked();
    expect(card.getByText('Las semanas de descarga no se dibujan.')).toBeInTheDocument();
    expect(
      card.getByRole('img', {
        name: /Remo en T · 1RM estimado: gráfica de líneas, 2 puntos, de 76 kg a 84 kg/,
      }),
    ).toBeInTheDocument();

    const column = () =>
      within(card.getByRole('table'))
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getByRole('cell').textContent);
    await user.click(card.getByText('Ver datos'));
    expect(column()).toEqual(['76 kg', '84 kg']);

    await user.click(card.getByRole('radio', { name: 'Peso máximo' }));
    expect(column()).toEqual(['60 kg', '70 kg']);

    await user.click(card.getByRole('radio', { name: 'Volumen' }));
    expect(column()).toEqual(['1030 kg', '420 kg']);
  });

  it('offers repetitions and volume for a bodyweight exercise', async () => {
    const { repos, user } = await open('dominadas');
    await screen.findByRole('heading', { level: 2, name: /Dominadas/ });
    await repos.session.put(makeSession({ id: 's1', date: '2026-11-02' }));
    await repos.set.putMany([
      makeSet({ id: 'a', sessionId: 's1', exerciseId: 'dominadas', weight: 0, reps: 8, slot: 0 }),
      makeSet({ id: 'b', sessionId: 's1', exerciseId: 'dominadas', weight: 0, reps: 7, slot: 1 }),
    ]);

    const evolution = (await screen.findByRole('heading', { name: 'Evolución' })).closest(
      'section',
    ) as HTMLElement;
    const card = within(evolution);
    expect(card.queryByRole('radio', { name: '1RM estimado' })).not.toBeInTheDocument();
    expect(card.getByRole('radio', { name: 'Repeticiones' })).toBeChecked();
    await user.click(card.getByText('Ver datos'));
    expect(within(card.getByRole('table')).getByRole('cell')).toHaveTextContent('15 reps');

    // Bodyweight sets weigh 0 kg: nothing to draw for volume.
    await user.click(card.getByRole('radio', { name: 'Volumen' }));
    expect(card.getByText('Aún no hay sesiones que dibujar con esta métrica.')).toBeInTheDocument();
  });

  it('saves the weight step and keeps it after reloading the page', async () => {
    const { user, repos } = await open('remo-t');
    const field = await screen.findByLabelText(/Incremento/);
    expect(field).toHaveValue('2,5');
    await user.clear(field);
    await user.type(field, '5');
    await user.click(screen.getByRole('button', { name: 'Guardar incremento' }));
    expect(await screen.findByText('Incremento guardado')).toBeInTheDocument();
    expect((await repos.exercise.get('remo-t'))?.increment).toBe(5);
  });

  it('rejects a weight step out of range without saving', async () => {
    const { user, repos } = await open('remo-t');
    const field = await screen.findByLabelText(/Incremento/);
    const before = (await repos.exercise.get('remo-t'))?.increment;
    for (const value of ['0', '60']) {
      await user.clear(field);
      await user.type(field, value);
      await user.click(screen.getByRole('button', { name: 'Guardar incremento' }));
      expect(
        await screen.findByText('El incremento debe estar entre 0,25 y 50 kg'),
      ).toBeInTheDocument();
    }
    expect(screen.queryByText('Incremento guardado')).not.toBeInTheDocument();
    expect((await repos.exercise.get('remo-t'))?.increment).toBe(before);
  });

  it('adds, edits and removes the machine settings of a seed exercise', async () => {
    const { user, repos } = await open('remo-t');
    expect(await screen.findByText('Aún no has anotado ajustes')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Añadir ajustes' }));
    await user.type(screen.getByLabelText('Nombre del ajuste 1'), 'Respaldo');
    await user.type(screen.getByLabelText('Valor del ajuste 1'), '3');
    await user.click(screen.getByRole('button', { name: 'Añadir ajuste' }));
    await user.type(screen.getByLabelText('Nombre del ajuste 2'), 'Asiento');
    await user.type(screen.getByLabelText('Valor del ajuste 2'), '5');
    await user.click(screen.getByRole('button', { name: 'Guardar ajustes' }));
    expect(await screen.findByText('Ajustes guardados')).toBeInTheDocument();
    expect(await screen.findByText('Respaldo: 3')).toBeInTheDocument();
    expect(screen.getByText('Asiento: 5')).toBeInTheDocument();
    expect((await repos.exercise.get('remo-t'))?.setup).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Editar ajustes' }));
    await user.clear(screen.getByLabelText('Valor del ajuste 1'));
    await user.type(screen.getByLabelText('Valor del ajuste 1'), '4');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Respaldo: 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Editar ajustes' }));
    await user.click(screen.getByRole('button', { name: 'Quitar ajuste 2' }));
    await user.click(screen.getByRole('button', { name: 'Quitar ajuste 1' }));
    await user.click(screen.getByRole('button', { name: 'Guardar ajustes' }));
    expect(await screen.findByText('Aún no has anotado ajustes')).toBeInTheDocument();
    expect((await repos.exercise.get('remo-t'))?.setup).toBeUndefined();
  });

  it('refuses a setting without a name and saves nothing', async () => {
    const { user, repos } = await open('remo-t');
    await user.click(await screen.findByRole('button', { name: 'Añadir ajustes' }));
    await user.type(screen.getByLabelText('Valor del ajuste 1'), '3');
    await user.click(screen.getByRole('button', { name: 'Guardar ajustes' }));
    expect(screen.getByText('Escribe el nombre del ajuste')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del ajuste 1')).toHaveFocus();
    expect((await repos.exercise.get('remo-t'))?.setup).toBeUndefined();
  });

  it('offers edit and archive for an exercise the user created', async () => {
    await open('exe_mine');
    expect(await screen.findByRole('heading', { level: 2, name: 'Press landmine' })).toBeVisible();
    expect(screen.getByText('Propio')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      '/exercises/exe_mine/edit',
    );
    const facts = within(
      screen.getByRole('heading', { name: 'Datos' }).closest('section') as HTMLElement,
    );
    expect(facts.getByText('Músculos secundarios').nextSibling).toHaveTextContent('Tríceps, Pecho');
    expect(facts.getByText('Unilateral').nextSibling).toHaveTextContent('Sí');
    expect(facts.getByText('Esquema por defecto').nextSibling).toHaveTextContent(
      '4 series · RIR 1-2',
    );
  });

  it('archives after confirming and brings the exercise back', async () => {
    const { user, repos } = await open('exe_mine');
    await user.click(await screen.findByRole('button', { name: 'Archivar' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Archivar este ejercicio?' });
    await user.click(within(dialog).getByRole('button', { name: 'Archivar' }));

    expect(await screen.findByText('Ejercicio archivado')).toBeInTheDocument();
    expect((await repos.exercise.get('exe_mine'))?.archived).toBe(true);
    expect(await screen.findByText('Archivado')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Desarchivar' }));
    expect(await screen.findByText('Ejercicio restaurado')).toBeInTheDocument();
    expect((await repos.exercise.get('exe_mine'))?.archived).toBe(false);
    await waitFor(() => {
      expect(screen.queryByText('Archivado')).not.toBeInTheDocument();
    });
  });

  it('does not archive when the dialog is cancelled', async () => {
    const { user, repos } = await open('exe_mine');
    await user.click(await screen.findByRole('button', { name: 'Archivar' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect((await repos.exercise.get('exe_mine'))?.archived).toBe(false);
  });

  it('refuses to archive an exercise that is in a routine and says which', async () => {
    const { user, repos } = await open('exe_mine');
    const pull = await repos.routine.get('pull');
    if (!pull) throw new Error('seed routine missing');
    await repos.routine.put({
      ...pull,
      items: [
        ...pull.items,
        { exerciseId: 'exe_mine', scheme: MINE.defaultScheme, optional: false },
      ],
    });
    await screen.findByRole('heading', { name: 'En rutinas' });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'En rutinas' }).nextSibling).toHaveTextContent(
        'Pull',
      );
    });
    await user.click(screen.getByRole('button', { name: 'Archivar' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'No se puede archivar' });
    expect(dialog).toHaveTextContent('Está en la rutina Pull. Quítalo de la rutina antes.');
    await user.click(within(dialog).getByRole('button', { name: 'Entendido' }));
    expect((await repos.exercise.get('exe_mine'))?.archived).toBe(false);
  });

  it('opens an archived exercise by its address', async () => {
    await open('exe_mine', { mine: { archived: true } });
    expect(await screen.findByText('Archivado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desarchivar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archivar' })).not.toBeInTheDocument();
  });

  it('says so for an exercise that does not exist', async () => {
    await open('nope');
    expect(await screen.findByText('No encontramos este ejercicio')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Ejercicios' })).toBeInTheDocument();
  });

  it('speaks English', async () => {
    await open('exe_mine', { locale: 'en' });
    expect(await screen.findByRole('link', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Exercise' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(screen.getByText("You haven't logged this exercise yet")).toBeInTheDocument();
    expect(screen.getByLabelText(/Weight step/)).toHaveValue('2.5');
    expect(screen.getByText('4 sets · RIR 1-2')).toBeInTheDocument();
  });
});

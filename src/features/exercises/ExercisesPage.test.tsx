import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES_BY_ID } from '../../domain';
import { createRepositories } from '../../data/repository';
import { ensureSeed } from '../../data/seed';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';

async function open(options: { locale?: 'es' | 'en' } = {}) {
  const db = openTestDatabase();
  await ensureSeed(db);
  const repos = createRepositories(db);
  const user = userEvent.setup();
  const app = renderApp('/exercises', { db, ...options });
  const list = await screen.findByRole('list', {
    name: options.locale === 'en' ? 'Exercises' : 'Ejercicios',
  });
  return { repos, user, list, ...app };
}

const names = (list: HTMLElement) =>
  within(list)
    .getAllByRole('link')
    .map((link) => link.querySelector('span')?.textContent);

describe('ExercisesPage', () => {
  it('lists the seed exercises alphabetically, each with its group and equipment', async () => {
    const { list } = await open();
    const found = names(list);
    expect(found).toHaveLength(SEED_EXERCISES_BY_ID.size);
    expect(found).toEqual(
      [...found].sort((a, b) => (a ?? '').localeCompare(b ?? '', 'es', { sensitivity: 'base' })),
    );
    const remo = within(list).getByRole('link', { name: /^Remo en T/ });
    expect(remo).toHaveTextContent('Espalda · Discos');
    expect(within(remo).getByText('Straps')).toBeInTheDocument();
    const aperturas = within(list).getByRole('link', { name: /^Aperturas en máquina/ });
    expect(within(aperturas).queryByText('Straps')).not.toBeInTheDocument();
    expect(screen.getByText(`${String(found.length)} ejercicios`)).toBeInTheDocument();
  });

  it('marks the Routines tab and the section link as the current ones', async () => {
    await open();
    const main = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(main).getByRole('link', { name: 'Rutinas' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const section = screen.getByRole('navigation', { name: 'Rutinas y ejercicios' });
    expect(within(section).getByRole('link', { name: 'Ejercicios' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(section).getByRole('link', { name: 'Rutinas' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Ejercicios' })).toBeInTheDocument();
  });

  it('reaches the catalog from the Routines section and goes back', async () => {
    const db = openTestDatabase();
    await ensureSeed(db);
    const user = userEvent.setup();
    renderApp('/routines', { db });
    const section = () => screen.findByRole('navigation', { name: 'Rutinas y ejercicios' });
    await user.click(within(await section()).getByRole('link', { name: 'Ejercicios' }));
    await screen.findByRole('list', { name: 'Ejercicios' });
    // Each page draws its own section links, so look them up again.
    await user.click(within(await section()).getByRole('link', { name: 'Rutinas' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Rutinas' })).toBeInTheDocument();
  });

  it('searches ignoring case and accents, and says when nothing matches', async () => {
    const { user, list } = await open();
    await user.type(screen.getByLabelText('Buscar ejercicio'), 'REMO');
    expect(names(list)).toContain('Remo en T');
    expect(names(list).every((name) => /remo/i.test(name ?? ''))).toBe(true);
    await user.clear(screen.getByLabelText('Buscar ejercicio'));
    await user.type(screen.getByLabelText('Buscar ejercicio'), 'zzz');
    expect(screen.getByText('Ningún ejercicio coincide')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Ejercicios' })).not.toBeInTheDocument();
    expect(screen.getByText('0 ejercicios')).toBeInTheDocument();
  });

  it('combines filters and turns each one off on a second tap', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Espalda' }));
    await user.click(screen.getByRole('button', { name: 'Straps' }));
    const list = screen.getByRole('list', { name: 'Ejercicios' });
    const rows = within(list).getAllByRole('link');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveTextContent(/^.*Espalda · /);
      expect(within(row).getByText('Straps')).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: 'Mancuernas' }));
    expect(screen.getByText('Ningún ejercicio coincide')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mancuernas' }));
    expect(screen.getByRole('list', { name: 'Ejercicios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Espalda' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters the exercises created by me and the ones in a routine', async () => {
    const { user, repos } = await open();
    await repos.exercise.put({
      ...(SEED_EXERCISES_BY_ID.get('remo-t') ?? failMissing()),
      id: 'exe_mine',
      name: { text: 'Press landmine' },
      custom: true,
    });
    await screen.findByText('Press landmine');
    await user.click(screen.getByRole('button', { name: 'Creados por mí' }));
    const list = screen.getByRole('list', { name: 'Ejercicios' });
    expect(names(list)).toEqual(['Press landmine']);
    expect(within(list).getByText('Propio')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Creados por mí' }));
    await user.click(screen.getByRole('button', { name: 'En alguna rutina' }));
    const inRoutine = names(screen.getByRole('list', { name: 'Ejercicios' }));
    expect(inRoutine).toContain('Remo en T');
    expect(inRoutine).not.toContain('Dominadas');
  });

  it('hides archived exercises until "Mostrar archivados" is on', async () => {
    const { user, repos } = await open();
    await repos.exercise.put({
      ...(SEED_EXERCISES_BY_ID.get('remo-t') ?? failMissing()),
      id: 'exe_old',
      name: { text: 'Ejercicio antiguo' },
      custom: true,
      archived: true,
    });
    await screen.findByRole('list', { name: 'Ejercicios' });
    expect(screen.queryByText('Ejercicio antiguo')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mostrar archivados' }));
    const row = screen.getByRole('link', { name: /^Ejercicio antiguo/ });
    expect(within(row).getByText('Archivado')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mostrar archivados' }));
    expect(screen.queryByText('Ejercicio antiguo')).not.toBeInTheDocument();
  });

  it('links each exercise to its page and offers to create one', async () => {
    const { list } = await open();
    expect(within(list).getByRole('link', { name: /^Remo en T/ })).toHaveAttribute(
      'href',
      '/exercises/remo-t',
    );
    expect(screen.getByRole('link', { name: 'Crear ejercicio' })).toHaveAttribute(
      'href',
      '/exercises/new',
    );
  });

  it('speaks English', async () => {
    const { list } = await open({ locale: 'en' });
    const row = within(list).getByRole('link', { name: /^T-bar row/ });
    expect(row).toHaveTextContent('Back · Plate-loaded');
    expect(screen.getByRole('link', { name: 'Create exercise' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show archived' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Routines and exercises' })).toBeInTheDocument();
  });
});

function failMissing(): never {
  throw new Error('seed exercise missing');
}

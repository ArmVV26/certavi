import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SEED_ROUTINES_BY_ID, removeExerciseItem } from '../../domain';
import { saveRoutine } from '../../data/routines';
import { ensureSeed } from '../../data/seed';
import type { Locale } from '../../i18n/locale';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';

async function open(path: string, options: { locale?: Locale; edited?: boolean } = {}) {
  const db = openTestDatabase();
  await ensureSeed(db);
  if (options.edited) {
    const push = SEED_ROUTINES_BY_ID.get('push');
    await saveRoutine(db, 'push', removeExerciseItem(push?.items ?? [], 'aperturas-maquina') ?? []);
  }
  const user = userEvent.setup();
  const app = renderApp(path, { db, ...(options.locale ? { locale: options.locale } : {}) });
  return { user, ...app };
}

const itemOf = async (name: string, listName = 'Ejercicios de la rutina') => {
  const list = await screen.findByRole('list', { name: listName });
  const item = within(list)
    .getAllByRole('listitem')
    .find((li) => within(li).queryByRole('heading', { level: 4, name }));
  if (!item) throw new Error(`no item for ${name}`);
  return item;
};

describe('RoutineViewPage', () => {
  it('shows the routine, its exercises in order and their schemes, without starting a session', async () => {
    const { db } = await open('/routines/push');
    expect(await screen.findByRole('heading', { level: 1, name: 'Rutina' })).toBeVisible();
    expect(await screen.findByRole('heading', { level: 2, name: 'Push' })).toBeVisible();
    expect(screen.getByText('Lunes')).toBeVisible();
    expect(screen.getByText('7 ejercicios · 19 series')).toBeVisible();

    const list = screen.getByRole('list', { name: 'Ejercicios de la rutina' });
    const names = within(list)
      .getAllByRole('listitem')
      .map((li) => within(li).getByRole('heading', { level: 4 }).textContent);
    expect(names).toHaveLength(7);
    expect(names[0]).toBe('Press inclinado con mancuernas');
    expect(await itemOf('Press inclinado con mancuernas')).toHaveTextContent(
      '1 top 6-8 + 2 back-off 8-10 · RIR 1-2',
    );
    expect(await itemOf('Aperturas en máquina')).toHaveTextContent('3 × 10-15 · RIR 1-2');

    expect(screen.queryByRole('button', { name: 'Restaurar original' })).not.toBeInTheDocument();
    expect(screen.queryByText('Editada')).not.toBeInTheDocument();
    expect(await db.sessions.count()).toBe(0);
    expect(await db.pending.count()).toBe(0);
  });

  it('shows approach sets, notes and the optional tag', async () => {
    await open('/routines/lowerFull');
    const hack = await itemOf('Sentadilla hack con banda');
    expect(hack).toHaveTextContent('1 aprox. + 1 top 6-8 + 2 back-off 8-10 · RIR 1-2');
    expect(hack).toHaveTextContent('Banda morada por defecto');
  });

  it('shows each exercise as a card with its group, name and a sheet link', async () => {
    await open('/routines/push');
    const card = await itemOf('Aperturas en máquina');
    expect(within(card).getByText('Pecho')).toBeVisible();
    const link = within(card).getByRole('link', { name: 'Ver ficha de Aperturas en máquina' });
    expect(link).toHaveTextContent('Ver ficha');
    expect(link).toHaveAttribute('href', '/exercises/aperturas-maquina');
    // The name is plain text, not a link.
    expect(screen.queryByRole('link', { name: 'Aperturas en máquina' })).not.toBeInTheDocument();
  });

  it('tags an optional exercise', async () => {
    await open('/routines/pull');
    const list = await screen.findByRole('list', { name: 'Ejercicios de la rutina' });
    expect(within(list).getAllByText('Opcional')).toHaveLength(1);
  });

  it('links each exercise card to its sheet and the routine to its editor', async () => {
    const { user, router } = await open('/routines/push');
    expect(await screen.findByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      '/routines/push/edit',
    );
    expect(screen.getByRole('link', { name: 'Volver a Rutinas' })).toHaveAttribute(
      'href',
      '/routines',
    );
    await user.click(screen.getByRole('link', { name: 'Ver ficha de Aperturas en máquina' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/exercises/aperturas-maquina');
    });
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Aperturas en máquina' }),
    ).toBeVisible();
    expect(screen.getByText('Push')).toBeVisible();
  });

  it('shows "Editada" and restores the original after confirming', async () => {
    const { user, db } = await open('/routines/push', { edited: true });
    expect(await screen.findByText('Editada')).toBeVisible();
    expect(screen.getByText('6 ejercicios · 16 series')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Restaurar original' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: '¿Restaurar la rutina original?',
    });
    expect(dialog).toHaveTextContent('Se perderán los cambios que hiciste en Push.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Editada')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Restaurar original' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Restaurar' }),
    );

    expect(await screen.findByText('Rutina restaurada')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Editada')).not.toBeInTheDocument();
    });
    expect(screen.getByText('7 ejercicios · 19 series')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Restaurar original' })).not.toBeInTheDocument();
    expect(await db.pending.get('push')).toMatchObject({ type: 'routine' });
  });

  it('says so when the routine does not exist', async () => {
    await open('/routines/xyz');
    expect(await screen.findByText('No encontramos esta rutina')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Volver a Rutinas' })).toBeVisible();
  });

  it('speaks English', async () => {
    await open('/routines/push', { locale: 'en', edited: true });
    expect(await screen.findByRole('heading', { level: 1, name: 'Routine' })).toBeVisible();
    expect(await screen.findByText('Monday')).toBeVisible();
    expect(screen.getByText('Edited')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Restore original' })).toBeVisible();
    expect(await itemOf('Incline dumbbell press', 'Routine exercises')).toHaveTextContent(
      '1 top 6-8 + 2 back-off 8-10 · RIR 1-2',
    );
  });
});

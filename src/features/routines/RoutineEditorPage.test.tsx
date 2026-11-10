import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SEED_ROUTINES_BY_ID, differsFromSeed } from '../../domain';
import { ensureSeed } from '../../data/seed';
import type { Locale } from '../../i18n/locale';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';

async function open(path: string, options: { locale?: Locale } = {}) {
  const db = openTestDatabase();
  await ensureSeed(db);
  const user = userEvent.setup();
  const app = renderApp(path, { db, ...(options.locale ? { locale: options.locale } : {}) });
  return { user, ...app };
}

type User = ReturnType<typeof userEvent.setup>;

const group = async (name: string) => screen.findByRole('group', { name });
const exerciseNames = () =>
  within(screen.getByRole('list', { name: 'Ejercicios de la rutina' }))
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent);
const click = async (user: User, name: string) => {
  await user.click(await screen.findByRole('button', { name }));
};
const dialogOpen = () => screen.queryByRole('alertdialog');

describe('RoutineEditorPage', () => {
  it('shows the routine as it is, with its exercises and sets', async () => {
    await open('/routines/push/edit');
    expect(await screen.findByRole('heading', { level: 1, name: 'Editar rutina' })).toBeVisible();
    expect(await screen.findByRole('heading', { level: 2, name: 'Push' })).toBeVisible();
    expect(screen.getByText('7 ejercicios · 19 series')).toBeVisible();
    expect(exerciseNames()).toHaveLength(7);

    const press = await group('Press inclinado con mancuernas');
    expect(within(press).getByLabelText('Tipo de la serie 1')).toHaveValue('top');
    expect(within(press).getByLabelText('Repeticiones de la serie 1')).toHaveValue('6-8');
    expect(within(press).getByLabelText('Tipo de la serie 2')).toHaveValue('backoff');
    expect(within(press).getByLabelText('Repeticiones de la serie 3')).toHaveValue('8-10');
    expect(within(press).getByLabelText('RIR objetivo')).toHaveValue('1-2');
    expect(
      within(press).getByRole('button', { name: 'Subir Press inclinado con mancuernas' }),
    ).toBeDisabled();
  });

  describe('jump chips', () => {
    const chips = () =>
      within(screen.getByRole('navigation', { name: 'Ir a un ejercicio' }))
        .getAllByRole('button')
        .map((b) => b.textContent);

    it('lists every exercise in order, numbered', async () => {
      await open('/routines/push/edit');
      await group('Press inclinado con mancuernas');
      const names = chips();
      expect(names).toHaveLength(7);
      expect(names[0]).toBe('1 Press inclinado con mancuernas');
      expect(names[6]).toMatch(/^7 /);
    });

    it('scrolls to the card and focuses its heading without changing anything', async () => {
      const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
      const { user } = await open('/routines/push/edit');
      await group('Aperturas en máquina');
      await user.click(screen.getByRole('button', { name: /^\d+ Aperturas en máquina$/ }));
      const heading = screen.getByRole('heading', { level: 3, name: 'Aperturas en máquina' });
      expect(heading).toHaveFocus();
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(dialogOpen()).not.toBeInTheDocument();
      // Nothing is dirty: Discard goes back without asking.
      await click(user, 'Descartar');
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Rutina' })).toBeVisible();
      });
      expect(dialogOpen()).not.toBeInTheDocument();
      scroll.mockRestore();
    });

    it('follows moving, removing, undoing and adding', async () => {
      const { user } = await open('/routines/push/edit');
      await group('Press inclinado con mancuernas');
      await click(user, 'Bajar Press inclinado con mancuernas');
      expect(chips().slice(0, 2)).toEqual([
        '1 Press de pecho en máquina vertical',
        '2 Press inclinado con mancuernas',
      ]);

      await click(user, 'Quitar Aperturas en máquina');
      expect(chips()).toHaveLength(6);
      expect(chips().some((c) => c.includes('Aperturas'))).toBe(false);
      await click(user, 'Deshacer');
      expect(chips()).toHaveLength(7);

      await click(user, 'Añadir ejercicio');
      const sheet = await screen.findByRole('dialog', { name: 'Añadir ejercicio' });
      await user.type(within(sheet).getByLabelText('Buscar ejercicio'), 'remo en t');
      await user.click(within(sheet).getByRole('button', { name: /Remo en T/ }));
      await waitFor(() => {
        expect(chips()).toHaveLength(8);
      });
      expect(chips()[7]).toBe('8 Remo en T');
    });
  });

  it('adds an exercise at the end, with its default sets, and refuses the ones already there', async () => {
    const { user } = await open('/routines/push/edit');
    await click(user, 'Añadir ejercicio');
    const sheet = await screen.findByRole('dialog', { name: 'Añadir ejercicio' });
    await user.type(within(sheet).getByLabelText('Buscar ejercicio'), 'inclinado');
    expect(
      within(sheet).getByRole('button', { name: /Press inclinado con mancuernas/ }),
    ).toBeDisabled();
    expect(within(sheet).getAllByText('Ya está en la rutina').length).toBeGreaterThan(0);

    await user.clear(within(sheet).getByLabelText('Buscar ejercicio'));
    await user.type(within(sheet).getByLabelText('Buscar ejercicio'), 'remo en t');
    await user.click(within(sheet).getByRole('button', { name: /Remo en T/ }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(exerciseNames().at(-1)).toBe('Remo en T');
    expect(screen.getByText(/^8 ejercicios · \d+ series$/)).toBeVisible();
  });

  it('removes an exercise and puts it back in the same place with Deshacer', async () => {
    const { user } = await open('/routines/push/edit');
    await screen.findByRole('group', { name: 'Aperturas en máquina' });
    const before = exerciseNames();

    await click(user, 'Quitar Aperturas en máquina');
    expect(exerciseNames()).not.toContain('Aperturas en máquina');
    expect(screen.getByText('6 ejercicios · 16 series')).toBeVisible();
    expect(screen.getByText('Aperturas en máquina quitado')).toBeVisible();

    await click(user, 'Deshacer');
    expect(exerciseNames()).toEqual(before);
    expect(screen.getByText('7 ejercicios · 19 series')).toBeVisible();
  });

  it('moves exercises up and down', async () => {
    const { user } = await open('/routines/push/edit');
    await screen.findByRole('group', { name: 'Press inclinado con mancuernas' });
    await click(user, 'Bajar Press inclinado con mancuernas');
    expect(exerciseNames().slice(0, 2)).toEqual([
      'Press de pecho en máquina vertical',
      'Press inclinado con mancuernas',
    ]);
    await click(user, 'Subir Press inclinado con mancuernas');
    expect(exerciseNames()[0]).toBe('Press inclinado con mancuernas');
    const last = exerciseNames().at(-1) ?? '';
    expect(screen.getByRole('button', { name: `Bajar ${last}` })).toBeDisabled();
  });

  it('adds and removes sets, and the last set cannot be removed', async () => {
    const { user } = await open('/routines/push/edit');
    const aperturas = await group('Aperturas en máquina');
    expect(within(aperturas).getAllByRole('listitem')).toHaveLength(3);

    await user.click(within(aperturas).getByRole('button', { name: 'Añadir serie' }));
    expect(within(aperturas).getAllByRole('listitem')).toHaveLength(4);
    expect(within(aperturas).getByLabelText('Repeticiones de la serie 4')).toHaveValue('10-15');
    expect(screen.getByText('7 ejercicios · 20 series')).toBeVisible();

    await user.click(within(aperturas).getByRole('button', { name: 'Quitar serie 4' }));
    expect(within(aperturas).getAllByRole('listitem')).toHaveLength(3);

    await user.click(within(aperturas).getByRole('button', { name: 'Quitar serie 3' }));
    await user.click(within(aperturas).getByRole('button', { name: 'Quitar serie 2' }));
    expect(within(aperturas).getByRole('button', { name: 'Quitar serie 1' })).toBeDisabled();
  });

  it('stops adding sets at 20', async () => {
    const { user } = await open('/routines/push/edit');
    const aperturas = await group('Aperturas en máquina');
    const add = within(aperturas).getByRole('button', { name: 'Añadir serie' });
    for (let i = 0; i < 17; i += 1) await user.click(add);
    expect(within(aperturas).getAllByRole('listitem')).toHaveLength(20);
    expect(add).toBeDisabled();
  });

  it('saves a changed type, reps, RIR, optional flag and note, and shows them in the viewer', async () => {
    const { user, db } = await open('/routines/push/edit');
    const press = await group('Press inclinado con mancuernas');
    await user.selectOptions(
      within(press).getByLabelText('Tipo de la serie 1'),
      'Serie de trabajo',
    );
    await user.clear(within(press).getByLabelText('Repeticiones de la serie 1'));
    await user.type(within(press).getByLabelText('Repeticiones de la serie 1'), '5');
    await user.clear(within(press).getByLabelText('RIR objetivo'));
    await user.type(within(press).getByLabelText('RIR objetivo'), '2');
    await user.click(within(press).getByRole('checkbox', { name: 'Opcional' }));
    await user.type(within(press).getByLabelText('Nota'), 'Agarre ancho ');

    await click(user, 'Guardar');

    expect(await screen.findByText('Rutina guardada')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Rutina' })).toBeVisible();
    const link = await screen.findByRole('heading', {
      level: 4,
      name: 'Press inclinado con mancuernas',
    });
    const item = link.closest('li');
    expect(item).toHaveTextContent('1 × 5 + 2 back-off 8-10 · RIR 2');
    expect(item).toHaveTextContent('Opcional');
    expect(item).toHaveTextContent('Agarre ancho');
    expect(screen.getByText('Editada')).toBeVisible();

    const saved = await db.routines.get('push');
    expect(saved && 'items' in saved && differsFromSeed(saved)).toBe(true);
    expect(await db.pending.get('push')).toBeDefined();
  });

  it('shows the note that comes with the app, and removes it when emptied', async () => {
    const { user, db } = await open('/routines/lowerB/edit');
    const calf = await group('Elevaciones de gemelo en hack');
    const note = within(calf).getByLabelText('Nota');
    expect((note as HTMLTextAreaElement).value).toContain('Primer ejercicio del día.');
    await user.clear(note);
    await click(user, 'Guardar');

    expect(await screen.findByText('Rutina guardada')).toBeInTheDocument();
    const stored = await db.routines.get('lowerB');
    expect(stored && 'items' in stored ? stored.items[0] : undefined).not.toHaveProperty('note');
  });

  it('keeps the translation key of a note that is typed back as it was', async () => {
    const { user, db } = await open('/routines/lowerB/edit');
    const calf = await group('Elevaciones de gemelo en hack');
    const note = within(calf).getByLabelText('Nota');
    const original = (note as HTMLTextAreaElement).value;
    await user.type(note, 'x');
    await user.type(note, '{Backspace}');
    expect(note).toHaveValue(original);
    await click(user, 'Guardar');
    // Nothing differs from the original, so nothing is saved.
    expect(await screen.findByRole('heading', { level: 1, name: 'Rutina' })).toBeVisible();
    expect((await db.routines.get('lowerB'))?.updatedAt).toBe(0);
    expect(await db.pending.count()).toBe(0);
  });

  describe('validation', () => {
    it('does not save empty reps and puts the focus on the field', async () => {
      const { user, db } = await open('/routines/push/edit');
      const aperturas = await group('Aperturas en máquina');
      await user.clear(within(aperturas).getByLabelText('Repeticiones de la serie 2'));
      await click(user, 'Guardar');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Revisa la rutina: hay campos con errores',
      );
      expect(within(aperturas).getByText('Indica las repeticiones')).toBeVisible();
      await waitFor(() => {
        expect(within(aperturas).getByLabelText('Repeticiones de la serie 2')).toHaveFocus();
      });
      expect(screen.getByRole('heading', { level: 1, name: 'Editar rutina' })).toBeVisible();
      expect((await db.routines.get('push'))?.updatedAt).toBe(0);
      expect(await db.pending.count()).toBe(0);

      // Fixing it clears the message.
      await user.type(within(aperturas).getByLabelText('Repeticiones de la serie 2'), '10-15');
      expect(within(aperturas).queryByText('Indica las repeticiones')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('rejects badly written reps and RIR', async () => {
      const { user } = await open('/routines/push/edit');
      const aperturas = await group('Aperturas en máquina');
      const reps = within(aperturas).getByLabelText('Repeticiones de la serie 1');
      await user.clear(reps);
      await user.type(reps, '10-6');
      const rir = within(aperturas).getByLabelText('RIR objetivo');
      await user.clear(rir);
      await user.type(rir, 'abc');
      await click(user, 'Guardar');

      expect(
        await within(aperturas).findByText('Escribe las repeticiones como 8, ~10 o 6-8'),
      ).toBeVisible();
      expect(within(aperturas).getByText('Escribe el RIR como 2 o 1-2')).toBeVisible();
    });

    it('accepts spaces around the numbers and an approach set without reps', async () => {
      const { user, db } = await open('/routines/lowerFull/edit');
      const hack = await group('Sentadilla hack con banda');
      expect(within(hack).getByLabelText('Repeticiones de la serie 1')).toHaveValue('');
      const reps = within(hack).getByLabelText('Repeticiones de la serie 2');
      await user.clear(reps);
      await user.type(reps, ' 5 - 7 ');
      await click(user, 'Guardar');
      expect(await screen.findByText('Rutina guardada')).toBeInTheDocument();
      const stored = await db.routines.get('lowerFull');
      const hackItem =
        stored && 'items' in stored
          ? stored.items.find((i) => i.exerciseId === 'hack-banda')
          : null;
      expect(hackItem?.scheme.blocks[1]).toMatchObject({ kind: 'top', reps: '5-7' });
    });

    it('does not let the routine be saved without exercises', async () => {
      const { user, db } = await open('/routines/pull/edit');
      await screen.findByRole('group', { name: 'Remo en T' });
      for (const name of exerciseNames()) {
        await click(user, `Quitar ${name}`);
      }
      expect(await screen.findByText('La rutina necesita al menos un ejercicio')).toBeVisible();
      expect(screen.getByText('0 ejercicios · 0 series')).toBeVisible();
      await click(user, 'Guardar');
      expect(await screen.findByRole('alert')).toBeVisible();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Añadir ejercicio' })).toHaveFocus();
      });
      expect((await db.routines.get('pull'))?.updatedAt).toBe(0);
    });
  });

  describe('leaving', () => {
    it('leaves at once when nothing changed', async () => {
      const { user } = await open('/routines/push/edit');
      await click(user, 'Descartar');
      expect(await screen.findByRole('heading', { level: 1, name: 'Rutina' })).toBeVisible();
      expect(dialogOpen()).not.toBeInTheDocument();
    });

    it('asks before discarding changes, and keeps them if the user keeps editing', async () => {
      const { user, db } = await open('/routines/push/edit');
      await screen.findByRole('group', { name: 'Aperturas en máquina' });
      await click(user, 'Quitar Aperturas en máquina');
      await click(user, 'Descartar');

      const dialog = await screen.findByRole('alertdialog', { name: '¿Descartar los cambios?' });
      expect(dialog).toHaveTextContent('Tienes cambios sin guardar en esta rutina.');
      expect(within(dialog).getByRole('button', { name: 'Seguir editando' })).toHaveFocus();
      await user.click(within(dialog).getByRole('button', { name: 'Seguir editando' }));
      await waitFor(() => {
        expect(dialogOpen()).not.toBeInTheDocument();
      });
      expect(screen.getByRole('heading', { level: 1, name: 'Editar rutina' })).toBeVisible();
      expect(exerciseNames()).not.toContain('Aperturas en máquina');

      await click(user, 'Descartar');
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: 'Descartar cambios',
        }),
      );
      expect(await screen.findByRole('heading', { level: 1, name: 'Rutina' })).toBeVisible();
      expect(await screen.findByText('7 ejercicios · 19 series')).toBeVisible();
      expect(screen.queryByText('Editada')).not.toBeInTheDocument();
      expect(await db.pending.count()).toBe(0);
    });

    it('asks too when the user taps another tab', async () => {
      const { user, router } = await open('/routines/push/edit');
      await screen.findByRole('group', { name: 'Aperturas en máquina' });
      await click(user, 'Quitar Aperturas en máquina');
      await user.click(screen.getByRole('link', { name: 'Ajustes' }));

      const dialog = await screen.findByRole('alertdialog', { name: '¿Descartar los cambios?' });
      await user.click(within(dialog).getByRole('button', { name: 'Seguir editando' }));
      await waitFor(() => {
        expect(dialogOpen()).not.toBeInTheDocument();
      });
      expect(router.state.location.pathname).toBe('/routines/push/edit');

      await user.click(screen.getByRole('link', { name: 'Ajustes' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: 'Descartar cambios',
        }),
      );
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/settings');
      });
    });

    it('does not ask after saving', async () => {
      const { user, router } = await open('/routines/push/edit');
      await screen.findByRole('group', { name: 'Aperturas en máquina' });
      await click(user, 'Quitar Aperturas en máquina');
      await click(user, 'Guardar');
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/routines/push');
      });
      expect(dialogOpen()).not.toBeInTheDocument();
    });
  });

  it('only changes the edited routine and leaves a session that was already started alone', async () => {
    const { user, db } = await open('/routines/push/edit');
    await db.sessions.put({
      id: 'ses_old',
      type: 'session',
      updatedAt: 1,
      date: '2026-11-02',
      routineId: 'push',
      startedAt: 1,
      endedAt: null,
      note: '',
      readiness: null,
      items: structuredClone([...(SEED_ROUTINES_BY_ID.get('push')?.items ?? [])]),
    });
    await screen.findByRole('group', { name: 'Aperturas en máquina' });
    await click(user, 'Quitar Aperturas en máquina');
    await click(user, 'Guardar');
    await screen.findByText('Rutina guardada');

    const session = await db.sessions.get('ses_old');
    expect(session && 'items' in session ? session.items : []).toHaveLength(7);
    const pull = await db.routines.get('pull');
    expect(pull?.updatedAt).toBe(0);
  });

  it('says so when the routine does not exist', async () => {
    await open('/routines/xyz/edit');
    expect(await screen.findByText('No encontramos esta rutina')).toBeVisible();
  });

  it('speaks English', async () => {
    const { user } = await open('/routines/push/edit', { locale: 'en' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit routine' })).toBeVisible();
    const aperturas = await screen.findByRole('group', { name: 'Machine chest fly' });
    expect(within(aperturas).getByLabelText('Type of set 1')).toHaveValue('straight');
    expect(within(aperturas).getByLabelText('Reps of set 1')).toBeVisible();
    expect(within(aperturas).getByLabelText('Target RIR')).toBeVisible();
    expect(screen.getByText('7 exercises · 19 sets')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Remove Machine chest fly' }));
    expect(await screen.findByText('Machine chest fly removed')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeVisible();
  });
});

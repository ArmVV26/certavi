import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { straightSets, topBackoff } from '../../domain';
import { setExerciseSetup } from '../../data/exercises';
import { openTestDatabase } from '../../test/render';
import { ensureSeed } from '../../data/seed';
import { cardOf, openSession, plan } from './testing';

beforeEach(() => {
  localStorage.clear();
});

const ITEMS = [plan('remo-t', topBackoff(1)), plan('aperturas-maquina', straightSets('10-15', 2))];

const openSheet = async (name = 'Ajustes de la máquina') =>
  within(await screen.findByRole('dialog', { name }));

describe('machine settings in the session', () => {
  it('shows no line and the plain button for an exercise without settings', async () => {
    await openSession({ items: ITEMS });
    const card = cardOf('Remo en T');
    expect(card.getByRole('button', { name: 'Ajustes' })).toBeInTheDocument();
    expect(card.queryByText(/Respaldo/)).not.toBeInTheDocument();
  });

  it('saves the settings from the sheet and shows them as a line on that card only', async () => {
    const { user, repos } = await openSession({ items: ITEMS });
    await user.type(cardOf('Remo en T').getByLabelText('Peso de la serie 1'), '60');

    await user.click(cardOf('Remo en T').getByRole('button', { name: 'Ajustes' }));
    const sheet = await openSheet();
    await user.type(sheet.getByLabelText('Nombre del ajuste 1'), 'Respaldo');
    await user.type(sheet.getByLabelText('Valor del ajuste 1'), '3');
    await user.click(sheet.getByRole('button', { name: 'Añadir ajuste' }));
    await user.type(sheet.getByLabelText('Nombre del ajuste 2'), 'Asiento');
    await user.type(sheet.getByLabelText('Valor del ajuste 2'), '5');
    await user.click(sheet.getByRole('button', { name: 'Guardar ajustes' }));

    expect(await screen.findByText('Ajustes guardados')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Ajustes de la máquina' })).not.toBeInTheDocument();
    expect(await cardOf('Remo en T').findByText('Respaldo 3 · Asiento 5')).toBeInTheDocument();
    expect(cardOf('Remo en T').getByRole('button', { name: 'Ajustes ✎' })).toBeInTheDocument();
    expect(cardOf('Aperturas en máquina').queryByText(/Respaldo/)).not.toBeInTheDocument();
    expect((await repos.exercise.get('remo-t'))?.setup).toEqual([
      { label: 'Respaldo', value: '3' },
      { label: 'Asiento', value: '5' },
    ]);
    // What was typed in the session and not saved is untouched.
    expect(cardOf('Remo en T').getByLabelText('Peso de la serie 1')).toHaveValue('60');
  });

  it('shows the saved settings in any session and lets the user edit them', async () => {
    const db = openTestDatabase();
    await ensureSeed(db);
    await setExerciseSetup(db, 'remo-t', [{ label: 'Pin', value: '7' }]);
    const { user } = await openSession({ db, items: ITEMS });
    expect(cardOf('Remo en T').getByText('Pin 7')).toBeInTheDocument();

    await user.click(cardOf('Remo en T').getByRole('button', { name: 'Ajustes ✎' }));
    const sheet = await openSheet();
    expect(sheet.getByLabelText('Nombre del ajuste 1')).toHaveValue('Pin');
    await user.clear(sheet.getByLabelText('Valor del ajuste 1'));
    await user.type(sheet.getByLabelText('Valor del ajuste 1'), '8');
    await user.click(sheet.getByRole('button', { name: 'Guardar ajustes' }));
    expect(await cardOf('Remo en T').findByText('Pin 8')).toBeInTheDocument();
  });

  it('shows an error under the wrong field and saves nothing', async () => {
    const { user, repos } = await openSession({ items: ITEMS });
    await user.click(cardOf('Remo en T').getByRole('button', { name: 'Ajustes' }));
    const sheet = await openSheet();
    await user.type(sheet.getByLabelText('Valor del ajuste 1'), '3');
    await user.click(sheet.getByRole('button', { name: 'Guardar ajustes' }));
    expect(sheet.getByText('Escribe el nombre del ajuste')).toBeInTheDocument();
    expect(sheet.getByLabelText('Nombre del ajuste 1')).toHaveFocus();

    await user.type(sheet.getByLabelText('Nombre del ajuste 1'), 'Pin');
    await user.clear(sheet.getByLabelText('Valor del ajuste 1'));
    await user.click(sheet.getByRole('button', { name: 'Guardar ajustes' }));
    expect(sheet.getByText('Escribe el valor del ajuste')).toBeInTheDocument();
    expect((await repos.exercise.get('remo-t'))?.setup).toBeUndefined();
  });

  it('stops at four rows and removes a row', async () => {
    const { user } = await openSession({ items: ITEMS });
    await user.click(cardOf('Remo en T').getByRole('button', { name: 'Ajustes' }));
    const sheet = await openSheet();
    const add = sheet.getByRole('button', { name: 'Añadir ajuste' });
    for (let i = 0; i < 3; i++) await user.click(add);
    expect(sheet.getByLabelText('Nombre del ajuste 4')).toBeInTheDocument();
    expect(add).toBeDisabled();
    await user.click(sheet.getByRole('button', { name: 'Quitar ajuste 4' }));
    expect(sheet.queryByLabelText('Nombre del ajuste 4')).not.toBeInTheDocument();
    expect(add).toBeEnabled();
  });

  it('is in English', async () => {
    const { user } = await openSession({ items: ITEMS, locale: 'en' });
    await user.click(cardOf('T-bar row').getByRole('button', { name: 'Settings' }));
    expect(await openSheet('Machine settings')).toBeDefined();
  });
});

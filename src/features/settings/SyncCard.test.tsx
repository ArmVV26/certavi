import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createRepositories } from '../../data/repository';
import { createTestEngine, TEST_KEY } from '../../data/sync/testing';
import { makeSession } from '../../domain/testing/builders';
import { formatDate } from '../../i18n/format';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';

const NOW = Date.UTC(2026, 10, 3, 9, 30);

/** The Settings card under the level-2 heading `name`. */
function cardOf(name: string): HTMLElement {
  const section = screen.getByRole('heading', { level: 2, name }).closest('section');
  if (!section) throw new Error(`no card "${name}"`);
  return section;
}

function setup({
  key = TEST_KEY,
  locale = 'es',
}: { key?: string | null; locale?: 'es' | 'en' } = {}) {
  const db = openTestDatabase();
  const test = createTestEngine(db, { key, now: () => NOW });
  const user = userEvent.setup();
  const view = renderApp('/settings', { db, sync: test.engine, locale });
  const card = () => cardOf('Sincronización');
  return { ...view, ...test, db, user, card };
}

describe('Sync card', () => {
  it('asks for a key when there is none', () => {
    const { card } = setup({ key: null });
    const status = within(card()).getByLabelText('Estado de la sincronización');
    expect(within(status).getByText('Sin configurar')).toBeInTheDocument();
    expect(within(status).getByText('Nunca')).toBeInTheDocument();
    expect(within(card()).getByLabelText('Clave de sincronización')).toHaveAttribute(
      'type',
      'password',
    );
    expect(
      within(card()).getByText('La misma clave en todos tus dispositivos. Mínimo 32 caracteres.'),
    ).toBeInTheDocument();
    expect(
      within(card()).getByRole('link', { name: 'Registro y copias del servidor' }),
    ).toHaveAttribute('href', '/settings/sync');
  });

  it('rejects a short key and keeps nothing', async () => {
    const { user, card, keyStore } = setup({ key: null });
    const field = within(card()).getByLabelText('Clave de sincronización');

    await user.type(field, 'k'.repeat(31));
    await user.click(within(card()).getByRole('button', { name: 'Guardar clave' }));

    expect(field).toHaveAccessibleDescription(
      'La clave debe tener al menos 32 caracteres. La misma clave en todos tus dispositivos. Mínimo 32 caracteres.',
    );
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(keyStore.read()).toBeNull();

    await user.type(field, 'k');
    expect(field).toHaveAttribute('aria-invalid', 'false');
  });

  it('shows the key on request', async () => {
    const { user, card } = setup({ key: null });
    const toggle = within(card()).getByRole('button', { name: 'Mostrar clave' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(within(card()).getByLabelText('Clave de sincronización')).toHaveAttribute(
      'type',
      'text',
    );
  });

  it('saves the key and syncs at once', async () => {
    const { user, card, keyStore, server, db } = setup({ key: null });
    await createRepositories(db).session.put(makeSession({ id: 'a', date: '2026-11-02' }));

    await user.type(within(card()).getByLabelText('Clave de sincronización'), ` ${TEST_KEY} `);
    await user.click(within(card()).getByRole('button', { name: 'Guardar clave' }));

    expect(await screen.findByText('Clave guardada.')).toBeInTheDocument();
    expect(keyStore.read()).toBe(TEST_KEY);
    expect(within(card()).getByText('Clave guardada en este dispositivo.')).toBeInTheDocument();
    expect(within(card()).queryByLabelText('Clave de sincronización')).not.toBeInTheDocument();
    expect(within(card()).queryByText(TEST_KEY)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(server.records().map((r) => r.id)).toEqual(['a']);
    });
    expect(await within(card()).findByText('Sincronizado')).toBeInTheDocument();
  });

  it('says when the key cannot be stored on this device', async () => {
    const { user, card, keyStore } = setup({ key: null });
    vi.spyOn(keyStore, 'write').mockReturnValue(false);

    await user.type(within(card()).getByLabelText('Clave de sincronización'), TEST_KEY);
    await user.click(within(card()).getByRole('button', { name: 'Guardar clave' }));

    expect(
      await within(card()).findByText('No se pudo guardar la clave en este dispositivo.'),
    ).toBeInTheDocument();
  });

  it('syncs now and shows the result', async () => {
    const { user, card, server } = setup();

    await user.click(within(card()).getByRole('button', { name: 'Sincronizar ahora' }));
    expect(await screen.findByText('Sincronizado.')).toBeInTheDocument();
    const when = formatDate(new Date(NOW), 'es', { dateStyle: 'medium', timeStyle: 'short' });
    expect(within(card()).getByText(when)).toBeInTheDocument();

    server.failNext('unauthorized');
    await user.click(within(card()).getByRole('button', { name: 'Sincronizar ahora' }));
    const reason = 'Clave incorrecta. Revísala en Ajustes.';
    const toasts = screen.getByRole('region', { name: 'Avisos' });
    expect(await within(toasts).findByText(reason)).toBeInTheDocument();
    expect(within(card()).getByText(reason)).toBeInTheDocument();
    expect(within(card()).getByText('Error')).toBeInTheDocument();
  });

  it('says so when "Sync now" finds no network', async () => {
    const db = openTestDatabase();
    const { engine } = createTestEngine(db, { isOnline: () => false });
    const user = userEvent.setup();
    renderApp('/settings', { db, sync: engine });
    const card = cardOf('Sincronización');

    await user.click(within(card).getByRole('button', { name: 'Sincronizar ahora' }));

    expect(await screen.findByText('No se pudo conectar con el servidor.')).toBeInTheDocument();
    expect(within(card).getByText('Sin conexión')).toBeInTheDocument();
  });

  it('changes the key, or cancels the change', async () => {
    const { user, card, keyStore } = setup();
    await user.click(within(card()).getByRole('button', { name: 'Cambiar clave' }));
    await user.click(within(card()).getByRole('button', { name: 'Cancelar' }));
    expect(within(card()).getByText('Clave guardada en este dispositivo.')).toBeInTheDocument();

    await user.click(within(card()).getByRole('button', { name: 'Cambiar clave' }));
    const other = 'other-sync-key-0123456789-abcdefghij';
    await user.type(within(card()).getByLabelText('Clave de sincronización'), other);
    await user.click(within(card()).getByRole('button', { name: 'Guardar clave' }));
    expect(await screen.findByText('Clave guardada.')).toBeInTheDocument();
    expect(keyStore.read()).toBe(other);
  });

  it('forgets the key after confirming', async () => {
    const { user, card, keyStore } = setup();
    await user.click(within(card()).getByRole('button', { name: 'Olvidar clave' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Olvidar la clave?' });
    expect(
      within(dialog).getByText(
        'Este dispositivo dejará de sincronizar. Tus datos se quedan en él.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(keyStore.read()).toBe(TEST_KEY);

    await user.click(within(card()).getByRole('button', { name: 'Olvidar clave' }));
    await user.click(screen.getByRole('button', { name: 'Olvidar' }));

    expect(await screen.findByText('Clave olvidada.')).toBeInTheDocument();
    expect(keyStore.read()).toBeNull();
    expect(within(card()).getByText('Sin configurar')).toBeInTheDocument();
    expect(within(card()).getByLabelText('Clave de sincronización')).toBeInTheDocument();
  });

  it('is in English when the app is', () => {
    const db = openTestDatabase();
    renderApp('/settings', { db, sync: createTestEngine(db, { key: null }).engine, locale: 'en' });
    const card = cardOf('Sync');
    expect(within(card).getByText('Not set up')).toBeInTheDocument();
    expect(within(card).getByLabelText('Sync key')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Save key' })).toBeInTheDocument();
  });
});

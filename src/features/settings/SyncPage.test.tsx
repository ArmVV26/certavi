import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it, vi } from 'vitest';
import { addAttempt } from '../../data/sync/attemptLog';
import { createTestEngine, TEST_KEY } from '../../data/sync/testing';
import type { CertaviDb } from '../../data/db';
import type { ExportFile } from '../../data/exportFile';
import { createRepositories } from '../../data/repository';
import { makeSession } from '../../domain/testing/builders';
import { openTestDatabase, renderWithProviders } from '../../test/render';
import { renderApp } from '../../test/renderApp';
import { SyncPage } from './SyncPage';

const backup = (date: string, ids: string[]) => ({
  date,
  records: ids.map((id, i) => ({ ...makeSession({ id, date }), serverSeq: i + 1 })),
});

function setup({ key = TEST_KEY }: { key?: string | null } = {}) {
  const db = openTestDatabase();
  const test = createTestEngine(db, { key });
  const download = vi.fn<(file: ExportFile) => void>();
  const router = createMemoryRouter(
    [{ path: '/settings/sync', element: <SyncPage download={download} /> }],
    { initialEntries: ['/settings/sync'] },
  );
  const user = userEvent.setup();
  renderWithProviders(<RouterProvider router={router} />, { db, sync: test.engine });
  const section = (name: string) => {
    const element = screen.getByRole('heading', { level: 2, name }).closest('section');
    if (!element) throw new Error(`no section "${name}"`);
    return element;
  };
  return { db, download, user, section, ...test };
}

async function addAttempts(db: CertaviDb) {
  await addAttempt(db, {
    at: Date.UTC(2026, 10, 3, 9, 0, 5),
    ok: true,
    sent: 1234,
    received: 2,
    durationMs: 420,
    trigger: 'manual',
  });
  await addAttempt(db, {
    at: Date.UTC(2026, 10, 3, 9, 1, 0),
    ok: false,
    error: 'timeout',
    sent: 0,
    received: 0,
    durationMs: 15000,
    trigger: 'retry',
  });
}

describe('Sync page', () => {
  it('is reached from Settings, has its own title and goes back', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    await user.click(screen.getByRole('link', { name: 'Registro y copias del servidor' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sincronización');
    await user.click(screen.getByRole('link', { name: 'Volver a Ajustes' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ajustes');
  });

  it('lists the attempts, newest first', async () => {
    const { db, section } = setup({ key: null });
    expect(await within(section('Registro de intentos')).findByText('Todavía no hay intentos.'));

    await addAttempts(db);

    await waitFor(() => {
      expect(within(section('Registro de intentos')).getAllByRole('listitem')).toHaveLength(2);
    });
    const items = within(section('Registro de intentos')).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('El servidor tardó demasiado en responder.');
    expect(items[0]).toHaveTextContent('Enviados: 0 · Recibidos: 0 · 15,0 s');
    expect(items[1]).toHaveTextContent('Correcto');
    expect(items[1]).toHaveTextContent('Enviados: 1234 · Recibidos: 2 · 0,4 s');
  });

  it('asks for the key before showing server backups', () => {
    const { section } = setup({ key: null });
    expect(
      within(section('Copias del servidor')).getByText(
        'Guarda la clave de sincronización en Ajustes para ver las copias.',
      ),
    ).toBeInTheDocument();
    expect(
      within(section('Copias del servidor')).queryByRole('button', { name: 'Actualizar' }),
    ).not.toBeInTheDocument();
  });

  it('lists the backups newest first, with their number of records', async () => {
    const { section, server } = setup();
    server.backups.set('2026-11-01', backup('2026-11-01', ['a']));
    server.backups.set('2026-11-02', backup('2026-11-02', ['a', 'b']));

    const items = await within(section('Copias del servidor')).findAllByRole('listitem');

    expect(items[0]).toHaveTextContent('2 de noviembre de 2026');
    expect(items[0]).toHaveTextContent('2 registros');
    expect(items[1]).toHaveTextContent('1 de noviembre de 2026');
    expect(
      within(items[0] as HTMLElement).getByRole('button', {
        name: 'Descargar la copia del 2 de noviembre de 2026',
      }),
    ).toBeInTheDocument();
  });

  it('says when there are no backups, when the count is unknown and when loading fails', async () => {
    const { section, server, user } = setup();
    expect(await within(section('Copias del servidor')).findByText('Todavía no hay copias.'));

    vi.spyOn(server.transport, 'listBackups').mockResolvedValueOnce({
      backups: [{ date: '2026-11-02', count: null, createdAt: null }],
    });
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(await screen.findByText('Registros: sin datos')).toBeInTheDocument();

    server.failNext('network');
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(await screen.findByText('No se pudo conectar con el servidor.')).toBeInTheDocument();
  });

  it('downloads a backup as an importable Certavi backup', async () => {
    const { user, server, download } = setup();
    server.backups.set('2026-11-02', backup('2026-11-02', ['a']));

    await user.click(
      await screen.findByRole('button', { name: 'Descargar la copia del 2 de noviembre de 2026' }),
    );

    await waitFor(() => {
      expect(download).toHaveBeenCalledTimes(1);
    });
    expect(download.mock.calls[0]?.[0].fileName).toBe('certavi-server-backup-2026-11-02.json');

    server.failNext('not-found');
    await user.click(
      screen.getByRole('button', { name: 'Descargar la copia del 2 de noviembre de 2026' }),
    );
    expect(await screen.findByText('No se ha encontrado la copia.')).toBeInTheDocument();
  });

  it('restores a backup after confirming', async () => {
    const { user, server, db } = setup();
    server.backups.set('2026-11-02', backup('2026-11-02', ['a']));
    await createRepositories(db).session.put(makeSession({ id: 'later', date: '2026-11-05' }));
    const restore = await screen.findByRole('button', {
      name: 'Restaurar la copia del 2 de noviembre de 2026',
    });

    await user.click(restore);
    const dialog = screen.getByRole('alertdialog', {
      name: '¿Restaurar la copia del 2 de noviembre de 2026?',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(await db.sessions.get('later')).not.toHaveProperty('deleted');

    await user.click(restore);
    await user.click(screen.getByRole('button', { name: 'Restaurar' }));

    expect(await screen.findByText('Copia restaurada. Registros cambiados: 2')).toBeInTheDocument();
    expect(await db.sessions.get('later')).toMatchObject({ deleted: true });
  });

  it('blocks download, restore and refresh while a backup is being restored', async () => {
    const { user, server, engine } = setup();
    server.backups.set('2026-11-02', backup('2026-11-02', ['a']));
    let finish: (changed: number) => void = () => undefined;
    vi.spyOn(engine, 'restore').mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          finish = resolve;
        }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Restaurar la copia del 2 de noviembre de 2026' }),
    );
    await user.click(screen.getByRole('button', { name: 'Restaurar' }));

    expect(
      screen.getByRole('button', { name: 'Restaurar la copia del 2 de noviembre de 2026' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Descargar la copia del 2 de noviembre de 2026' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeDisabled();

    finish(3);
    expect(await screen.findByText('Copia restaurada. Registros cambiados: 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled();
  });

  it('drops the list of backups when the key is forgotten', async () => {
    const { server, engine } = setup();
    server.backups.set('2026-11-02', backup('2026-11-02', ['a']));
    expect(await screen.findByText('2 de noviembre de 2026')).toBeInTheDocument();

    act(() => {
      engine.forgetKey();
    });

    expect(
      await screen.findByText('Guarda la clave de sincronización en Ajustes para ver las copias.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('2 de noviembre de 2026')).not.toBeInTheDocument();
  });

  it('says when a restore fails', async () => {
    const { user, server } = setup();
    server.backups.set('2026-11-02', backup('2026-11-02', ['a']));
    await user.click(
      await screen.findByRole('button', { name: 'Restaurar la copia del 2 de noviembre de 2026' }),
    );
    server.failNext('network');
    await user.click(screen.getByRole('button', { name: 'Restaurar' }));
    expect(
      await screen.findByText('No se pudo restaurar la copia. No se ha cambiado nada.'),
    ).toBeInTheDocument();
  });
});

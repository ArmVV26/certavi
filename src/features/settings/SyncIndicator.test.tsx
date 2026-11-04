import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createRepositories } from '../../data/repository';
import { createTestEngine } from '../../data/sync/testing';
import type { SyncState } from '../../data/sync/engine';
import { makeSession } from '../../domain/testing/builders';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';
import { SYNC_ICON, errorKeyOf, syncLabelOf } from './syncText';

const banner = () => screen.getByRole('banner');

describe('Sync indicator', () => {
  it('says sync is not set up and links to Settings', () => {
    renderApp('/');
    const link = within(banner()).getByRole('link', { name: 'Sincronización: Sin configurar' });
    expect(link).toHaveAttribute('href', '/settings');
  });

  it('shows the number of changes waiting while offline, and announces it', async () => {
    const db = openTestDatabase();
    await createRepositories(db).session.putMany([
      makeSession({ id: 'a', date: '2026-11-02' }),
      makeSession({ id: 'b', date: '2026-11-03' }),
    ]);
    const { engine } = createTestEngine(db, { isOnline: () => false });
    renderApp('/', { db, sync: engine });
    engine.start();

    const name = 'Sincronización: Sin conexión · 2 pendientes';
    expect(await within(banner()).findByRole('link', { name })).toHaveTextContent('2');
    expect(screen.getByRole('status')).toHaveTextContent(name);
    engine.stop();
  });

  it('shows synced after a sync, and an error when it fails', async () => {
    const db = openTestDatabase();
    const { engine, server } = createTestEngine(db);
    renderApp('/', { db, sync: engine, locale: 'en' });

    await engine.syncNow();
    expect(await within(banner()).findByRole('link', { name: 'Sync: Synced' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('');

    server.failNext('internal-error');
    await engine.syncNow();
    await waitFor(() => {
      expect(within(banner()).getByRole('link', { name: 'Sync: Error' })).toBeInTheDocument();
    });
  });
});

describe('sync text', () => {
  const state = (patch: Partial<SyncState>): SyncState => ({
    status: 'idle',
    hasKey: true,
    pending: 0,
    lastSuccessAt: null,
    error: null,
    ...patch,
  });

  it('tells "waiting" from "synced" when idle', () => {
    expect(syncLabelOf(state({}))).toBe('synced');
    expect(syncLabelOf(state({ pending: 1 }))).toBe('waiting');
    expect(syncLabelOf(state({ status: 'syncing', pending: 1 }))).toBe('syncing');
    expect(SYNC_ICON.error).toBe('warning');
  });

  it('maps every error code to a reason, and unknown ones to an internal error', () => {
    expect(errorKeyOf('unauthorized')).toBe('sync.errors.wrongKey');
    expect(errorKeyOf('http')).toBe('sync.errors.server');
    expect(errorKeyOf('invalid-json')).toBe('sync.errors.internal');
    expect(errorKeyOf('something-new')).toBe('sync.errors.internal');
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDatabase } from '../../data/DatabaseContext';
import { createRepositories } from '../../data/repository';
import { ensureSeed } from '../../data/seed';
import { makeSet } from '../../domain/testing/builders';
import { openTestDatabase, renderWithProviders } from '../../test/render';
import { renderApp } from '../../test/renderApp';
import { DataCard } from './DataCard';

const persisted = { persisted: () => Promise.resolve(true) };
const notPersisted = { persisted: () => Promise.resolve(false) };

async function seededDb() {
  const db = openTestDatabase();
  await ensureSeed(db);
  return db;
}

function value(list: HTMLElement, label: string) {
  const term = within(list).getByText(label, { selector: 'dt' });
  return term.nextElementSibling?.textContent;
}

describe('DataCard', () => {
  it('lists what a new device stores: the built-in data and nothing pending', async () => {
    renderWithProviders(<DataCard storage={persisted} />, { db: await seededDb() });

    const data = await screen.findByLabelText('Datos guardados en este dispositivo');
    expect(screen.getByRole('heading', { name: 'Datos' })).toBeInTheDocument();
    expect(value(data, 'Ejercicios')).toBe('45');
    expect(value(data, 'Rutinas')).toBe('6');
    expect(value(data, 'Bloques opcionales')).toBe('2');
    for (const label of [
      'Sesiones',
      'Series',
      'Notas de ejercicio',
      'Actividades',
      'Pesos semanales',
      'Semanas',
      'Registros de bloques',
      'Métricas semanales',
      'Pendientes de sincronizar',
    ]) {
      expect(value(data, label), label).toBe('0');
    }
    expect(await screen.findByText('Persistente')).toBeInTheDocument();
  });

  it('shows "Cargando…" until the counts arrive', async () => {
    renderWithProviders(<DataCard storage={persisted} />);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
    expect(screen.getByText('Comprobando…')).toBeInTheDocument();
    expect(await screen.findByLabelText('Datos guardados en este dispositivo')).toBeInTheDocument();
  });

  it('updates live when records are written and deleted', async () => {
    const db = await seededDb();
    renderWithProviders(<DataCard storage={persisted} />, { db });
    const data = await screen.findByLabelText('Datos guardados en este dispositivo');
    const repos = createRepositories(db);

    const sets = await repos.set.putMany(
      [0, 1, 2].map((slot) => makeSet({ sessionId: 's1', exerciseId: 'remo-t', slot })),
    );
    await waitFor(() => {
      expect(value(data, 'Series')).toBe('3');
    });
    expect(value(data, 'Pendientes de sincronizar')).toBe('3');

    await repos.set.remove(sets[0]?.id ?? '');
    await waitFor(() => {
      expect(value(data, 'Series')).toBe('2');
    });
    expect(value(data, 'Pendientes de sincronizar')).toBe('3');
  });

  it('formats the numbers in the active language', async () => {
    const db = openTestDatabase();
    await createRepositories(db).set.putMany(
      Array.from({ length: 1234 }, (_, slot) =>
        makeSet({ sessionId: 's1', exerciseId: 'remo-t', slot }),
      ),
    );
    renderWithProviders(<DataCard storage={persisted} />, { db, locale: 'en' });
    const data = await screen.findByLabelText('Data stored on this device');
    expect(value(data, 'Sets')).toBe('1,234');
  });

  it('says when the browser may delete the data, or gives no information', async () => {
    const { unmount } = renderWithProviders(<DataCard storage={notPersisted} />);
    expect(
      await screen.findByText('El navegador podría borrarlo si falta espacio'),
    ).toBeInTheDocument();
    unmount();

    renderWithProviders(<DataCard />);
    expect(await screen.findByText('Sin información del navegador')).toBeInTheDocument();
  });

  it('is in English when the language is English', async () => {
    renderWithProviders(<DataCard storage={persisted} />, { db: await seededDb(), locale: 'en' });
    const data = await screen.findByLabelText('Data stored on this device');
    expect(screen.getByRole('heading', { name: 'Data' })).toBeInTheDocument();
    expect(value(data, 'Exercises')).toBe('45');
    expect(value(data, 'Waiting to sync')).toBe('0');
    expect(screen.getByText('Everything is saved on this device first.')).toBeInTheDocument();
    expect(await screen.findByText('Persistent')).toBeInTheDocument();
  });
});

describe('Settings page', () => {
  it('shows the sync card first, then Appearance, Rest, Blocks, Data and Developer', async () => {
    renderApp('/settings', { db: await seededDb() });
    await screen.findByLabelText('Datos guardados en este dispositivo');
    // Some cards appear after reading the database: wait for the whole list.
    await waitFor(() => {
      const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
      expect(headings).toEqual([
        'Sincronización',
        'Apariencia',
        'Descanso',
        'Bloques opcionales',
        'Datos',
        'Desarrollo',
      ]);
    });
  });
});

describe('useDatabase', () => {
  it('fails clearly outside the provider', () => {
    function Probe() {
      useDatabase();
      return null;
    }
    expect(() => render(<Probe />)).toThrow('useDatabase must be used inside <DatabaseProvider>');
  });
});

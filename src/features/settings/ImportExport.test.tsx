import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import sample from '../../../tests/fixtures/gym-app-sample.json?raw';
import { exportAll } from '../../data/backup';
import type { CertaviDb } from '../../data/db';
import type { ExportFile } from '../../data/exportFile';
import { applyImport } from '../../data/importRecords';
import { readGymAppExport } from '../../data/legacy/gymApp';
import { ensureSeed } from '../../data/seed';
import { openTestDatabase, renderWithProviders } from '../../test/render';
import { DataCard } from './DataCard';

const persisted = { persisted: () => Promise.resolve(true) };

async function seededDb() {
  const db = openTestDatabase();
  await ensureSeed(db);
  return db;
}

async function setup({ db, locale }: { db?: CertaviDb; locale?: 'es' | 'en' } = {}) {
  const database = db ?? (await seededDb());
  const download = vi.fn<(file: ExportFile) => void>();
  renderWithProviders(<DataCard storage={persisted} download={download} />, {
    db: database,
    ...(locale ? { locale } : {}),
  });
  const counts = await screen.findByLabelText(
    locale === 'en' ? 'Data stored on this device' : 'Datos guardados en este dispositivo',
  );
  return { db: database, download, counts, user: userEvent.setup() };
}

function choose(source: 'legacy' | 'backup', content: string, name = 'copia.json') {
  const input = document.querySelector<HTMLInputElement>(`input[name="${source}-file"]`);
  if (!input) throw new Error(`no ${source} input`);
  fireEvent.change(input, { target: { files: [new File([content], name)] } });
}

/** The downloaded file whose name starts with `prefix` (exports finish in any order). */
function downloaded(download: { mock: { calls: [ExportFile][] } }, prefix: string) {
  return download.mock.calls.map(([file]) => file).find((f) => f.fileName.startsWith(prefix));
}

function value(list: HTMLElement, label: string) {
  return within(list).getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
}

describe('import from the previous app', () => {
  it('previews the sample file, saves it on confirm and updates the counts', async () => {
    const { counts, user } = await setup();

    choose('legacy', sample);
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Importar desde la app anterior',
    });
    expect(within(dialog).getByText('Se guardará en este dispositivo:')).toBeInTheDocument();
    const summary = within(dialog).getByLabelText('Resumen de la importación');
    expect(
      within(summary)
        .getAllByRole('term')
        .map((dt) => `${dt.textContent} ${value(summary, dt.textContent) ?? ''}`),
    ).toEqual([
      'Ejercicios 2',
      'Rutinas 1',
      'Sesiones 3',
      'Series 11',
      'Notas de ejercicio 2',
      'Actividades 2',
      'Pesos semanales 2',
      'Semanas 2',
      'Bloques opcionales 1',
      'Registros de bloques 2',
      'Métricas semanales 1',
      'Ignorados (borrados o ajustes internos) 5',
    ]);
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(value(counts, 'Sesiones')).toBe('0');

    await user.click(within(dialog).getByRole('button', { name: 'Importar' }));

    expect(await screen.findByText('Registros importados: 29')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(value(counts, 'Sesiones')).toBe('3');
    });
    expect(value(counts, 'Series')).toBe('11');
    expect(value(counts, 'Ejercicios')).toBe('45');
    expect(value(counts, 'Pendientes de sincronizar')).toBe('29');
  });

  it('saves nothing when cancelled', async () => {
    const { db, user } = await setup();
    choose('legacy', sample);
    const dialog = await screen.findByRole('alertdialog');

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await db.sessions.count()).toBe(0);
    expect(await db.pending.count()).toBe(0);
  });

  it('says there is nothing new the second time', async () => {
    const { user } = await setup();
    choose('legacy', sample);
    await user.click(await screen.findByRole('button', { name: 'Importar' }));
    await screen.findByText('Registros importados: 29');

    choose('legacy', sample);
    const dialog = await screen.findByRole('alertdialog');

    expect(within(dialog).getByText('No hay nada nuevo que importar.')).toBeInTheDocument();
    const summary = within(dialog).getByLabelText('Resumen de la importación');
    expect(value(summary, 'Sin cambios (ya estaban)')).toBe('29');
    expect(within(dialog).queryByRole('button', { name: 'Importar' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('rejects a file that is not a gym_app copy, without a dialog', async () => {
    const { db } = await setup();

    choose('legacy', 'esto no es JSON', 'notas.txt');

    expect(
      await screen.findByText('Este archivo no es una copia completa de la app anterior.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await db.pending.count()).toBe(0);
  });

  it('shows invalid records in the preview', async () => {
    await setup();
    const file = JSON.parse(sample) as { records: unknown[] };
    file.records.push({ id: 'broken', t: 'set', u: 1, sid: 's', ex: 'remo-t', slot: 'p0' });

    choose('legacy', JSON.stringify(file));

    const summary = await screen.findByLabelText('Resumen de la importación');
    expect(value(summary, 'No válidos (no se importan)')).toBe('1');
  });

  it('reports a failed save and keeps nothing', async () => {
    const { db, user } = await setup();
    vi.spyOn(db.pending, 'bulkPut').mockImplementation(() => {
      throw new Error('disk full');
    });
    choose('legacy', sample);

    await user.click(await screen.findByRole('button', { name: 'Importar' }));

    expect(
      await screen.findByText('No se pudo importar. No se ha guardado nada.'),
    ).toBeInTheDocument();
    expect(await db.sessions.count()).toBe(0);
  });

  it('does nothing when the file picker is cancelled', async () => {
    await setup();
    const input = document.querySelector<HTMLInputElement>('input[name="legacy-file"]');
    if (!input) throw new Error('no input');
    fireEvent.change(input, { target: { files: [] } });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('opens the file picker from the button', async () => {
    const { user } = await setup();
    const input = document.querySelector<HTMLInputElement>('input[name="legacy-file"]');
    if (!input) throw new Error('no input');
    const click = vi.spyOn(input, 'click');

    await user.click(screen.getByRole('button', { name: 'Importar desde la app anterior' }));

    expect(click).toHaveBeenCalledOnce();
  });
});

describe('Certavi backups', () => {
  it('imports a full backup exported from another device', async () => {
    const source = await seededDb();
    const { user } = await setup();
    const legacy = readGymAppExport(sample);
    if (legacy.ok) await applyImport(source, legacy.records);

    choose('backup', (await exportAll(source)).content);
    const dialog = await screen.findByRole('alertdialog', { name: 'Importar copia de Certavi' });
    await user.click(within(dialog).getByRole('button', { name: 'Importar' }));

    expect(await screen.findByText('Registros importados: 29')).toBeInTheDocument();
  });

  it('rejects a file that is not a Certavi backup', async () => {
    await setup();
    choose('backup', sample);
    expect(await screen.findByText('Este archivo no es una copia de Certavi.')).toBeInTheDocument();
  });
});

describe('exports', () => {
  it('downloads the full backup and both CSV files', async () => {
    const { download, user } = await setup();

    await user.click(screen.getByRole('button', { name: 'Exportar copia completa (.json)' }));
    await user.click(screen.getByRole('button', { name: 'Exportar series (.csv)' }));
    await user.click(screen.getByRole('button', { name: 'Exportar actividad y peso (.csv)' }));

    await waitFor(() => {
      expect(download).toHaveBeenCalledTimes(3);
    });
    const backup = downloaded(download, 'certavi-backup-');
    const sets = downloaded(download, 'certavi-sets-');
    const activity = downloaded(download, 'certavi-activity-weight-');
    expect(backup?.fileName).toMatch(/^certavi-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(backup?.content ?? '')).toMatchObject({ app: 'certavi', kind: 'full' });
    expect(sets?.content.split('\r\n')[0]).toBe(
      '\uFEFFfecha;sesion;ejercicio;tipo_serie;orden;peso_kg;reps;rir;straps;banda;e1rm_kg;cuenta_como_efectiva;nota_ejercicio;nota_sesion',
    );
    expect(activity?.content.split('\r\n')[0]).toBe(
      '\uFEFFfecha;tipo;actividad;minutos;peso_kg;nota',
    );
  });

  it('uses translated names and labels inside the CSV', async () => {
    const db = await seededDb();
    const legacy = readGymAppExport(sample);
    if (legacy.ok) await applyImport(db, legacy.records);
    const { download, user } = await setup({ db });

    await user.click(screen.getByRole('button', { name: 'Exportar series (.csv)' }));
    await user.click(screen.getByRole('button', { name: 'Exportar actividad y peso (.csv)' }));

    await waitFor(() => {
      expect(download).toHaveBeenCalledTimes(2);
    });
    const sets = downloaded(download, 'certavi-sets-')?.content.split('\r\n');
    const activity = downloaded(download, 'certavi-activity-weight-')?.content.split('\r\n');
    expect(sets?.[1]).toContain('2026-10-07;Lower B;');
    expect(sets?.[2]).toContain(';Calentamiento;1;10;10;');
    expect(sets?.some((row) => row.startsWith('2026-10-21;Sesión libre;Remo en T'))).toBe(true);
    expect(activity?.[1]).toBe('2026-10-20;actividad;Fútbol;60;;Pachanga');
  });

  it('reports a failed export', async () => {
    const { db, download, user } = await setup();
    vi.spyOn(db, 'transaction').mockImplementation(() => {
      throw new Error('closed');
    });

    await user.click(screen.getByRole('button', { name: 'Exportar copia completa (.json)' }));

    expect(await screen.findByText('No se pudo exportar.')).toBeInTheDocument();
    expect(download).not.toHaveBeenCalled();
  });
});

describe('English', () => {
  it('uses the English buttons, preview and messages', async () => {
    const { user } = await setup({ locale: 'en' });
    for (const name of [
      'Import from the previous app',
      'Import a Certavi backup',
      'Export full backup (.json)',
      'Export sets (.csv)',
      'Export activity and weight (.csv)',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }

    choose('legacy', sample);
    const dialog = await screen.findByRole('alertdialog', { name: 'Import from the previous app' });
    expect(within(dialog).getByText('This will be saved on this device:')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Import summary')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Records imported: 29')).toBeInTheDocument();

    choose('backup', 'nope');
    expect(await screen.findByText('This file is not a Certavi backup.')).toBeInTheDocument();
  });
});

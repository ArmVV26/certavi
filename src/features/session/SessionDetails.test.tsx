import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { straightSets, toIsoDate } from '../../domain';
import { openTestDatabase } from '../../test/render';
import { ensureSeed } from '../../data/seed';
import { logRow, openSession, plan, todayIso } from './testing';

const download = vi.hoisted(() => ({ downloadFile: vi.fn() }));
vi.mock('../../ui/download', () => download);

beforeEach(() => {
  localStorage.clear();
  download.downloadFile.mockClear();
});

const ITEMS = [plan('aperturas-maquina', straightSets('10-15', 2))];

const daysFromToday = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
};

const at = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime();

const sheet = () => within(screen.getByRole('dialog', { name: 'Datos de la sesión' }));

async function openSheet(user: Awaited<ReturnType<typeof openSession>>['user']) {
  await user.click(screen.getByRole('button', { name: 'Datos de la sesión' }));
  await screen.findByRole('dialog', { name: 'Datos de la sesión' });
}

const change = (label: string, value: string) => {
  fireEvent.change(sheet().getByLabelText(label), { target: { value } });
};

describe('the session details sheet', () => {
  it('shows the date, the start and the routine, and no end while the session is open', async () => {
    const { user } = await openSession({ items: ITEMS });
    await openSheet(user);
    expect(sheet().getByLabelText('Fecha')).toHaveValue(todayIso());
    expect(sheet().getByLabelText('Inicio')).toHaveValue('18:00');
    expect(sheet().queryByLabelText('Fin')).not.toBeInTheDocument();
    expect(sheet().getByLabelText('Rutina')).toHaveValue('');
    expect(sheet().getByRole('option', { name: 'Sesión libre' })).toBeInTheDocument();
  });

  it('shows the end of a finished session', async () => {
    const { user } = await openSession({
      items: ITEMS,
      startedAt: at(todayIso(), '18:00'),
      endedAt: at(todayIso(), '19:15'),
    });
    await openSheet(user);
    expect(sheet().getByLabelText('Fin')).toHaveValue('19:15');
  });

  it('changes the date and keeps the session on the new day', async () => {
    const { user, repos } = await openSession({ items: ITEMS });
    const day = daysFromToday(-2);
    await openSheet(user);
    change('Fecha', day);
    await user.click(sheet().getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Datos de la sesión' })).not.toBeInTheDocument();
    });
    const session = await repos.session.get('s1');
    expect(session?.date).toBe(day);
    expect(toIsoDate(new Date(session?.startedAt ?? 0))).toBe(day);
  });

  it('changes the start and the end hours of a finished session', async () => {
    const { user, repos } = await openSession({
      items: ITEMS,
      startedAt: at(todayIso(), '18:00'),
      endedAt: at(todayIso(), '19:00'),
    });
    await openSheet(user);
    change('Inicio', '17:30');
    change('Fin', '19:45');
    await user.click(sheet().getByRole('button', { name: 'Guardar' }));

    await waitFor(async () => {
      const session = await repos.session.get('s1');
      expect(session?.startedAt).toBe(at(todayIso(), '17:30'));
      expect(session?.endedAt).toBe(at(todayIso(), '19:45'));
    });
  });

  it('refuses a future date and saves nothing', async () => {
    const { user, repos } = await openSession({ items: ITEMS });
    await openSheet(user);
    change('Fecha', daysFromToday(1));
    await user.click(sheet().getByRole('button', { name: 'Guardar' }));

    expect(await sheet().findByText('La fecha no puede ser futura')).toBeInTheDocument();
    expect((await repos.session.get('s1'))?.date).toBe(todayIso());
  });

  it('refuses an end before the start', async () => {
    const { user, repos } = await openSession({
      items: ITEMS,
      startedAt: at(todayIso(), '18:00'),
      endedAt: at(todayIso(), '19:00'),
    });
    await openSheet(user);
    change('Fin', '17:00');
    await user.click(sheet().getByRole('button', { name: 'Guardar' }));

    expect(await sheet().findByText('El fin no puede ser anterior al inicio')).toBeInTheDocument();
    expect((await repos.session.get('s1'))?.endedAt).toBe(at(todayIso(), '19:00'));
  });

  it('refuses an empty date', async () => {
    const { user } = await openSession({ items: ITEMS });
    await openSheet(user);
    change('Fecha', '');
    await user.click(sheet().getByRole('button', { name: 'Guardar' }));
    expect(await sheet().findByText('Revisa la fecha y las horas')).toBeInTheDocument();
  });

  it('closes without saving when nothing changed, and with Cancelar', async () => {
    const { user, repos } = await openSession({ items: ITEMS });
    const before = await repos.session.get('s1');
    await openSheet(user);
    await user.click(sheet().getByRole('button', { name: 'Guardar' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Datos de la sesión' })).not.toBeInTheDocument();
    });
    expect(await repos.session.get('s1')).toEqual(before);

    await openSheet(user);
    change('Fecha', daysFromToday(-1));
    await user.click(sheet().getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Datos de la sesión' })).not.toBeInTheDocument();
    });
    expect((await repos.session.get('s1'))?.date).toBe(todayIso());
  });
});

describe('changing the routine from the details sheet', () => {
  async function openWithRoutines() {
    const db = openTestDatabase();
    await ensureSeed(db);
    const [routine] = await db.routines.toArray();
    if (!routine) throw new Error('no routine in the seed');
    const opened = await openSession({ db, items: ITEMS });
    return { ...opened, routineId: routine.id };
  }

  it('asks first, and keeps the session as it was if the change is cancelled', async () => {
    const { user, repos, routineId } = await openWithRoutines();
    await openSheet(user);
    await user.selectOptions(sheet().getByLabelText('Rutina'), routineId);
    await user.click(sheet().getByRole('button', { name: 'Guardar' }));

    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText(/¿Cambiar la sesión a .+\?/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect((await repos.session.get('s1'))?.routineId).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Datos de la sesión' })).toBeInTheDocument();
  });

  it('switches to the routine once confirmed, and back to a free session', async () => {
    const { user, repos, routineId } = await openWithRoutines();
    await openSheet(user);
    await user.selectOptions(sheet().getByLabelText('Rutina'), routineId);
    await user.click(sheet().getByRole('button', { name: 'Guardar' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Cambiar' }));

    await waitFor(async () => {
      expect((await repos.session.get('s1'))?.routineId).toBe(routineId);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Datos de la sesión' })).not.toBeInTheDocument();
    });

    // The title of the session shows the routine once the screen has repainted.
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 })).not.toHaveTextContent('Sesión libre');
    });
    await openSheet(user);
    expect(sheet().getByLabelText('Rutina')).toHaveValue(routineId);
    await user.selectOptions(sheet().getByLabelText('Rutina'), '');
    await user.click(sheet().getByRole('button', { name: 'Guardar' }));
    const again = await screen.findByRole('alertdialog');
    expect(within(again).getByText('¿Cambiar la sesión a Sesión libre?')).toBeInTheDocument();
    await user.click(within(again).getByRole('button', { name: 'Cambiar' }));
    await waitFor(async () => {
      expect((await repos.session.get('s1'))?.routineId).toBeNull();
    });
  });
});

describe('downloading the session as JSON', () => {
  it('hands the file of this session to the browser', async () => {
    const { user } = await openSession({ items: ITEMS });
    await logRow(user, 'Aperturas en máquina', 1, '40', '12');
    await screen.findByRole('button', { name: 'Serie hecha (pulsa para quitar)' });

    await user.click(screen.getByRole('button', { name: 'Descargar JSON' }));

    await waitFor(() => {
      expect(download.downloadFile).toHaveBeenCalledTimes(1);
    });
    const file = download.downloadFile.mock.calls[0]?.[0] as {
      fileName: string;
      mimeType: string;
      content: string;
    };
    expect(file.fileName).toBe(`certavi-session-${todayIso()}-s1.json`);
    expect(file.mimeType).toContain('json');
    const parsed = JSON.parse(file.content) as { kind: string; records: { type: string }[] };
    expect(parsed.kind).toBe('session');
    expect(parsed.records.filter((r) => r.type === 'session')).toHaveLength(1);
    expect(parsed.records.filter((r) => r.type === 'set')).toHaveLength(1);
  });
});

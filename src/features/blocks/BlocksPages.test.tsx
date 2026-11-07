import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANKLE_REHAB_BLOCK_ID,
  SEED_ROUTINES_BY_ID,
  STRETCHING_BLOCK_ID,
  type PlanItem,
} from '../../domain';
import { makeSession, makeSet } from '../../domain/testing/builders';
import { readBlockTracking, readBlocks } from '../../data/blocks';
import { createRepositories } from '../../data/repository';
import { ensureSeed } from '../../data/seed';
import { updateBlockLog } from '../../data/today';
import type { Locale } from '../../i18n/locale';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';

// Wednesday 4 November 2026.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 4, 10, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

async function open(path: string, locale?: Locale) {
  const db = openTestDatabase();
  await ensureSeed(db);
  const user = userEvent.setup();
  const app = renderApp(path, { db, ...(locale ? { locale } : {}) });
  return { ...app, db, user };
}

const stairs = (db: Awaited<ReturnType<typeof open>>['db'], date: string, value: number) =>
  updateBlockLog(db, ANKLE_REHAB_BLOCK_ID, date, { metric: { metricId: 'stairs', value } });

describe('block list', () => {
  it('shows the active and the inactive blocks with their summary', async () => {
    await open('/settings/blocks');
    expect(await screen.findByRole('heading', { name: 'Activos' })).toBeInTheDocument();
    const ankle = screen.getByRole('link', { name: /Rehabilitación del tobillo/ });
    expect(ankle).toHaveTextContent('Rehabilitación · 8 ejercicios · todos los días');
    expect(ankle).toHaveAttribute('href', `/settings/blocks/${ANKLE_REHAB_BLOCK_ID}`);
    expect(screen.getByRole('heading', { name: 'Inactivos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Estiramientos/ })).toHaveTextContent(
      'Estiramientos · Sin ejercicios · ningún día',
    );
    expect(screen.getByRole('link', { name: 'Nuevo bloque' })).toHaveAttribute(
      'href',
      '/settings/blocks/new',
    );
  });

  it('is reached from Settings and reads in English', async () => {
    const { user } = await open('/settings', 'en');
    await user.click(await screen.findByRole('link', { name: 'Manage blocks' }));
    expect(await screen.findByRole('heading', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Optional blocks' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Stretching/ })).toHaveTextContent(
      'Stretching · No exercises · no days',
    );
  });
});

describe('block form', () => {
  it('creates a block with an exercise and goes to its page', async () => {
    const { db, user } = await open('/settings/blocks/new');
    await user.type(await screen.findByRole('textbox', { name: 'Nombre' }), 'Movilidad de cadera');
    await user.click(screen.getByRole('button', { name: 'Añadir ejercicio' }));
    const first = within(screen.getByRole('group', { name: 'Ejercicio 1' }));
    await user.type(first.getByRole('textbox', { name: 'Nombre' }), 'Sentadilla profunda');
    await user.type(first.getByRole('textbox', { name: 'Dosis' }), '3 × 30 s');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('heading', { name: 'Movilidad de cadera' })).toBeInTheDocument();
    expect(screen.getByText('Bloque guardado')).toBeInTheDocument();
    const blocks = await readBlocks(db);
    const made = blocks.find((b) => b.custom);
    expect(made).toMatchObject({
      active: true,
      days: [1, 2, 3, 4, 5, 6, 7],
      items: [
        {
          id: 'sentadilla-profunda',
          name: { text: 'Sentadilla profunda' },
          dose: { text: '3 × 30 s' },
        },
      ],
    });
  });

  it('explains what is wrong and puts the focus on the first error', async () => {
    const { user } = await open('/settings/blocks/new');
    await screen.findByRole('textbox', { name: 'Nombre' });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText('Escribe un nombre.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveFocus();

    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Cadera');
    await user.click(screen.getByRole('button', { name: 'Añadir ejercicio' }));
    await user.click(screen.getByRole('button', { name: 'Añadir métrica' }));
    const item = within(screen.getByRole('group', { name: 'Ejercicio 1' }));
    await user.type(item.getByRole('textbox', { name: 'Veces por semana' }), 'abc');
    const metric = within(screen.getByRole('group', { name: 'Métrica 1' }));
    await user.type(metric.getByRole('textbox', { name: 'Nombre' }), 'Dolor');
    await user.type(metric.getByRole('textbox', { name: 'Límite' }), '12');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByText('Escribe el nombre de cada ejercicio.')).toBeInTheDocument();
    expect(screen.getByText('Usa un número o un rango, como 3 o 3-5.')).toBeInTheDocument();
    expect(screen.getByText('El límite va de 0 a 9.')).toBeInTheDocument();
    expect(item.getByRole('textbox', { name: 'Nombre' })).toHaveFocus();
  });

  it('edits the seed block: renames, moves and removes exercises, and keeps the rest', async () => {
    const { db, user } = await open(`/settings/blocks/${ANKLE_REHAB_BLOCK_ID}/edit`);
    // The block's own "Nombre" is the first of several fields with that label.
    expect(await screen.findByDisplayValue('Rehabilitación del tobillo')).toBeInTheDocument();
    expect(screen.getByText('Tipo: Rehabilitación')).toBeInTheDocument();
    expect(
      screen.getByText(/Valores semanales: Test de la pared \(cm\): Izquierda, Derecha/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Quitar Pogos' }));
    const first = within(screen.getByRole('group', { name: 'Ejercicio 1' }));
    await user.clear(first.getByRole('textbox', { name: 'Nombre' }));
    await user.type(first.getByRole('textbox', { name: 'Nombre' }), 'Rodillo');
    expect(screen.getByRole('button', { name: 'Subir Rodillo' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Bajar Rodillo' }));
    await user.click(screen.getByRole('checkbox', { name: 'Activo' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await screen.findByText('Bloque guardado');
    const block = (await readBlocks(db)).find((b) => b.id === ANKLE_REHAB_BLOCK_ID);
    expect(block?.active).toBe(false);
    expect(block?.name).toEqual({ key: 'blocks.names.ankleRehab' });
    expect(block?.items.map((i) => i.id)).toEqual([
      'wall-ankle',
      'foam-roll',
      'ankle-sit',
      'band-mobilization',
      'box-drop',
      'heel-raise',
      'split-heel-raise',
    ]);
    expect(block?.items[1]?.name).toEqual({ text: 'Rodillo' });
    expect(block?.items[0]?.name).toEqual({ key: 'blocks.items.wallAnkle' });
  });

  it('fills in the empty stretching block, choosing its days', async () => {
    const { db, user } = await open(`/settings/blocks/${STRETCHING_BLOCK_ID}/edit`);
    await screen.findByRole('textbox', { name: 'Nombre' });
    await user.click(screen.getByRole('button', { name: 'Añadir ejercicio' }));
    await user.type(
      within(screen.getByRole('group', { name: 'Ejercicio 1' })).getByRole('textbox', {
        name: 'Nombre',
      }),
      'Isquios',
    );
    await user.click(screen.getByRole('button', { name: 'lunes' }));
    await user.click(screen.getByRole('button', { name: 'miércoles' }));
    expect(screen.getByRole('button', { name: 'lunes' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('checkbox', { name: 'Activo' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await screen.findByText('Bloque guardado');
    const block = (await readBlocks(db)).find((b) => b.id === STRETCHING_BLOCK_ID);
    expect(block).toMatchObject({ active: true, days: [1, 3], blockType: 'stretching' });
  });

  it('says so when the block does not exist', async () => {
    await open('/settings/blocks/nope/edit');
    expect(await screen.findByText('Bloque no encontrado')).toBeInTheDocument();
  });
});

describe('block tracking', () => {
  it('draws a daily value with its 3/10 limit and the period selector', async () => {
    const { db, user } = await open('/settings');
    await stairs(db, '2026-11-01', 2);
    await stairs(db, '2026-11-02', 1);
    await stairs(db, '2026-11-03', 5);
    await stairs(db, '2026-09-01', 7);
    await user.click(await screen.findByRole('link', { name: 'Gestionar bloques' }));
    await user.click(await screen.findByRole('link', { name: /Rehabilitación del tobillo/ }));

    const chart = await screen.findByRole('img', {
      name: 'Dolor al bajar escaleras (límite 3/10): gráfica de líneas, 3 puntos, de 1 a 5',
    });
    expect(chart.querySelector('line[class*="reference"]')).not.toBeNull();
    expect(screen.getByText('Límite 3/10')).toBeInTheDocument();
    const card = within(chart.closest('section') as HTMLElement);
    await user.click(card.getByText('Ver datos'));
    expect(card.getByRole('cell', { name: '5 (por encima del límite)' })).toBeInTheDocument();
    expect(card.getByRole('cell', { name: '2' })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Todo' }));
    expect(
      await screen.findByRole('img', {
        name: 'Dolor al bajar escaleras (límite 3/10): gráfica de líneas, 4 puntos, de 1 a 7',
      }),
    ).toBeInTheDocument();
    // Without values the card says so instead of drawing.
    const empty = screen.getByRole('heading', { name: 'Dolor máximo en los ejercicios' });
    expect(
      within(empty.closest('section') as HTMLElement).getByText(
        'Aún no hay registros de esta métrica.',
      ),
    ).toBeInTheDocument();
  });

  it('saves the wall test of the week, replaces it and draws a chart per side', async () => {
    const { db, user } = await open(`/settings/blocks/${ANKLE_REHAB_BLOCK_ID}`);
    await screen.findByRole('heading', { name: 'Test de la pared' });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe al menos un valor.');

    await user.type(screen.getByRole('textbox', { name: 'Izquierda (cm)' }), '9,5');
    await user.type(screen.getByRole('textbox', { name: 'Derecha (cm)' }), '11');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/Test de la pared guardado · 2.8 nov/)).toBeInTheDocument();
    await waitFor(async () => {
      expect((await readBlockTracking(db, ANKLE_REHAB_BLOCK_ID)).weekly[0]?.values).toEqual({
        left: 9.5,
        right: 11,
      });
    });
    expect(
      await screen.findByRole('img', {
        name: 'Test de la pared · Izquierda: gráfica de líneas, 1 punto, de 9,5 cm a 9,5 cm',
      }),
    ).toBeInTheDocument();

    await user.clear(screen.getByRole('textbox', { name: 'Derecha (cm)' }));
    await user.type(screen.getByRole('textbox', { name: 'Derecha (cm)' }), '12');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(async () => {
      const { weekly } = await readBlockTracking(db, ANKLE_REHAB_BLOCK_ID);
      expect(weekly).toHaveLength(1);
      expect(weekly[0]?.values.right).toBe(12);
    });
  });

  it('shows the edit link, and tells a block without metrics apart', async () => {
    const { user } = await open(`/settings/blocks/${STRETCHING_BLOCK_ID}`);
    expect(await screen.findByText('Este bloque no tiene métricas.')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Editar bloque' }));
    expect(await screen.findByRole('textbox', { name: 'Nombre' })).toHaveValue('Estiramientos');
  });

  it('says so when the block does not exist', async () => {
    await open('/settings/blocks/nope');
    expect(await screen.findByText('Bloque no encontrado')).toBeInTheDocument();
  });
});

describe('Today and the session', () => {
  it('links the block card on Today to its tracking page', async () => {
    await open('/');
    expect(await screen.findByRole('link', { name: 'Ver seguimiento' })).toHaveAttribute(
      'href',
      `/settings/blocks/${ANKLE_REHAB_BLOCK_ID}`,
    );
  });

  it('holds the calf at its weight until the stairs do not hurt', async () => {
    const db = openTestDatabase();
    await ensureSeed(db);
    const repos = createRepositories(db);
    const calf = SEED_ROUTINES_BY_ID.get('lowerA')?.items[0] as PlanItem;
    await repos.session.putMany([
      makeSession({ id: 'ref', date: '2026-11-02', items: [calf] }),
      makeSession({ id: 'next', date: '2026-11-04', items: [calf] }),
    ]);
    await repos.set.putMany(
      [12, 12, 12, 12].map((reps, slot) =>
        makeSet({ sessionId: 'ref', exerciseId: 'gemelo-hack', weight: 60, reps, slot }),
      ),
    );
    await stairs(db, '2026-11-03', 6);
    renderApp('/session/next', { db });
    expect(
      await screen.findByText(
        'Mantén 60 kg: solo se sube si al bajar escaleras el dolor es 3/10 o menos.',
      ),
    ).toBeInTheDocument();

    await stairs(db, '2026-11-03', 2);
    expect(await screen.findByText('Sube a 65 kg')).toBeInTheDocument();
  });
});

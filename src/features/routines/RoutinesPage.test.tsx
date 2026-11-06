import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SEED_ROUTINES_BY_ID, removeExerciseItem } from '../../domain';
import { saveRoutine } from '../../data/routines';
import { ensureSeed } from '../../data/seed';
import type { Locale } from '../../i18n/locale';
import { openTestDatabase } from '../../test/render';
import { renderApp } from '../../test/renderApp';

async function open(locale?: Locale) {
  const db = openTestDatabase();
  await ensureSeed(db);
  const app = renderApp('/routines', { db, ...(locale ? { locale } : {}) });
  return { ...app };
}

describe('RoutinesPage', () => {
  it('lists the six routines in the order of their day, with day and summary', async () => {
    await open();
    expect(await screen.findByRole('heading', { level: 1, name: 'Rutinas' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Tus rutinas' })).toBeVisible();

    const list = await screen.findByRole('list', { name: 'Tus rutinas' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => within(li).getByRole('link').textContent)).toEqual([
      'PushLunes7 ejercicios · 19 series',
      'PullMartes8 ejercicios · 23 series',
      'Lower BMiércoles7 ejercicios · 21 series',
      'UpperViernes9 ejercicios · 23 series',
      'Lower ADomingo6 ejercicios · 18 series',
      'Lower FullSin día fijo7 ejercicios · 21 series',
    ]);
    expect(screen.queryByText('Editada')).not.toBeInTheDocument();
    expect(within(items[0] as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      '/routines/push',
    );
  });

  it('keeps the section links and marks Rutinas as the current one', async () => {
    await open();
    const sections = await screen.findByRole('navigation', { name: 'Rutinas y ejercicios' });
    expect(within(sections).getByRole('link', { name: 'Rutinas' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(sections).getByRole('link', { name: 'Ejercicios' })).toBeVisible();
  });

  it('tags a routine that differs from the original', async () => {
    const db = openTestDatabase();
    await ensureSeed(db);
    const push = SEED_ROUTINES_BY_ID.get('push');
    await saveRoutine(db, 'push', removeExerciseItem(push?.items ?? [], 'aperturas-maquina') ?? []);
    renderApp('/routines', { db });

    const link = await screen.findByRole('link', { name: /^Push/ });
    expect(link).toHaveTextContent('Editada');
    expect(link).toHaveTextContent('6 ejercicios · 16 series');
    expect(screen.getAllByText('Editada')).toHaveLength(1);
  });

  it('speaks English', async () => {
    await open('en');
    expect(await screen.findByRole('heading', { level: 2, name: 'Your routines' })).toBeVisible();
    expect(await screen.findByRole('link', { name: /^Push/ })).toHaveTextContent(
      'Monday7 exercises · 19 sets',
    );
    expect(screen.getByRole('link', { name: /^Lower Full/ })).toHaveTextContent('Any day');
  });
});

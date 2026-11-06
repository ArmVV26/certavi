import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  REST_SOUND_STORAGE_KEY,
  REST_VIBRATION_STORAGE_KEY,
  readRestTimes,
  saveRestTimes,
} from '../../data/restSettings';
import { openTestDatabase, renderWithProviders } from '../../test/render';
import { RestCard } from './RestCard';

const COMPOUND = 'Descanso en ejercicios básicos (s)';
const ISOLATION = 'Descanso en aislamiento (s)';

beforeEach(() => {
  localStorage.clear();
});

async function setup(initial?: { compound: number; isolation: number }) {
  const db = openTestDatabase();
  if (initial) await saveRestTimes(db, initial);
  renderWithProviders(<RestCard />, { db });
  const user = userEvent.setup();
  await screen.findByLabelText(COMPOUND);
  return { db, user };
}

async function type(user: ReturnType<typeof userEvent.setup>, label: string, text: string) {
  const field = screen.getByLabelText(label);
  await user.clear(field);
  if (text) await user.type(field, text);
  await user.tab();
}

describe('RestCard', () => {
  it('shows the default times and alerts of a new device', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Descanso' })).toBeInTheDocument();
    expect(screen.getByLabelText(COMPOUND)).toHaveValue('180');
    expect(screen.getByLabelText(ISOLATION)).toHaveValue('120');
    expect(screen.getByRole('switch', { name: 'Sonido al acabar el descanso' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Vibración' })).not.toBeChecked();
    expect(screen.getByText('No funciona en iPhone.')).toBeInTheDocument();
  });

  it('shows the saved times', async () => {
    await setup({ compound: 240, isolation: 90 });
    expect(screen.getByLabelText(COMPOUND)).toHaveValue('240');
    expect(screen.getByLabelText(ISOLATION)).toHaveValue('90');
  });

  it('saves a time when the field loses focus, keeping the other one', async () => {
    const { db, user } = await setup();
    await type(user, COMPOUND, '200');
    await waitFor(async () => {
      expect(await readRestTimes(db)).toEqual({ compound: 200, isolation: 120 });
    });
    await type(user, ISOLATION, '75');
    await waitFor(async () => {
      expect(await readRestTimes(db)).toEqual({ compound: 200, isolation: 75 });
    });
  });

  it('keeps the time between 15 and 900 s', async () => {
    const { db, user } = await setup();
    await type(user, COMPOUND, '5');
    await waitFor(async () => {
      expect((await readRestTimes(db)).compound).toBe(15);
    });
    expect(screen.getByLabelText(COMPOUND)).toHaveValue('15');

    await type(user, ISOLATION, '2000');
    await waitFor(async () => {
      expect((await readRestTimes(db)).isolation).toBe(900);
    });
    expect(screen.getByLabelText(ISOLATION)).toHaveValue('900');
  });

  it('goes back to the saved time when the field is left empty, saving nothing', async () => {
    const { db, user } = await setup();
    await type(user, COMPOUND, '');
    expect(screen.getByLabelText(COMPOUND)).toHaveValue('180');
    expect(await db.settings.count()).toBe(0);
  });

  it('does not save when the time did not change', async () => {
    const { db, user } = await setup();
    await type(user, COMPOUND, '180');
    expect(await db.settings.count()).toBe(0);
  });

  it('changes by 15 s with the + and − buttons', async () => {
    const { db, user } = await setup();
    await user.click(screen.getByRole('button', { name: /Aumentar.*básicos/ }));
    await user.click(screen.getByRole('button', { name: /Aumentar.*básicos/ }));
    expect(screen.getByLabelText(COMPOUND)).toHaveValue('210');
    // The buttons do not blur the field: the time is saved when it is left.
    await user.click(screen.getByLabelText(COMPOUND));
    await user.tab();
    await waitFor(async () => {
      expect((await readRestTimes(db)).compound).toBe(210);
    });
  });

  it('writes sound and vibration to this device only', async () => {
    const { db, user } = await setup();
    await user.click(screen.getByRole('switch', { name: 'Vibración' }));
    expect(screen.getByRole('switch', { name: 'Vibración' })).toBeChecked();
    expect(localStorage.getItem(REST_VIBRATION_STORAGE_KEY)).toBe('on');

    await user.click(screen.getByRole('switch', { name: 'Sonido al acabar el descanso' }));
    expect(screen.getByRole('switch', { name: 'Sonido al acabar el descanso' })).not.toBeChecked();
    expect(localStorage.getItem(REST_SOUND_STORAGE_KEY)).toBe('off');

    // Nothing was written to the synced settings.
    expect(await db.settings.count()).toBe(0);
    expect(await db.pending.count()).toBe(0);
  });

  it('remembers the alerts the next time it opens', async () => {
    localStorage.setItem(REST_SOUND_STORAGE_KEY, 'off');
    localStorage.setItem(REST_VIBRATION_STORAGE_KEY, 'on');
    await setup();
    expect(screen.getByRole('switch', { name: 'Sonido al acabar el descanso' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Vibración' })).toBeChecked();
  });

  it('shows a time that arrives from another device', async () => {
    const { db } = await setup();
    await saveRestTimes(db, { compound: 300, isolation: 120 });
    await waitFor(() => {
      expect(screen.getByLabelText(COMPOUND)).toHaveValue('300');
    });
  });
});

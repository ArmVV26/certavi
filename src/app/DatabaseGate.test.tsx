import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { DatabaseGate } from './DatabaseGate';

describe('DatabaseGate', () => {
  it('shows the app when the database started', async () => {
    const started = Promise.resolve(true);
    renderWithProviders(
      <DatabaseGate started={started}>
        <p>La app</p>
      </DatabaseGate>,
    );
    await started;
    expect(screen.getByText('La app')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('replaces the app with a message when it could not start', async () => {
    const started = Promise.resolve(false);
    renderWithProviders(
      <DatabaseGate started={started}>
        <p>La app</p>
      </DatabaseGate>,
    );
    expect(
      await screen.findByRole('heading', {
        name: 'No se pueden abrir los datos de este dispositivo',
      }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    expect(screen.queryByText('La app')).not.toBeInTheDocument();
  });

  it('is translated to English', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderWithProviders(
      <DatabaseGate started={Promise.resolve(false)}>
        <p>The app</p>
      </DatabaseGate>,
      { locale: 'en' },
    );
    expect(
      await screen.findByRole('heading', { name: 'The data on this device cannot be opened' }),
    ).toBeVisible();
  });
});

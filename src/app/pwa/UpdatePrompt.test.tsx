import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { UpdatePrompt } from './UpdatePrompt';
import { useAppUpdate } from './useAppUpdate';
import type { AppUpdate } from './useAppUpdate';

vi.mock('./useAppUpdate');

function mockUpdate(overrides: Partial<AppUpdate> = {}): AppUpdate {
  const value: AppUpdate = {
    updateAvailable: true,
    update: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  };
  vi.mocked(useAppUpdate).mockReturnValue(value);
  return value;
}

describe('UpdatePrompt', () => {
  it('shows nothing while there is no new version', () => {
    mockUpdate({ updateAvailable: false });
    renderWithProviders(<UpdatePrompt />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('offers to update or to wait, in Spanish', () => {
    mockUpdate();
    renderWithProviders(<UpdatePrompt />);
    expect(screen.getByRole('status')).toHaveTextContent('Hay una versión nueva');
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Más tarde' })).toBeInTheDocument();
  });

  it('is translated to English', () => {
    mockUpdate();
    renderWithProviders(<UpdatePrompt />, { locale: 'en' });
    expect(screen.getByRole('status')).toHaveTextContent('A new version is available');
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Later' })).toBeInTheDocument();
  });

  it('"Actualizar" updates and "Más tarde" only dismisses', async () => {
    const user = userEvent.setup();
    const { update, dismiss } = mockUpdate();
    renderWithProviders(<UpdatePrompt />);

    await user.click(screen.getByRole('button', { name: 'Más tarde' }));
    expect(dismiss).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(update).toHaveBeenCalledOnce();
  });
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { RestTimerBar } from './RestTimerBar';
import type { RestTimer } from './useRestTimer';

const running: RestTimer = { remaining: 125, total: 180, finished: false, from: null };

function setup(timer: RestTimer, nextName: string | null = 'Remo en T', locale?: 'en') {
  const onAdjust = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(
    <RestTimerBar timer={timer} nextName={nextName} onAdjust={onAdjust} onClose={onClose} />,
    locale ? { locale } : {},
  );
  return { onAdjust, onClose, user: userEvent.setup() };
}

describe('RestTimerBar', () => {
  it('shows the clock, what comes next and announces the rest', () => {
    setup(running);
    expect(screen.getByRole('region', { name: 'Descanso' })).toBeInTheDocument();
    expect(screen.getByText('2:05')).toBeInTheDocument();
    expect(screen.getByText('Siguiente: Remo en T')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Descanso de 3:00');
  });

  it('shows no "next" when there is no open row left', () => {
    setup(running, null);
    expect(screen.queryByText(/Siguiente/)).not.toBeInTheDocument();
  });

  it('tells you to go on when the time is up', () => {
    setup({ remaining: 0, total: 180, finished: true, from: null });
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getAllByText('¡A por la siguiente serie!').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Siguiente/)).not.toBeInTheDocument();
  });

  it('asks for ±15 s and for closing', async () => {
    const { onAdjust, onClose, user } = setup(running);
    await user.click(screen.getByRole('button', { name: '+15 s' }));
    await user.click(screen.getByRole('button', { name: '−15 s' }));
    expect(onAdjust.mock.calls).toEqual([[15], [-15]]);
    await user.click(screen.getByRole('button', { name: 'Cerrar descanso' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reads in English', () => {
    setup(running, 'Barbell row', 'en');
    expect(screen.getByRole('region', { name: 'Rest' })).toBeInTheDocument();
    expect(screen.getByText('Next: Barbell row')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close rest' })).toBeInTheDocument();
  });
});

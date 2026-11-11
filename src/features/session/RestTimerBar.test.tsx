import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { RestTimerBar } from './RestTimerBar';
import type { RestTimer } from './useRestTimer';

const START = new Date(2026, 10, 5, 18, 0, 0).getTime();

// Only the date is faked: the bar's own interval and the user events keep running for real.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

/** A rest of 3:00 that started 55 s ago: 2:05 left. */
const running: RestTimer = { endsAt: START + 125_000, total: 180, from: null, at: START - 55_000 };

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

  it('counts down by itself', async () => {
    setup(running);
    vi.setSystemTime(START + 10_000);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    expect(screen.getByText('1:55')).toBeInTheDocument();
  });

  it('shows a restart or an adjustment at once, not a tick later', () => {
    setup({ endsAt: START + 180_000, total: 180, from: null, at: START });
    expect(screen.getByText('3:00')).toBeInTheDocument();
  });

  it('shows no "next" when there is no open row left', () => {
    setup(running, null);
    expect(screen.queryByText(/Siguiente/)).not.toBeInTheDocument();
  });

  it('tells you to go on when the time is up', () => {
    setup({ endsAt: START, total: 180, from: null, at: START - 180_000 });
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

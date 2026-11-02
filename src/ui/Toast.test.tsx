import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { useToast } from './ToastContext';
import type { ToastOptions } from './ToastContext';

function Trigger({ options }: { options: ToastOptions }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        toast.show(options);
      }}
    >
      show
    </button>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // fireEvent is synchronous, so it does not fight the fake timers.
  const click = (name: string) => {
    fireEvent.click(screen.getByRole('button', { name }));
  };

  it('shows the message in a polite live region', () => {
    renderWithProviders(<Trigger options={{ message: 'Guardado' }} />);
    click('show');

    const region = screen.getByRole('region', { name: 'Avisos' });
    expect(region.querySelector('[aria-live="polite"]')).toHaveTextContent('Guardado');
  });

  it('disappears after 4 seconds', () => {
    renderWithProviders(<Trigger options={{ message: 'Guardado' }} />);
    click('show');

    act(() => {
      vi.advanceTimersByTime(3900);
    });
    expect(screen.getByText('Guardado')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Guardado')).not.toBeInTheDocument();
  });

  it('runs its action (Undo) and closes', () => {
    const onAction = vi.fn();
    renderWithProviders(
      <Trigger options={{ message: 'Serie quitada', action: { label: 'Deshacer', onAction } }} />,
    );
    click('show');
    click('Deshacer');

    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByText('Serie quitada')).not.toBeInTheDocument();
  });

  it('stays 6 seconds when it has an action', () => {
    renderWithProviders(
      <Trigger
        options={{ message: 'Serie quitada', action: { label: 'Deshacer', onAction: vi.fn() } }}
      />,
    );
    click('show');

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Serie quitada')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByText('Serie quitada')).not.toBeInTheDocument();
  });

  it('can be closed by hand', () => {
    renderWithProviders(<Trigger options={{ message: 'Guardado' }} />);
    click('show');
    click('Cerrar');

    expect(screen.queryByText('Guardado')).not.toBeInTheDocument();
  });

  it('shows at most three at a time, dropping the oldest', () => {
    let count = 0;
    function Many() {
      const toast = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            count += 1;
            toast.show({ message: `Aviso ${String(count)}` });
          }}
        >
          more
        </button>
      );
    }
    renderWithProviders(<Many />);
    for (let i = 0; i < 4; i += 1) click('more');

    expect(screen.queryByText('Aviso 1')).not.toBeInTheDocument();
    expect(screen.getByText('Aviso 2')).toBeInTheDocument();
    expect(screen.getByText('Aviso 4')).toBeInTheDocument();
  });
});

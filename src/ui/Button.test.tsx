import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { IconButton } from './IconButton';

describe('Button', () => {
  it('is a button that does not submit forms by default', () => {
    render(<Button>Empezar</Button>);
    expect(screen.getByRole('button', { name: 'Empezar' })).toHaveAttribute('type', 'button');
  });

  it('can be a submit button', () => {
    render(<Button type="submit">Guardar</Button>);
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'submit');
  });

  it('calls onClick, but not when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Empezar</Button>);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Empezar
      </Button>,
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps its icon out of the accessible name', () => {
    render(<Button icon="plus">Serie</Button>);
    const button = screen.getByRole('button', { name: 'Serie' });
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('forwards a ref to the native button', () => {
    let node: HTMLButtonElement | null = null;
    render(
      <Button
        ref={(element) => {
          node = element;
        }}
      >
        Ref
      </Button>,
    );
    expect(node).toBe(screen.getByRole('button', { name: 'Ref' }));
  });
});

describe('IconButton', () => {
  it('is named by its label and shows it as a tooltip', () => {
    render(<IconButton icon="close" label="Cerrar" />);
    const button = screen.getByRole('button', { name: 'Cerrar' });
    expect(button).toHaveAttribute('title', 'Cerrar');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('calls onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton icon="plus" label="Añadir" onClick={onClick} />);
    await user.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

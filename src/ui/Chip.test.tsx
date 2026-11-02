import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Card } from './Card';
import { Chip } from './Chip';
import { EmptyState } from './EmptyState';
import { Tag } from './Tag';

function FilterChip() {
  const [on, setOn] = useState(false);
  return (
    <Chip
      selected={on}
      onClick={() => {
        setOn(!on);
      }}
    >
      Straps
    </Chip>
  );
}

describe('Chip', () => {
  it('is announced as a toggle button when it has a selected state', async () => {
    const user = userEvent.setup();
    render(<FilterChip />);
    const chip = screen.getByRole('button', { name: 'Straps' });

    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('is a plain button when used as an action', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>+ Serie</Chip>);
    const chip = screen.getByRole('button', { name: '+ Serie' });

    expect(chip).not.toHaveAttribute('aria-pressed');
    await user.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Tag', () => {
  it('renders static text, not a control', () => {
    render(<Tag tone="warmup">C</Tag>);
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Card', () => {
  it('renders the requested element', () => {
    render(
      <Card element="section">
        <h2>Bloque</h2>
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Bloque' }).parentElement?.tagName).toBe('SECTION');
  });
});

describe('EmptyState', () => {
  it('shows a heading, a description and an action', () => {
    render(
      <EmptyState
        icon="calendar"
        title="Sin sesiones"
        description="Cuando registres una sesión aparecerá aquí."
        action={<button type="button">Empezar</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Sin sesiones' })).toBeInTheDocument();
    expect(screen.getByText('Cuando registres una sesión aparecerá aquí.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeInTheDocument();
  });

  it('can use a level-3 heading', () => {
    render(<EmptyState title="Vacío" headingLevel={3} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Vacío' })).toBeInTheDocument();
  });
});
